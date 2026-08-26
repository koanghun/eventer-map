import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { LogOut, LayoutDashboard } from 'lucide-react';

export default function UserProfile() {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    if (!user) return null;

    const handleManageReports = () => {
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <button className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-primary overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all focus:outline-none">
                        {user.profile_image ? (
                            <img src={user.profile_image} alt={user.name || user.email} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                                {(user.name?.[0] || user.email[0]).toUpperCase()}
                            </div>
                        )}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 bg-popover text-popover-foreground border border-border shadow-md rounded-lg mt-2" align="end">
                    <div className="flex flex-col gap-4 p-2">
                        <div className="flex flex-col space-y-1 pb-3 border-b border-border">
                            <p className="font-semibold text-sm leading-none">{user.name || user.email}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                            {user.is_admin && (
                                <Button variant="ghost" className="w-full justify-start text-sm h-9" onClick={handleManageReports}>
                                    <LayoutDashboard className="mr-2 h-4 w-4" />
                                    {t('admin.manageReports')}
                                </Button>
                            )}
                            <Button variant="ghost" className="w-full justify-start text-sm h-9 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={logout}>
                                <LogOut className="mr-2 h-4 w-4" />
                                {t('auth.logout')}
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>

        </div>
    );
}
