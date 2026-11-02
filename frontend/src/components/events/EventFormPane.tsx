import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Save, Plus, Trash2, Loader2, Calendar as CalendarIcon, MapPin, Check, X, Mic2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'use-debounce';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { usePostEvents, getGetEventsQueryKey } from '../../api/generated/events/events';
import { useGetVenuesSearch } from '../../api/generated/venues/venues';
import { useGetArtists } from '../../api/generated/artists/artists';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '../../store/useToastStore';
import { format, parseISO } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '../../lib/utils';
import ArtistFormPane from './ArtistFormPane';
import VenueFormPane from './VenueFormPane';
import type { Artist, ArtistSummary, EventInput, Venue, VenueSummary } from '../../api/generated/model';

const EVENT_FORM_DRAFT_KEY = 'eventer_map_event_form_draft';

interface EventFormDraft {
    title: string;
    date: string;
    doorsOpen: string;
    startTime: string;
    endTime: string;
    venueId: string;
    venueQuery: string;
    selectedVenue: VenueSummary | null;
    selectedArtists: ArtistSummary[];
    links: string[];
}

function loadEventFormDraft(): EventFormDraft | null {
    try {
        const raw = sessionStorage.getItem(EVENT_FORM_DRAFT_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as EventFormDraft;
    } catch {
        return null;
    }
}

interface EventFormPaneProps {
    onClose: () => void;
}

export default function EventFormPane({ onClose }: EventFormPaneProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const initialDraft = useRef<EventFormDraft | null>(loadEventFormDraft());

    // Form fields (initialized from browser sessionStorage draft if available)
    const [title, setTitle] = useState(initialDraft.current?.title ?? '');
    const [date, setDate] = useState(initialDraft.current?.date ?? '');
    const [doorsOpen, setDoorsOpen] = useState(initialDraft.current?.doorsOpen ?? '');
    const [startTime, setStartTime] = useState(initialDraft.current?.startTime ?? '');
    const [endTime, setEndTime] = useState(initialDraft.current?.endTime ?? '');
    const [venueId, setVenueId] = useState(initialDraft.current?.venueId ?? '');
    const [venueQuery, setVenueQuery] = useState(initialDraft.current?.venueQuery ?? '');
    const [selectedVenue, setSelectedVenue] = useState<VenueSummary | null>(initialDraft.current?.selectedVenue ?? null);
    const [selectedArtists, setSelectedArtists] = useState<ArtistSummary[]>(
        Array.isArray(initialDraft.current?.selectedArtists) ? initialDraft.current!.selectedArtists : []
    );
    const [links, setLinks] = useState<string[]>(
        Array.isArray(initialDraft.current?.links) && initialDraft.current!.links.length > 0
            ? initialDraft.current!.links
            : ['']
    );

    // Venue autocomplete & New Venue sub-pane state
    const [isVenueDropdownOpen, setIsVenueDropdownOpen] = useState(false);
    const [isVenueComposing, setIsVenueComposing] = useState(false);
    const [venueHighlightedIndex, setVenueHighlightedIndex] = useState(-1);
    const [isCreatingVenue, setIsCreatingVenue] = useState(false);
    const [pendingVenueName, setPendingVenueName] = useState('');

    // Artist autocomplete & New Artist sub-pane state
    const [artistQuery, setArtistQuery] = useState('');
    const [isArtistDropdownOpen, setIsArtistDropdownOpen] = useState(false);
    const [isArtistComposing, setIsArtistComposing] = useState(false);
    const [artistHighlightedIndex, setArtistHighlightedIndex] = useState(-1);
    const [isCreatingArtist, setIsCreatingArtist] = useState(false);
    const [pendingArtistName, setPendingArtistName] = useState('');

    const venueContainerRef = useRef<HTMLDivElement>(null);
    const artistContainerRef = useRef<HTMLDivElement>(null);

    const [debouncedVenueQuery] = useDebounce(venueQuery.trim(), 300);
    const [debouncedArtistQuery] = useDebounce(artistQuery.trim(), 300);

    // Persist draft to browser sessionStorage whenever form state changes
    useEffect(() => {
        try {
            const draft: EventFormDraft = {
                title,
                date,
                doorsOpen,
                startTime,
                endTime,
                venueId,
                venueQuery,
                selectedVenue,
                selectedArtists,
                links,
            };
            sessionStorage.setItem(EVENT_FORM_DRAFT_KEY, JSON.stringify(draft));
        } catch {
            // Ignore storage quota errors
        }
    }, [title, date, doorsOpen, startTime, endTime, venueId, venueQuery, selectedVenue, selectedArtists, links]);

    const clearEventFormDraft = () => {
        try {
            sessionStorage.removeItem(EVENT_FORM_DRAFT_KEY);
        } catch {
            // Ignore storage errors
        }
    };

    // 1. Venue Autocomplete Query
    const shouldSearchVenues =
        isVenueDropdownOpen &&
        !isVenueComposing &&
        debouncedVenueQuery.length >= 1 &&
        (!selectedVenue || selectedVenue.officialName !== venueQuery);

    const { data: rawVenueResults, isFetching: isSearchingVenues } = useGetVenuesSearch(
        { query: debouncedVenueQuery, limit: 10 },
        {
            query: {
                enabled: shouldSearchVenues,
                staleTime: 5 * 60 * 1000,
                gcTime: 10 * 60 * 1000,
            },
        }
    );
    const venueResults: VenueSummary[] = Array.isArray(rawVenueResults) ? rawVenueResults : [];

    const hasExactVenueMatch = (venueResults || []).some(
        (venue) => (venue?.officialName ?? '').trim().toLowerCase() === debouncedVenueQuery.toLowerCase()
    );
    const showAddVenueOption = shouldSearchVenues && !isSearchingVenues && !hasExactVenueMatch;
    const totalVenueDropdownOptions = venueResults.length + (showAddVenueOption ? 1 : 0);

    // 2. Artist Autocomplete Query
    const shouldSearchArtists =
        isArtistDropdownOpen &&
        !isArtistComposing &&
        debouncedArtistQuery.length >= 1;

    const { data: rawArtistResults, isFetching: isSearchingArtists } = useGetArtists(
        { query: debouncedArtistQuery, limit: 10 },
        {
            query: {
                enabled: shouldSearchArtists,
                staleTime: 5 * 60 * 1000,
                gcTime: 10 * 60 * 1000,
            },
        }
    );
    const artistResults: ArtistSummary[] = Array.isArray(rawArtistResults)
        ? rawArtistResults.map((a: any) => ({
              id: a?.id ?? a?.ID,
              officialName: a?.officialName ?? a?.OfficialName,
              hiragana:
                  typeof a?.hiragana === 'string'
                      ? a.hiragana
                      : typeof a?.Hiragana?.String === 'string' && a?.Hiragana?.Valid
                        ? a.Hiragana.String
                        : undefined,
              disambiguation:
                  typeof a?.disambiguation === 'string'
                      ? a.disambiguation
                      : typeof a?.Disambiguation?.String === 'string' && a?.Disambiguation?.Valid
                        ? a.Disambiguation.String
                        : undefined,
              status: a?.status ?? a?.Status,
          }))
        : [];

    const hasExactArtistMatch = (artistResults || []).some(
        (artist) => (artist?.officialName ?? '').trim().toLowerCase() === debouncedArtistQuery.toLowerCase()
    );
    const showAddArtistOption = shouldSearchArtists && !isSearchingArtists && !hasExactArtistMatch;
    const totalArtistDropdownOptions = artistResults.length + (showAddArtistOption ? 1 : 0);

    useEffect(() => {
        setVenueHighlightedIndex(-1);
    }, [debouncedVenueQuery]);

    useEffect(() => {
        setArtistHighlightedIndex(-1);
    }, [debouncedArtistQuery]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (venueContainerRef.current && !venueContainerRef.current.contains(event.target as Node)) {
                setIsVenueDropdownOpen(false);
            }
            if (artistContainerRef.current && !artistContainerRef.current.contains(event.target as Node)) {
                setIsArtistDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Venue handlers
    const handleVenueInputChange = (value: string) => {
        setVenueQuery(value);
        setIsVenueDropdownOpen(true);
        if (selectedVenue && value !== selectedVenue.officialName) {
            setSelectedVenue(null);
            setVenueId('');
        }
    };

    const handleSelectVenue = (venue: VenueSummary) => {
        if (!venue.id) return;
        setSelectedVenue(venue);
        setVenueId(venue.id);
        setVenueQuery(venue.officialName || '');
        setIsVenueDropdownOpen(false);
        setVenueHighlightedIndex(-1);
    };

    const handleClearVenue = () => {
        setSelectedVenue(null);
        setVenueId('');
        setVenueQuery('');
        setIsVenueDropdownOpen(false);
        setVenueHighlightedIndex(-1);
    };

    const handleOpenCreateVenuePane = () => {
        const trimmed = venueQuery.trim();
        setPendingVenueName(trimmed);
        setIsVenueDropdownOpen(false);
        setIsCreatingVenue(true);
    };

    const handleVenueCreated = (created: Venue) => {
        const createdId = created?.id ?? (created as any)?.ID;
        if (createdId) {
            const officialName = created?.officialName ?? (created as any)?.OfficialName ?? '';
            const summary: VenueSummary = {
                id: createdId,
                officialName,
                address: created?.address ?? (created as any)?.Address,
                latitude: created?.latitude ?? (created as any)?.Latitude,
                longitude: created?.longitude ?? (created as any)?.Longitude,
                status: created?.status ?? (created as any)?.Status,
            };
            setSelectedVenue(summary);
            setVenueId(createdId);
            setVenueQuery(officialName);
        }
        setIsCreatingVenue(false);
    };

    const handleVenueKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isVenueDropdownOpen || totalVenueDropdownOptions === 0) {
            if (e.key === 'Escape') {
                setIsVenueDropdownOpen(false);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setVenueHighlightedIndex((prev) => (prev < totalVenueDropdownOptions - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setVenueHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalVenueDropdownOptions - 1));
        } else if (e.key === 'Enter' && venueHighlightedIndex >= 0 && venueHighlightedIndex < totalVenueDropdownOptions) {
            e.preventDefault();
            if (venueHighlightedIndex < venueResults.length) {
                handleSelectVenue(venueResults[venueHighlightedIndex]);
            } else if (showAddVenueOption) {
                handleOpenCreateVenuePane();
            }
        } else if (e.key === 'Escape') {
            setIsVenueDropdownOpen(false);
        }
    };

    // Artist handlers
    const handleArtistInputChange = (value: string) => {
        setArtistQuery(value);
        setIsArtistDropdownOpen(true);
    };

    const handleSelectArtist = (artist: ArtistSummary) => {
        if (!artist.id) return;
        const safeSelected = Array.isArray(selectedArtists) ? selectedArtists : [];
        if (!safeSelected.some((a) => a.id === artist.id)) {
            setSelectedArtists([...safeSelected, artist]);
        }
        setArtistQuery('');
        setIsArtistDropdownOpen(false);
        setArtistHighlightedIndex(-1);
    };

    const handleRemoveArtist = (artistId?: string) => {
        if (!artistId) return;
        setSelectedArtists((prev) => (Array.isArray(prev) ? prev.filter((a) => a.id !== artistId) : []));
    };

    const handleOpenCreateArtistPane = () => {
        const trimmed = artistQuery.trim();
        setPendingArtistName(trimmed);
        setIsArtistDropdownOpen(false);
        setIsCreatingArtist(true);
    };

    const handleArtistCreated = (created: Artist) => {
        const createdId = created?.id ?? (created as any)?.ID;
        if (createdId) {
            const summary: ArtistSummary = {
                id: createdId,
                officialName: created?.officialName ?? (created as any)?.OfficialName,
                hiragana: created?.hiragana,
                disambiguation: created?.disambiguation,
                status: created?.status ?? (created as any)?.Status,
            };
            setSelectedArtists((prev) => {
                const safePrev = Array.isArray(prev) ? prev : [];
                return safePrev.some((a) => a.id === summary.id) ? safePrev : [...safePrev, summary];
            });
        }
        setArtistQuery('');
        setIsCreatingArtist(false);
    };

    const handleArtistKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isArtistDropdownOpen || totalArtistDropdownOptions === 0) {
            if (e.key === 'Escape') {
                setIsArtistDropdownOpen(false);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setArtistHighlightedIndex((prev) => (prev < totalArtistDropdownOptions - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setArtistHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalArtistDropdownOptions - 1));
        } else if (e.key === 'Enter' && artistHighlightedIndex >= 0 && artistHighlightedIndex < totalArtistDropdownOptions) {
            e.preventDefault();
            if (artistHighlightedIndex < artistResults.length) {
                handleSelectArtist(artistResults[artistHighlightedIndex]);
            } else if (showAddArtistOption) {
                handleOpenCreateArtistPane();
            }
        } else if (e.key === 'Escape') {
            setIsArtistDropdownOpen(false);
        }
    };

    const { mutateAsync: createEvent, isPending } = usePostEvents();

    const handleLinkChange = (index: number, value: string) => {
        const newLinks = [...links];
        newLinks[index] = value;
        setLinks(newLinks);
    };

    const addLink = () => setLinks([...links, '']);
    
    const removeLink = (index: number) => {
        if (links.length > 1) {
            setLinks(links.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!title || !date || !startTime || !endTime || !venueId) {
            toast.error(t('event.createMissingFields', '타이틀, 시작/종료 시간, 회장은 필수입니다.'));
            return;
        }

        const toDateTime = (time: string) => new Date(`${date}T${time}:00`).toISOString();
        const artistIds = selectedArtists.map((a) => a.id).filter((id): id is string => Boolean(id));

        const payload: EventInput = {
            title,
            venueId,
            artistIds: artistIds.length > 0 ? artistIds : undefined,
            openingTime: doorsOpen ? toDateTime(doorsOpen) : undefined,
            startTime: toDateTime(startTime),
            endTime: toDateTime(endTime),
            relatedLinks: links.filter((l) => l.trim() !== ''),
        };

        try {
            await createEvent({ data: payload });
            clearEventFormDraft();
            toast.success(t('event.createSuccess', '이벤트가 성공적으로 등록되었습니다.'));
            queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey() });
            onClose();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || t('event.createFail', '이벤트 등록에 실패했습니다.'));
        }
    };

    // 좌측 사이드바에서 '신규 회장 등록' 폼으로 전환된 경우
    if (isCreatingVenue) {
        return (
            <VenueFormPane
                initialName={pendingVenueName}
                onBack={() => setIsCreatingVenue(false)}
                onCreated={handleVenueCreated}
            />
        );
    }

    // 좌측 사이드바에서 '신규 출연자 등록' 폼으로 전환된 경우
    if (isCreatingArtist) {
        return (
            <ArtistFormPane
                initialName={pendingArtistName}
                onBack={() => setIsCreatingArtist(false)}
                onCreated={handleArtistCreated}
            />
        );
    }

    return (
        <div className="w-full h-full flex flex-col animate-in fade-in slide-in-from-left-4 duration-300 overflow-hidden">
            {/* Header (좌측 상단 뒤로가기 버튼) */}
            <div className="flex items-center gap-2 p-4 border-b border-border/50 shrink-0">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="rounded-full w-8 h-8 hover:bg-muted shrink-0"
                    disabled={isPending}
                    title={t('buttons.back', '뒤로가기')}
                    aria-label={t('buttons.back', '뒤로가기')}
                >
                    <ArrowLeft className="w-4 h-4 text-foreground" />
                </Button>
                <h2 className="font-bold text-lg text-primary truncate">
                    {t('buttons.newEvent', '새 이벤트 등록')}
                </h2>
            </div>

            <ScrollArea className="flex-1">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-3 px-4">
                    {/* Event Form */}
                    <div className="flex flex-col gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="title" className="text-xs font-bold text-muted-foreground">{t('event.fields.title', '타이틀')}</Label>
                            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('event.fields.titlePlaceholder', '이벤트 타이틀')} className="h-8 text-xs bg-background border-input" disabled={isPending} />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="date" className="text-xs font-bold text-muted-foreground">{t('event.fields.date', '개최일')}</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal h-8 text-xs bg-background border-input",
                                            !date && "text-muted-foreground"
                                        )}
                                        disabled={isPending}
                                    >
                                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                        {date ? format(parseISO(date), 'yyyy-MM-dd') : t('event.fields.date', '개최일')}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date ? parseISO(date) : undefined}
                                        onSelect={(d: any) => setDate(d ? format(d, 'yyyy-MM-dd') : '')}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <Label htmlFor="doorsOpen" className="text-xs font-bold text-muted-foreground">{t('event.fields.doorsOpen', '개장 시간')}</Label>
                                <Input type="time" id="doorsOpen" value={doorsOpen} onChange={(e) => setDoorsOpen(e.target.value)} className="h-8 text-xs px-2 bg-background border-input" disabled={isPending} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="startTime" className="text-xs font-bold text-muted-foreground">{t('event.fields.startTime', '개연 시간')}</Label>
                                <Input type="time" id="startTime" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-8 text-xs px-2 bg-background border-input" disabled={isPending} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="endTime" className="text-xs font-bold text-muted-foreground">{t('event.fields.endTime', '종료 시간')}</Label>
                                <Input type="time" id="endTime" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-8 text-xs px-2 bg-background border-input" disabled={isPending} />
                            </div>
                        </div>

                        {/* 회장 자동완성 입력 박스 */}
                        <div className="space-y-1 relative" ref={venueContainerRef}>
                            <Label htmlFor="venue" className="text-xs font-bold text-muted-foreground">
                                {t('event.fields.venue', '회장')}
                            </Label>
                            <div className="relative">
                                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                    id="venue"
                                    value={venueQuery}
                                    onChange={(e) => handleVenueInputChange(e.target.value)}
                                    onFocus={() => {
                                        if (venueQuery.trim().length >= 1 && !selectedVenue) {
                                            setIsVenueDropdownOpen(true);
                                        }
                                    }}
                                    onCompositionStart={() => setIsVenueComposing(true)}
                                    onCompositionEnd={() => setIsVenueComposing(false)}
                                    onKeyDown={handleVenueKeyDown}
                                    placeholder={t('event.fields.venuePlaceholder', '회장 이름 검색...')}
                                    autoComplete="off"
                                    className={cn(
                                        "h-8 text-xs pl-8 pr-8 bg-background border-input",
                                        selectedVenue && "border-primary/60 bg-primary/5"
                                    )}
                                    disabled={isPending}
                                />
                                {isSearchingVenues ? (
                                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
                                ) : selectedVenue ? (
                                    <button
                                        type="button"
                                        onClick={handleClearVenue}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-muted-foreground hover:text-foreground"
                                        disabled={isPending}
                                        aria-label={t('buttons.cancel', '취소')}
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                ) : null}
                            </div>

                            {shouldSearchVenues && (venueResults.length > 0 || showAddVenueOption) && (
                                <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-md max-h-52 overflow-y-auto">
                                    {/* 자동완성 회장 목록 */}
                                    {venueResults.map((venue, idx) => (
                                        <button
                                            key={venue.id}
                                            type="button"
                                            onClick={() => handleSelectVenue(venue)}
                                            onMouseEnter={() => setVenueHighlightedIndex(idx)}
                                            className={cn(
                                                "w-full text-left px-2.5 py-1.5 text-xs flex items-start justify-between gap-2 border-b border-border/50 last:border-0 transition-colors",
                                                venueHighlightedIndex === idx ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
                                            )}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium truncate">{venue.officialName}</div>
                                                {venue.address && (
                                                    <div className="text-[10px] text-muted-foreground truncate">
                                                        {venue.address}
                                                    </div>
                                                )}
                                            </div>
                                            {venueId === venue.id && (
                                                <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                                            )}
                                        </button>
                                    ))}

                                    {/* 존재하지 않는 회장일 때 자동완성 목록 제일 아래에 표시되는 '회장 추가' 버튼 */}
                                    {showAddVenueOption && (
                                        <button
                                            type="button"
                                            onClick={handleOpenCreateVenuePane}
                                            onMouseEnter={() => setVenueHighlightedIndex(venueResults.length)}
                                            className={cn(
                                                "w-full text-left px-2.5 py-2 text-xs font-semibold text-primary flex items-center gap-1.5 transition-colors border-t border-border/60 bg-primary/5",
                                                venueHighlightedIndex === venueResults.length
                                                    ? "bg-primary/15 text-primary"
                                                    : "hover:bg-primary/10"
                                            )}
                                        >
                                            <Plus className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate">
                                                "{debouncedVenueQuery}" {t('event.fields.addVenue', '회장 추가')}
                                            </span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 출연자 자동완성 입력 박스 */}
                        <div className="space-y-1.5 relative" ref={artistContainerRef}>
                            <Label htmlFor="artists" className="text-xs font-bold text-muted-foreground">
                                {t('event.fields.artists', '출연자')}
                            </Label>

                            {selectedArtists.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pb-0.5">
                                    {selectedArtists.map((artist) => (
                                        <span
                                            key={artist.id}
                                            className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full text-xs font-medium"
                                        >
                                            <Mic2 className="w-3 h-3 shrink-0 opacity-75" />
                                            <span className="truncate max-w-[180px]">
                                                {artist.officialName}
                                                {artist.disambiguation ? ` (${artist.disambiguation})` : ''}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveArtist(artist.id)}
                                                disabled={isPending}
                                                className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                                                aria-label={t('buttons.delete', '삭제')}
                                            >
                                                <X className="w-2.5 h-2.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="relative">
                                <Mic2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                    id="artists"
                                    value={artistQuery}
                                    onChange={(e) => handleArtistInputChange(e.target.value)}
                                    onFocus={() => {
                                        if (artistQuery.trim().length >= 1) {
                                            setIsArtistDropdownOpen(true);
                                        }
                                    }}
                                    onCompositionStart={() => setIsArtistComposing(true)}
                                    onCompositionEnd={() => setIsArtistComposing(false)}
                                    onKeyDown={handleArtistKeyDown}
                                    placeholder={t('event.fields.artistsPlaceholder', '출연자 이름 검색...')}
                                    autoComplete="off"
                                    className="h-8 text-xs pl-8 pr-8 bg-background border-input"
                                    disabled={isPending}
                                />
                                {isSearchingArtists && (
                                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
                                )}
                            </div>

                            {shouldSearchArtists && (artistResults.length > 0 || showAddArtistOption) && (
                                <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-md max-h-52 overflow-y-auto">
                                    {/* 자동완성 출연자 목록 */}
                                    {artistResults.map((artist, idx) => {
                                        const isAlreadyAdded = Array.isArray(selectedArtists) && selectedArtists.some((a) => a.id === artist.id);
                                        return (
                                            <button
                                                key={artist.id}
                                                type="button"
                                                onClick={() => handleSelectArtist(artist)}
                                                onMouseEnter={() => setArtistHighlightedIndex(idx)}
                                                className={cn(
                                                    "w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 border-b border-border/50 last:border-0 transition-colors",
                                                    artistHighlightedIndex === idx ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
                                                )}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="font-medium truncate">{artist.officialName}</span>
                                                        {artist.disambiguation && (
                                                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground truncate max-w-[120px]">
                                                                {artist.disambiguation}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {artist.hiragana && (
                                                        <div className="text-[10px] text-muted-foreground truncate">
                                                            {artist.hiragana}
                                                        </div>
                                                    )}
                                                </div>
                                                {isAlreadyAdded && (
                                                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })}

                                    {/* 존재하지 않는 출연자일 때 자동완성 목록 제일 아래에 표시되는 '출연자 추가' 버튼 */}
                                    {showAddArtistOption && (
                                        <button
                                            type="button"
                                            onClick={handleOpenCreateArtistPane}
                                            onMouseEnter={() => setArtistHighlightedIndex(artistResults.length)}
                                            className={cn(
                                                "w-full text-left px-2.5 py-2 text-xs font-semibold text-primary flex items-center gap-1.5 transition-colors border-t border-border/60 bg-primary/5",
                                                artistHighlightedIndex === artistResults.length
                                                    ? "bg-primary/15 text-primary"
                                                    : "hover:bg-primary/10"
                                            )}
                                        >
                                            <Plus className="w-3.5 h-3.5 shrink-0" />
                                            <span className="truncate">
                                                "{debouncedArtistQuery}" {t('event.fields.addArtist', '출연자 추가')}
                                            </span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground">{t('event.fields.relatedLinks', '관련 링크')}</Label>
                            {links.map((link, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input 
                                        placeholder="https://..." 
                                        value={link}
                                        onChange={(e) => handleLinkChange(index, e.target.value)}
                                        className="h-8 text-xs bg-background border-input flex-1" 
                                        disabled={isPending}
                                    />
                                    {links.length > 1 && (
                                        <Button 
                                            type="button"
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => removeLink(index)} 
                                            className="shrink-0 w-7 h-7 text-muted-foreground hover:text-destructive"
                                            disabled={isPending}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={addLink} className="h-8 w-full border-dashed text-xs text-muted-foreground hover:text-primary" disabled={isPending}>
                                <Plus className="w-3.5 h-3.5 mr-1" /> {t('event.addLink', '링크 추가')}
                            </Button>
                        </div>
                    </div>

                    <Button type="submit" disabled={isPending} className="w-full font-bold shadow-sm h-9 bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {t('buttons.register', '등록하기')}
                    </Button>

                    <hr className="border-border my-2" />

                    {/* Threads Section (Disabled during creation) */}
                    <div className="flex flex-col h-[200px] opacity-50 pointer-events-none">
                        <h3 className="font-bold text-sm text-primary mb-2 flex items-center gap-2">
                            {t('event.threads.title', '스레드')}
                            <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full">0</span>
                        </h3>
                        <div className="flex-1 rounded-md bg-muted/30 border border-border flex items-center justify-center">
                            <p className="text-xs text-muted-foreground text-center">
                                {t('event.threads.disabledDescription', '이벤트를 등록한 후에 스레드를 작성할 수 있습니다.')}
                            </p>
                        </div>
                    </div>
                </form>
            </ScrollArea>
        </div>
    );
}
