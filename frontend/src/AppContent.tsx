import { useState } from 'react';
import { LoadScript } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import EventMap from './components/map/EventMap';
import EventForm from './components/events/EventForm';
import EventList from './components/events/EventList';
import DatePicker from './components/common/DatePicker';
import PerformerFilter from './components/performers/PerformerFilter';
import { format } from 'date-fns';
import './App.css';

import { useTheme } from './context/ThemeContext';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';
import LoginButton from './components/common/LoginButton';
import UserProfile from './components/common/UserProfile';

import { useEventData } from './hooks/useEventData';
import { useEventForm } from './hooks/useEventForm';
import { useEventStore } from './store/useEventStore';
import DailyVisitCounter from './components/common/DailyVisitCounter';

const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];

export default function AppContent() {
    const { t } = useTranslation();
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const { theme, toggleTheme } = useTheme();
    const { language, changeLanguage } = useLanguage();
    const { isAuthenticated, isLoading } = useAuth();
    const [showFlagsOnly, setShowFlagsOnly] = useState<boolean>(false);

    // 2개 훅으로 분리된 책임
    const eventData = useEventData(selectedDate, showFlagsOnly);
    const eventForm = useEventForm();
    const clearSelection = useEventStore((state) => state.clearSelection);

    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

    const handleLogin = () => {
        const apiBase = process.env.REACT_APP_API_URL;

        if (apiBase) {
            // [로컬 개발 환경]: 백엔드 주소로 직접 이동하여 프록시 무한 루프 방지
            window.location.href = `${apiBase}/auth/google/login`;
        } else {
            // [프로덕션 배포 환경]: Nginx 등의 프록시 구성을 그대로 타도록 유지
            window.location.href = `/api/auth/google/login`;
        }
    };

    const handleDateChange = (newDate: string) => {
        setSelectedDate(newDate);
        clearSelection(); // 날짜 변경 시 선택 초기화
    };

    const handleFlagsToggle = () => {
        setShowFlagsOnly(prev => !prev);
        if (!showFlagsOnly) {
            // 플래그 모드 활성화 시: 날짜를 빈 값으로 설정하여 모든 플래그 이벤트 표시
            setSelectedDate('');
            eventData.setSelectedPerformer(null);
        } else {
            // 플래그 모드 비활성화 시: 오늘 날짜로 복원
            setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
        }
        clearSelection();
    };

    return (
        <LoadScript googleMapsApiKey={apiKey} libraries={GOOGLE_MAPS_LIBRARIES}>
            <div className="app">
                <header className="app-header">
                    <div className="header-content">
                        <div className="header-title">
                            <h1>🗺️ {t('header.title')}</h1>
                            <span className="preview-badge">Preview</span>
                        </div>
                        <p>{t('header.subtitle')}</p>
                    </div>
                    <div className="header-controls">
                        <select
                            value={language}
                            onChange={(e) => changeLanguage(e.target.value as 'ko' | 'ja')}
                            className="language-selector"
                        >
                            <option value="ja">{t('language.ja')}</option>
                            <option value="ko">{t('language.ko')}</option>
                        </select>
                        <button className="theme-toggle" onClick={toggleTheme} title={t('header.themeToggle')}>
                            {theme === 'dark' ? '☀️' : '🌙'}
                        </button>
                        {isAuthenticated && (
                            <button
                                className={`flags-filter-toggle ${showFlagsOnly ? 'active' : ''}`}
                                onClick={handleFlagsToggle}
                                title={showFlagsOnly ? t('filter.flags.showAll') : t('filter.flags.showFlagsOnly')}
                            >
                                🚩
                            </button>
                        )}
                        {isLoading ? (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: 'var(--text-primary)'
                            }}>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    border: '2px solid var(--primary-color)',
                                    borderTopColor: 'transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 0.8s linear infinite'
                                }} />
                                <span style={{ fontSize: '14px' }}>로그인 중...</span>
                            </div>
                        ) : isAuthenticated ? (
                            <UserProfile />
                        ) : (
                            <LoginButton onClick={handleLogin} />
                        )}
                    </div>
                </header>

                <div className="app-container">
                    <aside className="sidebar">
                        <DatePicker selectedDate={selectedDate} onDateChange={handleDateChange} />

                        <PerformerFilter onPerformerSelect={eventData.setSelectedPerformer} />

                        {isAuthenticated && (
                            <button className="btn-new-event" onClick={eventForm.openNew}>
                                ➕ {t('buttons.newEvent')}
                            </button>
                        )}

                        <EventList
                            events={eventData.filteredEvents}
                            loading={eventData.loading}
                            onEventEdit={isAuthenticated ? eventForm.openEdit : undefined}
                            onEventDelete={isAuthenticated ? eventForm.deleteEvent : undefined}
                        />
                    </aside>

                    <main className="main-content">
                        <EventMap
                            events={eventData.filteredEvents}
                        />
                    </main>
                </div>

                {eventForm.isFormOpen && (
                    <EventForm
                        event={eventForm.formEvent}
                        onSubmit={eventForm.submit}
                        onClose={eventForm.close}
                        onSwitchToEdit={(id) => eventForm.switchToEdit(id, eventData.events)}
                    />
                )}

                <DailyVisitCounter />
            </div>
        </LoadScript>
    );
}
