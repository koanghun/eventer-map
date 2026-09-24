import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import AppContent from './AppContent';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToastContainer from './components/ui/ToastContainer';
import { GoogleOAuthProvider } from '@react-oauth/google';

// QueryClient 인스턴스 생성
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false, // 탭 전환 시 자동 리프레시 끄기 (선택)
            retry: 1, // 실패 시 재시도 횟수
        },
    },
});

function App() {
    return (
        <>
        <QueryClientProvider client={queryClient}>
            <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || '1047715011707-v6e29o0q2u9866846g0nchiv660k4hck.apps.googleusercontent.com'}>
                <ThemeProvider>
                    <LanguageProvider>
                        <AuthProvider>
                            <BrowserRouter>
                                <AppContent />
                            </BrowserRouter>
                        </AuthProvider>
                    </LanguageProvider>
                </ThemeProvider>
            </GoogleOAuthProvider>
        </QueryClientProvider>
        <ToastContainer />
        </>
    );
}

export default App;
