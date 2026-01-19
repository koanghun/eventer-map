import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './EventDuplicateModal.module.css';

/**
 * 중복 이벤트 정보를 나타내는 인터페이스
 * Interface representing duplicate event information
 */
interface DuplicateEvent {
    event_id: number; // 이벤트 고유 ID
    event_title: string; // 이벤트 제목
    event_date: string; // 이벤트 날짜
    location: string; // 장소명
    start_time?: string; // 시작 시간 (선택적)
    performers: string[]; // 출연자 목록
    similarity_score: number; // 유사도 점수 (0.0 ~ 1.0)
    recommendation: string; // 추천 판정 ('duplicate', 'similar', 'maybe')
    matched_criteria: {
        // 일치 기준 정보
        same_date: boolean; // 같은 날짜 여부
        same_location: boolean; // 같은 장소 여부
        same_time: boolean; // 같은 시간 여부
        distance_meters?: number; // 거리 (미터 단위)
        time_diff_minutes?: number; // 시간 차이 (분 단위)
        performer_similarity: number; // 출연자 유사도 (0.0 ~ 1.0)
        title_similarity: number; // 제목 유사도 (0.0 ~ 1.0)
    };
}

/**
 * EventDuplicateModal 컴포넌트 Props
 */
interface EventDuplicateModalProps {
    duplicates: DuplicateEvent[]; // 중복 가능성이 있는 이벤트 목록
    onClose: () => void; // 모달 닫기 핸들러
    onProceed: () => void; // 중복 무시하고 진행 핸들러
    onEdit: (eventId: number) => void; // 기존 이벤트 수정 핸들러
}

/**
 * 이벤트 중복 가능성 경고 모달 컴포넌트
 * 새 이벤트 등록 시 중복 가능성이 있는 기존 이벤트를 표시하고,
 * 사용자가 기존 이벤트를 수정하거나 새 이벤트를 등록할 수 있도록 함
 */
function EventDuplicateModal({
    duplicates,
    onClose,
    onProceed,
    onEdit
}: EventDuplicateModalProps) {
    // react-i18next의 번역 함수 가져오기
    const { t } = useTranslation();

    /**
     * 유사도 점수에 따른 배지 렌더링 함수
     * @param score - 유사도 점수 (0.0 ~ 1.0)
     * @param recommendation - 추천 판정 타입
     * @returns 유사도 배지 JSX 엘리먼트
     */
    const renderSimilarityBadge = (score: number, recommendation: string) => {
        // 추천 타입에 따라 클래스명 설정
        let className = 'similarity-badge';
        if (recommendation === 'duplicate') className += ' duplicate';
        else if (recommendation === 'similar') className += ' similar';
        else className += ' maybe';

        return (
            <div className={`${className}`}>
                {t('eventDuplicateModal.similarity')}: {Math.round(score * 100)}%
            </div>
        );
    };

    // 모달 콘텐츠 렌더링
    const modalContent = (
        // 오버레이: 클릭 시 모달 닫기
        <div className={styles.duplicateModalOverlay} onClick={onClose}>
            {/* 모달 본체: 이벤트 버블링 방지 */}
            <div className={styles.duplicateModalContent} onClick={(e) => e.stopPropagation()}>
                {/* 모달 헤더 */}
                <div className={styles.duplicateModalHeader}>
                    <h3>{t('eventDuplicateModal.title')}</h3>
                    <button className={styles.btnClose} onClick={onClose}>×</button>
                </div>

                {/* 모달 본문 */}
                <div className={styles.duplicateModalBody}>
                    {/* 경고 메시지 */}
                    <p className={styles.duplicateWarning} dangerouslySetInnerHTML={{
                        __html: t('eventDuplicateModal.warningMessage', { count: duplicates.length })
                    }} />

                    {/* 중복 이벤트 목록 */}
                    <div className={styles.duplicateEventsList}>
                        {duplicates.map(dup => (
                            <div key={dup.event_id} className={styles.duplicateEventCard}>
                                {/* 이벤트 카드 헤더: 제목 + 유사도 배지 */}
                                <div className={styles.duplicateEventHeader}>
                                    <h4>{dup.event_title}</h4>
                                    {renderSimilarityBadge(dup.similarity_score, dup.recommendation)}
                                </div>

                                {/* 이벤트 기본 정보 */}
                                <div className={styles.duplicateEventInfo}>
                                    {/* 장소 */}
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>
                                            {t('eventDuplicateModal.labels.location')}:
                                        </span>
                                        <span className={styles.infoValue}>{dup.location}</span>
                                    </div>
                                    {/* 날짜 */}
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>
                                            {t('eventDuplicateModal.labels.date')}:
                                        </span>
                                        <span className={styles.infoValue}>{dup.event_date}</span>
                                    </div>
                                    {/* 시간 (선택적) */}
                                    {dup.start_time && (
                                        <div className={styles.infoRow}>
                                            <span className={styles.infoLabel}>
                                                {t('eventDuplicateModal.labels.time')}:
                                            </span>
                                            <span className={styles.infoValue}>{dup.start_time}</span>
                                        </div>
                                    )}
                                    {/* 출연자 (선택적) */}
                                    {dup.performers.length > 0 && (
                                        <div className={styles.infoRow}>
                                            <span className={styles.infoLabel}>
                                                {t('eventDuplicateModal.labels.performers')}:
                                            </span>
                                            <span className={styles.infoValue}>{dup.performers.join(', ')}</span>
                                        </div>
                                    )}
                                </div>

                                {/* 세부 일치 기준 시각화 */}
                                <div className={styles.duplicateCriteria}>
                                    {/* 제목 유사도 바 */}
                                    <div className={styles.criteriaItem}>
                                        <span>{t('eventDuplicateModal.labels.title')}</span>
                                        <div className={styles.criteriaBar}>
                                            <div
                                                className={styles.criteriaFill}
                                                style={{ width: `${dup.matched_criteria.title_similarity * 100}%` }}
                                            ></div>
                                        </div>
                                        <span>{Math.round(dup.matched_criteria.title_similarity * 100)}%</span>
                                    </div>
                                    {/* 출연자 유사도 바 */}
                                    <div className={styles.criteriaItem}>
                                        <span>{t('eventDuplicateModal.labels.performers')}</span>
                                        <div className={styles.criteriaBar}>
                                            <div
                                                className={styles.criteriaFill}
                                                style={{ width: `${dup.matched_criteria.performer_similarity * 100}%` }}
                                            ></div>
                                        </div>
                                        <span>{Math.round(dup.matched_criteria.performer_similarity * 100)}%</span>
                                    </div>
                                    {/* 거리 정보 (있는 경우) */}
                                    {dup.matched_criteria.distance_meters !== null && (
                                        <div className={styles.criteriaItem}>
                                            <span>{t('eventDuplicateModal.labels.distance')}</span>
                                            <span className={styles.distanceValue}>
                                                {Math.round(dup.matched_criteria.distance_meters!)}m
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* 기존 이벤트 수정 버튼 */}
                                <button
                                    className={styles.btnEditExisting}
                                    onClick={() => onEdit(dup.event_id)}
                                >
                                    {t('eventDuplicateModal.buttons.editExisting')}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 모달 푸터: 취소 및 진행 버튼 */}
                <div className={styles.duplicateModalFooter}>
                    <button className={styles.btnCancelModal} onClick={onClose}>
                        {t('eventDuplicateModal.buttons.cancel')}
                    </button>
                    <button className={styles.btnProceedAnyway} onClick={onProceed}>
                        {t('eventDuplicateModal.buttons.proceedAnyway')}
                    </button>
                </div>
            </div>
        </div>
    );

    // ReactDOM.createPortal을 사용하여 모달을 document.body에 직접 렌더링
    // 이를 통해 z-index 문제를 피하고, 부모 컴포넌트의 스타일에 영향받지 않음
    return ReactDOM.createPortal(modalContent, document.body);
}

export default EventDuplicateModal;
