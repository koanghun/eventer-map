import { create } from 'zustand';
import { Event } from '../types/event';

interface EventState {
    selectedEvent: Event | null;
    selectEvent: (event: Event | null) => void;
    clearSelection: () => void;
}

/**
 * 🎤 이벤트 선택 및 마커 전역 상태 관리 저장소
 */
export const useEventStore = create<EventState>((set) => ({
    selectedEvent: null,
    selectEvent: (event) => set({ selectedEvent: event }),
    clearSelection: () => set({ selectedEvent: null }),
}));
