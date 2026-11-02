import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, MapPin, Plus, Trash2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Autocomplete } from '@react-google-maps/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { usePostVenues } from '../../api/generated/venues/venues';
import { useEventStore } from '../../store/useEventStore';
import { toast } from '../../store/useToastStore';
import type { Venue, VenueInput } from '../../api/generated/model';

interface VenueFormPaneProps {
    initialName: string;
    onBack: () => void;
    onCreated: (venue: Venue) => void;
}

export default function VenueFormPane({ initialName, onBack, onCreated }: VenueFormPaneProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const setIsPickingVenueLocation = useEventStore((state) => state.setIsPickingVenueLocation);
    const venueDraftLocation = useEventStore((state) => state.venueDraftLocation);
    const setVenueDraftLocation = useEventStore((state) => state.setVenueDraftLocation);

    const [officialName, setOfficialName] = useState(initialName);
    const [address, setAddress] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [googleMapId, setGoogleMapId] = useState('');
    const [capacity, setCapacity] = useState('');
    const [links, setLinks] = useState<string[]>(['']);

    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

    const { mutateAsync: createVenue, isPending } = usePostVenues();

    // 신규 회장 등록 폼이 열려 있는 동안 지도 클릭으로 좌표 선택 활성화
    useEffect(() => {
        setIsPickingVenueLocation(true);
        return () => {
            setIsPickingVenueLocation(false);
            setVenueDraftLocation(null);
        };
    }, [setIsPickingVenueLocation, setVenueDraftLocation]);

    // 지도에서 위치를 클릭했을 때 위도/경도/주소/Place ID 반영
    useEffect(() => {
        if (!venueDraftLocation) return;
        setLatitude(String(venueDraftLocation.lat));
        setLongitude(String(venueDraftLocation.lng));
        if (venueDraftLocation.address) {
            setAddress(venueDraftLocation.address);
        }
        if (venueDraftLocation.googleMapId) {
            setGoogleMapId(venueDraftLocation.googleMapId);
        }
    }, [venueDraftLocation]);

    const handlePlaceChanged = () => {
        const place = autocompleteRef.current?.getPlace();
        if (!place) return;

        if (place.name && !officialName.trim()) {
            setOfficialName(place.name);
        }
        if (place.formatted_address) {
            setAddress(place.formatted_address);
        }
        if (place.place_id) {
            setGoogleMapId(place.place_id);
        }
        const lat = place.geometry?.location?.lat();
        const lng = place.geometry?.location?.lng();
        if (typeof lat === 'number' && typeof lng === 'number') {
            const roundedLat = Number(lat.toFixed(6));
            const roundedLng = Number(lng.toFixed(6));
            setLatitude(String(roundedLat));
            setLongitude(String(roundedLng));
            setVenueDraftLocation({
                lat: roundedLat,
                lng: roundedLng,
                address: place.formatted_address,
                googleMapId: place.place_id,
            });
        }
    };

    const handleLinkChange = (index: number, value: string) => {
        const next = [...links];
        next[index] = value;
        setLinks(next);
    };

    const addLink = () => setLinks([...links, '']);

    const removeLink = (index: number) => {
        if (links.length > 1) {
            setLinks(links.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedName = officialName.trim();
        const parsedLat = Number.parseFloat(latitude);
        const parsedLng = Number.parseFloat(longitude);

        if (
            !trimmedName ||
            Number.isNaN(parsedLat) ||
            Number.isNaN(parsedLng) ||
            parsedLat < -90 ||
            parsedLat > 90 ||
            parsedLng < -180 ||
            parsedLng > 180
        ) {
            toast.error(
                t(
                    'venueForm.missingFields',
                    '회장 공식 이름과 유효한 위도/경도는 필수입니다. (지도를 클릭하거나 장소를 검색해주세요)'
                )
            );
            return;
        }

        const parsedCapacity = capacity.trim() ? Number.parseInt(capacity.trim(), 10) : undefined;
        if (parsedCapacity !== undefined && (Number.isNaN(parsedCapacity) || parsedCapacity <= 0)) {
            toast.error(t('venueForm.invalidCapacity', '수용 인원은 1 이상의 숫자여야 합니다.'));
            return;
        }

        const cleanedLinks = links.map((l) => l.trim()).filter(Boolean);

        const payload: VenueInput = {
            officialName: trimmedName,
            latitude: parsedLat,
            longitude: parsedLng,
            address: address.trim() || undefined,
            googleMapId: googleMapId.trim() || undefined,
            capacity: parsedCapacity,
            relatedLinks: cleanedLinks.length > 0 ? cleanedLinks : undefined,
        };

        try {
            const created = await createVenue({ data: payload });
            queryClient.invalidateQueries({ queryKey: ['/venues/search'] });
            queryClient.invalidateQueries({ queryKey: ['/venues'] });
            toast.success(t('venueForm.createSuccess', '신규 회장이 등록되어 선택되었습니다.'));
            onCreated(created);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || t('venueForm.createFail', '회장 등록에 실패했습니다.'));
        }
    };

    return (
        <div className="w-full h-full flex flex-col animate-in fade-in slide-in-from-left-4 duration-300 overflow-hidden">
            {/* Header (좌측 상단 뒤로가기 버튼) */}
            <div className="flex items-center gap-2 p-4 border-b border-border/50 shrink-0">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onBack}
                    className="rounded-full w-8 h-8 hover:bg-muted shrink-0"
                    disabled={isPending}
                    title={t('buttons.back', '뒤로가기')}
                    aria-label={t('buttons.back', '뒤로가기')}
                >
                    <ArrowLeft className="w-4 h-4 text-foreground" />
                </Button>
                <h2 className="font-bold text-lg text-primary truncate flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 shrink-0" />
                    {t('venueForm.title', '신규 회장 등록')}
                </h2>
            </div>

            <ScrollArea className="flex-1">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-3 px-4">
                    <div className="flex flex-col gap-3">
                        {/* Google Maps 장소 검색으로 주소/좌표 자동 완성 */}
                        {typeof window !== 'undefined' && window.google?.maps?.places && (
                            <div className="space-y-1">
                                <Label htmlFor="venue-place-search" className="text-xs font-bold text-muted-foreground">
                                    {t('venueForm.fields.placeSearch', 'Google 지도 장소 검색 (자동 입력)')}
                                </Label>
                                <Autocomplete
                                    onLoad={(auto) => {
                                        autocompleteRef.current = auto;
                                    }}
                                    onPlaceChanged={handlePlaceChanged}
                                >
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                        <Input
                                            id="venue-place-search"
                                            defaultValue={initialName}
                                            placeholder={t(
                                                'venueForm.fields.placeSearchPlaceholder',
                                                '장소 검색 시 주소·좌표가 자동 입력됩니다...'
                                            )}
                                            className="h-8 text-xs pl-8 bg-background border-input"
                                            disabled={isPending}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                }
                                            }}
                                        />
                                    </div>
                                </Autocomplete>
                            </div>
                        )}

                        <div className="space-y-1">
                            <Label htmlFor="venue-official-name" className="text-xs font-bold text-muted-foreground">
                                {t('venueForm.fields.officialName', '공식 이름')} <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="venue-official-name"
                                value={officialName}
                                onChange={(e) => setOfficialName(e.target.value)}
                                placeholder={t('venueForm.fields.officialNamePlaceholder', '회장 공식 표기명')}
                                className="h-8 text-xs bg-background border-input"
                                disabled={isPending}
                                autoFocus
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="venue-address" className="text-xs font-bold text-muted-foreground">
                                {t('venueForm.fields.address', '주소')}
                            </Label>
                            <Input
                                id="venue-address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder={t('venueForm.fields.addressPlaceholder', '예: 東京都千代田区北の丸公園2-3')}
                                className="h-8 text-xs bg-background border-input"
                                disabled={isPending}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold text-muted-foreground">
                                    {t('venueForm.fields.coordinates', '좌표 (위도 / 경도)')} <span className="text-destructive">*</span>
                                </Label>
                                <span className="text-[10px] text-primary font-medium">
                                    {t('venueForm.fields.mapClickHint', '우측 지도 클릭으로 선택 가능')}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Input
                                        id="venue-latitude"
                                        type="number"
                                        step="any"
                                        value={latitude}
                                        onChange={(e) => setLatitude(e.target.value)}
                                        placeholder={t('venueForm.fields.latitudePlaceholder', '위도 (예: 35.6933)')}
                                        className="h-8 text-xs bg-background border-input"
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Input
                                        id="venue-longitude"
                                        type="number"
                                        step="any"
                                        value={longitude}
                                        onChange={(e) => setLongitude(e.target.value)}
                                        placeholder={t('venueForm.fields.longitudePlaceholder', '경도 (예: 139.7498)')}
                                        className="h-8 text-xs bg-background border-input"
                                        disabled={isPending}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="venue-capacity" className="text-xs font-bold text-muted-foreground">
                                {t('venueForm.fields.capacity', '수용 인원 (선택)')}
                            </Label>
                            <Input
                                id="venue-capacity"
                                type="number"
                                min="1"
                                value={capacity}
                                onChange={(e) => setCapacity(e.target.value)}
                                placeholder={t('venueForm.fields.capacityPlaceholder', '예: 2000')}
                                className="h-8 text-xs bg-background border-input"
                                disabled={isPending}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-muted-foreground">
                                {t('venueForm.fields.relatedLinks', '관련 링크 (선택)')}
                            </Label>
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
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addLink}
                                className="h-8 w-full border-dashed text-xs text-muted-foreground hover:text-primary"
                                disabled={isPending}
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" /> {t('event.addLink', '링크 추가')}
                            </Button>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={isPending}
                        className="w-full font-bold shadow-sm h-9 bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        {t('buttons.register', '등록하기')}
                    </Button>
                </form>
            </ScrollArea>
        </div>
    );
}

