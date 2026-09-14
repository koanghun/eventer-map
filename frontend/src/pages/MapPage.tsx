import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEventStore } from '../store/useEventStore';
import { useGetEvents } from '../api/generated/events/events';
import type { EventSummary } from '../api/generated/model';
import { Button } from '../components/ui/button';
import DatePicker from '../components/common/DatePicker';
import ArtistSearch from '../components/events/ArtistSearch';
import EventList from '../components/events/EventList';
import EventMap from '../components/map/EventMap';
import EventFormPane from '../components/events/EventFormPane';
import EventDetailPane from '../components/events/EventDetailPane';

export default function MapPage() {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const startDate = searchParams.get('start') ?? today;
    const endDate = searchParams.get('end') ?? today;
    
    const { isAuthenticated } = useAuth();
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    const showNewEventButton = isAuthenticated || process.env.NODE_ENV === 'development';
    
    const { data: eventsData, isLoading: isEventsLoading } = useGetEvents();
    const allEvents = eventsData?.events || [];
    
    const filteredEvents = allEvents.filter((event: EventSummary) => {
        const eventStart = event.startTime ? new Date(event.startTime).toISOString().split('T')[0] : '';
        const eventEnd = event.endTime ? new Date(event.endTime).toISOString().split('T')[0] : '';
        if (eventStart && eventEnd) {
            const isOverlap = eventStart <= endDate && eventEnd >= startDate;
            if (!isOverlap) return false;
        }
        return true;
    });

    const clearSelection = useEventStore((state) => state.clearSelection);
    const selectedEvent = useEventStore((state) => state.selectedEvent);

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

    return (
        <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 w-full max-w-[2400px] mx-auto md:overflow-hidden md:h-[calc(100vh-73px)] relative overflow-x-hidden">
            <aside className={`w-full ${selectedEvent ? 'hidden md:flex' : 'flex'} md:w-[20%] shrink-0 bg-card/50 backdrop-blur-sm border border-border rounded-xl shadow-md flex-col transition-all duration-500 overflow-hidden`}>
                <div className="p-4 flex flex-col gap-4 border-b border-border/50 shrink-0">
                    <DatePicker 
                        startDate={startDate} 
                        endDate={endDate} 
                        onStartDateChange={handleStartDateChange} 
                        onEndDateChange={handleEndDateChange} 
                    />
                    <ArtistSearch />
                    {showNewEventButton && (
                        <Button className="w-full bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white shadow-md transition-all hover:-translate-y-0.5" onClick={() => setIsFormOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" /> {t('buttons.newEvent')}
                        </Button>
                    )}
                </div>
                <div className="flex-1 overflow-auto min-h-[300px]">
                    <EventList
                        events={filteredEvents}
                        loading={isEventsLoading}
                        onEventEdit={isAuthenticated ? () => setIsFormOpen(true) : undefined}
                        onEventDelete={isAuthenticated ? () => {} : undefined}
                    />
                </div>
            </aside>

            <main className={`flex-1 min-h-[400px] md:min-h-0 bg-card rounded-xl border border-border overflow-hidden shadow-md relative z-0 transition-all duration-500 ${selectedEvent || isFormOpen ? 'w-full md:w-[60%]' : 'w-full md:w-[80%]'}`}>
                <EventMap events={filteredEvents} />
            </main>

            {isFormOpen ? (
                <div className="absolute inset-0 md:static md:w-[20%] h-full shrink-0 z-20 md:z-auto transition-all duration-500">
                    <EventFormPane onClose={() => setIsFormOpen(false)} />
                </div>
            ) : selectedEvent ? (
                <div className="absolute inset-0 md:static md:w-[20%] h-full shrink-0 z-20 md:z-auto transition-all duration-500">
                    <EventDetailPane />
                </div>
            ) : null}
        </div>
    );
}
