export interface User {
    id: number;
    email: string;
    name: string | null;
    profile_image: string | null;
    created_at: string;
    flagged_event_ids: number[];
    is_admin: boolean;
}

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}
