import {
    MIN_MAP_ZOOM,
    computeQueryBoundsFromViewport,
    getEventLimitForZoom,
    getGridStepForZoom,
    useEventStore,
} from './useEventStore';

describe('useEventStore viewport optimization', () => {
    beforeEach(() => {
        useEventStore.setState({
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
        });
    });

    it('adjusts query limit and grid step according to zoom level', () => {
        expect(MIN_MAP_ZOOM).toBe(5);

        expect(getEventLimitForZoom(5)).toBe(30);
        expect(getEventLimitForZoom(7)).toBe(30);
        expect(getEventLimitForZoom(8)).toBe(50);
        expect(getEventLimitForZoom(11)).toBe(50);
        expect(getEventLimitForZoom(12)).toBe(80);
        expect(getEventLimitForZoom(16)).toBe(80);

        expect(getGridStepForZoom(5)).toBe(0.2);
        expect(getGridStepForZoom(9)).toBe(0.05);
        expect(getGridStepForZoom(10)).toBe(0.02);
        expect(getGridStepForZoom(12)).toBe(0.005);
        expect(getGridStepForZoom(14)).toBe(0.002);
    });

    it('keeps mapBounds unchanged for small pans within the 15% padded bounds', () => {
        const store = useEventStore.getState();
        const initialViewport = {
            minLat: 35.65,
            maxLat: 35.75,
            minLng: 139.70,
            maxLng: 139.80,
        };

        store.updateViewport(initialViewport, 12);
        const firstMapBounds = useEventStore.getState().mapBounds;
        expect(firstMapBounds).toEqual(computeQueryBoundsFromViewport(initialViewport, 12));
        expect(useEventStore.getState().queryLimit).toBe(80);

        // Small pan (e.g., marker click panTo) still inside the 15% padded box
        const slightlyPannedViewport = {
            minLat: 35.655,
            maxLat: 35.755,
            minLng: 139.705,
            maxLng: 139.805,
        };
        store.updateViewport(slightlyPannedViewport, 12);

        expect(useEventStore.getState().mapBounds).toEqual(firstMapBounds);
        expect(useEventStore.getState().viewportBounds).toEqual(slightlyPannedViewport);
    });

    it('reuses superset bounds and limit when zooming in after hasMore=false', () => {
        const store = useEventStore.getState();
        store.syncViewportFilterKey('2026-11-17|2026-11-17');

        const wideViewport = {
            minLat: 35.50,
            maxLat: 35.90,
            minLng: 139.50,
            maxLng: 139.90,
        };
        store.updateViewport(wideViewport, 10);

        const supersetBounds = useEventStore.getState().mapBounds!;
        const supersetLimit = useEventStore.getState().queryLimit;
        expect(supersetLimit).toBe(50);

        // Server indicates all events in wide bounds are already returned
        store.recordViewportQueryOutcome('2026-11-17|2026-11-17', supersetBounds, supersetLimit, false);

        // Zoom in (zoom 10 -> 14) strictly inside the superset bounds
        const zoomedInViewport = {
            minLat: 35.67,
            maxLat: 35.72,
            minLng: 139.72,
            maxLng: 139.77,
        };
        store.updateViewport(zoomedInViewport, 14);

        expect(useEventStore.getState().mapBounds).toEqual(supersetBounds);
        expect(useEventStore.getState().queryLimit).toBe(supersetLimit);
        expect(useEventStore.getState().viewportBounds).toEqual(zoomedInViewport);
        expect(useEventStore.getState().mapZoom).toBe(14);
    });

    it('fetches narrower bounds with higher limit when zooming in after hasMore=true', () => {
        const store = useEventStore.getState();
        store.syncViewportFilterKey('2026-11-17|2026-11-17');

        const wideViewport = {
            minLat: 35.50,
            maxLat: 35.90,
            minLng: 139.50,
            maxLng: 139.90,
        };
        store.updateViewport(wideViewport, 10);

        const wideBounds = useEventStore.getState().mapBounds!;
        expect(useEventStore.getState().queryLimit).toBe(50);

        // Server indicates more events were truncated
        store.recordViewportQueryOutcome('2026-11-17|2026-11-17', wideBounds, 50, true);

        const zoomedInViewport = {
            minLat: 35.67,
            maxLat: 35.72,
            minLng: 139.72,
            maxLng: 139.77,
        };
        store.updateViewport(zoomedInViewport, 14);

        expect(useEventStore.getState().mapBounds).toEqual(
            computeQueryBoundsFromViewport(zoomedInViewport, 14)
        );
        expect(useEventStore.getState().queryLimit).toBe(80);
    });

    it('clears superset when date filter key changes and clamps zoom below MIN_MAP_ZOOM', () => {
        const store = useEventStore.getState();
        store.syncViewportFilterKey('2026-11-17|2026-11-17');

        const viewport = {
            minLat: 30.0,
            maxLat: 42.0,
            minLng: 130.0,
            maxLng: 145.0,
        };
        store.updateViewport(viewport, 3);
        expect(useEventStore.getState().mapZoom).toBe(MIN_MAP_ZOOM);
        expect(useEventStore.getState().queryLimit).toBe(30);

        const wideBounds = useEventStore.getState().mapBounds!;
        store.recordViewportQueryOutcome('2026-11-17|2026-11-17', wideBounds, 30, false);
        expect(useEventStore.getState().completeSuperset).not.toBeNull();

        store.syncViewportFilterKey('2026-11-18|2026-11-18');
        expect(useEventStore.getState().completeSuperset).toBeNull();
    });
});
