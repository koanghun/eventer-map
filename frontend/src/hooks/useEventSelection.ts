import { useState, useCallback } from 'react';
import { Event } from '../types/event';

/**
 * 이벤트 선택 상태 관리 (뷰 책임)
 */
export function useEventSelection() {
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

    const selectEvent = useCallback((event: Event) => {
        setSelectedEvent(event);
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedEvent(null);
    }, []);

    return {
        selectedEvent,
        selectEvent,
        clearSelection
    };
}
