import { PageSkeleton } from '@/components/common/PageSkeleton';
import { createFileRoute } from '@tanstack/react-router';

interface LearningStyleSearch {
    student_id?: string;
}

export const Route = createFileRoute('/learning-style')({
    pendingComponent: PageSkeleton,
    validateSearch: (search: Record<string, unknown>): LearningStyleSearch => ({
        student_id: typeof search.student_id === 'string' ? search.student_id : undefined,
    }),
});
