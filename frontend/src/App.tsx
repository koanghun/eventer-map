import { useState } from 'react';
import { LoadScript } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import EventMap from './components/EventMap';
import EventForm from './components/EventForm';
import EventList from './components/EventList';
import DatePicker from './components/DatePicker';
import PerformerFilter from './components/PerformerFilter';
import { format } from 'date-fns';
import './App.css';

import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginButton from './components/LoginButton';
import UserProfile from './components/UserProfile';
import AuthCallback from './components/AuthCallback';
import { useEventData } from './hooks/useEventData';
import { useEventSelection } from './hooks/useEventSelection';
import { useEventForm } from './hooks/useEventForm';

const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];

function AppContent() {
    const { t } = useTranslation();
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const { theme, toggleTheme } = useTheme();
    const { language, changeLanguage } = useLanguage();
    const { isAuthenticated } = useAuth();

    // 3개 훅으로 분리된 책임
    const eventData = useEventData(selectedDate);
    const eventSelection = useEventSelection();
    const eventForm = useEventForm(eventData.loadEvents);

    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
    // const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

    const handleLogin = () => {
        // 프록시 사용을 위해 상대 경로 사용
        window.location.href = `/api/auth/google/login`;
    };

    // Check if we're on the auth callback path
    const isAuthCallback = window.location.pathname === '/auth/callback';

    if (isAuthCallback) {
        return <AuthCallback />;
    }

    return (
        <LoadScript googleMapsApiKey={apiKey} libraries={GOOGLE_MAPS_LIBRARIES}>
            <div className="app">
                <header className="app-header">
                    <div className="header-content">
                        <h1>🗺️ {t('header.title')}</h1>
                        <p>{t('header.subtitle')}</p>
                    </div>
                    <div className="header-controls">
                        <select
                            value={language}
                            onChange={(e) => changeLanguage(e.target.value as 'ko' | 'ja')}
                            className="language-selector"
                        >
                            <option value="ja">{t('language.ja')}</option>
                            <option value="ko">{t('language.ko')}</option>
                        </select>
                        <button className="theme-toggle" onClick={toggleTheme} title={t('header.themeToggle')}>
                            {theme === 'dark' ? '☀️' : '🌙'}
                        </button>
                        {isAuthenticated ? (
                            <UserProfile />
                        ) : (
                            <LoginButton onClick={handleLogin} />
                        )}
                    </div>
                </header>

                <div className="app-container">
                    <aside className="sidebar">
                        <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />

                        <PerformerFilter onPerformerSelect={eventData.setSelectedPerformer} />

                        {isAuthenticated && (
                            <button className="btn-new-event" onClick={eventForm.openNew}>
                                ➕ {t('buttons.newEvent')}
                            </button>
                        )}

                        <EventList
                            events={eventData.filteredEvents}
                            loading={eventData.loading}
                            onEventClick={eventSelection.selectEvent}
                            onEventEdit={isAuthenticated ? eventForm.openEdit : undefined}
                            onEventDelete={isAuthenticated ? eventForm.deleteEvent : undefined}
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
            <LanguageProvider>
                <AuthProvider>
                    <AppContent />
                </AuthProvider>
            </LanguageProvider>
        </ThemeProvider>
    );
}

export default App;
