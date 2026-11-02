import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
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
    
    const { isAuthenticated } = useAuth();
    const [isFormOpen, setIsFormOpen] = useState(false);

    const mapBounds = useEventStore((state) => state.mapBounds);
    const clearSelection = useEventStore((state) => state.clearSelection);
    const selectedEvent = useEventStore((state) => state.selectedEvent);

    // 지도 Bounding Box(좌표 범위) 및 날짜 범위를 백엔드로 전달하여 참가자 많은 순으로 최대 50건만 조회
    const { data: eventsData, isLoading: isEventsLoading } = useGetEvents(
        {
            minLat: mapBounds?.minLat,
            maxLat: mapBounds?.maxLat,
            minLng: mapBounds?.minLng,
            maxLng: mapBounds?.maxLng,
            startDate,
            endDate,
            limit: 50,
        },
        {
            query: {
                enabled: mapBounds !== null,
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
        }
    }, [selectedEvent]);

    const handleOpenForm = () => {
        clearSelection();
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
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

    return (
        <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 w-full max-w-[2400px] mx-auto md:overflow-hidden md:h-[calc(100vh-73px)] relative overflow-x-hidden">
            {/* 좌측 사이드바 영역 (기본 목록 / 이벤트 상세 / 이벤트 생성 폼 전환) */}
            <aside className="w-full flex md:w-[20%] shrink-0 bg-card/50 backdrop-blur-sm border border-border rounded-xl shadow-md flex-col transition-all duration-500 overflow-hidden">
                {isFormOpen ? (
                    <EventFormPane onClose={handleCloseForm} />
                ) : selectedEvent ? (
                    <EventDetailPane />
                ) : (
                    <>
                        <div className="p-4 flex flex-col gap-4 border-b border-border/50 shrink-0">
                            <DatePicker 
                                startDate={startDate} 
                                endDate={endDate} 
                                onDateChange={handleDateChange} 
                            />
                            <ArtistSearch />
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
                                onEventEdit={isAuthenticated ? handleOpenForm : undefined}
                                onEventDelete={isAuthenticated ? () => {} : undefined}
                            />
                        </div>
                    </>
                )}
            </aside>

            {/* 중앙 지도 영역 */}
            <main className="flex-1 min-h-[400px] md:min-h-0 bg-card rounded-xl border border-border overflow-hidden shadow-md relative z-0 transition-all duration-500 w-full md:w-[80%]">
                <EventMap events={filteredEvents} />
            </main>
        </div>
    );
}
