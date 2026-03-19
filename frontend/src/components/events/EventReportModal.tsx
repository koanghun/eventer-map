import React, { useState } from 'react';
import { eventApi } from '../../services/api';
import { useTranslation } from 'react-i18next';
import styles from './EventReportModal.module.css';

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
            <div className={styles.modalOverlay} onClick={onClose}>
                <div className={`${styles.modalContent} ${styles.reportModal}`} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.successMessage}>
                        <div className={styles.successIcon}>✅</div>
                        <h3>{t('eventDetail.report.success')}</h3>
                        <p>{t('eventDetail.report.successMessage')}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={`${styles.modalContent} ${styles.reportModal}`} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>🚨 {t('eventDetail.report.title')}</h2>
                    <button className={styles.modalCloseButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.modalBody}>
                    <div className={styles.eventInfo}>
                        <strong>{t('eventDetail.report.eventLabel')}:</strong> {eventTitle}
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>{t('eventDetail.report.reasonLabel')}</label>
                            <div className={styles.reasonOptions}>
                                {reasons.map((r) => (
                                    <label key={r.value} className={`${styles.reasonOption} ${reason === r.value ? styles.selected : ''}`}>
                                        <input
                                            type="radio"
                                            name="reason"
                                            value={r.value}
                                            checked={reason === r.value}
                                            onChange={(e) => setReason(e.target.value)}
                                        />
                                        <div className={styles.reasonContent}>
                                            <div className={styles.reasonLabel}>{r.label}</div>
                                            <div className={styles.reasonDescription}>{r.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="description" className={styles.formLabel}>
                                {t('eventDetail.report.descriptionLabel')}:
                            </label>
                            <textarea
                                id="description"
                                className={styles.formTextarea}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('eventDetail.report.descriptionPlaceholder')}
                                rows={4}
                                maxLength={500}
                            />
                            <div className={styles.charCount}>{description.length}/500</div>
                        </div>

                        {error && <div className={styles.errorMessage}>{error}</div>}

                        <div className={styles.formActions}>
                            <button
                                type="button"
                                className={styles.btnCancel}
                                onClick={onClose}
                                disabled={submitting}
                            >
                                {t('buttons.cancel')}
                            </button>
                            <button
                                type="submit"
                                className={styles.btnSubmit}
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
