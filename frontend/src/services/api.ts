import axios from 'axios';
import { Event, Performer, Place, EventReportResponse } from '../types/event';

// 프로덕션: nginx 프록시를 통해 /api -> http://backend:8000
// 개발: 환경 변수로 백엔드 URL 지정 가능
const API_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 401 에러 시 자동 로그아웃
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const isAuthCheck = error.config?.url === '/auth/me';
            const isHomePage = window.location.pathname === '/';
            
            if (!isAuthCheck && !isHomePage) {
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

export const eventApi = {
    // 모든 이벤트 조회
    getAllEvents: async (): Promise<Event[]> => {
        const response = await api.get<Event[]>('/events/');
        return response.data;
    },

    // 특정 날짜의 이벤트 조회
    getEventsByDate: async (date: string): Promise<Event[]> => {
        const response = await api.get<Event[]>(`/events/by-date/${date}`);
        return response.data;
    },

    // 특정 이벤트 조회
    getEvent: async (id: number): Promise<Event> => {
        const response = await api.get<Event>(`/events/${id}`);
        return response.data;
    },

    // 이벤트 생성
    createEvent: async (event: Omit<Event, 'id' | 'created_at' | 'updated_at'>): Promise<Event> => {
        const response = await api.post<Event>('/events/', event);
        return response.data;
    },

    // 이벤트 수정
    updateEvent: async (id: number, event: Partial<Event>): Promise<Event> => {
        const response = await api.put<Event>(`/events/${id}`, event);
        return response.data;
    },

    // 이벤트 삭제
    deleteEvent: async (id: number): Promise<void> => {
        await api.delete(`/events/${id}`);
    },

    // 이벤트 중복 체크
    checkDuplicate: async (eventData: Partial<Event>): Promise<any> => {
        const response = await api.post('/events/check-duplicate', eventData);
        return response.data;
    },

    // 이벤트 히스토리 조회
    getHistory: async (eventId: number): Promise<any[]> => {
        const response = await api.get(`/events/${eventId}/history`);
        return response.data;
    },

    // 이벤트 신고
    reportEvent: async (eventId: number, reportData: { reason: string; description?: string }): Promise<void> => {
        await api.post(`/events/${eventId}/report`, reportData);
    },

    // 이벤트 신고 내역 조회 (관리자 전용)
    getEventReports: async (eventId: number): Promise<EventReportResponse[]> => {
        const response = await api.get<EventReportResponse[]>(`/events/${eventId}/reports`);
        return response.data;
    },
};

export const placeApi = {
    // 장소 검색 (DB 캐시)
    searchPlace: async (query: string): Promise<Place> => {
        const response = await api.get<Place>(`/places/search?query=${encodeURIComponent(query)}`);
        return response.data;
    },

    // 장소 생성 (캐시 저장)
    createPlace: async (place: { canonical_name: string; address: string; latitude: number; longitude: number; google_place_id?: string; aliases?: string[] }): Promise<Place> => {
        const response = await api.post<Place>('/places/', place);
        return response.data;
    },

    // 모든 장소 조회
    getAllPlaces: async (): Promise<Place[]> => {
        const response = await api.get<Place[]>('/places/');
        return response.data;
    },

    // 장소 자동완성 검색 (부분 일치 지원)
    suggestPlaces: async (query: string, limit: number = 10): Promise<Place[]> => {
        const response = await api.get<Place[]>(`/places/suggest?query=${encodeURIComponent(query)}&limit=${limit}`);
        return response.data;
    },
};

interface DuplicateCheckResponse {
    status: 'duplicate' | 'similar_found' | 'no_duplicate';
    exact_match?: Performer | null;
    similar_matches?: Performer[];
}

export const performerApi = {
    // 모든 출연자 조회
    getAllPerformers: async (): Promise<Performer[]> => {
        const response = await api.get<Performer[]>('/performers/');
        return response.data;
    },

    // 출연자 검색
    searchPerformers: async (query: string): Promise<Performer[]> => {
        const response = await api.get<Performer[]>(`/performers/search?query=${encodeURIComponent(query)}`);
        return response.data;
    },

    // 중복 체크
    checkDuplicate: async (name: string): Promise<DuplicateCheckResponse> => {
        const response = await api.get<DuplicateCheckResponse>(`/performers/check-duplicate?name=${encodeURIComponent(name)}`);
        return response.data;
    },

    // 출연자 생성
    createPerformer: async (performer: { canonical_name: string; aliases?: string[] }): Promise<Performer> => {
        const response = await api.post<Performer>('/performers/', performer);
        return response.data;
    },

    // 출연자 자동완성 검색 (부분 일치 지원)
    suggestPerformers: async (query: string, limit: number = 10): Promise<Performer[]> => {
        const response = await api.get<Performer[]>(`/performers/suggest?query=${encodeURIComponent(query)}&limit=${limit}`);
        return response.data;
    },
};

export default api;
export type { DuplicateCheckResponse };
