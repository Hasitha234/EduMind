/**
 * Learning Style Predictor Component
 * Composes workflow sections and delegates orchestration to a dedicated hook.
 */

import { PredictorErrorBoundary } from '@/components/common/PredictorErrorBoundary';
import { useAuth } from '@/store/authStore';
import { useSearch } from '@tanstack/react-router';
import { BookOpenCheck, ChartNoAxesCombined, Database, Users } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ILearningStyleDashboardService } from './data/interfaces';
import { useLearningStyleWorkflow } from './core/hooks/useLearningStyleWorkflow';
import { AnalysisStep } from './features/workflow/AnalysisStep';
import { LearningStyleAnalyticsSection } from './features/workflow/LearningStyleAnalyticsSection';
import { RecommendationsStep } from './features/workflow/RecommendationsStep';
import { StudentSelectionStep } from './features/workflow/StudentSelectionStep';
import { defaultLearningStyleService } from './services/serviceFactory';

interface LearningStylePredictorCoreProps {
    service: ILearningStyleDashboardService;
}

function formatPercentage(value: number | undefined): string {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '--';
    }

    const normalized = value <= 1 ? value * 100 : value;
    return `${Math.round(normalized)}%`;
}

function LearningStylePredictorCore({ service }: LearningStylePredictorCoreProps) {
    const workflow = useLearningStyleWorkflow(service);
    const { user, isAuthenticated } = useAuth();
    const autoSelected = useRef(false);
    const search = useSearch({ from: '/learning-style' });
    const urlStudentId = (search as { student_id?: string }).student_id;

    const isStudent = isAuthenticated && user?.role === 'student';

    useEffect(() => {
        if (autoSelected.current) return;

        // URL param from overview takes priority (admin clicking a student)
        const targetId = urlStudentId ?? (isStudent ? user?.id : undefined);
        if (targetId) {
            autoSelected.current = true;
            workflow.actions.setStudentLookup(targetId);
            void workflow.actions.loadStudentProfile();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlStudentId, isStudent, user?.id]);

    const status = workflow.view.systemHealthStatus;
    const stats = workflow.view.systemStats;
    const statusLabel = status === 'checking'
        ? 'Checking...'
        : status === 'healthy'
            ? 'System Online'
            : status === 'degraded'
                ? 'System Degraded'
                : 'System Offline';

    const statusClasses = status === 'healthy'
        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
        : status === 'degraded'
            ? 'border-amber-300 bg-amber-50 text-amber-700'
            : status === 'checking'
                ? 'border-slate-300 bg-slate-50 text-slate-700'
                : 'border-red-300 bg-red-50 text-red-700';

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_5%_0%,rgba(99,102,241,0.12),transparent_42%),radial-gradient(circle_at_95%_0%,rgba(14,165,233,0.12),transparent_42%),bg-background dark:bg-slate-900] pt-20 text-slate-900 dark:text-slate-100">
            <main className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
                <section className="mb-4 grid gap-3">
                    <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses}`}>
                        <span className={`h-2 w-2 rounded-full ${status === 'healthy' ? 'bg-emerald-500' : status === 'degraded' ? 'bg-amber-500' : status === 'checking' ? 'bg-slate-500' : 'bg-red-500'}`} />
                        <span>{statusLabel}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{workflow.view.systemHealthMessage}</p>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <article className="rounded-xl border border-indigo-200 bg-background dark:bg-slate-900 p-3 shadow-sm">
                            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
                                <Users size={18} />
                            </div>
                            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats?.totalStudents ?? '--'}</p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Total Students</p>
                        </article>

                        <article className="rounded-xl border border-sky-200 bg-background dark:bg-slate-900 p-3 shadow-sm">
                            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200">
                                <Database size={18} />
                            </div>
                            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats?.totalResources ?? '--'}</p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Resources</p>
                        </article>

                        <article className="rounded-xl border border-violet-200 bg-background dark:bg-slate-900 p-3 shadow-sm">
                            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200">
                                <BookOpenCheck size={18} />
                            </div>
                            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats?.totalRecommendations ?? '--'}</p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Recommendations</p>
                        </article>

                        <article className="rounded-xl border border-emerald-200 bg-background dark:bg-slate-900 p-3 shadow-sm">
                            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
                                <ChartNoAxesCombined size={18} />
                            </div>
                            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatPercentage(stats?.recommendationCompletionRate)}</p>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Success Rate</p>
                        </article>
                    </div>
                </section>

                <section className="grid gap-4">
                    <StudentSelectionStep
                        studentLookup={workflow.view.studentLookup}
                        filteredStudents={workflow.view.filteredStudents}
                        isStudentListOpen={workflow.view.isStudentListOpen}
                        profile={workflow.view.profile}
                        isLoadingProfile={workflow.view.isLoadingProfile}
                        onStudentLookupChange={workflow.actions.setStudentLookup}
                        onOpenStudentList={workflow.actions.openStudentList}
                        onCloseStudentList={workflow.actions.closeStudentList}
                        onSelectStudent={workflow.actions.selectStudentSuggestion}
                        onLoadStudentProfile={workflow.actions.loadStudentProfile}
                    />

                    {workflow.view.workflowStep >= 2 ? (
                        <AnalysisStep
                            formData={workflow.state.formData}
                            isLoading={workflow.state.isLoading}
                            error={workflow.state.error}
                            loadingState={workflow.loadingState}
                            result={workflow.state.result}
                            onSubmit={workflow.actions.submitAnalysis}
                            onReset={workflow.actions.resetWorkflow}
                            onContinue={workflow.actions.goToRecommendations}
                        />
                    ) : null}

                    {workflow.view.workflowStep >= 3 && workflow.state.result ? (
                        <RecommendationsStep
                            topicFilter={workflow.view.topicFilter}
                            maxRecommendations={workflow.view.maxRecommendations}
                            generatedRecommendations={workflow.view.generatedRecommendations}
                            recommendationsRequested={workflow.view.recommendationsRequested}
                            isGeneratingRecommendations={workflow.view.isGeneratingRecommendations}
                            recommendationError={workflow.view.recommendationError}
                            onTopicFilterChange={workflow.actions.setTopicFilter}
                            onMaxRecommendationsChange={workflow.actions.setMaxRecommendations}
                            onGenerateRecommendations={workflow.actions.generateRecommendations}
                        />
                    ) : null}
                </section>

                <LearningStyleAnalyticsSection
                    styleDistribution={workflow.view.styleDistribution}
                    topStruggleTopics={workflow.view.topStruggleTopics}
                />
            </main>
        </div>
    );
}

export interface LearningStylePredictorProps {
    service?: ILearningStyleDashboardService;
}

export function LearningStylePredictor({ service = defaultLearningStyleService }: LearningStylePredictorProps) {
    return (
        <PredictorErrorBoundary>
            <LearningStylePredictorCore service={service} />
        </PredictorErrorBoundary>
    );
}

export default LearningStylePredictor;
