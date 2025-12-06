import { useState } from 'react';
import { LoadScript } from '@react-google-maps/api';
import EventMap from './components/EventMap';
import EventForm from './components/EventForm';
import EventList from './components/EventList';
import DatePicker from './components/DatePicker';
import PerformerFilter from './components/PerformerFilter';
import { format } from 'date-fns';
import './App.css';

import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useEventData } from './hooks/useEventData';
import { useEventSelection } from './hooks/useEventSelection';
import { useEventForm } from './hooks/useEventForm';

const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];

function AppContent() {
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const { theme, toggleTheme } = useTheme();

    // 3개 훅으로 분리된 책임
    const eventData = useEventData(selectedDate);
    const eventSelection = useEventSelection();
    const eventForm = useEventForm(eventData.loadEvents);

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

                        <PerformerFilter onPerformerSelect={eventData.setSelectedPerformer} />

                        <button className="btn-new-event" onClick={eventForm.openNew}>
                            ➕ 새 이벤트 등록
                        </button>

                        <EventList
                            events={eventData.filteredEvents}
                            loading={eventData.loading}
                            onEventClick={eventSelection.selectEvent}
                            onEventEdit={eventForm.openEdit}
                            onEventDelete={eventForm.deleteEvent}
                            selectedEventId={eventSelection.selectedEvent?.id}
                        />
                    </aside>

                    <main className="main-content">
                        <EventMap
                            events={eventData.filteredEvents}
                            selectedEvent={eventSelection.selectedEvent}
                            onMarkerClick={eventSelection.selectEvent}
                            onInfoWindowClose={eventSelection.clearSelection}
                        />
                    </main>
                </div>

                {eventForm.isFormOpen && (
                    <EventForm
                        event={eventForm.formEvent}
                        onSubmit={eventForm.submit}
                        onClose={eventForm.close}
                        onSwitchToEdit={(id) => eventForm.switchToEdit(id, eventData.events)}
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
