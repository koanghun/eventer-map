import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Event, EventFormData, Performer, Place } from '../../types/event';
import { placeApi, performerApi, eventApi } from '../../services/api';
import styles from './EventForm.module.css';

import MultiSelect from '../common/MultiSelect';
import TimeInput from '../common/TimeInput';

import EventDuplicateModal from './EventDuplicateModal';

interface EventFormProps {
    event: Event | null;
    onSubmit: (event: Event) => void;
    onClose: () => void;
    onSwitchToEdit: (eventId: number) => void;
}

function EventForm({ event, onSubmit, onClose, onSwitchToEdit }: EventFormProps) {
    const { t } = useTranslation();
    const locationInputRef = useRef<HTMLInputElement>(null);
    // 임시 저장 키
    const DRAFT_KEY = 'eventFormDraft';

    const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
    const [savedPerformers, setSavedPerformers] = useState<Performer[]>([]);
    const [selectedPerformers, setSelectedPerformers] = useState<string[]>([]);
    const [duplicates, setDuplicates] = useState<any[]>([]); // 중복 이벤트 목록
    const [isSubmitting, setIsSubmitting] = useState(false); // 제출 로딩 상태
    const [suggestions, setSuggestions] = useState<Place[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [formData, setFormData] = useState<EventFormData>(() => {
        // 수정 모드면 기본값 사용 (useEffect에서 업데이트됨)
        if (event) {
            return {
                title: '',
                description: '',
                event_date: '',
                door_time: '',
                start_time: '',
                end_time: '',
                location: '',
                address: '',
                latitude: 35.6762,
                longitude: 139.6503,
                performers: '',
                performer_ids: [],
                related_link: '',
                place_id: undefined,
                google_place_id: ''
            };
        }

        // 새 이벤트 모드면 로컬 스토리지 확인
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
            try {
                const draft = JSON.parse(savedDraft);
                // performers 문자열을 배열로 변환
                if (draft.performers) {
                    setSelectedPerformers(draft.performers.split(',').filter(Boolean));
                }
                return draft;
            } catch (e) {
                console.error('Failed to parse draft:', e);
            }
        }

        // 없으면 기본값
        return {
            title: '',
            description: '',
            event_date: '',
            door_time: '',
            start_time: '',
            end_time: '',
            location: '',
            address: '',
            latitude: 35.6762,
            longitude: 139.6503,
            performers: '',
            performer_ids: [],
            related_link: '',
        };
    });

    // 저장된 데이터 불러오기 (장소, 출연자)
    // TODO: 모든 데이터를 불러오는 대신, 지역별로 불러오도록 변경
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

    // 폼 데이터 변경 시 임시 저장 (새 이벤트일 때만)
    useEffect(() => {
        if (!event) {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
        }
    }, [formData, event]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        setFormData(prev => ({ ...prev, [name]: value }));

        // 장소명이 변경되었을 때, 저장된 장소 목록에서 일치하는 것이 있는지 확인
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

            const matchedPlace = savedPlaces.find(p =>
                p.canonical_name === value || p.name === value
            );
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

        // ID 추출 (savedPerformers에서 찾기)
        const performerIds = newPerformers
            .map(name => savedPerformers.find(p => p.canonical_name === name)?.id)
            .filter((id): id is number => id !== undefined);

        setFormData(prev => ({
            ...prev,
            performers: newPerformers.join(','),
            performer_ids: performerIds
        }));
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
            // 1. 백엔드 DB에서 먼저 검색
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
            // 2. DB에 없으면 Google Places TextSearch 사용 (선택 및 place_id 획득 지원)
            console.log('DB search failed, trying Google TextSearch...');

            const service = new window.google.maps.places.PlacesService(document.createElement('div'));
            service.textSearch(
                {
                    query: formData.location,
                    language: 'ja',
                    region: 'jp'
                },
                (results, status) => {
                    if (status === 'OK' && results && results[0]) {
                        const result = results[0];
                        const lat = result.geometry?.location?.lat() || formData.latitude;
                        const lng = result.geometry?.location?.lng() || formData.longitude;
                        const address = result.formatted_address || '';
                        const placeName = result.name || formData.location;

                        setFormData((prev) => ({
                            ...prev,
                            location: placeName,
                            address: address,
                            latitude: lat,
                            longitude: lng,
                            google_place_id: result.place_id || '',
                            place_id: undefined
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
        if (isSubmitting) return; // 중복 제출 방지

        if (!formData.title || !formData.event_date || !formData.location) {
            alert(t('eventForm.alerts.requiredFields'));
            return;
        }

        setIsSubmitting(true);

        // 수정 모드일 때는 중복 체크 건너뛰기
        if (event) {
            await submitEvent();
            setIsSubmitting(false);
            return;
        }

        // 중복 체크 실행
        try {
            const checkResult = await eventApi.checkDuplicate(formData);
            if (checkResult.duplicates && checkResult.duplicates.length > 0) {
                setDuplicates(checkResult.duplicates);
                setIsSubmitting(false);
                return; // 중복 발견, 모달 표시 후 중단
            }
        } catch (error) {
            console.error('Duplicate check failed:', error);
            alert(t('eventForm.alerts.duplicateCheckError'));
            setIsSubmitting(false);
            return; // 중복 체크 실패 시 제출 중단
        }

        await submitEvent();
        setIsSubmitting(false);
    };

    const submitEvent = async () => {
        let currentFormData = { ...formData };

        // 1. google_place_id가 제공된 경우 장소 먼저 처리 (캐싱/검증)
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

        // onSubmit이 Promise를 반환하지 않을 수 있으므로 await을 사용하지 않음
        onSubmit(currentFormData as unknown as Event);

        // 제출 성공 시 임시 저장 데이터 삭제
        if (!event) {
            localStorage.removeItem(DRAFT_KEY);
        }
    };

    const handleProceedAnyway = async () => {
        setDuplicates([]); // 모달 닫기
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
            <div className={styles.modalOverlay} onClick={onClose}>
                <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.modalHeader}>
                        <h2>{event ? t('eventForm.titleEdit') : t('eventForm.titleNew')}</h2>
                        <button className={styles.btnClose} onClick={onClose}>
                            ✕
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className={styles.eventForm}>
                        <div className={styles.formGroup}>
                            <label htmlFor="title">{t('eventForm.labels.title')} *</label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                required
                                placeholder={t('eventForm.placeholders.title')}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="description">{t('eventForm.labels.description')}</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={3}
                                placeholder={t('eventForm.placeholders.description')}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="event_date">{t('eventForm.labels.date')} *</label>
                            <input
                                type="date" // 필드의 표시 언어는 브라우저의 언어 설정
                                id="event_date"
                                name="event_date"
                                value={formData.event_date}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                                <label htmlFor="door_time">{t('eventForm.labels.doorTime')}</label>
                                <TimeInput
                                    id="door_time"
                                    name="door_time"
                                    value={formData.door_time}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="start_time">{t('eventForm.labels.startTime')}</label>
                                <TimeInput
                                    id="start_time"
                                    name="start_time"
                                    value={formData.start_time}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="end_time">{t('eventForm.labels.endTime')}</label>
                                <TimeInput
                                    id="end_time"
                                    name="end_time"
                                    value={formData.end_time}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="location">{t('eventForm.labels.location')} *</label>
                            <div className={styles.addressGroup} style={{ position: 'relative' }}>
                                <input
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
                                />
                                <button type="button" className={styles.btnGeocode} onClick={handlePlaceSearch}>
                                    🔍 {t('eventForm.buttons.searchPlace')}
                                </button>

                                {showSuggestions && suggestions.length > 0 && (
                                    <ul className={styles.suggestionsList}>
                                        {suggestions.map(p => (
                                            <li key={p.id} onClick={() => handleSelectSuggestion(p)}>
                                                <div className={styles.suggestionName}>{p.canonical_name}</div>
                                                {p.address && <div className={styles.suggestionAddress}>{p.address}</div>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <small>{t('eventForm.hints.location')}</small>
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="address">{t('eventForm.labels.address')}</label>
                            <input
                                type="text"
                                id="address"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder={t('eventForm.placeholders.address')}
                                readOnly
                            />
                        </div>

                        {/* 위도/경도는 숨김 처리 (자동 입력됨) */}
                        <input type="hidden" name="latitude" value={formData.latitude} />
                        <input type="hidden" name="longitude" value={formData.longitude} />

                        <div className={styles.formGroup}>
                            <label htmlFor="performers">{t('eventForm.labels.performers')}</label>
                            <MultiSelect
                                options={savedPerformers}
                                selected={selectedPerformers}
                                onChange={handlePerformersChange}
                                placeholder={t('eventForm.placeholders.performers')}
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="related_link">{t('eventForm.labels.relatedLink')}</label>
                            <input
                                type="url"
                                id="related_link"
                                name="related_link"
                                value={formData.related_link}
                                onChange={handleChange}
                                placeholder="https://example.com"
                            />
                        </div>

                        <div className={styles.formActions}>
                            <button type="button" className={styles.btnCancel} onClick={onClose}>
                                {t('buttons.cancel')}
                            </button>
                            <button type="submit" className={styles.btnSubmit} disabled={isSubmitting}>
                                {isSubmitting ? t('eventForm.buttons.submitting') : (event ? t('buttons.update') : t('buttons.submit'))}
                            </button>
                        </div>
                    </form>
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
