import { createFileRoute } from '@tanstack/react-router';

interface UserSigninSearch {
    student_id?: string;
    institute_id?: string;
}

export const Route = createFileRoute('/user-signin')({
    validateSearch: (search: Record<string, unknown>): UserSigninSearch => ({
        student_id: typeof search.student_id === 'string' ? search.student_id : undefined,
        institute_id: typeof search.institute_id === 'string' ? search.institute_id : undefined,
    }),
});
