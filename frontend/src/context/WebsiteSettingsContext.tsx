import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { WebsiteSettings } from '../types';
import { API_BASE_URL } from '../services/api';

// ── Default fallback so the app never shows blank ───────────────────────────
const DEFAULT_SETTINGS: WebsiteSettings = {
  college_name: 'Krishnasamy College of Engineering & Technology',
  short_name: 'KCET',
  tagline: 'Excellence in Engineering Education',
  affiliation_text: 'Affiliated to Anna University',
  accreditation_text: 'Accredited by NAAC • Approved by AICTE',
  website_url: 'https://www.kcet.in',
  address_line_1: 'Anand Nagar, Nellikuppam Main Road',
  address_line_2: 'S. Kumarapuram',
  city: 'Cuddalore',
  district: 'Cuddalore',
  postal_code: '607 109',
  phone: '04142-285601 to 285604',
  email: 'info@kcet.in',
  logo_url: null,
  background_url: null,
  background_position: 'center center',
  background_overlay_opacity: 0.55,
  login_title: 'KCET ERP',
  login_subtitle: 'Academic Management System',
  login_description: 'Sign in to access the KCET Academic ERP Portal',
  username_label: 'Email / Staff Code / Register Number',
  username_placeholder: 'Enter your email or register number',
  password_label: 'Password',
  password_placeholder: 'Enter your password',
  login_button_text: 'Sign In to KCET ERP',
  footer_text: '© 2026 Krishnasamy College of Engineering & Technology. All rights reserved.',
  primary_color: 'hsl(215, 72%, 43%)',
  secondary_color: 'hsl(222, 36%, 14%)',
  accent_color: 'hsl(215, 75%, 60%)',
  background_color: 'hsl(210, 24%, 97%)',
  text_color: 'hsl(222, 30%, 14%)',
  border_color: 'hsl(214, 18%, 84%)',
  show_logo: true,
  show_institutional_info: true,
  show_password_toggle: true,
  show_development_credentials: false,
};

// ── Context type ─────────────────────────────────────────────────────────────
interface WebsiteSettingsContextType {
  settings: WebsiteSettings;
  loading: boolean;
  refetch: () => void;
}

const WebsiteSettingsContext = createContext<WebsiteSettingsContextType>({
  settings: DEFAULT_SETTINGS,
  loading: true,
  refetch: () => {},
});

export const useWebsiteSettings = () => useContext(WebsiteSettingsContext);

// ── Provider ─────────────────────────────────────────────────────────────────
export const WebsiteSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<WebsiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/website-settings/`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data: WebsiteSettings = await res.json();
        setSettings({ ...DEFAULT_SETTINGS, ...data });

        // Apply CSS custom properties for brand colors
        const root = document.documentElement;
        if (data.primary_color) root.style.setProperty('--brand-primary', data.primary_color);
        if (data.secondary_color) root.style.setProperty('--brand-secondary', data.secondary_color);
        if (data.accent_color) root.style.setProperty('--brand-accent', data.accent_color);
        if (data.primary_color) root.style.setProperty('--primary', data.primary_color);

        // Update document title
        if (data.login_title) {
          document.title = `${data.login_title} — KCET`;
        }
      }
    } catch {
      // Silently use defaults if API unreachable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <WebsiteSettingsContext.Provider value={{ settings, loading, refetch: fetchSettings }}>
      {children}
    </WebsiteSettingsContext.Provider>
  );
};

export { DEFAULT_SETTINGS };
