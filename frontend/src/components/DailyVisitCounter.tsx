import { useTranslation } from 'react-i18next';
import { useDailyVisitCounter } from '../hooks/useDailyVisitCounter';
import './DailyVisitCounter.css';

export default function DailyVisitCounter() {
    const { t } = useTranslation();
    const visitCount = useDailyVisitCounter();

    return (
        <div className="daily-visit-counter">
            {t('footer.dailyVisits')}: {visitCount}
        </div>
    );
}
