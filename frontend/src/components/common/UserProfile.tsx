import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { useEventStore } from '../../store/useEventStore';
import { GetEventsMyAction } from '../../api/generated/model';
import { cn } from '../../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { LogOut, LayoutDashboard, UserCog, Bookmark, UserCheck, Heart, Check } from 'lucide-react';
import ProfileSettingsModal from './ProfileSettingsModal';

export default function UserProfile() {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const clearSelection = useEventStore((state) => state.clearSelection);
    const [isOpen, setIsOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    if (!user) return null;

    const activeMyAction = location.pathname === '/' ? searchParams.get('myAction') : null;
    const isFollowingArtistsActive =
        location.pathname === '/' && searchParams.get('followingArtists') === 'true';
    const isBookmarkedActive = activeMyAction === GetEventsMyAction.bookmarked;
    const isAttendingActive = activeMyAction === GetEventsMyAction.attending;

    const handleSelectMyAction = (action: GetEventsMyAction) => {
        setIsOpen(false);
        clearSelection();

        const nextParams = new URLSearchParams(location.pathname === '/' ? location.search : '');
        const isTogglingOff = location.pathname === '/' && activeMyAction === action;

        if (isTogglingOff) {
            nextParams.delete('myAction');
            nextParams.delete('followingArtists');
            nextParams.delete('newEventsSince');
            nextParams.delete('start');
            nextParams.delete('end');
        } else {
            nextParams.set('myAction', action);
            nextParams.delete('followingArtists');
            nextParams.delete('newEventsSince');
            nextParams.delete('artistId');
            nextParams.delete('artistName');
            nextParams.delete('venueId');
            nextParams.delete('venueName');
            nextParams.delete('start');
            nextParams.delete('end');
        }

        const query = nextParams.toString();
        navigate(query ? `/?${query}` : '/', { replace: location.pathname === '/' });
    };

    const handleSelectFollowingArtists = () => {
        setIsOpen(false);
        clearSelection();

        const nextParams = new URLSearchParams(location.pathname === '/' ? location.search : '');

        if (isFollowingArtistsActive) {
            nextParams.delete('followingArtists');
            nextParams.delete('newEventsSince');
            nextParams.delete('start');
            nextParams.delete('end');
        } else {
            nextParams.set('followingArtists', 'true');
            nextParams.delete('newEventsSince');
            nextParams.delete('myAction');
            nextParams.delete('artistId');
            nextParams.delete('artistName');
            nextParams.delete('venueId');
            nextParams.delete('venueName');
            if (!nextParams.get('start')) {
                nextParams.set('start', format(new Date(), 'yyyy-MM-dd'));
            }
            nextParams.delete('end');
        }

        const query = nextParams.toString();
        navigate(query ? `/?${query}` : '/', { replace: location.pathname === '/' });
    };

    const handleManageReports = () => {
        setIsOpen(false);
    };

    const handleOpenSettings = () => {
        setIsOpen(false);
        setIsSettingsOpen(true);
    };

    const handleLogout = async () => {
        setIsOpen(false);
        await logout();
    };

    return (
        <div className="relative">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <button className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-primary overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all focus:outline-none">
                        {(user as any).profile_image ? (
                            <img src={(user as any).profile_image} alt={user.displayName || user.email || (user.xUsername ? `@${user.xUsername}` : undefined)} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                                {(user.displayName?.[0] || user.email?.[0] || '?').toUpperCase()}
                            </div>
                        )}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 bg-popover text-popover-foreground border border-border shadow-xl rounded-2xl mt-2" align="end">
                    <div className="flex flex-col gap-3 p-2">
                        <div className="flex flex-col space-y-1 pb-3 border-b border-border">
                            <p className="font-semibold text-sm leading-none">{user.displayName || user.email || (user.xUsername ? `@${user.xUsername}` : '')}</p>
                            <p className="text-xs text-muted-foreground">{user?.email || (user?.xUsername ? `@${user.xUsername}` : '')}</p>
                        </div>


                        <div className="flex flex-col gap-1 pb-2 border-b border-border">
                            <Button
                                variant="ghost"
                                className={cn(
                                    'w-full justify-start text-sm h-9 px-2 text-foreground',
                                    isBookmarkedActive && 'bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold hover:bg-amber-500/15'
                                )}
                                onClick={() => handleSelectMyAction(GetEventsMyAction.bookmarked)}
                            >
                                <Bookmark className={cn('mr-2 h-4 w-4', isBookmarkedActive && 'fill-current')} />
                                <span>{t('profile.bookmarkedEvents', '북마크한 이벤트')}</span>
                                {isBookmarkedActive && <Check className="ml-auto h-4 w-4" />}
                            </Button>
                            <Button
                                variant="ghost"
                                className={cn(
                                    'w-full justify-start text-sm h-9 px-2 text-foreground',
                                    isAttendingActive && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-500/15'
                                )}
                                onClick={() => handleSelectMyAction(GetEventsMyAction.attending)}
                            >
                                <UserCheck className="mr-2 h-4 w-4" />
                                <span>{t('profile.participatedEvents', '참가한 이벤트')}</span>
                                {isAttendingActive && <Check className="ml-auto h-4 w-4" />}
                            </Button>
                            <Button
                                variant="ghost"
                                className={cn(
                                    'w-full justify-start text-sm h-9 px-2 text-foreground',
                                    isFollowingArtistsActive && 'bg-primary/10 text-primary font-semibold hover:bg-primary/15'
                                )}
                                onClick={handleSelectFollowingArtists}
                            >
                                <Heart className={cn('mr-2 h-4 w-4', isFollowingArtistsActive && 'fill-current')} />
                                <span>{t('profile.followingArtists', '팔로우한 출연자')}</span>
                                {isFollowingArtistsActive && <Check className="ml-auto h-4 w-4" />}
                            </Button>
                        </div>

                        <div className="flex flex-col gap-1">
                            <Button variant="ghost" className="w-full justify-start text-sm h-9 px-2 text-foreground" onClick={handleOpenSettings}>
                                <UserCog className="mr-2 h-4 w-4" />
                                {t('profile.editTitle', '회원정보 수정')}
                            </Button>
                            {(user as any).is_admin && (
                                <Button variant="ghost" className="w-full justify-start text-sm h-9 px-2 text-primary" onClick={handleManageReports}>
                                    <LayoutDashboard className="mr-2 h-4 w-4" />
                                    {t('common.manageReports')}
                                </Button>
                            )}
                            <Button variant="ghost" className="w-full justify-start text-sm h-9 px-2 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-500/10 dark:hover:bg-red-400/20" onClick={handleLogout}>
                                <LogOut className="mr-2 h-4 w-4" />
                                {t('auth.logout')}
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

            <ProfileSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
}
