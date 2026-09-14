import { useGetVenues } from '../../api/generated/venues/venues';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function VenueList() {
    const { t } = useTranslation();
    const { data, isLoading, error } = useGetVenues({
        minLat: 35.0,
        maxLat: 36.0,
        minLng: 139.0,
        maxLng: 140.0
    });
    const venues = data?.venues || [];

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    if (error || venues.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground text-sm">
                {t('venueList.noVenues', 'No venues registered.')}
            </div>
        );
    }

    return (
        <div className="p-4 space-y-3">
            {venues.map((venue: any) => (
                <div key={venue.id} className="p-3 rounded-lg border border-border bg-background hover:bg-muted/50 cursor-pointer transition-colors">
                    <h4 className="font-semibold text-sm text-primary">{venue.officialName}</h4>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{venue.address}</p>
                </div>
            ))}
        </div>
    );
}
