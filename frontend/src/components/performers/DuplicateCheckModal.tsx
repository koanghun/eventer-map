import { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import ReactDOM from 'react-dom';
import { Performer } from '../../types/event';
import styles from './DuplicateCheckModal.module.css';

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
        <div className={styles.duplicateModalOverlay} onClick={handleOverlayClick}>
            <div className={styles.duplicateModalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.duplicateModalHeader}>
                    <h3>
                        {type === 'exact' ? t('performerDuplicateModal.exactTitle') : t('performerDuplicateModal.similarTitle')}
                    </h3>
                    <button className={styles.btnClose} onClick={onCancel}>✕</button>
                </div>

                <div className={styles.duplicateModalBody}>
                    {type === 'exact' && exactMatch && (
                        <>
                            <p className={styles.duplicateMessage}>
                                {t('performerDuplicateModal.exactMessage', { name: inputName })}
                            </p>
                            <div className={`${styles.existingItem} ${styles.exactMatch}`}>
                                <div className={styles.itemName}>{exactMatch.canonical_name}</div>
                                {exactMatch.aliases && exactMatch.aliases.length > 0 && (
                                    <div className={styles.itemAliases}>
                                        {t('performerDuplicateModal.labels.aliases')}: {exactMatch.aliases.join(', ')}
                                    </div>
                                )}
                                <button
                                    className={styles.btnUseExisting}
                                    onClick={() => onUseExisting(exactMatch)}
                                >
                                    {t('performerDuplicateModal.buttons.useExisting')}
                                </button>
                            </div>
                        </>
                    )}

                    {type === 'similar' && similarMatches.length > 0 && (
                        <>
                            <p className={styles.duplicateMessage}>
                                {t('performerDuplicateModal.similarMessage', { name: inputName })}
                            </p>
                            <div className={styles.similarMatchesList}>
                                {similarMatches.map((performer) => (
                                    <div key={performer.id} className={styles.existingItem}>
                                        <div className={styles.itemInfo}>
                                            <div className={styles.itemName}>{performer.canonical_name}</div>
                                            {(() => {
                                                const aliases = performer.aliases || [];
                                                return aliases.length > 0 && (
                                                    <div className={styles.itemAliases}>
                                                        {t('performerDuplicateModal.labels.aliases')}: {aliases.join(', ')}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <button
                                            className={styles.btnUseExisting}
                                            onClick={() => onUseExisting(performer)}
                                        >
                                            {t('performerDuplicateModal.buttons.select')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className={styles.modalDivider}>{t('performerDuplicateModal.divider')}</div>
                        </>
                    )}
                </div>

                <div className={styles.duplicateModalFooter}>
                    {type === 'similar' && (
                        <>
                            <button className={styles.btnCreateNew} onClick={onCreateNew}>
                                {t('performerDuplicateModal.buttons.createNew', { name: inputName })}
                            </button>
                            <button className={styles.btnCancelModal} onClick={onCancel}>
                                {t('performerDuplicateModal.buttons.cancel')}
                            </button>
                        </>
                    )}
                    {type === 'exact' && (
                        <button className={styles.btnCancelModal} onClick={onCancel}>
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
