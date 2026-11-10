import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { GoogleMap, Marker, OverlayView } from '@react-google-maps/api';

import { useTheme } from '../../context/ThemeContext';
import SingleEventInfoWindow from './SingleEventInfoWindow';
import GroupEventInfoWindow from './GroupEventInfoWindow';
import { useEventStore } from '../../store/useEventStore';
import type { EventSummary } from '../../api/generated/model';

interface EventMapProps {
    events: EventSummary[];
    onArtistSelect?: (artist: { id: string; name: string }) => void;
    onVenueSelect?: (venue: { id: string; name: string; lat?: number; lng?: number }) => void;
}

type InfoWindowState =
    | { type: 'single'; event: EventSummary }
    | { type: 'group'; events: EventSummary[]; location: { lat: number; lng: number } };

/**
 * 참가자 수(attendeeCount)에 따라 마커 원형 아이콘의 크기(px)를 계산
 * 기본 42px에서 시작하여 참가자 수에 따라 로그 스케일로 최대 76px까지 커지는 기믹 적용
 */
function getMarkerSize(attendeeCount: number = 0): number {
    const count = Math.max(0, attendeeCount);
    const scale = Math.min(34, Math.round(Math.log2(count + 1) * 7));
    return 42 + scale;
}

/**
 * 이름 문자열을 기반으로 일관된 배경 그라데이션 색상을 반환
 */
const AVATAR_GRADIENTS = [
    'from-orange-500 to-amber-500',
    'from-rose-500 to-pink-500',
    'from-violet-600 to-indigo-500',
    'from-emerald-500 to-teal-500',
    'from-sky-500 to-blue-600',
    'from-fuchsia-500 to-purple-600',
];

function getAvatarGradient(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function getInitials(name?: string): string {
    const trimmed = (name || '').trim();
    if (!trimmed) return '🎤';
    return Array.from(trimmed).slice(0, 2).join('').toUpperCase();
}

interface EventAvatarMarkerProps {
    representativeEvent: EventSummary;
    eventCount: number;
    isSelected: boolean;
    onClick: () => void;
}

function EventAvatarMarker({
    representativeEvent,
    eventCount,
    isSelected,
    onClick,
}: EventAvatarMarkerProps) {
    const [imgError, setImgError] = useState(false);

    const attendeeCount = representativeEvent.attendeeCount ?? 0;
    const size = getMarkerSize(attendeeCount);
    const profileUrl = representativeEvent.topArtistProfileImageUrl;
    const displayName = representativeEvent.topArtistName || representativeEvent.title || '';
    const initials = getInitials(displayName);
    const gradientClass = getAvatarGradient(displayName);
    const isGrouped = eventCount > 1;

    useEffect(() => {
        setImgError(false);
    }, [profileUrl]);

    const fontSize = Math.max(11, Math.round(size * 0.32));

    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            style={{
                width: `${size}px`,
                height: `${size}px`,
            }}
            title={
                representativeEvent.topArtistName
                    ? `${representativeEvent.title} (${representativeEvent.topArtistName})`
                    : representativeEvent.title
            }
            className={`group relative -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center cursor-pointer select-none transition-transform duration-200 hover:scale-110 hover:z-40 focus:outline-none ${isSelected
                ? 'ring-4 ring-primary ring-offset-2 ring-offset-background scale-110 z-30 shadow-xl'
                : isGrouped
                    ? 'ring-[3px] ring-purple-500 shadow-lg z-20'
                    : 'ring-[3px] ring-white dark:ring-slate-800 shadow-lg z-10'
                }`}
        >
            <div
                className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br ${gradientClass} text-white font-extrabold tracking-tight`}
            >
                {profileUrl && !imgError ? (
                    <img
                        src={profileUrl}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                        draggable={false}
                    />
                ) : (
                    <span
                        style={{ fontSize: `${fontSize}px` }}
                        className="leading-none px-1 truncate max-w-full drop-shadow-sm"
                    >
                        {initials}
                    </span>
                )}
            </div>

            {/* 복수 이벤트가 동일 위치에 있을 때 우측 상단 배지 */}
            {isGrouped && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-purple-600 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm">
                    +{eventCount - 1}
                </span>
            )}

            {/* 참가자가 1명 이상일 때 하단 참가자 수 캡슐 배지 */}
            {attendeeCount > 0 && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-slate-900/90 text-white text-[10px] font-semibold leading-tight border border-white/40 shadow-sm whitespace-nowrap">
                    👥 {attendeeCount}
                </span>
            )}
        </button>
    );
}

/** 클러스터링 그리드 한 칸의 크기(px). 이 안에 들어오는 마커끼리 병합 */
const CLUSTER_GRID_PX = 70;
/** 이 줌 레벨 이상에서는 클러스터링하지 않음 (동일 좌표 그룹핑만 유지) */
const CLUSTER_MAX_ZOOM = 17;

interface MapCluster {
    key: string;
    lat: number;
    lng: number;
    members: { coordKey: string; events: any[]; lat: number; lng: number }[];
}

function EventClusterMarker({ count, onClick }: { count: number; onClick: () => void }) {
    const size = Math.min(72, 44 + String(count).length * 8);
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            style={{ width: `${size}px`, height: `${size}px` }}
            title={`${count}개의 이벤트`}
            className="-translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-extrabold text-sm flex items-center justify-center ring-[4px] ring-purple-300/60 border-2 border-white dark:border-slate-800 shadow-xl cursor-pointer select-none transition-transform duration-200 hover:scale-110 hover:z-40 focus:outline-none z-20"
        >
            {count}
        </button>
    );
}

const mapContainerStyle = {
    width: '100%',
    height: '100%',
};

const defaultCenter = {
    lat: 35.6762,
    lng: 139.6503,
};

// 기본적으로 숨길 레이어 (POI, 대중교통, 도로 아이콘 등)
const baseMapStyles = [
    {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }],
    },
    {
        featureType: "road",
        elementType: "labels.icon",
        stylers: [{ visibility: "off" }],
    },
];

const mapStyles = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#263c3f" }],
    },
    {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#6b9a76" }],
    },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
    },
    {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }],
    },
    {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }],
    },
    {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#2f3948" }],
    },
    {
        featureType: "transit.station",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
    },
    {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
    },
    {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }],
    },
];

function EventMap({ events, onArtistSelect, onVenueSelect }: EventMapProps) {
    const { theme } = useTheme();

    const selectedEvent = useEventStore((state) => state.selectedEvent);
    const selectEvent = useEventStore((state) => state.selectEvent);
    const clearSelection = useEventStore((state) => state.clearSelection);
    const setMapBounds = useEventStore((state) => state.setMapBounds);
    const mapCenterTarget = useEventStore((state) => state.mapCenterTarget);
    const isPickingVenueLocation = useEventStore((state) => state.isPickingVenueLocation);
    const venueDraftLocation = useEventStore((state) => state.venueDraftLocation);
    const setVenueDraftLocation = useEventStore((state) => state.setVenueDraftLocation);

    const mapRef = useRef<google.maps.Map | null>(null);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [infoWindowStack, setInfoWindowStack] = useState<InfoWindowState | null>(null);
    const [center, setCenter] = useState<{ lat: number; lng: number }>(defaultCenter);
    const [zoom, setZoom] = useState(12);

    const updateBoundsFromMap = useCallback(() => {
        if (!mapRef.current) return;
        const bounds = mapRef.current.getBounds();
        if (!bounds) return;

        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        // 소수점 3자리(~110m 단위)로 반올림하여 미세한 지도 흔들림으로 인한 불필요한 API 재호출을 방지하고 캐시 적중률을 높임
        const minLat = Math.floor(sw.lat() * 1000) / 1000;
        const maxLat = Math.ceil(ne.lat() * 1000) / 1000;
        const minLng = Math.floor(sw.lng() * 1000) / 1000;
        const maxLng = Math.ceil(ne.lng() * 1000) / 1000;

        setMapBounds({ minLat, maxLat, minLng, maxLng });
    }, [setMapBounds]);

    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        updateBoundsFromMap();
    }, [updateBoundsFromMap]);

    const onMapIdle = useCallback(() => {
        const currentZoom = mapRef.current?.getZoom();
        if (currentZoom !== undefined) setZoom(currentZoom);
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
        }
        // 드래그/줌 종료(Idle) 후 300ms 디바운스를 적용해 AWS Lambda 및 DS920+ NAS DB 호출 횟수를 최소화
        idleTimerRef.current = setTimeout(() => {
            updateBoundsFromMap();
        }, 300);
    }, [updateBoundsFromMap]);

    useEffect(() => {
        return () => {
            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (selectedEvent && mapRef.current) {
            const ev = selectedEvent as any;
            const lat = ev.place?.latitude ?? ev.latitude;
            const lng = ev.place?.longitude ?? ev.longitude;
            if (lat !== undefined && lng !== undefined) {
                mapRef.current.panTo({ lat, lng });
            }
        }
    }, [selectedEvent]);

    useEffect(() => {
        if (venueDraftLocation && mapRef.current) {
            mapRef.current.panTo({ lat: venueDraftLocation.lat, lng: venueDraftLocation.lng });
        }
    }, [venueDraftLocation]);

    useEffect(() => {
        if (mapCenterTarget && mapRef.current) {
            mapRef.current.panTo({ lat: mapCenterTarget.lat, lng: mapCenterTarget.lng });
            updateBoundsFromMap();
        }
    }, [mapCenterTarget, updateBoundsFromMap]);

    const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (!isPickingVenueLocation || !e.latLng) return;

        const lat = Number(e.latLng.lat().toFixed(6));
        const lng = Number(e.latLng.lng().toFixed(6));

        const fallbackReverseGeocode = async () => {
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
                );
                if (res.ok) {
                    const data = await res.json();
                    if (data && typeof data.display_name === 'string') {
                        setVenueDraftLocation({ lat, lng, address: data.display_name });
                        return;
                    }
                }
            } catch {
                // Ignore network errors
            }
            setVenueDraftLocation({ lat, lng });
        };

        if (window.google?.maps?.Geocoder) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    setVenueDraftLocation({
                        lat,
                        lng,
                        address: results[0].formatted_address,
                        googleMapId: results[0].place_id,
                    });
                } else {
                    fallbackReverseGeocode();
                }
            });
        } else {
            fallbackReverseGeocode();
        }
    }, [isPickingVenueLocation, setVenueDraftLocation]);

    useEffect(() => {
        const fetchLocation = async () => {
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setCenter({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        });
                    },
                    async (error) => {
                        console.log('GPS Geolocation failed, trying IP...', error);
                        try {
                            const response = await fetch('https://ipapi.co/json/');
                            const data = await response.json();
                            if (data.latitude && data.longitude) {
                                setCenter({ lat: data.latitude, lng: data.longitude });
                            }
                        } catch (ipError) {
                            console.error('IP Location failed too:', ipError);
                        }
                    }
                );
            }
        };
        fetchLocation();
    }, []);

    const eventGroups = useMemo(() => {
        const groups = new Map<string, any[]>();

        events.forEach(event => {
            const ev = event as any;
            const lat = ev.latitude ?? ev.place?.latitude;
            const lng = ev.longitude ?? ev.place?.longitude;
            if (lat === undefined || lng === undefined || (lat === 0 && lng === 0)) {
                return;
            }
            const key = `${lat},${lng}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(event);
        });

        // 동일 좌표에 복수의 이벤트가 있을 때 참가자 수(attendeeCount)가 가장 많은 이벤트가 맨 앞(대표)에 오도록 정렬
        groups.forEach((groupEvents) => {
            groupEvents.sort((a, b) => {
                const countDiff = (b.attendeeCount ?? 0) - (a.attendeeCount ?? 0);
                if (countDiff !== 0) return countDiff;
                const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
                const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
                return timeA - timeB;
            });
        });

        return groups;
    }, [events]);

    // 줌 레벨에 따라 화면상 가까운 좌표 그룹들을 하나의 클러스터로 병합 (픽셀 그리드 기반)
    const clusters = useMemo(() => {
        const cells = new Map<string, MapCluster>();
        const worldSize = 256 * Math.pow(2, zoom);

        eventGroups.forEach((groupEvents, coordKey) => {
            const first = groupEvents[0];
            const lat = first.place?.latitude ?? first.latitude ?? 0;
            const lng = first.place?.longitude ?? first.longitude ?? 0;

            let cellKey = coordKey;
            if (zoom < CLUSTER_MAX_ZOOM) {
                const sinLat = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
                const px = ((lng + 180) / 360) * worldSize;
                const py = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize;
                cellKey = `${Math.floor(px / CLUSTER_GRID_PX)}:${Math.floor(py / CLUSTER_GRID_PX)}`;
            }

            const member = { coordKey, events: groupEvents, lat, lng };
            const existing = cells.get(cellKey);
            if (existing) {
                existing.members.push(member);
            } else {
                cells.set(cellKey, { key: cellKey, lat, lng, members: [member] });
            }
        });

        cells.forEach((cluster) => {
            if (cluster.members.length > 1) {
                cluster.lat = cluster.members.reduce((s, m) => s + m.lat, 0) / cluster.members.length;
                cluster.lng = cluster.members.reduce((s, m) => s + m.lng, 0) / cluster.members.length;
            }
        });

        return Array.from(cells.values());
    }, [eventGroups, zoom]);

    const handleClusterClick = (cluster: MapCluster) => {
        const map = mapRef.current;
        if (!map) return;
        setInfoWindowStack(null);
        const bounds = new google.maps.LatLngBounds();
        cluster.members.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
        map.fitBounds(bounds, 80);
    };

    const handleMarkerClick = (eventsAtLocation: any[]) => {
        if (eventsAtLocation.length === 1) {
            setInfoWindowStack(null);
            selectEvent(eventsAtLocation[0]);
        } else {
            const firstEvent = eventsAtLocation[0];
            const location = {
                lat: firstEvent.latitude ?? firstEvent.place?.latitude ?? 0,
                lng: firstEvent.longitude ?? firstEvent.place?.longitude ?? 0
            };
            setInfoWindowStack({ type: 'group', events: eventsAtLocation, location });
            clearSelection();

            if (mapRef.current) {
                mapRef.current.panTo(location);
            }
        }
    };

    const handleEventSelectFromGroup = (event: any) => {
        setInfoWindowStack(null);
        selectEvent(event);
    };

    const handleInfoWindowClose = () => {
        if (infoWindowStack?.type === 'group') {
            setInfoWindowStack(null);
        } else {
            clearSelection();
        }
    };

    const renderInfoWindow = () => {
        if (infoWindowStack?.type === 'group') {
            const { events: groupEvents, location } = infoWindowStack;
            const topEvent = groupEvents[0] as any;
            const offsetPx = Math.round(getMarkerSize(topEvent?.attendeeCount ?? 0) / 2) + 10;
            return (
                <GroupEventInfoWindow
                    events={groupEvents}
                    location={location}
                    locationName={topEvent.venueName ?? topEvent.place?.canonical_name ?? topEvent.location ?? ''}
                    offsetPx={offsetPx}
                    onClose={handleInfoWindowClose}
                    onEventSelect={handleEventSelectFromGroup}
                    onVenueSelect={
                        onVenueSelect
                            ? (venue) => {
                                setInfoWindowStack(null);
                                onVenueSelect(venue);
                            }
                            : undefined
                    }
                />
            );
        }

        if (!selectedEvent) return null;

        const lat = (selectedEvent as any).latitude ?? (selectedEvent as any).place?.latitude;
        const lng = (selectedEvent as any).longitude ?? (selectedEvent as any).place?.longitude;
        if (lat === undefined || lng === undefined) return null;

        const offsetPx = Math.round(getMarkerSize(selectedEvent.attendeeCount ?? 0) / 2) + 10;

        return (
            <SingleEventInfoWindow
                event={selectedEvent}
                position={{ lat, lng }}
                offsetPx={offsetPx}
                onClose={handleInfoWindowClose}
                onArtistSelect={
                    onArtistSelect
                        ? (artist) => {
                            setInfoWindowStack(null);
                            onArtistSelect(artist);
                        }
                        : undefined
                }
                onVenueSelect={
                    onVenueSelect
                        ? (venue) => {
                            setInfoWindowStack(null);
                            onVenueSelect(venue);
                        }
                        : undefined
                }
            />
        );
    };

    return (
        <div className="w-full h-full relative z-0">
            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={center}
                zoom={12}
                onLoad={onMapLoad}
                onIdle={onMapIdle}
                onClick={handleMapClick}
                options={{
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: true,
                    draggableCursor: isPickingVenueLocation ? 'crosshair' : undefined,
                    styles: [
                        ...baseMapStyles,
                        ...(theme === 'dark' ? mapStyles : [])
                    ],
                }}
            >
                {isPickingVenueLocation && venueDraftLocation && (
                    <Marker
                        position={{ lat: venueDraftLocation.lat, lng: venueDraftLocation.lng }}
                    />
                )}
                    {
                        clusters.map((cluster) => {
                            if (cluster.members.length > 1) {
                                const totalEvents = cluster.members.reduce((sum, m) => sum + m.events.length, 0);
                                return (
                                    <OverlayView
                                        key={`cluster-${cluster.key}`}
                                        position={{ lat: cluster.lat, lng: cluster.lng }}
                                        mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                                    >
                                        <EventClusterMarker
                                            count={totalEvents}
                                            onClick={() => handleClusterClick(cluster)}
                                        />
                                    </OverlayView>
                                );
                            }

                            const { coordKey, events: eventsAtLocation } = cluster.members[0];
                            const representativeEvent = eventsAtLocation[0];
                            const lat = representativeEvent.place?.latitude ?? representativeEvent.latitude ?? 0;
                            const lng = representativeEvent.place?.longitude ?? representativeEvent.longitude ?? 0;

                            const isSelected = Boolean(
                                (selectedEvent && eventsAtLocation.some((e) => e.id === selectedEvent.id)) ||
                                (infoWindowStack?.type === 'group' &&
                                    infoWindowStack.location.lat === lat &&
                                    infoWindowStack.location.lng === lng)
                            );

                            return (
                                <OverlayView
                                    key={coordKey}
                                    position={{ lat, lng }}
                                    mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                                >
                                    <EventAvatarMarker
                                        representativeEvent={representativeEvent}
                                        eventCount={eventsAtLocation.length}
                                        isSelected={isSelected}
                                        onClick={() => handleMarkerClick(eventsAtLocation)}
                                    />
                                </OverlayView>
                            );
                        })
                    }

                    { renderInfoWindow() }
                </GoogleMap>
        </div>
    );
}

export default EventMap;
