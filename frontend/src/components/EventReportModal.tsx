import React, { useState } from 'react';
import { eventApi } from '../services/api';
import { useTranslation } from 'react-i18next';
import './EventReportModal.css';

interface EventReportModalProps {
    eventId: number;
    eventTitle: string;
    onClose: () => void;
}

export default function EventReportModal({ eventId, eventTitle, onClose }: EventReportModalProps) {
    const { t } = useTranslation();
    const [reason, setReason] = useState<string>('spam');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const reasons = [
        { value: 'spam', label: `🚫 ${t('eventDetail.report.reasons.spam')}`, description: t('eventDetail.report.reasons.spamDesc') },
        { value: 'inappropriate', label: `⚠️ ${t('eventDetail.report.reasons.inappropriate')}`, description: t('eventDetail.report.reasons.inappropriateDesc') },
        { value: 'wrong_info', label: `❌ ${t('eventDetail.report.reasons.wrong_info')}`, description: t('eventDetail.report.reasons.wrong_infoDesc') },
        { value: 'other', label: `📝 ${t('eventDetail.report.reasons.other')}`, description: t('eventDetail.report.reasons.otherDesc') }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setSubmitting(true);
        setError(null);

        try {
            await eventApi.reportEvent(eventId, {
                reason,
                description: description.trim() || undefined
            });
            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err: any) {
            console.error('Failed to submit report:', err);
            if (err.response?.status === 400) {
                setError(t('eventDetail.report.alreadyReported'));
            } else {
                setError(t('eventDetail.report.error'));
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content report-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="success-message">
                        <div className="success-icon">✅</div>
                        <h3>{t('eventDetail.report.success')}</h3>
                        <p>{t('eventDetail.report.successMessage')}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content report-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>🚨 {t('eventDetail.report.title')}</h2>
                    <button className="modal-close-button" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="event-info">
                        <strong>{t('eventDetail.report.eventLabel')}:</strong> {eventTitle}
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">{t('eventDetail.report.reasonLabel')}</label>
                            <div className="reason-options">
                                {reasons.map((r) => (
                                    <label key={r.value} className={`reason-option ${reason === r.value ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="reason"
                                            value={r.value}
                                            checked={reason === r.value}
                                            onChange={(e) => setReason(e.target.value)}
                                        />
                                        <div className="reason-content">
                                            <div className="reason-label">{r.label}</div>
                                            <div className="reason-description">{r.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="description" className="form-label">
                                {t('eventDetail.report.descriptionLabel')}:
                            </label>
                            <textarea
                                id="description"
                                className="form-textarea"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('eventDetail.report.descriptionPlaceholder')}
                                rows={4}
                                maxLength={500}
                            />
                            <div className="char-count">{description.length}/500</div>
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn-cancel"
                                onClick={onClose}
                                disabled={submitting}
                            >
                                {t('buttons.cancel')}
                            </button>
                            <button
                                type="submit"
                                className="btn-submit"
                                disabled={submitting}
                            >
                                {submitting ? t('eventDetail.report.submitting') : t('eventDetail.report.submit')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
