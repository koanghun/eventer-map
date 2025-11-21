import React from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { Event } from '../types/event';
import './EventMap.css';

interface EventMapProps {
    events: Event[];
    selectedEvent: Event | null;
    onMarkerClick: (event: Event) => void;
}

const mapContainerStyle = {
    width: '100%',
    height: '100%',
};

const defaultCenter = {
    lat: 37.5665,
    lng: 126.9780, // 서울 중심
};

const EventMap: React.FC<EventMapProps> = ({ events, selectedEvent, onMarkerClick }) => {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

    // 이벤트들의 중심 계산
    const getMapCenter = () => {
        if (events.length === 0) return defaultCenter;

        const avgLat = events.reduce((sum, e) => sum + e.latitude, 0) / events.length;
        const avgLng = events.reduce((sum, e) => sum + e.longitude, 0) / events.length;

        return { lat: avgLat, lng: avgLng };
    };

    return (
        <div className="event-map">
            <LoadScript googleMapsApiKey={apiKey}>
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
                                    ? {
                                        url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                                    }
                                    : undefined
                            }
                        />
                    ))}

                    {selectedEvent && (
                        <InfoWindow
                            position={{
                                lat: selectedEvent.latitude,
                                lng: selectedEvent.longitude,
                            }}
                            onCloseClick={() => onMarkerClick(selectedEvent)}
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
            </LoadScript>
        </div>
    );
};

export default EventMap;
