import { type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import ReactDOM from 'react-dom';
import { Performer } from '../../types/event';
import { Button } from '../ui/button';
import { AlertCircle, FileSearch, X, Tag, CheckSquare } from 'lucide-react';

interface DuplicateCheckModalProps {
    type: 'exact' | 'similar';
    inputName: string;
    exactMatch?: Performer | null;
    similarMatches?: Performer[];
    onUseExisting: (performer: Performer) => void;
    onCreateNew: () => void;
    onCancel: () => void;
}

function DuplicateCheckModal({
    type,
    inputName,
    exactMatch,
    similarMatches = [],
    onUseExisting,
    onCreateNew,
    onCancel,
}: DuplicateCheckModalProps) {
    const { t } = useTranslation();

    const handleOverlayClick = (e: MouseEvent) => {
        e.stopPropagation();
        onCancel();
    };

    const modalContent = (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={handleOverlayClick}>
            <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                
                <div className={`flex items-center justify-between p-5 border-b border-border text-white ${type === 'exact' ? 'bg-destructive' : 'bg-amber-500'}`}>
                    <div className="flex items-center gap-2 font-bold text-lg">
                        {type === 'exact' ? <AlertCircle className="w-5 h-5" /> : <FileSearch className="w-5 h-5" />}
                        <h3>{type === 'exact' ? t('performerDuplicateModal.exactTitle') : t('performerDuplicateModal.similarTitle')}</h3>
                    </div>
                    <button className="text-white/80 hover:text-white hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center transition-colors" onClick={onCancel}>
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {type === 'exact' && exactMatch && (
                        <div className="space-y-5">
                            <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('performerDuplicateModal.exactMessage', { name: `<strong class="text-foreground">${inputName}</strong>` }) }} />
                            
                            <div className="border border-destructive/20 bg-destructive/5 rounded-xl p-5 shadow-sm text-center">
                                <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3 opacity-80" />
                                <div className="text-xl font-bold text-foreground mb-2">{exactMatch.canonical_name}</div>
                                {exactMatch.aliases && exactMatch.aliases.length > 0 && (
                                    <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full mb-4">
                                        <Tag className="w-3 h-3" />
                                        {t('performerDuplicateModal.labels.aliases')}: {exactMatch.aliases.join(', ')}
                                    </div>
                                )}
                                <Button
                                    variant="default"
                                    className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => onUseExisting(exactMatch)}
                                >
                                    <CheckSquare className="w-4 h-4 mr-2" />
                                    {t('performerDuplicateModal.buttons.useExisting')}
                                </Button>
                            </div>
                        </div>
                    )}

                    {type === 'similar' && similarMatches.length > 0 && (
                        <div className="space-y-5">
                            <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('performerDuplicateModal.similarMessage', { name: `<strong class="text-foreground">${inputName}</strong>` }) }} />
                            
                            <div className="space-y-3">
                                {similarMatches.map((performer) => (
                                    <div key={performer.id} className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card hover:border-amber-500/50 hover:shadow-md transition-all">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-foreground group-hover:text-amber-600 transition-colors uppercase tracking-wide text-sm">{performer.canonical_name}</div>
                                            {(() => {
                                                const aliases = performer.aliases || [];
                                                return aliases.length > 0 && (
                                                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground truncate">
                                                        <Tag className="w-3 h-3 shrink-0" />
                                                        <span className="truncate">{aliases.join(', ')}</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="w-full sm:w-auto shrink-0 border-amber-200 text-amber-600 hover:bg-amber-50"
                                            onClick={() => onUseExisting(performer)}
                                        >
                                            <CheckSquare className="w-4 h-4 mr-2" />
                                            {t('performerDuplicateModal.buttons.select')}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="relative flex py-4 items-center">
                                <div className="flex-grow border-t border-border"></div>
                                <span className="shrink-0 mx-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('performerDuplicateModal.divider')}</span>
                                <div className="flex-grow border-t border-border"></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border bg-muted/10 flex flex-col sm:flex-row gap-3">
                    {type === 'similar' ? (
                        <>
                            <Button variant="outline" className="flex-1 order-2 sm:order-1" onClick={onCancel}>
                                {t('performerDuplicateModal.buttons.cancel')}
                            </Button>
                            <Button className="flex-1 order-1 sm:order-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white" onClick={onCreateNew}>
                                {t('performerDuplicateModal.buttons.createNew', { name: inputName })}
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline" className="w-full" onClick={onCancel}>
                            {t('performerDuplicateModal.buttons.cancel')}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
}

export default DuplicateCheckModal;
