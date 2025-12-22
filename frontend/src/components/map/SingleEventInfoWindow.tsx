import { InfoWindow } from '@react-google-maps/api';
import { Event } from '../../types/event';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import './SingleEventInfoWindow.css';

interface SingleEventInfoWindowProps {
    event: Event;
    position: { lat: number; lng: number };
    onClose: () => void;
}

export default function SingleEventInfoWindow({
    event,
    position,
    onClose
}: SingleEventInfoWindowProps) {
    const { t } = useTranslation();
    const { isAuthenticated, favoriteEventIds, toggleFavorite } = useAuth();
    const isFavorited = favoriteEventIds.includes(event.id || 0);

    return (
        <InfoWindow position={position} onCloseClick={onClose}>
            <div className="info-window">
                <div className="info-header">

                    <h3>{event.title}</h3>
                    {isAuthenticated && (
                        <div className="attendance-control">
                            <span className="attendance-label">{t('eventMap.infoWindow.attendance')}</span>
                            <div
                                className={`toggle-switch ${isFavorited ? 'active' : ''}`}
                                onClick={() => event.id && toggleFavorite(event.id)}
                                title={isFavorited ? '참가 취소' : '참가 등록'}
                            >
                                <div className="toggle-knob"></div>
                            </div>
                        </div>
                    )}

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
                        🔗 {t('eventMap.infoWindow.link')} →
                    </a>
                )}
            </div>
        </InfoWindow>
    );
}
