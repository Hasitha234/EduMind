"""
Manual sync from engagement-tracker to learning-style behavior table.

Run from this folder:

    python scripts/sync_from_engagement.py

Make sure:
- Engagement tracker is running on http://localhost:8005
- Learning-style DB is initialized (run scripts/init_db.py create once).
"""
import sys
from pathlib import Path

# So "app" package imports work when running as script
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.engagement_sync_service import sync_student_behavior


def main():
    # For now, sync only STU0001 (the mapping you created in LMS).
    student_ids = ["STU0001"]

    for sid in student_ids:
        count = sync_student_behavior(sid, days=7)
        print(f"Synced {count} behavior rows for student {sid}")


if __name__ == "__main__":
    main()