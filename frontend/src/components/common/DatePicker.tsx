import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { addMonths, addWeeks, format, parseISO, isValid } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { DateRange, DayButton, DayEventHandler, Modifiers } from 'react-day-picker';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Calendar, CalendarDayButton } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Label } from '../ui/label';

interface DatePickerProps {
    startDate: string;
    endDate: string;
    onDateChange: (start: string, end: string) => void;
    onClearDate?: () => void;
    allDatesLabel?: string;
    clearLabel?: string;
}

interface QuickPresetConfig {
    key: 'today' | 'oneWeek' | 'oneMonth';
    labelKey: string;
    defaultLabel: string;
    getEndDate: (baseDate: Date) => Date;
}

const QUICK_DATE_PRESETS: QuickPresetConfig[] = [
    {
        key: 'today',
        labelKey: 'datePicker.quickSearch.today',
        defaultLabel: '오늘',
        getEndDate: (baseDate) => baseDate,
    },
    {
        key: 'oneWeek',
        labelKey: 'datePicker.quickSearch.oneWeek',
        defaultLabel: '일주일 후',
        getEndDate: (baseDate) => addWeeks(baseDate, 1),
    },
    {
        key: 'oneMonth',
        labelKey: 'datePicker.quickSearch.oneMonth',
        defaultLabel: '한달 후',
        getEndDate: (baseDate) => addMonths(baseDate, 1),
    },
];

    function DatePicker({ startDate, endDate, onDateChange, onClearDate, allDatesLabel, clearLabel }: DatePickerProps) {
        const { t } = useTranslation();
        const [range, setRange] = useState<DateRange | undefined>(undefined);

        const dragRef = useRef<{
            isDragging: boolean;
            start: Date | null;
            end: Date | null;
        }>({
            isDragging: false,
            start: null,
            end: null,
        });

        useEffect(() => {
            const s = parseISO(startDate);
            const e = parseISO(endDate);
            setRange({
                from: isValid(s) ? s : undefined,
                to: isValid(e) ? e : undefined,
            });
        }, [startDate, endDate]);

        useEffect(() => {
            const handleMouseUp = () => {
                if (!dragRef.current.isDragging || !dragRef.current.start) return;

                const start = dragRef.current.start;
                const end = dragRef.current.end ?? start;
                dragRef.current = { isDragging: false, start: null, end: null };

                const from = start <= end ? start : end;
                const to = start <= end ? end : start;

                setRange({ from, to });
                onDateChange(format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd'));
            };

            window.addEventListener('mouseup', handleMouseUp);
            return () => window.removeEventListener('mouseup', handleMouseUp);
        }, [onDateChange]);

        const handleDayMouseDownRef = useRef<(date: Date, modifiers: Modifiers, e: React.MouseEvent) => void>(() => { });
        handleDayMouseDownRef.current = (date: Date, modifiers: Modifiers, e: React.MouseEvent) => {
            if (e.button !== 0 || modifiers.disabled) return;
            e.preventDefault();
            dragRef.current = {
                isDragging: true,
                start: date,
                end: date,
            };
            setRange({ from: date, to: date });
        };

        const handleDayMouseEnter: DayEventHandler<React.MouseEvent> = (date, modifiers) => {
            if (!dragRef.current.isDragging || !dragRef.current.start || modifiers.disabled) return;
            dragRef.current.end = date;
            const start = dragRef.current.start;
            const from = start <= date ? start : date;
            const to = start <= date ? date : start;
            setRange({ from, to });
        };

        const calendarComponents = useMemo(
            () => ({
                DayButton: (props: React.ComponentProps<typeof DayButton>) => (
                    <CalendarDayButton
                        {...props}
                        onMouseDown={(e) => {
                            props.onMouseDown?.(e);
                            handleDayMouseDownRef.current(props.day.date, props.modifiers, e);
                        }}
                    />
                ),
            }),
            []
        );

        const parseDate = (dStr: string) => {
            const d = parseISO(dStr);
            return isValid(d) ? d : undefined;
        };

        const sDate = parseDate(startDate);

        const buttonText =
            range?.from && range?.to
                ? format(range.from, 'yyyy-MM-dd') === format(range.to, 'yyyy-MM-dd')
                    ? format(range.from, 'yyyy-MM-dd')
                    : `${format(range.from, 'yyyy-MM-dd')} - ${format(range.to, 'yyyy-MM-dd')}`
                : range?.from
                        ? t('datePicker.fromDateOnward', {
                            date: format(range.from, 'yyyy-MM-dd'),
                            defaultValue: `${format(range.from, 'yyyy-MM-dd')} 이후`,
                        })
                        : onClearDate
                            ? allDatesLabel || t('datePicker.allDates', '전체 기간')
                            : 'Select Date';

        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');

        const handleQuickPresetClick = (preset: QuickPresetConfig) => {
            const current = new Date();
            const start = format(current, 'yyyy-MM-dd');
            const end = format(preset.getEndDate(current), 'yyyy-MM-dd');
            onDateChange(start, end);
        };

        return (
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="date" className="text-primary font-bold text-base">
                        📅 {t('datePicker.label', '날짜 선택')}
                    </Label>
                    {onClearDate && (startDate || endDate) && (
                        <button
                            type="button"
                            onClick={onClearDate}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                            <X className="w-3 h-3" />
                            {clearLabel || allDatesLabel || t('datePicker.allDates', '전체 기간')}
                        </button>
                    )}
                </div>

                <Popover>
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
                        <Calendar
                            mode="range"
                            defaultMonth={sDate}
                            selected={range}
                            onSelect={() => { }}
                            onDayMouseEnter={handleDayMouseEnter}
                            components={calendarComponents}
                        />
                    </PopoverContent>
                </Popover>

                <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label={t('datePicker.quickSearch.groupLabel', '날짜 빠른 선택')}
                >
                    {QUICK_DATE_PRESETS.map((preset) => {
                        const presetEndStr = format(preset.getEndDate(now), 'yyyy-MM-dd');
                        const isActive = startDate === todayStr && endDate === presetEndStr;

                        return (
                            <Button
                                key={preset.key}
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-pressed={isActive}
                                onClick={() => handleQuickPresetClick(preset)}
                                className={cn(
                                    'flex-1 min-w-fit h-7 px-2 text-xs font-medium transition-colors',
                                    isActive
                                        ? 'bg-primary/15 border-primary/60 text-primary font-semibold hover:bg-primary/20 hover:text-primary'
                                        : 'bg-background text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {t(preset.labelKey, preset.defaultLabel)}
                            </Button>
                        );
                    })}
                </div>
            </div>
        );
    }

    export default DatePicker;
