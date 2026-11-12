import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n/config';
import DatePicker from './DatePicker';

jest.mock('../ui/calendar', () => ({
    Calendar: () => <div data-testid="mock-calendar" />,
    CalendarDayButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
}));

describe('DatePicker quick search buttons', () => {
    beforeEach(async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(2026, 10, 12, 11, 0, 0));
        await i18n.changeLanguage('ko');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const renderDatePicker = (props?: Partial<React.ComponentProps<typeof DatePicker>>) => {
        const onDateChange = jest.fn();
        render(
            <I18nextProvider i18n={i18n}>
                <DatePicker
                    startDate="2026-11-12"
                    endDate="2026-11-12"
                    onDateChange={onDateChange}
                    {...props}
                />
            </I18nextProvider>
        );
        return { onDateChange };
    };

    it('renders today, one week, and one month quick search buttons', () => {
        renderDatePicker();

        expect(screen.getByRole('button', { name: '오늘' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '일주일 후' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '한달 후' })).toBeInTheDocument();
    });

    it('selects today range when clicking 오늘', () => {
        const { onDateChange } = renderDatePicker({
            startDate: '2026-11-01',
            endDate: '2026-11-05',
        });

        fireEvent.click(screen.getByRole('button', { name: '오늘' }));
        expect(onDateChange).toHaveBeenCalledWith('2026-11-12', '2026-11-12');
    });

    it('selects today through one week later when clicking 일주일 후', () => {
        const { onDateChange } = renderDatePicker();

        fireEvent.click(screen.getByRole('button', { name: '일주일 후' }));
        expect(onDateChange).toHaveBeenCalledWith('2026-11-12', '2026-11-19');
    });

    it('selects today through one month later when clicking 한달 후', () => {
        const { onDateChange } = renderDatePicker();

        fireEvent.click(screen.getByRole('button', { name: '한달 후' }));
        expect(onDateChange).toHaveBeenCalledWith('2026-11-12', '2026-12-12');
    });

    it('marks matching quick search button as pressed', () => {
        renderDatePicker({
            startDate: '2026-11-12',
            endDate: '2026-11-19',
        });

        expect(screen.getByRole('button', { name: '오늘' })).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('button', { name: '일주일 후' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: '한달 후' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('renders open-ended onward label when endDate is empty and triggers clearLabel callback', () => {
        const onClearDate = jest.fn();
        renderDatePicker({
            startDate: '2026-11-12',
            endDate: '',
            onClearDate,
            clearLabel: '이후 전체',
        });

        expect(screen.getByRole('button', { name: /2026-11-12 이후/ })).toBeInTheDocument();
        const resetBtn = screen.getByRole('button', { name: '이후 전체' });
        expect(resetBtn).toBeInTheDocument();
        fireEvent.click(resetBtn);
        expect(onClearDate).toHaveBeenCalledTimes(1);
    });
});
