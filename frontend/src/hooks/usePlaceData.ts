import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

export interface Place {
    id: number;
    canonical_name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    google_place_id?: string;
    aliases: string[];
}

export interface PlaceUpdate {
    canonical_name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    google_place_id?: string;
    aliases?: string[];
}

export function usePlaceData() {
    const queryClient = useQueryClient();

    const placesQuery = useQuery<Place[]>({
        queryKey: ['places'],
        queryFn: async () => {
            const { data } = await axios.get(`${API_URL}/places/`);
            return data;
        },
    });

    const updatePlaceMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: PlaceUpdate }) => {
            const response = await axios.put(`${API_URL}/places/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['places'] });
        },
    });

    const createPlaceMutation = useMutation({
        mutationFn: async (data: PlaceUpdate) => {
            const response = await axios.post(`${API_URL}/places/`, {
                canonical_name: data.canonical_name,
                address: data.address,
                latitude: data.latitude,
                longitude: data.longitude,
                google_place_id: data.google_place_id,
                aliases: data.aliases || []
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['places'] });
        },
    });

    const deletePlaceMutation = useMutation({
        mutationFn: async (id: number) => {
            await axios.delete(`${API_URL}/places/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['places'] });
        },
    });

    return {
        places: placesQuery.data || [],
        isLoading: placesQuery.isLoading,
        updatePlace: updatePlaceMutation.mutateAsync,
        createPlace: createPlaceMutation.mutateAsync,
        deletePlace: deletePlaceMutation.mutateAsync,
    };
}
