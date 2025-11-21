import React, { useState, useEffect } from 'react';
import { Event, EventFormData } from '../types/event';
import './EventForm.css';

interface EventFormProps {
    event: Event | null;
    onSubmit: (event: Event) => void;
    onClose: () => void;
}

const EventForm: React.FC<EventFormProps> = ({ event, onSubmit, onClose }) => {
    const [formData, setFormData] = useState<EventFormData>({
        title: '',
        description: '',
        event_date: '',
        event_time: '',
        location: '',
        address: '',
        latitude: 37.5665,
        longitude: 126.9780,
        performers: '',
        related_link: '',
    });

    useEffect(() => {
        if (event) {
            setFormData({
                title: event.title,
                description: event.description || '',
                event_date: event.event_date,
                event_time: event.event_time || '',
                location: event.location,
                address: event.address || '',
                latitude: event.latitude,
                longitude: event.longitude,
                performers: event.performers || '',
                related_link: event.related_link || '',
            });
        }
    }, [event]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleGeocodeAddress = async () => {
        if (!formData.address) {
            alert('주소를 입력해주세요.');
            return;
        }

        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: formData.address }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                const location = results[0].geometry.location;
                setFormData((prev) => ({
                    ...prev,
                    latitude: location.lat(),
                    longitude: location.lng(),
                }));
                alert('주소가 좌표로 변환되었습니다!');
            } else {
                alert('주소를 찾을 수 없습니다. 다시 시도해주세요.');
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title || !formData.event_date || !formData.location) {
            alert('필수 항목을 모두 입력해주세요.');
            return;
        }

        onSubmit(formData as Event);
    };

    return (
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

                    <div className="form-row">
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

                        <div className="form-group">
                            <label htmlFor="event_time">시간</label>
                            <input
                                type="time"
                                id="event_time"
                                name="event_time"
                                value={formData.event_time}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="location">장소명 *</label>
                        <input
                            type="text"
                            id="location"
                            name="location"
                            value={formData.location}
                            onChange={handleChange}
                            required
                            placeholder="예: 올림픽공원"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="address">주소</label>
                        <div className="address-group">
                            <input
                                type="text"
                                id="address"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder="서울시 송파구 올림픽로 424"
                            />
                            <button type="button" className="btn-geocode" onClick={handleGeocodeAddress}>
                                좌표 변환
                            </button>
                        </div>
                        <small>주소를 입력하고 '좌표 변환' 버튼을 클릭하세요</small>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="latitude">위도 *</label>
                            <input
                                type="number"
                                id="latitude"
                                name="latitude"
                                value={formData.latitude}
                                onChange={handleChange}
                                step="0.000001"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="longitude">경도 *</label>
                            <input
                                type="number"
                                id="longitude"
                                name="longitude"
                                value={formData.longitude}
                                onChange={handleChange}
                                step="0.000001"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="performers">출연자</label>
                        <input
                            type="text"
                            id="performers"
                            name="performers"
                            value={formData.performers}
                            onChange={handleChange}
                            placeholder="출연자 이름 (쉼표로 구분)"
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
                        <button type="submit" className="btn-submit">
                            {event ? '수정' : '등록'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EventForm;
