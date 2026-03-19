import { InfoWindow } from '@react-google-maps/api';
import { Event } from '../../types/event';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import EventHistoryModal from '../events/EventHistoryModal';
import EventReportModal from '../events/EventReportModal';
import styles from './SingleEventInfoWindow.module.css';

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
                <div className={styles.infoWindow}>
                    <div className={styles.infoHeader}>
                        <h3>{event.title}</h3>
                        <div className={styles.infoActions}>
                            <button
                                className={styles.historyButton}
                                onClick={() => setShowHistory(true)}
                                title="View History"
                            >
                                📜
                            </button>
                            {isAuthenticated && (
                                <>
                                    <button
                                        className={styles.reportButton}
                                        onClick={() => setShowReport(true)}
                                        title="Report Event"
                                    >
                                        🚨
                                    </button>
                                    <button
                                        className={`${styles.flagToggleButton} ${isFlagged ? styles.active : ''}`}
                                        onClick={() => event.id && toggleFlag(event.id)}
                                        title={isFlagged ? t('eventDetail.flags.remove') : t('eventDetail.flags.add')}
                                    >
                                        🚩
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <table className={styles.infoTable}>
                        <tbody>
                            <tr>
                                <td className={styles.infoLabel}>📍 {t('eventDetail.labels.location')}</td>
                                <td className={styles.infoValue}>
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.infoMapLink}
                                        title={t('eventDetail.mapLink')}
                                    >
                                        {event.location}
                                    </a>
                                </td>
                            </tr>
                            {event.address && (
                                <tr>
                                    <td className={styles.infoLabel}>📮 {t('eventDetail.labels.address')}</td>
                                    <td className={`${styles.infoValue} ${styles.infoAddress}`}>
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.infoMapLink}
                                            title={t('eventDetail.mapLink')}
                                        >
                                            {event.address}
                                        </a>
                                    </td>
                                </tr>
                            )}
                            <tr>
                                <td className={styles.infoLabel}>📅 {t('eventDetail.labels.date')}</td>
                                <td className={styles.infoValue}>{event.event_date}</td>
                            </tr>
                            {event.door_time && (
                                <tr>
                                    <td className={styles.infoLabel}>🚪 {t('eventDetail.labels.doorTime')}</td>
                                    <td className={styles.infoValue}>{event.door_time}</td>
                                </tr>
                            )}
                            {event.start_time && (
                                <tr>
                                    <td className={styles.infoLabel}>🎬 {t('eventDetail.labels.startTime')}</td>
                                    <td className={styles.infoValue}>{event.start_time}</td>
                                </tr>
                            )}
                            {event.end_time && (
                                <tr>
                                    <td className={styles.infoLabel}>🏁 {t('eventDetail.labels.endTime')}</td>
                                    <td className={styles.infoValue}>{event.end_time}</td>
                                </tr>
                            )}
                            {event.performers && (
                                <tr>
                                    <td className={styles.infoLabel}>🎤 {t('eventDetail.labels.performers')}</td>
                                    <td className={styles.infoValue}>{event.performers}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {event.description && (
                        <div className={styles.infoDescription}>
                            <div className={styles.infoDescriptionLabel}>📝 {t('eventDetail.labels.description')}</div>
                            <div className={styles.infoDescriptionText}>{event.description}</div>
                        </div>
                    )}

                    {event.related_link && (
                        <a
                            href={event.related_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.infoLink}
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
