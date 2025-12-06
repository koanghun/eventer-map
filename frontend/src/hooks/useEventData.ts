import { useState, useCallback, useEffect, useMemo } from 'react';
import { Event } from '../types/event';
import { eventApi } from '../services/api';

/**
 * 이벤트 데이터 로딩 및 필터링 (검색 책임)
 */
export function useEventData(selectedDate: string) {
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedPerformer, setSelectedPerformer] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const loadEvents = useCallback(async () => {
        setLoading(true);
        try {
            const data = await eventApi.getEventsByDate(selectedDate);
            setEvents(data);
        } catch (error) {
            console.error('Failed to load events:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    // 선택된 날짜의 이벤트 로드
    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    // 출연자로 필터링 (useMemo로 최적화)
    const filteredEvents = useMemo(
        () => selectedPerformer
            ? events.filter(event => event.performers?.includes(selectedPerformer))
            : events,
        [events, selectedPerformer]
    );

    return {
        events,
        filteredEvents,
        loading,
        selectedPerformer,
        setSelectedPerformer,
        loadEvents
    };
}
