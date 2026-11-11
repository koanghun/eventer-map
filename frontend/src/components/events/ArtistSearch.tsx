import { useEffect, useMemo, useRef, useState } from 'react';
import { Search as SearchIcon, Loader2, Mic2, MapPin, Star, X } from 'lucide-react';
import { useDebounce } from 'use-debounce';
import { useTranslation } from 'react-i18next';
import { useGetArtists } from '../../api/generated/artists/artists';
import { useGetVenuesSearch } from '../../api/generated/venues/venues';
import { cn } from '../../lib/utils';
import type { ArtistSummary, VenueSummary } from '../../api/generated/model';

interface ArtistSearchProps {
    selectedArtist?: { id: string; name: string } | null;
    selectedVenue?: { id: string; name: string } | null;
    onSelectArtist?: (artist: { id: string; name: string }) => void;
    onSelectVenue?: (venue: { id: string; name: string; lat?: number; lng?: number }) => void;
    onClearFilter?: () => void;
}

    type SearchOption =
        | { kind: 'artist'; item: ArtistSummary }
        | { kind: 'venue'; item: VenueSummary };

    /**
     * 좌측 사이드바에서 출연자 또는 공연장을 통합 검색하고 활성 필터를 표시하는 컴포넌트
     */
    export default function ArtistSearch({
        selectedArtist,
        selectedVenue,
        onSelectArtist,
        onSelectVenue,
        onClearFilter,
    }: ArtistSearchProps) {
        const { t } = useTranslation();
        const [searchTerm, setSearchTerm] = useState('');
        const [debouncedTerm] = useDebounce(searchTerm.trim(), 300);
        const [isDropdownOpen, setIsDropdownOpen] = useState(false);
        const [isComposing, setIsComposing] = useState(false);
        const [highlightedIndex, setHighlightedIndex] = useState(-1);
        const containerRef = useRef<HTMLDivElement>(null);

    const shouldSearch = isDropdownOpen && !isComposing && debouncedTerm.length > 0;

                                    const {
                                        data: rawArtists,
                                    isLoading: isArtistsLoading,
                                    isError: isArtistsError,
    } = useGetArtists(
                                    {query: debouncedTerm, limit: 10 },
                                    {query: {enabled: shouldSearch } }
                                    );

                                    const {
                                        data: rawVenues,
                                    isLoading: isVenuesLoading,
                                    isError: isVenuesError,
    } = useGetVenuesSearch(
                                    {query: debouncedTerm, limit: 10 },
                                    {query: {enabled: shouldSearch } }
                                    );

                                    const artists = useMemo<ArtistSummary[]>(
        () => (!isArtistsError && Array.isArray(rawArtists) ? rawArtists : []),
                                    [isArtistsError, rawArtists]
                                    );
                                    const venues = useMemo<VenueSummary[]>(
        () => (!isVenuesError && Array.isArray(rawVenues) ? rawVenues : []),
                                    [isVenuesError, rawVenues]
                                    );

                                    const options = useMemo<SearchOption[]>(
        () => [
            ...artists.map((item) => ({kind: 'artist' as const, item })),
            ...venues.map((item) => ({kind: 'venue' as const, item })),
                                    ],
                                    [artists, venues]
                                    );

                                    const isLoading = shouldSearch && (isArtistsLoading || isVenuesLoading);
                                    const isAllError = shouldSearch && !isLoading && isArtistsError && isVenuesError;
                                    const isEmpty =
                                    shouldSearch &&
                                    !isLoading &&
                                    !isAllError &&
                                    artists.length === 0 &&
                                    venues.length === 0;

    useEffect(() => {
                                        setHighlightedIndex(-1);
    }, [debouncedTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                                        setIsDropdownOpen(false);
            }
        };
                                    document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectOption = (option: SearchOption) => {
        if (option.kind === 'artist') {
            const artist = option.item;
                                    if (artist.id && artist.officialName) {
                                        onSelectArtist?.({
                                            id: artist.id,
                                            name: artist.officialName,
                                        });
            }
        } else {
            const venue = option.item;
                                    if (venue.id && venue.officialName) {
                                        onSelectVenue?.({
                                            id: venue.id,
                                            name: venue.officialName,
                                            lat: venue.latitude,
                                            lng: venue.longitude,
                                        });
            }
        }
                                    setSearchTerm('');
                                    setIsDropdownOpen(false);
                                    setHighlightedIndex(-1);
    };

                                    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isDropdownOpen || options.length === 0) {
            if (e.key === 'Escape') {
                                            setIsDropdownOpen(false);
            }
                                        return;
        }

                                        if (e.key === 'ArrowDown') {
                                            e.preventDefault();
            setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
                                            e.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < options.length) {
                                            e.preventDefault();
                                        handleSelectOption(options[highlightedIndex]);
        } else if (e.key === 'Escape') {
                                            setIsDropdownOpen(false);
        }
    };

                                        return (
                                        <div className="space-y-2" ref={containerRef}>
                                            <div className="relative">
                                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                                <input
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        setSearchTerm(value);
                                                        setIsDropdownOpen(value.trim().length > 0);
                                                    }}
                                                    onFocus={() => {
                                                        if (searchTerm.trim().length > 0) {
                                                            setIsDropdownOpen(true);
                                                        }
                                                    }}
                                                    onCompositionStart={() => setIsComposing(true)}
                                                    onCompositionEnd={() => setIsComposing(false)}
                                                    onKeyDown={handleKeyDown}
                                                    placeholder={t('performerFilter.placeholder', '출연자 또는 공연장 검색...')}
                                                    autoComplete="off"
                                                    className="w-full pl-9 pr-9 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                                />
                                                {isLoading ? (
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                                    </div>
                                                ) : searchTerm.length > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSearchTerm('');
                                                            setIsDropdownOpen(false);
                                                        }}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                                        title={t('buttons.close', '닫기')}
                                                        aria-label={t('buttons.close', '닫기')}
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : null}

                                                {shouldSearch && (options.length > 0 || isAllError || isEmpty) && (
                                                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 max-h-72 overflow-y-auto">
                                                        {artists.length > 0 && (
                                                            <div>
                                                                <div className="px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground bg-muted/40 border-b border-border flex items-center gap-1.5">
                                                                    <Mic2 className="w-3 h-3 text-primary" />
                                                                    {t('performerFilter.artistsGroup', '출연자')}
                                                                </div>
                                                                {artists.map((artist, idx) => (
                                                                    <button
                                                                        key={artist.id ?? `artist-${idx}`}
                                                                        type="button"
                                                                        onClick={() => handleSelectOption({ kind: 'artist', item: artist })}
                                                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                                                        className={cn(
                                                                            'w-full text-left px-2.5 py-2 text-sm border-b border-border/60 last:border-0 transition-colors flex items-center justify-between gap-2',
                                                                            highlightedIndex === idx ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/70'
                                                                        )}
                                                                    >
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                                <span className="font-medium truncate">{artist.officialName}</span>
                                                                                {artist.disambiguation && (
                                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground truncate max-w-[110px]">
                                                                                        {artist.disambiguation}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        {artist.hiragana && artist.hiragana !== artist.officialName && (
                                                                            <div className="text-[11px] text-muted-foreground truncate">
                                                                                {artist.hiragana}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                        {
                                                                        typeof artist.rating === 'number' && artist.rating > 0 && (
                                                                            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-foreground shrink-0">
                                                                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                                                                {artist.rating.toFixed(1)}
                                                                            </span>
                                                                        )
                                                                    }
                                    </button>
                                                        ))}
                                                    </div>
                                                )}

                                                            {
                                                                venues.length > 0 && (
                                                                    <div>
                                                                        <div className="px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground bg-muted/40 border-b border-border flex items-center gap-1.5">
                                                                            <MapPin className="w-3 h-3 text-primary" />
                                                                            {t('performerFilter.venuesGroup', '공연장')}
                                                                        </div>
                                                                        {venues.map((venue, idx) => {
                                                                            const optionIdx = artists.length + idx;
                                                                            return (
                                                                                <button
                                                                                    key={venue.id ?? `venue-${idx}`}
                                                                                    type="button"
                                                                                    onClick={() => handleSelectOption({ kind: 'venue', item: venue })}
                                                                                    onMouseEnter={() => setHighlightedIndex(optionIdx)}
                                                                                    className={cn(
                                                                                        'w-full text-left px-2.5 py-2 text-sm border-b border-border/60 last:border-0 transition-colors flex items-center justify-between gap-2',
                                                                                        highlightedIndex === optionIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/70'
                                                                                    )}
                                                                                >
                                                                                    <div className="min-w-0 flex-1">
                                                                                        <div className="font-medium truncate">{venue.officialName}</div>
                                                                                        {venue.address && (
                                                                                            <div className="text-[11px] text-muted-foreground truncate">
                                                                                                {venue.address}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                    {typeof venue.rating === 'number' && venue.rating > 0 && (
                                                                                        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-foreground shrink-0">
                                                                                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                                                                            {venue.rating.toFixed(1)}
                                                                                        </span>
                                                                                    )}
                                                                                </button>
                                                );
                                })}
                                            </div>
                        )}

                                            {isAllError && (
                                                <div className="p-3 text-center text-sm text-destructive">
                                                    {t('performerFilter.searchError', '검색 중 오류가 발생했습니다.')}
                                                </div>
                                            )}
                                            {isEmpty && (
                                                <div className="p-3 text-center text-sm text-muted-foreground">
                                                    {t('performerFilter.noResults', '일치하는 등록된 출연자 또는 공연장이 없습니다.')}
                                                </div>
                                            )}
                                        </div>
                )}
                                </div>

            {(selectedArtist || selectedVenue) && (
                                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-sm text-primary">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {selectedArtist ? (
                                                <Mic2 className="w-3.5 h-3.5 shrink-0" />
                                            ) : (
                                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                            )}
                                            <span className="font-medium truncate">
                                                {selectedArtist ? selectedArtist.name : selectedVenue?.name}
                                            </span>
                                        </div>
                                        {onClearFilter && (
                                            <button
                                                type="button"
                                                onClick={onClearFilter}
                                                className="p-0.5 rounded-full hover:bg-primary/20 transition-colors shrink-0"
                                                title={t('performerFilter.clearFilter', '필터 해제')}
                                                aria-label={t('performerFilter.clearFilter', '필터 해제')}
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                        </div>
                    );
}
