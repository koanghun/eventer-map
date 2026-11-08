import { create } from 'zustand';
import type { EventSummary } from '../api/generated/model';

export interface MapBounds {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
}

export interface VenueDraftLocation {
    lat: number;
    lng: number;
    address?: string;
    googleMapId?: string;
}

interface EventState {
    selectedEvent: EventSummary | null;
    mapBounds: MapBounds | null;
    mapCenterTarget: { lat: number; lng: number } | null;
    isPickingVenueLocation: boolean;
    venueDraftLocation: VenueDraftLocation | null;
    selectEvent: (event: EventSummary | null) => void;
    clearSelection: () => void;
    setMapBounds: (bounds: MapBounds) => void;
    setMapCenterTarget: (target: { lat: number; lng: number } | null) => void;
    setIsPickingVenueLocation: (picking: boolean) => void;
    setVenueDraftLocation: (location: VenueDraftLocation | null) => void;
}

/**
 * 🎤 이벤트 선택 및 지도 뷰포트(Bounding Box) 클라이언트 상태 관리 저장소
 */
export const useEventStore = create<EventState>((set) => ({
    selectedEvent: null,
    mapBounds: null,
    mapCenterTarget: null,
    isPickingVenueLocation: false,
    venueDraftLocation: null,
    selectEvent: (event) => set({ selectedEvent: event }),
    clearSelection: () => set({ selectedEvent: null }),
    setMapCenterTarget: (target) => set({ mapCenterTarget: target }),
    setIsPickingVenueLocation: (picking) => set({ isPickingVenueLocation: picking }),
    setVenueDraftLocation: (location) => set({ venueDraftLocation: location }),
    setMapBounds: (bounds) =>
        set((state) => {
            if (
                state.mapBounds &&
                state.mapBounds.minLat === bounds.minLat &&
                state.mapBounds.maxLat === bounds.maxLat &&
                state.mapBounds.minLng === bounds.minLng &&
                state.mapBounds.maxLng === bounds.maxLng
            ) {
                return state;
            }
            return { mapBounds: bounds };
        }),
}));
