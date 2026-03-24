import { useTranslation } from 'react-i18next';
import { useDailyVisitCounter } from '../../hooks/useDailyVisitCounter';
import { Users } from 'lucide-react';

export default function DailyVisitCounter() {
    const { t } = useTranslation();
    const visitCount = useDailyVisitCounter();

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-background/50 backdrop-blur-sm border border-border rounded-full shadow-sm text-sm font-medium text-muted-foreground mr-4">
            <Users className="w-4 h-4 text-primary" />
            <span>{t('footer.dailyVisits')}:</span>
            <span className="font-bold text-foreground">{visitCount}</span>
        </div>
    );
}
