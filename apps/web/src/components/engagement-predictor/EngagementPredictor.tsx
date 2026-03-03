import { useAuth } from '@/store/authStore';
import { useEffect, useRef } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useEngagementDashboardWorkflow } from './core/hooks/useEngagementDashboardWorkflow';
import {
    StudentInsightsSection,
    StudentLookupSection,
    SystemOverviewSection,
} from './features/dashboard';

export function EngagementPredictor() {
    const { view, actions } = useEngagementDashboardWorkflow();
    const { user, isAuthenticated } = useAuth();
    const autoLoaded = useRef(false);
    const search = useSearch({ from: '/engagement' });
    const urlStudentId = (search as { student_id?: string }).student_id;

    const isStudent = isAuthenticated && user?.role === 'student';

    // Auto-load when a student_id is passed via URL (e.g. from engagement overview)
    useEffect(() => {
        if (urlStudentId && !autoLoaded.current) {
            autoLoaded.current = true;
            actions.setStudentInput(urlStudentId);
            void actions.loadStudentDashboard(urlStudentId);
            return;
        }
        // Auto-load student's own dashboard when they arrive as a student user
        if (isStudent && user?.id && !autoLoaded.current) {
            autoLoaded.current = true;
            actions.setStudentInput(user.id);
            void actions.loadStudentDashboard(user.id);
        }
    }, [isStudent, user?.id, urlStudentId, actions]);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_8%_0%,rgba(79,70,229,0.13),transparent_38%),radial-gradient(circle_at_92%_0%,rgba(6,182,212,0.13),transparent_40%),#f1f5f9] px-4 pb-10 pt-24 sm:px-6 lg:px-8 dark:bg-[radial-gradient(circle_at_8%_0%,rgba(99,102,241,0.18),transparent_38%),radial-gradient(circle_at_92%_0%,rgba(14,165,233,0.14),transparent_40%),#020617]">
            <div className="mx-auto max-w-7xl space-y-4">
                <SystemOverviewSection
                    systemStatus={view.systemStatus}
                    systemMessage={view.systemMessage}
                    stats={view.stats}
                />

                {!isStudent && (
                    <StudentLookupSection
                        studentInput={view.studentInput}
                        quickStudents={view.quickStudents}
                        isLoadingDashboard={view.isLoadingDashboard}
                        error={view.error}
                        onStudentInputChange={actions.setStudentInput}
                        onQuickSelect={actions.loadStudentDashboard}
                        onLoadStudentDashboard={() => actions.loadStudentDashboard()}
                    />
                )}

                {view.selectedDashboard ? (
                    <StudentInsightsSection
                        selectedDashboard={view.selectedDashboard}
                        engagementSummary={view.engagementSummary}
                        engagementHistory={view.engagementHistory}
                        dailyMetrics={view.dailyMetrics}
                        predictionFactors={view.predictionFactors}
                        schedule={view.schedule}
                        isGeneratingSchedule={view.isGeneratingSchedule}
                        isScheduleReasoningOpen={view.isScheduleReasoningOpen}
                        onGenerateSchedule={actions.generateStudentSchedule}
                        onToggleScheduleReasoning={actions.toggleScheduleReasoning}
                    />
                ) : null}
            </div>
        </div>
    );
}

export default EngagementPredictor;
