import { ArrowLeft, Calendar, MapPin, ExternalLink, Users, Mic2, Edit2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEventStore } from '../../store/useEventStore';
import { Button } from '../ui/button';

import { useGetEventsEventId } from '../../api/generated/events/events';

interface EventDetailPaneProps {
    onEdit?: () => void;
}

export default function EventDetailPane({ onEdit }: EventDetailPaneProps) {
    const { t } = useTranslation();
    const selectedEvent = useEventStore((state) => state.selectedEvent);
    const clearSelection = useEventStore((state) => state.clearSelection);

    const { data: eventData, isLoading } = useGetEventsEventId(
        selectedEvent?.id || '',
        {
            query: {
                enabled: !!selectedEvent?.id,
            },
        }
    );

    if (!selectedEvent) return null;

    const displayEvent = eventData || selectedEvent;


    return (
        <div className="w-full h-full flex flex-col animate-in fade-in slide-in-from-left-4 duration-300 overflow-hidden">
            {/* Header (좌측 상단 뒤로가기 버튼) */}
            <div className="flex items-center gap-2 p-4 border-b border-border/50 shrink-0">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={clearSelection} 
                    className="rounded-full w-8 h-8 hover:bg-muted shrink-0"
                    title={t('buttons.back', '뒤로가기')}
                    aria-label={t('buttons.back', '뒤로가기')}
                >
                    <ArrowLeft className="w-4 h-4 text-foreground" />
                </Button>
                <h2 className="text-lg font-bold text-foreground truncate flex-1">
                    {t('eventDetail.title', 'Event Details')}
                </h2>
                {onEdit && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onEdit}
                        className="rounded-full w-8 h-8 hover:bg-muted text-muted-foreground hover:text-primary shrink-0"
                        title={t('buttons.edit', '수정')}
                        aria-label={t('buttons.edit', '수정')}
                    >
                        <Edit2 className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Content Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* Title & Metadata */}
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-primary mb-3">
                        {displayEvent.title || 'Untitled Event'}
                    </h1>
                    
                    <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-start gap-2">
                            <Calendar className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate">{displayEvent.startTime || t('eventDetail.dateUnknown', 'Date TBD')}</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate">
                                {isLoading 
                                    ? t('eventDetail.loading', 'Loading...') 
                                    : ('venue' in displayEvent && displayEvent.venue?.officialName)
                                        || ('venueName' in displayEvent && displayEvent.venueName)
                                        || t('eventDetail.venueUnknown', 'Venue TBD')}
                            </span>
                        </div>
                        {typeof displayEvent.attendeeCount === 'number' && (
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-primary shrink-0" />
                                <span>{displayEvent.attendeeCount}</span>
                            </div>
                        )}
                        {('artists' in displayEvent) && displayEvent.artists && displayEvent.artists.length > 0 && (
                            <div className="flex items-start gap-2">
                                <Mic2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <span className="break-words">
                                    {displayEvent.artists
                                        .map((a) =>
                                            a.officialName
                                                ? a.disambiguation
                                                    ? `${a.officialName} (${a.disambiguation})`
                                                    : a.officialName
                                                : ''
                                        )
                                        .filter(Boolean)
                                        .join(', ')}
                                </span>
                            </div>
                        )}
                        {('relatedLinks' in displayEvent) && displayEvent.relatedLinks && displayEvent.relatedLinks.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                                <ExternalLink className="w-4 h-4 shrink-0 text-primary/70" />
                                <a 
                                    href={displayEvent.relatedLinks[0]} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline hover:text-primary/80 transition-colors truncate"
                                >
                                    {t('eventDetail.relatedLink', 'Open Related Link')}
                                </a>
                            </div>
                        )}
                    </div>
                </div>


                {/* Future: Thread / Comments Section */}
                <div className="border-t border-border/50 pt-5">
                    <h3 className="font-bold text-foreground mb-3 flex items-center justify-between">
                        {t('eventDetail.thread.title', 'Thread (Comments)')}
                        <span className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded-full">
                            Coming soon
                        </span>
                    </h3>
                    <div className="bg-muted/20 border border-dashed border-border/80 rounded-xl h-32 flex items-center justify-center text-sm text-muted-foreground">
                        {t('eventDetail.thread.comingSoonMsg', 'Thread feature is coming soon.')}
                    </div>
                </div>

            </div>
        </div>
    );
}
