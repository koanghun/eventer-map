import { InfoWindow } from '@react-google-maps/api';
import { Event } from '../../types/event';
import { useTranslation } from 'react-i18next';
import styles from './GroupEventInfoWindow.module.css';

interface GroupEventInfoWindowProps {
    events: Event[];
    location: { lat: number; lng: number };
    locationName: string;
    onClose: () => void;
    onEventSelect: (event: Event) => void;
}

export default function GroupEventInfoWindow({
    events,
    location,
    locationName,
    onClose,
    onEventSelect
}: GroupEventInfoWindowProps) {
    const { t } = useTranslation();

    return (
        <InfoWindow position={location} onCloseClick={onClose}>
            <div className={styles.infoWindowMulti}>
                <div className={styles.infoHeaderMulti}>
                    <h3>{t('eventMap.groupModal.title', { count: events.length })}</h3>
                    <p className={styles.infoLocationName}>{locationName}</p>
                </div>

                <div className={styles.infoEventList}>
                    {events.map(event => (
                        <div
                            key={event.id}
                            className={styles.infoEventItem}
                            onClick={() => onEventSelect(event)}
                        >
                            <div className={styles.infoEventHeader}>
                                <div className={styles.infoEventTitle}>
                                    <span className={styles.eventTitleText}>{event.title}</span>
                                    <span className={styles.eventDateBadge}>{event.event_date}</span>
                                </div>
                                <span className={styles.expandIcon}>▶</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </InfoWindow>
    );
}
