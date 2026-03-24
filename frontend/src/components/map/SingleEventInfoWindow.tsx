import { InfoWindow } from '@react-google-maps/api';
import { Event } from '../../types/event';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';
import EventHistoryModal from '../events/EventHistoryModal';
import EventReportModal from '../events/EventReportModal';
import { MapPin, Calendar, Clock, Mic2, ExternalLink, History, AlertTriangle, Flag } from 'lucide-react';

interface SingleEventInfoWindowProps {
    event: Event;
    position: { lat: number; lng: number };
    onClose: () => void;
}

export default function SingleEventInfoWindow({
    event,
    position,
    onClose
}: SingleEventInfoWindowProps) {
    const { t } = useTranslation();
    const { isAuthenticated, flaggedEventIds, toggleFlag } = useAuth();
    const isFlagged = flaggedEventIds.includes(event.id || 0);

    const [showHistory, setShowHistory] = useState(false);
    const [showReport, setShowReport] = useState(false);

    return (
        <>
            <InfoWindow position={position} onCloseClick={onClose}>
                <div className="min-w-[300px] max-w-[350px] font-sans p-1">
                    <div className="mb-4 bg-muted/30 -mx-1 -mt-1 p-3 border-b border-border rounded-t-lg flex justify-between items-start gap-4">
                        <h3 className="font-bold text-lg text-primary mb-1 break-words">{event.title}</h3>
                        <div className="flex items-center gap-1 shrink-0 -mt-0.5 -mr-1">
                            <button
                                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                onClick={() => setShowHistory(true)}
                                title="View History"
                            >
                                <History className="w-4 h-4" />
                            </button>
                            {isAuthenticated && (
                                <>
                                    <button
                                        className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                        onClick={() => setShowReport(true)}
                                        title="Report Event"
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                    </button>
                                    <button
                                        className={`p-1.5 rounded-md transition-colors ${
                                            isFlagged 
                                            ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' 
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                        }`}
                                        onClick={() => event.id && toggleFlag(event.id)}
                                        title={isFlagged ? t('eventDetail.flags.remove') : t('eventDetail.flags.add')}
                                    >
                                        <Flag className={`w-4 h-4 ${isFlagged ? 'fill-current' : ''}`} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3 px-1">
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2.5 text-sm">
                            <MapPin className="w-4 h-4 text-primary/70 mt-0.5" />
                            <div>
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors break-words font-medium"
                                    title={t('eventDetail.mapLink')}
                                >
                                    {event.location}
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

                            {event.performers && (
                                <>
                                    <Mic2 className="w-4 h-4 text-primary/70 mt-0.5" />
                                    <div className="text-foreground">{event.performers}</div>
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
            </InfoWindow>

            {showHistory && event.id && (
                <EventHistoryModal
                    eventId={event.id}
                    onClose={() => setShowHistory(false)}
                />
            )}

            {showReport && event.id && (
                <EventReportModal
                    eventId={event.id}
                    eventTitle={event.title}
                    onClose={() => setShowReport(false)}
                />
            )}
        </>
    );
}
