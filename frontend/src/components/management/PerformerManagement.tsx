import { useState, useMemo } from 'react';
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 p-4">
                {filteredPerformers.length > 0 ? (
                    filteredPerformers.map((performer) => (
                        <div
                            key={performer.id}
                            className="bg-card border border-border/50 rounded-xl p-3 flex items-center justify-between hover:border-primary/30 hover:shadow-sm transition-all group relative"
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <UserIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-foreground text-sm line-clamp-1">
                                        {performer.canonical_name}
                                    </h3>
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                        {performer.aliases && performer.aliases.length > 0 ? (
                                            performer.aliases.slice(0, 2).map((alias, i) => (
                                                <span key={i} className="text-[9px] bg-muted/50 px-1 py-0.5 rounded text-muted-foreground truncate max-w-[60px]">
                                                    {alias}
                                                </span>
                                            ))
                                        ) : null}
                                        {performer.aliases && performer.aliases.length > 2 && (
                                            <span className="text-[9px] text-muted-foreground/60">+{performer.aliases.length - 2}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="absolute inset-y-0 right-0 flex items-center gap-1 px-2 bg-gradient-to-l from-card via-card to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-r-xl">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setEditingPerformer(performer); setIsModalOpen(true); }}
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                    title={t('buttons.edit')}
                                >
                                    <Edit className="w-3.5 h-3.5" />
                                </Button>
                                {user?.is_admin && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(performer.id, performer.canonical_name)}
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
