import React, { useState, useRef } from 'react';
import './MultiSelect.css';

interface MultiSelectProps {
    options: { id: number; name: string }[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder: string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onChange, placeholder }) => {
    const [inputValue, setInputValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        if (!isOpen) {
            setIsOpen(true);
        }
    };

    const handleSelectOption = (optionName: string) => {
        if (!selected.includes(optionName)) {
            onChange([...selected, optionName]);
        }
        setInputValue('');
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleRemoveOption = (optionName: string) => {
        onChange(selected.filter(item => item !== optionName));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            const newOption = inputValue.trim();
            if (!selected.includes(newOption)) {
                onChange([...selected, newOption]);
            }
            setInputValue('');
        } else if (e.key === 'Backspace' && !inputValue && selected.length > 0) {
            onChange(selected.slice(0, selected.length - 1));
        }
    };

    const filteredOptions = options.filter(option =>
        option.name.toLowerCase().includes(inputValue.toLowerCase()) &&
        !selected.includes(option.name)
    );

    return (
        <div className="multiselect-container">
            <div className="selected-items">
                {selected.map(item => (
                    <div key={item} className="selected-item">
                        {item}
                        <button
                            type="button"
                            className="remove-item"
                            onClick={() => handleRemoveOption(item)}
                        >
                            &times;
                        </button>
                    </div>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                    placeholder={selected.length === 0 ? placeholder : ''}
                    className="multiselect-input"
                />
            </div>
            {isOpen && (
                <ul className="options-list">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(option => (
                            <li
                                key={option.id}
                                onMouseDown={() => handleSelectOption(option.name)}
                                className="option-item"
                            >
                                {option.name}
                            </li>
                        ))
                    ) : (
                        inputValue.trim() && (
                            <li
                                onMouseDown={() => handleSelectOption(inputValue.trim())}
                                className="option-item option-item-new"
                            >
                                '{inputValue.trim()}' 추가
                            </li>
                        )
                    )}
                </ul>
            )}
        </div>
    );
};

export default MultiSelect;
