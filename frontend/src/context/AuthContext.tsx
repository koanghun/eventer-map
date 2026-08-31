import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { setAccessToken } from '../lib/axios';
import { postAuthLogin, postAuthSignup, postAuthGoogle, postAuthLogout, postAuthRefresh } from '../api/generated/auth/auth';
import { getUsersMe } from '../api/generated/user/user';
import { toast } from '../store/useToastStore';
import type { UserProfile } from '../api/generated/model';

interface AuthContextType {
    user: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, nickname: string) => Promise<void>;
    googleLogin: (idToken: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUser = useCallback(async () => {
        try {
            const profile = await getUsersMe();
            setUser(profile);
        } catch {
            setUser(null);
        }
    }, []);

    // Try to restore session on app start via refresh token cookie
    useEffect(() => {
        const tryRestore = async () => {
            try {
                const res = await postAuthRefresh();
                setAccessToken(res.accessToken);
                await fetchUser();
            } catch {
                // No valid refresh token — stay logged out
            } finally {
                setIsLoading(false);
            }
        };
        tryRestore();
    }, [fetchUser]);

    const login = useCallback(async (email: string, password: string) => {
        const res = await postAuthLogin({ email, password });
        setAccessToken(res.accessToken);
        await fetchUser();
        toast.success('로그인되었습니다.');
    }, [fetchUser]);

    const signup = useCallback(async (email: string, password: string, nickname: string) => {
        const res = await postAuthSignup({ email, password, nickname });
        setAccessToken(res.accessToken);
        await fetchUser();
        toast.success('회원가입이 완료되었습니다.');
    }, [fetchUser]);

    const googleLogin = useCallback(async (idToken: string) => {
        const res = await postAuthGoogle({ idToken });
        setAccessToken(res.accessToken);
        await fetchUser();
        toast.success('구글 로그인 성공!');
    }, [fetchUser]);

    const logout = useCallback(async () => {
        try {
            await postAuthLogout();
        } catch {
            // Ignore logout errors
        }
        setAccessToken(null);
        setUser(null);
        toast.info('로그아웃되었습니다.');
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            signup,
            googleLogin,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
