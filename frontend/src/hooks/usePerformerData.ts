import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

export interface Performer {
    id: number;
    canonical_name: str;
    normalized_name: str;
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
            const { data } = await axios.get(`${API_URL}/performers/`);
            return data;
        },
    });

    const updatePerformerMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: PerformerUpdate }) => {
            const response = await axios.put(`${API_URL}/performers/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['performers'] });
        },
    });

    const createPerformerMutation = useMutation({
        mutationFn: async (data: PerformerUpdate) => {
            const response = await axios.post(`${API_URL}/performers/`, {
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
            await axios.delete(`${API_URL}/performers/${id}`);
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
