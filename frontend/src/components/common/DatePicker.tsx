import { useTranslation } from 'react-i18next';
import { Label } from '../ui/label';

interface DatePickerProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
}

function DatePicker({ startDate, endDate, onStartDateChange, onEndDateChange }: DatePickerProps) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-2 mb-5">
            <Label htmlFor="date" className="text-primary font-bold text-base">
                📅 {t('datePicker.label')}
            </Label>
            <div className="flex items-center gap-2 border border-input bg-background px-3 py-2 rounded-md shadow-sm focus-within:ring-2 focus-within:ring-primary/50 transition-all text-sm w-full">
                <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    className="bg-transparent outline-none flex-1 min-w-0 cursor-pointer text-foreground appearance-none"
                    style={{ colorScheme: "dark light" }}
                />
                <span className="text-muted-foreground font-bold shrink-0">~</span>
                <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    className="bg-transparent outline-none flex-1 min-w-0 cursor-pointer text-foreground appearance-none"
                    style={{ colorScheme: "dark light" }}
                />
            </div>
        </div>
    );
}

export default DatePicker;
