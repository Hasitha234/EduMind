/**
 * Service Interfaces for Learning Style Predictor
 * Defines contracts for dependency injection
 */

import type { LearningStyleFormData, LearningStyleResult } from '../core/types';
import type { LearningStyleType } from '../core/types';

/**
 * Health check response
 */
export interface HealthCheckResponse {
    status: 'healthy' | 'degraded' | 'down';
    message: string;
}

export interface StudentProfileSummaryData {
    studentId: string;
    completionRate: number;
    daysTracked: number;
    preferredDifficulty: 'Light' | 'Standard' | 'Intensive';
}

export interface StruggleTopicData {
    label: string;
    count: number;
}

export interface LearningStyleSystemStats {
    totalStudents: number;
    totalResources: number;
    totalRecommendations: number;
    recommendationCompletionRate: number;
    learningStyleDistribution: Record<LearningStyleType, number>;
    topStruggleTopics: StruggleTopicData[];
}

/**
 * Learning Style Service Interface
 * Defines the contract for learning style prediction services
 */
export interface ILearningStyleService {
    /**
     * Predict learning style based on student data
     * @param data - Student learning preferences and habits
     * @returns Promise resolving to prediction results
     */
    predictLearningStyle(data: LearningStyleFormData): Promise<LearningStyleResult>;

    /**
     * Check service health status
     * @returns Promise resolving to health status
     */
    checkHealth(): Promise<HealthCheckResponse>;
}

export interface ILearningStyleDashboardService extends ILearningStyleService {
    listStudentIds(limit?: number, instituteId?: string): Promise<string[]>;
    getStudentProfile(studentId: string): Promise<StudentProfileSummaryData>;
    getSystemStats(instituteId?: string): Promise<LearningStyleSystemStats>;
    generateRecommendations(studentId: string, maxRecommendations?: number): Promise<string[]>;
}
