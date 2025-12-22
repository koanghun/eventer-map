import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import AppContent from './AppContent';

function App() {
    return (
        <ThemeProvider>
            <LanguageProvider>
                <AuthProvider>
                    <AppContent />
                </AuthProvider>
            </LanguageProvider>
        </ThemeProvider>
    );
}

export default App;
