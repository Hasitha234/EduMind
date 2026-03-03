import { AlertTriangle, CheckCircle2, Sparkles, TrendingUp, Users } from 'lucide-react';
import type { SystemStatus, SystemStatsResponse } from '../../core/types/dashboard';

interface SystemOverviewSectionProps {
    systemStatus: SystemStatus;
    systemMessage: string;
    stats: SystemStatsResponse | null;
}

export function SystemOverviewSection({
    systemStatus,
    systemMessage,
    stats,
}: SystemOverviewSectionProps) {
    return (
        <>
            <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/30">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">EduMind Analytics</h1>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Student Engagement Intelligence Platform</p>
                        </div>
                    </div>

                    <div
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${systemStatus === 'healthy'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : systemStatus === 'degraded'
                                ? 'border-amber-300 bg-amber-50 text-amber-700'
                                : systemStatus === 'checking'
                                    ? 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                    : 'border-red-300 bg-red-50 text-red-700'
                            }`}
                    >
                        <span
                            className={`h-2 w-2 rounded-full ${systemStatus === 'healthy'
                                ? 'bg-emerald-500'
                                : systemStatus === 'degraded'
                                    ? 'bg-amber-500'
                                    : systemStatus === 'checking'
                                        ? 'bg-slate-500'
                                        : 'bg-red-500'
                                }`}
                        />
                        <span>
                            {systemStatus === 'healthy'
                                ? 'System Online'
                                : systemStatus === 'degraded'
                                    ? 'System Degraded'
                                    : systemStatus === 'checking'
                                        ? 'Checking...'
                                        : 'System Offline'}
                        </span>
                    </div>
                </div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{systemMessage}</p>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm dark:bg-slate-900">
                    <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                        <Users className="h-4 w-4" />
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{stats?.total_students ?? '--'}</div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Total Students</div>
                </article>

                <article className="rounded-xl border border-red-200 bg-white p-4 shadow-sm dark:bg-slate-900">
                    <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{stats?.high_risk_students ?? '--'}</div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">High Risk Students</div>
                </article>

                <article className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm dark:bg-slate-900">
                    <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                        <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{stats?.at_risk_students ?? '--'}</div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">At Risk</div>
                </article>

                <article className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm dark:bg-slate-900">
                    <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{stats ? `${Math.round(stats.avg_engagement_score)}%` : '--'}</div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Avg Engagement</div>
                </article>
            </section>
        </>
    );
}
