import { useState, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { performerApi, DuplicateCheckResponse } from '../services/api';
import { Performer } from '../types/event';
import DuplicateCheckModal from './DuplicateCheckModal';
import PerformerCreateModal from './PerformerCreateModal';
import './MultiSelect.css';

interface MultiSelectProps {
    options: Performer[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder: string;
}

function MultiSelect({ options, selected, onChange, placeholder }: MultiSelectProps) {
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheckResponse | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [pendingName, setPendingName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        if (!isOpen) {
            setIsOpen(true);
        }
    };

    const handleSelectOption = (optionName: string) => {
        if (!selected.includes(optionName)) {
            onChange([...selected, optionName]);
        }
        setInputValue('');
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleRemoveOption = (optionName: string) => {
        onChange(selected.filter(item => item !== optionName));
    };

    const handleAddNewPerformer = async (name: string) => {
        // 중복 체크
        try {
            const result = await performerApi.checkDuplicate(name);

            if (result.status === 'duplicate' && result.exact_match) {
                // 정확히 일치하는 출연자 발견 - 중복 모달 표시
                setDuplicateCheck(result);
                setPendingName(name);
                return;
            } else if (result.status === 'similar_found' && result.similar_matches && result.similar_matches.length > 0) {
                // 유사한 출연자 발견 - 중복 모달 표시
                setDuplicateCheck(result);
                setPendingName(name);
                return;
            }

            // 중복 없음 - 출연자 등록 모달 표시
            setPendingName(name);
            setShowCreateModal(true);
            setInputValue('');
        } catch (error) {
            console.error('Failed to check duplicate:', error);
            // 에러 발생 시 모달 표시
            setPendingName(name);
            setShowCreateModal(true);
            setInputValue('');
        }
    };

    const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            await handleAddNewPerformer(inputValue.trim());
        } else if (e.key === 'Backspace' && !inputValue && selected.length > 0) {
            onChange(selected.slice(0, selected.length - 1));
        }
    };

    const handleUseExisting = (performer: Performer) => {
        const name = performer.canonical_name;
        if (!selected.includes(name)) {
            onChange([...selected, name]);
        }
        setDuplicateCheck(null);
        setPendingName('');
        setInputValue('');
        inputRef.current?.focus();
    };

    const handleCreateFromDuplicate = () => {
        // 중복 모달에서 "새로 등록" 선택
        setDuplicateCheck(null);
        setShowCreateModal(true);
    };

    const handleCancelDuplicate = () => {
        setDuplicateCheck(null);
        setPendingName('');
        inputRef.current?.focus();
    };

    const handleConfirmCreate = async (canonicalName: string, aliases: string[]) => {
        try {
            // API로 출연자 생성
            const newPerformer = await performerApi.createPerformer({
                canonical_name: canonicalName,
                aliases: aliases
            });

            // MultiSelect에 추가
            if (!selected.includes(newPerformer.canonical_name)) {
                onChange([...selected, newPerformer.canonical_name]);
            }

            setShowCreateModal(false);
            setPendingName('');
            inputRef.current?.focus();
        } catch (error) {
            console.error('Failed to create performer:', error);
            alert(t('multiSelect.alerts.performerCreateFailed'));
        }
    };

    const handleCancelCreate = () => {
        setShowCreateModal(false);
        setPendingName('');
        inputRef.current?.focus();
    };

    const filteredOptions = options.filter(option => {
        if (!option.canonical_name || selected.includes(option.canonical_name)) {
            return false;
        }

        const searchLower = inputValue.toLowerCase();

        // canonical_name으로 검색
        if (option.canonical_name.toLowerCase().includes(searchLower)) {
            return true;
        }

        // aliases로 검색
        if (option.aliases && option.aliases.length > 0) {
            return option.aliases.some(alias =>
                alias.toLowerCase().includes(searchLower)
            );
        }

        return false;
    });

    return (
        <>
            <div className="multiselect-container">
                <div className="selected-items">
                    {selected.map(item => (
                        <div key={item} className="selected-item">
                            {item}
                            <button
                                type="button"
                                className="remove-item"
                                onClick={() => handleRemoveOption(item)}
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsOpen(true)}
                        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                        placeholder={selected.length === 0 ? placeholder : ''}
                        className="multiselect-input"
                    />
                </div>
                {isOpen && (
                    <ul className="options-list">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <li
                                    key={option.id}
                                    onMouseDown={() => handleSelectOption(option.canonical_name)}
                                    className="option-item"
                                >
                                    <div className="option-name">{option.canonical_name}</div>
                                    {option.aliases && option.aliases.length > 0 && (
                                        <div className="option-aliases">
                                            {option.aliases.join(', ')}
                                        </div>
                                    )}
                                </li>
                            ))
                        ) : (
                            inputValue.trim() && (
                                <li
                                    onMouseDown={async () => await handleAddNewPerformer(inputValue.trim())}
                                    className="option-item option-item-new"
                                >
                                    '{inputValue.trim()}' 추가
                                </li>
                            )
                        )}
                    </ul>
                )}
            </div>

            {duplicateCheck && (
                <DuplicateCheckModal
                    type={duplicateCheck.status === 'duplicate' ? 'exact' : 'similar'}
                    inputName={pendingName}
                    exactMatch={duplicateCheck.exact_match}
                    similarMatches={duplicateCheck.similar_matches}
                    onUseExisting={handleUseExisting}
                    onCreateNew={handleCreateFromDuplicate}
                    onCancel={handleCancelDuplicate}
                />
            )}

            {showCreateModal && (
                <PerformerCreateModal
                    initialName={pendingName}
                    onConfirm={handleConfirmCreate}
                    onCancel={handleCancelCreate}
                />
            )}
        </>
    );
}

export default MultiSelect;
