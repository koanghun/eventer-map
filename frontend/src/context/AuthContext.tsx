import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
    user: any | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    flaggedEventIds: number[];
    logout: () => Promise<void>;
    toggleFlag: (eventId: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user] = useState<any | null>(null);
    const [isLoading] = useState(false);
    const [flaggedEventIds] = useState<number[]>([]);

    const logout = async () => {};
    const toggleFlag = async (_eventId: number) => {};

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            flaggedEventIds,
            logout,
            toggleFlag
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
