import { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();

    const handleOverlayClick = (e: MouseEvent) => {
        e.stopPropagation(); // 이벤트 버블링 방지
        onCancel();
    };

    const modalContent = (
        <div className="duplicate-modal-overlay" onClick={handleOverlayClick}>
            <div className="duplicate-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="duplicate-modal-header">
                    <h3>
                        {type === 'exact' ? t('performerDuplicateModal.exactTitle') : t('performerDuplicateModal.similarTitle')}
                    </h3>
                    <button className="btn-close" onClick={onCancel}>✕</button>
                </div>

                <div className="duplicate-modal-body">
                    {type === 'exact' && exactMatch && (
                        <>
                            <p className="duplicate-message">
                                {t('performerDuplicateModal.exactMessage', { name: inputName })}
                            </p>
                            <div className="existing-item exact-match">
                                <div className="item-name">{exactMatch.canonical_name}</div>
                                {exactMatch.aliases && exactMatch.aliases.length > 0 && (
                                    <div className="item-aliases">
                                        {t('performerDuplicateModal.labels.aliases')}: {exactMatch.aliases.join(', ')}
                                    </div>
                                )}
                                <button
                                    className="btn-use-existing"
                                    onClick={() => onUseExisting(exactMatch)}
                                >
                                    {t('performerDuplicateModal.buttons.useExisting')}
                                </button>
                            </div>
                        </>
                    )}

                    {type === 'similar' && similarMatches.length > 0 && (
                        <>
                            <p className="duplicate-message">
                                {t('performerDuplicateModal.similarMessage', { name: inputName })}
                            </p>
                            <div className="similar-matches-list">
                                {similarMatches.map((performer) => (
                                    <div key={performer.id} className="existing-item">
                                        <div className="item-info">
                                            <div className="item-name">{performer.canonical_name}</div>
                                            {(() => {
                                                const aliases = performer.aliases || [];
                                                return aliases.length > 0 && (
                                                    <div className="item-aliases">
                                                        {t('performerDuplicateModal.labels.aliases')}: {aliases.join(', ')}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <button
                                            className="btn-use-existing"
                                            onClick={() => onUseExisting(performer)}
                                        >
                                            {t('performerDuplicateModal.buttons.select')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="modal-divider">{t('performerDuplicateModal.divider')}</div>
                        </>
                    )}
                </div>

                <div className="duplicate-modal-footer">
                    {type === 'similar' && (
                        <>
                            <button className="btn-create-new" onClick={onCreateNew}>
                                {t('performerDuplicateModal.buttons.createNew', { name: inputName })}
                            </button>
                            <button className="btn-cancel-modal" onClick={onCancel}>
                                {t('performerDuplicateModal.buttons.cancel')}
                            </button>
                        </>
                    )}
                    {type === 'exact' && (
                        <button className="btn-cancel-modal" onClick={onCancel}>
                            {t('performerDuplicateModal.buttons.cancel')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
}

export default DuplicateCheckModal;
