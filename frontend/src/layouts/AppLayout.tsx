import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useWebsiteSettings } from '../context/WebsiteSettingsContext';
import { Badge, Button } from '../components/UIComponents';
import {
  GraduationCap,
  LayoutDashboard,
  Building2,
  Users,
  UserCheck,
  BookOpen,
  CalendarCheck2,
  FileText,
  LogOut,
  Moon,
  Sun,
  Settings2,
} from 'lucide-react';
import styles from './Layout.module.css';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { settings } = useWebsiteSettings();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getNavLinks = () => {
    switch (user.role) {
      case 'admin':
        return [
          { to: '/', label: 'Overview', icon: <LayoutDashboard size={18} /> },
          { to: '/academic-structure', label: 'Academic Structure', icon: <Building2 size={18} /> },
          { to: '/hod-assignment', label: 'HOD Assignment', icon: <UserCheck size={18} /> },
          { to: '/students', label: 'Students', icon: <Users size={18} /> },
          { to: '/website-customization', label: 'Website Customization', icon: <Settings2 size={18} /> },
        ];
      case 'hod':
        return [
          { to: '/', label: 'Overview', icon: <LayoutDashboard size={18} /> },
          { to: '/staff', label: 'Staff', icon: <UserCheck size={18} /> },
          { to: '/students', label: 'Students', icon: <Users size={18} /> },
          { to: '/subjects', label: 'Subjects', icon: <BookOpen size={18} /> },
          { to: '/attendance', label: 'Attendance', icon: <CalendarCheck2 size={18} /> },
          { to: '/marks', label: 'Marks', icon: <FileText size={18} /> },
        ];
      case 'teacher':
        return [
          { to: '/', label: 'Overview', icon: <LayoutDashboard size={18} /> },
          { to: '/marks', label: 'Marks', icon: <FileText size={18} /> },
        ];
      case 'student':
        return [
          { to: '/', label: 'Overview', icon: <LayoutDashboard size={18} /> },
          { to: '/my-subjects', label: 'My Subjects', icon: <BookOpen size={18} /> },
          { to: '/attendance', label: 'Attendance', icon: <CalendarCheck2 size={18} /> },
          { to: '/marks', label: 'Marks', icon: <FileText size={18} /> },
        ];
      default:
        return [];
    }
  };

  const navLinks = getNavLinks();

  return (
    <div className={styles.appContainer}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarBrand}>
          {settings.logo_url && settings.show_logo ? (
            <img
              src={settings.logo_url}
              alt={`${settings.short_name || 'KCET'} Logo`}
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'contain',
                borderRadius: '4px',
                flexShrink: 0,
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <GraduationCap size={28} style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
          )}
          <div>
            <div className={styles.brandTitle}>{settings.login_title || 'KCET ERP'}</div>
            <div className={styles.brandSubtitle}>
              {settings.short_name ? `${settings.short_name} ACADEMIC OPS` : 'KCET ACADEMIC OPS'}
            </div>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              {link.icon}
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className={styles.mainContent}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerTitleGroup}>
            <span className={styles.institutionTag}>{settings.short_name || 'KCET'} • ANNA UNIVERSITY ACADEMIC ERP</span>
          </div>

          <div className={styles.headerUserGroup}>
            <button
              onClick={toggleTheme}
              title="Toggle Light/Dark Theme"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--fg-app)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <span style={{ fontWeight: 600, fontSize: '13px' }}>{user.full_name || user.username}</span>
            
            <Badge variant={user.role === 'admin' ? 'error' : user.role === 'hod' ? 'warning' : 'neutral'}>
              {user.role.toUpperCase()}
            </Badge>

            <Button variant="secondary" size="sm" onClick={handleLogout} title="Logout">
              <LogOut size={14} />
              Logout
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className={styles.pageBody}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
