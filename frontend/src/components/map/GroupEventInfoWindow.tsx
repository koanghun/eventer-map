import { OverlayView } from '@react-google-maps/api';
import { Event } from '../../types/event';
import { useTranslation } from 'react-i18next';
import { MapPin, Calendar, ChevronRight } from 'lucide-react';

interface GroupEventInfoWindowProps {
    events: Event[];
    location: { lat: number; lng: number };
    locationName: string;
    onClose: () => void;
    onEventSelect: (event: Event) => void;
}

export default function GroupEventInfoWindow({
    events,
    location,
    locationName,
    onClose,
    onEventSelect
}: GroupEventInfoWindowProps) {
    const { t } = useTranslation();

    return (
        <OverlayView position={location} mapPaneName={OverlayView.FLOAT_PANE}>
            <div className="absolute bottom-[45px] left-0 -translate-x-1/2 z-50">
                <div className="min-w-[280px] max-w-[350px] font-sans p-1 bg-background text-foreground shadow-2xl rounded-2xl border border-border relative animate-in zoom-in-95 duration-200">
                    {/* Custom Close Button */}
                    <button 
                        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground rounded-full w-6 h-6 flex items-center justify-center transition-colors hover:bg-muted/80 z-10" 
                        onClick={onClose}
                        title={t('buttons.close') || "Close"}
                    >
                        ✕
                    </button>

                    {/* Speech Bubble Arrow Tail */}
                    <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-background border-r border-b border-border rotate-45"></div>
                <div className="mb-4 bg-muted/30 -mx-1 -mt-1 p-3 border-b border-border rounded-t-lg">
                    <h3 className="font-bold text-lg text-primary mb-1">
                        {t('eventMap.groupModal.title', { count: events.length })}
                    </h3>
                    <div className="flex items-start gap-1 text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span className="break-words">{locationName}</span>
                    </div>
                </div>

                <div className="max-h-[250px] overflow-y-auto pr-1 space-y-2">
                    {events.map(event => (
                        <div
                            key={event.id}
                            className="group p-3 rounded-lg border border-border bg-card hover:border-primary hover:bg-primary/5 cursor-pointer transition-all flex items-center justify-between"
                            onClick={() => onEventSelect(event)}
                        >
                            <div className="min-w-0 pr-2">
                                <h4 className="font-bold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                                    {event.title}
                                </h4>
                                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                    <Calendar className="w-3 h-3" />
                                    <span>{event.event_date}</span>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                        </div>
                    ))}
                </div>
                </div>
            </div>
        </OverlayView>
    );
}
