import { useState, useEffect } from 'react';
import { LoadScript } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import EventMap from './components/map/EventMap';
import EventForm from './components/events/EventForm';
import EventList from './components/events/EventList';
import DatePicker from './components/common/DatePicker';
import PerformerFilter from './components/performers/PerformerFilter';
import { format } from 'date-fns';

import { useTheme } from './context/ThemeContext';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';
import LoginButton from './components/common/LoginButton';
import UserProfile from './components/common/UserProfile';
import PerformerManagement from './components/management/PerformerManagement';
import PlaceManagement from './components/management/PlaceManagement';

import { useEventData } from './hooks/useEventData';
import { useEventForm } from './hooks/useEventForm';
import { useEventStore } from './store/useEventStore';
import DailyVisitCounter from './components/common/DailyVisitCounter';
import { Sun, Moon, Map as MapIcon, Plus, Flag, Loader2 } from 'lucide-react';
import { Button } from './components/ui/button';

const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];

export default function AppContent() {
    const { t } = useTranslation();
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const { theme, toggleTheme } = useTheme();
    const { language, changeLanguage } = useLanguage();
    const { isAuthenticated, isLoading } = useAuth();
    const [showFlagsOnly, setShowFlagsOnly] = useState<boolean>(false);
    const [view, setView] = useState<'map' | 'performers' | 'places'>('map');

    const eventData = useEventData(selectedDate, showFlagsOnly);
    const eventForm = useEventForm();
    const clearSelection = useEventStore((state) => state.clearSelection);

    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

    const handleLogin = () => {
        const apiBase = process.env.REACT_APP_API_URL;
        if (apiBase) {
            window.location.href = `${apiBase}/auth/google/login`;
        } else {
            window.location.href = `/api/auth/google/login`;
        }
    };

    const handleDateChange = (newDate: string) => {
        setSelectedDate(newDate);
        clearSelection();
    };

    const handleFlagsToggle = () => {
        setShowFlagsOnly(prev => !prev);
        if (!showFlagsOnly) {
            setSelectedDate('');
            eventData.setSelectedPerformer(null);
        } else {
            setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
        }
        clearSelection();
    };

    useEffect(() => {
        document.title = t('seo.title') || 'Event Map';
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', t('seo.description') || '');
        }
    }, [t, language]);

    return (
        <LoadScript googleMapsApiKey={apiKey} libraries={GOOGLE_MAPS_LIBRARIES}>
            <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
                
                <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border shadow-sm px-4 md:px-8 py-3 flex flex-col md:flex-row justify-between items-center gap-4 transition-all duration-300">
                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center md:text-left">
                        <div className="flex items-center gap-2">
                            <MapIcon className="w-6 h-6 text-primary" />
                            <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">
                                {t('header.title')}
                            </h1>
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mx-2 animate-pulse">
                                Preview
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground hidden md:block">{t('header.subtitle')}</p>
                    </div>

                    <div className="flex items-center gap-2 mr-auto hidden lg:flex">
                        <Button
                            variant={view === 'map' ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setView('map')}
                            className="rounded-full h-8 px-4"
                        >
                            <MapIcon className="w-4 h-4 mr-2" />
                            {t('nav.map', '지도')}
                        </Button>
                        <Button
                            variant={view === 'performers' ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setView('performers')}
                            className="rounded-full h-8 px-4"
                        >
                            {t('nav.performers', '출연자')}
                        </Button>
                        <Button
                            variant={view === 'places' ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setView('places')}
                            className="rounded-full h-8 px-4"
                        >
                            {t('nav.places', '장소')}
                        </Button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <select
                            value={language}
                            onChange={(e) => changeLanguage(e.target.value as 'ko' | 'ja')}
                            className="h-9 px-3 py-1 bg-background border border-input rounded-md text-sm shadow-sm hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer"
                        >
                            <option value="ja">{t('language.ja')}</option>
                            <option value="ko">{t('language.ko')}</option>
                        </select>
                        
                        <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full w-9 h-9" title={t('header.themeToggle')}>
                            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </Button>

                        {isAuthenticated && (
                            <Button 
                                variant={showFlagsOnly ? "default" : "outline"} 
                                size="icon"
                                className={`rounded-full w-9 h-9 ${showFlagsOnly ? 'bg-orange-500 hover:bg-orange-600 border-orange-500 text-white' : ''}`}
                                onClick={handleFlagsToggle}
                                title={showFlagsOnly ? t('filter.flags.showAll') : t('filter.flags.showFlagsOnly')}
                            >
                                <Flag className={`w-4 h-4 ${showFlagsOnly ? 'fill-current' : ''}`} />
                            </Button>
                        )}

                        {isLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground mr-2">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="text-sm">...</span>
                            </div>
                        ) : isAuthenticated ? (
                            <UserProfile />
                        ) : (
                            <LoginButton onClick={handleLogin} />
                        )}
                    </div>
                </header>

                <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 w-full max-w-[2400px] mx-auto md:overflow-hidden md:h-[calc(100vh-73px)]">
                    {view === 'map' ? (
                        <>
                            <aside className="w-full md:w-[350px] lg:w-[400px] shrink-0 bg-card/50 backdrop-blur-sm border border-border rounded-xl shadow-md overflow-hidden flex flex-col transition-all duration-300">
                                <div className="p-4 flex flex-col gap-4 border-b border-border/50 shrink-0">
                                    <DatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />
                                    <PerformerFilter onPerformerSelect={eventData.setSelectedPerformer} />
                                    {isAuthenticated && (
                                        <Button className="w-full bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white shadow-md transition-all hover:-translate-y-0.5" onClick={eventForm.openNew}>
                                            <Plus className="w-4 h-4 mr-2" /> {t('buttons.newEvent')}
                                        </Button>
                                    )}
                                </div>
                                <div className="flex-1 overflow-auto min-h-[300px]">
                                    <EventList
                                        events={eventData.filteredEvents}
                                        loading={eventData.loading}
                                        onEventEdit={isAuthenticated ? eventForm.openEdit : undefined}
                                        onEventDelete={isAuthenticated ? eventForm.deleteEvent : undefined}
                                    />
                                </div>
                            </aside>

                            <main className="flex-1 min-h-[400px] md:min-h-0 bg-card rounded-xl border border-border overflow-hidden shadow-md relative z-0">
                                <EventMap events={eventData.filteredEvents} />
                            </main>
                        </>
                    ) : view === 'performers' ? (
                        <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden shadow-md">
                            <PerformerManagement />
                        </div>
                    ) : (
                        <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden shadow-md">
                            <PlaceManagement />
                        </div>
                    )}
                </div>

                {eventForm.isFormOpen && (
                    <EventForm
                        event={eventForm.formEvent}
                        onSubmit={eventForm.submit}
                        onClose={eventForm.close}
                        onSwitchToEdit={(id) => eventForm.switchToEdit(id, eventData.events)}
                    />
                )}

                <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
                    <DailyVisitCounter />
                </div>
            </div>
        </LoadScript>
    );
}
