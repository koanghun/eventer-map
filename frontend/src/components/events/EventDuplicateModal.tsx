import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { MapPin, Calendar, Clock, Mic2, AlertTriangle, AlertCircle, Info, Edit2 } from 'lucide-react';
import { Progress } from '../ui/progress';

interface DuplicateEvent {
    event_id: number;
    event_title: string;
    event_date: string;
    location: string;
    start_time?: string;
    performers: string[];
    similarity_score: number;
    recommendation: string;
    matched_criteria: {
        same_date: boolean;
        same_location: boolean;
        same_time: boolean;
        distance_meters?: number;
        time_diff_minutes?: number;
        performer_similarity: number;
        title_similarity: number;
    };
}

interface EventDuplicateModalProps {
    duplicates: DuplicateEvent[];
    onClose: () => void;
    onProceed: () => void;
    onEdit: (eventId: number) => void;
}

function EventDuplicateModal({ duplicates, onClose, onProceed, onEdit }: EventDuplicateModalProps) {
    const { t } = useTranslation();

    const renderSimilarityBadge = (score: number, recommendation: string) => {
        let variant: "default" | "destructive" | "secondary" = "default";
        let Icon = Info;
        
        if (recommendation === 'duplicate') {
            variant = "destructive";
            Icon = AlertCircle;
        } else if (recommendation === 'similar') {
            variant = "default"; // Will override bg
            Icon = AlertTriangle;
        } else {
            variant = "secondary";
        }

        const customClass = recommendation === 'similar' ? "bg-amber-500 hover:bg-amber-600 text-white" : "";

        return (
            <Badge variant={variant} className={`flex items-center gap-1 ml-2 ${customClass}`}>
                <Icon className="w-3 h-3" />
                {t('eventDuplicateModal.similarity')}: {Math.round(score * 100)}%
            </Badge>
        );
    };

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-2xl bg-background rounded-2xl shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                
                <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6" />
                        <h2 className="text-xl font-bold tracking-tight">{t('eventDuplicateModal.title')}</h2>
                    </div>
                    <button className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
                    <p className="text-sm text-muted-foreground mb-6" dangerouslySetInnerHTML={{
                        __html: t('eventDuplicateModal.warningMessage', { count: `<strong class="text-foreground">${duplicates.length}</strong>` as any })
                    }} />

                    <div className="space-y-6">
                        {duplicates.map((dup) => (
                            <div key={dup.event_id} className="bg-card w-full border border-border rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-start gap-4">
                                    <h4 className="font-bold text-lg text-foreground leading-tight">{dup.event_title}</h4>
                                    <div className="shrink-0">
                                        {renderSimilarityBadge(dup.similarity_score, dup.recommendation)}
                                    </div>
                                </div>

                                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <div className="space-y-3">
                                        <div className="flex gap-2 items-start text-muted-foreground">
                                            <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                                            <div>
                                                <div className="font-semibold text-foreground text-xs uppercase tracking-wider mb-0.5">{t('eventDuplicateModal.labels.location')}</div>
                                                <div className="break-words">{dup.location}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2 items-start text-muted-foreground">
                                            <Calendar className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                                            <div>
                                                <div className="font-semibold text-foreground text-xs uppercase tracking-wider mb-0.5">{t('eventDuplicateModal.labels.date')}</div>
                                                <div>{dup.event_date}</div>
                                            </div>
                                        </div>

                                        {dup.start_time && (
                                            <div className="flex gap-2 items-start text-muted-foreground">
                                                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                                                <div>
                                                    <div className="font-semibold text-foreground text-xs uppercase tracking-wider mb-0.5">{t('eventDuplicateModal.labels.time')}</div>
                                                    <div>{dup.start_time}</div>
                                                </div>
                                            </div>
                                        )}

                                        {dup.performers && dup.performers.length > 0 && (
                                            <div className="flex gap-2 items-start text-muted-foreground">
                                                <Mic2 className="w-4 h-4 shrink-0 mt-0.5 text-primary/70" />
                                                <div>
                                                    <div className="font-semibold text-foreground text-xs uppercase tracking-wider mb-0.5">{t('eventDuplicateModal.labels.performers')}</div>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {dup.performers.map(p => (
                                                            <span key={p} className="bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded text-[10px]">{p}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3 p-3 bg-muted/40 rounded-lg border border-border/50">
                                        <h5 className="font-semibold text-xs tracking-wider uppercase text-muted-foreground mb-2">세부 일치 정보</h5>
                                        
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span>{t('eventDuplicateModal.labels.title')}</span>
                                                <span className="font-medium">{Math.round(dup.matched_criteria.title_similarity * 100)}%</span>
                                            </div>
                                            <Progress value={dup.matched_criteria.title_similarity * 100} className="h-1.5" />
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs">
                                                <span>{t('eventDuplicateModal.labels.performers')}</span>
                                                <span className="font-medium">{Math.round(dup.matched_criteria.performer_similarity * 100)}%</span>
                                            </div>
                                            <Progress value={dup.matched_criteria.performer_similarity * 100} className="h-1.5" />
                                        </div>

                                        {dup.matched_criteria.distance_meters !== null && dup.matched_criteria.distance_meters !== undefined && (
                                            <div className="flex justify-between text-xs pt-2 mt-2 border-t border-border/50">
                                                <span>{t('eventDuplicateModal.labels.distance')}</span>
                                                <span className="font-medium text-amber-600">{Math.round(dup.matched_criteria.distance_meters)}m 차이</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="p-3 bg-muted/10 border-t border-border">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => onEdit(dup.event_id)}
                                        className="w-full text-primary border-primary/20 hover:bg-primary/5 shadow-sm"
                                    >
                                        <Edit2 className="w-4 h-4 mr-2" />
                                        {t('eventDuplicateModal.buttons.editExisting')}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-background flex flex-col sm:flex-row gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        {t('eventDuplicateModal.buttons.cancel')}
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={onProceed}>
                        {t('eventDuplicateModal.buttons.proceedAnyway')}
                    </Button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
}

export default EventDuplicateModal;
