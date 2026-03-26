import { useState, useMemo } from 'react';
import ManagementLayout from './ManagementLayout';
import { usePlaceData, Place } from '../../hooks/usePlaceData';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Edit, Trash2, MapPin, ExternalLink, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PlaceEditModal from './PlaceEditModal';

export default function PlaceManagement() {
    const { t } = useTranslation();
    const { places, isLoading, updatePlace, createPlace, deletePlace } = usePlaceData();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [editingPlace, setEditingPlace] = useState<Place | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filteredPlaces = useMemo(() => {
        if (!searchQuery.trim()) return places;
        const query = searchQuery.toLowerCase();
        return places.filter(p =>
            p.canonical_name.toLowerCase().includes(query) ||
            p.address?.toLowerCase().includes(query) ||
            p.aliases?.some(alias => alias.toLowerCase().includes(query))
        );
    }, [places, searchQuery]);

    const handleDelete = async (id: number, name: string) => {
        if (window.confirm(t('management.place.deleteConfirm', { name }))) {
            try {
                await deletePlace(id);
            } catch (error) {
                alert(t('management.place.deleteError'));
            }
        }
    };

    return (
        <ManagementLayout
            title={t('management.place.title')}
            description={t('management.place.description')}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isLoading={isLoading}
            actions={
                <Button onClick={() => { setEditingPlace(null); setIsModalOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('management.place.new')}
                </Button>
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-3 p-4">
                {filteredPlaces.length > 0 ? (
                    filteredPlaces.map((place) => (
                        <div
                            key={place.id}
                            className="bg-card border border-border/50 rounded-xl p-3 flex items-center justify-between hover:border-orange-500/30 hover:shadow-sm transition-all group relative"
                        >
                            <div className="flex items-center gap-3 overflow-hidden pr-4">
                                <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
                                    <MapPin className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-foreground text-sm line-clamp-1">
                                        {place.canonical_name}
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                        {place.address || t('management.place.addressInfoNone')}
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                        {place.aliases && place.aliases.length > 0 ? (
                                            place.aliases.slice(0, 1).map((alias, i) => (
                                                <span key={i} className="text-[9px] bg-muted/50 px-1 py-0.5 rounded text-muted-foreground truncate max-w-[80px]">
                                                    {alias}
                                                </span>
                                            ))
                                        ) : null}
                                        {place.aliases && place.aliases.length > 1 && (
                                            <span className="text-[9px] text-muted-foreground/60">+{place.aliases.length - 1}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 px-1.5 bg-gradient-to-l from-card via-card to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-r-xl">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    asChild
                                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                                >
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.canonical_name}`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={t('eventDetail.mapLink')}
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setEditingPlace(place); setIsModalOpen(true); }}
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    title={t('buttons.edit')}
                                >
                                    <Edit className="w-3.5 h-3.5" />
                                </Button>
                                {user?.is_admin && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(place.id, place.canonical_name)}
                                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        title={t('buttons.delete')}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-12 text-center text-muted-foreground">
                        {t('management.noResults')}
                    </div>
                )}
            </div>

            <PlaceEditModal
                place={editingPlace}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={async (id, data) => {
                    if (id) await updatePlace({ id, data });
                    else await createPlace(data);
                }}
            />
        </ManagementLayout>
    );
}
