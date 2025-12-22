import { InfoWindow } from '@react-google-maps/api';
import { Event } from '../../types/event';
import { useTranslation } from 'react-i18next';
import './GroupEventInfoWindow.css';

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
            <div className="info-window-multi">
                <div className="info-header-multi">
                    <h3>{t('eventMap.groupModal.title', { count: events.length })}</h3>
                    <p className="info-location-name">{locationName}</p>
                </div>

                <div className="info-event-list">
                    {events.map(event => (
                        <div
                            key={event.id}
                            className="info-event-item"
                            onClick={() => onEventSelect(event)}
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
