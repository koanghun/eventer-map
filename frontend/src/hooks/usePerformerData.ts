import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';


export interface Performer {
    id: number;
    canonical_name: string;
    normalized_name: string;
    aliases: string[];
    created_at: string;
}

export interface PerformerUpdate {
    canonical_name?: string;
    aliases?: string[];
}

export function usePerformerData() {
    const queryClient = useQueryClient();

    const performersQuery = useQuery<Performer[]>({
        queryKey: ['performers'],
        queryFn: async () => {
            const { data } = await api.get('/performers/');
            return data;
        },
    });

    const updatePerformerMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: PerformerUpdate }) => {
            const response = await api.put(`/performers/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['performers'] });
        },
    });

    const createPerformerMutation = useMutation({
        mutationFn: async (data: PerformerUpdate) => {
            const response = await api.post('/performers/', {
                canonical_name: data.canonical_name,
                aliases: data.aliases || []
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['performers'] });
        },
    });

    const deletePerformerMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/performers/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['performers'] });
        },
    });

    return {
        performers: performersQuery.data || [],
        isLoading: performersQuery.isLoading,
        updatePerformer: updatePerformerMutation.mutateAsync,
        createPerformer: createPerformerMutation.mutateAsync,
        deletePerformer: deletePerformerMutation.mutateAsync,
    };
}
