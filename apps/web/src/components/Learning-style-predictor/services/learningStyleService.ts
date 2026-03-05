/**
 * Learning Style API Service
 * Backend-driven implementation for learning style prediction and dashboard data.
 */

import type {
    HealthCheckResponse,
    ILearningStyleDashboardService,
    LearningStyleSystemStats,
    StudentProfileSummaryData,
} from '../data/interfaces';
import {
    LearningStyleHealthResponseSchema,
    LearningStylePredictionApiSchema,
    LearningStyleRecommendationsApiSchema,
    type LearningStyleRecommendationApiResponse,
    LearningStyleStudentProfileApiSchema,
    LearningStyleStudentSummaryApiSchema,
    LearningStyleSystemStatsApiSchema,
    type LearningStylePredictionApiResponse,
} from '../core/schemas/learningStyleApiSchema';
import type { LearningStyleFormData, LearningStyleResult, LearningStyleType } from '../core/types';

const API_BASE_URL = import.meta.env.VITE_LEARNING_STYLE_API_URL || 'http://localhost:8006';
const ENGAGEMENT_TRACKER_URL = import.meta.env.VITE_ENGAGEMENT_TRACKER_API_URL || 'http://localhost:8005';
const API_V1_PREFIX = '/api/v1';

const STYLE_ORDER: LearningStyleType[] = ['visual', 'auditory', 'reading', 'kinesthetic'];
const DEFAULT_RECOMMENDATION_COUNT = 5;
const MIN_RECOMMENDATION_COUNT = 1;
const MAX_RECOMMENDATION_COUNT = 10;

function normalizeStyleKey(value: string): LearningStyleType | null {
    const normalized = value.trim().toLowerCase();

    if (normalized.includes('visual')) return 'visual';
    if (normalized.includes('auditory') || normalized.includes('audio')) return 'auditory';
    if (normalized.includes('reading') || normalized.includes('writing')) return 'reading';
    if (normalized.includes('kinesthetic') || normalized.includes('kinaesthetic')) return 'kinesthetic';

    return null;
}

function mapPreferredDifficulty(value: string): StudentProfileSummaryData['preferredDifficulty'] {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'hard' || normalized === 'intensive') return 'Intensive';
    if (normalized === 'easy' || normalized === 'light') return 'Light';

    return 'Standard';
}

function toPercentage(value: number): number {
    if (value <= 1) {
        return Math.round(value * 100);
    }

    return Math.round(value);
}

function createStyleScoreMap(response: LearningStylePredictionApiResponse): Record<LearningStyleType, number> {
    const scoreMap: Record<LearningStyleType, number> = {
        visual: 0,
        auditory: 0,
        reading: 0,
        kinesthetic: 0,
    };

    Object.entries(response.probabilities).forEach(([style, probability]) => {
        const mappedStyle = normalizeStyleKey(style);
        if (!mappedStyle) return;
        scoreMap[mappedStyle] = toPercentage(probability);
    });

    return scoreMap;
}

function toSecondaryStyle(scoreMap: Record<LearningStyleType, number>, primaryStyle: LearningStyleType): LearningStyleType {
    const sorted = STYLE_ORDER
        .filter((style) => style !== primaryStyle)
        .sort((a, b) => scoreMap[b] - scoreMap[a]);

    return sorted[0] ?? 'reading';
}

function toErrorMessage(detail: unknown): string {
    if (typeof detail === 'string' && detail.trim().length > 0) {
        return detail;
    }

    if (typeof detail === 'object' && detail) {
        const typedDetail = detail as Record<string, unknown>;
        if (typeof typedDetail.message === 'string' && typedDetail.message.trim().length > 0) {
            return typedDetail.message;
        }
        if (typeof typedDetail.error === 'string' && typedDetail.error.trim().length > 0) {
            return typedDetail.error;
        }
    }

    return 'Request failed';
}

function toRecommendationText(item: LearningStyleRecommendationApiResponse): string {
    const title = item.resource?.title?.trim();
    const reason = item.reason?.trim();

    if (title && reason) return `${title}: ${reason}`;
    if (title) return title;
    if (reason) return reason;
    return 'Personalized learning resource';
}

async function requestJson<T>(
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    schema: { parse: (payload: unknown) => T }
): Promise<T> {
    const response = await fetch(input, init);

    if (!response.ok) {
        const details = await response.json().catch(() => null);
        const detailMessage = typeof details === 'object' && details && 'detail' in details
            ? toErrorMessage((details as { detail: unknown }).detail)
            : response.statusText;

        throw new Error(detailMessage || 'Request failed');
    }

    const payload = await response.json();
    return schema.parse(payload);
}

class LearningStyleApiService implements ILearningStyleDashboardService {
    constructor(private readonly baseURL: string = API_BASE_URL) {}

    async checkHealth(): Promise<HealthCheckResponse> {
        const payload = await requestJson(`${this.baseURL}/api/v1/system/health`, undefined, LearningStyleHealthResponseSchema);

        const normalizedStatus = payload.status.toLowerCase();
        const status: HealthCheckResponse['status'] = normalizedStatus === 'healthy'
            ? 'healthy'
            : normalizedStatus === 'down'
                ? 'down'
                : 'degraded';

        return {
            status,
            message: payload.message || `Learning style service is ${status}`,
        };
    }

    async listStudentIds(limit = 100, instituteId?: string): Promise<string[]> {
        if (instituteId?.trim()) {
            try {
                const res = await fetch(
                    `${ENGAGEMENT_TRACKER_URL}${API_V1_PREFIX}/students/list?limit=${limit}&institute_id=${encodeURIComponent(instituteId.trim())}`
                );
                if (!res.ok) return this.listStudentIdsFromLearningStyle(limit);
                const data = await res.json() as { students?: { student_id: string }[] };
                const list = data.students ?? [];
                return list.map((s) => s.student_id);
            } catch {
                return this.listStudentIdsFromLearningStyle(limit);
            }
        }
        return this.listStudentIdsFromLearningStyle(limit);
    }

    private async listStudentIdsFromLearningStyle(limit: number): Promise<string[]> {
        const payload = await requestJson(
            `${this.baseURL}${API_V1_PREFIX}/students?limit=${limit}`,
            undefined,
            LearningStyleStudentSummaryApiSchema.array()
        );
        return payload.map((item) => item.student_id);
    }

    async getStudentProfile(studentId: string): Promise<StudentProfileSummaryData> {
        const payload = await requestJson(
            `${this.baseURL}${API_V1_PREFIX}/students/${encodeURIComponent(studentId)}`,
            undefined,
            LearningStyleStudentProfileApiSchema
        );

        return {
            studentId: payload.student_id,
            completionRate: Math.round(payload.avg_completion_rate),
            daysTracked: payload.days_tracked,
            preferredDifficulty: mapPreferredDifficulty(payload.preferred_difficulty),
        };
    }

    async getSystemStats(instituteId?: string): Promise<LearningStyleSystemStats> {
        const payload = await requestJson(
            `${this.baseURL}${API_V1_PREFIX}/system/stats`,
            undefined,
            LearningStyleSystemStatsApiSchema
        );

        const distribution: Record<LearningStyleType, number> = {
            visual: 0,
            auditory: 0,
            reading: 0,
            kinesthetic: 0,
        };

        Object.entries(payload.learning_style_distribution).forEach(([style, count]) => {
            const mappedStyle = normalizeStyleKey(style);
            if (!mappedStyle) return;
            distribution[mappedStyle] = count;
        });

        let totalStudents = payload.total_students;
        if (instituteId?.trim()) {
            try {
                const res = await fetch(
                    `${ENGAGEMENT_TRACKER_URL}${API_V1_PREFIX}/students/list?limit=1000&institute_id=${encodeURIComponent(instituteId.trim())}`
                );
                if (res.ok) {
                    const data = await res.json() as { total?: number; students?: unknown[] };
                    totalStudents = typeof data.total === 'number' ? data.total : (data.students?.length ?? totalStudents);
                }
            } catch {
                // keep learning-style total if engagement request fails
            }
        }

        return {
            totalStudents,
            totalResources: payload.total_resources,
            totalRecommendations: payload.total_recommendations,
            recommendationCompletionRate: payload.recommendation_completion_rate,
            learningStyleDistribution: distribution,
            topStruggleTopics: payload.most_common_struggle_topics.map((topic) => ({
                label: topic.topic,
                count: topic.count,
            })),
        };
    }

    async generateRecommendations(studentId: string, maxRecommendations = DEFAULT_RECOMMENDATION_COUNT): Promise<string[]> {
        const safeLimit = Math.min(
            MAX_RECOMMENDATION_COUNT,
            Math.max(MIN_RECOMMENDATION_COUNT, Math.floor(maxRecommendations || DEFAULT_RECOMMENDATION_COUNT))
        );

        const generated = await requestJson(
            `${this.baseURL}${API_V1_PREFIX}/recommendations/generate`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    student_id: studentId,
                    max_recommendations: safeLimit,
                }),
            },
            LearningStyleRecommendationsApiSchema
        );

        return generated.map(toRecommendationText);
    }

    async predictLearningStyle(data: LearningStyleFormData): Promise<LearningStyleResult> {
        if (!data.student_id.trim()) {
            throw new Error('Student ID is required');
        }

        const predictionResponse = await requestJson(
            `${this.baseURL}${API_V1_PREFIX}/ml/classify-and-update/${encodeURIComponent(data.student_id)}`,
            {
                method: 'POST',
            },
            LearningStylePredictionApiSchema
        );

        const styleScores = createStyleScoreMap(predictionResponse);

        const mappedPrimaryStyle = normalizeStyleKey(predictionResponse.predicted_style);
        const primaryStyle = mappedPrimaryStyle ?? STYLE_ORDER.sort((a, b) => styleScores[b] - styleScores[a])[0] ?? 'reading';
        const secondaryStyle = toSecondaryStyle(styleScores, primaryStyle);

        return {
            primary_style: primaryStyle,
            secondary_style: secondaryStyle,
            style_scores: styleScores,
            confidence: toPercentage(predictionResponse.confidence),
            recommendations: [],
            timestamp: predictionResponse.predicted_at,
        };
    }
}

// Export singleton instance
export const learningStyleService: ILearningStyleDashboardService = new LearningStyleApiService();

// Export class for testing/DI
export { LearningStyleApiService };
