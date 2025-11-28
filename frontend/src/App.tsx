import { useState, useEffect, useCallback } from 'react';
import { LoadScript } from '@react-google-maps/api';
import EventMap from './components/EventMap';
import EventForm from './components/EventForm';
import EventList from './components/EventList';
import DatePicker from './components/DatePicker';
import PerformerFilter from './components/PerformerFilter';
import { Event } from './types/event';
import { eventApi } from './services/api';
import { format } from 'date-fns';
import './App.css';

import { ThemeProvider, useTheme } from './context/ThemeContext';

const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];

function AppContent() {
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedPerformer, setSelectedPerformer] = useState<string | null>(null);
    const { theme, toggleTheme } = useTheme();

    const loadEvents = useCallback(async () => {
        setLoading(true);
        try {
            const data = await eventApi.getEventsByDate(selectedDate);
            setEvents(data);
        } catch (error) {
            console.error('Failed to load events:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    // 선택된 날짜의 이벤트 로드
    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const handleDateChange = (date: string) => {
        setSelectedDate(date);
    };

    const handleEventClick = (event: Event) => {
        setSelectedEvent(event);
    };

    const handleInfoWindowClose = () => {
        setSelectedEvent(null);
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

    const handleSwitchToEdit = (eventId: number) => {
        const eventToEdit = events.find(e => e.id === eventId);
        if (eventToEdit) {
            setSelectedEvent(eventToEdit);
            setIsFormOpen(true); // 폼이 이미 열려있지만, 명시적으로 유지
        } else {
            console.error(`Event with id ${eventId} not found.`);
            // 필요하다면 사용자에게 알림
        }
    };

    const handlePerformerSelect = (performerName: string | null) => {
        setSelectedPerformer(performerName);
    };

    // 출연자로 필터링
    const filteredEvents = selectedPerformer
        ? events.filter(event => event.performers?.includes(selectedPerformer))
        : events;

    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

    return (
        <LoadScript googleMapsApiKey={apiKey} libraries={GOOGLE_MAPS_LIBRARIES}>
            <div className="app">
                <header className="app-header">
                    <div className="header-content">
                        <h1>🗺️ Event Map</h1>
                        <p>날짜를 선택하여 이벤트를 확인하세요</p>
                    </div>
                    <button className="theme-toggle" onClick={toggleTheme} title="테마 변경">
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                </header>

                <div className="app-container">
                    <aside className="sidebar">
                        <DatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />

                        <PerformerFilter onPerformerSelect={handlePerformerSelect} />

                        <button className="btn-new-event" onClick={handleNewEvent}>
                            ➕ 새 이벤트 등록
                        </button>

                        <EventList
                            events={filteredEvents}
                            loading={loading}
                            onEventClick={handleEventClick}
                            onEventEdit={handleEditEvent}
                            onEventDelete={handleEventDelete}
                            selectedEventId={selectedEvent?.id}
                        />
                    </aside>

                    <main className="main-content">
                        <EventMap
                            events={filteredEvents}
                            selectedEvent={selectedEvent}
                            onMarkerClick={handleEventClick}
                            onInfoWindowClose={handleInfoWindowClose}
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
                        onSwitchToEdit={handleSwitchToEdit}
                    />
                )}
            </div>
        </LoadScript>
    );
}

function App() {
    return (
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    );
}

export default App;
