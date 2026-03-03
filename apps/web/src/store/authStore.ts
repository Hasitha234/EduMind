import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'student';
    /** The institute this user belongs to. Admins see only their institute's students. */
    institute_id: string;
    avatar?: string;
}

interface AuthState {
    // Auth state
    user: AuthUser | null;
    token: string | null;
    isAuthenticated: boolean;

    // Actions
    login: (user: AuthUser, token: string) => void;
    logout: () => void;
    updateUser: (user: Partial<AuthUser>) => void;
    setToken: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
    devtools(
        persist(
            (set) => ({
                // Initial state
                user: null,
                token: null,
                isAuthenticated: false,

                // Actions
                login: (user, token) =>
                    set(
                        {
                            user,
                            token,
                            isAuthenticated: true,
                        },
                        false,
                        'login'
                    ),

                logout: () =>
                    set(
                        {
                            user: null,
                            token: null,
                            isAuthenticated: false,
                        },
                        false,
                        'logout'
                    ),

                updateUser: (updatedUser) =>
                    set(
                        (state) => ({
                            user: state.user ? { ...state.user, ...updatedUser } : null,
                        }),
                        false,
                        'updateUser'
                    ),

                setToken: (token) =>
                    set({ token }, false, 'setToken'),
            }),
            {
                name: 'auth-storage',
                partialize: (state) => ({
                    user: state.user,
                    token: state.token,
                    isAuthenticated: state.isAuthenticated,
                }),
            }
        ),
        { name: 'AuthStore' }
    )
);

// Helper hooks
export const useAuth = () => {
    const { user, token, isAuthenticated } = useAuthStore();
    return { user, token, isAuthenticated };
};

export const useIsAdmin = () => {
    const user = useAuthStore((state) => state.user);
    return user?.role === 'admin';
};

export const useIsStudent = () => {
    const user = useAuthStore((state) => state.user);
    return user?.role === 'student';
};
