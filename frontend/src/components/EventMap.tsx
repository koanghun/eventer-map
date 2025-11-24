import React from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { Event } from '../types/event';
import './EventMap.css';

interface EventMapProps {
    events: Event[];
    selectedEvent: Event | null;
    onMarkerClick: (event: Event) => void;
    onInfoWindowClose: () => void;
}

const mapContainerStyle = {
    width: '100%',
    height: '100%',
};

const defaultCenter = {
    lat: 35.6762,
    lng: 139.6503, // 도쿄 중심
};


const EventMap: React.FC<EventMapProps> = ({ events, selectedEvent, onMarkerClick, onInfoWindowClose }) => {
    // 이벤트들의 중심 계산
    const getMapCenter = () => {
        if (events.length === 0) return defaultCenter;

        const avgLat = events.reduce((sum, e) => sum + e.latitude, 0) / events.length;
        const avgLng = events.reduce((sum, e) => sum + e.longitude, 0) / events.length;

        return { lat: avgLat, lng: avgLng };
    };

    return (
        <div className="event-map">
            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={getMapCenter()}
                zoom={events.length > 0 ? 12 : 11}
                options={{
                    zoomControl: true,
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: true,
                }}
            >
                {events.map((event) => (
                    <Marker
                        key={event.id}
                        position={{ lat: event.latitude, lng: event.longitude }}
                        onClick={() => onMarkerClick(event)}
                        icon={
                            selectedEvent?.id === event.id
                                ? undefined
                                : {
                                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
                                            <path fill="#9333ea" stroke="#ffffff" stroke-width="2" d="M18 2C11.373 2 6 7.373 6 14c0 10.5 12 32 12 32s12-21.5 12-32c0-6.627-5.373-12-12-12z"/>
                                            <circle cx="18" cy="14" r="8" fill="#ffffff"/>
                                            <path fill="#9333ea" d="M18 8c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2s2-.9 2-2v-4c0-1.1-.9-2-2-2zm-4 8c0 2.2 1.8 4 4 4s4-1.8 4-4h-1.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5H14z"/>
                                        </svg>
                                    `),
                                    scaledSize: new window.google.maps.Size(36, 48),
                                    anchor: new window.google.maps.Point(18, 48),
                                }
                        }
                    />
                ))}

                {selectedEvent && (
                    <InfoWindow
                        position={{
                            lat: selectedEvent.latitude,
                            lng: selectedEvent.longitude,
                        }}
                        onCloseClick={onInfoWindowClose}
                    >
                        <div className="info-window">
                            <h3>{selectedEvent.title}</h3>
                            <p className="info-location">📍 {selectedEvent.location}</p>
                            <p className="info-date">
                                📅 {selectedEvent.event_date}
                                {selectedEvent.event_time && ` ${selectedEvent.event_time}`}
                            </p>
                            {selectedEvent.description && (
                                <p className="info-description">{selectedEvent.description}</p>
                            )}
                            {selectedEvent.performers && (
                                <p className="info-performers">🎤 {selectedEvent.performers}</p>
                            )}
                            {selectedEvent.related_link && (
                                <a
                                    href={selectedEvent.related_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="info-link"
                                >
                                    자세히 보기 →
                                </a>
                            )}
                        </div>
                    </InfoWindow>
                )}
            </GoogleMap>
        </div>
    );
};

export default EventMap;
