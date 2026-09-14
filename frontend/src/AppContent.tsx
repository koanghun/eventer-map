import { useEffect, useState } from 'react';
import { LoadScript } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import { useTheme } from './context/ThemeContext';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';
import UserProfile from './components/common/UserProfile';
import DailyVisitCounter from './components/common/DailyVisitCounter';
import AuthPanel from './components/auth/AuthPanel';
import { useLocation, useNavigate, Routes, Route, useSearchParams } from 'react-router-dom';
import { Sun, Moon, Map as MapIcon, Flag, Loader2, LogIn } from 'lucide-react';
import { Button } from './components/ui/button';
import { format } from 'date-fns';

import MapPage from './pages/MapPage';
import PerformersPage from './pages/PerformersPage';
import PlacesPage from './pages/PlacesPage';

const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];

export default function AppContent() {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const view = location.pathname === '/performers' ? 'performers' : 
                 location.pathname === '/places' ? 'places' : 'map';

    const today = format(new Date(), 'yyyy-MM-dd');
    const showFlagsOnly = searchParams.get('flags') === 'true';

    const { theme, toggleTheme } = useTheme();
    const { language, changeLanguage } = useLanguage();
    const { isAuthenticated, isLoading } = useAuth();
    const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false);

    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

    const updateQueryParams = (updates: Record<string, string | null>) => {
        const newParams = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null) {
                newParams.delete(key);
            } else {
                newParams.set(key, value);
            }
        });
        setSearchParams(newParams, { replace: true });
    };

    const handleFlagsToggle = () => {
        const nextFlags = !showFlagsOnly;
        if (nextFlags) {
            updateQueryParams({ flags: 'true', start: today, end: today });
        } else {
            updateQueryParams({ flags: null, start: null, end: null });
        }
    };

    useEffect(() => {
        document.title = t('seo.title') || 'Event Map';
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', t('seo.description') || '');
        }
    }, [t, language]);

    return (
        <LoadScript googleMapsApiKey={apiKey} libraries={GOOGLE_MAPS_LIBRARIES}>
            <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
                
                <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border shadow-sm px-4 md:px-8 py-3 flex flex-col md:flex-row justify-between items-center gap-4 transition-all duration-300">
                    <div className="flex-1 flex flex-col md:flex-row items-center gap-2 md:gap-4 text-center md:text-left justify-start">
                        <div className="flex items-center gap-2">
                            <MapIcon className="w-6 h-6 text-primary" />
                            <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">
                                {t('header.title')}
                            </h1>
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mx-2 animate-pulse hidden md:inline-block">
                                Preview
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground hidden md:block">{t('header.subtitle')}</p>
                    </div>

                    <div className="flex-1 hidden lg:flex justify-center">
                        <div className="flex items-center gap-2">
                            <Button
                                variant={view === 'map' ? "default" : "ghost"}
                                size="sm"
                                onClick={() => navigate(`/${location.search}`)}
                                className="rounded-full h-8 px-4"
                            >
                                <MapIcon className="w-4 h-4 mr-2" />
                                {t('nav.map', '지도')}
                            </Button>
                            <Button
                                variant={view === 'performers' ? "default" : "ghost"}
                                size="sm"
                                onClick={() => navigate(`/performers${location.search}`)}
                                className="rounded-full h-8 px-4"
                            >
                                {t('nav.performers', '출연자')}
                            </Button>
                            <Button
                                variant={view === 'places' ? "default" : "ghost"}
                                size="sm"
                                onClick={() => navigate(`/places${location.search}`)}
                                className="rounded-full h-8 px-4"
                            >
                                {t('nav.places', '장소')}
                            </Button>
                        </div>
                    </div>
                    
                    <div className="flex-1 flex items-center justify-end gap-3">
                        <select
                            value={language}
                            onChange={(e) => changeLanguage(e.target.value as 'ko' | 'ja' | 'en' | 'zh')}
                            className="h-9 px-3 py-1 bg-background border border-input rounded-md text-sm shadow-sm hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring transition-colors cursor-pointer"
                        >
                            <option value="ja">{t('language.ja')}</option>
                            <option value="ko">{t('language.ko')}</option>
                            <option value="en">{t('language.en', 'English')}</option>
                            <option value="zh">{t('language.zh', '中文')}</option>
                        </select>
                        
                        <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full w-9 h-9" title={t('header.themeToggle')}>
                            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </Button>

                        {isAuthenticated && (
                            <Button 
                                variant={showFlagsOnly ? "default" : "outline"} 
                                size="icon"
                                className={`rounded-full w-9 h-9 ${showFlagsOnly ? 'bg-orange-500 hover:bg-orange-600 border-orange-500 text-white' : ''}`}
                                onClick={handleFlagsToggle}
                                title={showFlagsOnly ? t('filter.flags.showAll') : t('filter.flags.showFlagsOnly')}
                            >
                                <Flag className={`w-4 h-4 ${showFlagsOnly ? 'fill-current' : ''}`} />
                            </Button>
                        )}

                        {isLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground mr-2">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span className="text-sm">...</span>
                            </div>
                        ) : isAuthenticated ? (
                            <UserProfile />
                        ) : (
                            <Button 
                                variant={isAuthPanelOpen ? "default" : "outline"} 
                                size="sm" 
                                className="rounded-full h-9 px-4" 
                                onClick={() => setIsAuthPanelOpen(!isAuthPanelOpen)}
                            >
                                <LogIn className="w-4 h-4 mr-2" />
                                {t('auth.login', 'Login')}
                            </Button>
                        )}
                    </div>
                </header>

                {isAuthPanelOpen && !isAuthenticated && (
                    <AuthPanel onClose={() => setIsAuthPanelOpen(false)} />
                )}

                <Routes>
                    <Route path="/" element={<MapPage />} />
                    <Route path="/performers" element={<PerformersPage />} />
                    <Route path="/places" element={<PlacesPage />} />
                </Routes>

                <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
                    <DailyVisitCounter />
                </div>
            </div>
        </LoadScript>
    );
}
