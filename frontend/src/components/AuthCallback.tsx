import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function AuthCallback() {
    const { login } = useAuth();
    const { t } = useTranslation();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const error = params.get('error');

        if (token) {
            login(token).then(() => {
                // 토큰 설정이 완료된 후 약간의 지연을 주어 모바일 기기에서의 저장소 반영 보장
                setTimeout(() => {
                    window.location.replace('/');
                }, 500);
            });
        } else if (error) {
            alert(t('auth.loginFailed'));
            window.location.replace('/');
        } else {
            window.location.replace('/');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            color: 'var(--text-primary)'
        }}>
            {t('auth.processingLogin')}...
        </div>
    );
}
