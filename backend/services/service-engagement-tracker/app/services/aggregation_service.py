"""
Aggregation pipeline: raw events -> daily metrics -> engagement scores -> predictions.

Three-step process that should run after every event ingest (or in batch):
    1. aggregate_daily_metrics  – count / sum raw events for one (student, date)
    2. compute_engagement_score – weighted scoring + trend for that day
    3. generate_prediction      – rule-based risk classification
"""

from datetime import date, datetime, time, timedelta
from typing import Optional

from sqlalchemy import func, desc, and_, cast, Date
from sqlalchemy.orm import Session

from app.models import (
    StudentActivityEvent,
    DailyEngagementMetric,
    EngagementScore,
    DisengagementPrediction,
)
from app.services.ml_service import get_disengagement_ml_service

# ---------------------------------------------------------------------------
# Weight configuration for component scores  (must sum to 1.0)
# ---------------------------------------------------------------------------
WEIGHTS = {
    "login": 0.15,
    "session": 0.25,
    "interaction": 0.25,
    "forum": 0.15,
    "assignment": 0.20,
}

# Normalisation ceilings – if a student hits the ceiling they score 100
MAX_LOGINS_PER_DAY = 5
MAX_SESSION_MINUTES = 120
MAX_PAGE_VIEWS = 30
MAX_FORUM_ACTIONS = 10
MAX_ASSIGNMENT_ACTIONS = 5


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


# ======================================================================== #
# Step 1 – aggregate raw events into a DailyEngagementMetric row
# ======================================================================== #

def aggregate_daily_metrics(
    db: Session, student_id: str, target_date: date, institute_id: str = "LMS_INST_A"
) -> DailyEngagementMetric:
    day_start = datetime.combine(target_date, time.min)
    day_end = datetime.combine(target_date, time.max)

    events = (
        db.query(StudentActivityEvent)
        .filter(
            StudentActivityEvent.student_id == student_id,
            StudentActivityEvent.institute_id == institute_id,
            StudentActivityEvent.event_timestamp >= day_start,
            StudentActivityEvent.event_timestamp <= day_end,
        )
        .all()
    )

    login_count = sum(1 for e in events if e.event_type == "login")
    page_views = sum(1 for e in events if e.event_type == "page_view")
    video_plays = sum(1 for e in events if e.event_type == "video_play")
    video_completes = sum(1 for e in events if e.event_type == "video_complete")
    quiz_attempts = sum(1 for e in events if e.event_type in ("quiz_start", "quiz_submit"))
    assignments_submitted = sum(1 for e in events if e.event_type == "assignment_submit")
    forum_posts = sum(1 for e in events if e.event_type == "forum_post")
    forum_replies = sum(1 for e in events if e.event_type == "forum_reply")
    resource_downloads = sum(1 for e in events if e.event_type == "resource_download")
    content_interactions = sum(1 for e in events if e.event_type == "content_interaction")

    # Session duration approximation from distinct session_ids
    session_ids = {e.session_id for e in events if e.session_id}
    total_sessions = len(session_ids)
    total_session_minutes = 0.0
    longest_session = 0.0
    for sid in session_ids:
        sess_events = sorted(
            [e for e in events if e.session_id == sid],
            key=lambda e: e.event_timestamp,
        )
        if len(sess_events) >= 2:
            duration = (sess_events[-1].event_timestamp - sess_events[0].event_timestamp).total_seconds() / 60
        else:
            duration = 2.0  # single-event session gets 2 min
        total_session_minutes += duration
        longest_session = max(longest_session, duration)

    avg_session = total_session_minutes / total_sessions if total_sessions else 0.0

    first_login_time = None
    last_login_time = None
    login_events = sorted(
        [e for e in events if e.event_type == "login"],
        key=lambda e: e.event_timestamp,
    )
    if login_events:
        first_login_time = login_events[0].event_timestamp.time()
        last_login_time = login_events[-1].event_timestamp.time()

    # Upsert
    existing = (
        db.query(DailyEngagementMetric)
        .filter(
            DailyEngagementMetric.student_id == student_id,
            DailyEngagementMetric.institute_id == institute_id,
            DailyEngagementMetric.date == target_date,
        )
        .first()
    )
    if existing:
        metric = existing
    else:
        metric = DailyEngagementMetric(student_id=student_id, institute_id=institute_id, date=target_date)
        db.add(metric)

    metric.login_count = login_count
    metric.first_login_time = first_login_time
    metric.last_login_time = last_login_time
    metric.total_sessions = total_sessions
    metric.total_session_duration_minutes = round(total_session_minutes, 2)
    metric.avg_session_duration_minutes = round(avg_session, 2)
    metric.longest_session_minutes = round(longest_session, 2)
    metric.page_views = page_views
    metric.unique_pages_viewed = page_views  # simplified
    metric.content_interactions = content_interactions
    metric.video_plays = video_plays
    metric.video_watch_minutes = round(video_plays * 5.0, 2)  # ~5 min per play
    metric.resource_downloads = resource_downloads
    metric.forum_posts = forum_posts
    metric.forum_replies = forum_replies
    metric.quiz_attempts = quiz_attempts
    metric.assignments_submitted = assignments_submitted
    metric.updated_at = datetime.utcnow()

    db.flush()
    return metric


# ======================================================================== #
# Step 2 – compute composite engagement score for (student, date)
# ======================================================================== #

def compute_engagement_score(
    db: Session, student_id: str, target_date: date, institute_id: str = "LMS_INST_A"
) -> EngagementScore:
    metric = (
        db.query(DailyEngagementMetric)
        .filter(
            DailyEngagementMetric.student_id == student_id,
            DailyEngagementMetric.institute_id == institute_id,
            DailyEngagementMetric.date == target_date,
        )
        .first()
    )
    if metric is None:
        raise ValueError(f"No daily metric for {student_id} on {target_date}")

    login_score = _clamp((metric.login_count / MAX_LOGINS_PER_DAY) * 100)
    session_score = _clamp((metric.total_session_duration_minutes / MAX_SESSION_MINUTES) * 100)
    interaction_score = _clamp(
        ((metric.page_views + metric.content_interactions + metric.video_plays) / MAX_PAGE_VIEWS) * 100
    )
    forum_score = _clamp(((metric.forum_posts + metric.forum_replies) / MAX_FORUM_ACTIONS) * 100)
    assignment_score = _clamp(
        ((metric.assignments_submitted + metric.quiz_attempts) / MAX_ASSIGNMENT_ACTIONS) * 100
    )

    composite = (
        WEIGHTS["login"] * login_score
        + WEIGHTS["session"] * session_score
        + WEIGHTS["interaction"] * interaction_score
        + WEIGHTS["forum"] * forum_score
        + WEIGHTS["assignment"] * assignment_score
    )
    composite = round(_clamp(composite), 2)

    # Engagement level
    if composite >= 70:
        level = "High"
    elif composite >= 40:
        level = "Medium"
    else:
        level = "Low"

    # Lag & trend
    prev_1 = (
        db.query(EngagementScore)
        .filter(
            EngagementScore.student_id == student_id,
            EngagementScore.institute_id == institute_id,
            EngagementScore.date == target_date - timedelta(days=1),
        )
        .first()
    )
    prev_7_scores = (
        db.query(EngagementScore)
        .filter(
            EngagementScore.student_id == student_id,
            EngagementScore.institute_id == institute_id,
            EngagementScore.date >= target_date - timedelta(days=7),
            EngagementScore.date < target_date,
        )
        .all()
    )
    prev_30_scores = (
        db.query(EngagementScore)
        .filter(
            EngagementScore.student_id == student_id,
            EngagementScore.institute_id == institute_id,
            EngagementScore.date >= target_date - timedelta(days=30),
            EngagementScore.date < target_date,
        )
        .all()
    )

    lag_1 = prev_1.engagement_score if prev_1 else None
    lag_7 = prev_7_scores[0].engagement_score if prev_7_scores else None
    avg_7 = (
        round(sum(s.engagement_score for s in prev_7_scores) / len(prev_7_scores), 2)
        if prev_7_scores
        else None
    )
    avg_30 = (
        round(sum(s.engagement_score for s in prev_30_scores) / len(prev_30_scores), 2)
        if prev_30_scores
        else None
    )

    change = round(composite - lag_1, 2) if lag_1 is not None else None
    if change is not None:
        trend = "Improving" if change > 2 else ("Declining" if change < -2 else "Stable")
    else:
        trend = "Stable"

    # Upsert
    existing = (
        db.query(EngagementScore)
        .filter(
            EngagementScore.student_id == student_id,
            EngagementScore.institute_id == institute_id,
            EngagementScore.date == target_date,
        )
        .first()
    )
    if existing:
        score = existing
    else:
        score = EngagementScore(student_id=student_id, institute_id=institute_id, date=target_date)
        db.add(score)

    score.login_score = round(login_score, 2)
    score.session_score = round(session_score, 2)
    score.interaction_score = round(interaction_score, 2)
    score.forum_score = round(forum_score, 2)
    score.assignment_score = round(assignment_score, 2)
    score.engagement_score = composite
    score.engagement_level = level
    score.engagement_score_lag_1day = lag_1
    score.engagement_score_lag_7days = lag_7
    score.engagement_change = change
    score.engagement_trend = trend
    score.rolling_avg_7days = avg_7
    score.rolling_avg_30days = avg_30
    score.created_at = datetime.utcnow()

    db.flush()
    return score


# ======================================================================== #
# Step 3 – rule-based disengagement prediction
# ======================================================================== #

def generate_prediction(
    db: Session, student_id: str, institute_id: str = "LMS_INST_A"
) -> DisengagementPrediction:
    latest_score = (
        db.query(EngagementScore)
        .filter(
            EngagementScore.student_id == student_id,
            EngagementScore.institute_id == institute_id,
        )
        .order_by(desc(EngagementScore.date))
        .first()
    )
    if latest_score is None:
        raise ValueError(f"No engagement score for {student_id}")

    # Count days tracked (for consecutive_low_days approximation)
    days_tracked = (
        db.query(func.count(EngagementScore.id))
        .filter(
            EngagementScore.student_id == student_id,
            EngagementScore.institute_id == institute_id,
        )
        .scalar()
    ) or 1

    # Get the latest DailyEngagementMetric for component scores
    latest_metric = (
        db.query(DailyEngagementMetric)
        .filter(
            DailyEngagementMetric.student_id == student_id,
            DailyEngagementMetric.institute_id == institute_id,
            DailyEngagementMetric.date == latest_score.date,
        )
        .first()
    )

    # Delegate to ML service (falls back to rule-based if model not loaded)
    ml_svc = get_disengagement_ml_service()
    result = ml_svc.predict(
        engagement_score=latest_score.engagement_score,
        engagement_trend=latest_score.engagement_trend or "Stable",
        login_score=getattr(latest_score, "login_score", 0.0) or 0.0,
        session_score=getattr(latest_score, "session_score", 0.0) or 0.0,
        interaction_score=getattr(latest_score, "interaction_score", 0.0) or 0.0,
        forum_score=getattr(latest_score, "forum_score", 0.0) or 0.0,
        assignment_score=getattr(latest_score, "assignment_score", 0.0) or 0.0,
        lag_1=latest_score.engagement_score_lag_1day,
        lag_3=None,
        lag_7=latest_score.engagement_score_lag_7days,
        lag_14=None,
        rolling_avg_7=latest_score.rolling_avg_7days,
        rolling_avg_30=latest_score.rolling_avg_30days,
        days_tracked=days_tracked,
    )

    factors = {
        "engagement_score": latest_score.engagement_score,
        "engagement_level": latest_score.engagement_level,
        "engagement_trend": latest_score.engagement_trend,
        "model_used": result["model_type"],
    }
    if latest_score.engagement_score < 30:
        factors["low_engagement_detected"] = True
    if latest_score.engagement_trend == "Declining":
        factors["declining_trend"] = True

    # Build feature importance list from metadata if available
    ml_meta = ml_svc.metadata if ml_svc.is_ready else {}
    feature_importance = ml_meta.get("feature_importance", [
        {"feature": "engagement_score", "importance": 0.6},
        {"feature": "engagement_trend",  "importance": 0.25},
        {"feature": "engagement_level",  "importance": 0.15},
    ])

    # Upsert for today
    today = date.today()
    existing = (
        db.query(DisengagementPrediction)
        .filter(
            DisengagementPrediction.student_id == student_id,
            DisengagementPrediction.institute_id == institute_id,
            DisengagementPrediction.prediction_date == today,
        )
        .first()
    )
    if existing:
        pred = existing
    else:
        pred = DisengagementPrediction(student_id=student_id, institute_id=institute_id, prediction_date=today)
        db.add(pred)

    pred.at_risk              = result["at_risk"]
    pred.risk_probability     = result["risk_probability"]
    pred.risk_level           = result["risk_level"]
    pred.contributing_factors = factors
    pred.feature_importance   = feature_importance[:5]
    pred.model_version        = result["model_version"]
    pred.model_type           = result["model_type"]
    pred.confidence_score     = result["confidence_score"]
    pred.prediction_horizon_days = 7
    pred.created_at           = datetime.utcnow()

    db.flush()
    return pred


# ======================================================================== #
# Convenience: run the full pipeline for one student on a given date
# ======================================================================== #

def run_pipeline(
    db: Session,
    student_id: str,
    target_date: Optional[date] = None,
    institute_id: str = "LMS_INST_A",
) -> dict:
    if target_date is None:
        target_date = date.today()

    metric = aggregate_daily_metrics(db, student_id, target_date, institute_id=institute_id)
    score = compute_engagement_score(db, student_id, target_date, institute_id=institute_id)
    prediction = generate_prediction(db, student_id, institute_id=institute_id)

    db.commit()
    return {
        "student_id": student_id,
        "date": str(target_date),
        "daily_metric_id": metric.id,
        "engagement_score": score.engagement_score,
        "engagement_level": score.engagement_level,
        "risk_level": prediction.risk_level,
        "risk_probability": prediction.risk_probability,
    }
