import React from 'react';
import ReactDOM from 'react-dom';
import './EventDuplicateModal.css';

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

const EventDuplicateModal: React.FC<EventDuplicateModalProps> = ({
    duplicates,
    onClose,
    onProceed,
    onEdit
}) => {
    const renderSimilarityBadge = (score: number, recommendation: string) => {
        let className = 'similarity-badge';
        if (recommendation === 'duplicate') className += ' duplicate';
        else if (recommendation === 'similar') className += ' similar';
        else className += ' maybe';

        const percentClass = score >= 0.7 ? 'high' : score >= 0.5 ? 'medium' : 'low';

        return (
            <div className={`${className} percent-${percentClass}`}>
                유사도: {Math.round(score * 100)}%
            </div>
        );
    };

    const modalContent = (
        <div className="duplicate-modal-overlay" onClick={onClose}>
            <div className="duplicate-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="duplicate-modal-header">
                    <h3>⚠️ 중복 가능성 감지</h3>
                    <button className="btn-close" onClick={onClose}>×</button>
                </div>

                <div className="duplicate-modal-body">
                    <p className="duplicate-warning">
                        <strong>{duplicates.length}개</strong>의 유사한 이벤트가 발견되었습니다.
                    </p>

                    <div className="duplicate-events-list">
                        {duplicates.map(dup => (
                            <div key={dup.event_id} className="duplicate-event-card">
                                <div className="duplicate-event-header">
                                    <h4>{dup.event_title}</h4>
                                    {renderSimilarityBadge(dup.similarity_score, dup.recommendation)}
                                </div>

                                <div className="duplicate-event-info">
                                    <div className="info-row">
                                        <span className="info-label">장소:</span>
                                        <span className="info-value">{dup.location}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">날짜:</span>
                                        <span className="info-value">{dup.event_date}</span>
                                    </div>
                                    {dup.start_time && (
                                        <div className="info-row">
                                            <span className="info-label">시간:</span>
                                            <span className="info-value">{dup.start_time}</span>
                                        </div>
                                    )}
                                    {dup.performers.length > 0 && (
                                        <div className="info-row">
                                            <span className="info-label">출연자:</span>
                                            <span className="info-value">{dup.performers.join(', ')}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="duplicate-criteria">
                                    <div className="criteria-item">
                                        <span>제목</span>
                                        <div className="criteria-bar">
                                            <div
                                                className="criteria-fill"
                                                style={{ width: `${dup.matched_criteria.title_similarity * 100}%` }}
                                            ></div>
                                        </div>
                                        <span>{Math.round(dup.matched_criteria.title_similarity * 100)}%</span>
                                    </div>
                                    <div className="criteria-item">
                                        <span>출연자</span>
                                        <div className="criteria-bar">
                                            <div
                                                className="criteria-fill"
                                                style={{ width: `${dup.matched_criteria.performer_similarity * 100}%` }}
                                            ></div>
                                        </div>
                                        <span>{Math.round(dup.matched_criteria.performer_similarity * 100)}%</span>
                                    </div>
                                    {dup.matched_criteria.distance_meters !== null && (
                                        <div className="criteria-item">
                                            <span>거리</span>
                                            <span className="distance-value">{Math.round(dup.matched_criteria.distance_meters!)}m</span>
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="btn-edit-existing"
                                    onClick={() => onEdit(dup.event_id)}
                                >
                                    이 이벤트 수정하기
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="duplicate-modal-footer">
                    <button className="btn-cancel-modal" onClick={onClose}>
                        취소
                    </button>
                    <button className="btn-proceed-anyway" onClick={onProceed}>
                        그래도 등록하기
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default EventDuplicateModal;
