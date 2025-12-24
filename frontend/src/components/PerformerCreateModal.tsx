import { useState, type KeyboardEvent, type FormEvent, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import ReactDOM from 'react-dom';
import styles from './PerformerCreateModal.module.css';

interface PerformerCreateModalProps {
    initialName: string;
    onConfirm: (canonicalName: string, aliases: string[]) => void;
    onCancel: () => void;
}

function PerformerCreateModal({
    initialName,
    onConfirm,
    onCancel,
}: PerformerCreateModalProps) {
    const { t } = useTranslation();
    const [canonicalName, setCanonicalName] = useState(initialName);
    const [aliasInput, setAliasInput] = useState('');
    const [aliases, setAliases] = useState<string[]>([]);

    const handleAddAlias = () => {
        const trimmed = aliasInput.trim();
        if (trimmed && !aliases.includes(trimmed)) {
            setAliases([...aliases, trimmed]);
            setAliasInput('');
        }
    };

    const handleRemoveAlias = (alias: string) => {
        setAliases(aliases.filter(a => a !== alias));
    };

    const handleAliasKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddAlias();
        }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault(); // 폼 제출 방지
        e.stopPropagation(); // 이벤트 버블링 방지
        if (canonicalName.trim()) {
            onConfirm(canonicalName.trim(), aliases);
        }
    };

    const handleOverlayClick = (e: MouseEvent) => {
        e.stopPropagation(); // 이벤트 버블링 방지
        onCancel();
    };

    const modalContent = (
        <div className={styles.performerModalOverlay} onClick={handleOverlayClick}>
            <div className={styles.performerModalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.performerModalHeader}>
                    <h3>✨ {t('performerModal.title')}</h3>
                    <button className={styles.btnClose} onClick={onCancel}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className={styles.performerModalBody}>
                        <div className={styles.formGroup}>
                            <label htmlFor="canonical-name">
                                {t('performerModal.labels.name')} <span className={styles.required}>*</span>
                            </label>
                            <input
                                id="canonical-name"
                                type="text"
                                value={canonicalName}
                                onChange={(e) => setCanonicalName(e.target.value)}
                                placeholder={t('performerModal.placeholders.name')}
                                required
                                autoFocus
                            />
                            <small>{t('performerModal.hints.name')}</small>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="aliases">{t('performerModal.labels.aliases')}</label>
                            <div className={styles.aliasInputGroup}>
                                <input
                                    id="aliases"
                                    type="text"
                                    value={aliasInput}
                                    onChange={(e) => setAliasInput(e.target.value)}
                                    onKeyDown={handleAliasKeyDown}
                                    placeholder={t('performerModal.placeholders.aliases')}
                                />
                                <button
                                    type="button"
                                    className={styles.btnAddAlias}
                                    onClick={handleAddAlias}
                                >
                                    {t('performerModal.buttons.add')}
                                </button>
                            </div>
                            <small>{t('performerModal.hints.aliases')}</small>
                        </div>

                        {aliases.length > 0 && (
                            <div className={styles.aliasesList}>
                                <label>{t('performerModal.labels.aliasesRegistered')}</label>
                                <div className={styles.aliasTags}>
                                    {aliases.map((alias, index) => (
                                        <div key={index} className={styles.aliasTag}>
                                            {alias}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAlias(alias)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={styles.performerModalFooter}>
                        <button type="button" className={styles.btnCancel} onClick={onCancel}>
                            {t('performerModal.buttons.cancel')}
                        </button>
                        <button type="submit" className={styles.btnConfirm}>
                            {t('performerModal.buttons.register')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
}

export default PerformerCreateModal;
