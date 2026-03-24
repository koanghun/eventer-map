import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Event, EventFormData, Performer, Place } from '../../types/event';
import { placeApi, performerApi, eventApi } from '../../services/api';
import MultiSelect from '../common/MultiSelect';
import TimeInput from '../common/TimeInput';
import EventDuplicateModal from './EventDuplicateModal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { MapPin, Search, Calendar, Clock, X, Save, AlertCircle } from 'lucide-react';

interface EventFormProps {
    event: Event | null;
    onSubmit: (event: Event) => void;
    onClose: () => void;
    onSwitchToEdit: (eventId: number) => void;
}

function EventForm({ event, onSubmit, onClose, onSwitchToEdit }: EventFormProps) {
    const { t } = useTranslation();
    const locationInputRef = useRef<HTMLInputElement>(null);
    const DRAFT_KEY = 'eventFormDraft';

    const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
    const [savedPerformers, setSavedPerformers] = useState<Performer[]>([]);
    const [selectedPerformers, setSelectedPerformers] = useState<string[]>([]);
    const [duplicates, setDuplicates] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [suggestions, setSuggestions] = useState<Place[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [formData, setFormData] = useState<EventFormData>(() => {
        if (event) {
            return {
                title: '', description: '', event_date: '', door_time: '', start_time: '', end_time: '',
                location: '', address: '', latitude: 35.6762, longitude: 139.6503,
                performers: '', performer_ids: [], related_link: '', place_id: undefined, google_place_id: ''
            };
        }
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
            try {
                const draft = JSON.parse(savedDraft);
                if (draft.performers) {
                    setSelectedPerformers(draft.performers.split(',').filter(Boolean));
                }
                return draft;
            } catch (e) {
                console.error('Failed to parse draft:', e);
            }
        }
        return {
            title: '', description: '', event_date: '', door_time: '', start_time: '', end_time: '',
            location: '', address: '', latitude: 35.6762, longitude: 139.6503,
            performers: '', performer_ids: [], related_link: '',
        };
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [places, performers] = await Promise.all([
                    placeApi.getAllPlaces(),
                    performerApi.getAllPerformers()
                ]);
                setSavedPlaces(places);
                setSavedPerformers(performers);
            } catch (error) {
                console.error('Failed to fetch data:', error);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (event) {
            const performersArray = event.performers ? event.performers.split(',').map(p => p.trim()) : [];
            setSelectedPerformers(performersArray);
            setFormData({
                title: event.title,
                description: event.description || '',
                event_date: event.event_date,
                door_time: event.door_time || '',
                start_time: event.start_time || '',
                end_time: event.end_time || '',
                location: event.place?.canonical_name || '',
                address: event.place?.address || '',
                latitude: event.place?.latitude || 0,
                longitude: event.place?.longitude || 0,
                place_id: event.place_id,
                google_place_id: event.place?.google_place_id || '',
                performers: event.performers || '',
                performer_ids: event.performer_ids || [],
                related_link: event.related_link || '',
            });
        }
    }, [event]);

    useEffect(() => {
        if (!event) {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
        }
    }, [formData, event]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'location') {
            const trimValue = value.trim();
            if (trimValue) {
                const filtered = savedPlaces.filter(p =>
                    p.canonical_name.toLowerCase().includes(trimValue.toLowerCase()) ||
                    (p.name && p.name.toLowerCase().includes(trimValue.toLowerCase()))
                );
                setSuggestions(filtered);
                setShowSuggestions(true);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }

            const matchedPlace = savedPlaces.find(p => p.canonical_name === value || p.name === value);
            if (matchedPlace) {
                setFormData(prev => ({
                    ...prev,
                    [name]: value,
                    place_id: matchedPlace.id,
                    address: matchedPlace.address,
                    latitude: matchedPlace.latitude,
                    longitude: matchedPlace.longitude,
                    google_place_id: matchedPlace.google_place_id
                }));
            } else {
                setFormData(prev => ({ ...prev, place_id: undefined, google_place_id: '' }));
            }
        }
    };

    const handlePerformersChange = (newPerformers: string[]) => {
        setSelectedPerformers(newPerformers);
        const performerIds = newPerformers
            .map(name => savedPerformers.find(p => p.canonical_name === name)?.id)
            .filter((id): id is number => id !== undefined);

        setFormData(prev => ({ ...prev, performers: newPerformers.join(','), performer_ids: performerIds }));
    };

    const handleSelectSuggestion = (place: Place) => {
        setFormData(prev => ({
            ...prev,
            location: place.canonical_name,
            place_id: place.id,
            address: place.address || '',
            latitude: place.latitude || 0,
            longitude: place.longitude || 0,
            google_place_id: place.google_place_id || ''
        }));
        setShowSuggestions(false);
    };

    const handlePlaceSearch = async () => {
        if (!formData.location) {
            alert(t('eventForm.alerts.placeNameRequired'));
            return;
        }

        try {
            const place = await placeApi.searchPlace(formData.location);
            setFormData((prev) => ({
                ...prev,
                place_id: place.id,
                location: place.canonical_name || formData.location,
                address: place.address,
                latitude: place.latitude,
                longitude: place.longitude,
                google_place_id: place.google_place_id || ''
            }));
            alert(t('eventForm.alerts.placeFoundDb'));
        } catch (error) {
            console.log('DB search failed, trying Google TextSearch...');
            const service = new window.google.maps.places.PlacesService(document.createElement('div'));
            service.textSearch(
                { query: formData.location, language: 'ja', region: 'jp' },
                (results, status) => {
                    if (status === 'OK' && results && results[0]) {
                        const result = results[0];
                        const lat = result.geometry?.location?.lat() || formData.latitude;
                        const lng = result.geometry?.location?.lng() || formData.longitude;
                        const address = result.formatted_address || '';
                        const placeName = result.name || formData.location;

                        setFormData((prev) => ({
                            ...prev, location: placeName, address: address, latitude: lat, longitude: lng,
                            google_place_id: result.place_id || '', place_id: undefined
                        }));
                        alert(t('eventForm.alerts.placeFoundGoogle'));
                    } else {
                        alert(t('eventForm.alerts.placeNotFound'));
                    }
                }
            );
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!formData.title || !formData.event_date || !formData.location) {
            alert(t('eventForm.alerts.requiredFields'));
            return;
        }

        setIsSubmitting(true);

        if (event) {
            await submitEvent();
            setIsSubmitting(false);
            return;
        }

        try {
            const checkResult = await eventApi.checkDuplicate(formData);
            if (checkResult.duplicates && checkResult.duplicates.length > 0) {
                setDuplicates(checkResult.duplicates);
                setIsSubmitting(false);
                return;
            }
        } catch (error) {
            console.error('Duplicate check failed:', error);
            alert(t('eventForm.alerts.duplicateCheckError'));
            setIsSubmitting(false);
            return;
        }

        await submitEvent();
        setIsSubmitting(false);
    };

    const submitEvent = async () => {
        let currentFormData = { ...formData };
        if (currentFormData.google_place_id && !currentFormData.place_id) {
            try {
                const newPlace = await placeApi.createPlace({
                    canonical_name: currentFormData.location,
                    address: currentFormData.address,
                    latitude: currentFormData.latitude,
                    longitude: currentFormData.longitude,
                    google_place_id: currentFormData.google_place_id,
                    aliases: []
                });
                currentFormData.place_id = newPlace.id;
            } catch (saveError) {
                console.error('Failed to populate place from backend:', saveError);
                alert("장소 등록 처리에 실패했습니다.");
                return;
            }
        }

        onSubmit(currentFormData as unknown as Event);

        if (!event) {
            localStorage.removeItem(DRAFT_KEY);
        }
    };

    const handleProceedAnyway = async () => {
        setDuplicates([]);
        setIsSubmitting(true);
        await submitEvent();
        setIsSubmitting(false);
    };

    const handleEditExisting = (existingEventId: number) => {
        setDuplicates([]);
        onSwitchToEdit(existingEventId);
    };

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto w-full h-full" onClick={onClose}>
                <div className="relative w-full max-w-2xl bg-background border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 my-auto max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                    
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 md:p-6 border-b border-border bg-card sticky top-0 z-10">
                        <h2 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
                            {event ? (
                                <><Save className="w-5 h-5 text-primary" /> {t('eventForm.titleEdit')}</>
                            ) : (
                                <><MapPin className="w-5 h-5 text-primary" /> {t('eventForm.titleNew')}</>
                            )}
                        </h2>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-5 md:p-6 custom-scrollbar">
                        <form id="event-form" onSubmit={handleSubmit} className="space-y-6">
                            
                            {/* Title & Description */}
                            <div className="space-y-4 bg-muted/30 p-4 border border-border/50 rounded-xl">
                                <div className="space-y-1.5">
                                    <Label htmlFor="title" className="text-foreground font-semibold flex items-center gap-1">
                                        {t('eventForm.labels.title')} <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        type="text"
                                        id="title"
                                        name="title"
                                        value={formData.title}
                                        onChange={handleChange}
                                        required
                                        placeholder={t('eventForm.placeholders.title')}
                                        className="bg-background"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="description" className="text-foreground font-semibold">
                                        {t('eventForm.labels.description')}
                                    </Label>
                                    <Textarea
                                        id="description"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        rows={3}
                                        placeholder={t('eventForm.placeholders.description')}
                                        className="bg-background resize-none"
                                    />
                                </div>
                            </div>

                            {/* Date & Time */}
                            <div className="space-y-4 bg-muted/30 p-4 border border-border/50 rounded-xl">
                                <div className="space-y-1.5">
                                    <Label htmlFor="event_date" className="text-foreground font-semibold flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-primary" /> {t('eventForm.labels.date')} <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        type="date"
                                        id="event_date"
                                        name="event_date"
                                        value={formData.event_date}
                                        onChange={handleChange}
                                        required
                                        className="bg-background w-full md:w-auto"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border/50 pt-4 mt-2">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="door_time" className="text-foreground font-semibold flex items-center gap-1.5 text-sm">
                                            <Clock className="w-3.5 h-3.5 text-muted-foreground" /> {t('eventForm.labels.doorTime')}
                                        </Label>
                                        <TimeInput id="door_time" name="door_time" value={formData.door_time} onChange={handleChange} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="start_time" className="text-foreground font-semibold flex items-center gap-1.5 text-sm">
                                            <Clock className="w-3.5 h-3.5 text-primary" /> {t('eventForm.labels.startTime')}
                                        </Label>
                                        <TimeInput id="start_time" name="start_time" value={formData.start_time} onChange={handleChange} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="end_time" className="text-foreground font-semibold flex items-center gap-1.5 text-sm">
                                            <Clock className="w-3.5 h-3.5 text-muted-foreground" /> {t('eventForm.labels.endTime')}
                                        </Label>
                                        <TimeInput id="end_time" name="end_time" value={formData.end_time} onChange={handleChange} />
                                    </div>
                                </div>
                            </div>

                            {/* Location */}
                            <div className="space-y-4 bg-muted/30 p-4 border border-border/50 rounded-xl">
                                <div className="space-y-1.5">
                                    <Label htmlFor="location" className="text-foreground font-semibold flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4 text-primary" /> {t('eventForm.labels.location')} <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="relative group flex gap-2 w-full">
                                        <div className="relative flex-1">
                                            <Input
                                                type="text"
                                                id="location"
                                                name="location"
                                                ref={locationInputRef}
                                                value={formData.location}
                                                onChange={handleChange}
                                                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                                required
                                                placeholder={t('eventForm.placeholders.location')}
                                                autoComplete="off"
                                                className="bg-background pr-9"
                                            />
                                            {showSuggestions && suggestions.length > 0 && (
                                                <ul className="absolute top-full left-0 z-50 w-full mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in zoom-in-95">
                                                    {suggestions.map(p => (
                                                        <li key={p.id} onClick={() => handleSelectSuggestion(p)} className="flex flex-col py-2 px-3 hover:bg-accent hover:text-accent-foreground cursor-pointer text-sm">
                                                            <div className="font-semibold">{p.canonical_name}</div>
                                                            {p.address && <div className="text-xs text-muted-foreground truncate leading-relaxed">{p.address}</div>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                        <Button type="button" variant="secondary" onClick={handlePlaceSearch} className="shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                            <Search className="w-4 h-4 mr-1.5" />
                                            <span className="hidden sm:inline">{t('eventForm.buttons.searchPlace')}</span>
                                            <span className="sm:hidden">찾기</span>
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 ml-1 flex items-start gap-1">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {t('eventForm.hints.location')}
                                    </p>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="address" className="text-foreground font-semibold">
                                        {t('eventForm.labels.address')}
                                    </Label>
                                    <Input
                                        type="text"
                                        id="address"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        placeholder={t('eventForm.placeholders.address')}
                                        readOnly
                                        className="bg-muted cursor-not-allowed"
                                    />
                                </div>

                                <input type="hidden" name="latitude" value={formData.latitude} />
                                <input type="hidden" name="longitude" value={formData.longitude} />
                            </div>

                            {/* Performers & Links */}
                            <div className="space-y-4 bg-muted/30 p-4 border border-border/50 rounded-xl">
                                <div className="space-y-1.5">
                                    <Label htmlFor="performers" className="text-foreground font-semibold">
                                        {t('eventForm.labels.performers')}
                                    </Label>
                                    <div className="bg-background rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
                                        <MultiSelect
                                            options={savedPerformers}
                                            selected={selectedPerformers}
                                            onChange={handlePerformersChange}
                                            placeholder={t('eventForm.placeholders.performers')}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="related_link" className="text-foreground font-semibold">
                                        {t('eventForm.labels.relatedLink')}
                                    </Label>
                                    <Input
                                        type="url"
                                        id="related_link"
                                        name="related_link"
                                        value={formData.related_link}
                                        onChange={handleChange}
                                        placeholder="https://example.com"
                                        className="bg-background"
                                    />
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border p-4 md:p-6 bg-card flex flex-col-reverse sm:flex-row justify-end gap-3 sticky bottom-0 z-10 w-full mt-auto">
                        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                            {t('buttons.cancel')}
                        </Button>
                        <Button type="submit" form="event-form" className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <><span className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin mr-2" /> {t('eventForm.buttons.submitting')}</>
                            ) : (
                                event ? t('buttons.update') : t('buttons.submit')
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {duplicates.length > 0 && (
                <EventDuplicateModal
                    duplicates={duplicates}
                    onClose={() => setDuplicates([])}
                    onProceed={handleProceedAnyway}
                    onEdit={handleEditExisting}
                />
            )}
        </>
    );
}

export default EventForm;
