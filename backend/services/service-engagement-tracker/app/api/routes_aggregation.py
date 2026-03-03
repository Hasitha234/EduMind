"""
Aggregation API Routes – trigger the data pipeline on demand.
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.models import StudentActivityEvent
from app.services.aggregation_service import run_pipeline

router = APIRouter(prefix="/api/v1/aggregation", tags=["Aggregation Pipeline"])


@router.post("/process/{student_id}")
def process_student(
    student_id: str,
    target_date: date | None = Query(None, description="Date to aggregate (defaults to today)"),
    institute_id: str = Query("LMS_INST_A", description="Institute identifier"),
    db: Session = Depends(get_db),
):
    """
    Run the full aggregation pipeline for a single student on a specific date.
    Steps: raw events -> daily metrics -> engagement score -> risk prediction.
    """
    if target_date is None:
        target_date = date.today()

    try:
        result = run_pipeline(db, student_id, target_date, institute_id=institute_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Pipeline error: {exc}")

    return result


@router.post("/process-all")
def process_all_students(
    days: int = Query(14, ge=1, le=90, description="How many past days to process"),
    institute_id: str | None = Query(None, description="Filter by institute (omit to process all)"),
    db: Session = Depends(get_db),
):
    """
    Backfill: run the pipeline for every student who has raw events,
    across the last N days.  Optionally filter by institute_id.
    """
    cutoff = date.today() - timedelta(days=days)

    query = db.query(
        StudentActivityEvent.student_id,
        StudentActivityEvent.institute_id,
        StudentActivityEvent.event_timestamp,
    ).filter(StudentActivityEvent.event_timestamp >= cutoff)

    if institute_id:
        query = query.filter(StudentActivityEvent.institute_id == institute_id)

    rows = query.all()

    seen: set[tuple[str, str, date]] = set()
    for sid, inst, ts in rows:
        seen.add((sid, inst, ts.date()))

    triples = sorted(seen)

    results = []
    errors = []
    for sid, inst, d in triples:
        try:
            result = run_pipeline(db, sid, d, institute_id=inst)
            results.append(result)
        except Exception as exc:
            db.rollback()
            errors.append({"student_id": sid, "date": str(d), "error": str(exc)})

    return {
        "processed": len(results),
        "errors": len(errors),
        "results": results,
        "error_details": errors,
    }
