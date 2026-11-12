import { useEffect, useState, type ReactNode } from 'react';
import {
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Heart,
    Loader2,
    LocateFixed,
    MapPin,
    Mic2,
    RotateCcw,
    Star,
    Users,
    X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../store/useToastStore';
import { cn, getSafeExternalUrl } from '../../lib/utils';
import { Button } from '../ui/button';
import {
    getGetArtistsArtistIdFollowersQueryKey,
    useDeleteArtistsArtistIdFollow,
    useGetArtistsArtistIdFollowers,
    usePostArtistsArtistIdFollow,
} from '../../api/generated/artists/artists';
import { getGetEventsQueryKey } from '../../api/generated/events/events';
import {
    getGetUsersMeFollowingArtistsEventsQueryKey,
    getGetUsersMeFollowingArtistsQueryKey,
    useGetUsersMeFollowingArtists,
} from '../../api/generated/user/user';
import type { Artist, Venue } from '../../api/generated/model';

const FOLLOWERS_FETCH_LIMIT = 50;

function invalidateFollowCaches(queryClient: QueryClient, artistId?: string) {
    queryClient.invalidateQueries({ queryKey: getGetUsersMeFollowingArtistsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetUsersMeFollowingArtistsEventsQueryKey() });
    if (artistId) {
        queryClient.invalidateQueries({ queryKey: getGetArtistsArtistIdFollowersQueryKey(artistId) });
    }
    queryClient.invalidateQueries({
        queryKey: getGetEventsQueryKey(),
        predicate: (q) => Boolean((q.queryKey[1] as { followingArtists?: boolean } | undefined)?.followingArtists),
    });
}

interface EntityInfoShellProps {
    icon: ReactNode;
    title: string;
    headerBadge?: ReactNode;
    status?: string;
    isLoading: boolean;
    isError: boolean;
    errorMessage: string;
    initialName?: string;
    collapsible?: boolean;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    panelId?: string;
    onRetry?: () => void;
    onClear?: () => void;
    children: ReactNode;
}

function EntityStatusBadge({ status }: { status?: string }) {
    const { t } = useTranslation();
    if (!status || status === 'APPROVED') return null;

    const isPending = status === 'PENDING';
    return (
        <span
            className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0',
                isPending
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                    : 'bg-destructive/15 text-destructive border border-destructive/30'
            )}
        >
            {t(`entityInfo.status.${status}`, status)}
        </span>
    );
}

function EntityRating({ rating, ratingCount }: { rating?: number; ratingCount?: number }) {
    const { t } = useTranslation();
    if (typeof rating === 'number' && rating > 0) {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                <span>{rating.toFixed(1)}</span>
                {typeof ratingCount === 'number' && ratingCount > 0 && (
                    <span className="font-normal text-muted-foreground">({ratingCount})</span>
                )}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Star className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            <span>{t('entityInfo.noRatings', '아직 평점이 없습니다.')}</span>
        </span>
    );
}

function EntityInfoShell({
    icon,
    title,
    headerBadge,
    status,
    isLoading,
    isError,
    errorMessage,
    initialName,
    collapsible = false,
    isCollapsed = false,
    onToggleCollapse,
    panelId,
    onRetry,
    onClear,
    children,
}: EntityInfoShellProps) {
    const { t } = useTranslation();

    const headerTitleContent = (
        <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-primary shrink-0">{icon}</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary truncate">
                {title}
            </h3>
            {headerBadge}
            <EntityStatusBadge status={status} />
        </div>
    );

    const showBody = !collapsible || !isCollapsed;

    return (
            <section
                className={cn(
                    'border-b border-border bg-card/80 animate-in fade-in duration-200',
                    showBody ? 'p-3.5 space-y-2.5' : 'px-3.5 py-2.5'
                )}
            >
                <div className="flex items-center justify-between gap-2">
                    {collapsible ? (
                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            aria-expanded={!isCollapsed}
                            aria-controls={panelId}
                            title={
                                isCollapsed
                                    ? t('entityInfo.expand', '펼치기')
                                    : t('entityInfo.collapse', '접기')
                            }
                            className="flex items-center justify-between gap-2 flex-1 min-w-0 text-left group hover:opacity-85 transition-opacity"
                        >
                            {headerTitleContent}
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground group-hover:text-foreground shrink-0">
                                <span>
                                    {isCollapsed
                                        ? t('entityInfo.collapsedHint', '접힘')
                                        : t('entityInfo.collapse', '접기')}
                                </span>
                                {isCollapsed ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                )}
                            </span>
                        </button>
                    ) : (
                        headerTitleContent
                    )}
                    {onClear && (
                        <button
                            type="button"
                            onClick={onClear}
                            className="p-1 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                            title={t('performerFilter.clearFilter', '필터 해제')}
                            aria-label={t('performerFilter.clearFilter', '필터 해제')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                                {showBody && (
                                    <div id={panelId}>
                                        {isLoading ? (
                                            <div className="space-y-2 py-1">
                                                {initialName && (
                                                    <div className="text-sm font-bold text-foreground break-words">
                                                        {initialName}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                                                    <span>{t('eventDetail.loading', '불러오는 중...')}</span>
                                                </div>
                                            </div>
                                            ) : isError ? (
                                            <div className="space-y-2 py-1">
                                                {initialName && (
                                                    <div className="text-sm font-bold text-foreground break-words">
                                                        {initialName}
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-2.5 py-2">
                                                    <span className="break-words">{errorMessage}</span>
                                                    {onRetry && (
                                                        <button
                                                            type="button"
                                                            onClick={onRetry}
                                                            className="inline-flex items-center gap-1 font-semibold underline shrink-0 hover:opacity-80"
                                                        >
                                                            <RotateCcw className="w-3 h-3" />
                                                            {t('buttons.retry', '다시 시도')}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            ) : (
                                            children
                    )}
                                        </div>
            )}
                                </section>
                                );
}

                                interface ArtistInfoCardProps {
                                    artistId: string;
                                artist?: Artist;
                                initialName?: string;
                                isLoading: boolean;
                                isError: boolean;
                                defaultCollapsed?: boolean;
    onRetry?: () => void;
    onClear?: () => void;
}

                                /**
                                 * 좌측 사이드바에 선택된 출연자(아티스트)의 상세 정보를 표시하는 카드 컴포넌트
                                 */
                                export function ArtistInfoCard({
                                    artistId,
                                    artist,
                                    initialName,
                                    isLoading,
                                    isError,
                                    defaultCollapsed = false,
                                    onRetry,
                                    onClear,
}: ArtistInfoCardProps) {
    const {t} = useTranslation();
                                const {isAuthenticated} = useAuth();
                                const queryClient = useQueryClient();
                                const [imgError, setImgError] = useState(false);
                                const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

    useEffect(() => {
                                    setImgError(false);
    }, [artistId, artist?.profileImageUrl]);

    useEffect(() => {
                                    setIsCollapsed(defaultCollapsed);
    }, [artistId, defaultCollapsed]);

                                const {data: followersData } = useGetArtistsArtistIdFollowers(
                                artistId,
                                {limit: FOLLOWERS_FETCH_LIMIT, offset: 0 },
                                {
                                    query: {
                                    enabled: Boolean(artistId),
                                staleTime: 60 * 1000,
            },
        }
                                );

                                const {data: followingArtists } = useGetUsersMeFollowingArtists(
                                {limit: 100, offset: 0 },
                                {
                                    query: {
                                    enabled: isAuthenticated && Boolean(artistId),
                                staleTime: 60 * 1000,
            },
        }
                                );

                                const isFollowing = Boolean(
                                isAuthenticated &&
                                Array.isArray(followingArtists) &&
        followingArtists.some((item) => item.id === artistId)
                                );

    const invalidateFollowQueries = () => {
                                invalidateFollowCaches(queryClient, artistId);
    };

                                const followMutation = usePostArtistsArtistIdFollow({
                                    mutation: {
                                    onSuccess: () => {
                                    invalidateFollowQueries();
                                toast.success(t('entityInfo.followSuccess', '출연자를 팔로우했습니다.'));
            },
            onError: (err) => {
                                    toast.apiError(err, t('entityInfo.followFailed', '팔로우 처리에 실패했습니다.'));
            },
        },
    });

                                const unfollowMutation = useDeleteArtistsArtistIdFollow({
                                    mutation: {
                                    onSuccess: () => {
                                    invalidateFollowQueries();
                                toast.success(t('entityInfo.unfollowSuccess', '팔로우를 취소했습니다.'));
            },
            onError: (err) => {
                                    toast.apiError(err, t('entityInfo.followFailed', '팔로우 처리에 실패했습니다.'));
            },
        },
    });

                                const isFollowPending = followMutation.isPending || unfollowMutation.isPending;

    const handleToggleFollow = () => {
        if (!isAuthenticated) {
                                    toast.info(t('auth.loginRequired', '로그인이 필요합니다'));
                                return;
        }
                                if (!artistId || isFollowPending) return;

                                if (isFollowing) {
                                    unfollowMutation.mutate({ artistId });
        } else {
                                    followMutation.mutate({ artistId });
        }
    };

                                const displayName = artist?.officialName || initialName || '';
                                const safeProfileImageUrl = getSafeExternalUrl(artist?.profileImageUrl);
                                const followerCount = Array.isArray(followersData) ? followersData.length : null;
                                const followerLabel =
                                followerCount === null
                                ? null
            : followerCount >= FOLLOWERS_FETCH_LIMIT
                                ? t('entityInfo.followersCountPlus', {
                                    count: FOLLOWERS_FETCH_LIMIT,
                                defaultValue: `팔로워 ${FOLLOWERS_FETCH_LIMIT}+명`,
                })
                                : t('entityInfo.followersCount', {
                                    count: followerCount,
                                defaultValue: `팔로워 ${followerCount}명`,
                });

                                return (
                                <EntityInfoShell
                                    icon={<Mic2 className="w-4 h-4" />}
                                    title={t('entityInfo.artistTitle', '출연자 정보')}
                                    status={artist?.status}
                                    isLoading={isLoading && !artist}
                                    isError={isError && !artist}
                                    errorMessage={t('entityInfo.loadArtistError', '출연자 정보를 불러오지 못했습니다.')}
                                    initialName={initialName}
                                    collapsible={true}
                                    isCollapsed={isCollapsed}
                                    onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
                                    panelId="single-artist-info-panel"
                                    onRetry={onRetry}
                                    onClear={onClear}
                                >
                                    <div className="space-y-2.5">
                                        <div className="flex items-start gap-3">
                                            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-border bg-primary/10 flex items-center justify-center">
                                                {safeProfileImageUrl && !imgError ? (
                                                    <img
                                                        src={safeProfileImageUrl}
                                                        alt={displayName}
                                                        className="w-full h-full object-cover"
                                                        onError={() => setImgError(true)}
                                                    />
                                                ) : (
                                                    <Mic2 className="w-5 h-5 text-primary" />
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1 space-y-0.5">
                                                <h4 className="text-sm font-bold text-foreground leading-snug break-words">
                                                    {displayName}
                                                </h4>
                                                {artist?.hiragana && artist.hiragana !== displayName && (
                                                    <p className="text-xs text-muted-foreground break-words">
                                                        {artist.hiragana}
                                                    </p>
                                                )}
                                                {artist?.disambiguation && (
                                                    <span className="inline-block mt-0.5 text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground break-words">
                                                        {artist.disambiguation}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                                            {artist?.gender && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted/70 text-foreground/80 text-[11px] font-medium">
                                                    {t(`artistForm.fields.genderOptions.${artist.gender}`, artist.gender)}
                                                </span>
                                            )}
                                            <EntityRating rating={artist?.rating} ratingCount={artist?.ratingCount} />
                                        </div>

                                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                                                <Users className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                                                <span className="truncate">
                                                    {followerLabel ?? '-'}
                                                </span>
                                            </div>

                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={isFollowing ? 'secondary' : 'outline'}
                                                disabled={isFollowPending}
                                                onClick={handleToggleFollow}
                                                className={cn(
                                                    'h-7 px-2.5 text-xs font-medium shrink-0',
                                                    isFollowing && 'bg-primary/15 text-primary hover:bg-primary/20 border border-primary/30'
                                                )}
                                            >
                                                {isFollowPending ? (
                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                ) : (
                                                    <Heart className={cn('w-3 h-3 mr-1', isFollowing && 'fill-current')} />
                                                )}
                                                {isFollowing
                                                    ? t('entityInfo.following', '팔로잉')
                                                    : t('entityInfo.follow', '팔로우')}
                                            </Button>
                                        </div>
                                    </div>
                                </EntityInfoShell>
                                );
}

                                interface VenueInfoCardProps {
                                    venueId: string;
                                venue?: Venue;
                                initialName?: string;
                                isLoading: boolean;
                                isError: boolean;
    onRetry?: () => void;
                                onCenterMap?: (coords: {lat: number; lng: number }) => void;
    onClear?: () => void;
}

                                /**
                                 * 좌측 사이드바에 선택된 공연장(회장)의 상세 정보를 표시하는 카드 컴포넌트
                                 */
                                export function VenueInfoCard({
                                    venue,
                                    initialName,
                                    isLoading,
                                    isError,
                                    onRetry,
                                    onCenterMap,
                                    onClear,
}: VenueInfoCardProps) {
    const {t} = useTranslation();

                                const displayName = venue?.officialName || initialName || '';
                                const hasCoordinates =
                                typeof venue?.latitude === 'number' &&
                                typeof venue?.longitude === 'number' &&
                                !(venue.latitude === 0 && venue.longitude === 0);

                                const safeLinks = Array.isArray(venue?.relatedLinks)
                                ? venue.relatedLinks
            .map((raw) => ({raw, safe: getSafeExternalUrl(raw) }))
                                .filter((item): item is {raw: string; safe: string } => item.safe !== null)
                                : [];

                                const googleMapsQuery = encodeURIComponent(venue?.address ? `${displayName} ${venue.address}` : displayName);
                                const googleMapsUrl = venue?.googleMapId
                                ? `https://www.google.com/maps/search/?api=1&query=${googleMapsQuery}&query_place_id=${encodeURIComponent(venue.googleMapId)}`
                                : displayName
                                ? `https://www.google.com/maps/search/?api=1&query=${googleMapsQuery}`
                                : null;

                                return (
                                <EntityInfoShell
                                    icon={<MapPin className="w-4 h-4" />}
                                    title={t('entityInfo.venueTitle', '공연장 정보')}
                                    status={venue?.status}
                                    isLoading={isLoading && !venue}
                                    isError={isError && !venue}
                                    errorMessage={t('entityInfo.loadVenueError', '공연장 정보를 불러오지 못했습니다.')}
                                    initialName={initialName}
                                    onRetry={onRetry}
                                    onClear={onClear}
                                >
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-bold text-foreground leading-snug break-words">
                                            {displayName}
                                        </h4>

                                        <div className="space-y-1.5 text-xs text-muted-foreground">
                                            <div className="flex items-start gap-2">
                                                <MapPin className="w-3.5 h-3.5 text-primary/70 shrink-0 mt-0.5" />
                                                <span className="break-words text-foreground/90">
                                                    {venue?.address || t('entityInfo.addressUnknown', '주소 정보 없음')}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                {typeof venue?.capacity === 'number' && venue.capacity > 0 && (
                                                    <span className="inline-flex items-center gap-1 text-foreground/90">
                                                        <Users className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                                                        {t('entityInfo.capacity', {
                                                            capacity: venue.capacity.toLocaleString(),
                                                            defaultValue: `수용 인원 ${venue.capacity.toLocaleString()}명`,
                                                        })}
                                                    </span>
                                                )}
                                                <EntityRating rating={venue?.rating} ratingCount={venue?.ratingCount} />
                                            </div>

                                            {safeLinks.length > 0 && (
                                                <div className="space-y-1 pt-0.5">
                                                    {safeLinks.map((link, idx) => {
                                                        let label = link.safe;
                                                        try {
                                                            label = new URL(link.safe).hostname.replace(/^www\./, '');
                                                        } catch {
                                                            // fallback to full URL
                                                        }
                                                        return (
                                                            <div key={`${link.safe}-${idx}`} className="flex items-center gap-1.5 min-w-0">
                                                                <ExternalLink className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                                                                <a
                                                                    href={link.safe}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-primary hover:underline truncate"
                                                                    title={link.safe}
                                                                >
                                                                    {label}
                                                                </a>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {(hasCoordinates || googleMapsUrl) && (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50">
                                                {hasCoordinates && onCenterMap && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            onCenterMap({
                                                                lat: venue!.latitude!,
                                                                lng: venue!.longitude!,
                                                            })
                                                        }
                                                        className="h-7 px-2.5 text-xs font-medium"
                                                    >
                                                        <LocateFixed className="w-3 h-3 mr-1" />
                                                        {t('entityInfo.centerOnMap', '지도에서 위치 보기')}
                                                    </Button>
                                                )}
                                                {googleMapsUrl && (
                                                    <a
                                                        href={googleMapsUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground text-xs font-medium transition-colors"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        Google Maps
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </EntityInfoShell>
                                );
}

                                interface FollowingArtistsInfoCardProps {
                                    resetKey ?: string;
                                defaultCollapsed?: boolean;
                                onSelectArtist?: (artist: {id: string; name: string }) => void;
}

                                /**
                                 * 복수(팔로우한) 출연자 검색 시 좌측 사이드바의 '출연자 정보'를 기본적으로 접힘('접어서 숨김') 상태로 제공하는 카드 컴포넌트
                                 */
                                export function FollowingArtistsInfoCard({
                                    resetKey,
                                    defaultCollapsed = true,
                                    onSelectArtist,
}: FollowingArtistsInfoCardProps) {
    const {t} = useTranslation();
                                const {isAuthenticated} = useAuth();
                                const queryClient = useQueryClient();
                                const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
                                const [unfollowingId, setUnfollowingId] = useState<string | null>(null);

    useEffect(() => {
                                    setIsCollapsed(defaultCollapsed);
    }, [resetKey, defaultCollapsed]);

                                const {
                                    data: rawFollowingArtists,
                                isLoading,
                                isError,
                                refetch,
    } = useGetUsersMeFollowingArtists(
                                {limit: 100, offset: 0 },
                                {
                                    query: {
                                    enabled: isAuthenticated,
                                staleTime: 60 * 1000,
            },
        }
                                );

                                const artists = Array.isArray(rawFollowingArtists) ? rawFollowingArtists : [];

                                const unfollowMutation = useDeleteArtistsArtistIdFollow({
                                    mutation: {
                                    onSuccess: (_data, variables) => {
                                    invalidateFollowCaches(queryClient, variables.artistId);
                                toast.success(t('entityInfo.unfollowSuccess', '팔로우를 취소했습니다.'));
            },
            onError: (err) => {
                                    toast.apiError(err, t('entityInfo.followFailed', '팔로우 처리에 실패했습니다.'));
            },
            onSettled: () => {
                                    setUnfollowingId(null);
            },
        },
    });

    const handleUnfollow = (artistId?: string) => {
        if (!artistId || unfollowMutation.isPending) return;
                                setUnfollowingId(artistId);
                                unfollowMutation.mutate({artistId});
    };

                                const headerBadge = !isLoading && !isError ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold shrink-0">
                                    {t('entityInfo.followingArtistsCountBadge', {
                                        count: artists.length,
                                        defaultValue: `${artists.length}명`,
                                    })}
                                </span>
                                ) : null;

                                return (
                                <EntityInfoShell
                                    icon={<Mic2 className="w-4 h-4" />}
                                    title={t('entityInfo.artistTitle', '출연자 정보')}
                                    headerBadge={headerBadge}
                                    isLoading={isLoading}
                                    isError={isError}
                                    errorMessage={t('entityInfo.loadArtistError', '출연자 정보를 불러오지 못했습니다.')}
                                    collapsible={true}
                                    isCollapsed={isCollapsed}
                                    onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
                                    panelId="following-artists-info-panel"
                                    onRetry={() => {
                                        void refetch();
                                    }}
                                >
                                    {artists.length === 0 ? (
                                        <p className="text-xs text-muted-foreground py-1">
                                            {t('entityInfo.noFollowingArtists', '팔로우 중인 출연자가 없습니다.')}
                                        </p>
                                    ) : (
                                        <ul className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5">
                                            {artists.map((artist) => {
                                                const safeProfileUrl = getSafeExternalUrl(artist.profileImageUrl);
                                                const isPendingThis = unfollowingId === artist.id && unfollowMutation.isPending;

                                                return (
                                                    <li
                                                        key={artist.id}
                                                        className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5"
                                                    >
                                                        <button
                                                            type="button"
                                                            disabled={!artist.id || !artist.officialName}
                                                            onClick={() => {
                                                                if (artist.id && artist.officialName) {
                                                                    onSelectArtist?.({ id: artist.id, name: artist.officialName });
                                                                }
                                                            }}
                                                            className="flex items-center gap-2 min-w-0 flex-1 text-left hover:text-primary transition-colors"
                                                        >
                                                            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-border bg-primary/10 flex items-center justify-center">
                                                                {safeProfileUrl ? (
                                                                    <img
                                                                        src={safeProfileUrl}
                                                                        alt={artist.officialName || ''}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <Mic2 className="w-3.5 h-3.5 text-primary" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-semibold text-foreground truncate">
                                                                    {artist.officialName}
                                                                </p>
                                                                {typeof artist.rating === 'number' && artist.rating > 0 && (
                                                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                                                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                                                        {artist.rating.toFixed(1)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            disabled={isPendingThis || unfollowMutation.isPending}
                                                            onClick={() => handleUnfollow(artist.id)}
                                                            title={t('entityInfo.unfollowButton', '팔로우 취소')}
                                                            aria-label={t('entityInfo.unfollowButton', '팔로우 취소')}
                                                            className="h-7 px-2 text-xs text-primary hover:bg-primary/10 shrink-0"
                                                        >
                                                            {isPendingThis ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <Heart className="w-3 h-3 fill-current" />
                                                            )}
                                                        </Button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </EntityInfoShell>
                                );
}
