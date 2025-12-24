import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { eventApi } from '../services/api';
import { Event, EventReportResponse } from '../types/event';
import './ReportManagementModal.css';

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
            case 'pending': return 'status-pending';
            case 'reviewed': return 'status-reviewed';
            case 'resolved': return 'status-resolved';
            default: return 'status-pending';
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    const modalContent = (
        <div className="report-management-overlay" onClick={onClose}>
            <div className="report-management-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📊 {t('admin.reports.title')}</h2>
                    <button className="report-management-close-button" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>{t('admin.reports.loading')}</p>
                        </div>
                    ) : selectedEvent ? (
                        // Report Details View
                        <div className="report-details-view">
                            <button className="back-button" onClick={handleBackToList}>
                                ← {t('admin.reports.backToList')}
                            </button>

                            <div className="event-header">
                                <h3>{selectedEvent.title}</h3>
                                <div className="event-meta">
                                    <span>📅 {selectedEvent.event_date}</span>
                                    <span>📍 {selectedEvent.location}</span>
                                    <span className="report-badge">
                                        {selectedEvent.report_count} {t('admin.reports.reportCount', { count: selectedEvent.report_count })}
                                    </span>
                                </div>
                            </div>

                            {loadingReports ? (
                                <div className="loading-state">
                                    <div className="spinner"></div>
                                    <p>{t('admin.reports.loadingReports')}</p>
                                </div>
                            ) : error ? (
                                <div className="error-message">{error}</div>
                            ) : reports.length === 0 ? (
                                <div className="empty-state">
                                    <p>{t('admin.reports.noReportsForEvent')}</p>
                                </div>
                            ) : (
                                <div className="reports-list">
                                    {reports.map((report) => (
                                        <div key={report.id} className="report-card">
                                            <div className="report-header">
                                                <div className="report-reason">
                                                    <span className="reason-icon">{getReasonIcon(report.reason)}</span>
                                                    <strong>{t(`eventDetail.report.reasons.${report.reason}`)}</strong>
                                                </div>
                                                <span className={`status-badge ${getStatusColor(report.status)}`}>
                                                    {t(`admin.reports.statuses.${report.status}`)}
                                                </span>
                                            </div>

                                            <div className="report-info">
                                                <div className="info-row">
                                                    <span className="info-label">{t('admin.reports.reporter')}:</span>
                                                    <span className="info-value">{report.reporter_name || t('admin.reports.anonymous')}</span>
                                                </div>
                                                <div className="info-row">
                                                    <span className="info-label">{t('admin.reports.reportedAt')}:</span>
                                                    <span className="info-value">{formatDate(report.created_at)}</span>
                                                </div>
                                            </div>

                                            {report.description && (
                                                <div className="report-description">
                                                    <span className="info-label">{t('admin.reports.description')}:</span>
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
                        <div className="event-list-view">
                            <p className="list-subtitle">{t('admin.reports.eventList')}</p>

                            {events.length === 0 ? (
                                <div className="empty-state">
                                    <p>🎉 {t('admin.reports.noReports')}</p>
                                </div>
                            ) : (
                                <div className="events-list">
                                    {events.map((event) => (
                                        <div
                                            key={event.id}
                                            className="event-item"
                                            onClick={() => handleEventClick(event)}
                                        >
                                            <div className="report-event-info">
                                                <h4>{event.title}</h4>
                                                <div className="event-details">
                                                    <span>📅 {event.event_date}</span>
                                                    <span>📍 {event.location}</span>
                                                </div>
                                            </div>
                                            <div className="report-count-badge">
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
