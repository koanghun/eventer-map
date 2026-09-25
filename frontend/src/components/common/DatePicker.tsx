import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO, isValid } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Label } from '../ui/label';

interface DatePickerProps {
    startDate: string;
    endDate: string;
    onDateChange: (start: string, end: string) => void;
}

function DatePicker({ startDate, endDate, onDateChange }: DatePickerProps) {
    const { t } = useTranslation();
    const [isRange, setIsRange] = useState(startDate !== endDate);
    const [range, setRange] = useState<DateRange | undefined>(undefined);

    useEffect(() => {
        setIsRange(startDate !== endDate);
        const s = parseISO(startDate);
        const e = parseISO(endDate);
        setRange({
            from: isValid(s) ? s : undefined,
            to: isValid(e) ? e : undefined
        });
    }, [startDate, endDate]);

    const handleSelectSingle = (date: Date | undefined) => {
        if (!date) return;
        const formatted = format(date, 'yyyy-MM-dd');
        onDateChange(formatted, formatted);
    };

    const handleSelectRange = (newRange: DateRange | undefined) => {
        setRange(newRange);
        if (!newRange) return;
        
        if (newRange.from && !newRange.to) {
            // Wait for 'to' selection, or fall back to single day if popover closes
        } else if (newRange.from && newRange.to) {
            const startStr = format(newRange.from, 'yyyy-MM-dd');
            const endStr = format(newRange.to, 'yyyy-MM-dd');
            onDateChange(startStr, endStr);
        }
    };

    // If popover closes and only from is selected, apply it as single day
    const handleOpenChange = (open: boolean) => {
        if (!open && isRange && range?.from && !range.to) {
            const str = format(range.from, 'yyyy-MM-dd');
            onDateChange(str, str);
            setRange({ from: range.from, to: range.from });
        }
    };

    const toggleRange = (checked: boolean) => {
        setIsRange(checked);
        if (!checked) {
            onDateChange(startDate, startDate);
        }
    };

    const parseDate = (dStr: string) => {
        const d = parseISO(dStr);
        return isValid(d) ? d : undefined;
    };

    const sDate = parseDate(startDate);

    const buttonText = isRange 
        ? (range?.from && range?.to ? (range.from.getTime() === range.to.getTime() ? format(range.from, 'yyyy-MM-dd') : `${format(range.from, 'yyyy-MM-dd')} - ${format(range.to, 'yyyy-MM-dd')}`) : (range?.from ? format(range.from, 'yyyy-MM-dd') : 'Select Date Range'))
        : (sDate ? format(sDate, 'yyyy-MM-dd') : 'Select Date');

    return (
        <div className="flex flex-col gap-2 mb-5">
            <div className="flex items-center justify-between">
                <Label htmlFor="date" className="text-primary font-bold text-base">
                    📅 {t('datePicker.label', '날짜 선택')}
                </Label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground font-medium hover:text-foreground transition-colors">
                    <input 
                        type="checkbox" 
                        className="w-3.5 h-3.5 rounded-sm border-primary/50 text-primary focus:ring-primary accent-primary" 
                        checked={isRange} 
                        onChange={(e) => toggleRange(e.target.checked)} 
                    />
                    {t('datePicker.isRange', '기간 선택')}
                </label>
            </div>
            
            <Popover onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                            "w-full justify-start text-left font-normal border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
                            !startDate && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {buttonText}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                    {isRange ? (
                        <Calendar
                            mode="range"
                            defaultMonth={sDate}
                            selected={range}
                            onSelect={handleSelectRange}
                            numberOfMonths={2}
                        />
                    ) : (
                        <Calendar
                            mode="single"
                            defaultMonth={sDate}
                            selected={sDate}
                            onSelect={handleSelectSingle}
                        />
                    )}
                </PopoverContent>
            </Popover>
        </div>
    );
}

export default DatePicker;
