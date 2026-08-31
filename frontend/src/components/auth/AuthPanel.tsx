import { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import LoginButton from '../common/LoginButton';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../store/useToastStore';

interface AuthPanelProps {
    onClose: () => void;
}

type AuthView = 'login' | 'signup' | 'findId' | 'findPassword';

export default function AuthPanel({ onClose }: AuthPanelProps) {
    const { login, signup } = useAuth();
    const [view, setView] = useState<AuthView>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Signup-specific fields
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
    const [signupNickname, setSignupNickname] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        setIsSubmitting(true);
        try {
            await login(email, password);
            onClose();
        } catch (err: any) {
            const msg = err?.response?.data?.error || '로그인에 실패했습니다.';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (signupPassword !== signupPasswordConfirm) {
            toast.error('비밀번호가 일치하지 않습니다.');
            return;
        }
        if (!signupEmail || !signupPassword || !signupNickname) return;
        setIsSubmitting(true);
        try {
            await signup(signupEmail, signupPassword, signupNickname);
            onClose();
        } catch (err: any) {
            const msg = err?.response?.data?.error || '회원가입에 실패했습니다.';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderLoginForm = () => (
        <>
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="auth-id" className="text-xs font-bold text-muted-foreground">아이디 (이메일)</Label>
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
                    <Label htmlFor="auth-pw" className="text-xs font-bold text-muted-foreground">비밀번호</Label>
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
                    로그인
                </Button>
            </form>

            <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink-0 mx-4 text-xs text-muted-foreground">또는</span>
                <div className="flex-grow border-t border-border"></div>
            </div>

            <div className="flex justify-center w-full">
                <LoginButton onClick={() => {
                    const apiBase = process.env.REACT_APP_API_URL;
                    if (apiBase) {
                        window.location.href = `${apiBase}/auth/google/login`;
                    } else {
                        window.location.href = `/api/auth/google/login`;
                    }
                }} />
            </div>

            <div className="flex items-center justify-center gap-4 text-xs font-medium mt-2">
                <button onClick={() => setView('signup')} className="text-muted-foreground hover:text-primary transition-colors">회원가입</button>
                <span className="text-border">|</span>
                <button onClick={() => setView('findId')} className="text-muted-foreground hover:text-primary transition-colors">아이디 찾기</button>
                <span className="text-border">|</span>
                <button onClick={() => setView('findPassword')} className="text-muted-foreground hover:text-primary transition-colors">비밀번호 찾기</button>
            </div>
        </>
    );

    const renderSignupForm = () => (
        <form className="flex flex-col gap-4" onSubmit={handleSignup}>
            <h3 className="font-bold text-lg text-primary text-center mb-2">회원가입</h3>
            <div className="space-y-1.5">
                <Label htmlFor="signup-email" className="text-xs font-bold text-muted-foreground">이메일</Label>
                <Input id="signup-email" type="email" placeholder="example@email.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} className="bg-background border-input" disabled={isSubmitting} />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="signup-pw" className="text-xs font-bold text-muted-foreground">비밀번호</Label>
                <Input id="signup-pw" type="password" placeholder="영문+숫자 8자 이상" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} className="bg-background border-input" disabled={isSubmitting} />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="signup-pw-confirm" className="text-xs font-bold text-muted-foreground">비밀번호 확인</Label>
                <Input id="signup-pw-confirm" type="password" placeholder="••••••••" value={signupPasswordConfirm} onChange={(e) => setSignupPasswordConfirm(e.target.value)} className="bg-background border-input" disabled={isSubmitting} />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="signup-nickname" className="text-xs font-bold text-muted-foreground">닉네임</Label>
                <Input id="signup-nickname" type="text" placeholder="닉네임" value={signupNickname} onChange={(e) => setSignupNickname(e.target.value)} className="bg-background border-input" disabled={isSubmitting} />
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                가입하기
            </Button>
            <Button variant="ghost" onClick={() => setView('login')} className="w-full text-xs text-muted-foreground mt-2">
                로그인 화면으로 돌아가기
            </Button>
        </form>
    );

    const renderFindIdForm = () => (
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <h3 className="font-bold text-lg text-primary text-center mb-2">아이디 찾기</h3>
            <p className="text-xs text-muted-foreground text-center mb-2">가입 시 사용한 닉네임을 입력해주세요.</p>
            <div className="space-y-1.5">
                <Label htmlFor="findid-nickname" className="text-xs font-bold text-muted-foreground">닉네임</Label>
                <Input id="findid-nickname" type="text" placeholder="닉네임" className="bg-background border-input" />
            </div>
            <Button type="submit" className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                아이디 찾기
            </Button>
            <Button variant="ghost" onClick={() => setView('login')} className="w-full text-xs text-muted-foreground mt-2">
                로그인 화면으로 돌아가기
            </Button>
        </form>
    );

    const renderFindPasswordForm = () => (
        <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <h3 className="font-bold text-lg text-primary text-center mb-2">비밀번호 찾기</h3>
            <p className="text-xs text-muted-foreground text-center mb-2">가입 시 등록한 이메일 주소를 입력해주세요.<br/>비밀번호 재설정 링크를 보내드립니다.</p>
            <div className="space-y-1.5">
                <Label htmlFor="findpw-email" className="text-xs font-bold text-muted-foreground">이메일</Label>
                <Input id="findpw-email" type="email" placeholder="example@email.com" className="bg-background border-input" />
            </div>
            <Button type="submit" className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                재설정 링크 전송
            </Button>
            <Button variant="ghost" onClick={() => setView('login')} className="w-full text-xs text-muted-foreground mt-2">
                로그인 화면으로 돌아가기
            </Button>
        </form>
    );

    return (
        <div className="absolute top-[73px] right-0 md:right-8 w-full md:w-[350px] bg-card border-b md:border md:border-t-0 border-border md:rounded-b-xl shadow-xl z-50 animate-in slide-in-from-top-4 duration-300">
            <div className="p-6 flex flex-col">
                {view === 'login' && renderLoginForm()}
                {view === 'signup' && renderSignupForm()}
                {view === 'findId' && renderFindIdForm()}
                {view === 'findPassword' && renderFindPasswordForm()}
            </div>
        </div>
    );
}
