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
            login(token);
            window.location.href = '/';
        } else if (error) {
            alert(t('auth.loginFailed'));
            window.location.href = '/';
        } else {
            window.location.href = '/';
        }
    }, [login, t]);

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
