import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { eventApi } from '../../services/api';
import { Event, EventReportResponse } from '../../types/event';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { BarChart, X, ArrowLeft, Calendar, MapPin, AlertCircle, AlertTriangle, XCircle, FileText, User, Clock, CheckCircle2 } from 'lucide-react';

interface ReportManagementModalProps {
    onClose: () => void;
}

export default function ReportManagementModal({ onClose }: ReportManagementModalProps) {
    const { t } = useTranslation();
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [reports, setReports] = useState<EventReportResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingReports, setLoadingReports] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchEventsWithReports();
    }, []);

    const fetchEventsWithReports = async () => {
        try {
            setLoading(true);
            const allEvents = await eventApi.getAllEvents();
            const eventsWithReports = allEvents.filter((event: Event) => (event.report_count || 0) > 0);
            eventsWithReports.sort((a: Event, b: Event) => (b.report_count || 0) - (a.report_count || 0));
            setEvents(eventsWithReports);
        } catch (err) {
            console.error('Failed to fetch events:', err);
            setError(t('admin.reports.errorLoadingEvents'));
        } finally {
            setLoading(false);
        }
    };

    const handleEventClick = async (event: Event) => {
        if (!event.id) return;

        setSelectedEvent(event);
        setLoadingReports(true);
        setError(null);

        try {
            const eventReports = await eventApi.getEventReports(event.id);
            setReports(eventReports);
        } catch (err: any) {
            console.error('Failed to fetch reports:', err);
            if (err.response?.status === 403) {
                setError(t('admin.reports.accessDenied'));
            } else {
                setError(t('admin.reports.errorLoadingReports'));
            }
        } finally {
            setLoadingReports(false);
        }
    };

    const handleBackToList = () => {
        setSelectedEvent(null);
        setReports([]);
        setError(null);
    };

    const getReasonIcon = (reason: string) => {
        switch (reason) {
            case 'spam': return <AlertCircle className="w-4 h-4 text-destructive" />;
            case 'inappropriate': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
            case 'wrong_info': return <XCircle className="w-4 h-4 text-orange-500" />;
            case 'other': return <FileText className="w-4 h-4 text-blue-500" />;
            default: return <FileText className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-amber-100/50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-500 border-amber-200 dark:border-amber-800/50';
            case 'reviewed': return 'bg-blue-100/50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500 border-blue-200 dark:border-blue-800/50';
            case 'resolved': return 'bg-green-100/50 text-green-800 dark:bg-green-900/30 dark:text-green-500 border-green-200 dark:border-green-800/50';
            default: return 'bg-muted text-muted-foreground';
        }
    };

    const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

    const modalContent = (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-4xl bg-background rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col h-[85vh] animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2 text-primary font-bold text-xl">
                        <BarChart className="w-6 h-6" />
                        {t('admin.reports.title')}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                            <p>{t('admin.reports.loading')}</p>
                        </div>
                    ) : selectedEvent ? (
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-border bg-card flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                <Button variant="outline" size="sm" onClick={handleBackToList} className="shrink-0 text-muted-foreground hover:text-foreground">
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    {t('admin.reports.backToList')}
                                </Button>
                                
                                <div className="flex-1 min-w-0 flex flex-col items-end text-sm">
                                    <h3 className="font-bold text-lg truncate w-full text-right">{selectedEvent.title}</h3>
                                    <div className="flex flex-wrap justify-end gap-3 text-muted-foreground mt-1">
                                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{selectedEvent.event_date}</span>
                                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{selectedEvent.location}</span>
                                        <Badge variant="destructive" className="ml-1">{selectedEvent.report_count} {t('admin.reports.reportCount', { count: selectedEvent.report_count })}</Badge>
                                    </div>
                                </div>
                            </div>

                            <ScrollArea className="flex-1 p-4 bg-muted/10">
                                {loadingReports ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                                        <p>{t('admin.reports.loadingReports')}</p>
                                    </div>
                                ) : error ? (
                                    <div className="p-4 text-destructive bg-destructive/10 rounded-lg text-center border border-destructive/20 max-w-lg mx-auto mt-8">{error}</div>
                                ) : reports.length === 0 ? (
                                    <div className="text-center py-16 text-muted-foreground flex flex-col items-center">
                                        <CheckCircle2 className="w-12 h-12 text-green-500/50 mb-4" />
                                        <p>{t('admin.reports.noReportsForEvent')}</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                                        {reports.map((report) => (
                                            <div key={report.id} className="bg-card border border-border shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
                                                <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-start">
                                                    <div className="flex items-start gap-2 max-w-[70%]">
                                                        <div className="mt-1 shrink-0">{getReasonIcon(report.reason)}</div>
                                                        <strong className="font-semibold text-foreground leading-tight">{t(`eventDetail.report.reasons.${report.reason}`)}</strong>
                                                    </div>
                                                    <div className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(report.status)} shrink-0`}>
                                                        {t(`admin.reports.statuses.${report.status}`)}
                                                    </div>
                                                </div>

                                                <div className="p-4 flex-1 flex flex-col gap-4 text-sm text-muted-foreground">
                                                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                                                        <User className="w-4 h-4 text-muted-foreground/70 justify-self-center mt-0.5" />
                                                        <span>{report.reporter_name || <span className="italic">{t('admin.reports.anonymous')}</span>}</span>
                                                        
                                                        <Clock className="w-4 h-4 text-muted-foreground/70 justify-self-center mt-0.5" />
                                                        <span>{formatDate(report.created_at)}</span>
                                                    </div>

                                                    {report.description && (
                                                        <div className="mt-auto pt-3 border-t border-border/50">
                                                            <strong className="text-xs uppercase tracking-wider text-muted-foreground/80 block mb-1.5">{t('admin.reports.description')}</strong>
                                                            <p className="text-foreground bg-muted/40 p-3 rounded-md italic text-sm border border-border/50 whitespace-pre-wrap">"{report.description}"</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="p-4 px-6 border-b border-border bg-muted/20">
                                <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-xs">{t('admin.reports.eventList')}</h3>
                            </div>

                            <ScrollArea className="flex-1 p-4 sm:p-6 bg-muted/5">
                                {events.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                        <span className="text-4xl mb-4">🎉</span>
                                        <p className="font-medium text-lg">{t('admin.reports.noReports')}</p>
                                        <p className="text-sm mt-1">모든 이슈가 해결되었거나 신고된 사항이 없습니다.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
                                        {events.map((event) => (
                                            <div
                                                key={event.id}
                                                className="group bg-card border border-border p-5 rounded-xl flex items-center justify-between cursor-pointer hover:border-primary/50 hover:shadow-md transition-all active:scale-[0.99]"
                                                onClick={() => handleEventClick(event)}
                                            >
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <h4 className="font-bold text-foreground truncate group-hover:text-primary transition-colors text-base mb-1.5">{event.title}</h4>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground truncate">
                                                        <span className="flex items-center gap-1 shrink-0"><Calendar className="w-3.5 h-3.5" />{event.event_date}</span>
                                                        <span className="flex items-center gap-1 truncate"><MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{event.place?.canonical_name || event.location}</span></span>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10 text-destructive font-bold text-lg ring-4 ring-transparent group-hover:bg-destructive group-hover:text-destructive-foreground group-hover:ring-destructive/20 transition-all">
                                                    {event.report_count}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
