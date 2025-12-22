import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types/auth';
import axios from 'axios';

// const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (token: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(() =>
        localStorage.getItem('auth_token')
    );
    const [isLoading, setIsLoading] = useState(true);

    const logout = useCallback(() => {
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
    }, []);

    const fetchUser = useCallback(async () => {
        try {
            // 프록시 사용을 위해 상대 경로 사용
            const response = await axios.get(`/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(response.data);
        } catch (error) {
            console.error('Failed to fetch user:', error);
            logout();
        } finally {
            setIsLoading(false);
        }
    }, [token, logout]);

    // OAuth 콜백 처리 (페이지 이동 없이 URL 파라미터 감지)
    useEffect(() => {
        const handleOAuthCallback = () => {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');
            const error = params.get('error');

            // OAuth 파라미터가 없으면 무시
            if (!token && !error) {
                return;
            }

            // 이미 처리한 콜백인지 확인 (중복 처리 방지)
            const processed = sessionStorage.getItem('oauth_processed');
            if (processed === 'true') {
                return;
            }

            if (token) {
                // 토큰 저장 (페이지 이동 없음!)
                localStorage.setItem('auth_token', token);
                setToken(token);

                console.log('OAuth 로그인 성공 (SPA 모드)');

                // URL 정리 (페이지는 그대로, URL만 변경)
                window.history.replaceState({}, document.title, window.location.pathname);

                // 처리 완료 마크
                sessionStorage.setItem('oauth_processed', 'true');
            } else if (error) {
                console.error('OAuth 로그인 실패:', error);
                alert('로그인에 실패했습니다.');

                // URL 정리
                window.history.replaceState({}, document.title, window.location.pathname);

                // 처리 완료 마크
                sessionStorage.setItem('oauth_processed', 'true');
            }
        };

        handleOAuthCallback();

        // 컴포넌트 언마운트 시 처리 완료 플래그 제거
        return () => {
            sessionStorage.removeItem('oauth_processed');
        };
    }, []);

    useEffect(() => {
        if (token) {
            fetchUser();
        } else {
            setIsLoading(false);
        }
    }, [token, fetchUser]);

    const login = useCallback(async (newToken: string) => {
        localStorage.setItem('auth_token', newToken);
        setToken(newToken);
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isAuthenticated: !!user,
            isLoading,
            login,
            logout
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
