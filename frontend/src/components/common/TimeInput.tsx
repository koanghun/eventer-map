import { type ChangeEvent } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface TimeInputProps {
    id: string;
    name: string;
    value: string; // Format: "HH:MM" or ""
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

function TimeInput({ id, name, value, onChange }: TimeInputProps) {
    const [hours, minutes] = value ? value.split(':') : ['00', '00'];

    const handleHourChange = (newHour: string) => {
        const newValue = `${newHour}:${minutes}`;
        const syntheticEvent = {
            target: { name, value: newValue }
        } as ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
    };

    const handleMinuteChange = (newMinute: string) => {
        const newValue = `${hours}:${newMinute}`;
        const syntheticEvent = {
            target: { name, value: newValue }
        } as ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
    };

    return (
        <div className="flex items-center gap-2">
            <Select value={hours} onValueChange={handleHourChange}>
                <SelectTrigger id={`${id}-hour`} className="w-[80px] focus:ring-primary">
                    <SelectValue placeholder="HH" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                    {Array.from({ length: 24 }).map((_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return <SelectItem key={hour} value={hour}>{hour}</SelectItem>;
                    })}
                </SelectContent>
            </Select>
            <span className="font-bold text-muted-foreground">:</span>
            <Select value={minutes} onValueChange={handleMinuteChange}>
                <SelectTrigger id={`${id}-minute`} className="w-[80px] focus:ring-primary">
                    <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                    {Array.from({ length: 12 }).map((_, i) => {
                        const minute = (i * 5).toString().padStart(2, '0');
                        return <SelectItem key={minute} value={minute}>{minute}</SelectItem>;
                    })}
                </SelectContent>
            </Select>
        </div>
    );
}

export default TimeInput;
