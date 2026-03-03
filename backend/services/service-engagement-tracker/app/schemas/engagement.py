"""
Pydantic schemas for Engagement Tracking API
"""
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum


# Enums
class EngagementLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class TrendType(str, Enum):
    IMPROVING = "Improving"
    STABLE = "Stable"
    DECLINING = "Declining"


class EventType(str, Enum):
    LOGIN = "login"
    LOGOUT = "logout"
    PAGE_VIEW = "page_view"
    VIDEO_PLAY = "video_play"
    VIDEO_COMPLETE = "video_complete"
    QUIZ_START = "quiz_start"
    QUIZ_SUBMIT = "quiz_submit"
    ASSIGNMENT_SUBMIT = "assignment_submit"
    FORUM_POST = "forum_post"
    FORUM_REPLY = "forum_reply"
    RESOURCE_DOWNLOAD = "resource_download"
    CONTENT_INTERACTION = "content_interaction"


# Request Schemas
class EventCreate(BaseModel):
    """Schema for creating a new activity event"""
    student_id: str = Field(..., description="Student ID")
    event_type: EventType = Field(..., description="Type of event")
    event_timestamp: datetime = Field(..., description="When the event occurred")
    session_id: Optional[str] = Field(None, description="Session identifier")
    event_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Event metadata")
    source_service: Optional[str] = Field("moodle", description="Source system")
    institute_id: Optional[str] = Field(None, description="Institute/LMS identifier (overridden by header if present)")

    class Config:
        json_schema_extra = {
            "example": {
                "student_id": "STU0001",
                "event_type": "login",
                "event_timestamp": "2025-12-15T10:30:00Z",
                "session_id": "sess_12345",
                "event_data": {"ip_address": "192.168.1.1"},
                "source_service": "moodle",
                "institute_id": "LMS_INST_A"
            }
        }


class DateRangeQuery(BaseModel):
    """Schema for date range queries"""
    start_date: date = Field(..., description="Start date")
    end_date: date = Field(..., description="End date")


# Response Schemas
class EngagementScoreResponse(BaseModel):
    """Schema for engagement score response"""
    student_id: str
    date: date
    login_score: float
    session_score: float
    interaction_score: float
    forum_score: float
    assignment_score: float
    engagement_score: float
    engagement_level: EngagementLevel
    engagement_trend: Optional[TrendType]
    rolling_avg_7days: Optional[float]
    rolling_avg_30days: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


class EngagementSummary(BaseModel):
    """Schema for student engagement summary"""
    student_id: str
    days_tracked: int
    avg_engagement_score: float
    current_engagement_level: EngagementLevel
    trend: Optional[TrendType]
    last_updated: date


class DisengagementPredictionResponse(BaseModel):
    """Schema for disengagement prediction response"""
    student_id: str
    prediction_date: date
    at_risk: bool
    risk_probability: float
    risk_level: RiskLevel
    confidence_score: float
    contributing_factors: Optional[Dict[str, Any]]
    feature_importance: Optional[List[Dict[str, Any]]]
    model_version: str
    prediction_horizon_days: int
    created_at: datetime

    class Config:
        from_attributes = True


class AtRiskStudent(BaseModel):
    """Schema for at-risk student summary"""
    student_id: str
    avg_risk_probability: float
    latest_engagement_score: float
    days_at_high_risk: int
    last_prediction_date: date
    contributing_factors: List[str]


class DailyMetricResponse(BaseModel):
    """Schema for daily engagement metrics"""
    student_id: str
    date: date
    login_count: int
    total_session_duration_minutes: float
    page_views: int
    content_interactions: int
    forum_posts: int
    forum_replies: int
    quiz_attempts: int
    assignments_submitted: int

    class Config:
        from_attributes = True


class StudentAnalytics(BaseModel):
    """Comprehensive student analytics"""
    student_id: str
    date_range: Dict[str, date]
    engagement_summary: EngagementSummary
    latest_score: EngagementScoreResponse
    latest_prediction: Optional[DisengagementPredictionResponse]
    engagement_history: List[EngagementScoreResponse]
    risk_history: List[DisengagementPredictionResponse]


class BatchPredictionRequest(BaseModel):
    """Request schema for batch predictions"""
    student_ids: Optional[List[str]] = Field(None, description="List of student IDs (None = all students)")
    prediction_date: Optional[date] = Field(None, description="Date for prediction (None = today)")


class BatchPredictionResponse(BaseModel):
    """Response schema for batch predictions"""
    total_predictions: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    processing_time_seconds: float
    predictions: List[DisengagementPredictionResponse]


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    database_connected: bool
    timestamp: datetime


class StatsResponse(BaseModel):
    """System statistics response"""
    total_students: int
    total_engagement_records: int
    total_predictions: int
    total_events: int
    latest_data_date: Optional[date]
    high_risk_students: int
    low_engagement_students: int
    avg_engagement_score: float = 0.0
    at_risk_students: int = 0


class ErrorResponse(BaseModel):
    """Error response schema"""
    error: str
    detail: str
    timestamp: datetime

