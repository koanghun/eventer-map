import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types/auth';
import axios from 'axios';

// const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    favoriteEventIds: number[];
    login: (token: string) => Promise<void>;
    logout: () => void;
    toggleFavorite: (eventId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(() =>
        localStorage.getItem('auth_token')
    );
    const [isLoading, setIsLoading] = useState(true);
    const [favoriteEventIds, setFavoriteEventIds] = useState<number[]>([]);

    const logout = useCallback(() => {
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
    }, []);

    const fetchUser = useCallback(async () => {
        try {
            const response = await axios.get(`/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(response.data);
            setFavoriteEventIds(response.data.favorite_event_ids || []); // 즐겨찾기 초기화
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
                // 토큰 저장
                localStorage.setItem('auth_token', token);
                setToken(token);

                // URL에서 사용자 정보 추출 (즉시 로그인 상태 표시)
                const userId = params.get('user_id');
                const userEmail = params.get('user_email');
                const userName = params.get('user_name');
                const userPicture = params.get('user_picture');

                if (userId && userEmail) {
                    // 사용자 정보가 있으면 즉시 설정 (API 호출 불필요!)
                    const userInfo: User = {
                        id: parseInt(userId, 10),
                        email: userEmail,
                        name: userName || null,
                        profile_image: userPicture || null,
                        created_at: new Date().toISOString(), // 임시값 (실제로는 사용 안 함)
                        favorite_event_ids: []  // 초기값 (fetchUser에서 갱신됨)
                    };

                    setUser(userInfo);
                    setIsLoading(false);

                    console.log('OAuth 로그인 성공 (즉시 모드 - API 호출 없음)', userEmail);
                } else {
                    // 사용자 정보가 없으면 기존 방식대로 fetchUser 호출
                    console.log('OAuth 로그인 성공 (기존 모드 - API 호출 필요)');
                }

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

    const toggleFavorite = useCallback(async (eventId: number) => {
        if (!token || !user) return;

        // 함수형 업데이트로 최신 상태 참조
        setFavoriteEventIds(prevIds => {
            const isFavorited = prevIds.includes(eventId);
            const method = isFavorited ? 'DELETE' : 'POST';

            // 비동기 API 호출 (상태 업데이트와 분리)
            axios({
                method,
                url: `/api/favorites/events/${eventId}`,
                headers: { Authorization: `Bearer ${token}` },
            })
                .then(response => {
                    if (response.status === 200) {
                        // API 응답으로 상태 동기화
                        setFavoriteEventIds(response.data.favorite_event_ids);
                    }
                })
                .catch(error => {
                    console.error('Failed to toggle favorite:', error);
                    // 에러 시 이전 상태로 롤백
                    return prevIds;
                });

            // 낙관적 업데이트 (즉시 UI 반영)
            return isFavorited
                ? prevIds.filter(id => id !== eventId)
                : [...prevIds, eventId];
        });
    }, [token, user]); // favoriteEventIds 제거!

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isAuthenticated: !!user,
            isLoading,
            favoriteEventIds,
            login,
            logout,
            toggleFavorite
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
