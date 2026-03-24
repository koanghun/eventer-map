import { useTranslation } from 'react-i18next';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface DatePickerProps {
    selectedDate: string;
    onDateChange: (date: string) => void;
}

function DatePicker({ selectedDate, onDateChange }: DatePickerProps) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-2 mb-5">
            <Label htmlFor="date" className="text-primary font-bold text-base">
                📅 {t('datePicker.label')}
            </Label>
            <Input
                type="date"
                id="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-full cursor-pointer focus-visible:ring-primary focus-visible:ring-offset-2 transition-all"
            />
        </div>
    );
}

export default DatePicker;
