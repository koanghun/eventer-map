import { useState, useEffect } from 'react';

interface VisitData {
    date: string;
    count: number;
}

export const useDailyVisitCounter = () => {
    const [visitCount, setVisitCount] = useState<number>(0);

    useEffect(() => {
        const updateVisitCount = () => {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const storedData = localStorage.getItem('dailyVisitData');

            let visitData: VisitData;

            if (storedData) {
                visitData = JSON.parse(storedData);

                // 날짜가 바뀌었으면 카운터 리셋
                if (visitData.date !== today) {
                    visitData = { date: today, count: 1 };
                } else {
                    // 같은 날이면 카운트 증가
                    visitData.count += 1;
                }
            } else {
                // 첫 방문
                visitData = { date: today, count: 1 };
            }

            localStorage.setItem('dailyVisitData', JSON.stringify(visitData));
            setVisitCount(visitData.count);
        };

        updateVisitCount();
    }, []);

    return visitCount;
};
