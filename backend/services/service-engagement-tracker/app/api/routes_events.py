"""
Event Ingestion API Routes
For receiving activity events from Moodle or other sources
"""
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid

from app.api.dependencies import get_db
from app.models import StudentActivityEvent
from app.schemas import EventCreate
from app.services.aggregation_service import run_pipeline

router = APIRouter(prefix="/api/v1/events", tags=["Event Ingestion"])

FALLBACK_INSTITUTE = "LMS_INST_A"


def _resolve_institute(header_value: Optional[str], body_value: Optional[str]) -> str:
    """Header wins over body field; both fall back to default."""
    return (header_value or body_value or FALLBACK_INSTITUTE).strip()


@router.post("/ingest", status_code=status.HTTP_201_CREATED)
def ingest_event(
    event: EventCreate,
    db: Session = Depends(get_db),
    x_institute_id: Optional[str] = Header(None, alias="X-Institute-ID"),
):
    """
    Ingest a single activity event from any LMS.

    The institute is identified by the X-Institute-ID request header
    (preferred) or the institute_id field in the JSON body.
    After storing the event the aggregation pipeline runs automatically.
    """
    institute_id = _resolve_institute(x_institute_id, event.institute_id)
    try:
        db_event = StudentActivityEvent(
            event_id=uuid.uuid4(),
            student_id=event.student_id,
            institute_id=institute_id,
            event_type=event.event_type.value,
            event_timestamp=event.event_timestamp,
            session_id=event.session_id,
            event_data=event.event_data or {},
            source_service=event.source_service,
            created_at=datetime.now()
        )
        
        db.add(db_event)
        db.commit()
        db.refresh(db_event)

        # Run aggregation pipeline for this student on the event's date
        event_date = event.event_timestamp.date()
        try:
            pipeline_result = run_pipeline(db, event.student_id, event_date, institute_id=institute_id)
        except Exception:
            pipeline_result = None
        
        return {
            "status": "success",
            "event_id": str(db_event.event_id),
            "institute_id": institute_id,
            "message": "Event ingested and aggregated",
            "aggregation": pipeline_result,
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ingesting event: {str(e)}"
        )


@router.post("/ingest/batch", status_code=status.HTTP_201_CREATED)
def ingest_events_batch(
    events: List[EventCreate],
    db: Session = Depends(get_db),
    x_institute_id: Optional[str] = Header(None, alias="X-Institute-ID"),
):
    """
    Ingest multiple activity events in batch.
    X-Institute-ID header applies to all events in the batch.
    """
    try:
        db_events = []
        for event in events:
            institute_id = _resolve_institute(x_institute_id, event.institute_id)
            db_event = StudentActivityEvent(
                event_id=uuid.uuid4(),
                student_id=event.student_id,
                institute_id=institute_id,
                event_type=event.event_type.value,
                event_timestamp=event.event_timestamp,
                session_id=event.session_id,
                event_data=event.event_data or {},
                source_service=event.source_service,
                created_at=datetime.now()
            )
            db_events.append(db_event)
        
        db.bulk_save_objects(db_events)
        db.commit()
        
        return {
            "status": "success",
            "events_ingested": len(events),
            "message": f"Successfully ingested {len(events)} events"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ingesting events: {str(e)}"
        )


@router.get("/students/{student_id}/recent")
def get_recent_events(
    student_id: str,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Get recent activity events for a student
    """
    events = db.query(StudentActivityEvent).filter(
        StudentActivityEvent.student_id == student_id
    ).order_by(StudentActivityEvent.event_timestamp.desc()).limit(limit).all()
    
    if not events:
        raise HTTPException(status_code=404, detail=f"No events found for student {student_id}")
    
    return {
        "student_id": student_id,
        "event_count": len(events),
        "events": [
            {
                "event_id": str(e.event_id),
                "event_type": e.event_type,
                "event_timestamp": e.event_timestamp.isoformat(),
                "session_id": e.session_id,
                "event_data": e.event_data,
                "source_service": e.source_service
            }
            for e in events
        ]
    }


@router.get("/statistics")
def get_event_statistics(db: Session = Depends(get_db)):
    """
    Get statistics about ingested events
    """
    from sqlalchemy import func
    from datetime import date, timedelta
    
    total_events = db.query(func.count(StudentActivityEvent.event_id)).scalar()
    
    # Events by type
    events_by_type = db.query(
        StudentActivityEvent.event_type,
        func.count(StudentActivityEvent.event_id).label('count')
    ).group_by(StudentActivityEvent.event_type).all()
    
    # Events today
    today = date.today()
    events_today = db.query(func.count(StudentActivityEvent.event_id)).filter(
        func.date(StudentActivityEvent.event_timestamp) == today
    ).scalar()
    
    # Events last 7 days
    last_week = today - timedelta(days=7)
    events_last_week = db.query(func.count(StudentActivityEvent.event_id)).filter(
        func.date(StudentActivityEvent.event_timestamp) >= last_week
    ).scalar()
    
    # Unique students
    unique_students = db.query(func.count(func.distinct(StudentActivityEvent.student_id))).scalar()
    
    return {
        "total_events": total_events,
        "events_today": events_today,
        "events_last_7_days": events_last_week,
        "unique_students": unique_students,
        "events_by_type": {
            event_type: count for event_type, count in events_by_type
        }
    }

