import { useTranslation } from 'react-i18next';
import { Event } from '../types/event';
import './EventList.css';

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
        return <div className="event-list-loading">{t('eventList.loading')}</div>;
    }

    if (events.length === 0) {
        return (
            <div className="event-list-empty">
                <p>{t('eventList.empty.line1')}</p>
                <p>{t('eventList.empty.line2')}</p>
            </div>
        );
    }

    return (
        <div className="event-list">
            <h3>{t('eventList.title')} ({events.length})</h3>
            <div className="event-items">
                {events.map((event) => (
                    <div
                        key={event.id}
                        className={`event-item ${selectedEventId === event.id ? 'active' : ''}`}
                        onClick={() => onEventClick(event)}
                    >
                        <div className="event-item-header">
                            <h4>{event.title}</h4>
                            {(onEventEdit || onEventDelete) && (
                                <div className="event-item-actions">
                                    {onEventEdit && (
                                        <button
                                            className="btn-edit"
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
                                            className="btn-delete"
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

                        <p className="event-item-location">📍 {event.location}</p>
                        <p className="event-item-time">
                            🕐{' '}
                            {event.door_time && `${t('eventList.timePrefix.door')} ${event.door_time}`}
                            {event.door_time && event.start_time && ' / '}
                            {event.start_time && `${t('eventList.timePrefix.start')} ${event.start_time}`}
                            {(event.door_time || event.start_time) && event.end_time && ' / '}
                            {event.end_time && `${t('eventList.timePrefix.end')} ${event.end_time}`}
                            {!event.door_time && !event.start_time && !event.end_time && t('eventList.timePrefix.tbd')}
                        </p>
                        {event.performers && (
                            <p className="event-item-performers">🎤 {event.performers}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default EventList;
