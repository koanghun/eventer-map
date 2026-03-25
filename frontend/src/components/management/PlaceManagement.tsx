import React, { useState, useMemo } from 'react';
import ManagementLayout from './ManagementLayout';
import { usePlaceData, Place } from '../../hooks/usePlaceData';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Edit, Trash2, MapPin, ExternalLink, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PlaceEditModal from './PlaceEditModal';

export default function PlaceManagement() {
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {filteredPlaces.length > 0 ? (
                    filteredPlaces.map((place) => (
                        <div
                            key={place.id}
                            className="bg-card border border-border/50 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow group"
                        >
                            <div>
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                                            <MapPin className="w-5 h-5" />
                                        </div>
                                        <h3 className="font-bold text-foreground line-clamp-1">
                                            {place.canonical_name}
                                        </h3>
                                    </div>
                                    {place.google_place_id && (
                                        <a 
                                            href={`https://www.google.com/maps/search/?api=1&query=google_place_id:${place.google_place_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-muted-foreground hover:text-primary p-1"
                                            title="Google Maps에서 보기"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mb-3 line-clamp-2 min-h-[2rem]">
                                    {place.address || t('management.place.addressInfoNone')}
                                </p>
                                <div className="flex flex-wrap gap-1 mb-4">
                                    {place.aliases && place.aliases.length > 0 ? (
                                        place.aliases.slice(0, 2).map((alias, i) => (
                                            <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                {alias}
                                            </span>
                                        ))
                                    ) : null}
                                    {place.aliases && place.aliases.length > 2 && (
                                        <span className="text-[10px] text-muted-foreground">+{place.aliases.length - 2}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 border-t border-border/30 pt-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setEditingPlace(place); setIsModalOpen(true); }}
                                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                >
                                    <Edit className="w-3.5 h-3.5 mr-1" />
                                    수정
                                </Button>
                                {user?.is_admin && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(place.id, place.canonical_name)}
                                        className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                                        삭제
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
