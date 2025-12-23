import { useState, useCallback, useEffect, useMemo } from 'react';
import { Event } from '../types/event';
import { eventApi } from '../services/api';
import axios from 'axios';

/**
 * 이벤트 데이터 로딩 및 필터링 (검색 책임)
 * 일반 모드와 플래그 모드를 완전히 분리하여 관리
 */
export function useEventData(selectedDate: string, showFlagsOnly: boolean) {
    // 분리된 상태: 일반 모드와 플래그 모드 독립적으로 관리
    const [normalEvents, setNormalEvents] = useState<Event[]>([]);
    const [flaggedEvents, setFlaggedEvents] = useState<Event[]>([]);
    const [selectedPerformer, setSelectedPerformer] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // 일반 모드: 날짜별 이벤트 로딩
    const loadNormalEvents = useCallback(async () => {
        setLoading(true);
        try {
            const data = await eventApi.getEventsByDate(selectedDate);
            setNormalEvents(data);
        } catch (error) {
            console.error('Failed to load normal events:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    // 플래그 모드: 모든 플래그 이벤트 로딩
    const loadFlaggedEvents = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            if (token) {
                const response = await axios.get('/api/flags/events', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setFlaggedEvents(response.data);
            } else {
                setFlaggedEvents([]);
            }
        } catch (error) {
            console.error('Failed to load flagged events:', error);
            setFlaggedEvents([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // 일반 모드: selectedDate 변경 시 로드
    useEffect(() => {
        if (!showFlagsOnly) {
            loadNormalEvents();
        }
    }, [selectedDate, showFlagsOnly, loadNormalEvents]);

    // 플래그 모드: showFlagsOnly가 true로 변경될 때 최초 1회 로드
    useEffect(() => {
        if (showFlagsOnly && flaggedEvents.length === 0) {
            loadFlaggedEvents();
        }
    }, [showFlagsOnly, loadFlaggedEvents, flaggedEvents.length]);

    // 현재 모드에 따라 이벤트 선택
    const currentEvents = showFlagsOnly ? flaggedEvents : normalEvents;

    // 날짜 및 출연자로 필터링 (useMemo로 최적화)
    const filteredEvents = useMemo(() => {
        let filtered = currentEvents;

        // 플래그 모드: 날짜가 선택된 경우에만 클라이언트 측 날짜 필터링 적용
        if (showFlagsOnly && selectedDate && selectedDate.trim() !== '') {
            filtered = filtered.filter(event => event.event_date === selectedDate);
        }

        // 출연자 필터링 (공통)
        if (selectedPerformer) {
            filtered = filtered.filter(event =>
                event.performers?.includes(selectedPerformer)
            );
        }

        return filtered;
    }, [currentEvents, showFlagsOnly, selectedDate, selectedPerformer]);

    return {
        events: currentEvents,
        filteredEvents,
        loading,
        selectedPerformer,
        setSelectedPerformer,
        loadEvents: showFlagsOnly ? loadFlaggedEvents : loadNormalEvents
    };
}
