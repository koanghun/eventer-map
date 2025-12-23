import { InfoWindow } from '@react-google-maps/api';
import { Event } from '../../types/event';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import EventHistoryModal from '../EventHistoryModal';
import EventReportModal from '../EventReportModal';
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
    const { isAuthenticated, flaggedEventIds, toggleFlag } = useAuth();
    const isFlagged = flaggedEventIds.includes(event.id || 0);

    const [showHistory, setShowHistory] = useState(false);
    const [showReport, setShowReport] = useState(false);

    return (
        <>
            <InfoWindow position={position} onCloseClick={onClose}>
                <div className="info-window">
                    <div className="info-header">
                        <h3>{event.title}</h3>
                        <div className="info-actions">
                            <button
                                className="history-button"
                                onClick={() => setShowHistory(true)}
                                title="View History"
                            >
                                📜
                            </button>
                            {isAuthenticated && (
                                <>
                                    <button
                                        className="report-button"
                                        onClick={() => setShowReport(true)}
                                        title="Report Event"
                                    >
                                        🚨
                                    </button>
                                    <button
                                        className={`flag-toggle-button ${isFlagged ? 'active' : ''}`}
                                        onClick={() => event.id && toggleFlag(event.id)}
                                        title={isFlagged ? t('eventDetail.flags.remove') : t('eventDetail.flags.add')}
                                    >
                                        🚩
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <table className="info-table">
                        <tbody>
                            <tr>
                                <td className="info-label">📍 {t('eventDetail.labels.location')}</td>
                                <td className="info-value">
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="info-map-link"
                                        title={t('eventDetail.mapLink')}
                                    >
                                        {event.location}
                                    </a>
                                </td>
                            </tr>
                            {event.address && (
                                <tr>
                                    <td className="info-label">📮 {t('eventDetail.labels.address')}</td>
                                    <td className="info-value info-address">
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="info-map-link"
                                            title={t('eventDetail.mapLink')}
                                        >
                                            {event.address}
                                        </a>
                                    </td>
                                </tr>
                            )}
                            <tr>
                                <td className="info-label">📅 {t('eventDetail.labels.date')}</td>
                                <td className="info-value">{event.event_date}</td>
                            </tr>
                            {event.door_time && (
                                <tr>
                                    <td className="info-label">🚪 {t('eventDetail.labels.doorTime')}</td>
                                    <td className="info-value">{event.door_time}</td>
                                </tr>
                            )}
                            {event.start_time && (
                                <tr>
                                    <td className="info-label">🎬 {t('eventDetail.labels.startTime')}</td>
                                    <td className="info-value">{event.start_time}</td>
                                </tr>
                            )}
                            {event.end_time && (
                                <tr>
                                    <td className="info-label">🏁 {t('eventDetail.labels.endTime')}</td>
                                    <td className="info-value">{event.end_time}</td>
                                </tr>
                            )}
                            {event.performers && (
                                <tr>
                                    <td className="info-label">🎤 {t('eventDetail.labels.performers')}</td>
                                    <td className="info-value">{event.performers}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {event.description && (
                        <div className="info-description">
                            <div className="info-description-label">📝 {t('eventDetail.labels.description')}</div>
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

            {showHistory && event.id && (
                <EventHistoryModal
                    eventId={event.id}
                    onClose={() => setShowHistory(false)}
                />
            )}

            {showReport && event.id && (
                <EventReportModal
                    eventId={event.id}
                    eventTitle={event.title}
                    onClose={() => setShowReport(false)}
                />
            )}
        </>
    );
}
