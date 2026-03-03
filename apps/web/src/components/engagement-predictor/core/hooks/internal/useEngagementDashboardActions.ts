import { useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
    generateSchedule,
    getDailyMetrics,
    getEngagementHistory,
    getEngagementSummary,
    getLatestPrediction,
    getScheduleSummary,
    getStudentDashboard,
} from '../../../services/engagementDashboardApi';
import { extractPredictionFactors } from '../../utils/engagementDashboardMappers';
import type { EngagementDashboardStoreSlice } from './useEngagementDashboardStoreSlice';

interface DashboardActionDeps {
    studentInput: EngagementDashboardStoreSlice['studentInput'];
    selectedDashboard: EngagementDashboardStoreSlice['selectedDashboard'];
    setStudentInput: EngagementDashboardStoreSlice['setStudentInput'];
    setSelectedDashboard: EngagementDashboardStoreSlice['setSelectedDashboard'];
    setEngagementSummary: EngagementDashboardStoreSlice['setEngagementSummary'];
    setEngagementHistory: EngagementDashboardStoreSlice['setEngagementHistory'];
    setDailyMetrics: EngagementDashboardStoreSlice['setDailyMetrics'];
    setPredictionFactors: EngagementDashboardStoreSlice['setPredictionFactors'];
    setError: EngagementDashboardStoreSlice['setError'];
    setIsLoadingDashboard: EngagementDashboardStoreSlice['setIsLoadingDashboard'];
    setSchedule: EngagementDashboardStoreSlice['setSchedule'];
    setIsGeneratingSchedule: EngagementDashboardStoreSlice['setIsGeneratingSchedule'];
    resetSchedulePanel: EngagementDashboardStoreSlice['resetSchedulePanel'];
    clearDashboardData: EngagementDashboardStoreSlice['clearDashboardData'];
}

export function useEngagementDashboardActions({
    studentInput,
    selectedDashboard,
    setStudentInput,
    setSelectedDashboard,
    setEngagementSummary,
    setEngagementHistory,
    setDailyMetrics,
    setPredictionFactors,
    setError,
    setIsLoadingDashboard,
    setSchedule,
    setIsGeneratingSchedule,
    resetSchedulePanel,
    clearDashboardData,
}: DashboardActionDeps) {
    const loadStudentDashboard = useCallback(async (forcedStudentId?: string) => {
        const studentId = (forcedStudentId || studentInput).trim().toUpperCase();

        if (!studentId) {
            setError('Student ID is required');
            return;
        }

        const instId = useAuthStore.getState().user?.institute_id;

        setStudentInput(studentId);
        setIsLoadingDashboard(true);
        setError(null);
        resetSchedulePanel();

        try {
            const [dashboard, history, metrics, summary] = await Promise.all([
                getStudentDashboard(studentId, instId),
                getEngagementHistory(studentId, 30),
                getDailyMetrics(studentId, 7),
                getEngagementSummary(studentId),
            ]);

            setSelectedDashboard(dashboard);
            setEngagementSummary(summary);
            setEngagementHistory(history);
            setDailyMetrics(metrics);

            try {
                const prediction = await getLatestPrediction(studentId, instId);
                const factors = extractPredictionFactors(prediction.contributing_factors);
                setPredictionFactors(factors.length > 0 ? factors : dashboard.alerts.map((alert) => alert.message));
            } catch {
                setPredictionFactors(dashboard.alerts.map((alert) => alert.message));
            }
        } catch (dashboardError) {
            clearDashboardData();
            setError(dashboardError instanceof Error ? dashboardError.message : 'Failed to load student dashboard');
        } finally {
            setIsLoadingDashboard(false);
        }
    }, [
        clearDashboardData,
        resetSchedulePanel,
        setDailyMetrics,
        setEngagementHistory,
        setEngagementSummary,
        setError,
        setIsLoadingDashboard,
        setPredictionFactors,
        setSelectedDashboard,
        setStudentInput,
        studentInput,
    ]);

    const generateStudentSchedule = useCallback(async () => {
        if (!selectedDashboard) {
            setError('Load a student dashboard before generating a schedule.');
            return;
        }

        const instId = useAuthStore.getState().user?.institute_id;
        setIsGeneratingSchedule(true);

        try {
            const generatedSchedule = await generateSchedule(selectedDashboard.student_id, instId);

            let reasoning: string[] = [];
            try {
                const summary = await getScheduleSummary(selectedDashboard.student_id, instId);
                reasoning = Object.values(summary.reasoning || {});
            } catch {
                reasoning = [];
            }

            setSchedule({
                sessionLength: generatedSchedule.session_length_minutes,
                sessionsPerDay: generatedSchedule.sessions_per_day,
                dailyMinutes: generatedSchedule.total_study_minutes_per_day,
                loadReduction: generatedSchedule.load_reduction_factor,
                reasoning,
                days: generatedSchedule.daily_schedules.map((day) => ({
                    dayName: day.day_name,
                    date: day.date,
                    totalMinutes: day.total_minutes,
                    sessions: day.sessions.map((session) => ({
                        sessionNumber: session.session_number,
                        durationMinutes: session.duration_minutes,
                        taskType: session.task_type,
                        suggestedTime: session.suggested_time,
                    })),
                    taskBreakdown: {
                        assignmentPrepMinutes: day.task_breakdown?.assignment_prep_minutes || 0,
                        quizInteractionMinutes: day.task_breakdown?.quiz_interaction_minutes || 0,
                        forumEngagementMinutes: day.task_breakdown?.forum_engagement_minutes || 0,
                        generalStudyMinutes: day.task_breakdown?.general_study_minutes || 0,
                    },
                    isLightDay: day.is_light_day,
                })),
            });
            setError(null);
        } catch {
            setSchedule(null);
            setError('Unable to generate schedule from backend.');
        } finally {
            setIsGeneratingSchedule(false);
        }
    }, [selectedDashboard, setError, setIsGeneratingSchedule, setSchedule]);

    return {
        loadStudentDashboard,
        generateStudentSchedule,
    };
}
