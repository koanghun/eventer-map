import React from 'react';
import { useTranslation } from 'react-i18next';
import VenueList from '../components/events/VenueList';

export default function PlacesPage() {
    const { t } = useTranslation();
    return (
        <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 w-full max-w-[2400px] mx-auto md:overflow-hidden md:h-[calc(100vh-73px)] relative overflow-x-hidden">
            <aside className={`w-full flex md:w-[20%] shrink-0 bg-card/50 backdrop-blur-sm border border-border rounded-xl shadow-md flex-col transition-all duration-500 overflow-hidden`}>
                <div className="flex-1 overflow-auto min-h-[300px]">
                    <VenueList />
                </div>
            </aside>

            <main className={`flex-1 min-h-[400px] md:min-h-0 bg-card rounded-xl border border-border overflow-hidden shadow-md relative z-0 transition-all duration-500 w-full md:w-[80%]`}>
                <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">{t('page.placesMainView', 'Places Main View')}</p>
                </div>
            </main>
        </div>
    );
}
