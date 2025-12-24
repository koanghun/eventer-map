import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { eventApi } from '../services/api';
import { Event, EventReportResponse } from '../types/event';
import styles from './ReportManagementModal.module.css';

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
            // Filter events that have reports
            const eventsWithReports = allEvents.filter(event => (event.report_count || 0) > 0);
            // Sort by report count (highest first)
            eventsWithReports.sort((a, b) => (b.report_count || 0) - (a.report_count || 0));
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
            case 'spam': return '🚫';
            case 'inappropriate': return '⚠️';
            case 'wrong_info': return '❌';
            case 'other': return '📝';
            default: return '📢';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return styles.statusPending;
            case 'reviewed': return styles.statusReviewed;
            case 'resolved': return styles.statusResolved;
            default: return styles.statusPending;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    const modalContent = (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>📊 {t('admin.reports.title')}</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.body}>
                    {loading ? (
                        <div className={styles.loadingState}>
                            <div className={styles.spinner}></div>
                            <p>{t('admin.reports.loading')}</p>
                        </div>
                    ) : selectedEvent ? (
                        // Report Details View
                        <div className={styles.detailsView}>
                            <button className={styles.backButton} onClick={handleBackToList}>
                                ← {t('admin.reports.backToList')}
                            </button>

                            <div className={styles.eventHeader}>
                                <h3>{selectedEvent.title}</h3>
                                <div className={styles.eventMeta}>
                                    <span>📅 {selectedEvent.event_date}</span>
                                    <span>📍 {selectedEvent.location}</span>
                                    <span className={styles.reportBadge}>
                                        {selectedEvent.report_count} {t('admin.reports.reportCount', { count: selectedEvent.report_count })}
                                    </span>
                                </div>
                            </div>

                            {loadingReports ? (
                                <div className={styles.loadingState}>
                                    <div className={styles.spinner}></div>
                                    <p>{t('admin.reports.loadingReports')}</p>
                                </div>
                            ) : error ? (
                                <div className={styles.errorMessage}>{error}</div>
                            ) : reports.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <p>{t('admin.reports.noReportsForEvent')}</p>
                                </div>
                            ) : (
                                <div className={styles.reportsList}>
                                    {reports.map((report) => (
                                        <div key={report.id} className={styles.reportCard}>
                                            <div className={styles.reportHeader}>
                                                <div className={styles.reportReason}>
                                                    <span className={styles.reasonIcon}>{getReasonIcon(report.reason)}</span>
                                                    <strong>{t(`eventDetail.report.reasons.${report.reason}`)}</strong>
                                                </div>
                                                <span className={`${styles.statusBadge} ${getStatusColor(report.status)}`}>
                                                    {t(`admin.reports.statuses.${report.status}`)}
                                                </span>
                                            </div>

                                            <div className={styles.reportInfo}>
                                                <div className={styles.infoRow}>
                                                    <span className={styles.infoLabel}>{t('admin.reports.reporter')}:</span>
                                                    <span className={styles.infoValue}>{report.reporter_name || t('admin.reports.anonymous')}</span>
                                                </div>
                                                <div className={styles.infoRow}>
                                                    <span className={styles.infoLabel}>{t('admin.reports.reportedAt')}:</span>
                                                    <span className={styles.infoValue}>{formatDate(report.created_at)}</span>
                                                </div>
                                            </div>

                                            {report.description && (
                                                <div className={styles.reportDescription}>
                                                    <span className={styles.infoLabel}>{t('admin.reports.description')}:</span>
                                                    <p>{report.description}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        // Event List View
                        <div className={styles.listView}>
                            <p className={styles.listSubtitle}>{t('admin.reports.eventList')}</p>

                            {events.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <p>🎉 {t('admin.reports.noReports')}</p>
                                </div>
                            ) : (
                                <div className={styles.eventsList}>
                                    {events.map((event) => (
                                        <div
                                            key={event.id}
                                            className={styles.eventItem}
                                            onClick={() => handleEventClick(event)}
                                        >
                                            <div className={styles.eventInfo}>
                                                <h4>{event.title}</h4>
                                                <div className={styles.eventDetails}>
                                                    <span>📅 {event.event_date}</span>
                                                    <span>📍 {event.location}</span>
                                                </div>
                                            </div>
                                            <div className={styles.countBadge}>
                                                {event.report_count}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    // Render modal using React Portal to document.body
    return createPortal(modalContent, document.body);
}

