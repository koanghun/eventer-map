import { OverlayView } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import { MapPin, Calendar, ChevronRight, X } from 'lucide-react';
import type { EventSummary } from '../../api/generated/model';

interface GroupEventInfoWindowProps {
    events: EventSummary[];
    location: { lat: number; lng: number };
    locationName: string;
    onClose: () => void;
    onEventSelect: (event: EventSummary) => void;
}

export default function GroupEventInfoWindow({
    events,
    location,
    locationName,
    onClose,
    onEventSelect,
}: GroupEventInfoWindowProps) {
    const { t } = useTranslation();

    return (
        <OverlayView position={location} mapPaneName={OverlayView.FLOAT_PANE}>
            <div className="absolute bottom-[45px] left-0 -translate-x-1/2 z-50">
                <div className="min-w-[280px] max-w-[340px] font-sans bg-background text-foreground shadow-2xl rounded-2xl border border-border relative animate-in zoom-in-95 duration-200">
                    {/* Speech Bubble Arrow Tail */}
                    <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-background border-r border-b border-border rotate-45" />

                    {/* Header */}
                    <div className="bg-muted/30 p-3.5 border-b border-border rounded-t-2xl flex justify-between items-start gap-3">
                        <div className="min-w-0">
                            <h3 className="font-bold text-base text-primary mb-1 leading-snug">
                                {t('eventMap.groupModal.title', { count: events.length })}
                            </h3>
                            {locationName && (
                                <div className="flex items-start gap-1 text-xs text-muted-foreground">
                                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    <span className="break-words">{locationName}</span>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            className="p-1 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                            onClick={onClose}
                            title={t('buttons.close', '닫기')}
                            aria-label={t('buttons.close', '닫기')}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Event List */}
                    <div className="p-2.5 max-h-[250px] overflow-y-auto space-y-2">
                        {events.map((event) => (
                            <div
                                key={event.id}
                                className="group p-3 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 cursor-pointer transition-all flex items-center justify-between"
                                onClick={() => onEventSelect(event)}
                            >
                                <div className="min-w-0 pr-2">
                                    <h4 className="font-bold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                                        {event.title}
                                    </h4>
                                    {event.startTime && (
                                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                            <Calendar className="w-3 h-3 shrink-0" />
                                            <span>
                                                {new Date(event.startTime).toLocaleString('ko-KR', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                    )}
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
