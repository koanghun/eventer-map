import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types/auth';
import api from '../services/api';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    flaggedEventIds: number[];
    logout: () => Promise<void>;
    toggleFlag: (eventId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [flaggedEventIds, setFlaggedEventIds] = useState<number[]>([]);

    const fetchUser = useCallback(async () => {
        try {
            const response = await api.get(`/auth/me`);
            setUser(response.data);
            setFlaggedEventIds(response.data.flagged_event_ids || []);
        } catch (error) {
            // 인증 실패 시 (쿠키가 없거나 만료)
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.post(`/auth/logout`);
        } catch (error) {
            console.error('Logout API failed:', error);
        }
        setUser(null);
        setFlaggedEventIds([]);
    }, []);

    // OAuth 콜백 처리 (URL에 login=success 감지 시)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const loginSuccess = params.get('login');
        const error = params.get('error');

        if (error) {
            console.error('OAuth login failed:', error);
            alert('OAuth login failed.');
            window.history.replaceState({}, document.title, window.location.pathname);
            setIsLoading(false);
            return;
        }

        if (loginSuccess === 'success') {
            // URL 정리 (페이지는 그대로, URL만 변경)
            window.history.replaceState({}, document.title, window.location.pathname);
            // 쿠키가 이미 세팅되어 있으므로 /api/auth/me 호출하여 유저 정보 획득
            fetchUser();
            return;
        }

        // 일반 페이지 로드: 쿠키가 존재하면 유저 정보 가져오기
        fetchUser();
    }, [fetchUser]);

    const toggleFlag = useCallback(async (eventId: number) => {
        if (!user) return;

        // 함수형 업데이트로 최신 상태 참조
        setFlaggedEventIds(prevIds => {
            const isFlagged = prevIds.includes(eventId);
            const method = isFlagged ? 'DELETE' : 'POST';

            // 비동기 API 호출 (상태 업데이트와 분리)
            api({
                method,
                url: `/flags/events/${eventId}`,
            })
                .then(response => {
                    if (response.status === 200) {
                        // API 응답으로 상태 동기화
                        setFlaggedEventIds(response.data.flagged_event_ids);
                    }
                })
                .catch(error => {
                    console.error('Failed to toggle flag:', error);
                    // 에러 시 이전 상태로 롤백
                    return prevIds;
                });

            // 낙관적 업데이트 (즉시 UI 반영)
            return isFlagged
                ? prevIds.filter(id => id !== eventId)
                : [...prevIds, eventId];
        });
    }, [user]);

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            flaggedEventIds,
            logout,
            toggleFlag
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
