import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { toast } from '../store/useToastStore';
import { postUsersMeLinkX, postUsersMeReauthX } from '../api/generated/user/user';
import {
    X_OAUTH_CHANNEL,
    XOAuthBroadcastMessage,
    consumePendingXOAuth,
    peekPendingXOAuth,
} from '../lib/xOAuth';

// Deduplicate StrictMode double-mounts per callback state+code/error.
const startedCallbacks = new Set<string>();

export default function XOAuthCallbackPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { isAuthenticated, isLoading, xLogin, refreshUser, deleteAccount } = useAuth();
    const [statusMessage, setStatusMessage] = useState<string>(
        t('auth.processingXLogin', 'X 인증을 처리하고 있습니다...')
    );
    const [showHomeButton, setShowHomeButton] = useState(false);

    const code = searchParams.get('code') || '';
    const state = searchParams.get('state') || '';
    const oauthError = searchParams.get('error') || '';
    const oauthErrorDesc = searchParams.get('error_description') || '';

    useEffect(() => {
        const pendingPeek = peekPendingXOAuth();

        // Wait for AuthContext session restoration only in redirect-fallback link/reauth flows.
        if (pendingPeek && (pendingPeek.mode === 'link' || pendingPeek.mode === 'reauth') && isLoading) {
            return;
        }

        const dedupKey = `${state}:${code || oauthError}`;
        if (startedCallbacks.has(dedupKey)) {
            return;
        }
        startedCallbacks.add(dedupKey);

        const handleRedirectFallback = async () => {
            const pending = consumePendingXOAuth();
            if (!pending) {
                setStatusMessage(t('auth.xCallbackCloseHint', '인증 창을 닫고 원래 화면으로 돌아가 주세요.'));
                setShowHomeButton(true);
                return;
            }

            if (oauthError) {
                if (oauthError !== 'access_denied') {
                    toast.error(oauthErrorDesc || t('auth.xAuthFailed', 'X 인증에 실패했습니다.'));
                }
                navigate('/', { replace: true });
                return;
            }

            if (!code || !state || pending.state !== state) {
                toast.error(t('errors.api.X_OAUTH_STATE_INVALID', 'X 인증 세션이 만료되었거나 올바르지 않습니다.'));
                navigate('/', { replace: true });
                return;
            }

            try {
                if (pending.mode === 'login') {
                    await xLogin(code, state);
                } else if (pending.mode === 'link') {
                    if (!isAuthenticated) {
                        toast.error(t('auth.loginRequired', '로그인이 필요합니다'));
                        navigate('/', { replace: true });
                        return;
                    }
                    await postUsersMeLinkX({ code, state });
                    await refreshUser();
                    toast.success(t('profile.xLinked', 'X 계정이 연동되었습니다.'));
                } else if (pending.mode === 'reauth') {
                    if (!isAuthenticated) {
                        toast.error(t('auth.loginRequired', '로그인이 필요합니다'));
                        navigate('/', { replace: true });
                        return;
                    }
                    const { xReauthToken } = await postUsersMeReauthX({ code, state });
                    await deleteAccount(undefined, undefined, xReauthToken);
                }
            } catch (err: any) {
                const fallback =
                    pending.mode === 'link'
                        ? t('profile.xLinkFailed', 'X 계정 연동에 실패했습니다.')
                        : pending.mode === 'reauth'
                          ? t('profile.deleteAccountFailed', '회원 탈퇴에 실패했습니다.')
                          : t('auth.loginFailed', '로그인에 실패했습니다.');
                toast.apiError(err, fallback);
            } finally {
                navigate('/', { replace: true });
            }
        };

        // Case A: Redirect fallback in the same tab (sessionStorage carries pending state).
        if (pendingPeek) {
            void handleRedirectFallback();
            return;
        }

        // Case B: Popup mode -> send result via BroadcastChannel and wait briefly for parent ACK.
        if (typeof BroadcastChannel !== 'undefined' && state) {
            const channel = new BroadcastChannel(X_OAUTH_CHANNEL);
            let acked = false;

            const ackTimer = setTimeout(() => {
                channel.close();
                if (!acked) {
                    setStatusMessage(t('auth.xCallbackCloseHint', '인증 창을 닫고 원래 화면으로 돌아가 주세요.'));
                    setShowHomeButton(true);
                }
            }, 600);

            channel.onmessage = (event: MessageEvent<XOAuthBroadcastMessage>) => {
                if (event.data?.type === 'x-oauth-ack' && event.data.state === state) {
                    acked = true;
                    clearTimeout(ackTimer);
                    channel.close();
                    setStatusMessage(t('auth.xCallbackComplete', '인증이 완료되었습니다. 창이 닫히지 않으면 직접 닫아주세요.'));
                    setShowHomeButton(true);
                    window.close();
                }
            };

            channel.postMessage({
                type: 'x-oauth-callback',
                state,
                ...(code ? { code } : {}),
                ...(oauthError ? { error: oauthError } : {}),
                ...(oauthErrorDesc ? { errorDescription: oauthErrorDesc } : {}),
            } satisfies XOAuthBroadcastMessage);
            return;
        }

        setStatusMessage(t('auth.xCallbackCloseHint', '인증 창을 닫고 원래 화면으로 돌아가 주세요.'));
        setShowHomeButton(true);
    }, [code, deleteAccount, isAuthenticated, isLoading, navigate, oauthError, oauthErrorDesc, refreshUser, state, t, xLogin]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
            <div className="max-w-sm w-full flex flex-col items-center text-center gap-4 p-6 rounded-2xl border border-border bg-card shadow-lg">
                {!showHomeButton && <Loader2 className="w-8 h-8 animate-spin text-primary" />}
                <p className="text-sm font-medium text-foreground">{statusMessage}</p>
                {showHomeButton && (
                    <Button variant="outline" size="sm" onClick={() => navigate('/', { replace: true })}>
                        {t('auth.backToHome', '홈으로 이동')}
                    </Button>
                )}
            </div>
        </div>
    );
}

