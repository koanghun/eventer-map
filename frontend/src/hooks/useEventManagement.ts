import { useState, useCallback, useEffect, useMemo } from 'react';
import { Event } from '../types/event';
import { eventApi } from '../services/api';

export function useEventManagement(selectedDate: string) {
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedPerformer, setSelectedPerformer] = useState<string | null>(null);

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

    const handleEventSubmit = async (event: Event) => {
        try {
            if (selectedEvent?.id) {
                await eventApi.updateEvent(selectedEvent.id, event);
            } else {
                await eventApi.createEvent(event);
            }
            handleCloseForm();
            loadEvents();
        } catch (error) {
            console.error('Failed to save event:', error);
            alert('이벤트 저장에 실패했습니다.');
        }
    };

    const handleEventDelete = async (id: number) => {
        if (!window.confirm('이벤트를 삭제하시겠습니까?')) return;

        try {
            await eventApi.deleteEvent(id);
            loadEvents();
            setSelectedEvent(null);
        } catch (error) {
            console.error('Failed to delete event:', error);
            alert('이벤트 삭제에 실패했습니다.');
        }
    };

    const handleNewEvent = () => {
        setSelectedEvent(null);
        setIsFormOpen(true);
    };

    const handleEditEvent = (event: Event) => {
        setSelectedEvent(event);
        setIsFormOpen(true);
    };

    const handleSwitchToEdit = (eventId: number) => {
        const eventToEdit = events.find(e => e.id === eventId);
        if (eventToEdit) {
            setSelectedEvent(eventToEdit);
            setIsFormOpen(true);
        } else {
            console.error(`Event with id ${eventId} not found.`);
        }
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setSelectedEvent(null);
    };

    return {
        // State
        events,
        selectedEvent,
        isFormOpen,
        loading,
        selectedPerformer,
        filteredEvents,

        // Setters
        setSelectedEvent,
        setSelectedPerformer,

        // Handlers
        handleEventSubmit,
        handleEventDelete,
        handleNewEvent,
        handleEditEvent,
        handleSwitchToEdit,
        handleCloseForm,
    };
}
