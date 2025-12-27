import { type ChangeEvent } from 'react';
import styles from './TimeInput.module.css';

interface TimeInputProps {
    id: string;
    name: string;
    value: string; // Format: "HH:MM" or ""
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

function TimeInput({ id, name, value, onChange }: TimeInputProps) {
    // Parse HH:MM format
    const [hours, minutes] = value ? value.split(':') : ['00', '00'];

    // Generate hour options (0-23)
    const hourOptions = Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, '0');
        return <option key={hour} value={hour}>{hour}</option>;
    });

    // Generate minute options (0, 5, 10, ... 55)
    const minuteOptions = Array.from({ length: 12 }, (_, i) => {
        const minute = (i * 5).toString().padStart(2, '0');
        return <option key={minute} value={minute}>{minute}</option>;
    });

    const handleHourChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const newValue = `${e.target.value}:${minutes}`;

        // Create synthetic event for compatibility with EventForm
        const syntheticEvent = {
            target: { name, value: newValue }
        } as ChangeEvent<HTMLInputElement>;

        onChange(syntheticEvent);
    };

    const handleMinuteChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const newValue = `${hours}:${e.target.value}`;

        // Create synthetic event for compatibility with EventForm
        const syntheticEvent = {
            target: { name, value: newValue }
        } as ChangeEvent<HTMLInputElement>;

        onChange(syntheticEvent);
    };

    return (
        <div className={styles.timeInput}>
            <select
                id={`${id}-hour`}
                className={styles.hourInput}
                value={hours}
                onChange={handleHourChange}
            >
                {hourOptions}
            </select>
            <span className={styles.separator}>:</span>
            <select
                id={`${id}-minute`}
                className={styles.minuteInput}
                value={minutes}
                onChange={handleMinuteChange}
            >
                {minuteOptions}
            </select>
        </div>
    );
}

export default TimeInput;
