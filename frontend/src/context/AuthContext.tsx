import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAccessToken } from '../lib/axios';
import { postAuthLogin, postAuthSignup, postAuthSignupVerify, postAuthSignupResend, postAuthGoogle, postAuthXLogin, postAuthLogout, postAuthRefresh } from '../api/generated/auth/auth';
import { getUsersMe, deleteUsersMe } from '../api/generated/user/user';
import { getGetEventsQueryKey } from '../api/generated/events/events';
import { useEventStore } from '../store/useEventStore';
import { toast } from '../store/useToastStore';
import { useTranslation } from 'react-i18next';
import type { UserProfile } from '../api/generated/model';

interface AuthContextType {
    user: UserProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, nickname: string) => Promise<void>;
    verifyEmail: (email: string, code: string) => Promise<void>;
    resendVerification: (email: string) => Promise<void>;
    googleLogin: (idToken: string) => Promise<void>;
    xLogin: (code: string, state: string) => Promise<void>;
    logout: () => Promise<void>;
    deleteAccount: (currentPassword?: string, googleAccessToken?: string, xReauthToken?: string) => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const clearPrivateClientState = useCallback(() => {
        setAccessToken(null);
        setUser(null);
        useEventStore.getState().clearSelection();
        queryClient.removeQueries({
            predicate: (q) => typeof q.queryKey[0] === 'string' && q.queryKey[0].startsWith('/users/me'),
        });
        queryClient.removeQueries({
            queryKey: getGetEventsQueryKey(),
            predicate: (q) => {
                const params = q.queryKey[1] as { myAction?: string; followingArtists?: boolean } | undefined;
                return Boolean(params?.myAction || params?.followingArtists);
            },
        });
    }, [queryClient]);

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
        toast.success(t('auth.loginSuccess', '로그인되었습니다.'));
    }, [fetchUser, t]);

    const signup = useCallback(async (email: string, password: string, nickname: string) => {
        await postAuthSignup({ email, password, nickname });
        toast.success(t('auth.signupSuccess', '인증 코드가 이메일로 발송되었습니다.'));
    }, [t]);

    const verifyEmail = useCallback(async (email: string, code: string) => {
        const res = await postAuthSignupVerify({ email, code });
        setAccessToken(res.accessToken);
        await fetchUser();
        toast.success(t('auth.verifySuccess', '이메일 인증이 완료되었습니다.'));
    }, [fetchUser, t]);

    const resendVerification = useCallback(async (email: string) => {
        await postAuthSignupResend({ email });
        toast.success(t('auth.signupSuccess', '인증 코드가 이메일로 발송되었습니다.'));
    }, [t]);

    const googleLogin = useCallback(async (idToken: string) => {
        const res = await postAuthGoogle({ idToken });
        setAccessToken(res.accessToken);
        await fetchUser();
        toast.success(t('auth.googleLoginSuccess', '구글 로그인 성공!'));
    }, [fetchUser, t]);

    const xLogin = useCallback(async (code: string, state: string) => {
        const res = await postAuthXLogin({ code, state });
        setAccessToken(res.accessToken);
        await fetchUser();
        toast.success(t('auth.xLoginSuccess', 'X 계정으로 로그인되었습니다.'));
    }, [fetchUser, t]);

    const logout = useCallback(async () => {
        try {
            await postAuthLogout();
        } catch {
            // Ignore logout errors
        }
        clearPrivateClientState();
        toast.info(t('auth.logoutSuccess', '로그아웃되었습니다.'));
    }, [clearPrivateClientState, t]);

    const deleteAccount = useCallback(async (currentPassword?: string, googleAccessToken?: string, xReauthToken?: string) => {
        await deleteUsersMe({
            ...(currentPassword ? { currentPassword } : {}),
            ...(googleAccessToken ? { googleAccessToken } : {}),
            ...(xReauthToken ? { xReauthToken } : {}),
        });
        clearPrivateClientState();
        toast.success(t('profile.deleteAccountSuccess', '회원 탈퇴가 완료되었습니다.'));
    }, [clearPrivateClientState, t]);

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            signup,
            verifyEmail,
            resendVerification,
            googleLogin,
            xLogin,
            logout,
            deleteAccount,
            refreshUser: fetchUser,
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
