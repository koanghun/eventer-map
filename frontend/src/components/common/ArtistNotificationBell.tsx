import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow, isValid, parseISO, type Locale } from 'date-fns';
import { enUS, ja, ko, zhCN } from 'date-fns/locale';
import {
    ArrowRight,
    Bell,
    Calendar,
    CheckCheck,
    Loader2,
    MapPin,
    Sparkles,
    Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEventStore } from '../../store/useEventStore';
import { toast } from '../../store/useToastStore';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ScrollArea } from '../ui/scroll-area';
import {
    getGetUsersMeFollowingArtistsEventsQueryKey,
    useGetUsersMeFollowingArtistsEvents,
    usePostUsersMeFollowingArtistsEventsRead,
} from '../../api/generated/user/user';
import type {
    EventSummary,
    FollowingArtistNotificationEvent,
    GetUsersMeFollowingArtistsEvents200,
} from '../../api/generated/model';

const NOTIFICATION_FEED_LIMIT = 30;
const NOTIFICATION_FEED_PARAMS = {
    unreadOnly: true,
    limit: NOTIFICATION_FEED_LIMIT,
} as const;
const REFETCH_ON_OPEN_MIN_AGE_MS = 15 * 1000;

const dateLocales: Record<string, Locale> = { ko, ja, en: enUS, zh: zhCN };

function toEventSummary(item: FollowingArtistNotificationEvent): EventSummary {
    return {
        id: item.id,
        title: item.title,
        venueId: item.venueId,
        venueName: item.venueName,
        latitude: item.latitude,
        longitude: item.longitude,
        startTime: item.startTime,
        endTime: item.endTime,
        rating: item.rating,
        attendeeCount: item.attendeeCount,
        topArtistName: item.topArtistName,
        topArtistProfileImageUrl: item.topArtistProfileImageUrl,
        status: item.status,
    };
}

function formatEventStartTime(iso: string | undefined, locale: Locale): string {
    if (!iso) return '';
    const parsed = parseISO(iso);
    if (!isValid(parsed)) return '';
    return format(parsed, 'MM/dd (eee) HH:mm', { locale });
}

function formatRelativeCreatedTime(iso: string | undefined, locale: Locale): string {
    if (!iso) return '';
    const parsed = parseISO(iso);
    if (!isValid(parsed)) return '';
    return formatDistanceToNow(parsed, { addSuffix: true, locale });
}

export function ArtistNotificationBell() {
    const { t, i18n } = useTranslation();
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const selectEvent = useEventStore((state) => state.selectEvent);
    const clearSelection = useEventStore((state) => state.clearSelection);
    const [isOpen, setIsOpen] = useState(false);

    const locale = dateLocales[i18n.language] || ko;
    const feedQueryKey = getGetUsersMeFollowingArtistsEventsQueryKey(NOTIFICATION_FEED_PARAMS);

    const {
        data,
        isLoading,
        isError,
        dataUpdatedAt,
        refetch,
    } = useGetUsersMeFollowingArtistsEvents(NOTIFICATION_FEED_PARAMS, {
        query: {
            enabled: isAuthenticated,
            staleTime: 60 * 1000,
            refetchOnWindowFocus: true,
        },
    });

    const { mutate: markFeedAsRead, isPending: isMarkingRead } = usePostUsersMeFollowingArtistsEventsRead({
        mutation: {
            onMutate: async (variables) => {
                await queryClient.cancelQueries({ queryKey: feedQueryKey });
                const previous = queryClient.getQueryData<GetUsersMeFollowingArtistsEvents200>(feedQueryKey);
                if (previous) {
                    queryClient.setQueryData<GetUsersMeFollowingArtistsEvents200>(feedQueryKey, {
                        ...previous,
                        events: [],
                        unreadCount: 0,
                        checkedAt: variables.data.readBefore || previous.fetchedAt || previous.checkedAt,
                    });
                }
                return { previous };
            },
            onError: (error, _variables, context) => {
                if (context?.previous) {
                    queryClient.setQueryData(feedQueryKey, context.previous);
                }
                toast.apiError(error, t('notifications.markReadError', '읽음 처리에 실패했습니다.'));
            },
            onSettled: () => {
                queryClient.invalidateQueries({ queryKey: getGetUsersMeFollowingArtistsEventsQueryKey() });
            },
        },
    });

    if (!isAuthenticated) return null;

    const events = data?.events ?? [];
    const unreadCount = data?.unreadCount ?? 0;
    const hasUnreadEvents = unreadCount > 0 && events.length > 0;
    const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

    const handleOpenChange = (nextOpen: boolean) => {
        setIsOpen(nextOpen);
        if (nextOpen && Date.now() - dataUpdatedAt > REFETCH_ON_OPEN_MIN_AGE_MS) {
            void refetch();
        }
    };

    const handleSelectNotificationEvent = (item: FollowingArtistNotificationEvent) => {
        if (!item.id) return;
        selectEvent(toEventSummary(item));
        setIsOpen(false);
        if (location.pathname !== '/') {
            navigate('/');
        }
    };

    const handleViewAllNewEvents = () => {
        const snapshotSince = data?.checkedAt;
        const readBefore = data?.fetchedAt;

        setIsOpen(false);
        clearSelection();

        const nextParams = new URLSearchParams();
        nextParams.set('followingArtists', 'true');
        if (snapshotSince) {
            nextParams.set('newEventsSince', snapshotSince);
        }
        navigate(`/?${nextParams.toString()}`, { replace: location.pathname === '/' });

        markFeedAsRead({
            data: readBefore ? { readBefore } : {},
        });
    };

    const handleMarkAllRead = () => {
        const readBefore = data?.fetchedAt;
        markFeedAsRead({
            data: readBefore ? { readBefore } : {},
        });
    };

    const formatMatchedArtists = (item: FollowingArtistNotificationEvent): string => {
        const names = item.matchedArtistNames?.filter(Boolean) ?? [];
        if (names.length === 0) {
            return item.topArtistName || '';
        }
        if (names.length <= 2) {
            return names.join(', ');
        }
        return t('notifications.moreArtists', {
            names: names.slice(0, 2).join(', '),
            count: names.length - 2,
            defaultValue: `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}명`,
        });
    };

    return (
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="relative rounded-full w-9 h-9"
                    aria-label={t('notifications.ariaLabel', '신규 이벤트 알림')}
                    title={t('notifications.title', '신규 이벤트 알림')}
                >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                        <span
                            data-testid="notification-unread-badge"
                            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-none flex items-center justify-center shadow-sm ring-2 ring-background"
                        >
                            {badgeLabel}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>

            <PopoverContent
                align="end"
                className="w-[360px] max-w-[calc(100vw-2rem)] p-0 bg-popover text-popover-foreground border border-border shadow-xl rounded-2xl mt-2 overflow-hidden"
            >
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0">
                        <Bell className="w-4 h-4 text-primary shrink-0" />
                        <h3 className="text-sm font-bold text-foreground truncate">
                            {t('notifications.title', '신규 이벤트 알림')}
                        </h3>
                        {unreadCount > 0 && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-semibold">
                                {unreadCount}
                            </Badge>
                        )}
                    </div>

                    {unreadCount > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isMarkingRead}
                            onClick={handleMarkAllRead}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                        >
                            <CheckCheck className="w-3.5 h-3.5 mr-1" />
                            {t('notifications.markAllRead', '모두 읽음')}
                        </Button>
                    )}
                </div>

                {hasUnreadEvents && (
                    <button
                        type="button"
                        onClick={handleViewAllNewEvents}
                        className="w-full px-4 py-3 border-b border-border bg-primary/5 hover:bg-primary/10 transition-colors flex items-center justify-between gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Sparkles className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-sm font-semibold text-primary truncate">
                                {t('notifications.viewAllNew', '전체 신규 이벤트 확인')}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="default" className="h-5 px-1.5 text-[11px]">
                                {unreadCount}
                            </Badge>
                            <ArrowRight className="w-4 h-4 text-primary" />
                        </div>
                    </button>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                ) : isError ? (
                    <div className="p-6 text-center space-y-2">
                        <p className="text-sm text-muted-foreground">
                            {t('notifications.loadError', '알림을 불러오지 못했습니다.')}
                        </p>
                        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                            {t('notifications.retry', '다시 시도')}
                        </Button>
                    </div>
                ) : events.length === 0 ? (
                    <div className="p-8 text-center space-y-1.5">
                        <Bell className="w-7 h-7 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-sm font-medium text-foreground">
                            {t('notifications.empty', '새로운 이벤트 알림이 없습니다.')}
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {t('notifications.emptyDesc', '팔로우한 출연자의 신규 예정 이벤트가 등록되면 여기에 표시됩니다.')}
                        </p>
                    </div>
                ) : (
                    <ScrollArea className="max-h-[360px]">
                        <div className="divide-y divide-border/70">
                            {events.map((item) => {
                                const artistText = formatMatchedArtists(item);
                                const startLabel = formatEventStartTime(item.startTime, locale);
                                const createdLabel = formatRelativeCreatedTime(item.createdAt, locale);

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleSelectNotificationEvent(item)}
                                        className="w-full px-4 py-3 text-left hover:bg-muted/60 transition-colors focus:outline-none focus-visible:bg-muted/80"
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                                                        {item.title}
                                                    </p>
                                                    {createdLabel && (
                                                        <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                                                            {createdLabel}
                                                        </span>
                                                    )}
                                                </div>

                                                {artistText && (
                                                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                                                        <Users className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="truncate">{artistText}</span>
                                                    </div>
                                                )}

                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                                    {item.venueName && (
                                                        <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
                                                            <MapPin className="w-3 h-3 shrink-0" />
                                                            <span className="truncate">{item.venueName}</span>
                                                        </span>
                                                    )}
                                                    {startLabel && (
                                                        <span className="inline-flex items-center gap-1 shrink-0">
                                                            <Calendar className="w-3 h-3 shrink-0" />
                                                            <span>{startLabel}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {unreadCount > events.length && (
                            <p className="px-4 py-2.5 text-[11px] text-center text-muted-foreground border-t border-border bg-muted/20">
                                {t('notifications.moreAvailableHint', {
                                    count: unreadCount,
                                    defaultValue: `전체 목록(${unreadCount}건)은 '전체 신규 이벤트 확인'에서 볼 수 있습니다.`,
                                })}
                            </p>
                        )}
                    </ScrollArea>
                )}
            </PopoverContent>
        </Popover>
    );
}

