import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { getServiceHealth, getStudents, getSystemStats } from '../../../services/engagementDashboardApi';
import { normalizeSystemStatus } from '../../utils/engagementDashboardMappers';
import type { EngagementDashboardStoreSlice } from './useEngagementDashboardStoreSlice';

interface BootstrapStateDeps {
    setSystemStatus: EngagementDashboardStoreSlice['setSystemStatus'];
    setSystemMessage: EngagementDashboardStoreSlice['setSystemMessage'];
    setStats: EngagementDashboardStoreSlice['setStats'];
    setStudents: EngagementDashboardStoreSlice['setStudents'];
    setError: EngagementDashboardStoreSlice['setError'];
}

export function useEngagementDashboardBootstrap({
    setSystemStatus,
    setSystemMessage,
    setStats,
    setStudents,
    setError,
}: BootstrapStateDeps) {
    const user = useAuthStore((s) => s.user);
    const instituteId = user?.institute_id ?? 'LMS_INST_A';

    useEffect(() => {
        const initialize = async () => {
            try {
                const health = await getServiceHealth();
                const status = normalizeSystemStatus(health.status);
                setSystemStatus(status);
                setSystemMessage(
                    status === 'healthy'
                        ? 'Engagement service is operational'
                        : 'Engagement service is not fully healthy'
                );
            } catch {
                setSystemStatus('down');
                setSystemMessage('Engagement service is offline');
            }

            try {
                const [statsPayload, studentsPayload] = await Promise.all([
                    getSystemStats(instituteId),
                    getStudents(200, instituteId),
                ]);
                setStats(statsPayload);
                setStudents(studentsPayload.students || []);
            } catch (initializationError) {
                setError(
                    initializationError instanceof Error
                        ? initializationError.message
                        : 'Failed to load system data'
                );
            }
        };

        void initialize();
    }, [instituteId, setError, setStats, setStudents, setSystemMessage, setSystemStatus]);
}
