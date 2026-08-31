import { OverlayView } from '@react-google-maps/api';

import { useTranslation } from 'react-i18next';

import { MapPin, Calendar, Clock, Mic2, ExternalLink, X } from 'lucide-react';

interface SingleEventInfoWindowProps {
    event: any;
    position: { lat: number; lng: number };
    onClose: () => void;
}

export default function SingleEventInfoWindow({
    event,
    position,
    onClose
}: SingleEventInfoWindowProps) {
    const { t } = useTranslation();

    return (
        <>
            <OverlayView position={position} mapPaneName={OverlayView.FLOAT_PANE}>
                <div className="absolute bottom-[45px] left-0 -translate-x-1/2 z-50">
                    <div className="min-w-[300px] max-w-[350px] font-sans p-1 bg-background text-foreground rounded-2xl shadow-2xl border border-border relative animate-in zoom-in-95 duration-200">
                        {/* Speech Bubble Arrow Tail */}
                        <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-background border-r border-b border-border rotate-45"></div>
                    <div className="mb-4 bg-muted/30 -mx-1 -mt-1 p-3 border-b border-border rounded-t-lg flex justify-between items-start gap-4">
                        <h3 className="font-bold text-lg text-primary mb-1 break-words">{event.title}</h3>
                        <div className="flex items-center gap-1 shrink-0 -mt-0.5 -mr-1">
                            <button
                                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ml-1 border-border/30 pl-2"
                                onClick={onClose}
                                title={t('buttons.close') || "Close"}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3 px-1">
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2.5 text-sm">
                            <MapPin className="w-4 h-4 text-primary/70 mt-0.5" />
                            <div>
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.place?.canonical_name || event.location}${event.address ? ` ${event.address}` : ''}`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors break-words font-medium"
                                    title={t('eventDetail.mapLink')}
                                >
                                    {event.place?.canonical_name || event.location}
                                </a>
                                {event.address && (
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block text-xs text-muted-foreground hover:text-primary hover:underline underline-offset-2 transition-colors mt-0.5 break-words"
                                        title={t('eventDetail.mapLink')}
                                    >
                                        {event.address}
                                    </a>
                                )}
                            </div>

                            <Calendar className="w-4 h-4 text-primary/70 mt-0.5" />
                            <div className="text-foreground">{event.event_date}</div>

                            {event.door_time && (
                                <>
                                    <Clock className="w-4 h-4 text-primary/70 mt-0.5" />
                                    <div className="text-foreground">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 border border-border rounded px-1 mr-1">{t('eventDetail.labels.doorTime')}</span>
                                        {event.door_time}
                                    </div>
                                </>
                            )}

                            {event.start_time && (
                                <>
                                    <Clock className="w-4 h-4 text-primary/70 mt-0.5 opacity-0 hidden" />
                                    <div className="text-foreground -ml-7 md:ml-0 md:col-start-2">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 border border-border rounded px-1 mr-1">{t('eventDetail.labels.startTime')}</span>
                                        {event.start_time}
                                    </div>
                                </>
                            )}

                            {event.end_time && (
                                <>
                                    <Clock className="w-4 h-4 text-primary/70 mt-0.5 opacity-0 hidden" />
                                    <div className="text-foreground -ml-7 md:ml-0 md:col-start-2">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 border border-border rounded px-1 mr-1">{t('eventDetail.labels.endTime')}</span>
                                        {event.end_time}
                                    </div>
                                </>
                            )}

                            {event.performers_list && event.performers_list.length > 0 && (
                                <>
                                    <Mic2 className="w-4 h-4 text-primary/70 mt-0.5" />
                                    <div className="text-foreground">
                                        {event.performers_list.map((p: any) => p.canonical_name).join(', ')}
                                    </div>
                                </>
                            )}
                        </div>

                        {event.description && (
                            <div className="mt-4 pt-3 border-t border-border/50">
                                <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">{t('eventDetail.labels.description')}</div>
                                <div className="text-sm text-foreground bg-muted/30 p-2.5 rounded-md whitespace-pre-wrap">{event.description}</div>
                            </div>
                        )}

                        {event.related_link && (
                            <div className="mt-3 pt-3 border-t border-border/50 text-right">
                                <a
                                    href={event.related_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
                                >
                                    {t('eventMap.infoWindow.link')}
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            </div>
                        )}
                    </div>
                 </div>
                    </div>
            </OverlayView>

        </>
    );
}
