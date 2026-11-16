import { OverlayView } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import { MapPin, Calendar, ChevronRight, X } from 'lucide-react';
import { formatLocalizedDate, formatLocalizedDateTime, formatLocalizedTime } from '../../lib/utils';
import type { EventSummary } from '../../api/generated/model';

interface GroupEventInfoWindowProps {
    events: EventSummary[];
    location: { lat: number; lng: number };
    locationName: string;
    offsetPx?: number;
    onClose: () => void;
    onEventSelect: (event: EventSummary) => void;
    onVenueSelect?: (venue: { id: string; name: string; lat?: number; lng?: number }) => void;
}

export default function GroupEventInfoWindow({
    events,
    location,
    locationName,
    offsetPx = 32,
    onClose,
    onEventSelect,
    onVenueSelect,
}: GroupEventInfoWindowProps) {
    const { t, i18n } = useTranslation();
    const venueId = events.find((e) => Boolean(e.venueId))?.venueId;

    return (
        <OverlayView position={location} mapPaneName={OverlayView.FLOAT_PANE}>
            <div
                style={{ bottom: `${offsetPx}px` }}
                className="absolute left-0 -translate-x-1/2 z-50"
            >
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
                                    {venueId && onVenueSelect ? (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onVenueSelect({
                                                    id: venueId,
                                                    name: locationName,
                                                    lat: location.lat,
                                                    lng: location.lng,
                                                })
                                            }
                                            className="text-left hover:text-primary hover:underline underline-offset-2 transition-colors break-words font-medium cursor-pointer"
                                            title={t('eventDetail.searchByVenue', '이 공연장으로 검색 (6개월)')}
                                        >
                                            {locationName}
                                        </button>
                                    ) : (
                                        <span className="break-words">{locationName}</span>
                                    )}
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
                                    {events.map((event) => {
                                        const formattedStart = formatLocalizedDateTime(event.startTime, i18n.language, false);
                                        const formattedEnd = formattedStart
                                            ? formatLocalizedTime(event.endTime, i18n.language)
                                            : formatLocalizedDateTime(event.endTime, i18n.language, false);
                                        const formattedDate = formatLocalizedDate(event, i18n.language, false);
                                        return (
                                <div
                                    key={event.id}
                                    className="group p-3 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 cursor-pointer transition-all flex items-center justify-between"
                                    onClick={() => onEventSelect(event)}
                                >
                                    <div className="min-w-0 pr-2">
                                        <h4 className="font-bold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                                            {event.title}
                                        </h4>
                                        {(formattedStart || formattedEnd || formattedDate) && (
                                            <div className="flex items-start gap-1.5 mt-1 text-xs text-muted-foreground">
                                                <Calendar className="w-3 h-3 shrink-0 mt-0.5" />
                                                <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                                                    {formattedStart && (
                                                        <span>
                                                            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 border border-border rounded px-1 mr-1">
                                                                {t('eventList.timePrefix.start')}
                                                            </span>
                                                            {formattedStart}
                                                        </span>
                                                    )}
                                                    {formattedStart && formattedEnd && <span className="text-border">|</span>}
                                                    {formattedEnd && (
                                                        <span>
                                                            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 border border-border rounded px-1 mr-1">
                                                                {t('eventList.timePrefix.end')}
                                                            </span>
                                                            {formattedEnd}
                                                        </span>
                                                    )}
                                                    {!formattedStart && !formattedEnd && (
                                                        <span className="inline-flex items-center gap-1 flex-wrap">
                                                            {formattedDate && <span>{formattedDate}</span>}
                                                            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 border border-border rounded px-1">
                                                                {t('eventList.timePrefix.tbd')}
                                                            </span>
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                                </div>
                                );
                        })}
                            </div>
                </div>
                </div>
        </OverlayView>
    );
}
