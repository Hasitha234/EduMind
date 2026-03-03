import type {
    BackendScheduleResponse,
    BackendScheduleSummary,
    DailyMetricItem,
    EngagementHistoryItem,
    EngagementSummaryResponse,
    PredictionLatestResponse,
    ServiceHealthResponse,
    StudentDashboardResponse,
    StudentListResponse,
    SystemStatsResponse,
} from '../core/types/dashboard';

const ENGAGEMENT_API_BASE = import.meta.env.VITE_ENGAGEMENT_TRACKER_API_URL || 'http://localhost:8002';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);

    if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(detail?.detail || response.statusText || 'Request failed');
    }

    return (await response.json()) as T;
}

export async function getServiceHealth(): Promise<ServiceHealthResponse> {
    return requestJson<ServiceHealthResponse>(`${ENGAGEMENT_API_BASE}/health`);
}

export async function getSystemStats(instituteId = 'LMS_INST_A'): Promise<SystemStatsResponse> {
    return requestJson<SystemStatsResponse>(
        `${ENGAGEMENT_API_BASE}/api/v1/stats?institute_id=${encodeURIComponent(instituteId)}`
    );
}

export async function getStudents(limit = 200, instituteId = 'LMS_INST_A'): Promise<StudentListResponse> {
    return requestJson<StudentListResponse>(
        `${ENGAGEMENT_API_BASE}/api/v1/students/list?limit=${limit}&institute_id=${encodeURIComponent(instituteId)}`
    );
}

function iq(instituteId?: string): string {
    const id = instituteId ?? 'LMS_INST_A';
    return `institute_id=${encodeURIComponent(id)}`;
}

export async function getStudentDashboard(studentId: string, instituteId?: string): Promise<StudentDashboardResponse> {
    return requestJson<StudentDashboardResponse>(
        `${ENGAGEMENT_API_BASE}/api/v1/students/${encodeURIComponent(studentId)}/dashboard?${iq(instituteId)}`
    );
}

export async function getEngagementHistory(studentId: string, days = 30): Promise<EngagementHistoryItem[]> {
    return requestJson<EngagementHistoryItem[]>(
        `${ENGAGEMENT_API_BASE}/api/v1/engagement/students/${encodeURIComponent(studentId)}/history?days=${days}`
    );
}

export async function getDailyMetrics(studentId: string, days = 7): Promise<DailyMetricItem[]> {
    return requestJson<DailyMetricItem[]>(
        `${ENGAGEMENT_API_BASE}/api/v1/engagement/students/${encodeURIComponent(studentId)}/metrics?days=${days}`
    );
}

export async function getEngagementSummary(studentId: string): Promise<EngagementSummaryResponse | null> {
    return requestJson<EngagementSummaryResponse>(
        `${ENGAGEMENT_API_BASE}/api/v1/engagement/students/${encodeURIComponent(studentId)}/summary`
    ).catch(() => null);
}

export async function getLatestPrediction(studentId: string, instituteId?: string): Promise<PredictionLatestResponse> {
    return requestJson<PredictionLatestResponse>(
        `${ENGAGEMENT_API_BASE}/api/v1/predictions/students/${encodeURIComponent(studentId)}/latest?${iq(instituteId)}`
    );
}

export async function generateSchedule(studentId: string, instituteId?: string): Promise<BackendScheduleResponse> {
    return requestJson<BackendScheduleResponse>(
        `${ENGAGEMENT_API_BASE}/api/v1/schedules/students/${encodeURIComponent(studentId)}/generate?${iq(instituteId)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        }
    );
}

export async function getScheduleSummary(studentId: string, instituteId?: string): Promise<BackendScheduleSummary> {
    return requestJson<BackendScheduleSummary>(
        `${ENGAGEMENT_API_BASE}/api/v1/schedules/students/${encodeURIComponent(studentId)}/summary?${iq(instituteId)}`
    );
}
