import { X, Calendar, MapPin, ExternalLink, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEventStore } from '../../store/useEventStore';
import { Button } from '../ui/button';

export default function EventDetailPane() {
    const { t } = useTranslation();
    const selectedEvent = useEventStore((state) => state.selectedEvent);
    const clearSelection = useEventStore((state) => state.clearSelection);

    if (!selectedEvent) return null;

    return (
        <aside className="w-full h-full bg-card/80 backdrop-blur-md border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right-8 duration-500 z-10">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
                <h2 className="text-lg font-bold text-foreground truncate">
                    {t('eventDetail.title', '이벤트 상세 정보')}
                </h2>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={clearSelection} 
                    className="rounded-full hover:bg-muted"
                >
                    <X className="w-5 h-5 text-muted-foreground" />
                </Button>
            </div>

            {/* Content Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* Title & Metadata */}
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-primary mb-3">
                        {selectedEvent.title || 'Untitled Event'}
                    </h1>
                    
                    <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-start gap-2">
                            <Calendar className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate">{(selectedEvent as any).event_date || (selectedEvent as any).startTime || '날짜 미정'}</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate">{(selectedEvent as any).place?.canonical_name || (selectedEvent as any).location || '장소 미정'}</span>
                        </div>
                        {(selectedEvent as any).related_link && (
                            <div className="flex items-center gap-2 mt-2">
                                <ExternalLink className="w-4 h-4 shrink-0 text-primary/70" />
                                <a 
                                    href={(selectedEvent as any).related_link} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline hover:text-primary/80 transition-colors truncate"
                                >
                                    {t('eventDetail.relatedLink', '관련 링크 열기')}
                                </a>
                            </div>
                        )}
                    </div>
                </div>

                {/* Description Box */}
                {(selectedEvent as any).description && (
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                            <Info className="w-4 h-4 text-primary" />
                            <h3 className="font-bold text-sm text-foreground">상세 정보</h3>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                            {(selectedEvent as any).description}
                        </p>
                    </div>
                )}

                {/* Future: Thread / Comments Section */}
                <div className="border-t border-border/50 pt-5">
                    <h3 className="font-bold text-foreground mb-3 flex items-center justify-between">
                        {t('eventDetail.thread.title', '스레드 (댓글)')}
                        <span className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-full">
                            Coming soon
                        </span>
                    </h3>
                    <div className="bg-muted/20 border border-dashed border-border/80 rounded-xl h-32 flex items-center justify-center text-sm text-muted-foreground">
                        스레드 기능이 준비 중입니다.
                    </div>
                </div>

            </div>
        </aside>
    );
}
