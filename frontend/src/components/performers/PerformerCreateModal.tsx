import { useState, type KeyboardEvent, type FormEvent, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import ReactDOM from 'react-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Sparkles, X, Plus, Tag } from 'lucide-react';

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
        e.stopPropagation();
        if (canonicalName.trim()) {
            onConfirm(canonicalName.trim(), aliases);
        }
    };

    const handleOverlayClick = (e: MouseEvent) => {
        e.stopPropagation();
        onCancel();
    };

    const modalContent = (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={handleOverlayClick}>
            <div className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
                    <div className="flex items-center gap-2 text-primary font-bold text-lg">
                        <Sparkles className="h-5 w-5" />
                        <h3>{t('performerModal.title')}</h3>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground" onClick={onCancel}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-6">
                        <div className="space-y-2.5">
                            <Label htmlFor="canonical-name" className="text-foreground font-semibold flex items-center gap-1">
                                {t('performerModal.labels.name')} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="canonical-name"
                                type="text"
                                value={canonicalName}
                                onChange={(e) => setCanonicalName(e.target.value)}
                                placeholder={t('performerModal.placeholders.name')}
                                required
                                autoFocus
                                className="bg-muted/50"
                            />
                            <p className="text-xs text-muted-foreground">{t('performerModal.hints.name')}</p>
                        </div>

                        <div className="space-y-2.5">
                            <Label htmlFor="aliases" className="text-foreground font-semibold">
                                {t('performerModal.labels.aliases')}
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="aliases"
                                    type="text"
                                    value={aliasInput}
                                    onChange={(e) => setAliasInput(e.target.value)}
                                    onKeyDown={handleAliasKeyDown}
                                    placeholder={t('performerModal.placeholders.aliases')}
                                    className="bg-muted/50"
                                />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleAddAlias}
                                    className="shrink-0 bg-secondary/80 hover:bg-secondary"
                                >
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    {t('performerModal.buttons.add')}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">{t('performerModal.hints.aliases')}</p>
                        </div>

                        {aliases.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-border/50">
                                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                    {t('performerModal.labels.aliasesRegistered')}
                                </Label>
                                <div className="flex flex-wrap gap-2">
                                    {aliases.map((alias, index) => (
                                        <div key={index} className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full text-sm font-medium">
                                            <Tag className="w-3 h-3 opacity-70" />
                                            {alias}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAlias(alias)}
                                                className="ml-1 w-4 h-4 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 p-5 border-t border-border bg-muted/10">
                        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
                            {t('performerModal.buttons.cancel')}
                        </Button>
                        <Button type="submit" className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary">
                            {t('performerModal.buttons.register')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
}

export default PerformerCreateModal;
