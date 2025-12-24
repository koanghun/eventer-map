import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { Event } from '../types/event';
import styles from './EventMap.module.css';
import { useTheme } from '../context/ThemeContext';
import SingleEventInfoWindow from './map/SingleEventInfoWindow';
import GroupEventInfoWindow from './map/GroupEventInfoWindow';

interface EventMapProps {
    events: Event[];
    selectedEvent: Event | null;
    onMarkerClick: (event: Event) => void;
    onInfoWindowClose: () => void;
}

type InfoWindowState =
    | { type: 'single'; event: Event }
    | { type: 'group'; events: Event[]; location: { lat: number; lng: number } };

const mapContainerStyle = {
    width: '100%',
    height: '100%',
};

const defaultCenter = {
    lat: 35.6762,
    lng: 139.6503,
};

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
        featureType: "poi",
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

function EventMap({ events, selectedEvent, onMarkerClick, onInfoWindowClose }: EventMapProps) {
    const { theme } = useTheme();

    const mapRef = useRef<google.maps.Map | null>(null);
    const [infoWindowStack, setInfoWindowStack] = useState<InfoWindowState | null>(null);

    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
    }, []);

    // 외부에서 selectedEvent prop 변경 시 지도 이동만 처리
    useEffect(() => {
        if (selectedEvent && mapRef.current) {
            mapRef.current.panTo({ lat: selectedEvent.latitude, lng: selectedEvent.longitude });
        }
    }, [selectedEvent]);

    // events 변경 시 infoWindowStack 초기화 (날짜 변경 등)
    useEffect(() => {
        setInfoWindowStack(null);
    }, [events]);

    const eventGroups = useMemo(() => {
        const groups = new Map<string, Event[]>();

        events.forEach(event => {
            const key = `${event.latitude},${event.longitude}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(event);
        });

        return groups;
    }, [events]);

    // 지도 중심 계산 (메모이제이션으로 안정화)
    const mapCenter = useMemo(() => {
        if (events.length === 0) return defaultCenter;
        const avgLat = events.reduce((sum, e) => sum + e.latitude, 0) / events.length;
        const avgLng = events.reduce((sum, e) => sum + e.longitude, 0) / events.length;
        return { lat: avgLat, lng: avgLng };
    }, [events]);  // events가 변경될 때만 재계산

    const handleMarkerClick = (eventsAtLocation: Event[]) => {
        if (eventsAtLocation.length === 1) {
            // 단일 이벤트: 외부 useEventSelection에 위임
            onMarkerClick(eventsAtLocation[0]);
        } else {
            // 그룹: EventMap이 리스트 모달 관리
            const location = {
                lat: eventsAtLocation[0].latitude,
                lng: eventsAtLocation[0].longitude
            };
            setInfoWindowStack({ type: 'group', events: eventsAtLocation, location });
            onInfoWindowClose(); // 기존 단일 선택 해제

            if (mapRef.current) {
                mapRef.current.panTo(location);
            }
        }
    };

    const handleEventSelectFromGroup = (event: Event) => {
        // 그룹 모달 닫고 외부에 선택 위임
        setInfoWindowStack(null);
        onMarkerClick(event);
    };

    const handleInfoWindowClose = () => {
        if (infoWindowStack?.type === 'group') {
            // 그룹 모달만 닫기
            setInfoWindowStack(null);
        } else {
        }
        // 단일 이벤트 모달: 외부에 위임
        onInfoWindowClose();
    };

    const renderInfoWindow = () => {
        // 그룹 모달 (EventMap이 관리)
        if (infoWindowStack?.type === 'group') {
            const { events: groupEvents, location } = infoWindowStack;
            return (
                <GroupEventInfoWindow
                    events={groupEvents}
                    location={location}
                    locationName={groupEvents[0].location}
                    onClose={handleInfoWindowClose}
                    onEventSelect={handleEventSelectFromGroup}
                />
            );
        }

        // 단일 이벤트 모달 (외부 selectedEvent prop 사용)
        if (!selectedEvent) return null;

        return (
            <SingleEventInfoWindow
                event={selectedEvent}
                position={{
                    lat: selectedEvent.latitude,
                    lng: selectedEvent.longitude
                }}
                onClose={handleInfoWindowClose}
            />
        );
    };

    return (
        <div className={styles.eventMap}>
            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={mapCenter}
                zoom={events.length > 0 ? 12 : 11}
                onLoad={onMapLoad}
                options={{
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: true,
                    styles: theme === 'dark' ? mapStyles : undefined,
                }}
            >
                {Array.from(eventGroups.entries()).map(([coordKey, eventsAtLocation]) => {
                    const firstEvent = eventsAtLocation[0];
                    const isGrouped = eventsAtLocation.length > 1;

                    const isSelected = infoWindowStack && (
                        (infoWindowStack.type === 'single' && eventsAtLocation.some(e => e.id === infoWindowStack.event.id)) ||
                        (infoWindowStack.type === 'group' && infoWindowStack.location.lat === firstEvent.latitude && infoWindowStack.location.lng === firstEvent.longitude)
                    );

                    return (
                        <Marker
                            key={coordKey}
                            position={{ lat: firstEvent.latitude, lng: firstEvent.longitude }}
                            onClick={() => handleMarkerClick(eventsAtLocation)}
                            label={isGrouped ? {
                                text: String(eventsAtLocation.length),
                                color: '#ffffff',
                                fontSize: '14px',
                                fontWeight: 'bold',
                            } : undefined}
                            icon={
                                isSelected
                                    ? undefined
                                    : {
                                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
                                                <path fill="${isGrouped ? '#9B59B6' : '#FF6B35'}" stroke="#ffffff" stroke-width="2" d="M18 2C11.373 2 6 7.373 6 14c0 10.5 12 32 12 32s12-21.5 12-32c0-6.627-5.373-12-12-12z"/>
                                                <circle cx="18" cy="14" r="8" fill="#ffffff"/>
                                                <path fill="${isGrouped ? '#9B59B6' : '#FF6B35'}" d="M18 8c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2s2-.9 2-2v-4c0-1.1-.9-2-2-2zm-4 8c0 2.2 1.8 4 4 4s4-1.8 4-4h-1.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5H14z"/>
                                            </svg>
                                        `),
                                        scaledSize: new window.google.maps.Size(36, 48),
                                        anchor: new window.google.maps.Point(18, 48),
                                    }
                            }
                        />
                    );
                })}

                {renderInfoWindow()}
            </GoogleMap>
        </div>
    );
}

export default EventMap;
