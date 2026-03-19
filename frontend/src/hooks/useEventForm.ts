import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Event } from '../types/event';
import { eventApi } from '../services/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * 폼 상태 관리 및 CRUD 작업 (등록 책임)
 * useMutation을 활용하여 CUD 완료 후 자동으로 캐시를 갱신합니다.
 */
export function useEventForm() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
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

    // 🌟 이벤트 생성/수정 Mutation
    const submitMutation = useMutation({
        mutationFn: async (event: Event) => {
            if (formEvent?.id) {
                return eventApi.updateEvent(formEvent.id, event);
            } else {
                return eventApi.createEvent(event);
            }
        },
        onSuccess: () => {
            // 💡 등록/수정 성공 시 'events' 키를 포함하는 모든 캐시를 무효화하여 자동 갱신 유도
            queryClient.invalidateQueries({ queryKey: ['events'] });
            close();
        },
        onError: (error) => {
            console.error('Failed to save event:', error);
            alert(t('hooks.eventForm.saveFailed'));
        }
    });

    // 🌟 이벤트 삭제 Mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            return eventApi.deleteEvent(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
        },
        onError: (error) => {
            console.error('Failed to delete event:', error);
            alert(t('hooks.eventForm.deleteFailed'));
        }
    });

    const submit = useCallback(async (event: Event) => {
        submitMutation.mutate(event);
    }, [submitMutation]);

    const deleteEvent = useCallback(async (id: number) => {
        if (!window.confirm(t('hooks.eventForm.deleteConfirm'))) return;
        deleteMutation.mutate(id);
    }, [deleteMutation, t]);

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
        switchToEdit,
        isSubmitting: submitMutation.isPending, // 💡 필요 시 로딩 상태 지원
    };
}
