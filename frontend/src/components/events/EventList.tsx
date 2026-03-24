import { useTranslation } from 'react-i18next';
import { Event } from '../../types/event';
import { useEventStore } from '../../store/useEventStore';
import { Button } from '../ui/button';
import { Edit2, Trash2, MapPin, Clock, Mic2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface EventListProps {
    events: Event[];
    loading: boolean;
    onEventEdit?: (event: Event) => void;
    onEventDelete?: (id: number) => void;
}

function EventList({ events, loading, onEventEdit, onEventDelete }: EventListProps) {
    const { t } = useTranslation();
    const selectedEvent = useEventStore((state) => state.selectedEvent);
    const selectEvent = useEventStore((state) => state.selectEvent);

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground animate-pulse">{t('eventList.loading')}</div>;
    }

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-2">
                <p className="text-lg font-medium text-foreground">{t('eventList.empty.line1')}</p>
                <p className="text-sm">{t('eventList.empty.line2')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden w-full max-w-sm lg:max-w-md xl:max-w-lg border-r border-border bg-background">
            <div className="p-4 border-b border-border bg-muted/30">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                    {t('eventList.title')} 
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-semibold">
                        {events.length}
                    </span>
                </h3>
            </div>
            
            <ScrollArea className="flex-1 w-full">
                <div className="p-3 space-y-3">
                    {events.map((event) => {
                        const isSelected = selectedEvent?.id === event.id;
                        return (
                            <div
                                key={event.id}
                                className={`group relative p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${
                                    isSelected 
                                    ? 'bg-primary/5 border-primary ring-1 ring-primary' 
                                    : 'bg-card border-border hover:border-primary/50'
                                }`}
                                onClick={() => selectEvent(event)}
                            >
                                <div className="flex justify-between items-start gap-4 mb-2">
                                    <h4 className={`font-bold leading-tight ${isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary transition-colors'}`}>
                                        {event.title}
                                    </h4>
                                    
                                    {(onEventEdit || onEventDelete) && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {onEventEdit && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEventEdit(event);
                                                    }}
                                                    title={t('buttons.edit')}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                            {onEventDelete && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (event.id) onEventDelete(event.id);
                                                    }}
                                                    title={t('buttons.delete')}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5 text-sm">
                                    <div className="flex items-start gap-2 text-muted-foreground">
                                        <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary/70" />
                                        <span className="truncate">{event.location}</span>
                                    </div>
                                    
                                    <div className="flex items-start gap-2 text-muted-foreground">
                                        <Clock className="h-4 w-4 shrink-0 mt-0.5 text-primary/70" />
                                        <span>
                                            {event.door_time && <span className="mr-1"><span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 border border-border rounded px-1">{t('eventList.timePrefix.door')}</span> {event.door_time}</span>}
                                            {event.door_time && event.start_time && <span className="mx-1 text-border">|</span>}
                                            {event.start_time && <span className="mr-1"><span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 border border-border rounded px-1">{t('eventList.timePrefix.start')}</span> {event.start_time}</span>}
                                            {(event.door_time || event.start_time) && event.end_time && <span className="mx-1 text-border">|</span>}
                                            {event.end_time && <span><span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 border border-border rounded px-1">{t('eventList.timePrefix.end')}</span> {event.end_time}</span>}
                                            {!event.door_time && !event.start_time && !event.end_time && <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 border border-border rounded px-1">{t('eventList.timePrefix.tbd')}</span>}
                                        </span>
                                    </div>

                                    {event.performers && (
                                        <div className="flex items-start gap-2 text-muted-foreground mt-2 pt-2 border-t border-border/50">
                                            <Mic2 className="h-4 w-4 shrink-0 mt-0.5 text-primary/70" />
                                            <span className="line-clamp-2">{event.performers}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}

export default EventList;
