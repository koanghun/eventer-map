import { useState } from 'react';
import { Search as SearchIcon, Loader2 } from 'lucide-react';
import { useGetArtists } from '../../api/generated/artists/artists';
import { useDebounce } from 'use-debounce';

export default function ArtistSearch() {
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedTerm] = useDebounce(searchTerm, 300);

    const { data, isLoading } = useGetArtists(
        { query: debouncedTerm },
        { query: { enabled: debouncedTerm.length > 0 } }
    );
    const artists = data || [];

    return (
        <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="아티스트 검색..." 
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
                        <div key={artist.id} className="p-2 hover:bg-muted cursor-pointer text-sm border-b border-border last:border-0">
                            {artist.officialName}
                        </div>
                    ))}
                </div>
            )}
            {debouncedTerm.length > 0 && artists?.length === 0 && !isLoading && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 p-3 text-center text-sm text-muted-foreground">
                    결과가 없습니다.
                </div>
            )}
        </div>
    );
}
