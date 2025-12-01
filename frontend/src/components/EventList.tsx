import { Event } from '../types/event';
import './EventList.css';

interface EventListProps {
    events: Event[];
    loading: boolean;
    onEventClick: (event: Event) => void;
    onEventEdit: (event: Event) => void;
    onEventDelete: (id: number) => void;
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
    if (loading) {
        return <div className="event-list-loading">로딩 중...</div>;
    }

    if (events.length === 0) {
        return (
            <div className="event-list-empty">
                <p>선택한 날짜에 등록된 이벤트가 없습니다.</p>
                <p>새 이벤트를 등록해보세요! 🎉</p>
            </div>
        );
    }

    return (
        <div className="event-list">
            <h3>이벤트 목록 ({events.length})</h3>
            <div className="event-items">
                {events.map((event) => (
                    <div
                        key={event.id}
                        className={`event-item ${selectedEventId === event.id ? 'active' : ''}`}
                        onClick={() => onEventClick(event)}
                    >
                        <div className="event-item-header">
                            <h4>{event.title}</h4>
                            <div className="event-item-actions">
                                <button
                                    className="btn-edit"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEventEdit(event);
                                    }}
                                    title="수정"
                                >
                                    ✏️
                                </button>
                                <button
                                    className="btn-delete"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (event.id) onEventDelete(event.id);
                                    }}
                                    title="삭제"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>

                        <p className="event-item-location">📍 {event.location}</p>
                        <p className="event-item-time">
                            🕐{' '}
                            {event.door_time && `개장 ${event.door_time}`}
                            {event.door_time && event.start_time && ' / '}
                            {event.start_time && `개연 ${event.start_time}`}
                            {(event.door_time || event.start_time) && event.end_time && ' / '}
                            {event.end_time && `종연 ${event.end_time}`}
                            {!event.door_time && !event.start_time && !event.end_time && '시간 미정'}
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
