export interface User {
    id: number;
    email: string;
    name: string | null;
    profile_image: string | null;
    created_at: string;
    favorite_event_ids: number[];
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}
