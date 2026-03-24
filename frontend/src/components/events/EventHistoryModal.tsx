import { useEffect, useState } from 'react';
import { EventHistory } from '../../types/event';
import { eventApi } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';

import { X, History, Clock, User, PlusCircle, Edit2, Trash2, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';

interface EventHistoryModalProps {
    eventId: number;
    onClose: () => void;
}

export default function EventHistoryModal({ eventId, onClose }: EventHistoryModalProps) {
    const { t } = useTranslation();
    const [histories, setHistories] = useState<EventHistory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        loadHistory();
    }, [eventId]);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const data = await eventApi.getHistory(eventId);
            setHistories(data);
            setError(null);
        } catch (err) {
            console.error('Failed to load history:', err);
            setError(t('eventDetail.history.error'));
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'created': return <PlusCircle className="w-4 h-4 text-green-500" />;
            case 'updated': return <Edit2 className="w-4 h-4 text-blue-500" />;
            case 'deleted': return <Trash2 className="w-4 h-4 text-red-500" />;
            default: return <History className="w-4 h-4 text-gray-500" />;
        }
    };

    const getActionText = (action: string) => {
        switch (action) {
            case 'created': return t('eventDetail.history.actions.created');
            case 'updated': return t('eventDetail.history.actions.updated');
            case 'deleted': return t('eventDetail.history.actions.deleted');
            default: return action;
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const getChangedFields = (currentHistory: EventHistory, previousHistory?: EventHistory) => {
        if (!previousHistory || currentHistory.action === 'created') {
            return Object.entries(currentHistory.snapshot).filter(([_key, value]) =>
                value !== null && value !== undefined && value !== ''
            );
        }

        const changes: [string, any, any][] = [];
        const fieldsToCheck = ['title', 'event_date', 'location', 'address', 'door_time', 'start_time', 'end_time', 'performers', 'description', 'related_link'];

        fieldsToCheck.forEach(key => {
            const oldValue = previousHistory.snapshot[key as keyof typeof previousHistory.snapshot];
            const newValue = currentHistory.snapshot[key as keyof typeof currentHistory.snapshot];

            if (oldValue !== newValue) {
                changes.push([key, oldValue, newValue]);
            }
        });

        return changes;
    };

    const getFieldLabel = (key: string) => {
        return t(`eventDetail.history.fields.${key}`, key);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-2xl bg-background rounded-2xl shadow-xl border border-border flex flex-col max-h-[90vh] animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div className="flex items-center gap-2 text-primary">
                        <History className="h-6 w-6" />
                        <h2 className="text-xl font-bold">{t('eventDetail.history.title')}</h2>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
                    {loading && <div className="text-center py-10 animate-pulse text-muted-foreground">{t('eventDetail.history.loading')}</div>}
                    {error && <div className="text-center py-10 text-destructive">{error}</div>}
                    
                    {!loading && !error && histories.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground">{t('eventDetail.history.noHistory')}</div>
                    )}

                    {!loading && !error && histories.length > 0 && (
                        <div className="relative border-l-2 border-border ml-3 md:ml-6 space-y-8">
                            {histories.map((history, index) => {
                                const previousHistory = histories[index + 1];
                                const changedFields = getChangedFields(history, previousHistory);
                                const isExpanded = expandedId === history.id;

                                return (
                                    <div key={history.id} className="relative pl-6 md:pl-8">
                                        <div className="absolute w-4 h-4 bg-background border-2 border-primary rounded-full -left-[9px] top-1"></div>
                                        
                                        <div className="bg-card border border-border rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
                                            <div className="flex flex-wrap items-center gap-4 text-sm mb-3 text-muted-foreground">
                                                <div className="flex items-center gap-1.5 font-medium text-foreground">
                                                    {getActionIcon(history.action)}
                                                    <span className="capitalize">{getActionText(history.action)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {formatDate(history.created_at)}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-primary bg-primary/10 px-2 py-0.5 rounded-full text-xs font-medium">
                                                    <User className="w-3.5 h-3.5" />
                                                    {history.user_name}
                                                </div>
                                            </div>

                                            <div className="text-sm mb-4">
                                                {history.action === 'created' && (
                                                    <p className="text-muted-foreground">
                                                        <strong className="text-foreground">{t('eventDetail.history.createdSummary')}:</strong> {history.snapshot.title} @ {history.snapshot.location}
                                                    </p>
                                                )}
                                                {history.action === 'updated' && changedFields.length > 0 && (
                                                    <p className="text-muted-foreground">
                                                        <strong className="text-foreground">{t('eventDetail.history.changedPrefix')}:</strong> {changedFields.map(([key]) => getFieldLabel(key)).join(', ')}
                                                    </p>
                                                )}
                                            </div>

                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="w-full flex justify-between items-center text-xs h-8 text-muted-foreground hover:text-foreground"
                                                onClick={() => toggleExpand(history.id)}
                                            >
                                                {isExpanded ? t('eventDetail.history.hideDetails') : t('eventDetail.history.viewDetails')}
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </Button>

                                            {isExpanded && (
                                                <div className="mt-3 pt-3 border-t border-border space-y-3">
                                                    {history.action === 'created' ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                                            {changedFields.map(([key, value]) => (
                                                                <div key={key} className="text-sm border-l-2 border-primary/30 pl-3">
                                                                    <div className="text-xs text-muted-foreground mb-1">{getFieldLabel(key)}</div>
                                                                    <div className="font-medium whitespace-pre-wrap">{value || <span className="text-muted-foreground italic">{t('eventDetail.history.empty')}</span>}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-3">
                                                            {changedFields.map(([key, oldValue, newValue]) => (
                                                                <div key={key} className="text-sm border-l-2 border-blue-500/50 pl-3">
                                                                    <div className="text-xs font-semibold text-muted-foreground mb-1">{getFieldLabel(key)}</div>
                                                                    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start bg-muted/30 p-2 rounded-md">
                                                                        <div className="break-words">
                                                                            <span className="text-[10px] uppercase text-muted-foreground block mb-0.5">{t('eventDetail.history.before')}</span>
                                                                            <span className="text-destructive/80 line-through">{oldValue || <span className="italic">{t('eventDetail.history.empty')}</span>}</span>
                                                                        </div>
                                                                        <ArrowRight className="w-4 h-4 mt-4 text-muted-foreground shrink-0" />
                                                                        <div className="break-words">
                                                                            <span className="text-[10px] uppercase text-muted-foreground block mb-0.5">{t('eventDetail.history.after')}</span>
                                                                            <span className="text-green-600 font-medium">{newValue || <span className="italic">{t('eventDetail.history.empty')}</span>}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {history.action === 'updated' && changedFields.length === 0 && (
                                                        <div className="text-sm text-center text-muted-foreground italic py-2">{t('eventDetail.history.noChanges')}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
