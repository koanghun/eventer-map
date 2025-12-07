import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import ja from './locales/ja.json';

i18n
    .use(initReactI18next)
    .init({
        resources: {
            ko: { translation: ko },
            ja: { translation: ja },
        },
        lng: 'ja', // 기본 언어: 일본어
        fallbackLng: 'ja',
        interpolation: {
            escapeValue: false, // React는 XSS를 자동으로 방지
        },
    });

export default i18n;
