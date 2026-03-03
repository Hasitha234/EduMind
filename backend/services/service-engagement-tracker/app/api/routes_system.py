"""
System API Routes
Health checks, statistics, and system information
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime
from typing import Optional

from app.api.dependencies import get_db
from app.models import (
    EngagementScore,
    DisengagementPrediction,
    DailyEngagementMetric,
    StudentActivityEvent
)
from app.schemas import HealthResponse, StatsResponse

router = APIRouter(tags=["System"])


@router.get("/")
def root():
    """Root endpoint"""
    return {
        "service": "EduMind Engagement Tracking Service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/api/docs",
        "health": "/health"
    }


@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint
    
    Verifies that the service and database are operational
    """
    try:
        # Test database connection
        db.execute(func.now())
        database_connected = True
    except Exception:
        database_connected = False
    
    return HealthResponse(
        status="healthy" if database_connected else "unhealthy",
        service="engagement-tracker-service",
        database_connected=database_connected,
        timestamp=datetime.now()
    )


@router.get("/api/v1/stats", response_model=StatsResponse)
def get_system_statistics(
    institute_id: str = Query("LMS_INST_A", description="Institute identifier — stats are scoped per institute"),
    db: Session = Depends(get_db)
):
    """
    Get system statistics scoped to a specific institute.
    All counts and averages reflect only that institute's students.
    """
    try:
        total_students_engagement = db.query(
            func.count(func.distinct(EngagementScore.student_id))
        ).filter(EngagementScore.institute_id == institute_id).scalar()
    except Exception:
        return StatsResponse(
            total_students=0,
            total_engagement_records=0,
            total_predictions=0,
            total_events=0,
            latest_data_date=None,
            high_risk_students=0,
            low_engagement_students=0,
            avg_engagement_score=0.0
        )

    total_engagement_records = db.query(
        func.count(EngagementScore.id)
    ).filter(EngagementScore.institute_id == institute_id).scalar()

    total_predictions = db.query(
        func.count(DisengagementPrediction.id)
    ).filter(DisengagementPrediction.institute_id == institute_id).scalar()

    total_events = db.query(
        func.count(StudentActivityEvent.event_id)
    ).filter(StudentActivityEvent.institute_id == institute_id).scalar()

    latest_engagement_date = db.query(
        func.max(EngagementScore.date)
    ).filter(EngagementScore.institute_id == institute_id).scalar()

    # Latest prediction per student (scoped to institute)
    latest_predictions = db.query(
        DisengagementPrediction.student_id,
        func.max(DisengagementPrediction.prediction_date).label('max_date')
    ).filter(
        DisengagementPrediction.institute_id == institute_id
    ).group_by(DisengagementPrediction.student_id).subquery()

    high_risk_students = db.query(
        func.count(func.distinct(DisengagementPrediction.student_id))
    ).join(
        latest_predictions,
        and_(
            DisengagementPrediction.student_id == latest_predictions.c.student_id,
            DisengagementPrediction.prediction_date == latest_predictions.c.max_date
        )
    ).filter(
        DisengagementPrediction.institute_id == institute_id,
        DisengagementPrediction.risk_level == 'High'
    ).scalar()

    # At-risk count (any risk level marked at_risk=True) from latest prediction per student
    at_risk_students = db.query(
        func.count(func.distinct(DisengagementPrediction.student_id))
    ).join(
        latest_predictions,
        and_(
            DisengagementPrediction.student_id == latest_predictions.c.student_id,
            DisengagementPrediction.prediction_date == latest_predictions.c.max_date
        )
    ).filter(
        DisengagementPrediction.institute_id == institute_id,
        DisengagementPrediction.at_risk == True
    ).scalar()

    # Latest score per student (for avg and low-engagement count)
    latest_scores = db.query(
        EngagementScore.student_id,
        func.max(EngagementScore.date).label('max_date')
    ).filter(
        EngagementScore.institute_id == institute_id
    ).group_by(EngagementScore.student_id).subquery()

    low_engagement_students = db.query(
        func.count(func.distinct(EngagementScore.student_id))
    ).join(
        latest_scores,
        and_(
            EngagementScore.student_id == latest_scores.c.student_id,
            EngagementScore.date == latest_scores.c.max_date
        )
    ).filter(
        EngagementScore.institute_id == institute_id,
        EngagementScore.engagement_level == 'Low'
    ).scalar()

    # Avg engagement — average of each student's LATEST score (matches overview page)
    latest_score_rows = db.query(EngagementScore.engagement_score).join(
        latest_scores,
        and_(
            EngagementScore.student_id == latest_scores.c.student_id,
            EngagementScore.date == latest_scores.c.max_date
        )
    ).filter(EngagementScore.institute_id == institute_id).all()

    avg_engagement = (
        sum(r[0] for r in latest_score_rows) / len(latest_score_rows)
        if latest_score_rows else 0.0
    )

    return StatsResponse(
        total_students=total_students_engagement or 0,
        total_engagement_records=total_engagement_records or 0,
        total_predictions=total_predictions or 0,
        total_events=total_events or 0,
        latest_data_date=latest_engagement_date,
        high_risk_students=high_risk_students or 0,
        low_engagement_students=low_engagement_students or 0,
        avg_engagement_score=round(float(avg_engagement), 2),
        at_risk_students=at_risk_students or 0,
    )


@router.get("/api/v1/info")
def get_system_info():
    """
    Get system information and capabilities
    """
    return {
        "service": "EduMind Engagement Tracking Service",
        "version": "1.0.0",
        "description": "Tracks student engagement and predicts disengagement risk",
        "capabilities": [
            "Real-time event ingestion",
            "Daily engagement scoring",
            "ML-powered disengagement prediction",
            "Student analytics dashboard",
            "At-risk student identification"
        ],
        "ml_models": {
            "engagement_scoring": {
                "version": "v1.0",
                "components": ["login", "session", "interaction", "forum", "assignment"],
                "weights": {
                    "login": 0.20,
                    "session": 0.25,
                    "interaction": 0.25,
                    "forum": 0.15,
                    "assignment": 0.15
                }
            },
            "disengagement_prediction": {
                "version": "v1.0",
                "model_type": "GradientBoostingClassifier",
                "accuracy": "99.94%",
                "roc_auc": 0.9991,
                "prediction_horizon_days": 7
            }
        },
        "endpoints": {
            "engagement": "/api/v1/engagement",
            "predictions": "/api/v1/predictions",
            "students": "/api/v1/students",
            "events": "/api/v1/events",
            "documentation": "/api/docs"
        }
    }

