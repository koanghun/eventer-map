import { useEffect, useState } from 'react';
import { LoadScript } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import EventMap from './components/map/EventMap';
import EventList from './components/events/EventList';
import EventDetailPane from './components/events/EventDetailPane';
import DatePicker from './components/common/DatePicker';
import { format } from 'date-fns';

import { useTheme } from './context/ThemeContext';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';
import UserProfile from './components/common/UserProfile';
import { useEventStore } from './store/useEventStore';
import DailyVisitCounter from './components/common/DailyVisitCounter';
import EventFormPane from './components/events/EventFormPane';
import { useGetEvents } from './api/generated/events/events';
import AuthPanel from './components/auth/AuthPanel';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Sun, Moon, Map as MapIcon, Plus, Flag, Loader2, LogIn } from 'lucide-react';
import { Button } from './components/ui/button';
import ArtistSearch from './components/events/ArtistSearch';
import VenueList from './components/events/VenueList';
const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];

export default function AppContent() {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const view = location.pathname === '/performers' ? 'performers' : 
                 location.pathname === '/places' ? 'places' : 'map';

    const today = format(new Date(), 'yyyy-MM-dd');
    const startDate = searchParams.get('start') ?? today;
    const endDate = searchParams.get('end') ?? today;
    const showFlagsOnly = searchParams.get('flags') === 'true';

    const { theme, toggleTheme } = useTheme();
    const { language, changeLanguage } = useLanguage();
    const { isAuthenticated, isLoading } = useAuth();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false);
    
    // 개발 환경이거나 로그인 상태일 때 '새 이벤트 등록' 버튼 표시
    const showNewEventButton = isAuthenticated || process.env.NODE_ENV === 'development';

    const { data: eventsData, isLoading: isEventsLoading } = useGetEvents();
    const allEvents = eventsData?.events || [];
    
    // Client-side filtering
    const filteredEvents = allEvents.filter((event) => {
        const eventStart = event.startTime ? new Date(event.startTime).toISOString().split('T')[0] : '';
        const eventEnd = event.endTime ? new Date(event.endTime).toISOString().split('T')[0] : '';
        
        // 날짜 필터링 로직: 이벤트 기간이 선택된 기간(startDate ~ endDate)과 겹치는지 확인
        if (eventStart && eventEnd) {
            const isOverlap = eventStart <= endDate && eventEnd >= startDate;
            if (!isOverlap) return false;
        }
        
        // TODO: showFlagsOnly 등 다른 조건 추가
        
        return true;
    });
    
    const eventForm = {
        isFormOpen,
        openNew: () => setIsFormOpen(true),
        openEdit: () => setIsFormOpen(true),
        deleteEvent: () => {},
        submit: () => {},
        close: () => setIsFormOpen(false),
        formEvent: null,
        switchToEdit: () => {}
    };

    const clearSelection = useEventStore((state) => state.clearSelection);
    const selectedEvent = useEventStore((state) => state.selectedEvent);

    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

    const updateQueryParams = (updates: Record<string, string | null>) => {
        const newParams = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null) {
                newParams.delete(key);
            } else {
                newParams.set(key, value);
            }
        });
        setSearchParams(newParams, { replace: true });
    };

    const handleStartDateChange = (newDate: string) => {
        updateQueryParams({
            start: newDate,
            end: newDate > endDate ? newDate : endDate
        });
        clearSelection();
    };

    const handleEndDateChange = (date: string) => {
        updateQueryParams({ end: date });
        clearSelection();
    };

    const handleFlagsToggle = () => {
        const nextFlags = !showFlagsOnly;
        if (nextFlags) {
            updateQueryParams({ flags: 'true', start: today, end: today });
        } else {
            updateQueryParams({ flags: null, start: null, end: null });
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
                    <div className="flex-1 flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center md:text-left justify-start">
                        <div className="flex items-center gap-2">
                            <MapIcon className="w-6 h-6 text-primary" />
                            <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">
                                {t('header.title')}
                            </h1>
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mx-2 animate-pulse hidden md:inline-block">
                                Preview
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground hidden md:block">{t('header.subtitle')}</p>
                    </div>

                    <div className="flex-1 hidden lg:flex justify-center">
                        <div className="flex items-center gap-2">
                            <Button
                                variant={view === 'map' ? "default" : "ghost"}
                                size="sm"
                                onClick={() => navigate(`/${location.search}`)}
                                className="rounded-full h-8 px-4"
                            >
                                <MapIcon className="w-4 h-4 mr-2" />
                                {t('nav.map', '지도')}
                            </Button>
                            <Button
                                variant={view === 'performers' ? "default" : "ghost"}
                                size="sm"
                                onClick={() => navigate(`/performers${location.search}`)}
                                className="rounded-full h-8 px-4"
                            >
                                {t('nav.performers', '출연자')}
                            </Button>
                            <Button
                                variant={view === 'places' ? "default" : "ghost"}
                                size="sm"
                                onClick={() => navigate(`/places${location.search}`)}
                                className="rounded-full h-8 px-4"
                            >
                                {t('nav.places', '장소')}
                            </Button>
                        </div>
                    </div>
                    
                    <div className="flex-1 flex items-center justify-end gap-3">
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
                            <Button 
                                variant={isAuthPanelOpen ? "default" : "outline"} 
                                size="sm" 
                                className="rounded-full h-9 px-4" 
                                onClick={() => setIsAuthPanelOpen(!isAuthPanelOpen)}
                            >
                                <LogIn className="w-4 h-4 mr-2" />
                                로그인
                            </Button>
                        )}
                    </div>
                </header>

                {isAuthPanelOpen && !isAuthenticated && (
                    <AuthPanel onClose={() => setIsAuthPanelOpen(false)} />
                )}

                <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 w-full max-w-[2400px] mx-auto md:overflow-hidden md:h-[calc(100vh-73px)] relative overflow-x-hidden">
                    {/* Left Sidebar: 20% on desktop (Common across all views) */}
                    <aside className={`w-full ${selectedEvent && view === 'map' ? 'hidden md:flex' : 'flex'} md:w-[20%] shrink-0 bg-card/50 backdrop-blur-sm border border-border rounded-xl shadow-md flex-col transition-all duration-500 overflow-hidden`}>
                        {view === 'map' && (
                            <>
                                <div className="p-4 flex flex-col gap-4 border-b border-border/50 shrink-0">
                                    <DatePicker 
                                        startDate={startDate} 
                                        endDate={endDate} 
                                        onStartDateChange={handleStartDateChange} 
                                        onEndDateChange={handleEndDateChange} 
                                    />
                                    <ArtistSearch />
                                    {showNewEventButton && (
                                        <Button className="w-full bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white shadow-md transition-all hover:-translate-y-0.5" onClick={eventForm.openNew}>
                                            <Plus className="w-4 h-4 mr-2" /> {t('buttons.newEvent')}
                                        </Button>
                                    )}
                                </div>
                                <div className="flex-1 overflow-auto min-h-[300px]">
                                    <EventList
                                        events={filteredEvents}
                                        loading={isEventsLoading}
                                        onEventEdit={isAuthenticated ? eventForm.openEdit : undefined}
                                        onEventDelete={isAuthenticated ? eventForm.deleteEvent : undefined}
                                    />
                                </div>
                            </>
                        )}
                        {view === 'performers' && (
                            <div className="p-4 flex flex-col gap-4 shrink-0">
                                <ArtistSearch />
                                {showNewEventButton && (
                                    <Button className="w-full bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white shadow-md transition-all hover:-translate-y-0.5" onClick={eventForm.openNew}>
                                        <Plus className="w-4 h-4 mr-2" /> {t('buttons.newEvent')}
                                    </Button>
                                )}
                            </div>
                        )}
                        {view === 'places' && (
                            <div className="flex-1 overflow-auto min-h-[300px]">
                                <VenueList />
                            </div>
                        )}
                    </aside>

                    {/* Middle Main Content: 80% or 60% on desktop */}
                    <main className={`flex-1 min-h-[400px] md:min-h-0 bg-card rounded-xl border border-border overflow-hidden shadow-md relative z-0 transition-all duration-500 ${(selectedEvent && view === 'map') || isFormOpen ? 'w-full md:w-[60%]' : 'w-full md:w-[80%]'}`}>
                        {view === 'map' && <EventMap events={filteredEvents} />}
                        {view === 'performers' && (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-muted-foreground">Performers Main View</p>
                            </div>
                        )}
                        {view === 'places' && (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-muted-foreground">Places Main View</p>
                            </div>
                        )}
                    </main>

                    {/* Right Panel: 20% on desktop */}
                    {isFormOpen ? (
                        <div className="absolute inset-0 md:static md:w-[20%] h-full shrink-0 z-20 md:z-auto transition-all duration-500">
                            <EventFormPane onClose={eventForm.close} />
                        </div>
                    ) : selectedEvent && view === 'map' ? (
                        <div className="absolute inset-0 md:static md:w-[20%] h-full shrink-0 z-20 md:z-auto transition-all duration-500">
                            <EventDetailPane />
                        </div>
                    ) : null}
                </div>

                <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
                    <DailyVisitCounter />
                </div>
            </div>
        </LoadScript>
    );
}
