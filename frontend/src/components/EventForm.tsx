import React, { useState, useEffect } from 'react';
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

const EventForm: React.FC<EventFormProps> = ({ event, onSubmit, onClose, onSwitchToEdit }) => {
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
            alert('장소명을 입력해주세요.');
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
            alert('장소 정보가 자동으로 입력되었습니다! (DB 캐시)');

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

                    alert('장소 정보가 자동으로 입력되었습니다! (Google API)');
                } else {
                    alert('장소를 찾을 수 없습니다. 다른 검색어를 시도해주세요.');
                }
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return; // 중복 제출 방지

        if (!formData.title || !formData.event_date || !formData.location) {
            alert('필수 항목을 모두 입력해주세요.');
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
            alert('중복 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
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
                        <h2>{event ? '이벤트 수정' : '새 이벤트 등록'}</h2>
                        <button className="btn-close" onClick={onClose}>
                            ✕
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="event-form">
                        <div className="form-group">
                            <label htmlFor="title">제목 *</label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                required
                                placeholder="이벤트 제목"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">설명</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={3}
                                placeholder="이벤트 설명"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="event_date">날짜 *</label>
                            <input
                                type="date"
                                id="event_date"
                                name="event_date"
                                value={formData.event_date}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="door_time">개장 시간</label>
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
                                <label htmlFor="start_time">개연 시간</label>
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
                                <label htmlFor="end_time">종연 시간</label>
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
                            <label htmlFor="location">장소 검색 *</label>
                            <div className="address-group">
                                <input
                                    type="text"
                                    id="location"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    required
                                    placeholder="예: 横浜アリーナ"
                                    list="places-list"
                                    autoComplete="off"
                                />
                                <datalist id="places-list">
                                    {savedPlaces.map((place) => (
                                        <option key={place.id} value={place.name} />
                                    ))}
                                </datalist>
                                <button type="button" className="btn-geocode" onClick={handlePlaceSearch}>
                                    🔍 장소 검색
                                </button>
                            </div>
                            <small>장소명을 입력하고 검색하면 주소와 좌표가 자동으로 입력됩니다</small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="address">주소</label>
                            <input
                                type="text"
                                id="address"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder="자동 입력됨"
                                readOnly
                            />
                        </div>

                        {/* 위도/경도는 숨김 처리 (자동 입력됨) */}
                        <input type="hidden" name="latitude" value={formData.latitude} />
                        <input type="hidden" name="longitude" value={formData.longitude} />

                        <div className="form-group">
                            <label htmlFor="performers">출연자</label>
                            <MultiSelect
                                options={savedPerformers}
                                selected={selectedPerformers}
                                onChange={handlePerformersChange}
                                placeholder="출연자 선택 또는 직접 입력"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="related_link">관련 링크</label>
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
                                취소
                            </button>
                            <button type="submit" className="btn-submit" disabled={isSubmitting}>
                                {isSubmitting ? '처리 중...' : (event ? '수정' : '등록')}
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
};

export default EventForm;
