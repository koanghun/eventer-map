import axios from 'axios';
import { Event } from '../types/event';

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

export default api;
