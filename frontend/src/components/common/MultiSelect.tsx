import { useState, useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { performerApi, DuplicateCheckResponse } from '../../services/api';
import { Performer } from '../../types/event';
import DuplicateCheckModal from '../performers/DuplicateCheckModal';
import PerformerCreateModal from '../performers/PerformerCreateModal';
import { X } from 'lucide-react';

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
        try {
            const result = await performerApi.checkDuplicate(name);
            if (result.status === 'duplicate' && result.exact_match) {
                setDuplicateCheck(result);
                setPendingName(name);
                return;
            } else if (result.status === 'similar_found' && result.similar_matches && result.similar_matches.length > 0) {
                setDuplicateCheck(result);
                setPendingName(name);
                return;
            }
            setPendingName(name);
            setShowCreateModal(true);
            setInputValue('');
        } catch (error) {
            console.error('Failed to check duplicate:', error);
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
            const newPerformer = await performerApi.createPerformer({
                canonical_name: canonicalName,
                aliases: aliases
            });
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
        if (option.canonical_name.toLowerCase().includes(searchLower)) {
            return true;
        }
        if (option.aliases && option.aliases.length > 0) {
            return option.aliases.some(alias =>
                alias.toLowerCase().includes(searchLower)
            );
        }
        return false;
    });

    return (
        <div className="relative w-full">
            <div className="min-h-10 flex flex-wrap items-center gap-2 p-2 w-full rounded-md border border-input bg-transparent text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 transition-all bg-white dark:bg-slate-950">
                {selected.map(item => (
                    <div key={item} className="flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-0.5 rounded-full text-xs font-medium animate-in zoom-in-95">
                        {item}
                        <button
                            type="button"
                            className="text-primary-foreground/80 hover:text-primary-foreground focus:outline-none"
                            onClick={() => handleRemoveOption(item)}
                        >
                            <X className="h-3 w-3" />
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
                    className="flex-1 bg-transparent border-none outline-none min-w-[120px] text-sm text-foreground placeholder:text-muted-foreground focus:ring-0"
                />
            </div>
            
            {isOpen && (
                <ul className="absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-80 slide-in-from-top-1">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(option => (
                            <li
                                key={option.id}
                                onMouseDown={() => handleSelectOption(option.canonical_name)}
                                className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-3 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            >
                                <div className="flex flex-col">
                                    <span className="font-medium">{option.canonical_name}</span>
                                    {option.aliases && option.aliases.length > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            {option.aliases.join(', ')}
                                        </span>
                                    )}
                                </div>
                            </li>
                        ))
                    ) : (
                        inputValue.trim() && (
                            <li
                                onMouseDown={async () => await handleAddNewPerformer(inputValue.trim())}
                                className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 px-3 text-sm text-primary font-medium hover:bg-primary/10 transition-colors"
                            >
                                '{inputValue.trim()}' 추가
                            </li>
                        )
                    )}
                </ul>
            )}

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
        </div>
    );
}

export default MultiSelect;
