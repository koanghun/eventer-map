import { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import LoginButton from '../common/LoginButton';
import XLoginButton from '../common/XLoginButton';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../store/useToastStore';
import { useTranslation } from 'react-i18next';
import { useGoogleLogin } from '@react-oauth/google';
import { postAuthXAuthorize } from '../../api/generated/auth/auth';
import { startXOAuthFlow, XOAuthCancelledError, XOAuthRedirectStartedError } from '../../lib/xOAuth';

interface AuthPanelProps {
    onClose: () => void;
}

type AuthView = 'login' | 'signup' | 'verifyEmail' | 'findId' | 'findPassword';

export default function AuthPanel({ onClose }: AuthPanelProps) {
    const { login, signup, verifyEmail, resendVerification, googleLogin: contextGoogleLogin, xLogin: contextXLogin } = useAuth();
    const { t } = useTranslation();
    const [view, setView] = useState<AuthView>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Signup-specific fields
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
    const [signupNickname, setSignupNickname] = useState('');
    const [verificationCode, setVerificationCode] = useState('');

    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                await contextGoogleLogin(tokenResponse.access_token);
                onClose();
            } catch (err: any) {
                toast.apiError(err, t('auth.loginFailed', '로그인에 실패했습니다.'));
            }
        },
        onError: () => {
            toast.error(t('auth.loginFailed', '로그인에 실패했습니다.'));
        }
    });

    const handleXLogin = async () => {
        setIsSubmitting(true);
        try {
            const { code, state } = await startXOAuthFlow('login', async () => {
                const res = await postAuthXAuthorize();
                return res.authorizeUrl;
            });
            await contextXLogin(code, state);
            onClose();
        } catch (err: any) {
            if (err instanceof XOAuthCancelledError || err instanceof XOAuthRedirectStartedError) {
                return;
            }
            toast.apiError(err, t('auth.loginFailed', '로그인에 실패했습니다.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderSocialDividerAndButtons = () => (
        <>
            <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink-0 mx-4 text-xs text-muted-foreground">{t('auth.or', 'or')}</span>
                <div className="flex-grow border-t border-border"></div>
            </div>

            <div className="flex flex-col gap-2 w-full">
                <LoginButton onClick={() => googleLogin()} disabled={isSubmitting} className="w-full" />
                <XLoginButton onClick={handleXLogin} disabled={isSubmitting} className="w-full" />
            </div>
        </>
    );

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        setIsSubmitting(true);
        try {
            await login(email, password);
            onClose();
        } catch (err: any) {
            if (err?.response?.status === 403) {
                // Email not verified yet: send a fresh code and move to verification.
                setSignupEmail(email);
                setVerificationCode('');
                try {
                    await resendVerification(email);
                } catch (resendErr: any) {
                    if (resendErr?.response?.status !== 429) {
                        toast.apiError(resendErr, t('auth.resendFailed', '인증 코드 전송에 실패했습니다.'));
                    }
                }
                setView('verifyEmail');
            } else {
                toast.apiError(err, t('auth.loginFailed', '로그인에 실패했습니다.'));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResend = async () => {
        setIsSubmitting(true);
        try {
            await resendVerification(signupEmail);
        } catch (err: any) {
            toast.apiError(err, t('auth.resendFailed', '인증 코드 전송에 실패했습니다.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (signupPassword !== signupPasswordConfirm) {
            toast.error(t('auth.passwordMismatch', '비밀번호가 일치하지 않습니다.'));
            return;
        }
        if (!signupEmail || !signupPassword || !signupNickname) return;
        setIsSubmitting(true);
        try {
            await signup(signupEmail, signupPassword, signupNickname);
            setView('verifyEmail');
        } catch (err: any) {
            toast.apiError(err, t('auth.signupFailed', '회원가입에 실패했습니다.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!verificationCode) return;
        setIsSubmitting(true);
        try {
            await verifyEmail(signupEmail, verificationCode);
            onClose();
        } catch (err: any) {
            toast.apiError(err, t('auth.verifyFailed', '이메일 인증에 실패했습니다.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderLoginForm = () => (
        <>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="auth-id" className="text-xs font-bold text-muted-foreground">{t('auth.idLabel', 'ID (Email)')}</Label>
                    <Input 
                        id="auth-id" 
                        type="email" 
                        placeholder="example@email.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-background border-input" 
                        disabled={isSubmitting}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="auth-pw" className="text-xs font-bold text-muted-foreground">{t('auth.passwordLabel', 'Password')}</Label>
                    <Input 
                        id="auth-pw" 
                        type="password" 
                        placeholder="••••••••" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-background border-input" 
                        disabled={isSubmitting}
                    />
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                    {t('auth.login', 'Login')}
                </Button>
            </form>

            {renderSocialDividerAndButtons()}

            <div className="flex items-center justify-center gap-4 text-xs font-medium mt-2">
                <button onClick={() => setView('signup')} className="text-muted-foreground hover:text-primary transition-colors">{t('auth.signup', 'Sign up')}</button>
                <span className="text-border">|</span>
                <button onClick={() => setView('findId')} className="text-muted-foreground hover:text-primary transition-colors">{t('auth.findId', 'Find ID')}</button>
                <span className="text-border">|</span>
                <button onClick={() => setView('findPassword')} className="text-muted-foreground hover:text-primary transition-colors">{t('auth.findPassword', 'Find Password')}</button>
            </div>
        </>
    );

    const renderSignupForm = () => (
        <form className="flex flex-col gap-4" onSubmit={handleSignup}>
            <h3 className="font-bold text-lg text-primary text-center mb-2">{t('auth.signup', 'Sign up')}</h3>
            <div className="space-y-1.5">
                <Label htmlFor="signup-email" className="text-xs font-bold text-muted-foreground">{t('auth.emailLabel', 'Email')}</Label>
                <Input id="signup-email" type="email" placeholder="example@email.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} className="bg-background border-input" disabled={isSubmitting} />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="signup-pw" className="text-xs font-bold text-muted-foreground">{t('auth.passwordLabel', 'Password')}</Label>
                <Input id="signup-pw" type="password" placeholder={t('auth.passwordPlaceholder', '8+ chars (letters & numbers)')} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} className="bg-background border-input" disabled={isSubmitting} />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="signup-pw-confirm" className="text-xs font-bold text-muted-foreground">{t('auth.passwordConfirmLabel', 'Confirm Password')}</Label>
                <Input id="signup-pw-confirm" type="password" placeholder="••••••••" value={signupPasswordConfirm} onChange={(e) => setSignupPasswordConfirm(e.target.value)} className="bg-background border-input" disabled={isSubmitting} />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="signup-nickname" className="text-xs font-bold text-muted-foreground">{t('auth.nicknameLabel', 'Nickname')}</Label>
                <Input id="signup-nickname" type="text" placeholder={t('auth.nicknamePlaceholder', 'Nickname')} value={signupNickname} onChange={(e) => setSignupNickname(e.target.value)} className="bg-background border-input" disabled={isSubmitting} />
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t('auth.signupSubmit', 'Sign up')}
            </Button>
            {renderSocialDividerAndButtons()}
            <Button type="button" variant="ghost" onClick={() => setView('login')} className="w-full text-xs text-muted-foreground mt-2">
                {t('auth.backToLogin', 'Back to Login')}
            </Button>
        </form>
    );

    const renderVerifyEmailForm = () => (
        <form className="flex flex-col gap-4" onSubmit={handleVerifyEmail}>
            <h3 className="font-bold text-lg text-primary text-center mb-2">{t('auth.verifyEmailTitle', 'Verify Email')}</h3>
            <p className="text-xs text-muted-foreground text-center mb-2">
                {t('auth.verifyEmailDesc1', 'Sent to', { email: signupEmail })}<br />{t('auth.verifyEmailDesc2', 'Please enter the 6-digit code.')}
            </p>
            <div className="space-y-1.5">
                <Label htmlFor="verify-code" className="text-xs font-bold text-muted-foreground">{t('auth.verifyCodeLabel', 'Verification Code')}</Label>
                <Input 
                    id="verify-code" 
                    type="text" 
                    placeholder={t('auth.verifyCodePlaceholder', '6-digit code')}
                    value={verificationCode} 
                    onChange={(e) => setVerificationCode(e.target.value)} 
                    className="bg-background border-input text-center tracking-widest" 
                    maxLength={6}
                    disabled={isSubmitting} 
                />
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {t('auth.verifySubmit', 'Verify')}
            </Button>
            <Button type="button" variant="ghost" onClick={handleResend} disabled={isSubmitting} className="w-full text-xs text-muted-foreground">
                {t('auth.resendCode', 'Resend code')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setView('login')} className="w-full text-xs text-muted-foreground">
                {t('auth.backToLogin', 'Back to Login')}
            </Button>
        </form>
    );

    const renderFindIdForm = () => (
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <h3 className="font-bold text-lg text-primary text-center mb-2">{t('auth.findId', 'Find ID')}</h3>
            <p className="text-xs text-muted-foreground text-center mb-2">{t('auth.findIdDesc', 'Enter the nickname you used to sign up.')}</p>
            <div className="space-y-1.5">
                <Label htmlFor="findid-nickname" className="text-xs font-bold text-muted-foreground">{t('auth.nicknameLabel', 'Nickname')}</Label>
                <Input id="findid-nickname" type="text" placeholder={t('auth.nicknamePlaceholder', 'Nickname')} className="bg-background border-input" />
            </div>
            <Button type="submit" className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                {t('auth.findId', 'Find ID')}
            </Button>
            <Button variant="ghost" onClick={() => setView('login')} className="w-full text-xs text-muted-foreground mt-2">
                {t('auth.backToLogin', 'Back to Login')}
            </Button>
        </form>
    );

    const renderFindPasswordForm = () => (
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <h3 className="font-bold text-lg text-primary text-center mb-2">{t('auth.findPassword', 'Find Password')}</h3>
            <p className="text-xs text-muted-foreground text-center mb-2">{t('auth.findPwDesc1', 'Enter your registered email.')}<br/>{t('auth.findPwDesc2', 'We will send a password reset link.')}</p>
            <div className="space-y-1.5">
                <Label htmlFor="findpw-email" className="text-xs font-bold text-muted-foreground">{t('auth.emailLabel', 'Email')}</Label>
                <Input id="findpw-email" type="email" placeholder="example@email.com" className="bg-background border-input" />
            </div>
            <Button type="submit" className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                {t('auth.sendResetLink', 'Send Reset Link')}
            </Button>
            <Button variant="ghost" onClick={() => setView('login')} className="w-full text-xs text-muted-foreground mt-2">
                {t('auth.backToLogin', 'Back to Login')}
            </Button>
        </form>
    );

    return (
        <div className="flex flex-col">
            {view === 'login' && renderLoginForm()}
            {view === 'signup' && renderSignupForm()}
            {view === 'verifyEmail' && renderVerifyEmailForm()}
            {view === 'findId' && renderFindIdForm()}
            {view === 'findPassword' && renderFindPasswordForm()}
        </div>
    );
}
