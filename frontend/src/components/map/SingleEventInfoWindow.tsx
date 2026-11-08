import { OverlayView } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import { MapPin, Calendar, Users, X } from 'lucide-react';
import type { EventSummary } from '../../api/generated/model';

interface SingleEventInfoWindowProps {
    event: EventSummary;
    position: { lat: number; lng: number };
    onClose: () => void;
}

export default function SingleEventInfoWindow({
    event,
    position,
    onClose,
}: SingleEventInfoWindowProps) {
    const { t } = useTranslation();

    const venueName = event.venueName || t('eventDetail.venueUnknown', 'Venue TBD');
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
            <div className="absolute bottom-[45px] left-0 -translate-x-1/2 z-50">
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
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors break-words font-medium"
                                title={t('eventDetail.mapLink', 'Google Maps에서 보기')}
                            >
                                {venueName}
                            </a>
                        </div>

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
