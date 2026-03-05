"""API routes for student profiles and analytics"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.api.dependencies import get_db
from app.schemas import (
    StudentLearningProfileCreate,
    StudentLearningProfileUpdate,
    StudentLearningProfileResponse,
    StudentAnalytics
)
from app.models import (
    StudentLearningProfile,
    StudentStruggle,
    ResourceRecommendation
)

router = APIRouter(prefix="/students", tags=["Students"])


@router.post("/", response_model=StudentLearningProfileResponse, status_code=status.HTTP_201_CREATED)
def create_student_profile(
    profile: StudentLearningProfileCreate,
    db: Session = Depends(get_db)
):
    """Create a new student learning profile"""
    # Check if already exists
    existing = db.query(StudentLearningProfile).filter(
        StudentLearningProfile.student_id == profile.student_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Student {profile.student_id} already exists"
        )
    
    db_profile = StudentLearningProfile(**profile.model_dump())
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    
    return db_profile


@router.get("/{student_id}", response_model=StudentLearningProfileResponse)
def get_student_profile(
    student_id: str,
    db: Session = Depends(get_db)
):
    """Get student learning profile by ID"""
    profile = db.query(StudentLearningProfile).filter(
        StudentLearningProfile.student_id == student_id
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student {student_id} not found"
        )
    
    return profile


@router.put("/{student_id}", response_model=StudentLearningProfileResponse)
def update_student_profile(
    student_id: str,
    updates: StudentLearningProfileUpdate,
    db: Session = Depends(get_db)
):
    """Update student learning profile"""
    profile = db.query(StudentLearningProfile).filter(
        StudentLearningProfile.student_id == student_id
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student {student_id} not found"
        )
    
    # Update fields
    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)
    
    db.commit()
    db.refresh(profile)
    
    return profile


@router.get("/{student_id}/analytics", response_model=StudentAnalytics)
def get_student_analytics(
    student_id: str,
    db: Session = Depends(get_db)
):
    """Get comprehensive analytics for a student"""
    # Sync latest engagement data from engagement-tracker
    try:
        from app.services.engagement_sync_service import sync_student_behavior
        sync_student_behavior(student_id=student_id, days=14)
    except Exception:
        pass

    # Refresh learning style prediction from behavior data
    try:
        from app.services.ml_service import get_ml_service
        ml = get_ml_service()
        if ml.is_ready:
            ml.classify_and_update(student_id, db)
    except Exception:
        pass

    profile = db.query(StudentLearningProfile).filter(
        StudentLearningProfile.student_id == student_id
    ).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student {student_id} not found"
        )
    
    # Get recommendations stats
    recommendations = db.query(ResourceRecommendation).filter(
        ResourceRecommendation.student_id == student_id
    ).all()
    
    total_recs = len(recommendations)
    viewed_recs = sum(1 for r in recommendations if r.viewed)
    completed_recs = sum(1 for r in recommendations if r.completed)
    
    # Get struggles
    struggles = db.query(StudentStruggle).filter(
        StudentStruggle.student_id == student_id
    ).all()
    
    total_struggles = len(struggles)
    unresolved_struggles = sum(1 for s in struggles if not s.resolved)
    
    # Most effective resource types
    from collections import Counter
    completed = [r for r in recommendations if r.completed and r.resource]
    resource_types = Counter([r.resource.resource_type for r in completed])
    most_effective = [
        {"resource_type": rt, "count": count}
        for rt, count in resource_types.most_common(3)
    ]
    
    # Determine engagement trend (simplified)
    if profile.avg_completion_rate >= 75:
        trend = "improving"
    elif profile.avg_completion_rate < 50:
        trend = "declining"
    else:
        trend = "stable"
    
    return StudentAnalytics(
        student_id=student_id,
        learning_style=profile.learning_style,
        style_confidence=profile.style_confidence,
        total_recommendations=total_recs,
        viewed_recommendations=viewed_recs,
        completed_recommendations=completed_recs,
        avg_completion_rate=profile.avg_completion_rate,
        total_struggles=total_struggles,
        unresolved_struggles=unresolved_struggles,
        struggle_topics=profile.struggle_topics or [],
        most_effective_resource_types=most_effective,
        engagement_trend=trend
    )


@router.get("/", response_model=List[StudentLearningProfileResponse])
def list_students(
    skip: int = 0,
    limit: int = 50,
    learning_style: str = None,
    db: Session = Depends(get_db)
):
    """List all student profiles with optional filtering"""
    query = db.query(StudentLearningProfile)
    
    if learning_style:
        query = query.filter(StudentLearningProfile.learning_style == learning_style)
    
    profiles = query.offset(skip).limit(limit).all()
    return profiles











