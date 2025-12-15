import { type MouseEvent } from 'react';
import ReactDOM from 'react-dom';
import { Performer } from '../types/event';
import './DuplicateCheckModal.css';

interface DuplicateCheckModalProps {
    type: 'exact' | 'similar';
    inputName: string;
    exactMatch?: Performer | null;
    similarMatches?: Performer[];
    onUseExisting: (performer: Performer) => void;
    onCreateNew: () => void;
    onCancel: () => void;
}

function DuplicateCheckModal({
    type,
    inputName,
    exactMatch,
    similarMatches = [],
    onUseExisting,
    onCreateNew,
    onCancel,
}: DuplicateCheckModalProps) {
    const handleOverlayClick = (e: MouseEvent) => {
        e.stopPropagation(); // 이벤트 버블링 방지
        onCancel();
    };

    const modalContent = (
        <div className="duplicate-modal-overlay" onClick={handleOverlayClick}>
            <div className="duplicate-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="duplicate-modal-header">
                    <h3>
                        {type === 'exact' ? '⚠️ 중복된 출연자' : '🔍 유사한 출연자 발견'}
                    </h3>
                    <button className="btn-close" onClick={onCancel}>✕</button>
                </div>

                <div className="duplicate-modal-body">
                    {type === 'exact' && exactMatch && (
                        <>
                            <p className="duplicate-message">
                                <strong>"{inputName}"</strong>은(는) 이미 등록된 출연자입니다.
                            </p>
                            <div className="existing-item exact-match">
                                <div className="item-name">{exactMatch.canonical_name}</div>
                                {(() => {
                                    const aliases = exactMatch.aliases ? JSON.parse(exactMatch.aliases) : [];
                                    return aliases.length > 0 && (
                                        <div className="item-aliases">
                                            별칭: {aliases.join(', ')}
                                        </div>
                                    );
                                })()}
                                <button
                                    className="btn-use-existing"
                                    onClick={() => onUseExisting(exactMatch)}
                                >
                                    이 출연자 사용
                                </button>
                            </div>
                        </>
                    )}

                    {type === 'similar' && similarMatches.length > 0 && (
                        <>
                            <p className="duplicate-message">
                                <strong>"{inputName}"</strong>과(와) 유사한 출연자가 있습니다.
                            </p>
                            <div className="similar-matches-list">
                                {similarMatches.map((performer) => (
                                    <div key={performer.id} className="existing-item">
                                        <div className="item-info">
                                            <div className="item-name">{performer.canonical_name}</div>
                                            {(() => {
                                                const aliases = performer.aliases ? JSON.parse(performer.aliases) : [];
                                                return aliases.length > 0 && (
                                                    <div className="item-aliases">
                                                        별칭: {aliases.join(', ')}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <button
                                            className="btn-use-existing"
                                            onClick={() => onUseExisting(performer)}
                                        >
                                            선택
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="modal-divider">또는</div>
                        </>
                    )}
                </div>

                <div className="duplicate-modal-footer">
                    {type === 'similar' && (
                        <>
                            <button className="btn-create-new" onClick={onCreateNew}>
                                "{inputName}" 새로 등록
                            </button>
                            <button className="btn-cancel-modal" onClick={onCancel}>
                                취소
                            </button>
                        </>
                    )}
                    {type === 'exact' && (
                        <button className="btn-cancel-modal" onClick={onCancel}>
                            취소
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
}

export default DuplicateCheckModal;
