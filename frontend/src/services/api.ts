import axios from 'axios';
import { Event, Performer, Place } from '../types/event';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

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
};

export const placeApi = {
    // 장소 검색 (DB 캐시)
    searchPlace: async (query: string): Promise<Place> => {
        const response = await api.get<Place>(`/places/search?query=${encodeURIComponent(query)}`);
        return response.data;
    },

    // 장소 생성 (캐시 저장)
    createPlace: async (place: { canonical_name: string; address: string; latitude: number; longitude: number; aliases?: string[] }): Promise<Place> => {
        const response = await api.post<Place>('/places/', place);
        return response.data;
    },

    // 모든 장소 조회
    getAllPlaces: async (): Promise<Place[]> => {
        const response = await api.get<Place[]>('/places/');
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
};

export default api;
export type { DuplicateCheckResponse };
