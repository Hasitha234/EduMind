# Minimal LMS – Implementation Plan

**Purpose:** Build a small LMS inside EduMind that captures student actions (login, pages, video, quiz) and sends them to the Engagement Tracker. EduMind then turns that data into engagement and learning-style insights.

**Location:** `C:\Projects\edumind\EduMind`

---

## 1. What We Are Building (Summary)

| Component | What it does |
|-----------|----------------|
| **Minimal LMS Backend** | Stores users and courses, records every student action (event), and sends those events to the Engagement Tracker. |
| **Minimal LMS Frontend** | Simple website: login → see courses → open a page, watch a video, do a quiz. Each action is sent to our backend, which forwards it to EduMind. |
| **User mapping** | A table that links “LMS user id” to “EduMind student id” so events are sent with the correct student id. |
| **Sync job (in EduMind)** | A daily job that reads Engagement Tracker’s daily metrics and writes “behavior” data into the Learning Style service so it can classify learning styles. |

---

## 2. Where Everything Lives (File Structure)

```
EduMind/
├── apps/
│   └── web/                          # Existing EduMind main app (unchanged)
│   └── minimal-lms/                 # NEW – Minimal LMS frontend (React)
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── Login.tsx
│       │   │   ├── Dashboard.tsx
│       │   │   ├── CourseView.tsx
│       │   │   ├── VideoPage.tsx
│       │   │   └── QuizPage.tsx
│       │   ├── lib/
│       │   │   └── api.ts            # Calls minimal-lms backend + tracks events
│       │   └── ...
│       ├── package.json
│       ├── vite.config.ts
│       └── index.html
│
├── backend/
│   └── services/
│       ├── service-engagement-tracker/   # Existing (we only call its API)
│       ├── service-learning-style/      # Existing + we add sync job
│       └── minimal-lms/                 # NEW – Minimal LMS backend (FastAPI)
│           ├── app/
│           │   ├── main.py
│           │   ├── core/
│           │   │   ├── config.py
│           │   │   └── database.py
│           │   ├── models/
│           │   │   ├── user.py
│           │   │   ├── course.py
│           │   │   ├── event.py
│           │   │   └── user_mapping.py   # LMS user id ↔ EduMind student_id
│           │   ├── schemas/
│           │   │   ├── user.py
│           │   │   ├── course.py
│           │   │   └── event.py
│           │   ├── api/
│           │   │   ├── routes_auth.py    # Login (simple, for demo)
│           │   │   ├── routes_courses.py
│           │   │   ├── routes_events.py  # Receive event from frontend, forward to engagement-tracker
│           │   │   └── routes_mapping.py  # List/create LMS user ↔ EduMind student_id
│           │   └── services/
│           │       └── engagement_forwarder.py  # HTTP client to engagement-tracker
│           ├── requirements.txt
│           ├── .env.example
│           └── README.md
│
└── Docs/
    └── Minimal-LMS-Implementation-Plan.md   # This file
```

**Sync job (engagement → learning style)**  
We add a script or scheduled task inside the Learning Style service that:
- Calls Engagement Tracker API to get daily metrics per student, or reads from a shared DB if you prefer.
- Maps those metrics into the format `StudentBehaviorTracking` expects.
- Writes into the Learning Style DB (or calls a new internal “behavior ingest” endpoint).

So we will add something under:
`backend/services/service-learning-style/` – e.g. `scripts/sync_engagement_to_behavior.py` or a new route that runs on a schedule.

---

## 3. Data Flow (Step by Step)

1. **Student** opens Minimal LMS frontend → logs in (LMS backend checks username/password).
2. **Frontend** gets “current user” (e.g. `lms_user_id: 5`, `edumind_student_id: "STU0001"` from mapping).
3. **Student** does something (e.g. “watch video”, “submit quiz”). Frontend calls Minimal LMS backend: “Record this event.”
4. **Minimal LMS backend** saves the event locally (optional, for history) and immediately calls **Engagement Tracker**: `POST /api/v1/events/ingest` with `student_id = edumind_student_id`, `event_type`, `event_timestamp`, etc.
5. **Engagement Tracker** stores the event and (via its existing job) computes daily metrics and engagement scores.
6. **Once per day**, a **sync job** (in EduMind) runs: reads Engagement Tracker’s daily metrics, converts them to “behavior” rows, and writes them into the Learning Style service’s `student_behavior_tracking` table (or via a new ingest API). Learning Style can then run its existing ML and recommendations.

---

## 4. Implementation Phases

You can do these in order. Each phase has a clear outcome so you can check the plan and then implement.

---

### Phase 1: Minimal LMS Backend – Skeleton and Config

**Goal:** Create the `minimal-lms` FastAPI service; it runs and returns “Hello” and health. No database yet.

**What you will create:**

| File | Purpose |
|------|--------|
| `backend/services/minimal-lms/app/main.py` | FastAPI app, CORS, one route `GET /` and `GET /health`. |
| `backend/services/minimal-lms/app/core/config.py` | Settings: port (e.g. 8010), `ENGAGEMENT_TRACKER_URL` (e.g. `http://localhost:8002`). |
| `backend/services/minimal-lms/requirements.txt` | `fastapi`, `uvicorn`, `httpx`, `pydantic`, `python-dotenv`. |
| `backend/services/minimal-lms/.env.example` | Example `ENGAGEMENT_TRACKER_URL`, `DATABASE_URL` (for later). |

**Concepts:**
- **FastAPI** = web framework for the backend; `main.py` is the entry point.
- **Config** = so we can change URLs and ports without editing code (e.g. different Engagement Tracker URL in dev vs prod).

**Check:** Run `uvicorn app.main:app --reload --port 8010` from `backend/services/minimal-lms`; open `http://localhost:8010/health` and see a success response.

---

### Phase 2: Minimal LMS Backend – Database and User Mapping

**Goal:** Add a database (SQLite for simplicity, or PostgreSQL like other services). Create tables: **users** (LMS users), **courses**, **user_edumind_mapping** (lms_user_id ↔ edumind_student_id).

**What you will create:**

| File | Purpose |
|------|--------|
| `backend/services/minimal-lms/app/core/database.py` | DB connection and session; create tables from models. |
| `backend/services/minimal-lms/app/models/user.py` | Model: id, username, password_hash, display_name, created_at. |
| `backend/services/minimal-lms/app/models/course.py` | Model: id, title, description, created_at. |
| `backend/services/minimal-lms/app/models/user_mapping.py` | Model: lms_user_id, edumind_student_id (unique), created_at. |
| `backend/services/minimal-lms/app/models/__init__.py` | Export all models. |

**Concepts:**
- **ORM (SQLAlchemy)** = we define Python classes (models); the ORM creates tables and lets us query with Python instead of raw SQL.
- **user_edumind_mapping** = “this LMS user is this EduMind student” so we always send the correct `student_id` to the Engagement Tracker.

**Check:** Run init (e.g. create DB and tables); add one user and one mapping row (e.g. lms user 1 → `STU0001`); query them (e.g. with a tiny script or a temporary GET route).

---

### Phase 3: Minimal LMS Backend – Auth and Courses API

**Goal:** Simple login (username + password); return “current user” and his/her `edumind_student_id`. List courses; get one course by id.

**What you will create:**

| File | Purpose |
|------|--------|
| `backend/services/minimal-lms/app/schemas/user.py` | Pydantic: LoginRequest, UserResponse, UserWithMappingResponse. |
| `backend/services/minimal-lms/app/schemas/course.py` | Pydantic: CourseResponse, CourseList. |
| `backend/services/minimal-lms/app/api/routes_auth.py` | POST /login (check password, return user + edumind_student_id); GET /me (if we add sessions later). |
| `backend/services/minimal-lms/app/api/routes_courses.py` | GET /courses (list), GET /courses/{id} (one course). |
| `backend/services/minimal-lms/app/api/routes_mapping.py` | GET /mapping (list mappings), POST /mapping (create lms_user_id ↔ edumind_student_id). For admin/setup. |
| Update `main.py` | Include the new routers. |

**Concepts:**
- **Pydantic** = validates request/response bodies (e.g. login must have username and password).
- **Routes** = URL paths (e.g. `/login`, `/courses`) that the backend handles.

**Check:** Call POST /login with a user you created; get back user info and `edumind_student_id`. Call GET /courses and see at least one course (you can seed one in DB).

---

### Phase 4: Minimal LMS Backend – Events and Forwarding to Engagement Tracker

**Goal:** Frontend (or Postman) sends “student did X” (event). Minimal LMS receives it, optionally stores it, and forwards it to Engagement Tracker’s `POST /api/v1/events/ingest`.

**What you will create:**

| File | Purpose |
|------|--------|
| `backend/services/minimal-lms/app/schemas/event.py` | Pydantic: EventCreate (event_type, timestamp, session_id?, event_data?). |
| `backend/services/minimal-lms/app/services/engagement_forwarder.py` | Function: given event + edumind_student_id, POST to ENGAGEMENT_TRACKER_URL/api/v1/events/ingest with body matching EventCreate (student_id = edumind_student_id, source_service = "minimal-lms"). |
| `backend/services/minimal-lms/app/api/routes_events.py` | POST /events (body: event_type, timestamp, …). Look up current user’s edumind_student_id from mapping; call engagement_forwarder; return success/failure. |
| Optional: `backend/services/minimal-lms/app/models/event.py` | If you want to store events in LMS DB (event_type, student_id, timestamp, payload). |

**Event types to support (same as Engagement Tracker):**  
`login`, `logout`, `page_view`, `video_play`, `video_complete`, `quiz_start`, `quiz_submit`, `assignment_submit`, `forum_post`, `forum_reply`, `resource_download`, `content_interaction`.

**Concepts:**
- **Forwarder** = our backend is a “proxy”: it receives an event and immediately sends it to another service (Engagement Tracker) with the right `student_id`.
- **source_service** = so Engagement Tracker knows the event came from “minimal-lms”.

**Check:** Send POST /events with a valid event_type and timestamp (and auth if you added it); verify Engagement Tracker receives the event (e.g. check its DB or GET its event stats).

---

### Phase 5: Minimal LMS Frontend – Setup and Login

**Goal:** New React app under `apps/minimal-lms`. One page: Login. On submit, call Minimal LMS backend POST /login; save user + edumind_student_id in state or context; redirect to a simple dashboard.

**What you will create:**

| File | Purpose |
|------|--------|
| `apps/minimal-lms/package.json` | Name, dependencies (react, react-dom, react-router-dom, fetch or axios). Use Vite + React (like apps/web) if you want consistency. |
| `apps/minimal-lms/vite.config.ts` | Dev server port (e.g. 5174) and proxy to `http://localhost:8010` for API so frontend can call `/api/...` without CORS issues. |
| `apps/minimal-lms/index.html` | Root HTML. |
| `apps/minimal-lms/src/main.tsx` | Renders React app. |
| `apps/minimal-lms/src/App.tsx` | Router: routes for `/`, `/login`, `/dashboard`, etc. |
| `apps/minimal-lms/src/pages/Login.tsx` | Form: username, password. On submit → POST /login → store user + edumind_student_id → navigate to /dashboard. |
| `apps/minimal-lms/src/lib/api.ts` | Functions: `login(username, password)`, `getCourses()`, `sendEvent(eventType, ...)`. Base URL from env or config. |

**Concepts:**
- **React** = UI library; each page is a component.
- **Router** = which component to show for which URL (e.g. /login → Login, /dashboard → Dashboard).
- **api.ts** = one place for all calls to the Minimal LMS backend (and later, when we send events, we always use the stored edumind_student_id).

**Check:** Open app in browser; log in with a user that has a mapping; land on dashboard and see “Logged in as …” and maybe “EduMind student id: STU0001”.

---

### Phase 6: Minimal LMS Frontend – Dashboard, Course, Video, Quiz and Event Sending

**Goal:** Dashboard lists courses (from GET /courses). Click a course → course page (e.g. list of “pages”: one is a video, one is a quiz). When user opens a page, frontend sends a `page_view` event; when they “play video”, send `video_play`; when they “complete video”, send `video_complete`; when they submit quiz, send `quiz_submit`. All events go through Minimal LMS backend (which forwards to Engagement Tracker).

**What you will create:**

| File | Purpose |
|------|--------|
| `apps/minimal-lms/src/pages/Dashboard.tsx` | Shows “My courses”; fetch courses from API; each course links to `/course/:id`. |
| `apps/minimal-lms/src/pages/CourseView.tsx` | Shows course title and list of “activities” (e.g. Page 1: Video, Page 2: Quiz). On mount, send `page_view` with event_data: { page: "course", course_id }. |
| `apps/minimal-lms/src/pages/VideoPage.tsx` | Simple video player (or link to a video). On play → send `video_play`; on “Mark complete” or end → send `video_complete`. |
| `apps/minimal-lms/src/pages/QuizPage.tsx` | Simple quiz (a few questions). On submit → send `quiz_submit` with event_data: { score, max_score } if you want. |
| Update `apps/minimal-lms/src/lib/api.ts` | Add `sendEvent(eventType, eventData?)` that calls POST /events with current user’s token/session and edumind_student_id handled by backend. |

**Concepts:**
- **Event-driven** = every important action in the UI becomes an event; the backend forwards it so EduMind can compute engagement and learning style.
- **page_view** = “student opened this screen”; **video_play** / **video_complete** = “started/finished video”; **quiz_submit** = “submitted quiz”.

**Check:** Log in, open a course, open video page, “play” and “complete” video, then do a quiz and submit. In Engagement Tracker, see new events (and later daily metrics) for the mapped student.

---

### Phase 7: Sync Job – Engagement Tracker → Learning Style (Behavior)

**Goal:** EduMind automatically gets “behavior” data for the Learning Style service from Engagement Tracker’s daily metrics.

**What you will add:**

| File | Purpose |
|------|--------|
| `backend/services/service-learning-style/app/api/routes_behavior_ingest.py` (or similar) | Internal endpoint or script: receives “daily behavior” payload (per student per day) and inserts/updates `StudentBehaviorTracking`. |
| `backend/services/service-learning-style/scripts/sync_engagement_to_behavior.py` | Script: 1) Call Engagement Tracker API to get daily metrics (e.g. last 7 days); 2) Map fields (page_views, video_watch_minutes, forum_posts, quiz_attempts, etc.) to StudentBehaviorTracking columns (video_watch_time, text_read_time, forum_posts, total_session_time, login_count, etc.); 3) For each student/date, call the behavior ingest or write to DB. |

**Mapping idea (engagement metric → behavior field):**
- login_count → login_count  
- total_session_duration_minutes → total_session_time (convert to seconds)  
- page_views, content_interactions → text_read_time (approximate) or leave 0  
- video_watch_minutes → video_watch_time (seconds)  
- video_plays, etc. → video_completion_rate (can approximate)  
- forum_posts, forum_replies → forum_posts, discussion_participation  

**Concepts:**
- **Sync job** = runs once per day (cron or scheduler); it “copies” aggregated data from one service into the format another service needs.
- **Learning Style** needs “behavior” rows to run its ML; we don’t ask the LMS to send behavior—we derive it from engagement (your chosen approach A).

**Check:** Run the sync script for a date range where Engagement Tracker has daily metrics; then in Learning Style DB (or API) see new rows in `student_behavior_tracking`. Optionally run Learning Style’s classifier for a student and see a result.

---

## 5. Order of Work (What to Do First)

1. **Phase 1** – Backend skeleton and config.  
2. **Phase 2** – Database and user mapping.  
3. **Phase 3** – Auth and courses API + mapping API.  
4. **Phase 4** – Events API and forwarder to Engagement Tracker.  
5. **Phase 5** – Frontend app and login.  
6. **Phase 6** – Dashboard, course, video, quiz and event sending.  
7. **Phase 7** – Sync job from Engagement Tracker to Learning Style.

You can stop after Phase 4 and test with Postman (send events manually); then add the frontend in Phase 5–6 so you can “click and see events” in EduMind.

---

## 6. Quick Reference – Engagement Tracker Event Format

So the Minimal LMS backend sends exactly what the Engagement Tracker expects:

**Endpoint:** `POST {ENGAGEMENT_TRACKER_URL}/api/v1/events/ingest`

**Body (JSON):**
```json
{
  "student_id": "STU0001",
  "event_type": "video_play",
  "event_timestamp": "2025-02-26T14:30:00Z",
  "session_id": "optional-session-uuid",
  "event_data": {},
  "source_service": "minimal-lms"
}
```

**Allowed event_type values:**  
`login`, `logout`, `page_view`, `video_play`, `video_complete`, `quiz_start`, `quiz_submit`, `assignment_submit`, `forum_post`, `forum_reply`, `resource_download`, `content_interaction`.

---

## 7. What You Can Do Next

1. **Review this plan** – Check phases, file names, and order. Adjust if you want (e.g. SQLite vs PostgreSQL, or different folder names).  
2. **Confirm tech** – Backend: Python 3.11+, FastAPI. Frontend: React + Vite (or plain HTML/JS if you prefer simpler).  
3. **Start with Phase 1** – When you’re ready, we can go step by step: I’ll give you the exact code for each file and explain each part so you can type it (or paste) and run it yourself.

If you tell me “plan looks good” or “change X”, we can either lock the plan and start Phase 1, or update the plan first.
