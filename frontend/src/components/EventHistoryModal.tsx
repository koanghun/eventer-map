import { useEffect, useState } from 'react';
import { EventHistory } from '../types/event';
import { eventApi } from '../services/api';
import { useTranslation } from 'react-i18next';
import styles from './EventHistoryModal.module.css';

interface EventHistoryModalProps {
    eventId: number;
    onClose: () => void;
}

export default function EventHistoryModal({ eventId, onClose }: EventHistoryModalProps) {
    const { t } = useTranslation();
    const [histories, setHistories] = useState<EventHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        loadHistory();
    }, [eventId]);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const data = await eventApi.getHistory(eventId);
            setHistories(data);
            setError(null);
        } catch (err) {
            console.error('Failed to load history:', err);
            setError(t('eventDetail.history.error'));
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'created': return '➕';
            case 'updated': return '✏️';
            case 'deleted': return '🗑️';
            default: return '📝';
        }
    };

    const getActionText = (action: string) => {
        switch (action) {
            case 'created': return t('eventDetail.history.actions.created');
            case 'updated': return t('eventDetail.history.actions.updated');
            case 'deleted': return t('eventDetail.history.actions.deleted');
            default: return action;
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedId(expandedId === id ? null : id);
    };

    // 이전 버전과 비교하여 변경된 필드만 추출
    const getChangedFields = (currentHistory: EventHistory, previousHistory?: EventHistory) => {
        if (!previousHistory || currentHistory.action === 'created') {
            // 생성된 경우 모든 필드 반환
            return Object.entries(currentHistory.snapshot).filter(([_key, value]) =>
                value !== null && value !== undefined && value !== ''
            );
        }

        // 수정된 경우 변경된 필드만 반환
        const changes: [string, any, any][] = []; // [key, oldValue, newValue]
        const fieldsToCheck = ['title', 'event_date', 'location', 'address', 'door_time', 'start_time', 'end_time', 'performers', 'description', 'related_link'];

        fieldsToCheck.forEach(key => {
            const oldValue = previousHistory.snapshot[key as keyof typeof previousHistory.snapshot];
            const newValue = currentHistory.snapshot[key as keyof typeof currentHistory.snapshot];

            if (oldValue !== newValue) {
                changes.push([key, oldValue, newValue]);
            }
        });

        return changes;
    };

    const getFieldLabel = (key: string) => {
        return t(`eventDetail.history.fields.${key}`, key);
    };

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={`${styles.modalContent} ${styles.historyModal}`} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>📜 {t('eventDetail.history.title')}</h2>
                    <button className={styles.modalCloseButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.modalBody}>
                    {loading && <div className={styles.loading}>{t('eventDetail.history.loading')}</div>}

                    {error && <div className={styles.errorMessage}>{error}</div>}

                    {!loading && !error && histories.length === 0 && (
                        <div className={styles.noHistory}>{t('eventDetail.history.noHistory')}</div>
                    )}

                    {!loading && !error && histories.length > 0 && (
                        <div className={styles.historyList}>
                            {histories.map((history, index) => {
                                const previousHistory = histories[index + 1]; // 다음 인덱스가 이전 버전 (역순 정렬)
                                const changedFields = getChangedFields(history, previousHistory);

                                return (
                                    <div key={history.id} className={styles.historyItem}>
                                        <div className={styles.historyHeader}>
                                            <div className={styles.historyTime}>
                                                ⏱️ {formatDate(history.created_at)}
                                            </div>
                                            <div className={styles.historyUser}>
                                                👤 {history.user_name} ({history.user_email})
                                            </div>
                                            <div className={styles.historyAction}>
                                                {getActionIcon(history.action)} {getActionText(history.action)}
                                            </div>
                                        </div>

                                        {history.action === 'created' && (
                                            <div className={styles.historySummary}>
                                                📝 {t('eventDetail.history.createdSummary')}: {history.snapshot.title} @ {history.snapshot.location}
                                            </div>
                                        )}

                                        {history.action === 'updated' && changedFields.length > 0 && (
                                            <div className={styles.historySummary}>
                                                📝 {t('eventDetail.history.changedPrefix')}: {changedFields.map(([key]) => getFieldLabel(key)).join(', ')}
                                            </div>
                                        )}

                                        <button
                                            className={styles.historyToggle}
                                            onClick={() => toggleExpand(history.id)}
                                        >
                                            {expandedId === history.id ? t('eventDetail.history.hideDetails') : t('eventDetail.history.viewDetails')}
                                        </button>

                                        {expandedId === history.id && (
                                            <div className={styles.historyDetails}>
                                                <div className={styles.snapshotGrid}>
                                                    {history.action === 'created' ? (
                                                        // 생성된 경우: 모든 필드 표시
                                                        changedFields.map(([key, value]) => (
                                                            <div key={key} className={styles.snapshotField}>
                                                                <span className={styles.fieldLabel}>{getFieldLabel(key)}:</span>
                                                                <span className={styles.fieldValue}>{value || t('eventDetail.history.empty')}</span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        // 수정된 경우: 변경된 필드만 표시 (이전 → 이후)
                                                        changedFields.map(([key, oldValue, newValue]) => (
                                                            <div key={key} className={`${styles.snapshotField} ${styles.changed}`}>
                                                                <span className={styles.fieldLabel}>{getFieldLabel(key)}:</span>
                                                                <div className={styles.fieldChange}>
                                                                    <div className={styles.fieldOld}>
                                                                        <span className={styles.changeLabel}>{t('eventDetail.history.before')}:</span>
                                                                        <span className={styles.changeValue}>{oldValue || t('eventDetail.history.empty')}</span>
                                                                    </div>
                                                                    <div className={styles.changeArrow}>→</div>
                                                                    <div className={styles.fieldNew}>
                                                                        <span className={styles.changeLabel}>{t('eventDetail.history.after')}:</span>
                                                                        <span className={styles.changeValue}>{newValue || t('eventDetail.history.empty')}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                    {history.action === 'updated' && changedFields.length === 0 && (
                                                        <div className={styles.noChanges}>{t('eventDetail.history.noChanges')}</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
