"""
Sync API – trigger behaviour-data sync from the engagement-tracker service.
"""
from fastapi import APIRouter, HTTPException, Query

from app.services.engagement_sync_service import sync_student_behavior

router = APIRouter(prefix="/sync", tags=["Engagement Sync"])


@router.post("/from-engagement/{student_id}")
def sync_from_engagement(
    student_id: str,
    days: int = Query(14, ge=1, le=90, description="How many days of metrics to sync"),
):
    """
    Pull daily metrics from the engagement-tracker for *student_id*,
    convert them into StudentBehaviorTracking rows, and store them
    in this service's database.

    Idempotent: existing rows for the same date range are replaced.
    """
    try:
        count = sync_student_behavior(student_id=student_id, days=days)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Sync failed: {exc}")

    return {
        "status": "ok",
        "student_id": student_id,
        "behaviour_rows_written": count,
    }
