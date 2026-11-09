import { OverlayView } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import { MapPin, Calendar, Users, Mic2, ExternalLink, X } from 'lucide-react';
import { useGetEventsEventId } from '../../api/generated/events/events';
import type { EventSummary } from '../../api/generated/model';

interface SingleEventInfoWindowProps {
    event: EventSummary;
    position: { lat: number; lng: number };
    offsetPx?: number;
    onClose: () => void;
    onArtistSelect?: (artist: { id: string; name: string }) => void;
    onVenueSelect?: (venue: { id: string; name: string; lat?: number; lng?: number }) => void;
}

export default function SingleEventInfoWindow({
    event,
    position,
    offsetPx = 32,
    onClose,
    onArtistSelect,
    onVenueSelect,
}: SingleEventInfoWindowProps) {
    const { t } = useTranslation();

    const { data: eventData } = useGetEventsEventId(event.id || '', {
        query: {
            enabled: !!event.id,
        },
    });

    const venueId = eventData?.venue?.id || event.venueId;
    const rawVenueName = eventData?.venue?.officialName || event.venueName;
    const venueName = rawVenueName || t('eventDetail.venueUnknown', 'Venue TBD');
    const artists = eventData?.artists?.filter((a) => Boolean(a.officialName)) || [];

    const formattedStart = event.startTime
        ? new Date(event.startTime).toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        : t('eventDetail.dateUnknown', 'Date TBD');
    const formattedEnd = event.endTime
        ? new Date(event.endTime).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
        })
        : null;

    return (
        <OverlayView position={position} mapPaneName={OverlayView.FLOAT_PANE}>
            <div
                style={{ bottom: `${offsetPx}px` }}
                className="absolute left-0 -translate-x-1/2 z-50"
            >
                <div className="min-w-[280px] max-w-[340px] font-sans bg-background text-foreground rounded-2xl shadow-2xl border border-border relative animate-in zoom-in-95 duration-200">
                    {/* Speech Bubble Arrow Tail */}
                    <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-background border-r border-b border-border rotate-45" />

                    {/* Header */}
                    <div className="bg-muted/30 p-3.5 border-b border-border rounded-t-2xl flex justify-between items-start gap-3">
                        <h3 className="font-bold text-base text-primary break-words leading-snug">
                            {event.title}
                        </h3>
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

                    {/* Body */}
                    <div className="p-3.5 space-y-2.5 text-sm">
                        <div className="flex items-start gap-2.5">
                            <MapPin className="w-4 h-4 text-primary/70 mt-0.5 shrink-0" />
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                {venueId && rawVenueName && onVenueSelect ? (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onVenueSelect({
                                                id: venueId,
                                                name: rawVenueName,
                                                lat: position.lat,
                                                lng: position.lng,
                                            })
                                        }
                                        className="text-left text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors break-words font-medium cursor-pointer"
                                        title={t('eventDetail.searchByVenue', '이 공연장으로 검색 (6개월)')}
                                    >
                                        {venueName}
                                    </button>
                                ) : (
                                    <span className="text-foreground break-words font-medium">
                                        {venueName}
                                    </span>
                                )}
                                {rawVenueName && (
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawVenueName)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                                        title={t('eventDetail.mapLink', 'Google Maps에서 보기')}
                                        aria-label={t('eventDetail.mapLink', 'Google Maps에서 보기')}
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                )}
                            </div>
                        </div>

                        {artists.length > 0 && (
                            <div className="flex items-start gap-2.5">
                                <Mic2 className="w-4 h-4 text-primary/70 mt-0.5 shrink-0" />
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                    {artists.map((a, idx) => {
                                        const label = a.disambiguation
                                            ? `${a.officialName} (${a.disambiguation})`
                                            : a.officialName!;
                                        return (
                                            <span key={a.id || idx} className="inline-flex items-center">
                                                {a.id && onArtistSelect ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onArtistSelect({
                                                                id: a.id!,
                                                                name: a.officialName!,
                                                            })
                                                        }
                                                        className="text-left text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors font-medium break-words cursor-pointer"
                                                        title={t('eventDetail.searchByArtist', '이 출연자로 검색 (6개월)')}
                                                    >
                                                        {label}
                                                    </button>
                                                ) : (
                                                    <span className="text-foreground font-medium">{label}</span>
                                                )}
                                                {idx < artists.length - 1 && (
                                                    <span className="text-muted-foreground">,</span>
                                                )}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex items-start gap-2.5">
                            <Calendar className="w-4 h-4 text-primary/70 mt-0.5 shrink-0" />
                            <div className="text-foreground">
                                {formattedStart}
                                {formattedEnd ? ` ~ ${formattedEnd}` : ''}
                            </div>
                        </div>

                        {typeof event.attendeeCount === 'number' && (
                            <div className="flex items-center gap-2.5">
                                <Users className="w-4 h-4 text-primary/70 shrink-0" />
                                <span className="text-foreground font-medium">
                                    {event.attendeeCount}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </OverlayView>
    );
}
