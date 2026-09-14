import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import ArtistSearch from '../components/events/ArtistSearch';

export default function PerformersPage() {
    const { t } = useTranslation();
    const { isAuthenticated } = useAuth();
    const showNewEventButton = isAuthenticated || process.env.NODE_ENV === 'development';
    const [isFormOpen, setIsFormOpen] = useState(false);

    return (
        <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 w-full max-w-[2400px] mx-auto md:overflow-hidden md:h-[calc(100vh-73px)] relative overflow-x-hidden">
            <aside className={`w-full flex md:w-[20%] shrink-0 bg-card/50 backdrop-blur-sm border border-border rounded-xl shadow-md flex-col transition-all duration-500 overflow-hidden`}>
                <div className="p-4 flex flex-col gap-4 shrink-0">
                    <ArtistSearch />
                    {showNewEventButton && (
                        <Button className="w-full bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white shadow-md transition-all hover:-translate-y-0.5" onClick={() => setIsFormOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" /> {t('buttons.newEvent', 'New Event')}
                        </Button>
                    )}
                </div>
            </aside>

            <main className={`flex-1 min-h-[400px] md:min-h-0 bg-card rounded-xl border border-border overflow-hidden shadow-md relative z-0 transition-all duration-500 w-full md:w-[80%]`}>
                <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">{t('page.performersMainView', 'Performers Main View')}</p>
                </div>
            </main>
        </div>
    );
}
