import { useTranslation } from 'react-i18next';
import { useDailyVisitCounter } from '../hooks/useDailyVisitCounter';
import styles from './DailyVisitCounter.module.css';

export default function DailyVisitCounter() {
    const { t } = useTranslation();
    const visitCount = useDailyVisitCounter();

    return (
        <div className={styles.dailyVisitCounter}>
            {t('footer.dailyVisits')}: {visitCount}
        </div>
    );
}
