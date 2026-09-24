import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { toast } from '../../store/useToastStore';
import { User, Mail, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { usePatchUsersMe, usePutUsersMePassword, usePostUsersMeLinkGoogle } from '../../api/generated/user/user';
import { useGoogleLogin } from '@react-oauth/google';

interface ProfileSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProfileSettingsModal({ isOpen, onClose }: ProfileSettingsModalProps) {
    const { t } = useTranslation();
    const { user, refreshUser } = useAuth();
    // Let's just refresh page on profile update or leave it if AuthContext re-fetches
    const { mutateAsync: updateProfile } = usePatchUsersMe();
    const { mutateAsync: updatePassword } = usePutUsersMePassword();
    
    const [nickname, setNickname] = useState(user?.displayName || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [isSubmitting, setIsSubmitting] = useState(false);

    const linkGoogleMutation = usePostUsersMeLinkGoogle();

    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                await linkGoogleMutation.mutateAsync({
                    data: { idToken: tokenResponse.access_token }
                });
                await refreshUser();
                toast.success(t('profile.googleLinked', '구글 계정이 연동되었습니다.'));
            } catch (error: any) {
                const msg = error?.response?.data?.error || t('profile.googleLinkFailed', '구글 계정 연동에 실패했습니다.');
                toast.error(msg);
            }
        },
        onError: () => {
            toast.error(t('profile.googleLinkFailed', '구글 계정 연동에 실패했습니다.'));
        }
    });

    if (!user) return null;

    const isGoogleLinked = user?.isGoogleLinked || false;

    const handleSaveProfile = async () => {
        setIsSubmitting(true);
        try {
            await updateProfile({ data: { displayName: nickname } });
            toast.success(t('profile.updateSuccess', '회원정보가 수정되었습니다.'));
            // Optionally reload to fetch new profile data
            window.location.reload();
        } catch (error) {
            toast.error(t('profile.updateFailed', '회원정보 수정에 실패했습니다.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            toast.error(t('profile.passwordMismatch', '새 비밀번호가 일치하지 않습니다.'));
            return;
        }
        setIsSubmitting(true);
        try {
            await updatePassword({ data: { currentPassword, newPassword } });
            toast.success(t('profile.passwordChangeSuccess', '비밀번호가 변경되었습니다.'));
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            const msg = error?.response?.data?.error || t('profile.passwordChangeFailed', '비밀번호 변경에 실패했습니다.');
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleLink = () => {
        googleLogin();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px] bg-background text-foreground max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <User className="w-5 h-5" />
                        {t('profile.editTitle', '회원정보 수정')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('profile.editDescription', '프로필 및 계정 설정을 변경할 수 있습니다.')}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Basic Info Section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold border-b pb-2">{t('profile.basicInfo', '기본 정보')}</h4>
                        
                        <div className="space-y-2">
                            <Label htmlFor="email" className="flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                {t('auth.email', 'Email')}
                            </Label>
                            <Input
                                id="email"
                                value={user.email || ''}
                                disabled
                                className="bg-muted/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="nickname" className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                {t('auth.nickname', 'Nickname')}
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="nickname"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                />
                                <Button 
                                    onClick={handleSaveProfile} 
                                    disabled={isSubmitting || nickname === user.displayName}
                                >
                                    {t('common.save', '저장')}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Password Section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                            <Lock className="w-4 h-4" />
                            {t('profile.changePassword', '비밀번호 변경')}
                        </h4>
                        
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="current-password">{t('profile.currentPassword', '현재 비밀번호')}</Label>
                                <Input
                                    id="current-password"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-password">{t('profile.newPassword', '새 비밀번호')}</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">{t('profile.confirmPassword', '새 비밀번호 확인')}</Label>
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                            <Button 
                                className="w-full"
                                variant="outline"
                                onClick={handleChangePassword}
                                disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
                            >
                                {t('profile.updatePassword', '비밀번호 변경하기')}
                            </Button>
                        </div>
                    </div>

                    {/* Linked Accounts Section */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold border-b pb-2">{t('profile.linkedAccounts', '연동된 계정')}</h4>
                        
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center p-1 border">
                                    <svg viewBox="0 0 24 24" className="w-full h-full">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                    </svg>
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-medium text-sm">Google</span>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        {isGoogleLinked ? (
                                            <><CheckCircle className="w-3 h-3 text-green-500" /> {t('profile.connected', '연동됨')}</>
                                        ) : (
                                            <><AlertCircle className="w-3 h-3 text-yellow-500" /> {t('profile.notConnected', '연동 안됨')}</>
                                        )}
                                    </span>
                                </div>
                            </div>
                            <Button
                                variant={isGoogleLinked ? "outline" : "default"}
                                size="sm"
                                onClick={handleGoogleLink}
                            >
                                {isGoogleLinked ? t('profile.disconnect', '해제') : t('profile.connect', '연동하기')}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
