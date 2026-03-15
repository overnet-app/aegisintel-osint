import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    Search as SearchIcon,
    FileText,
    Settings,
    Shield,
    LogOut,
    Activity,
    Globe,
    X,
    SearchX
} from 'lucide-react';

interface SidebarItemProps {
    to: string;
    icon: React.ElementType;
    label: string;
}

const SidebarItem = ({ to, icon: Icon, label }: SidebarItemProps) => (
    <NavLink
        to={to}
        className={({ isActive }) => `
      sidebar-item ${isActive ? 'active' : ''}
    `}
    >
        <Icon size={20} />
        <span>{label}</span>
    </NavLink>
);

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { logout } = useAuth();

    return (
        <aside className={`sidebar ${isOpen ? 'mobile-show' : ''}`}>
            <div className="sidebar-logo">
                <div className="logo-icon">
                    <Shield size={20} />
                </div>
                <h1 className="logo-text">
                    AEGIS<span>INTEL</span>
                </h1>
                <button className="mobile-close lg:hidden ml-auto" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>

            <nav className="sidebar-nav" onClick={onClose}>
                <div className="nav-group-label">Intelligence</div>
                <SidebarItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                <SidebarItem to="/search" icon={SearchIcon} label="Target Search" />
                <SidebarItem to="/reverse-lookup" icon={SearchX} label="Reverse Lookup" />
                <SidebarItem to="/dossiers" icon={FileText} label="Dossiers" />

                <div className="nav-group-label" style={{ marginTop: '24px' }}>Operations</div>
                <SidebarItem to="/activity" icon={Activity} label="Live Feed" />
                <SidebarItem to="/network" icon={Globe} label="Global Map" />
            </nav>

            <div className="sidebar-footer">
                <div onClick={onClose}>
                    <SidebarItem to="/settings" icon={Settings} label="Settings" />
                </div>
                <button className="logout-btn" onClick={logout}>
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}
