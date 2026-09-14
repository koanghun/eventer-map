import { useState, useEffect } from 'react';
import { useGetVisits, usePostVisits } from '../api/generated/system/system';

export const useDailyVisitCounter = () => {
    const [visitCount, setVisitCount] = useState<number>(0);
    const { refetch: getVisits } = useGetVisits({
        query: {
            enabled: false,
        }
    });
    const { mutateAsync: postVisits } = usePostVisits();

    useEffect(() => {
        const updateVisitCount = async () => {
            const today = new Date().toISOString().split('T')[0];
            const sessionKey = `hasVisited_${today}`;
            const hasVisitedToday = sessionStorage.getItem(sessionKey);

            try {
                if (!hasVisitedToday) {
                    // Send request to increment count
                    const res = await postVisits();
                    setVisitCount(res.count || 0);
                    sessionStorage.setItem(sessionKey, 'true');
                } else {
                    // Just fetch current count
                    const { data } = await getVisits();
                    if (data) {
                        setVisitCount(data.count || 0);
                    }
                }
            } catch (err) {
                console.error('Failed to sync visit count', err);
            }
        };

        updateVisitCount();
    }, [postVisits, getVisits]);

    return visitCount;
};
