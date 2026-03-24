import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { performerApi } from '../../services/api';
import { Performer } from '../../types/event';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Mic2, X, Search } from 'lucide-react';

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
        if (!inputValue.trim()) return true;

        const searchLower = inputValue.toLowerCase();
        if (performer.canonical_name.toLowerCase().includes(searchLower)) return true;
        if (performer.aliases && performer.aliases.length > 0) {
            return performer.aliases.some((alias: string) => alias.toLowerCase().includes(searchLower));
        }

        return false;
    });

    return (
        <div className="relative w-full md:max-w-xs">
            <Label htmlFor="performer-search" className="flex items-center gap-1.5 font-bold text-primary mb-2">
                <Mic2 className="w-4 h-4" />
                {t('performerFilter.label')}
            </Label>
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                    ref={inputRef}
                    id="performer-search"
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                    placeholder={t('performerFilter.placeholder')}
                    className="pl-9 pr-9 bg-background/50 backdrop-blur-sm"
                />
                {selectedPerformer && (
                    <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        onClick={handleClear}
                        title={t('performerFilter.clearFilter')}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {isOpen && filteredPerformers.length > 0 && (
                <ul className="absolute top-full left-0 z-50 w-full mt-2 max-h-60 overflow-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-xl outline-none animate-in fade-in-80 slide-in-from-top-1">
                    {filteredPerformers.slice(0, 50).map(performer => (
                        <li
                            key={performer.id}
                            onClick={() => handleSelectPerformer(performer)}
                            className="relative flex flex-col w-full cursor-pointer select-none border-b last:border-0 border-border/50 py-2.5 px-3 text-sm outline-none hover:bg-muted hover:text-foreground transition-colors"
                        >
                            <span className="font-bold">{performer.canonical_name}</span>
                            {performer.aliases && performer.aliases.length > 0 && (
                                <span className="text-xs text-muted-foreground truncate block mt-0.5">
                                    {performer.aliases.join(', ')}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default PerformerFilter;
