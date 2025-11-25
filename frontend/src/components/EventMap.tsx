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
                            <div className="info-header">
                                <h3>{selectedEvent.title}</h3>
                            </div>

                            <table className="info-table">
                                <tbody>
                                    <tr>
                                        <td className="info-label">📍 장소</td>
                                        <td className="info-value">
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${selectedEvent.latitude},${selectedEvent.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="info-map-link"
                                                title="Google Maps에서 보기"
                                            >
                                                {selectedEvent.location}
                                            </a>
                                        </td>
                                    </tr>
                                    {selectedEvent.address && (
                                        <tr>
                                            <td className="info-label">📮 주소</td>
                                            <td className="info-value info-address">
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.address)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="info-map-link"
                                                    title="Google Maps에서 보기"
                                                >
                                                    {selectedEvent.address}
                                                </a>
                                            </td>
                                        </tr>
                                    )}
                                    <tr>
                                        <td className="info-label">📅 날짜</td>
                                        <td className="info-value">{selectedEvent.event_date}</td>
                                    </tr>
                                    {selectedEvent.door_time && (
                                        <tr>
                                            <td className="info-label">🚪 개장</td>
                                            <td className="info-value">{selectedEvent.door_time}</td>
                                        </tr>
                                    )}
                                    {selectedEvent.start_time && (
                                        <tr>
                                            <td className="info-label">🎬 개연</td>
                                            <td className="info-value">{selectedEvent.start_time}</td>
                                        </tr>
                                    )}
                                    {selectedEvent.end_time && (
                                        <tr>
                                            <td className="info-label">🏁 종연</td>
                                            <td className="info-value">{selectedEvent.end_time}</td>
                                        </tr>
                                    )}
                                    {selectedEvent.performers && (
                                        <tr>
                                            <td className="info-label">🎤 출연자</td>
                                            <td className="info-value">{selectedEvent.performers}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {selectedEvent.description && (
                                <div className="info-description">
                                    <div className="info-description-label">📝 설명</div>
                                    <div className="info-description-text">{selectedEvent.description}</div>
                                </div>
                            )}

                            {selectedEvent.related_link && (
                                <a
                                    href={selectedEvent.related_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="info-link"
                                >
                                    🔗 자세히 보기 →
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
