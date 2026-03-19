import { useEventStore } from '../store/useEventStore';

/**
 * 이벤트 선택 상태 관리 (뷰 책임)
 * Zustand 스토어의 Selector를 통해 전역 상태로 운용합니다.
 * 하위 컴포넌트 갱신을 순차로 돕기 위해 징검다리 훅 형태로 전환합니다.
 */
export function useEventSelection() {
    const selectedEvent = useEventStore((state) => state.selectedEvent);
    const selectEvent = useEventStore((state) => state.selectEvent);
    const clearSelection = useEventStore((state) => state.clearSelection);

    return {
        selectedEvent,
        selectEvent,
        clearSelection
    };
}
