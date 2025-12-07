import { useState, type KeyboardEvent, type FormEvent, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import ReactDOM from 'react-dom';
import './PerformerCreateModal.css';

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
        e.preventDefault();
        if (canonicalName.trim()) {
            onConfirm(canonicalName.trim(), aliases);
        }
    };

    const handleOverlayClick = (e: MouseEvent) => {
        e.stopPropagation(); // 이벤트 버블링 방지
        onCancel();
    };

    const modalContent = (
        <div className="performer-modal-overlay" onClick={handleOverlayClick}>
            <div className="performer-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="performer-modal-header">
                    <h3>✨ {t('performerModal.title')}</h3>
                    <button className="btn-close" onClick={onCancel}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="performer-modal-body">
                        <div className="form-group">
                            <label htmlFor="canonical-name">
                                {t('performerModal.labels.name')} <span className="required">*</span>
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

                        <div className="form-group">
                            <label htmlFor="aliases">{t('performerModal.labels.aliases')}</label>
                            <div className="alias-input-group">
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
                                    className="btn-add-alias"
                                    onClick={handleAddAlias}
                                >
                                    {t('performerModal.buttons.add')}
                                </button>
                            </div>
                            <small>{t('performerModal.hints.aliases')}</small>
                        </div>

                        {aliases.length > 0 && (
                            <div className="aliases-list">
                                <label>{t('performerModal.labels.aliasesRegistered')}</label>
                                <div className="alias-tags">
                                    {aliases.map((alias, index) => (
                                        <div key={index} className="alias-tag">
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

                    <div className="performer-modal-footer">
                        <button type="button" className="btn-cancel" onClick={onCancel}>
                            {t('performerModal.buttons.cancel')}
                        </button>
                        <button type="submit" className="btn-confirm">
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
