import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Language = 'ko' | 'ja';

interface LanguageContextType {
    language: Language;
    changeLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
    children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
    const { i18n } = useTranslation();
    const [language, setLanguage] = useState<Language>(() => {
        // localStorage에서 저장된 언어 불러오기, 없으면 일본어 기본값
        const savedLang = localStorage.getItem('language') as Language;
        return savedLang || 'ja';
    });

    useEffect(() => {
        // 언어 변경 시 i18n과 localStorage 업데이트
        i18n.changeLanguage(language);
        localStorage.setItem('language', language);
    }, [language, i18n]);

    const changeLanguage = (lang: Language) => {
        setLanguage(lang);
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
