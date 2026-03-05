import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LoadingState } from '@/components/common/types/LoadingState';
import type { LearningStyleType, LearningStyleFormData } from '../types';
import type {
    HealthCheckResponse,
    ILearningStyleDashboardService,
    LearningStyleSystemStats,
    StruggleTopicData,
    StudentProfileSummaryData,
} from '../../data/interfaces';
import { useLearningStyleLogic } from './useLearningStyleLogic';
import { useLearningStyleState, type LearningStyleStateAdapter } from './useLearningStyleState';
import { useLearningStyleStore } from '@/store/learning-style';
import {
    STUDENT_LOOKUP_LIMIT,
    STUDENT_SUGGESTION_LIMIT,
} from '../constants/uiConfig';

export interface LearningStyleWorkflowState {
    workflowStep: 1 | 2 | 3;
    studentLookup: string;
    knownStudents: string[];
    profile: StudentProfileSummaryData | null;
    isLoadingProfile: boolean;
    topicFilter: string;
    maxRecommendations: number;
    systemStats: LearningStyleSystemStats | null;
    systemHealthStatus: HealthCheckResponse['status'] | 'checking';
    systemHealthMessage: string;
    styleDistribution: Record<LearningStyleType, number>;
    topStruggleTopics: StruggleTopicData[];
    isStudentListOpen: boolean;
    filteredStudents: string[];
    generatedRecommendations: string[];
    recommendationsRequested: boolean;
    isGeneratingRecommendations: boolean;
    recommendationError: string | null;
}

export interface LearningStyleWorkflowActions {
    setStudentLookup: (value: string) => void;
    openStudentList: () => void;
    closeStudentList: () => void;
    selectStudentSuggestion: (student: string) => void;
    loadStudentProfile: () => Promise<void>;
    submitAnalysis: (data: LearningStyleFormData) => Promise<void>;
    resetWorkflow: () => void;
    setTopicFilter: (value: string) => void;
    setMaxRecommendations: (value: number) => void;
    generateRecommendations: () => Promise<void>;
    goToRecommendations: () => void;
}

export interface LearningStyleWorkflowController {
    state: LearningStyleStateAdapter;
    loadingState: LoadingState;
    view: LearningStyleWorkflowState;
    actions: LearningStyleWorkflowActions;
}

export function useLearningStyleWorkflow(
    service: ILearningStyleDashboardService,
    instituteId?: string | null
): LearningStyleWorkflowController {
    const state = useLearningStyleState();
    const store = useLearningStyleStore();
    const {
        workflowStep,
        studentLookup,
        knownStudents,
        profile,
        isLoadingProfile,
        topicFilter,
        maxRecommendations,
        systemStats,
        styleDistribution,
        topStruggleTopics,
        isStudentListOpen,
        setWorkflowStep,
        setStudentLookup,
        setKnownStudents,
        setProfile,
        setIsLoadingProfile,
        setTopicFilter,
        setMaxRecommendations,
        setSystemStats,
        setStyleDistribution,
        setTopStruggleTopics,
        setStudentListOpen,
        resetWorkflowUi,
    } = store;

    const [systemHealthStatus, setSystemHealthStatus] = useState<HealthCheckResponse['status'] | 'checking'>('checking');
    const [systemHealthMessage, setSystemHealthMessage] = useState<string>('Checking service status...');
    const [generatedRecommendations, setGeneratedRecommendations] = useState<string[]>([]);
    const [recommendationsRequested, setRecommendationsRequested] = useState(false);
    const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
    const [recommendationError, setRecommendationError] = useState<string | null>(null);

    const { handleSubmit, handleReset, loadingState } = useLearningStyleLogic({
        service,
        state,
        enablePersistence: true,
        enableEvents: true,
    });

    const clearGeneratedRecommendations = useCallback(() => {
        setGeneratedRecommendations([]);
        setRecommendationsRequested(false);
        setRecommendationError(null);
    }, []);

    const refreshDashboardMetrics = useCallback(async () => {
        try {
            const id = instituteId?.trim() || undefined;
            const [stats, students] = await Promise.all([
                service.getSystemStats(id),
                service.listStudentIds(STUDENT_LOOKUP_LIMIT, id),
            ]);

            setKnownStudents(students);
            setSystemStats(stats);
            setStyleDistribution(stats.learningStyleDistribution);
            setTopStruggleTopics(stats.topStruggleTopics);
        } catch (error) {
            console.error('Failed to refresh learning style dashboard metrics', error);
        }
    }, [service, instituteId, setKnownStudents, setSystemStats, setStyleDistribution, setTopStruggleTopics]);

    useEffect(() => {
        const initialize = async () => {
            try {
                const health = await service.checkHealth();
                setSystemHealthStatus(health.status);
                setSystemHealthMessage(health.message || `Learning style service is ${health.status}`);
            } catch {
                setSystemHealthStatus('down');
                setSystemHealthMessage('Learning style service is offline');
            }

            await refreshDashboardMetrics();
        };

        void initialize();
    }, [service, refreshDashboardMetrics]);

    useEffect(() => {
        if (!state.result) return;
        setWorkflowStep(3);
        clearGeneratedRecommendations();
        void refreshDashboardMetrics();
    }, [state.result, clearGeneratedRecommendations, refreshDashboardMetrics, setWorkflowStep]);

    const filteredStudents = useMemo(() => {
        const query = studentLookup.trim().toLowerCase();
        const matches = query.length === 0
            ? knownStudents
            : knownStudents.filter((student) => student.toLowerCase().includes(query));
        return matches.slice(0, STUDENT_SUGGESTION_LIMIT);
    }, [knownStudents, studentLookup]);

    const loadStudentProfile = useCallback(async () => {
        const studentId = (studentLookup || state.formData.student_id).trim();
        if (!studentId) {
            state.setError('Student ID is required');
            return;
        }

        setIsLoadingProfile(true);
        state.setError(null);
        state.setFormData({ ...state.formData, student_id: studentId });

        try {
            const studentProfile = await service.getStudentProfile(studentId);
            setProfile(studentProfile);
            setWorkflowStep(2);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load student profile';
            state.setError(message);
            setProfile(null);
        } finally {
            setIsLoadingProfile(false);
        }
    }, [service, setIsLoadingProfile, setProfile, setWorkflowStep, state, studentLookup]);

    const submitAnalysis = useCallback(async (data: LearningStyleFormData) => {
        clearGeneratedRecommendations();
        await handleSubmit(data);
        await refreshDashboardMetrics();
        setWorkflowStep(3);
    }, [clearGeneratedRecommendations, handleSubmit, refreshDashboardMetrics, setWorkflowStep]);

    const generateRecommendations = useCallback(async () => {
        if (!state.result) {
            setRecommendationError('Run learning style analysis before generating recommendations.');
            return;
        }

        const studentId = state.formData.student_id.trim();
        if (!studentId) {
            setRecommendationError('Student ID is required to generate recommendations.');
            return;
        }

        setRecommendationsRequested(true);
        setIsGeneratingRecommendations(true);
        setRecommendationError(null);

        try {
            const backendRecommendations = await service.generateRecommendations(studentId, maxRecommendations);
            const topicQuery = topicFilter.trim().toLowerCase();
            const filtered = topicQuery.length === 0
                ? backendRecommendations
                : backendRecommendations.filter((recommendation) => recommendation.toLowerCase().includes(topicQuery));

            setGeneratedRecommendations(filtered);
            await refreshDashboardMetrics();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to generate recommendations';
            setGeneratedRecommendations([]);
            setRecommendationError(message);
        } finally {
            setIsGeneratingRecommendations(false);
        }
    }, [state.result, state.formData.student_id, service, maxRecommendations, topicFilter, refreshDashboardMetrics]);

    const resetWorkflow = useCallback(() => {
        handleReset();
        clearGeneratedRecommendations();
        resetWorkflowUi();
    }, [clearGeneratedRecommendations, handleReset, resetWorkflowUi]);

    const openStudentList = useCallback(() => setStudentListOpen(true), [setStudentListOpen]);
    const closeStudentList = useCallback(() => setStudentListOpen(false), [setStudentListOpen]);
    const selectStudentSuggestion = useCallback((student: string) => {
        setStudentLookup(student);
        setStudentListOpen(false);
    }, [setStudentLookup, setStudentListOpen]);

    const setTopicFilterWithReset = useCallback((value: string) => {
        setTopicFilter(value);
        clearGeneratedRecommendations();
    }, [setTopicFilter, clearGeneratedRecommendations]);

    const setMaxRecommendationsWithReset = useCallback((value: number) => {
        setMaxRecommendations(value);
        clearGeneratedRecommendations();
    }, [setMaxRecommendations, clearGeneratedRecommendations]);

    const goToRecommendations = useCallback(() => setWorkflowStep(3), [setWorkflowStep]);

    return {
        state,
        loadingState,
        view: {
            workflowStep,
            studentLookup,
            knownStudents,
            profile,
            isLoadingProfile,
            topicFilter,
            maxRecommendations,
            systemStats,
            systemHealthStatus,
            systemHealthMessage,
            styleDistribution,
            topStruggleTopics,
            isStudentListOpen,
            filteredStudents,
            generatedRecommendations,
            recommendationsRequested,
            isGeneratingRecommendations,
            recommendationError,
        },
        actions: {
            setStudentLookup,
            openStudentList,
            closeStudentList,
            selectStudentSuggestion,
            loadStudentProfile,
            submitAnalysis,
            resetWorkflow,
            setTopicFilter: setTopicFilterWithReset,
            setMaxRecommendations: setMaxRecommendationsWithReset,
            generateRecommendations,
            goToRecommendations,
        },
    };
}
