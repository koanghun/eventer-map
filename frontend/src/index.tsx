import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import './i18n/config'; // i18n 초기화


const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

// 개발 환경에서만 StrictMode 적용 (InfoWindow 중복 이슈 있지만 개발 도구로 유용)
// 프로덕션에서는 자동으로 비활성화
root.render(
    process.env.NODE_ENV === 'development' ? (
        <React.StrictMode>
            <App />
        </React.StrictMode>
    ) : (
        <App />
    )
);
