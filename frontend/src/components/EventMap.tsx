import { useMemo, useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { Event } from '../types/event';
import './EventMap.css';
import { useTheme } from '../context/ThemeContext';

// EventMap의 외부 제어 인터페이스
export interface EventMapHandle {
    selectEvent: (event: Event) => void;
    clearSelection: () => void;
}

interface EventMapProps {
    events: Event[];
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

const EventMap = forwardRef<EventMapHandle, EventMapProps>(
    ({ events, onMarkerClick, onInfoWindowClose }, ref) => {
        const { theme } = useTheme();

        const mapRef = useRef<google.maps.Map | null>(null);
        const [infoWindowStack, setInfoWindowStack] = useState<InfoWindowState | null>(null);

        const onMapLoad = useCallback((map: google.maps.Map) => {
            mapRef.current = map;
        }, []);

        // 외부에서 이벤트 선택 요청을 받을 수 있는 인터페이스 제공
        useImperativeHandle(ref, () => ({
            selectEvent: (event: Event) => {
                setInfoWindowStack({ type: 'single', event });
                onMarkerClick(event);

                if (mapRef.current) {
                    mapRef.current.panTo({ lat: event.latitude, lng: event.longitude });
                }
            },
            clearSelection: () => {
                setInfoWindowStack(null);
                onInfoWindowClose();
            }
        }));

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

        const getMapCenter = () => {
            if (events.length === 0) return defaultCenter;
            const avgLat = events.reduce((sum, e) => sum + e.latitude, 0) / events.length;
            const avgLng = events.reduce((sum, e) => sum + e.longitude, 0) / events.length;
            return { lat: avgLat, lng: avgLng };
        };

        const handleMarkerClick = (eventsAtLocation: Event[]) => {
            if (eventsAtLocation.length === 1) {
                const event = eventsAtLocation[0];
                setInfoWindowStack({ type: 'single', event });
                onMarkerClick(event);

                if (mapRef.current) {
                    mapRef.current.panTo({ lat: event.latitude, lng: event.longitude });
                }
            } else {
                const location = {
                    lat: eventsAtLocation[0].latitude,
                    lng: eventsAtLocation[0].longitude
                };
                setInfoWindowStack({ type: 'group', events: eventsAtLocation, location });
                onInfoWindowClose();

                if (mapRef.current) {
                    mapRef.current.panTo(location);
                }
            }
        };

        const handleEventSelectFromGroup = (event: Event) => {
            setInfoWindowStack({ type: 'single', event });
            onMarkerClick(event);

            if (mapRef.current) {
                mapRef.current.panTo({ lat: event.latitude, lng: event.longitude });
            }
        };

        const handleInfoWindowClose = () => {
            setInfoWindowStack(null);
            onInfoWindowClose();
        };

        const renderInfoWindow = () => {
            if (!infoWindowStack) return null;

            if (infoWindowStack.type === 'group') {
                const { events: groupEvents, location } = infoWindowStack;
                return (
                    <InfoWindow
                        position={location}
                        onCloseClick={handleInfoWindowClose}
                    >
                        <div className="info-window-multi">
                            <div className="info-header-multi">
                                <h3>이 위치에 {groupEvents.length}개의 이벤트</h3>
                                <p className="info-location-name">{groupEvents[0].location}</p>
                            </div>

                            <div className="info-event-list">
                                {groupEvents.map(event => (
                                    <div
                                        key={event.id}
                                        className="info-event-item"
                                        onClick={() => handleEventSelectFromGroup(event)}
                                    >
                                        <div className="info-event-header">
                                            <div className="info-event-title">
                                                <span className="event-title-text">{event.title}</span>
                                                <span className="event-date-badge">{event.event_date}</span>
                                            </div>
                                            <span className="expand-icon">▶</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </InfoWindow>
                );
            }

            const { event } = infoWindowStack;
            return (
                <InfoWindow
                    position={{ lat: event.latitude, lng: event.longitude }}
                    onCloseClick={handleInfoWindowClose}
                >
                    <div className="info-window">
                        <div className="info-header">
                            <h3>{event.title}</h3>
                        </div>

                        <table className="info-table">
                            <tbody>
                                <tr>
                                    <td className="info-label">📍 장소</td>
                                    <td className="info-value">
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="info-map-link"
                                            title="Google Maps에서 보기"
                                        >
                                            {event.location}
                                        </a>
                                    </td>
                                </tr>
                                {event.address && (
                                    <tr>
                                        <td className="info-label">📮 주소</td>
                                        <td className="info-value info-address">
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="info-map-link"
                                                title="Google Maps에서 보기"
                                            >
                                                {event.address}
                                            </a>
                                        </td>
                                    </tr>
                                )}
                                <tr>
                                    <td className="info-label">📅 날짜</td>
                                    <td className="info-value">{event.event_date}</td>
                                </tr>
                                {event.door_time && (
                                    <tr>
                                        <td className="info-label">🚪 개장</td>
                                        <td className="info-value">{event.door_time}</td>
                                    </tr>
                                )}
                                {event.start_time && (
                                    <tr>
                                        <td className="info-label">🎬 개연</td>
                                        <td className="info-value">{event.start_time}</td>
                                    </tr>
                                )}
                                {event.end_time && (
                                    <tr>
                                        <td className="info-label">🏁 종연</td>
                                        <td className="info-value">{event.end_time}</td>
                                    </tr>
                                )}
                                {event.performers && (
                                    <tr>
                                        <td className="info-label">🎤 출연자</td>
                                        <td className="info-value">{event.performers}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {event.description && (
                            <div className="info-description">
                                <div className="info-description-label">📝 설명</div>
                                <div className="info-description-text">{event.description}</div>
                            </div>
                        )}

                        {event.related_link && (
                            <a
                                href={event.related_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="info-link"
                            >
                                🔗 자세히 보기 →
                            </a>
                        )}
                    </div>
                </InfoWindow>
            );
        };

        return (
            <div className="event-map">
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={getMapCenter()}
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
);

EventMap.displayName = 'EventMap';

export default EventMap;
