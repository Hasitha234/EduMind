import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/store/authStore';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    Brain,
    CheckCircle,
    RefreshCw,
    Users,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_ENGAGEMENT_TRACKER_API_URL ?? 'http://localhost:8005';
const LEARNING_STYLE_API = import.meta.env.VITE_LEARNING_STYLE_API_URL ?? 'http://localhost:8006';

interface StudentRow {
    student_id: string;
    engagement_score: number;
    engagement_level: string;
    engagement_trend: string;
    at_risk: boolean;
    risk_level: string;
    risk_probability: number | null;
    last_updated: string;
    learning_style?: string;
}

interface LearningStyleProfile {
    student_id: string;
    learning_style: string;
}

interface SystemStats {
    learning_style_distribution?: Record<string, number>;
}

interface ListResponse {
    total: number;
    students: StudentRow[];
}

const SCORE_BAR_COLOR = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-400';
    return 'bg-red-500';
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
    const [learningStyleMap, setLearningStyleMap] = useState<Record<string, string>>({});
    const [avgLearningStyle, setAvgLearningStyle] = useState<string>('—');

    const fetchStudents = async () => {
        setLoading(true);
        setError(null);
        try {
            const [listRes, profilesRes, statsRes] = await Promise.all([
                fetch(`${API_BASE}/api/v1/students/list?limit=200&institute_id=${encodeURIComponent(instituteId)}`),
                fetch(`${LEARNING_STYLE_API}/api/v1/students/?limit=500`),
                fetch(`${LEARNING_STYLE_API}/api/v1/system/stats`),
            ]);

            if (!listRes.ok) throw new Error(`Server responded with ${listRes.status}`);
            const data: ListResponse = await listRes.json();
            const studentsList = data.students as StudentRow[];

            const map: Record<string, string> = {};
            if (profilesRes.ok) {
                const profiles: LearningStyleProfile[] = await profilesRes.json();
                profiles.forEach((p) => { map[p.student_id] = p.learning_style; });
            }
            setLearningStyleMap(map);

            let modeStyle = '—';
            if (statsRes.ok) {
                const stats: SystemStats = await statsRes.json();
                const dist = stats.learning_style_distribution ?? {};
                const entries = Object.entries(dist);
                if (entries.length > 0) {
                    const [top] = entries.sort((a, b) => b[1] - a[1]);
                    modeStyle = top[0];
                }
            }
            setAvgLearningStyle(modeStyle);

            setStudents(studentsList.map((s) => ({ ...s, learning_style: map[s.student_id] })));
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
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                            <div className="flex items-center gap-2 text-blue-400 mb-1">
                                <Users className="w-5 h-5" />
                                <span className="text-xs font-medium text-slate-300">Total Students</span>
                            </div>
                            <div className="text-2xl font-bold text-white">{stats.total}</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                            <div className="flex items-center gap-2 text-emerald-400 mb-1">
                                <Activity className="w-5 h-5" />
                                <span className="text-xs font-medium text-slate-300">Avg Engagement</span>
                            </div>
                            <div className="text-2xl font-bold text-white">{stats.avgScore}%</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                            <div className="flex items-center gap-2 text-purple-400 mb-1">
                                <Brain className="w-5 h-5" />
                                <span className="text-xs font-medium text-slate-300">Average Learning Style</span>
                            </div>
                            <div className="text-2xl font-bold text-white">{avgLearningStyle}</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                            <div className="flex items-center gap-2 text-slate-400 mb-1">
                                <span className="text-xs font-medium text-slate-400">—</span>
                            </div>
                            <div className="text-2xl font-bold text-white/50">—</div>
                        </div>
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
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold w-12">#</th>
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Student</th>
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Engagement Score</th>
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Learning Style</th>
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Last Updated</th>
                                        <th className="text-left px-6 py-4 text-slate-500 font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {displayed.map((student, index) => (
                                        <tr
                                            key={student.student_id}
                                            className="hover:bg-slate-50/60 transition-colors group"
                                        >
                                            <td className="px-6 py-4 text-slate-500 font-medium">
                                                {index + 1}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs">
                                                        {index + 1}
                                                    </div>
                                                    <span className="font-semibold text-slate-800">Student {index + 1}</span>
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
                                                <span className="text-slate-600">{student.learning_style ?? '—'}</span>
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
