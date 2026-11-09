import { useState } from 'react';
import { Search as SearchIcon, Loader2, Mic2, MapPin, X } from 'lucide-react';
import { useGetArtists } from '../../api/generated/artists/artists';
import { useDebounce } from 'use-debounce';

import { useTranslation } from 'react-i18next';

    interface ArtistSearchProps {
        selectedArtist?: { id: string; name: string } | null;
        selectedVenue?: { id: string; name: string } | null;
        onSelectArtist?: (artist: { id: string; name: string }) => void;
        onClearFilter?: () => void;
    }

    export default function ArtistSearch({
        selectedArtist,
        selectedVenue,
        onSelectArtist,
        onClearFilter,
    }: ArtistSearchProps) {
        const { t } = useTranslation();
        const [searchTerm, setSearchTerm] = useState('');
        const [debouncedTerm] = useDebounce(searchTerm, 300);

        const { data, isLoading, isError } = useGetArtists(
            { query: debouncedTerm },
            { query: { enabled: debouncedTerm.length > 0 } }
        );
        const artists = !isError && Array.isArray(data) ? data : [];

        return (
                        <div className="space-y-2">
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={t('performerFilter.placeholder', 'Search artists...')}
                                    className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                                {isLoading && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                    </div>
                                )}

                                {artists && artists.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                                        {artists.map((artist: any) => (
                                            <div
                                                key={artist.id}
                                                className="p-2 hover:bg-muted cursor-pointer text-sm border-b border-border last:border-0"
                                                onClick={() => {
                                                    if (artist.id && artist.officialName) {
                                                        onSelectArtist?.({
                                                            id: artist.id,
                                                            name: artist.officialName,
                                                        });
                                                        setSearchTerm('');
                                                    }
                                                }}
                                            >
                                                {artist.officialName}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {debouncedTerm.length > 0 && !isLoading && isError && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 p-3 text-center text-sm text-destructive">
                                        {t('performerFilter.searchError', '출연자 검색 중 오류가 발생했습니다.')}
                                    </div>
                                )}
                                {debouncedTerm.length > 0 && !isLoading && !isError && artists?.length === 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 p-3 text-center text-sm text-muted-foreground">
                                        {t('performerFilter.noResults', '일치하는 등록된 출연자가 없습니다.')}
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
