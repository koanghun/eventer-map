import { useTranslation } from 'react-i18next';
import styles from './DatePicker.module.css';

interface DatePickerProps {
    selectedDate: string;
    onDateChange: (date: string) => void;
}

function DatePicker({ selectedDate, onDateChange }: DatePickerProps) {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <label htmlFor="date">📅 {t('datePicker.label')}</label>
            <input
                type="date"
                id="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className={styles.input}
            />
        </div>
    );
}

export default DatePicker;
