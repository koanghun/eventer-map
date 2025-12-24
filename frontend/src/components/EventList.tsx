import { useTranslation } from 'react-i18next';
import { Event } from '../types/event';
import styles from './EventList.module.css';

interface EventListProps {
    events: Event[];
    loading: boolean;
    onEventClick: (event: Event) => void;
    onEventEdit?: (event: Event) => void;  // Optional for non-authenticated users
    onEventDelete?: (id: number) => void;  // Optional for non-authenticated users
    selectedEventId?: number;
}

function EventList({
    events,
    loading,
    onEventClick,
    onEventEdit,
    onEventDelete,
    selectedEventId,
}: EventListProps) {
    const { t } = useTranslation();

    if (loading) {
        return <div className={styles.eventListLoading}>{t('eventList.loading')}</div>;
    }

    if (events.length === 0) {
        return (
            <div className={styles.eventListEmpty}>
                <p>{t('eventList.empty.line1')}</p>
                <p>{t('eventList.empty.line2')}</p>
            </div>
        );
    }

    return (
        <div className={styles.eventList}>
            <h3>{t('eventList.title')} ({events.length})</h3>
            <div className={styles.eventItems}>
                {events.map((event) => (
                    <div
                        key={event.id}
                        className={`${styles.eventItem} ${selectedEventId === event.id ? styles.active : ''}`}
                        onClick={() => onEventClick(event)}
                    >
                        <div className={styles.eventItemHeader}>
                            <h4>{event.title}</h4>
                            {(onEventEdit || onEventDelete) && (
                                <div className={styles.eventItemActions}>
                                    {onEventEdit && (
                                        <button
                                            className={styles.btnEdit}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEventEdit(event);
                                            }}
                                            title={t('buttons.edit')}
                                        >
                                            ✏️
                                        </button>
                                    )}
                                    {onEventDelete && (
                                        <button
                                            className={styles.btnDelete}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (event.id) onEventDelete(event.id);
                                            }}
                                            title={t('buttons.delete')}
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <p className={styles.eventItemLocation}>📍 {event.location}</p>
                        <p className={styles.eventItemTime}>
                            🕐{' '}
                            {event.door_time && `${t('eventList.timePrefix.door')} ${event.door_time}`}
                            {event.door_time && event.start_time && ' / '}
                            {event.start_time && `${t('eventList.timePrefix.start')} ${event.start_time}`}
                            {(event.door_time || event.start_time) && event.end_time && ' / '}
                            {event.end_time && `${t('eventList.timePrefix.end')} ${event.end_time}`}
                            {!event.door_time && !event.start_time && !event.end_time && t('eventList.timePrefix.tbd')}
                        </p>
                        {event.performers && (
                            <p className={styles.eventItemPerformers}>🎤 {event.performers}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default EventList;
