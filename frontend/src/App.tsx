import React, { useState, useEffect } from 'react';
import EventMap from './components/EventMap';
import EventForm from './components/EventForm';
import EventList from './components/EventList';
import DatePicker from './components/DatePicker';
import { Event } from './types/event';
import { eventApi } from './services/api';
import { format } from 'date-fns';
import './App.css';

function App() {
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // 선택된 날짜의 이벤트 로드
    useEffect(() => {
        loadEvents();
    }, [selectedDate]);

    const loadEvents = async () => {
        setLoading(true);
        try {
            const data = await eventApi.getEventsByDate(selectedDate);
            setEvents(data);
        } catch (error) {
            console.error('Failed to load events:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (date: string) => {
        setSelectedDate(date);
    };

    const handleEventClick = (event: Event) => {
        setSelectedEvent(event);
    };

    const handleEventSubmit = async (event: Event) => {
        try {
            if (selectedEvent?.id) {
                await eventApi.updateEvent(selectedEvent.id, event);
            } else {
                await eventApi.createEvent(event);
            }
            setIsFormOpen(false);
            setSelectedEvent(null);
            loadEvents();
        } catch (error) {
            console.error('Failed to save event:', error);
            alert('이벤트 저장에 실패했습니다.');
        }
    };

    const handleEventDelete = async (id: number) => {
        if (!window.confirm('이벤트를 삭제하시겠습니까?')) return;

        try {
            await eventApi.deleteEvent(id);
            loadEvents();
            setSelectedEvent(null);
        } catch (error) {
            console.error('Failed to delete event:', error);
            alert('이벤트 삭제에 실패했습니다.');
        }
    };

    const handleNewEvent = () => {
        setSelectedEvent(null);
        setIsFormOpen(true);
    };

    const handleEditEvent = (event: Event) => {
        setSelectedEvent(event);
        setIsFormOpen(true);
    };

    return (
        <div className="app">
            <header className="app-header">
                <h1>🗺️ Event Map</h1>
                <p>날짜를 선택하여 이벤트를 확인하세요</p>
            </header>

            <div className="app-container">
                <aside className="sidebar">
                    <DatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />

                    <button className="btn-new-event" onClick={handleNewEvent}>
                        ➕ 새 이벤트 등록
                    </button>

                    <EventList
                        events={events}
                        loading={loading}
                        onEventClick={handleEventClick}
                        onEventEdit={handleEditEvent}
                        onEventDelete={handleEventDelete}
                        selectedEventId={selectedEvent?.id}
                    />
                </aside>

                <main className="main-content">
                    <EventMap
                        events={events}
                        selectedEvent={selectedEvent}
                        onMarkerClick={handleEventClick}
                    />
                </main>
            </div>

            {isFormOpen && (
                <EventForm
                    event={selectedEvent}
                    onSubmit={handleEventSubmit}
                    onClose={() => {
                        setIsFormOpen(false);
                        setSelectedEvent(null);
                    }}
                />
            )}
        </div>
    );
}

export default App;
