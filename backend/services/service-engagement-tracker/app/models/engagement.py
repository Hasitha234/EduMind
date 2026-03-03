"""
SQLAlchemy models for engagement tracking
"""
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Date, 
    Boolean, JSON, ForeignKey, CheckConstraint, Text, Time
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class StudentActivityEvent(Base):
    """
    Raw activity events - captures every student interaction
    High volume table (75k+ events/day for 500 students)
    """
    __tablename__ = "student_activity_events"
    
    event_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(String(50), nullable=False, index=True)
    institute_id = Column(String(100), nullable=False, index=True, default='LMS_INST_A')
    event_type = Column(String(50), nullable=False)
    event_timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    session_id = Column(String(100), nullable=True)
    
    # Event-specific data stored as JSON
    event_data = Column(JSONB, default={})
    
    # Tracking
    source_service = Column(String(50))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            event_type.in_([
                'login', 'logout', 'page_view', 'video_play', 'video_complete',
                'quiz_start', 'quiz_submit', 'assignment_submit', 'forum_post',
                'forum_reply', 'resource_download', 'content_interaction'
            ]),
            name='chk_event_type'
        ),
    )
    
    def __repr__(self):
        return f"<ActivityEvent {self.event_type} by {self.student_id} at {self.event_timestamp}>"


class DailyEngagementMetric(Base):
    """
    Daily aggregated metrics per student
    Pre-computed for performance
    """
    __tablename__ = "daily_engagement_metrics"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(50), nullable=False, index=True)
    institute_id = Column(String(100), nullable=False, index=True, default='LMS_INST_A')
    date = Column(Date, nullable=False, index=True)
    
    # Login metrics
    login_count = Column(Integer, default=0)
    first_login_time = Column(Time, nullable=True)
    last_login_time = Column(Time, nullable=True)
    
    # Session metrics
    total_sessions = Column(Integer, default=0)
    total_session_duration_minutes = Column(Float, default=0.0)
    avg_session_duration_minutes = Column(Float, default=0.0)
    longest_session_minutes = Column(Float, default=0.0)
    
    # Content interaction metrics
    page_views = Column(Integer, default=0)
    unique_pages_viewed = Column(Integer, default=0)
    content_interactions = Column(Integer, default=0)
    video_plays = Column(Integer, default=0)
    video_watch_minutes = Column(Float, default=0.0)
    resource_downloads = Column(Integer, default=0)
    
    # Forum metrics
    forum_posts = Column(Integer, default=0)
    forum_replies = Column(Integer, default=0)
    forum_reads = Column(Integer, default=0)
    
    # Assessment metrics
    quiz_attempts = Column(Integer, default=0)
    quiz_score_sum = Column(Float, default=0.0)
    quiz_score_avg = Column(Float, nullable=True)
    assignments_submitted = Column(Integer, default=0)
    assignments_on_time = Column(Integer, default=0)
    
    # Metadata
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Unique constraint: one row per student per day
    __table_args__ = (
        CheckConstraint('login_count >= 0', name='chk_login_count_positive'),
        CheckConstraint('total_session_duration_minutes >= 0', name='chk_session_duration_positive'),
        CheckConstraint('quiz_score_avg IS NULL OR (quiz_score_avg >= 0 AND quiz_score_avg <= 100)', 
                       name='chk_quiz_score_range'),
    )
    
    def __repr__(self):
        return f"<DailyMetric {self.student_id} on {self.date}>"


class EngagementScore(Base):
    """
    Calculated composite engagement scores
    """
    __tablename__ = "engagement_scores"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(50), nullable=False, index=True)
    institute_id = Column(String(100), nullable=False, index=True, default='LMS_INST_A')
    date = Column(Date, nullable=False, index=True)
    
    # Component scores (0-100 scale)
    login_score = Column(Float, nullable=False)
    session_score = Column(Float, nullable=False)
    interaction_score = Column(Float, nullable=False)
    forum_score = Column(Float, nullable=False)
    assignment_score = Column(Float, nullable=False)
    
    # Composite engagement score (weighted average)
    engagement_score = Column(Float, nullable=False)
    
    # Engagement level categorization
    engagement_level = Column(String(20), nullable=False)
    
    # Trend analysis
    engagement_score_lag_1day = Column(Float, nullable=True)
    engagement_score_lag_7days = Column(Float, nullable=True)
    engagement_change = Column(Float, nullable=True)
    engagement_trend = Column(String(20), nullable=True)
    rolling_avg_7days = Column(Float, nullable=True)
    rolling_avg_30days = Column(Float, nullable=True)
    
    # Metadata
    calculation_version = Column(String(10), default='v1.0')
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            engagement_level.in_(['Low', 'Medium', 'High']),
            name='chk_engagement_level'
        ),
        CheckConstraint(
            engagement_trend.in_(['Improving', 'Stable', 'Declining']) | (engagement_trend == None),
            name='chk_engagement_trend'
        ),
        CheckConstraint('engagement_score >= 0 AND engagement_score <= 100', 
                       name='chk_engagement_score_range'),
    )
    
    def __repr__(self):
        return f"<EngagementScore {self.student_id} on {self.date}: {self.engagement_score:.1f} ({self.engagement_level})>"


class DisengagementPrediction(Base):
    """
    ML model predictions for at-risk students
    """
    __tablename__ = "disengagement_predictions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(50), nullable=False, index=True)
    institute_id = Column(String(100), nullable=False, index=True, default='LMS_INST_A')
    prediction_date = Column(Date, nullable=False, index=True)
    
    # Prediction outputs
    at_risk = Column(Boolean, nullable=False)
    risk_probability = Column(Float, nullable=False)
    risk_level = Column(String(20), nullable=False)
    
    # Model explainability
    contributing_factors = Column(JSONB, nullable=True)
    feature_importance = Column(JSONB, nullable=True)
    
    # Model metadata
    model_version = Column(String(50), nullable=False)
    model_type = Column(String(50), nullable=True)
    confidence_score = Column(Float, nullable=True)
    
    # Prediction metadata
    prediction_horizon_days = Column(Integer, default=7)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Constraints
    __table_args__ = (
        CheckConstraint('risk_probability >= 0 AND risk_probability <= 1', 
                       name='chk_risk_probability_range'),
        CheckConstraint(
            risk_level.in_(['Low', 'Medium', 'High']),
            name='chk_risk_level'
        ),
    )
    
    def __repr__(self):
        return f"<Prediction {self.student_id} on {self.prediction_date}: {self.risk_level} risk ({self.risk_probability:.2%})>"


class InterventionLog(Base):
    """
    Track interventions triggered by the system
    """
    __tablename__ = "intervention_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(50), nullable=False, index=True)
    prediction_id = Column(Integer, ForeignKey('disengagement_predictions.id'), nullable=True)
    
    # Intervention details
    intervention_type = Column(String(50), nullable=False)
    intervention_title = Column(String(200), nullable=True)
    intervention_content = Column(Text, nullable=True)
    
    # Delivery status
    status = Column(String(20), nullable=False, default='pending')
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    clicked_at = Column(DateTime(timezone=True), nullable=True)
    
    # Effectiveness tracking
    student_response = Column(String(50), nullable=True)
    engagement_change_7days = Column(Float, nullable=True)
    
    # Metadata
    triggered_by = Column(String(50), default='system')
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Relationship
    prediction = relationship("DisengagementPrediction", backref="interventions")
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            intervention_type.in_([
                'email_reminder', 'push_notification', 'resource_recommendation',
                'alternative_content', 'micro_lesson', 'practice_problems',
                'discussion_prompt', 'tutor_alert', 'motivational_message',
                'peer_comparison', 'study_group_suggestion'
            ]),
            name='chk_intervention_type'
        ),
        CheckConstraint(
            status.in_(['pending', 'sent', 'delivered', 'opened', 'clicked', 'failed']),
            name='chk_intervention_status'
        ),
    )
    
    def __repr__(self):
        return f"<Intervention {self.intervention_type} for {self.student_id}: {self.status}>"


class StudySchedule(Base):
    """
    Personalized study schedules generated from engagement features
    """
    __tablename__ = "study_schedules"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(String(50), nullable=False, index=True)
    
    # Schedule period
    week_start_date = Column(Date, nullable=False, index=True)
    week_end_date = Column(Date, nullable=False)
    
    # Schedule configuration (from engagement features)
    session_length_minutes = Column(Integer, nullable=False)  # Personalized session length
    sessions_per_day = Column(Integer, nullable=False)  # Number of study blocks per day
    total_study_minutes_per_day = Column(Integer, nullable=False)
    
    # Schedule adjustments
    load_reduction_factor = Column(Float, default=1.0)  # 0.5-1.0 for decline-aware reduction
    is_light_day = Column(Boolean, default=False)  # True for predicted low-engagement days
    
    # Feature values used for generation
    features_used = Column(JSONB, nullable=True)  # Store feature values for transparency
    
    # Schedule details (daily breakdown)
    daily_schedules = Column(JSONB, nullable=False)  # Array of daily schedule objects
    
    # Metadata
    generation_method = Column(String(50), default='engagement_based')
    version = Column(String(10), default='v1.0')
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Constraints
    __table_args__ = (
        CheckConstraint('session_length_minutes > 0 AND session_length_minutes <= 180', 
                       name='chk_session_length'),
        CheckConstraint('sessions_per_day > 0 AND sessions_per_day <= 10', 
                       name='chk_sessions_per_day'),
        CheckConstraint('load_reduction_factor >= 0.3 AND load_reduction_factor <= 1.0', 
                       name='chk_load_reduction'),
    )
    
    def __repr__(self):
        return f"<StudySchedule {self.student_id} week {self.week_start_date}: {self.sessions_per_day}x{self.session_length_minutes}min/day>"

