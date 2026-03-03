import { AlertTriangle, BookOpen, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';
import 'chart.js/auto';
import type {
    DailyMetricItem,
    EngagementHistoryItem,
    EngagementSummaryResponse,
    StudentDashboardResponse,
    UiSchedule,
} from '../../core/types/dashboard';

interface StudentInsightsSectionProps {
    selectedDashboard: StudentDashboardResponse;
    engagementSummary: EngagementSummaryResponse | null;
    engagementHistory: EngagementHistoryItem[];
    dailyMetrics: DailyMetricItem[];
    predictionFactors: string[];
    schedule: UiSchedule | null;
    isGeneratingSchedule: boolean;
    isScheduleReasoningOpen: boolean;
    onGenerateSchedule: () => Promise<void>;
    onToggleScheduleReasoning: () => void;
}

function getRiskUi(riskLevel: string | undefined) {
    const normalized = (riskLevel || '').toLowerCase();

    if (!normalized || normalized.includes('unknown')) {
        return {
            label: 'Unknown',
            badge: 'border border-slate-300 bg-slate-100 text-slate-700',
            icon: 'text-slate-600',
        };
    }

    if (normalized.includes('high')) {
        return {
            label: 'High Risk',
            badge: 'bg-red-100 text-red-700 border border-red-200',
            icon: 'text-red-600',
        };
    }

    if (normalized.includes('medium')) {
        return {
            label: 'Medium Risk',
            badge: 'bg-amber-100 text-amber-700 border border-amber-200',
            icon: 'text-amber-600',
        };
    }

    return {
        label: 'Low Risk',
        badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        icon: 'text-emerald-600',
    };
}

function getEngagementLevelLabel(level: string | undefined): string {
    const normalized = (level || '').toLowerCase();

    if (normalized.includes('high')) return 'High';
    if (normalized.includes('medium') || normalized.includes('moderate')) return 'Moderate';
    if (normalized.includes('low')) return 'Low';

    return 'Unknown';
}

function formatTaskType(taskType: string): string {
    const types: Record<string, string> = {
        assignment_prep: '📝 Assignment Prep',
        quiz_interaction: '🎯 Quiz/Interaction',
        forum_engagement: '💬 Forum Engagement',
        general_study: '📚 General Study',
    };
    return types[taskType] || taskType;
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function StudentInsightsSection({
    selectedDashboard,
    engagementSummary,
    engagementHistory,
    dailyMetrics,
    predictionFactors,
    schedule,
    isGeneratingSchedule,
    isScheduleReasoningOpen,
    onGenerateSchedule,
    onToggleScheduleReasoning,
}: StudentInsightsSectionProps) {
    const riskUi = getRiskUi(selectedDashboard.current_status.risk_level);
    const engagementLevelLabel = getEngagementLevelLabel(selectedDashboard.current_status.engagement_level);
    const disengagementProbability = selectedDashboard.current_status.risk_probability == null
        ? null
        : Math.round(selectedDashboard.current_status.risk_probability * 100);

    const engagementTrendData = useMemo(() => {
        if (engagementHistory.length === 0) return null;

        return {
            labels: engagementHistory.map((item) => item.date),
            datasets: [
                {
                    label: 'Engagement Score',
                    data: engagementHistory.map((item) => item.engagement_score),
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.15)',
                    tension: 0.35,
                    fill: true,
                    pointRadius: 2,
                },
            ],
        };
    }, [engagementHistory]);

    const activityBreakdownData = useMemo(() => {
        return {
            labels: ['Login', 'Session', 'Interaction', 'Forum', 'Assignment'],
            datasets: [
                {
                    data: [
                        selectedDashboard.component_scores.login,
                        selectedDashboard.component_scores.session,
                        selectedDashboard.component_scores.interaction,
                        selectedDashboard.component_scores.forum,
                        selectedDashboard.component_scores.assignment,
                    ],
                    backgroundColor: ['#4f46e5', '#0ea5e9', '#f59e0b', '#22c55e', '#ef4444'],
                    borderColor: '#ffffff',
                    borderWidth: 2,
                },
            ],
        };
    }, [selectedDashboard]);

    const aggregatedMetrics = useMemo(() => {
        return dailyMetrics.reduce(
            (acc, item) => {
                acc.contentViews += item.page_views;
                acc.assignments += item.assignments_submitted;
                acc.quizAttempts += item.quiz_attempts;
                acc.forumPosts += item.forum_posts + item.forum_replies;
                acc.timeSpent += Math.round(item.total_session_duration_minutes);
                acc.loginFreq += item.login_count;
                return acc;
            },
            {
                contentViews: 0,
                assignments: 0,
                quizAttempts: 0,
                forumPosts: 0,
                timeSpent: 0,
                loginFreq: 0,
            }
        );
    }, [dailyMetrics]);

    return (
        <section className="space-y-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white">
                            {selectedDashboard.student_id.slice(0, 2)}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedDashboard.student_id}</h2>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Last updated: {selectedDashboard.last_updated}</p>
                        </div>
                    </div>
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${riskUi.badge}`}>
                        <span>Engagement</span>
                        <span>{engagementLevelLabel}</span>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Engagement Score</p>
                        <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{Math.round(selectedDashboard.current_status.engagement_score)}%</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Days Tracked</p>
                        <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{engagementSummary?.days_tracked ?? '--'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Activity Level</p>
                        <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{engagementSummary?.current_engagement_level ?? selectedDashboard.current_status.engagement_level}</p>
                    </div>
                </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-start gap-3">
                    <div className={`mt-1 ${riskUi.icon}`}>
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">AI Disengagement Prediction</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Machine learning analysis based on behavioral patterns</p>
                    </div>
                </div>

                <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Risk Level:</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskUi.badge}`}>{riskUi.label}</span>
                    </div>

                    <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Disengagement Probability</div>
                        <div className="h-6 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            {disengagementProbability == null ? (
                                <div className="flex h-full items-center px-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Unavailable
                                </div>
                            ) : (
                                <div className="flex h-full items-center rounded-full bg-gradient-to-r from-rose-500 to-amber-500 px-2 text-xs font-bold text-white" style={{ width: `${disengagementProbability}%` }}>
                                    {disengagementProbability}%
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    <h4 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">Key Factors</h4>
                    <div className="grid gap-2">
                        {(predictionFactors.length > 0 ? predictionFactors : selectedDashboard.alerts.map((alert) => alert.message))
                            .slice(0, 6)
                            .map((factor) => (
                                <div key={factor} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {factor}
                                </div>
                            ))}
                    </div>
                </div>
            </article>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-slate-100">Engagement Trend (Last 30 Days)</h3>
                    <div className="h-72">
                        {engagementTrendData ? <Line data={engagementTrendData} options={{ responsive: true, maintainAspectRatio: false }} /> : null}
                    </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <h3 className="mb-2 text-base font-bold text-slate-900 dark:text-slate-100">Activity Breakdown</h3>
                    <div className="h-72">
                        <Doughnut
                            data={activityBreakdownData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { position: 'bottom' } },
                            }}
                        />
                    </div>
                </article>
            </div>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h3 className="mb-3 text-base font-bold text-slate-900 dark:text-slate-100">Detailed Engagement Metrics (Last 7 Days)</h3>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Content Views</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{aggregatedMetrics.contentViews}</p></div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Assignments</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{aggregatedMetrics.assignments}</p></div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Quiz Attempts</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{aggregatedMetrics.quizAttempts}</p></div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Forum Activity</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{aggregatedMetrics.forumPosts}</p><p className="text-xs text-slate-400">posts + replies</p></div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Time Spent</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{aggregatedMetrics.timeSpent} min</p></div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Login Frequency</p><p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{aggregatedMetrics.loginFreq}</p></div>
                </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Personalized Study Schedule</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">AI-generated weekly schedule based on engagement patterns</p>
                    </div>
                    <button
                        type="button"
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                        onClick={() => void onGenerateSchedule()}
                        disabled={isGeneratingSchedule}
                    >
                        {isGeneratingSchedule ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                        <span>{isGeneratingSchedule ? 'Generating...' : 'Generate Schedule'}</span>
                    </button>
                </div>

                {schedule ? (
                    <div className="mt-4 space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Schedule Configuration</h4>
                                <button
                                    type="button"
                                    className="text-xs font-semibold text-indigo-700"
                                    onClick={onToggleScheduleReasoning}
                                >
                                    {isScheduleReasoningOpen ? 'Hide Reasoning' : 'Show Reasoning'}
                                </button>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Session Length</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{schedule.sessionLength} min</p></div>
                                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Sessions/Day</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{schedule.sessionsPerDay}</p></div>
                                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Daily Study</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{schedule.dailyMinutes} min</p></div>
                                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Load Reduction</p><p className="text-sm font-bold text-slate-900 dark:text-slate-100">{Math.round((1 - schedule.loadReduction) * 100)}%</p></div>
                            </div>

                            {isScheduleReasoningOpen ? (
                                <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                                    <h5 className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Why this schedule?</h5>
                                    <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                                        {(schedule.reasoning.length > 0 ? schedule.reasoning : ['Schedule generated from recent engagement behavior signals.']).map((item, index) => (
                                            <li key={`${item}-${index}`}>• {item}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </div>

                        <div>
                            <h4 className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100">Weekly Breakdown</h4>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {schedule.days.map((day) => (
                                    <div
                                        key={day.dayName}
                                        className={`rounded-xl border p-3 transition-colors ${day.isLightDay ? 'border-amber-200 bg-amber-50 ring-1 ring-amber-200/60 dark:border-amber-700 dark:bg-amber-900/25 dark:ring-amber-500/20' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'}`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{day.dayName}</p>
                                                <p className="text-xs text-slate-600 dark:text-slate-400">{formatDate(day.date)}</p>
                                            </div>
                                            {day.isLightDay ? <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-500">Light Day</span> : null}
                                        </div>
                                        <div className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                                            Total: {day.totalMinutes} minutes
                                        </div>
                                        <div className="space-y-2 mb-3">
                                            {day.sessions.map((session) => (
                                                <div key={session.sessionNumber} className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-600 dark:bg-slate-700">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Session {session.sessionNumber}</span>
                                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{session.durationMinutes} min</span>
                                                    </div>
                                                    <div className="text-xs text-slate-600 dark:text-slate-400">
                                                        <div>{formatTaskType(session.taskType)}</div>
                                                        <div className="text-slate-500 dark:text-slate-500">{session.suggestedTime}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                                            {day.taskBreakdown.assignmentPrepMinutes > 0 && (
                                                <div className="text-xs text-slate-600 dark:text-slate-400">📝 Assignments: {day.taskBreakdown.assignmentPrepMinutes} min</div>
                                            )}
                                            {day.taskBreakdown.quizInteractionMinutes > 0 && (
                                                <div className="text-xs text-slate-600 dark:text-slate-400">🎯 Quizzes: {day.taskBreakdown.quizInteractionMinutes} min</div>
                                            )}
                                            {day.taskBreakdown.forumEngagementMinutes > 0 && (
                                                <div className="text-xs text-slate-600 dark:text-slate-400">💬 Forum: {day.taskBreakdown.forumEngagementMinutes} min</div>
                                            )}
                                            {day.taskBreakdown.generalStudyMinutes > 0 && (
                                                <div className="text-xs text-slate-600 dark:text-slate-400">📚 General Study: {day.taskBreakdown.generalStudyMinutes} min</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        No schedule generated yet. Click <span className="font-semibold">Generate Schedule</span> to create a personalized weekly plan.
                    </div>
                )}
            </article>
        </section>
    );
}
