import { useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    return (
        <div className={`app-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className="main-content">
                <header className="topbar">
                    <div className="topbar-left flex items-center gap-4">
                        <button className="mobile-toggle lg:hidden" onClick={toggleSidebar}>
                            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                        <span className="system-status">System Online</span>
                    </div>
                    <div className="topbar-right">
                        <div className="user-profile">
                            <span className="user-role">Analyst</span>
                            <div className="user-avatar">AD</div>
                        </div>
                    </div>
                </header>
                <div className="page-content fade-in" onClick={() => sidebarOpen && setSidebarOpen(false)}>
                    {children}
                </div>
            </main>
        </div>
    );
}
