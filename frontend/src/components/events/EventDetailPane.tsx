import { ArrowLeft, Calendar, MapPin, ExternalLink, Users, Mic2, Edit2, Bookmark, UserCheck, RotateCcw, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useEventStore } from '../../store/useEventStore';
import { toast } from '../../store/useToastStore';
import { Button } from '../ui/button';
import {
    useGetEventsEventId,
    usePutEventsEventIdAction,
    getGetEventsEventIdQueryKey,
    getGetEventsQueryKey,
} from '../../api/generated/events/events';
import {
    useGetUsersMeEvents,
    getGetUsersMeEventsQueryKey,
} from '../../api/generated/user/user';
import {
    PutEventsEventIdActionBodyStatus,
    UserEventActionStatus,
    type Event,
    type UserEventAction,
} from '../../api/generated/model';

interface EventDetailPaneProps {
    onEdit?: () => void;
    onArtistSelect?: (artist: { id: string; name: string }) => void;
    onVenueSelect?: (venue: { id: string; name: string; lat?: number; lng?: number }) => void;
}

    export default function EventDetailPane({
        onEdit,
        onArtistSelect,
        onVenueSelect,
    }: EventDetailPaneProps) {
        const { t } = useTranslation();
        const queryClient = useQueryClient();
        const { isAuthenticated } = useAuth();
        const selectedEvent = useEventStore((state) => state.selectedEvent);
        const clearSelection = useEventStore((state) => state.clearSelection);

        const eventId = selectedEvent?.id || '';

        const { data: eventData, isLoading } = useGetEventsEventId(
            eventId,
            {
                query: {
                    enabled: !!eventId,
                },
            }
        );

        const { data: myEventActions } = useGetUsersMeEvents({
            query: {
                enabled: isAuthenticated,
            },
        });

        const currentStatus: 0 | 1 | 2 = isAuthenticated
            ? (myEventActions?.find((a) => a.eventId === eventId)?.status ?? 0)
            : 0;

                    const actionMutation = usePutEventsEventIdAction<
                        unknown,
                    {
                        previousActions ?: UserEventAction[];
                    previousEvent?: Event;
        }
    >({
                        mutation: {
                        onMutate: async ({eventId: targetEventId, data }) => {
                const actionsKey = getGetUsersMeEventsQueryKey();
                    const eventKey = getGetEventsEventIdQueryKey(targetEventId);

                    await Promise.all([
                    queryClient.cancelQueries({queryKey: actionsKey }),
                    queryClient.cancelQueries({queryKey: eventKey }),
                    ]);

                    const previousActions = queryClient.getQueryData<UserEventAction[]>(actionsKey);
                    const previousEvent = queryClient.getQueryData<Event>(eventKey);

                        const prevStatus =
                    previousActions?.find((a) => a.eventId === targetEventId)?.status ?? 0;
                        const nextStatus = data.status;

                        queryClient.setQueryData<UserEventAction[]>(actionsKey, (old = []) => {
                    const filtered = old.filter((a) => a.eventId !== targetEventId);
                        if (nextStatus === PutEventsEventIdActionBodyStatus.NUMBER_0) {
                        return filtered;
                    }
                        return [
                        ...filtered,
                        {
                            eventId: targetEventId,
                        status: nextStatus as UserEventActionStatus,
                        },
                        ];
                });

                        if (previousEvent) {
                            let countDelta = 0;
                        if (prevStatus !== 2 && nextStatus === 2) countDelta = 1;
                        if (prevStatus === 2 && nextStatus !== 2) countDelta = -1;

                        if (countDelta !== 0) {
                            queryClient.setQueryData<Event>(eventKey, {
                                ...previousEvent,
                                attendeeCount: Math.max(0, (previousEvent.attendeeCount ?? 0) + countDelta),
                            });
                    }
                }

                        return {previousActions, previousEvent};
            },
                        onError: (err, {eventId: targetEventId }, context) => {
                if (context?.previousActions !== undefined) {
                            queryClient.setQueryData(getGetUsersMeEventsQueryKey(), context.previousActions);
                }
                        if (context?.previousEvent !== undefined) {
                            queryClient.setQueryData(
                                getGetEventsEventIdQueryKey(targetEventId),
                                context.previousEvent
                            );
                }
                        toast.apiError(
                        err,
                        t('eventDetail.action.updateFailed', '이벤트 상태 변경에 실패했습니다.')
                        );
            },
                        onSettled: (_data, _error, {eventId: targetEventId }) => {
                            queryClient.invalidateQueries({ queryKey: getGetUsersMeEventsQueryKey() });
                        queryClient.invalidateQueries({
                            queryKey: getGetEventsEventIdQueryKey(targetEventId),
                });
                        queryClient.invalidateQueries({queryKey: getGetEventsQueryKey() });
            },
        },
    });

                        if (!selectedEvent) return null;

    const handleCycleAction = () => {
        if (!isAuthenticated) {
                            toast.info(t('auth.loginRequired', '로그인이 필요합니다'));
                        return;
        }
                        if (!eventId || actionMutation.isPending) return;

                        const nextStatus = ((currentStatus + 1) % 3) as PutEventsEventIdActionBodyStatus;
                        actionMutation.mutate({
                            eventId,
                            data: {status: nextStatus },
        });
    };

                        const displayEvent = eventData || selectedEvent;
                        const venueId =
                        ('venue' in displayEvent && displayEvent.venue?.id) ||
                        ('venueId' in displayEvent ? displayEvent.venueId : undefined);
                        const venueName =
                        ('venue' in displayEvent && displayEvent.venue?.officialName) ||
                        ('venueName' in displayEvent ? displayEvent.venueName : undefined);
                        const venueLat =
                        ('venue' in displayEvent ? displayEvent.venue?.latitude : undefined) ??
                        ('latitude' in displayEvent ? displayEvent.latitude : undefined);
                        const venueLng =
                        ('venue' in displayEvent ? displayEvent.venue?.longitude : undefined) ??
                        ('longitude' in displayEvent ? displayEvent.longitude : undefined);


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
                                                        <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                                        {isLoading && !venueName ? (
                                                            <span className="truncate">{t('eventDetail.loading', 'Loading...')}</span>
                                                        ) : venueId && venueName && onVenueSelect ? (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    onVenueSelect({
                                                                        id: venueId,
                                                                        name: venueName,
                                                                        lat: venueLat,
                                                                        lng: venueLng,
                                                                    })
                                                                }
                                                                className="text-left text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors font-medium break-words cursor-pointer"
                                                                title={t('eventDetail.searchByVenue', '이 공연장으로 검색 (6개월)')}
                                                            >
                                                                {venueName}
                                                            </button>
                                                        ) : (
                                                            <span className="truncate">
                                                                {venueName || t('eventDetail.venueUnknown', 'Venue TBD')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {typeof displayEvent.attendeeCount === 'number' && (
                                                        <div className="flex items-center gap-2">
                                                            <Users className="w-4 h-4 text-primary shrink-0" />
                                                            <span>{displayEvent.attendeeCount}</span>
                                                        </div>
                                                    )}
                                                    {('artists' in displayEvent) && displayEvent.artists && displayEvent.artists.length > 0 && (
                                                        <div className="flex items-start gap-2">
                                                                    < Mic2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                                                    {displayEvent.artists
                                                                        .filter((a) => Boolean(a.officialName))
                                                                        .map((a, idx, arr) => {
                                                                            const label = a.disambiguation
                                                ? `${a.officialName} (${a.disambiguation})`
                                                                        : a.officialName!;
                                                                    return (
                                                                    <span key={a.id || idx} className="inline-flex items-center">
                                                                        {a.id && onArtistSelect ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    onArtistSelect({
                                                                                        id: a.id!,
                                                                                        name: a.officialName!,
                                                                                    })
                                                                                }
                                                                                className="text-left text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors font-medium break-words cursor-pointer"
                                                                                title={t('eventDetail.searchByArtist', '이 출연자로 검색 (6개월)')}
                                                                            >
                                                                                {label}
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-foreground">{label}</span>
                                                                        )}
                                                                        {idx < arr.length - 1 && (
                                                                            <span className="text-muted-foreground">,</span>
                                                                        )}
                                                                    </span>
                                                                    );
                                        })}
                                                                </div>
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

                    {/* 체크 -> 참가 -> 해제 상태 순환 버튼 */}
                                                    <div className="mt-4 pt-4 border-t border-border/50 flex flex-col gap-2">
                                                        {currentStatus !== 0 && (
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span
                                                                    className={
                                                                        currentStatus === 1
                                                                            ? 'inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full'
                                                                            : 'inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full'
                                                                    }
                                                                >
                                                                    {currentStatus === 1 ? (
                                                                        <>
                                                                            <Bookmark className="w-3 h-3 fill-current" />
                                                                            {t('eventDetail.action.statusChecked', '체크됨')}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <UserCheck className="w-3 h-3" />
                                                                            {t('eventDetail.action.statusAttending', '참가중')}
                                                                        </>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <Button
                                                            type="button"
                                                            disabled={actionMutation.isPending}
                                                            onClick={handleCycleAction}
                                                            variant={currentStatus === 2 ? 'outline' : 'default'}
                                                            className={
                                                                currentStatus === 0
                                                                    ? 'w-full font-bold shadow-sm transition-all'
                                                                    : currentStatus === 1
                                                                        ? 'w-full font-bold bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white shadow-md transition-all'
                                                                        : 'w-full font-bold border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5 transition-all'
                                                            }
                                                        >
                                                            {actionMutation.isPending ? (
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                            ) : currentStatus === 0 ? (
                                                                <Bookmark className="w-4 h-4 mr-2" />
                                                            ) : currentStatus === 1 ? (
                                                                <UserCheck className="w-4 h-4 mr-2" />
                                                            ) : (
                                                                <RotateCcw className="w-4 h-4 mr-2" />
                                                            )}
                                                            {currentStatus === 0
                                                                ? t('eventDetail.action.check', '체크')
                                                                : currentStatus === 1
                                                                    ? t('eventDetail.action.attend', '참가')
                                                                    : t('eventDetail.action.release', '해제')}
                                                        </Button>
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
