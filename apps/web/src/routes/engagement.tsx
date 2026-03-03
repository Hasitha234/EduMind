import { PageSkeleton } from '@/components/common/PageSkeleton';
import { createFileRoute } from '@tanstack/react-router';

interface EngagementSearch {
    student_id?: string;
}

export const Route = createFileRoute('/engagement')({
    pendingComponent: PageSkeleton,
    validateSearch: (search: Record<string, unknown>): EngagementSearch => ({
        student_id: typeof search.student_id === 'string' ? search.student_id : undefined,
    }),
});
