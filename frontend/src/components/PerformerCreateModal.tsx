import { useState, type KeyboardEvent, type FormEvent, type MouseEvent } from 'react';
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
                    <h3>✨ 새 출연자 등록</h3>
                    <button className="btn-close" onClick={onCancel}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="performer-modal-body">
                        <div className="form-group">
                            <label htmlFor="canonical-name">
                                공식 표기 이름 <span className="required">*</span>
                            </label>
                            <input
                                id="canonical-name"
                                type="text"
                                value={canonicalName}
                                onChange={(e) => setCanonicalName(e.target.value)}
                                placeholder="예: Perfume"
                                required
                                autoFocus
                            />
                            <small>출연자의 공식 표기명을 입력하세요</small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="aliases">별칭 (선택)</label>
                            <div className="alias-input-group">
                                <input
                                    id="aliases"
                                    type="text"
                                    value={aliasInput}
                                    onChange={(e) => setAliasInput(e.target.value)}
                                    onKeyDown={handleAliasKeyDown}
                                    placeholder="예: パフューム, ぱふゅーむ, 전자음악"
                                />
                                <button
                                    type="button"
                                    className="btn-add-alias"
                                    onClick={handleAddAlias}
                                >
                                    추가
                                </button>
                            </div>
                            <small>다른 표기, 검색 키워드 등을 추가하세요 (엔터로 추가 가능)</small>
                        </div>

                        {aliases.length > 0 && (
                            <div className="aliases-list">
                                <label>등록된 별칭:</label>
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
                            취소
                        </button>
                        <button type="submit" className="btn-confirm">
                            등록
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
}

export default PerformerCreateModal;
