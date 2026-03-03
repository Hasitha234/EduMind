"""
Backfill script – run the aggregation pipeline for all students who have raw
events but may not yet have engagement scores.

Usage:
    cd service-engagement-tracker
    python scripts/run_aggregation.py              # last 14 days
    python scripts/run_aggregation.py --days 30    # last 30 days
"""
import sys
import os
import argparse
from datetime import date, timedelta

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models import StudentActivityEvent
from app.services.aggregation_service import run_pipeline

from sqlalchemy import func


def main(days: int = 14):
    db = SessionLocal()
    cutoff = date.today() - timedelta(days=days)

    rows = (
        db.query(StudentActivityEvent.student_id, StudentActivityEvent.event_timestamp)
        .filter(StudentActivityEvent.event_timestamp >= cutoff)
        .all()
    )

    seen: set[tuple[str, date]] = set()
    for sid, ts in rows:
        seen.add((sid, ts.date()))

    pairs = sorted(seen)
    print(f"Found {len(pairs)} (student, date) pairs to process in the last {days} days.")

    ok = 0
    fail = 0
    for sid, d in pairs:
        try:
            result = run_pipeline(db, sid, d)
            print(f"  OK  {sid} {d}  score={result['engagement_score']}  risk={result['risk_level']}")
            ok += 1
        except Exception as exc:
            db.rollback()
            print(f"  ERR {sid} {d}  {exc}")
            fail += 1

    print(f"\nDone. Processed={ok}, Errors={fail}")
    db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=14)
    args = parser.parse_args()
    main(args.days)
