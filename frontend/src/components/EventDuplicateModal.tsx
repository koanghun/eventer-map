import ReactDOM from 'react-dom';
import styles from './EventDuplicateModal.module.css';

interface DuplicateEvent {
    event_id: number;
    event_title: string;
    event_date: string;
    location: string;
    start_time?: string;
    performers: string[];
    similarity_score: number;
    recommendation: string;
    matched_criteria: {
        same_date: boolean;
        same_location: boolean;
        same_time: boolean;
        distance_meters?: number;
        time_diff_minutes?: number;
        performer_similarity: number;
        title_similarity: number;
    };
}

interface EventDuplicateModalProps {
    duplicates: DuplicateEvent[];
    onClose: () => void;
    onProceed: () => void;
    onEdit: (eventId: number) => void;
}

function EventDuplicateModal({
    duplicates,
    onClose,
    onProceed,
    onEdit
}: EventDuplicateModalProps) {
    const renderSimilarityBadge = (score: number, recommendation: string) => {
        let className = 'similarity-badge';
        if (recommendation === 'duplicate') className += ' duplicate';
        else if (recommendation === 'similar') className += ' similar';
        else className += ' maybe';

        const percentClass = score >= 0.7 ? styles.high : score >= 0.5 ? styles.medium : 'low';

        return (
            <div className={`${className} percent-${percentClass}`}>
                유사도: {Math.round(score * 100)}%
            </div>
        );
    };

    const modalContent = (
        <div className={styles.duplicateModalOverlay} onClick={onClose}>
            <div className={styles.duplicateModalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.duplicateModalHeader}>
                    <h3>⚠️ 중복 가능성 감지</h3>
                    <button className={styles.btnClose} onClick={onClose}>×</button>
                </div>

                <div className={styles.duplicateModalBody}>
                    <p className={styles.duplicateWarning}>
                        <strong>{duplicates.length}개</strong>의 유사한 이벤트가 발견되었습니다.
                    </p>

                    <div className={styles.duplicateEventsList}>
                        {duplicates.map(dup => (
                            <div key={dup.event_id} className={styles.duplicateEventCard}>
                                <div className={styles.duplicateEventHeader}>
                                    <h4>{dup.event_title}</h4>
                                    {renderSimilarityBadge(dup.similarity_score, dup.recommendation)}
                                </div>

                                <div className={styles.duplicateEventInfo}>
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>장소:</span>
                                        <span className={styles.infoValue}>{dup.location}</span>
                                    </div>
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>날짜:</span>
                                        <span className={styles.infoValue}>{dup.event_date}</span>
                                    </div>
                                    {dup.start_time && (
                                        <div className={styles.infoRow}>
                                            <span className={styles.infoLabel}>시간:</span>
                                            <span className={styles.infoValue}>{dup.start_time}</span>
                                        </div>
                                    )}
                                    {dup.performers.length > 0 && (
                                        <div className={styles.infoRow}>
                                            <span className={styles.infoLabel}>출연자:</span>
                                            <span className={styles.infoValue}>{dup.performers.join(', ')}</span>
                                        </div>
                                    )}
                                </div>

                                <div className={styles.duplicateCriteria}>
                                    <div className={styles.criteriaItem}>
                                        <span>제목</span>
                                        <div className={styles.criteriaBar}>
                                            <div
                                                className={styles.criteriaFill}
                                                style={{ width: `${dup.matched_criteria.title_similarity * 100}%` }}
                                            ></div>
                                        </div>
                                        <span>{Math.round(dup.matched_criteria.title_similarity * 100)}%</span>
                                    </div>
                                    <div className={styles.criteriaItem}>
                                        <span>출연자</span>
                                        <div className={styles.criteriaBar}>
                                            <div
                                                className={styles.criteriaFill}
                                                style={{ width: `${dup.matched_criteria.performer_similarity * 100}%` }}
                                            ></div>
                                        </div>
                                        <span>{Math.round(dup.matched_criteria.performer_similarity * 100)}%</span>
                                    </div>
                                    {dup.matched_criteria.distance_meters !== null && (
                                        <div className={styles.criteriaItem}>
                                            <span>거리</span>
                                            <span className={styles.distanceValue}>{Math.round(dup.matched_criteria.distance_meters!)}m</span>
                                        </div>
                                    )}
                                </div>

                                <button
                                    className={styles.btnEditExisting}
                                    onClick={() => onEdit(dup.event_id)}
                                >
                                    이 이벤트 수정하기
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.duplicateModalFooter}>
                    <button className={styles.btnCancelModal} onClick={onClose}>
                        취소
                    </button>
                    <button className={styles.btnProceedAnyway} onClick={onProceed}>
                        그래도 등록하기
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
}

export default EventDuplicateModal;
