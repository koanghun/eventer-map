import React from 'react';
import './DatePicker.css';

interface DatePickerProps {
    selectedDate: string;
    onDateChange: (date: string) => void;
}

const DatePicker: React.FC<DatePickerProps> = ({ selectedDate, onDateChange }) => {
    return (
        <div className="date-picker">
            <label htmlFor="date">📅 날짜 선택</label>
            <input
                type="date"
                id="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="date-input"
            />
        </div>
    );
};

export default DatePicker;
