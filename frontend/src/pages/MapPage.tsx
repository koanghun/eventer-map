import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { format, addMonths, parseISO, isValid } from 'date-fns';
import { Bookmark, Heart, Plus, Sparkles, UserCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEventStore } from '../store/useEventStore';
import { useGetEvents } from '../api/generated/events/events';
import { useGetArtistsArtistId } from '../api/generated/artists/artists';
import { useGetVenuesVenueId } from '../api/generated/venues/venues';
import { GetEventsMyAction, type EventSummary } from '../api/generated/model';
import { Button } from '../components/ui/button';
import DatePicker from '../components/common/DatePicker';
import ArtistSearch from '../components/events/ArtistSearch';
import { ArtistInfoCard, FollowingArtistsInfoCard, VenueInfoCard } from '../components/events/EntityInfoCard';
import EventList from '../components/events/EventList';
import EventMap from '../components/map/EventMap';
import EventFormPane from '../components/events/EventFormPane';
import EventDetailPane from '../components/events/EventDetailPane';

function isValidIsoTimestamp(raw: string | null): raw is string {
    if (!raw || raw.length > 64) return false;
    return isValid(parseISO(raw));
}

export default function MapPage() {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

    const today = format(new Date(), 'yyyy-MM-dd');
    const rawMyAction = searchParams.get('myAction');
    const myAction: GetEventsMyAction | undefined =
        rawMyAction === GetEventsMyAction.bookmarked || rawMyAction === GetEventsMyAction.attending
            ? rawMyAction
            : undefined;
    const rawFollowingArtists = searchParams.get('followingArtists');
    const isFollowingArtistsParam = rawFollowingArtists === 'true';
    const rawNewEventsSince = searchParams.get('newEventsSince');
    const validNewEventsSince = isValidIsoTimestamp(rawNewEventsSince) ? rawNewEventsSince : undefined;

    const followingArtistsEnabled = isFollowingArtistsParam && isAuthenticated;
    const newEventsSince = followingArtistsEnabled ? validNewEventsSince : undefined;
    const newEventsSinceEnabled = Boolean(newEventsSince);
    const myActionEnabled = !followingArtistsEnabled && Boolean(myAction) && isAuthenticated;
    const isPersonalFilterMode = followingArtistsEnabled || myActionEnabled;

    const rawStart = searchParams.get('start');
    const rawEnd = searchParams.get('end');
    const startDate = newEventsSinceEnabled
        ? (rawStart || undefined)
        : followingArtistsEnabled
            ? (rawStart || today)
            : myActionEnabled
                ? (rawStart || undefined)
                : (rawStart ?? today);
    const endDate = isPersonalFilterMode ? (rawEnd || undefined) : (rawEnd ?? today);

    const artistId = isPersonalFilterMode ? undefined : (searchParams.get('artistId') || undefined);
    const artistName = isPersonalFilterMode ? undefined : (searchParams.get('artistName') || undefined);
    const venueId = isPersonalFilterMode ? undefined : (searchParams.get('venueId') || undefined);
    const venueName = isPersonalFilterMode ? undefined : (searchParams.get('venueName') || undefined);
    const isFilteredByEntity = Boolean(artistId || venueId);
    const shouldBypassBounds = isFilteredByEntity || isPersonalFilterMode;

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<EventSummary | null>(null);

    const mapBounds = useEventStore((state) => state.mapBounds);
    const setMapCenterTarget = useEventStore((state) => state.setMapCenterTarget);
    const clearSelection = useEventStore((state) => state.clearSelection);
    const selectedEvent = useEventStore((state) => state.selectedEvent);

    // 비로그인, 잘못된 값 또는 상호 충돌하는 개인화 필터 쿼리 파라미터 정리
    useEffect(() => {
        if (!rawMyAction && !rawFollowingArtists && !rawNewEventsSince) return;
        const newParams = new URLSearchParams(searchParams);
        let changed = false;

        if (rawMyAction && (!myAction || (!isAuthLoading && !isAuthenticated) || isFollowingArtistsParam)) {
            newParams.delete('myAction');
            changed = true;
        }
        if (rawFollowingArtists && (!isFollowingArtistsParam || (!isAuthLoading && !isAuthenticated))) {
            newParams.delete('followingArtists');
            changed = true;
        }
        if (
            rawNewEventsSince &&
            (!isFollowingArtistsParam || !validNewEventsSince || (!isAuthLoading && !isAuthenticated))
        ) {
            newParams.delete('newEventsSince');
            changed = true;
        }
        if (changed) {
            setSearchParams(newParams, { replace: true });
        }
    }, [
        rawMyAction,
        myAction,
        rawFollowingArtists,
        isFollowingArtistsParam,
        rawNewEventsSince,
        validNewEventsSince,
        isAuthLoading,
        isAuthenticated,
        searchParams,
        setSearchParams,
    ]);

    // 프로필 메뉴/알림 개인화 필터로 전환 시 작성 폼이 열려 있으면 닫기
    useEffect(() => {
        if (isPersonalFilterMode) {
            setIsFormOpen(false);
            setEditingEvent(null);
        }
}, [isPersonalFilterMode, myAction, followingArtistsEnabled, newEventsSince]);

// 지도 Bounding Box(좌표 범위) 및 날짜/액션/팔로우 출연자 필터를 백엔드로 전달
const {
    data: eventsData,
    isLoading: isEventsLoading,
    isPlaceholderData: isEventsPlaceholderData,
} = useGetEvents(
    {
        minLat: shouldBypassBounds ? undefined : mapBounds?.minLat,
        maxLat: shouldBypassBounds ? undefined : mapBounds?.maxLat,
        minLng: shouldBypassBounds ? undefined : mapBounds?.minLng,
        maxLng: shouldBypassBounds ? undefined : mapBounds?.maxLng,
        startDate,
        endDate,
        artistId,
        venueId,
        myAction: myActionEnabled ? myAction : undefined,
        followingArtists: followingArtistsEnabled ? true : undefined,
        createdAfter: newEventsSince,
        limit: isPersonalFilterMode ? 100 : 50,
    },
    {
        query: {
            enabled:
                isPersonalFilterMode ||
                (!rawMyAction && !rawFollowingArtists && !rawNewEventsSince && (isFilteredByEntity || mapBounds !== null)),
        staleTime: 60 * 1000, // 1분간 캐시 유지 (AWS Lambda 및 DS920+ NAS DB 호출 절감)
        placeholderData: (previousData) => previousData, // 지도 이동 중 이전 마커/목록 유지하여 깜빡임 방지
    },
    }
);

const filteredEvents: EventSummary[] = eventsData?.events || [];

const {
    data: selectedArtistDetail,
    isLoading: isArtistDetailLoading,
    isError: isArtistDetailError,
    refetch: refetchArtistDetail,
} = useGetArtistsArtistId(artistId || '', {
    query: {
        enabled: Boolean(artistId),
        staleTime: 60 * 1000,
    },
});

const {
    data: selectedVenueDetail,
    isLoading: isVenueDetailLoading,
    isError: isVenueDetailError,
    refetch: refetchVenueDetail,
} = useGetVenuesVenueId(venueId || '', {
    query: {
        enabled: Boolean(venueId),
        staleTime: 60 * 1000,
    },
});

// 지도 등에서 이벤트가 선택되면 생성 폼을 닫고 상세 화면을 좌측 사이드바에 표시
useEffect(() => {
    if (selectedEvent) {
        setIsFormOpen(false);
        setEditingEvent(null);
    }
}, [selectedEvent]);

const handleOpenForm = () => {
    clearSelection();
    setEditingEvent(null);
    setIsFormOpen(true);
};

const handleEditEvent = (event: EventSummary) => {
    clearSelection();
    setEditingEvent(event);
    setIsFormOpen(true);
};

const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingEvent(null);
};

const updateQueryParams = (updates: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
        if (value === null) {
            newParams.delete(key);
        } else {
            newParams.set(key, value);
        }
    });
    setSearchParams(newParams, { replace: true });
};

const handleEventCreated = ({ date, lat, lng }: { date: string; lat?: number; lng?: number }) => {
    if (date && ((startDate && date < startDate) || (endDate && date > endDate))) {
        updateQueryParams({ start: date, end: date });
    }
    if (typeof lat === 'number' && typeof lng === 'number') {
        setMapCenterTarget({ lat, lng });
    }
};

const handleDateChange = (start: string, end: string) => {
    updateQueryParams({ start, end });
    clearSelection();
};

const handleClearMyActionDates = () => {
    updateQueryParams({ start: null, end: null });
    clearSelection();
};

const handleClearMyActionFilter = () => {
    updateQueryParams({ myAction: null, newEventsSince: null, start: null, end: null });
    clearSelection();
};

const handleClearFollowingArtistsEndDate = () => {
    updateQueryParams({ end: null });
    clearSelection();
};

const handleClearFollowingArtistsFilter = () => {
    updateQueryParams({ followingArtists: null, newEventsSince: null, start: null, end: null });
    clearSelection();
};

const handleShowAllFollowingArtists = () => {
    updateQueryParams({ followingArtists: 'true', newEventsSince: null, start: today, end: null });
    clearSelection();
};

const handleSearchByArtist = (artist: { id: string; name: string }) => {
    const searchStart = format(new Date(), 'yyyy-MM-dd');
    const searchEnd = format(addMonths(new Date(), 6), 'yyyy-MM-dd');
    updateQueryParams({
        start: searchStart,
        end: searchEnd,
        artistId: artist.id,
        artistName: artist.name,
        venueId: null,
        venueName: null,
        myAction: null,
        followingArtists: null,
        newEventsSince: null,
    });
    setIsFormOpen(false);
    setEditingEvent(null);
    clearSelection();
};

const handleSearchByVenue = (venue: { id: string; name: string; lat?: number; lng?: number }) => {
    const searchStart = format(new Date(), 'yyyy-MM-dd');
    const searchEnd = format(addMonths(new Date(), 6), 'yyyy-MM-dd');
    updateQueryParams({
        start: searchStart,
        end: searchEnd,
        venueId: venue.id,
        venueName: venue.name,
        artistId: null,
        artistName: null,
        myAction: null,
        followingArtists: null,
        newEventsSince: null,
    });
    if (typeof venue.lat === 'number' && typeof venue.lng === 'number') {
        setMapCenterTarget({ lat: venue.lat, lng: venue.lng });
    }
    setIsFormOpen(false);
    setEditingEvent(null);
    clearSelection();
};

const handleClearEntityFilter = () => {
    updateQueryParams({
        artistId: null,
        artistName: null,
        venueId: null,
        venueName: null,
    });
    clearSelection();
};

return (
    <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 w-full max-w-[2400px] mx-auto md:overflow-hidden md:min-h-0 relative overflow-x-hidden">
        {/* 좌측 사이드바 영역 (기본 목록 / 이벤트 상세 / 이벤트 생성 폼 전환) */}
        <aside className="w-full flex md:w-[20%] md:min-h-0 shrink-0 bg-card/50 backdrop-blur-sm border border-border rounded-xl shadow-md flex-col transition-all duration-500 overflow-hidden">
            {isFormOpen ? (
                <EventFormPane
                    key={editingEvent?.id ?? 'new'}
                    editingEvent={editingEvent}
                    initialDate={startDate ?? today}
                    onCreated={handleEventCreated}
                    onClose={handleCloseForm}
                />
            ) : selectedEvent ? (
                <EventDetailPane
                    onEdit={isAuthenticated ? () => handleEditEvent(selectedEvent) : undefined}
                    onArtistSelect={handleSearchByArtist}
                    onVenueSelect={handleSearchByVenue}
                />
            ) : (
                <>
                    <div className="p-4 flex flex-col gap-4 border-b border-border/50 shrink-0">
                        <DatePicker
                            startDate={startDate ?? ''}
                            endDate={endDate ?? ''}
                            onDateChange={handleDateChange}
                            onClearDate={
                                myActionEnabled
                                    ? handleClearMyActionDates
                                    : followingArtistsEnabled && endDate
                                        ? handleClearFollowingArtistsEndDate
                                        : undefined
                            }
                            allDatesLabel={t('datePicker.allDates', '전체 기간')}
                            clearLabel={
                                followingArtistsEnabled
                                    ? t('datePicker.clearEndDate', '이후 전체')
                                    : t('datePicker.allDates', '전체 기간')
                            }
                        />
                        <ArtistSearch
                            selectedArtist={
                                artistId
                                    ? {
                                        id: artistId,
                                        name: selectedArtistDetail?.officialName || artistName || t('eventDetail.loading', '불러오는 중...'),
                                    }
                                    : null
                            }
                            selectedVenue={
                                venueId
                                    ? {
                                        id: venueId,
                                        name: selectedVenueDetail?.officialName || venueName || t('eventDetail.loading', '불러오는 중...'),
                                    }
                                    : null
                            }
                            onSelectArtist={handleSearchByArtist}
                            onSelectVenue={handleSearchByVenue}
                            onClearFilter={handleClearEntityFilter}
                        />
                        {isAuthenticated && (
                            <Button className="w-full bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white shadow-md transition-all hover:-translate-y-0.5" onClick={handleOpenForm}>
                                <Plus className="w-4 h-4 mr-2" /> {t('buttons.newEvent')}
                            </Button>
                        )}
                    </div>
                    <div className="flex-1 min-h-[300px] md:min-h-0 overflow-y-auto">
                        {myActionEnabled && (
                            <section className="p-3.5 border-b border-border bg-card/80 space-y-2 animate-in fade-in duration-200">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        {myAction === GetEventsMyAction.bookmarked ? (
                                            <Bookmark className="w-4 h-4 text-amber-500 fill-current shrink-0" />
                                        ) : (
                                            <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                        )}
                                        <h3 className="text-xs font-bold text-foreground truncate">
                                            {myAction === GetEventsMyAction.bookmarked
                                                ? t('filter.myEvents.bookmarkedTitle', '북마크한 이벤트만 보는 중')
                                                : t('filter.myEvents.participatedTitle', '참가한 이벤트만 보는 중')}
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleClearMyActionFilter}
                                        className="p-1 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                                        title={t('filter.myEvents.clear', '필터 해제')}
                                        aria-label={t('filter.myEvents.clear', '필터 해제')}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>
                                        {startDate && endDate
                                            ? startDate === endDate
                                                ? startDate
                                                : `${startDate} ~ ${endDate}`
                                            : t('datePicker.allDates', '전체 기간')}
                                    </span>
                                    <span className="font-semibold text-primary">
                                        {t('filter.myEvents.count', {
                                            count: filteredEvents.length,
                                            defaultValue: `${filteredEvents.length}건`,
                                        })}
                                    </span>
                                </div>
                                {eventsData?.hasMore && (
                                    <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1">
                                        {t(
                                            'filter.myEvents.hasMoreHint',
                                            '최대 100건까지 표시됩니다. 날짜를 선택해 범위를 좁힐 수 있습니다.'
                                        )}
                                    </p>
                                )}
                            </section>
                        )}
                        {followingArtistsEnabled && (
                            <section className="p-3.5 border-b border-border bg-card/80 space-y-2 animate-in fade-in duration-200">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        {newEventsSinceEnabled ? (
                                            <Sparkles className="w-4 h-4 text-primary shrink-0" />
                                        ) : (
                                            <Heart className="w-4 h-4 text-primary fill-current shrink-0" />
                                        )}
                                        <h3 className="text-xs font-bold text-foreground truncate">
                                            {newEventsSinceEnabled
                                                ? t('filter.followingArtists.newEventsTitle', '팔로우 출연자 신규 이벤트')
                                                : t('filter.followingArtists.title', '팔로우한 출연자')}
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleClearFollowingArtistsFilter}
                                        className="p-1 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                                        title={t('filter.myEvents.clear', '해제')}
                                        aria-label={t('filter.myEvents.clear', '해제')}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                            <span className="truncate">
                                                {startDate && endDate
                                                    ? startDate === endDate
                                                        ? startDate
                                                        : `${startDate} ~ ${endDate}`
                                                    : startDate
                                                        ? t('datePicker.fromDateOnward', {
                                                            date: startDate,
                                                            defaultValue: `${startDate} 이후`,
                                                        })
                                                : newEventsSinceEnabled
                                                ? t('filter.followingArtists.newEventsSubtitle', '새로 등록된 예정 이벤트')
                                                    : t('datePicker.allDates', '전체 기간')}
                                            </span>
                                                <span className="font-semibold text-primary shrink-0">
                                                    {t('filter.myEvents.count', {
                                                        count: filteredEvents.length,
                                                        defaultValue: `${filteredEvents.length}건`,
                                                    })}
                                                </span>
                                        </div>
                                        {newEventsSinceEnabled && (
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={handleShowAllFollowingArtists}
                                                    className="text-[11px] font-medium text-primary hover:underline"
                                                >
                                                    {t('filter.followingArtists.viewAllFollowing', '팔로우 전체 보기')}
                                                </button>
                                            </div>
                                        )}
                                        {eventsData?.hasMore && (
                                            <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1">
                                                {t(
                                                    'filter.myEvents.hasMoreHint',
                                                    '최대 100건까지 표시됩니다. 날짜 필터로 범위를 좁힐 수 있습니다.'
                                                )}
                                            </p>
                                        )}
                                    </section>
                        )}
                                    {followingArtistsEnabled && (
                                        <FollowingArtistsInfoCard
                                            resetKey="following"
                                            defaultCollapsed={true}
                                            onSelectArtist={handleSearchByArtist}
                                        />
                                    )}
                                    {artistId && (
                                        <ArtistInfoCard
                                            artistId={artistId}
                                            artist={selectedArtistDetail}
                                            initialName={artistName}
                                            isLoading={isArtistDetailLoading}
                                            isError={isArtistDetailError}
                                            onRetry={() => {
                                                void refetchArtistDetail();
                                            }}
                                            onClear={handleClearEntityFilter}
                                        />
                                    )}
                                    {venueId && (
                                        <VenueInfoCard
                                            venueId={venueId}
                                            venue={selectedVenueDetail}
                                            initialName={venueName}
                                            isLoading={isVenueDetailLoading}
                                            isError={isVenueDetailError}
                                            onRetry={() => {
                                                void refetchVenueDetail();
                                            }}
                                            onCenterMap={(coords) => setMapCenterTarget(coords)}
                                            onClear={handleClearEntityFilter}
                                        />
                                    )}
                                    <EventList
                                        events={isPersonalFilterMode && isEventsPlaceholderData ? [] : filteredEvents}
                                        loading={isEventsLoading || (isPersonalFilterMode && isEventsPlaceholderData)}
                                        emptyTitle={
                                    newEventsSinceEnabled
                                        ? t('filter.followingArtists.newEventsEmpty', '표시할 신규 이벤트가 없습니다')
                                    : followingArtistsEnabled
                                    ? t('filter.followingArtists.empty', '예정된 이벤트가 없습니다')
                                    : myActionEnabled
                                    ? myAction === GetEventsMyAction.bookmarked
                                    ? t('filter.myEvents.emptyBookmarked', '북마크한 이벤트가 없습니다.')
                                    : t('filter.myEvents.emptyParticipated', '참가한 이벤트가 없습니다.')
                                    : undefined
                                }
                                    emptyDescription={
                                    newEventsSinceEnabled
                                    ? t(
                                    'filter.followingArtists.newEventsEmptyDesc',
                                    '팔로우 전체 보기로 전환하거나 다른 기간을 선택해보세요.'
                                    )
                                    : followingArtistsEnabled
                                    ? t(
                                    'filter.followingArtists.emptyDesc',
                                    '팔로우한 출연자의 검색일 이후 일정이 없거나, 다른 날짜를 선택해보세요.'
                                    )
                                    : myActionEnabled
                                    ? myAction === GetEventsMyAction.bookmarked
                                    ? t('filter.myEvents.emptyBookmarkedDesc', '이벤트 상세 화면에서 체크 버튼을 눌러 북마크해보세요.')
                                    : t('filter.myEvents.emptyParticipatedDesc', '이벤트 상세 화면에서 참가 상태로 변경하면 여기에 표시됩니다.')
                                    : undefined
                                }
                                    onEventEdit={isAuthenticated ? handleEditEvent : undefined}
                                    onEventDelete={isAuthenticated ? () => { } : undefined}
                            />
                                </div>
                            </>
                        )}
                    </aside>

                    {/* 중앙 지도 영역 */}
                    <main className="flex-1 min-h-[400px] md:min-h-0 bg-card rounded-xl border border-border overflow-hidden shadow-md relative z-0 transition-all duration-500 w-full md:w-[80%]">
                        <EventMap
                            events={isPersonalFilterMode && isEventsPlaceholderData ? [] : filteredEvents}
                            activeFilterKey={
                    followingArtistsEnabled
                        ? newEventsSince
                        ? `followingArtists:new:${newEventsSince}`
                        : 'followingArtists'
                        : myActionEnabled
                        ? myAction
                        : undefined
                }
                        isFilterDataReady={isPersonalFilterMode && !isEventsLoading && !isEventsPlaceholderData}
                        onArtistSelect={handleSearchByArtist}
                        onVenueSelect={handleSearchByVenue}
            />
                    </main>
                </div>
            );
}
