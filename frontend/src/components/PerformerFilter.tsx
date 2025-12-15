import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { performerApi } from '../services/api';
import { Performer } from '../types/event';
import './PerformerFilter.css';

interface PerformerFilterProps {
    onPerformerSelect: (performerName: string | null) => void;
}

function PerformerFilter({ onPerformerSelect }: PerformerFilterProps) {
    const { t } = useTranslation();
    const [performers, setPerformers] = useState<Performer[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedPerformer, setSelectedPerformer] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchPerformers = async () => {
            try {
                const data = await performerApi.getAllPerformers();
                setPerformers(data);
            } catch (error) {
                console.error('Failed to fetch performers:', error);
            }
        };
        fetchPerformers();
    }, []);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        if (!isOpen) {
            setIsOpen(true);
        }

        // 입력값이 비어있으면 필터 해제
        if (!e.target.value.trim()) {
            setSelectedPerformer(null);
            onPerformerSelect(null);
        }
    };

    const handleSelectPerformer = (performer: Performer) => {
        setSelectedPerformer(performer.canonical_name);
        setInputValue(performer.canonical_name);
        setIsOpen(false);
        onPerformerSelect(performer.canonical_name);
    };

    const handleClear = () => {
        setSelectedPerformer(null);
        setInputValue('');
        onPerformerSelect(null);
        inputRef.current?.focus();
    };

    const filteredPerformers = performers.filter(performer => {
        if (!performer.canonical_name) return false;

        // 입력값이 없으면 모든 출연자 표시
        if (!inputValue.trim()) return true;

        const searchLower = inputValue.toLowerCase();

        // canonical_name으로 검색
        if (performer.canonical_name.toLowerCase().includes(searchLower)) {
            return true;
        }

        // aliases로 검색
        if (performer.aliases) {
            try {
                const aliases: string[] = JSON.parse(performer.aliases);
                return aliases.some(alias =>
                    alias.toLowerCase().includes(searchLower)
                );
            } catch (e) {
                // JSON 파싱 실패 시 무시
            }
        }

        return false;
    });

    return (
        <div className="performer-filter">
            <label htmlFor="performer-search">🎤 {t('performerFilter.label')}</label>
            <div className="performer-filter-input-group">
                <input
                    ref={inputRef}
                    id="performer-search"
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                    placeholder={t('performerFilter.placeholder')}
                    className="performer-filter-input"
                />
                {selectedPerformer && (
                    <button
                        type="button"
                        className="btn-clear-filter"
                        onClick={handleClear}
                        title={t('performerFilter.clearFilter')}
                    >
                        ✕
                    </button>
                )}
            </div>

            {isOpen && filteredPerformers.length > 0 && (
                <ul className="performer-filter-dropdown">
                    {filteredPerformers.slice(0, 50).map(performer => (
                        <li
                            key={performer.id}
                            onMouseDown={() => handleSelectPerformer(performer)}
                            className="performer-filter-item"
                        >
                            <div className="performer-filter-name">
                                {performer.canonical_name}
                            </div>
                            {(() => {
                                const aliases = performer.aliases ? JSON.parse(performer.aliases) : [];
                                return aliases.length > 0 && (
                                    <div className="performer-filter-aliases">
                                        {aliases.join(', ')}
                                    </div>
                                );
                            })()}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default PerformerFilter;
