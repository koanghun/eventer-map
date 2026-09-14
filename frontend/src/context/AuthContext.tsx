import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { setAccessToken } from '../lib/axios';
import { postAuthLogin, postAuthSignup, postAuthSignupVerify, postAuthGoogle, postAuthLogout, postAuthRefresh } from '../api/generated/auth/auth';
import { getUsersMe } from '../api/generated/user/user';
import { toast } from '../store/useToastStore';
import type { UserProfile } from '../api/generated/model';

interface AuthContextType {
    user: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, nickname: string) => Promise<void>;
    verifyEmail: (email: string, code: string) => Promise<void>;
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
        toast.success(res.message || '인증 코드가 이메일로 발송되었습니다.');
    }, []);

    const verifyEmail = useCallback(async (email: string, code: string) => {
        const res = await postAuthSignupVerify({ email, code });
        setAccessToken(res.accessToken);
        await fetchUser();
        toast.success('이메일 인증이 완료되었습니다.');
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
            verifyEmail,
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
