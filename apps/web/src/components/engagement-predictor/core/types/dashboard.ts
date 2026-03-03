export type SystemStatus = 'healthy' | 'degraded' | 'down' | 'checking';

export interface SystemStatsResponse {
    total_students: number;
    high_risk_students: number;
    at_risk_students: number;
    low_engagement_students: number;
    avg_engagement_score: number;
}

export interface StudentListItem {
    student_id: string;
    engagement_score: number;
    engagement_level: string;
    engagement_trend: string;
    at_risk: boolean;
    risk_level: string;
    risk_probability: number | null;
    last_updated: string;
}

export interface StudentListResponse {
    total: number;
    offset: number;
    limit: number;
    students: StudentListItem[];
}

export interface StudentDashboardResponse {
    student_id: string;
    current_status: {
        engagement_score: number;
        engagement_level: string;
        at_risk: boolean;
        risk_level: string;
        risk_probability: number | null;
    };
    recent_trend: {
        direction: string;
        change: number;
        days_analyzed: number;
    };
    component_scores: {
        login: number;
        session: number;
        interaction: number;
        forum: number;
        assignment: number;
    };
    alerts: Array<{
        severity: string;
        message: string;
        action: string;
    }>;
    last_updated: string;
}

export interface EngagementHistoryItem {
    date: string;
    engagement_score: number;
    engagement_level: string;
    engagement_trend: string;
}

export interface EngagementSummaryResponse {
    student_id: string;
    days_tracked: number;
    avg_engagement_score: number;
    current_engagement_level: string;
    trend: string | null;
    last_updated: string;
}

export interface DailyMetricItem {
    date: string;
    login_count: number;
    total_session_duration_minutes: number;
    page_views: number;
    content_interactions: number;
    forum_posts: number;
    forum_replies: number;
    quiz_attempts: number;
    assignments_submitted: number;
}

export interface PredictionLatestResponse {
    risk_probability: number;
    risk_level: string;
    contributing_factors?: Record<string, unknown> | null;
}

export interface QuickStudent {
    id: string;
    label: string;
}

export interface ScheduleSession {
    sessionNumber: number;
    durationMinutes: number;
    taskType: string;
    suggestedTime: string;
}

export interface TaskBreakdown {
    assignmentPrepMinutes: number;
    quizInteractionMinutes: number;
    forumEngagementMinutes: number;
    generalStudyMinutes: number;
}

export interface ScheduleDay {
    dayName: string;
    date: string;
    totalMinutes: number;
    sessions: ScheduleSession[];
    taskBreakdown: TaskBreakdown;
    isLightDay: boolean;
}

export interface UiSchedule {
    sessionLength: number;
    sessionsPerDay: number;
    dailyMinutes: number;
    loadReduction: number;
    reasoning: string[];
    days: ScheduleDay[];
}

export interface BackendScheduleSession {
    session_number: number;
    duration_minutes: number;
    task_type: string;
    suggested_time: string;
}

export interface BackendScheduleResponse {
    session_length_minutes: number;
    sessions_per_day: number;
    total_study_minutes_per_day: number;
    load_reduction_factor: number;
    daily_schedules: Array<{
        day_name: string;
        date: string;
        total_minutes: number;
        sessions: BackendScheduleSession[];
        is_light_day: boolean;
        task_breakdown?: {
            assignment_prep_minutes?: number;
            quiz_interaction_minutes?: number;
            forum_engagement_minutes?: number;
            general_study_minutes?: number;
        };
    }>;
}

export interface BackendScheduleSummary {
    reasoning?: Record<string, string>;
}

export interface ServiceHealthResponse {
    status: string;
}
