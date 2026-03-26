import { useState, useEffect } from 'react';
import { Performer, PerformerUpdate } from '../../hooks/usePerformerData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { X, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PerformerEditModalProps {
    performer: Performer | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: number | null, data: PerformerUpdate) => Promise<void>;
}

export default function PerformerEditModal({
    performer,
    isOpen,
    onClose,
    onSave
}: PerformerEditModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [aliases, setAliases] = useState<string[]>([]);
    const [newAlias, setNewAlias] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (performer) {
            setName(performer.canonical_name);
            setAliases(performer.aliases || []);
        } else {
            setName('');
            setAliases([]);
        }
        setNewAlias('');
    }, [performer, isOpen]);

    const handleAddAlias = () => {
        if (newAlias.trim() && !aliases.includes(newAlias.trim())) {
            setAliases([...aliases, newAlias.trim()]);
            setNewAlias('');
        }
    };

    const handleRemoveAlias = (index: number) => {
        setAliases(aliases.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!performer || !name.trim()) return;
        setIsSubmitting(true);
        try {
            await onSave(performer.id, {
                canonical_name: name.trim(),
                aliases: aliases
            });
            onClose();
        } catch (error) {
            console.error('Failed to save performer:', error);
            alert(t('management.performer.saveError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{performer ? t('management.performer.edit') : t('management.performer.new')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">{t('management.performer.labels.name')}</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('management.performer.labels.name')}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>{t('management.performer.labels.aliases')}</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {aliases.map((alias, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm"
                                >
                                    {alias}
                                    <button
                                        onClick={() => handleRemoveAlias(index)}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={newAlias}
                                onChange={(e) => setNewAlias(e.target.value)}
                                placeholder={t('management.performer.labels.newAlias')}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
                            />
                            <Button type="button" size="icon" onClick={handleAddAlias}>
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        {t('management.performer.labels.cancel')}
                    </Button>
                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting ? t('management.performer.labels.saving') : t('management.performer.labels.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
