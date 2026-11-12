import { useTranslation } from 'react-i18next';
import { useEventStore } from '../../store/useEventStore';
import { Button } from '../ui/button';
import { Edit2, Trash2, MapPin, Clock, Users } from 'lucide-react';

interface EventListProps {
    events: any[];
    loading: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    onEventEdit?: (event: any) => void;
    onEventDelete?: (id: number) => void;
}

    function EventList({ events, loading, emptyTitle, emptyDescription, onEventEdit, onEventDelete }: EventListProps) {
        const { t } = useTranslation();
        const selectedEvent = useEventStore((state) => state.selectedEvent);
        const selectEvent = useEventStore((state) => state.selectEvent);

        if (loading) {
            return <div className="p-8 text-center text-muted-foreground animate-pulse">{t('eventList.loading')}</div>;
        }

        if (events.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2">
                    <p className="text-base font-medium text-foreground">{emptyTitle || t('eventList.empty.line1')}</p>
                    <p className="text-sm">{emptyDescription || t('eventList.empty.line2')}</p>
                </div>
            );
        }

        return (
            <div className="flex flex-col w-full bg-background">
                <div className="p-4 border-b border-border bg-muted/30">
                    <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                        {t('eventList.title')}
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-semibold">
                            {events.length}
                        </span>
                    </h3>
                </div>

                <div className="w-full">
                    <div className="p-3 space-y-3">
                        {events.map((event) => {
                            const isSelected = selectedEvent?.id === event.id;
                            return (
                                <div
                                    key={event.id}
                                    className={`group relative p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md ${isSelected
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
                                        <div className="flex items-center justify-between gap-2 text-muted-foreground">
                                            <div className="flex items-start gap-2 min-w-0">
                                                <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-primary/70" />
                                                <span className="truncate">
                                                    {event.venueName || (event.venueId ? 'Venue: ' + event.venueId.split('-')[0] + '...' : 'Location TBD')}
                                                </span>
                                            </div>
                                            {typeof event.attendeeCount === 'number' && (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                                                    <Users className="h-3 w-3" />
                                                    {event.attendeeCount}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-start gap-2 text-muted-foreground">
                                            <Clock className="h-4 w-4 shrink-0 mt-0.5 text-primary/70" />
                                            <span>
                                                {event.startTime && <span className="mr-1"><span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 border border-border rounded px-1">{t('eventList.timePrefix.start')}</span> {new Date(event.startTime).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                                                {event.startTime && event.endTime && <span className="mx-1 text-border">|</span>}
                                                {event.endTime && <span><span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 border border-border rounded px-1">{t('eventList.timePrefix.end')}</span> {new Date(event.endTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>}
                                                {!event.startTime && !event.endTime && <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 border border-border rounded px-1">{t('eventList.timePrefix.tbd')}</span>}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    export default EventList;
