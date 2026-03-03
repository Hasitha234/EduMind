import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/store/authStore';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    BookOpen,
    Brain,
    CheckCircle,
    RefreshCw,
    TrendingDown,
    TrendingUp,
    Users,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_ENGAGEMENT_TRACKER_API_URL ?? 'http://localhost:8005';

interface StudentRow {
    student_id: string;
    engagement_score: number;
    engagement_level: string;
    engagement_trend: string;
    at_risk: boolean;
    risk_level: string;
    risk_probability: number | null;
    last_updated: string;
}

interface ListResponse {
    total: number;
    students: StudentRow[];
}

const RISK_COLORS: Record<string, string> = {
    High: 'bg-red-100 text-red-700 border-red-200',
    Medium: 'bg-amber-100 text-amber-700 border-amber-200',
    Low: 'bg-green-100 text-green-700 border-green-200',
    Unknown: 'bg-slate-100 text-slate-500 border-slate-200',
};

const LEVEL_COLORS: Record<string, string> = {
    High: 'bg-emerald-100 text-emerald-700',
    Medium: 'bg-blue-100 text-blue-700',
    Low: 'bg-orange-100 text-orange-700',
    Critical: 'bg-red-100 text-red-700',
};

const SCORE_BAR_COLOR = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-400';
    return 'bg-red-500';
};

const TrendIcon = ({ trend }: { trend: string }) => {
    const t = (trend ?? '').toLowerCase();
    if (t.includes('improv') || t === 'increasing') return <TrendingUp className="w-4 h-4 text-emerald-500" />;
    if (t.includes('declin') || t === 'decreasing') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Activity className="w-4 h-4 text-slate-400" />;
};

export default function EngagementOverview() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const instituteId = user?.institute_id ?? 'LMS_INST_A';

    const [students, setStudents] = useState<StudentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'at_risk' | 'high_risk'>('all');
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const fetchStudents = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `${API_BASE}/api/v1/students/list?limit=200&institute_id=${encodeURIComponent(instituteId)}`
            );
            if (!res.ok) throw new Error(`Server responded with ${res.status}`);
            const data: ListResponse = await res.json();
            setStudents(data.students);
            setLastRefresh(new Date());
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load students');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void fetchStudents(); }, [instituteId]);

    const displayed = students.filter(s => {
        if (filter === 'at_risk') return s.at_risk;
        if (filter === 'high_risk') return s.risk_level === 'High';
        return true;
    });

    const stats = {
        total: students.length,
        atRisk: students.filter(s => s.at_risk).length,
        highRisk: students.filter(s => s.risk_level === 'High').length,
        avgScore: students.length
            ? Math.round(students.reduce((sum, s) => sum + s.engagement_score, 0) / students.length)
            : 0,
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-emerald-900 to-teal-900 pt-20 pb-10 px-4 sm:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <BarChart3 className="w-8 h-8 text-emerald-400" />
                                Engagement Overview
                            </h1>
                            <p className="text-slate-300 mt-1 text-sm font-medium">
                                Institute: <span className="text-emerald-400">{instituteId}</span>
                            </p>
                            <p className="text-slate-400 mt-0.5 text-xs">
                                Last refreshed: {lastRefresh.toLocaleTimeString()}
                            </p>
                        </div>
                        <button
                            onClick={() => void fetchStudents()}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors text-sm"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        {[
                            { label: 'Total Students', value: stats.total, icon: <Users className="w-5 h-5" />, color: 'text-blue-400' },
                            { label: 'Avg Engagement', value: `${stats.avgScore}%`, icon: <Activity className="w-5 h-5" />, color: 'text-emerald-400' },
                            { label: 'At Risk', value: stats.atRisk, icon: <AlertTriangle className="w-5 h-5" />, color: 'text-amber-400' },
                            { label: 'High Risk', value: stats.highRisk, icon: <AlertTriangle className="w-5 h-5" />, color: 'text-red-400' },
                        ].map(card => (
                            <div key={card.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                                <div className={`flex items-center gap-2 ${card.color} mb-1`}>
                                    {card.icon}
                                    <span className="text-xs font-medium text-slate-300">{card.label}</span>
                                </div>
                                <div className="text-2xl font-bold text-white">{card.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6 flex-wrap">
                    {[
                        { key: 'all', label: 'All Students' },
                        { key: 'at_risk', label: 'At Risk' },
                        { key: 'high_risk', label: 'High Risk Only' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key as typeof filter)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                filter === tab.key
                                    ? 'bg-emerald-600 text-white shadow'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            {tab.label}
                            <span className="ml-2 text-xs opacity-70">
                                ({tab.key === 'all' ? stats.total : tab.key === 'at_risk' ? stats.atRisk : stats.highRisk})
                            </span>
                        </button>
                    ))}
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3 text-red-700">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <div>
                            <p className="font-medium">Could not load student data</p>
                            <p className="text-sm text-red-500">{error} — make sure the engagement tracker is running on port 8005.</p>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 animate-pulse h-16" />
                        ))}
                    </div>
                )}

                {/* Empty */}
                {!loading && !error && displayed.length === 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                        <CheckCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No students found</p>
                        <p className="text-slate-400 text-sm mt-1">
                            {filter !== 'all' ? 'Try switching to "All Students"' : 'Run the seed script to generate demo data.'}
                        </p>
                    </div>
                )}

                {/* Student Table */}
                {!loading && displayed.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Student ID</th>
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Engagement Score</th>
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Level</th>
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Trend</th>
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Risk Level</th>
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Risk Probability</th>
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Last Updated</th>
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {displayed.map(student => (
                                        <tr
                                            key={student.student_id}
                                            className="hover:bg-slate-50/60 transition-colors group"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs">
                                                        {student.student_id.replace(/\D/g, '').slice(-2) || '?'}
                                                    </div>
                                                    <span className="font-semibold text-slate-800">{student.student_id}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${SCORE_BAR_COLOR(student.engagement_score)}`}
                                                            style={{ width: `${Math.min(student.engagement_score, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="font-semibold text-slate-700 w-10">
                                                        {student.engagement_score}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${LEVEL_COLORS[student.engagement_level] ?? 'bg-slate-100 text-slate-600'}`}>
                                                    {student.engagement_level}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <TrendIcon trend={student.engagement_trend} />
                                                    <span className="text-slate-600 capitalize">{student.engagement_trend}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${RISK_COLORS[student.risk_level] ?? RISK_COLORS['Unknown']}`}>
                                                    {student.at_risk ? '⚠ ' : ''}{student.risk_level}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {student.risk_probability != null
                                                    ? `${(student.risk_probability * 100).toFixed(1)}%`
                                                    : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-xs">
                                                {student.last_updated}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => navigate({
                                                            to: '/engagement',
                                                            search: { student_id: student.student_id },
                                                        })}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 hover:border-emerald-300 text-xs font-semibold transition-all duration-150 whitespace-nowrap"
                                                    >
                                                        <Activity className="w-3.5 h-3.5" />
                                                        Engagement
                                                    </button>
                                                    <button
                                                        onClick={() => navigate({
                                                            to: '/learning-style',
                                                            search: { student_id: student.student_id },
                                                        })}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 hover:border-purple-300 text-xs font-semibold transition-all duration-150 whitespace-nowrap"
                                                    >
                                                        <Brain className="w-3.5 h-3.5" />
                                                        Learning Style
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
                            Showing {displayed.length} of {students.length} students
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
