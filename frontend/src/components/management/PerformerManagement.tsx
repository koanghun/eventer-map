import React, { useState, useMemo } from 'react';
import ManagementLayout from './ManagementLayout';
import { usePerformerData, Performer } from '../../hooks/usePerformerData';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { Edit, Trash2, User as UserIcon, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PerformerEditModal from './PerformerEditModal';

export default function PerformerManagement() {
    const { t } = useTranslation();
    const { performers, isLoading, updatePerformer, createPerformer, deletePerformer } = usePerformerData();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [editingPerformer, setEditingPerformer] = useState<Performer | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const filteredPerformers = useMemo(() => {
        if (!searchQuery.trim()) return performers;
        const query = searchQuery.toLowerCase();
        return performers.filter(p => 
            p.canonical_name.toLowerCase().includes(query) ||
            p.aliases?.some(alias => alias.toLowerCase().includes(query))
        );
    }, [performers, searchQuery]);

    const handleDelete = async (id: number, name: string) => {
        if (window.confirm(t('management.performer.deleteConfirm', { name }))) {
            try {
                await deletePerformer(id);
            } catch (error) {
                alert(t('management.performer.deleteError'));
            }
        }
    };

    return (
        <ManagementLayout
            title={t('management.performer.title')}
            description={t('management.performer.description')}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isLoading={isLoading}
            actions={
                <Button onClick={() => { setEditingPerformer(null); setIsModalOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('management.performer.new')}
                </Button>
            }
        >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                {filteredPerformers.length > 0 ? (
                    filteredPerformers.map((performer) => (
                        <div
                            key={performer.id}
                            className="bg-card border border-border/50 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow group"
                        >
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <UserIcon className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-bold text-foreground line-clamp-1">
                                        {performer.canonical_name}
                                    </h3>
                                </div>
                                <div className="flex flex-wrap gap-1 mb-4">
                                    {performer.aliases && performer.aliases.length > 0 ? (
                                        performer.aliases.slice(0, 3).map((alias, i) => (
                                            <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                {alias}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground italic">{t('management.performer.noAliases')}</span>
                                    )}
                                    {performer.aliases && performer.aliases.length > 3 && (
                                        <span className="text-[10px] text-muted-foreground">+{performer.aliases.length - 3}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-2 border-t border-border/30 pt-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setEditingPerformer(performer); setIsModalOpen(true); }}
                                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                >
                                    <Edit className="w-3.5 h-3.5 mr-1" />
                                    수정
                                </Button>
                                {user?.is_admin && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(performer.id, performer.canonical_name)}
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

            <PerformerEditModal
                performer={editingPerformer}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={async (id, data) => {
                    if (id) await updatePerformer({ id, data });
                    else await createPerformer(data);
                }}
            />
        </ManagementLayout>
    );
}
