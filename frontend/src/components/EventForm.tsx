import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Event, EventFormData, Performer, Place } from '../types/event';
import { placeApi, performerApi, eventApi } from '../services/api';
import './EventForm.css';

import MultiSelect from './MultiSelect';
import './MultiSelect.css';

import EventDuplicateModal from './EventDuplicateModal';

interface EventFormProps {
    event: Event | null;
    onSubmit: (event: Event) => void;
    onClose: () => void;
    onSwitchToEdit: (eventId: number) => void;
}

function EventForm({ event, onSubmit, onClose, onSwitchToEdit }: EventFormProps) {
    const { t } = useTranslation();
    // 임시 저장 키
    const DRAFT_KEY = 'eventFormDraft';

    const [savedPlaces, setSavedPlaces] = useState<Place[]>([]);
    const [savedPerformers, setSavedPerformers] = useState<Performer[]>([]);
    const [selectedPerformers, setSelectedPerformers] = useState<string[]>([]);
    const [duplicates, setDuplicates] = useState<any[]>([]); // 중복 이벤트 목록
    const [isSubmitting, setIsSubmitting] = useState(false); // 제출 로딩 상태

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
                related_link: '',
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
            related_link: '',
        };
    });

    // 저장된 데이터 불러오기 (장소, 출연자)
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
                location: event.location,
                address: event.address || '',
                latitude: event.latitude,
                longitude: event.longitude,
                performers: event.performers || '',
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
            const matchedPlace = savedPlaces.find(p =>
                p.canonical_name === value || p.name === value
            );
            if (matchedPlace) {
                setFormData(prev => ({
                    ...prev,
                    [name]: value, // location 업데이트
                    address: matchedPlace.address,
                    latitude: matchedPlace.latitude,
                    longitude: matchedPlace.longitude
                }));
            }
        }
    };

    const handlePerformersChange = (newPerformers: string[]) => {
        setSelectedPerformers(newPerformers);
        setFormData(prev => ({ ...prev, performers: newPerformers.join(',') }));
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
                location: place.canonical_name || place.name || formData.location,
                address: place.address,
                latitude: place.latitude,
                longitude: place.longitude,
            }));
            alert(t('eventForm.alerts.placeFoundDb'));

        } catch (error) {
            // 2. DB에 없으면 Google Geocoding API 호출 (프론트엔드에서 수행)
            console.log('DB search failed, trying Google API...');

            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ address: formData.location }, async (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    const result = results[0];
                    const location = result.geometry.location;
                    const lat = location.lat();
                    const lng = location.lng();
                    const address = result.formatted_address || '';

                    // 폼 업데이트
                    setFormData((prev) => ({
                        ...prev,
                        address: address,
                        latitude: lat,
                        longitude: lng,
                    }));

                    // 3. 검색 결과를 백엔드 DB에 저장 (캐싱)
                    try {
                        const newPlace = await placeApi.createPlace({
                            canonical_name: formData.location,
                            address: address,
                            latitude: lat,
                            longitude: lng
                        });
                        console.log('Place cached in DB');
                        // 저장된 장소 목록 갱신
                        setSavedPlaces(prev => [...prev, newPlace]);
                    } catch (saveError) {
                        console.error('Failed to cache place:', saveError);
                    }

                    alert(t('eventForm.alerts.placeFoundGoogle'));
                } else {
                    alert(t('eventForm.alerts.placeNotFound'));
                }
            });
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
        // onSubmit이 Promise를 반환하지 않을 수 있으므로 await을 사용하지 않음
        // App.tsx의 onSubmit이 비동기 작업 후 상태를 업데이트하도록 구성되어야 함
        onSubmit(formData as Event);

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
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>{event ? t('eventForm.titleEdit') : t('eventForm.titleNew')}</h2>
                        <button className="btn-close" onClick={onClose}>
                            ✕
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="event-form">
                        <div className="form-group">
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

                        <div className="form-group">
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

                        <div className="form-group">
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

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="door_time">{t('eventForm.labels.doorTime')}</label>
                                <input
                                    type="time"
                                    id="door_time"
                                    name="door_time"
                                    value={formData.door_time}
                                    onChange={handleChange}
                                    placeholder="18:00"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="start_time">{t('eventForm.labels.startTime')}</label>
                                <input
                                    type="time"
                                    id="start_time"
                                    name="start_time"
                                    value={formData.start_time}
                                    onChange={handleChange}
                                    placeholder="19:00"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="end_time">{t('eventForm.labels.endTime')}</label>
                                <input
                                    type="time"
                                    id="end_time"
                                    name="end_time"
                                    value={formData.end_time}
                                    onChange={handleChange}
                                    placeholder="21:00"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="location">{t('eventForm.labels.location')} *</label>
                            <div className="address-group">
                                <input
                                    type="text"
                                    id="location"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    required
                                    placeholder={t('eventForm.placeholders.location')}
                                    list="places-list"
                                    autoComplete="off"
                                />
                                <datalist id="places-list">
                                    {savedPlaces.map((place) => (
                                        <option key={place.id} value={place.name} />
                                    ))}
                                </datalist>
                                <button type="button" className="btn-geocode" onClick={handlePlaceSearch}>
                                    🔍 {t('eventForm.buttons.searchPlace')}
                                </button>
                            </div>
                            <small>{t('eventForm.hints.location')}</small>
                        </div>

                        <div className="form-group">
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

                        <div className="form-group">
                            <label htmlFor="performers">{t('eventForm.labels.performers')}</label>
                            <MultiSelect
                                options={savedPerformers}
                                selected={selectedPerformers}
                                onChange={handlePerformersChange}
                                placeholder={t('eventForm.placeholders.performers')}
                            />
                        </div>

                        <div className="form-group">
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

                        <div className="form-actions">
                            <button type="button" className="btn-cancel" onClick={onClose}>
                                {t('buttons.cancel')}
                            </button>
                            <button type="submit" className="btn-submit" disabled={isSubmitting}>
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
