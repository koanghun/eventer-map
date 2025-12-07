import { useTranslation } from 'react-i18next';
import './DatePicker.css';

interface DatePickerProps {
    selectedDate: string;
    onDateChange: (date: string) => void;
}

function DatePicker({ selectedDate, onDateChange }: DatePickerProps) {
    const { t } = useTranslation();

    return (
        <div className="date-picker">
            <label htmlFor="date">📅 {t('datePicker.label')}</label>
            <input
                type="date"
                id="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="date-input"
            />
        </div>
    );
}

export default DatePicker;
