import { useState, useMemo } from 'react';
import { Event } from '../types/event';
import api, { eventApi } from '../services/api';
import { useQuery } from '@tanstack/react-query';

/**
 * 이벤트 데이터 로딩 및 필터링 (검색 책임)
 * TanStack Query를 도입하여 로딩 상태와 자동 캐싱을 위임합니다.
 */
export function useEventData(selectedDate: string, showFlagsOnly: boolean) {
    const [selectedPerformer, setSelectedPerformer] = useState<string | null>(null);

    // 🌟 useQuery 로 통합된 서버 상태 관리
    const { data: events = [], isLoading: loading, refetch } = useQuery<Event[]>({
        queryKey: ['events', selectedDate, showFlagsOnly],
        queryFn: async () => {
            if (showFlagsOnly) {
                    const response = await api.get('/flags/events');
                    return response.data;
            }
            return eventApi.getEventsByDate(selectedDate);
        },
        staleTime: 1000 * 60 * 5, // 💡 5분간 캐시 신선도 유지 (불필요한 호출 방지)
    });

    // 날짜 및 출연자로 필터링 (useMemo로 최적화)
    const filteredEvents = useMemo(() => {
        let filtered = events;

        // 플래그 모드: 날짜가 선택된 경우에만 클라이언트 측 날짜 필터링 적용
        if (showFlagsOnly && selectedDate && selectedDate.trim() !== '') {
            filtered = filtered.filter(event => event.event_date === selectedDate);
        }

        // 출연자 필터링 (공통)
        if (selectedPerformer) {
            filtered = filtered.filter(event =>
                (event.performers_list as any[])?.some((p: any) => p.canonical_name === selectedPerformer) ?? false
            );
        }

        return filtered;
    }, [events, showFlagsOnly, selectedDate, selectedPerformer]);

    return {
        events,
        filteredEvents,
        loading,
        selectedPerformer,
        setSelectedPerformer,
        loadEvents: refetch // 💡 CUD 작업 후 갱신(리프레시) 지원용
    };
}
