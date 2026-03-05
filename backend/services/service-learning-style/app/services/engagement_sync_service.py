"""
Sync engagement-tracker daily metrics into StudentBehaviorTracking.

Usage (from a script):
    from app.services.engagement_sync_service import sync_student_behavior
    sync_student_behavior("STU0001", days=7)
"""
from typing import List, Dict, Any
from datetime import datetime
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.learning_style import StudentBehaviorTracking
from datetime import datetime, date


def fetch_daily_metrics(student_id: str, days: int = 7) -> List[Dict[str, Any]]:
    """
    Call engagement-tracker:
    GET /api/v1/engagement/students/{student_id}/metrics?days={days}

    Returns list of daily metric dicts.
    """
    url = f"{settings.ENGAGEMENT_API_URL}/engagement/students/{student_id}/metrics"
    params = {"days": days}
    with httpx.Client(timeout=30.0) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()


def map_metric_to_behavior(student_id: str, metric: Dict[str, Any]) -> StudentBehaviorTracking:
    """
    Map one DailyMetricResponse from engagement-tracker to StudentBehaviorTracking.

    VARK mapping:
      - Auditory: video_plays, video_watch_minutes → video_watch_time, video_interactions
      - Reading: page_views, content_interactions → text_read_time, articles_read
      - Visual: resource_downloads → diagram_views (e.g. diagram/image views)
      - Kinesthetic: quiz_attempts, assignments_submitted → interactive_exercises
    """
    # Parse date string to datetime (store as midnight)
    tracking_date = datetime.fromisoformat(str(metric["date"]))

    total_minutes = float(metric.get("total_session_duration_minutes", 0.0))
    total_seconds = int(total_minutes * 60)

    page_views = int(metric.get("page_views", 0))
    content_interactions = int(metric.get("content_interactions", 0))
    video_plays = int(metric.get("video_plays", 0))
    video_watch_minutes = float(metric.get("video_watch_minutes", 0.0))
    resource_downloads = int(metric.get("resource_downloads", 0))
    quiz_attempts = int(metric.get("quiz_attempts", 0))
    assignments_submitted = int(metric.get("assignments_submitted", 0))
    forum_posts = int(metric.get("forum_posts", 0))
    forum_replies = int(metric.get("forum_replies", 0))
    login_count = int(metric.get("login_count", 0))

    # VARK-specific mappings
    video_watch_seconds = int(video_watch_minutes * 60)
    video_completion_rate = (1.0 if video_plays > 0 else 0.0) * 100  # simplified
    text_read_time = (page_views + content_interactions) * 60  # 1 min per page/interaction
    interactive_exercises = quiz_attempts + assignments_submitted

    return StudentBehaviorTracking(
      student_id=student_id,
      tracking_date=tracking_date,
      week_number=tracking_date.isocalendar()[1],
      # Auditory (video)
      video_watch_time=video_watch_seconds,
      video_completion_rate=video_completion_rate,
      video_interactions=video_plays,
      # Reading
      text_read_time=text_read_time,
      articles_read=page_views + content_interactions,
      note_taking_count=0,
      # Audio (podcasts - not from LMS yet)
      audio_playback_time=0,
      podcast_completions=0,
      # Kinesthetic (quizzes, assignments)
      simulation_time=0,
      interactive_exercises=interactive_exercises,
      hands_on_activities=assignments_submitted,
      # Collaboration
      forum_posts=forum_posts,
      discussion_participation=forum_replies,
      peer_interactions=0,
      # Visual (diagrams, images - resource_download used for diagram view)
      diagram_views=resource_downloads,
      image_interactions=resource_downloads,
      visual_aid_usage=resource_downloads,
      # Overall
      total_session_time=max(total_seconds, video_watch_seconds + text_read_time),
      login_count=login_count,
    )


def sync_student_behavior(student_id: str, days: int = 7) -> int:
    """
    Fetch recent daily metrics for a student and upsert StudentBehaviorTracking rows.

    Returns how many behavior records were written.
    """
    metrics = fetch_daily_metrics(student_id=student_id, days=days)
    if not metrics:
        return 0

    # Collect date objects from metrics
    metric_dates: list[date] = []
    for m in metrics:
        raw = m["date"]
        if isinstance(raw, date):
            metric_dates.append(raw)
        else:
            # raw like "2025-12-08" -> date object
            metric_dates.append(date.fromisoformat(str(raw)))

    min_date = min(metric_dates)
    max_date = max(metric_dates)

    db: Session = SessionLocal()
    try:
        # Delete existing behavior rows for that student and date range (idempotent sync)
        db.query(StudentBehaviorTracking).filter(
            StudentBehaviorTracking.student_id == student_id,
            StudentBehaviorTracking.tracking_date >= datetime.combine(min_date, datetime.min.time()),
            StudentBehaviorTracking.tracking_date <= datetime.combine(max_date, datetime.max.time()),
        ).delete(synchronize_session=False)

        count = 0
        for m in metrics:
            behavior = map_metric_to_behavior(student_id, m)
            db.add(behavior)
            count += 1

        db.commit()
        return count
    finally:
        db.close()