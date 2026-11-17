import { create } from 'zustand';
import type { EventSummary } from '../api/generated/model';

export const MIN_MAP_ZOOM = 5;
export const VIEWPORT_PADDING_RATIO = 0.15;
export const SUPERSET_STALE_MS = 60 * 1000;

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

export interface CompleteViewportSuperset {
    filterKey: string;
    bounds: MapBounds;
    limit: number;
    timestamp: number;
}

export function getGridStepForZoom(zoom: number): number {
    if (zoom >= 14) return 0.002;
    if (zoom >= 12) return 0.005;
    if (zoom >= 10) return 0.02;
    if (zoom >= 8) return 0.05;
    return 0.2;
}

export function getEventLimitForZoom(zoom: number): number {
    if (zoom <= 7) return 30;
    if (zoom <= 11) return 50;
    return 80;
}

export function isBoundsContained(
    inner: MapBounds,
    outer: MapBounds,
    epsilon = 1e-6
): boolean {
    return (
        inner.minLat >= outer.minLat - epsilon &&
        inner.maxLat <= outer.maxLat + epsilon &&
        inner.minLng >= outer.minLng - epsilon &&
        inner.maxLng <= outer.maxLng + epsilon
    );
}

function roundCoord(value: number): number {
    return Number(value.toFixed(4));
}

export function computeQueryBoundsFromViewport(rawBounds: MapBounds, zoom: number): MapBounds {
    const latSpan = Math.max(0, rawBounds.maxLat - rawBounds.minLat);
    const lngSpan = Math.max(0, rawBounds.maxLng - rawBounds.minLng);
    const padLat = latSpan * VIEWPORT_PADDING_RATIO;
    const padLng = lngSpan * VIEWPORT_PADDING_RATIO;
    const step = getGridStepForZoom(zoom);

    const minLat = roundCoord(Math.max(-90, Math.floor((rawBounds.minLat - padLat) / step) * step));
    const maxLat = roundCoord(Math.min(90, Math.ceil((rawBounds.maxLat + padLat) / step) * step));
    const minLng = roundCoord(Math.max(-180, Math.floor((rawBounds.minLng - padLng) / step) * step));
    const maxLng = roundCoord(Math.min(180, Math.ceil((rawBounds.maxLng + padLng) / step) * step));

    return { minLat, maxLat, minLng, maxLng };
}

function isSameBounds(a: MapBounds | null, b: MapBounds | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
        a.minLat === b.minLat &&
        a.maxLat === b.maxLat &&
        a.minLng === b.minLng &&
        a.maxLng === b.maxLng
    );
}

interface EventState {
    selectedEvent: EventSummary | null;
    mapBounds: MapBounds | null;
    viewportBounds: MapBounds | null;
    mapZoom: number;
    queryLimit: number;
    activeFilterKey: string;
    completeSuperset: CompleteViewportSuperset | null;
    mapCenterTarget: { lat: number; lng: number } | null;
    isPickingVenueLocation: boolean;
    venueDraftLocation: VenueDraftLocation | null;
    selectEvent: (event: EventSummary | null) => void;
    clearSelection: () => void;
    setMapBounds: (bounds: MapBounds) => void;
    updateViewport: (rawViewport: MapBounds, zoom: number) => void;
    recordViewportQueryOutcome: (
        filterKey: string,
        bounds: MapBounds,
        limit: number,
        hasMore: boolean
    ) => void;
    syncViewportFilterKey: (filterKey: string) => void;
    clearViewportSuperset: () => void;
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
    viewportBounds: null,
    mapZoom: 12,
    queryLimit: getEventLimitForZoom(12),
    activeFilterKey: '',
    completeSuperset: null,
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
                if (isSameBounds(state.mapBounds, bounds)) {
                    return state;
                }
                return { mapBounds: bounds };
            }),
    updateViewport: (rawViewport, zoom) =>
        set((state) => {
            const clampedZoom = Math.max(MIN_MAP_ZOOM, zoom);
            const candidateBounds = computeQueryBoundsFromViewport(rawViewport, clampedZoom);
            const candidateLimit = getEventLimitForZoom(clampedZoom);

            const supersetValid = Boolean(
                state.completeSuperset &&
                state.completeSuperset.filterKey === state.activeFilterKey &&
                Date.now() - state.completeSuperset.timestamp < SUPERSET_STALE_MS &&
                isBoundsContained(rawViewport, state.completeSuperset.bounds)
            );

            if (supersetValid && state.completeSuperset) {
                const unchangedViewport =
                    isSameBounds(state.viewportBounds, rawViewport) &&
                    state.mapZoom === clampedZoom &&
                    isSameBounds(state.mapBounds, state.completeSuperset.bounds) &&
                    state.queryLimit === state.completeSuperset.limit;
                if (unchangedViewport) {
                    return state;
                }
                return {
                    viewportBounds: rawViewport,
                    mapZoom: clampedZoom,
                    mapBounds: state.completeSuperset.bounds,
                    queryLimit: state.completeSuperset.limit,
                };
            }

            const withinPaddedBounds = Boolean(
                state.mapBounds &&
                state.queryLimit === candidateLimit &&
                isBoundsContained(rawViewport, state.mapBounds)
            );

            if (withinPaddedBounds) {
                if (isSameBounds(state.viewportBounds, rawViewport) && state.mapZoom === clampedZoom) {
                    return state;
                }
                return {
                    viewportBounds: rawViewport,
                    mapZoom: clampedZoom,
                };
            }

            const unchangedAll =
                isSameBounds(state.viewportBounds, rawViewport) &&
                state.mapZoom === clampedZoom &&
                isSameBounds(state.mapBounds, candidateBounds) &&
                state.queryLimit === candidateLimit;
            if (unchangedAll) {
                return state;
            }

            return {
                viewportBounds: rawViewport,
                mapZoom: clampedZoom,
                mapBounds: candidateBounds,
                queryLimit: candidateLimit,
            };
        }),
    recordViewportQueryOutcome: (filterKey, bounds, limit, hasMore) =>
        set((state) => {
            if (filterKey !== state.activeFilterKey) {
                return state;
            }
            const now = Date.now();
            const existingValid = Boolean(
                state.completeSuperset &&
                state.completeSuperset.filterKey === filterKey &&
                now - state.completeSuperset.timestamp < SUPERSET_STALE_MS &&
                isBoundsContained(bounds, state.completeSuperset.bounds)
            );

            if (!hasMore) {
                if (existingValid) {
                    return state;
                }
                return {
                    completeSuperset: {
                        filterKey,
                        bounds,
                        limit,
                        timestamp: now,
                    },
                };
            }

            if (existingValid || state.completeSuperset === null) {
                return state;
            }
            return { completeSuperset: null };
        }),
    syncViewportFilterKey: (filterKey) =>
        set((state) => {
            if (state.activeFilterKey === filterKey) {
                return state;
            }
            if (!state.viewportBounds) {
                return {
                    activeFilterKey: filterKey,
                    completeSuperset: null,
                };
            }
            return {
                activeFilterKey: filterKey,
                completeSuperset: null,
                mapBounds: computeQueryBoundsFromViewport(state.viewportBounds, state.mapZoom),
                queryLimit: getEventLimitForZoom(state.mapZoom),
            };
        }),
    clearViewportSuperset: () =>
        set((state) => (state.completeSuperset === null ? state : { completeSuperset: null })),
}));
