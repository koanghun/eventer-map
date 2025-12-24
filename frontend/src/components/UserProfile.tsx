import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import ReportManagementModal from './ReportManagementModal';
import './UserProfile.css';

export default function UserProfile() {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!user) return null;

    const handleManageReports = () => {
        setIsOpen(false);
        setShowReportModal(true);
    };

    return (
        <>
            <div className="user-profile" ref={dropdownRef}>
                <button
                    className="profile-button"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {user.profile_image ? (
                        <img src={user.profile_image} alt={user.name || user.email} className="profile-image" />
                    ) : (
                        <div className="profile-avatar">
                            {(user.name?.[0] || user.email[0]).toUpperCase()}
                        </div>
                    )}
                </button>

                {isOpen && (
                    <div className="profile-dropdown">
                        <div className="profile-info">
                            <p className="profile-name">{user.name || user.email}</p>
                            <p className="profile-email">{user.email}</p>
                        </div>

                        {user.is_admin && (
                            <button className="admin-menu-button" onClick={handleManageReports}>
                                📊 {t('admin.manageReports')}
                            </button>
                        )}

                        <button className="logout-button" onClick={logout}>
                            {t('auth.logout')}
                        </button>
                    </div>
                )}
            </div>

            {showReportModal && (
                <ReportManagementModal onClose={() => setShowReportModal(false)} />
            )}
        </>
    );
}
