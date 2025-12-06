import { useState, useCallback } from 'react';
import { Event } from '../types/event';
import { eventApi } from '../services/api';

/**
 * 폼 상태 관리 및 CRUD 작업 (등록 책임)
 */
export function useEventForm(loadEvents: () => Promise<void>) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formEvent, setFormEvent] = useState<Event | null>(null);

    const openNew = useCallback(() => {
        setFormEvent(null);
        setIsFormOpen(true);
    }, []);

    const openEdit = useCallback((event: Event) => {
        setFormEvent(event);
        setIsFormOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsFormOpen(false);
        setFormEvent(null);
    }, []);

    const submit = useCallback(async (event: Event) => {
        try {
            if (formEvent?.id) {
                await eventApi.updateEvent(formEvent.id, event);
            } else {
                await eventApi.createEvent(event);
            }
            close();
            await loadEvents();
        } catch (error) {
            console.error('Failed to save event:', error);
            alert('이벤트 저장에 실패했습니다.');
        }
    }, [formEvent, loadEvents, close]);

    const deleteEvent = useCallback(async (id: number) => {
        if (!window.confirm('이벤트를 삭제하시겠습니까?')) return;

        try {
            await eventApi.deleteEvent(id);
            await loadEvents();
        } catch (error) {
            console.error('Failed to delete event:', error);
            alert('이벤트 삭제에 실패했습니다.');
        }
    }, [loadEvents]);

    const switchToEdit = useCallback((eventId: number, events: Event[]) => {
        const eventToEdit = events.find(e => e.id === eventId);
        if (eventToEdit) {
            openEdit(eventToEdit);
        } else {
            console.error(`Event with id ${eventId} not found.`);
        }
    }, [openEdit]);

    return {
        isFormOpen,
        formEvent,
        openNew,
        openEdit,
        close,
        submit,
        deleteEvent,
        switchToEdit
    };
}
