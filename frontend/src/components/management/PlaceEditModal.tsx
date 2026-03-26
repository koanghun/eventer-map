import { useState, useEffect } from 'react';
import { Place, PlaceUpdate } from '../../hooks/usePlaceData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { X, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PlaceEditModalProps {
    place: Place | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: number | null, data: PlaceUpdate) => Promise<void>;
}

export default function PlaceEditModal({
    place,
    isOpen,
    onClose,
    onSave
}: PlaceEditModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [lat, setLat] = useState<string>('');
    const [lng, setLng] = useState<string>('');
    const [aliases, setAliases] = useState<string[]>([]);
    const [newAlias, setNewAlias] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (place) {
            setName(place.canonical_name);
            setAddress(place.address || '');
            setLat(place.latitude?.toString() || '');
            setLng(place.longitude?.toString() || '');
            setAliases(place.aliases || []);
        } else {
            setName('');
            setAddress('');
            setLat('');
            setLng('');
            setAliases([]);
        }
        setNewAlias('');
    }, [place, isOpen]);

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
        if (!place || !name.trim()) return;
        setIsSubmitting(true);
        try {
            await onSave(place.id, {
                canonical_name: name.trim(),
                address: address.trim() || undefined,
                latitude: lat ? parseFloat(lat) : undefined,
                longitude: lng ? parseFloat(lng) : undefined,
                aliases: aliases
            });
            onClose();
        } catch (error) {
            console.error('Failed to save place:', error);
            alert(t('management.place.saveError'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{place ? t('management.place.edit') : t('management.place.new')}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="place-name">{t('management.place.labels.name')}</Label>
                        <Input
                            id="place-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('management.place.labels.name')}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="place-address">{t('management.place.labels.address')}</Label>
                        <Input
                            id="place-address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder={t('management.place.labels.address')}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="place-lat">{t('management.place.labels.lat')}</Label>
                            <Input
                                id="place-lat"
                                type="number"
                                step="any"
                                value={lat}
                                onChange={(e) => setLat(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="place-lng">{t('management.place.labels.lng')}</Label>
                            <Input
                                id="place-lng"
                                type="number"
                                step="any"
                                value={lng}
                                onChange={(e) => setLng(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>{t('management.place.labels.aliases')}</Label>
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
                                placeholder={t('management.place.labels.newAlias')}
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
                        {t('management.place.labels.cancel')}
                    </Button>
                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting ? t('management.place.labels.saving') : t('management.place.labels.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
