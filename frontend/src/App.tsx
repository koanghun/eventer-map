import { useState, useRef } from 'react';
import { LoadScript } from '@react-google-maps/api';
import EventMap, { EventMapHandle } from './components/EventMap';
import EventForm from './components/EventForm';
import EventList from './components/EventList';
import DatePicker from './components/DatePicker';
import PerformerFilter from './components/PerformerFilter';
import { format } from 'date-fns';
import './App.css';

import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useEventManagement } from './hooks/useEventManagement';

const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];

function AppContent() {
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const { theme, toggleTheme } = useTheme();

    const {
        selectedEvent,
        isFormOpen,
        loading,
        filteredEvents,
        setSelectedEvent,
        setSelectedPerformer,
        handleEventSubmit,
        handleEventDelete,
        handleNewEvent,
        handleEditEvent,
        handleSwitchToEdit,
        handleCloseForm,
    } = useEventManagement(selectedDate);

    const mapRef = useRef<EventMapHandle>(null);

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
                        <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />

                        <PerformerFilter onPerformerSelect={setSelectedPerformer} />

                        <button className="btn-new-event" onClick={handleNewEvent}>
                            ➕ 새 이벤트 등록
                        </button>

                        <EventList
                            events={filteredEvents}
                            loading={loading}
                            onEventClick={(event) => {
                                setSelectedEvent(event);
                                mapRef.current?.selectEvent(event);
                            }}
                            onEventEdit={handleEditEvent}
                            onEventDelete={handleEventDelete}
                            selectedEventId={selectedEvent?.id}
                        />
                    </aside>

                    <main className="main-content">
                        <EventMap
                            ref={mapRef}
                            events={filteredEvents}
                            onMarkerClick={setSelectedEvent}
                            onInfoWindowClose={() => setSelectedEvent(null)}
                        />
                    </main>
                </div>

                {isFormOpen && (
                    <EventForm
                        event={selectedEvent}
                        onSubmit={handleEventSubmit}
                        onClose={handleCloseForm}
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
