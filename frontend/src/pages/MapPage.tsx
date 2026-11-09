import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { format, addMonths } from 'date-fns';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useEventStore } from '../store/useEventStore';
import { useGetEvents } from '../api/generated/events/events';
import type { EventSummary } from '../api/generated/model';
import { Button } from '../components/ui/button';
import DatePicker from '../components/common/DatePicker';
import ArtistSearch from '../components/events/ArtistSearch';
import EventList from '../components/events/EventList';
import EventMap from '../components/map/EventMap';
import EventFormPane from '../components/events/EventFormPane';
import EventDetailPane from '../components/events/EventDetailPane';

export default function MapPage() {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();

    const today = format(new Date(), 'yyyy-MM-dd');
    const startDate = searchParams.get('start') ?? today;
    const endDate = searchParams.get('end') ?? today;
    const artistId = searchParams.get('artistId') || undefined;
    const artistName = searchParams.get('artistName') || undefined;
    const venueId = searchParams.get('venueId') || undefined;
    const venueName = searchParams.get('venueName') || undefined;
    const isFilteredByEntity = Boolean(artistId || venueId);

    const { isAuthenticated } = useAuth();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<EventSummary | null>(null);

    const mapBounds = useEventStore((state) => state.mapBounds);
    const setMapCenterTarget = useEventStore((state) => state.setMapCenterTarget);
    const clearSelection = useEventStore((state) => state.clearSelection);
    const selectedEvent = useEventStore((state) => state.selectedEvent);

    // 지도 Bounding Box(좌표 범위) 및 날짜 범위를 백엔드로 전달하여 참가자 많은 순으로 최대 50건만 조회
    const { data: eventsData, isLoading: isEventsLoading } = useGetEvents(
        {
            minLat: isFilteredByEntity ? undefined : mapBounds?.minLat,
            maxLat: isFilteredByEntity ? undefined : mapBounds?.maxLat,
            minLng: isFilteredByEntity ? undefined : mapBounds?.minLng,
            maxLng: isFilteredByEntity ? undefined : mapBounds?.maxLng,
            startDate,
            endDate,
            artistId,
            venueId,
            limit: 50,
        },
        {
            query: {
                enabled: isFilteredByEntity || mapBounds !== null,
                staleTime: 60 * 1000, // 1분간 캐시 유지 (AWS Lambda 및 DS920+ NAS DB 호출 절감)
                placeholderData: (previousData) => previousData, // 지도 이동 중 이전 마커/목록 유지하여 깜빡임 방지
            },
        }
    );

    const filteredEvents: EventSummary[] = eventsData?.events || [];

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

    const handleEventCreated = ({ date, lat, lng }: { date: string; lat?: number; lng?: number }) => {
        if (date && (date < startDate || date > endDate)) {
            updateQueryParams({ start: date, end: date });
        }
        if (typeof lat === 'number' && typeof lng === 'number') {
            setMapCenterTarget({ lat, lng });
        }
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

    const handleDateChange = (start: string, end: string) => {
        updateQueryParams({ start, end });
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
        });
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
        });
        if (typeof venue.lat === 'number' && typeof venue.lng === 'number') {
            setMapCenterTarget({ lat: venue.lat, lng: venue.lng });
        }
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
        <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 w-full max-w-[2400px] mx-auto md:overflow-hidden md:h-[calc(100vh-73px)] relative overflow-x-hidden">
            {/* 좌측 사이드바 영역 (기본 목록 / 이벤트 상세 / 이벤트 생성 폼 전환) */}
            <aside className="w-full flex md:w-[20%] shrink-0 bg-card/50 backdrop-blur-sm border border-border rounded-xl shadow-md flex-col transition-all duration-500 overflow-hidden">
                {isFormOpen ? (
                    <EventFormPane
                        key={editingEvent?.id ?? 'new'}
                        editingEvent={editingEvent}
                        initialDate={startDate}
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
                                startDate={startDate}
                                endDate={endDate}
                                onDateChange={handleDateChange}
                            />
                            <ArtistSearch
                                selectedArtist={
                                    artistId
                                        ? { id: artistId, name: artistName || artistId }
                                        : null
                                }
                                selectedVenue={
                                    venueId
                                        ? { id: venueId, name: venueName || venueId }
                                        : null
                                }
                                onSelectArtist={handleSearchByArtist}
                                onClearFilter={handleClearEntityFilter}
                            />
                            {isAuthenticated && (
                                <Button className="w-full bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white shadow-md transition-all hover:-translate-y-0.5" onClick={handleOpenForm}>
                                    <Plus className="w-4 h-4 mr-2" /> {t('buttons.newEvent')}
                                </Button>
                            )}
                        </div>
                        <div className="flex-1 overflow-auto min-h-[300px]">
                            <EventList
                                events={filteredEvents}
                                loading={isEventsLoading}
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
                    events={filteredEvents}
                    onArtistSelect={handleSearchByArtist}
                    onVenueSelect={handleSearchByVenue}
                />
            </main>
        </div>
    );
}
