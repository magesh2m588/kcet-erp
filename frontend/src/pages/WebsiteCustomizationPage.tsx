import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebsiteSettings } from '../context/WebsiteSettingsContext';
import { apiRequest, getAuthToken } from '../services/api';
import type { WebsiteSettings } from '../types';
import {
  Building2, Image, Palette, MapPin, LogIn,
  Eye, RotateCcw, Save, Upload, Trash2, CheckCircle2, AlertCircle, Monitor
} from 'lucide-react';

type Tab = 'branding' | 'login' | 'address' | 'colors' | 'background' | 'visibility' | 'preview';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'branding', label: 'College Branding', icon: <Building2 size={14} /> },
  { id: 'login', label: 'Login Page', icon: <LogIn size={14} /> },
  { id: 'address', label: 'Header & Address', icon: <MapPin size={14} /> },
  { id: 'colors', label: 'Colors & Theme', icon: <Palette size={14} /> },
  { id: 'background', label: 'Background', icon: <Image size={14} /> },
  { id: 'visibility', label: 'Visibility', icon: <Eye size={14} /> },
  { id: 'preview', label: 'Preview', icon: <Monitor size={14} /> },
];

// Shared input style
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--input-bg)',
  color: 'var(--foreground)',
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--muted-fg)',
  marginBottom: '5px',
  letterSpacing: '0.3px',
  textTransform: 'uppercase',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--foreground)',
  margin: '0 0 12px',
  paddingBottom: '8px',
  borderBottom: '1px solid var(--border-color)',
};

const fieldRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  marginBottom: '12px',
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  fullWidth?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', fullWidth }) => (
  <div style={fullWidth ? { marginBottom: '12px' } : {}}>
    <label style={labelStyle}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  </div>
);

const Toggle: React.FC<{ label: string; description?: string; value: boolean; onChange: (v: boolean) => void }> = ({
  label, description, value, onChange
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
    <div>
      <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: 'var(--foreground)' }}>{label}</p>
      {description && <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted-fg)' }}>{description}</p>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      style={{
        flexShrink: 0,
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        border: 'none',
        cursor: 'pointer',
        backgroundColor: value ? 'var(--primary)' : 'var(--border-color)',
        position: 'relative',
        transition: 'background-color 0.2s',
      }}
    >
      <span style={{
        position: 'absolute',
        top: '3px',
        left: value ? '23px' : '3px',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        backgroundColor: 'white',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      }} />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
export const WebsiteCustomizationPage: React.FC = () => {
  const { user } = useAuth();
  const { settings: liveSettings, refetch } = useWebsiteSettings();

  const [activeTab, setActiveTab] = useState<Tab>('branding');
  const [draft, setDraft] = useState<WebsiteSettings>(liveSettings);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Logo upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Background upload state
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Keep draft in sync when live settings load
  useEffect(() => {
    setDraft(liveSettings);
  }, [liveSettings]);

  // Guard: must be admin
  if (user?.role !== 'admin') {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <AlertCircle size={40} color="var(--badge-error-fg)" />
        <p style={{ marginTop: '12px', fontWeight: 700 }}>Access Denied</p>
        <p style={{ color: 'var(--muted-fg)' }}>Website Customization is restricted to System Administrators.</p>
      </div>
    );
  }

  const update = (field: keyof WebsiteSettings, value: any) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await apiRequest('/admin/website-settings/', {
        method: 'PATCH',
        body: JSON.stringify(draft),
      });
      setSaveStatus('success');
      setSaveMessage('Settings saved successfully! The login page will reflect these changes.');
      refetch();
    } catch (err: any) {
      setSaveStatus('error');
      setSaveMessage(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  };

  // ── Logo upload ───────────────────────────────────────────────────────────
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      alert('Invalid file type. Allowed: PNG, JPG, WEBP, SVG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum 5 MB.');
      return;
    }
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);
      const token = getAuthToken();
      const res = await fetch('http://127.0.0.1:8000/api/admin/website-settings/logo/', {
        method: 'POST',
        headers: token ? { Authorization: `Token ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        let detailStr = '';
        try {
          const data = await res.json();
          detailStr = data.error || data.detail || JSON.stringify(data);
          console.error('Logo upload error details:', res.status, data);
        } catch {
          detailStr = res.statusText || 'Server Error';
        }
        throw new Error(`Upload failed: ${res.status} — ${detailStr}`);
      }

      const data = await res.json();
      if (data.logo_url) {
        update('logo_url', data.logo_url);
      }
      setLogoFile(null);
      setLogoPreview(null);
      refetch();
      alert(data.message || 'Logo uploaded successfully.');
    } catch (err: any) {
      console.error('Logo upload failed:', err);
      alert(err.message || 'Upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('Remove the current logo? The default placeholder will be used.')) return;
    try {
      await apiRequest('/admin/website-settings/logo/delete/', { method: 'DELETE' });
      update('logo_url', null);
      refetch();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ── Background upload ─────────────────────────────────────────────────────
  const handleBgSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Invalid file type. Allowed: PNG, JPG, WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum 5 MB.');
      return;
    }
    setBgFile(file);
    const url = URL.createObjectURL(file);
    setBgPreview(url);
  };

  const handleUploadBg = async () => {
    if (!bgFile) return;
    setUploadingBg(true);
    try {
      const formData = new FormData();
      formData.append('background', bgFile);
      const token = getAuthToken();
      const res = await fetch('http://127.0.0.1:8000/api/admin/website-settings/background/', {
        method: 'POST',
        headers: token ? { Authorization: `Token ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        let detailStr = '';
        try {
          const data = await res.json();
          detailStr = data.error || data.detail || JSON.stringify(data);
          console.error('Background upload error details:', res.status, data);
        } catch {
          detailStr = res.statusText || 'Server Error';
        }
        throw new Error(`Upload failed: ${res.status} — ${detailStr}`);
      }

      const data = await res.json();
      if (data.background_url) {
        update('background_url', data.background_url);
      }
      setBgFile(null);
      setBgPreview(null);
      refetch();
      alert(data.message || 'Background uploaded successfully.');
    } catch (err: any) {
      console.error('Background upload failed:', err);
      alert(err.message || 'Upload failed');
    } finally {
      setUploadingBg(false);
    }
  };

  const handleDeleteBg = async () => {
    if (!confirm('Remove the current login background? The default gradient will be used.')) return;
    try {
      await apiRequest('/admin/website-settings/background/delete/', { method: 'DELETE' });
      update('background_url', null);
      refetch();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ── Reset to defaults ─────────────────────────────────────────────────────
  const handleReset = async () => {
    setResetting(true);
    try {
      await apiRequest('/admin/website-settings/reset/', { method: 'POST' });
      setShowResetConfirm(false);
      refetch();
      alert('Website settings reset to KCET defaults.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResetting(false);
    }
  };

  // ── Card wrapper ──────────────────────────────────────────────────────────
  const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
    <div style={{
      backgroundColor: 'var(--card-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      padding: '20px',
      marginBottom: '16px',
      ...style,
    }}>
      {children}
    </div>
  );

  // ── Preview ───────────────────────────────────────────────────────────────
  const PreviewPanel = () => (
    <div
      style={{
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        background: draft.background_url
          ? `url(${draft.background_url}) ${draft.background_position} / cover no-repeat`
          : 'linear-gradient(135deg, #0a1628, #0f1e3d 30%, #0c2855 60%, #0f1726)',
        position: 'relative',
        minHeight: '480px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: `rgba(10,20,45,${draft.background_overlay_opacity ?? 0.55})`,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '14px 20px',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
            {draft.show_logo && (
              logoPreview || draft.logo_url ? (
                <img src={logoPreview || draft.logo_url!} alt="Logo Preview" style={{ height: '42px', width: 'auto', borderRadius: '4px', objectFit: 'contain' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: draft.primary_color || 'hsl(215,72%,43%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'white', fontWeight: 800, fontSize: '14px' }}>{draft.short_name?.slice(0, 2) || 'KC'}</span>
                </div>
              )
            )}
            <div>
              <p style={{ margin: 0, fontWeight: 800, color: '#fff', fontSize: '13px' }}>{draft.college_name}</p>
              {draft.show_institutional_info && (
                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '10px' }}>
                  {draft.affiliation_text} • {draft.accreditation_text}
                </p>
              )}
            </div>
          </div>
        </div>
        {/* Login Card Preview */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '12px',
            padding: '24px 20px',
            width: '100%',
            maxWidth: '300px',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <p style={{ fontWeight: 800, color: '#fff', fontSize: '18px', margin: '0 0 2px' }}>{draft.login_title}</p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', margin: 0 }}>{draft.login_subtitle}</p>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', margin: '0 0 4px' }}>{draft.username_label}</p>
              <div style={{ height: '32px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', margin: '0 0 4px' }}>{draft.password_label}</p>
              <div style={{ height: '32px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.06)' }} />
            </div>
            <div style={{
              height: '36px',
              borderRadius: '6px',
              background: draft.primary_color || 'hsl(215,72%,43%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '11px',
            }}>
              {draft.login_button_text}
            </div>
          </div>
        </div>
        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
          {draft.footer_text}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>Website Customization</h1>
          <p style={{ fontSize: '12px', color: 'var(--muted-fg)', margin: 0 }}>
            Configure institutional branding, login page appearance, and ERP visual identity. <strong>Admin only.</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={() => setShowResetConfirm(true)}
            style={{
              padding: '8px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '6px',
              border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)',
              color: 'var(--muted-fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <RotateCcw size={13} /> Reset to Default
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 18px', fontSize: '12px', fontWeight: 700, borderRadius: '6px',
              border: 'none', backgroundColor: 'var(--primary)', color: '#fff',
              cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Save size={13} /> {saving ? 'Saving…' : 'Save All Changes'}
          </button>
        </div>
      </div>

      {/* Save status banner */}
      {saveStatus !== 'idle' && (
        <div style={{
          padding: '10px 16px', marginBottom: '16px', borderRadius: '8px', fontSize: '13px',
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: saveStatus === 'success' ? 'var(--badge-success-bg)' : 'var(--badge-error-bg)',
          color: saveStatus === 'success' ? 'var(--badge-success-fg)' : 'var(--badge-error-fg)',
          border: `1px solid ${saveStatus === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        }}>
          {saveStatus === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {saveMessage}
        </div>
      )}

      {/* Reset Confirmation */}
      {showResetConfirm && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)',
            borderRadius: '12px', padding: '28px 32px', maxWidth: '420px', width: '90%',
          }}>
            <h3 style={{ margin: '0 0 8px', fontWeight: 700 }}>Reset to KCET Defaults?</h3>
            <p style={{ color: 'var(--muted-fg)', fontSize: '13px', margin: '0 0 20px' }}>
              This will reset ALL website customization settings (including uploaded logo and background) to the default KCET ERP design. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowResetConfirm(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleReset} disabled={resetting} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: '#fff', fontWeight: 700, cursor: resetting ? 'wait' : 'pointer' }}>
                {resetting ? 'Resetting…' : 'Reset to Default'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', overflowX: 'auto', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 16px', fontSize: '12px', fontWeight: 600,
              border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              borderRadius: '0', cursor: 'pointer', whiteSpace: 'nowrap',
              backgroundColor: 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--muted-fg)',
              transition: 'color 0.15s',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ──────────────────────────────────────────────────── */}

      {/* BRANDING TAB */}
      {activeTab === 'branding' && (
        <div>
          <Card>
            <h3 style={sectionTitle}>College Identity</h3>
            <Field label="College Name (Full)" value={draft.college_name} onChange={(v) => update('college_name', v)} placeholder="Krishnasamy College of Engineering & Technology" fullWidth />
            <div style={fieldRow}>
              <Field label="Short Name / Abbreviation" value={draft.short_name} onChange={(v) => update('short_name', v)} placeholder="KCET" />
              <Field label="Tagline" value={draft.tagline} onChange={(v) => update('tagline', v)} placeholder="Excellence in Engineering Education" />
            </div>
            <div style={fieldRow}>
              <Field label="Affiliation" value={draft.affiliation_text} onChange={(v) => update('affiliation_text', v)} placeholder="Affiliated to Anna University" />
              <Field label="Accreditation & Approval" value={draft.accreditation_text} onChange={(v) => update('accreditation_text', v)} placeholder="Accredited by NAAC • Approved by AICTE" />
            </div>
            <Field label="Official Website URL" value={draft.website_url} onChange={(v) => update('website_url', v)} type="url" placeholder="https://www.kcet.in" fullWidth />
          </Card>

          <Card>
            <h3 style={sectionTitle}>ERP Sidebar / Header Logo</h3>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Current logo display */}
              <div style={{ flexShrink: 0 }}>
                <p style={labelStyle}>Current Logo</p>
                {(logoPreview || liveSettings.logo_url) ? (
                  <img
                    src={logoPreview || liveSettings.logo_url!}
                    alt="College Logo Preview"
                    style={{
                      width: '120px', height: '120px', objectFit: 'contain',
                      border: '1px solid var(--border-color)', borderRadius: '8px',
                      backgroundColor: 'var(--subtle-bg)', padding: '4px',
                    }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).alt = 'Image failed to load'; }}
                  />
                ) : (
                  <div style={{
                    width: '120px', height: '120px', border: '2px dashed var(--border-color)',
                    borderRadius: '8px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--muted-fg)',
                  }}>
                    <Building2 size={28} />
                    <span style={{ fontSize: '10px' }}>No Logo</span>
                  </div>
                )}
              </div>

              {/* Upload controls */}
              <div style={{ flex: 1, minWidth: '220px' }}>
                <p style={labelStyle}>Upload New Logo</p>
                <p style={{ fontSize: '11px', color: 'var(--muted-fg)', margin: '0 0 10px' }}>
                  Supported formats: PNG, JPG, JPEG, WEBP, SVG. Maximum file size: 5 MB. Used in internal ERP sidebar and login page.
                </p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  style={{ display: 'none' }}
                  onChange={handleLogoSelect}
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    style={{
                      padding: '8px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '6px',
                      border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <Upload size={13} /> Choose Logo
                  </button>
                  {logoFile && (
                    <button
                      onClick={handleUploadLogo}
                      disabled={uploadingLogo}
                      style={{
                        padding: '8px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '6px',
                        border: 'none', backgroundColor: 'var(--primary)', color: '#fff',
                        cursor: uploadingLogo ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      {uploadingLogo ? 'Uploading…' : 'Upload Logo'}
                    </button>
                  )}
                  {liveSettings.logo_url && (
                    <button
                      onClick={handleDeleteLogo}
                      style={{
                        padding: '8px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '6px',
                        border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)',
                        color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      <Trash2 size={13} /> Remove Logo
                    </button>
                  )}
                </div>
                {logoFile && (
                  <p style={{ fontSize: '11px', color: 'var(--muted-fg)', marginTop: '6px' }}>
                    Selected: <strong>{logoFile.name}</strong> ({(logoFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* LOGIN PAGE TAB */}
      {activeTab === 'login' && (
        <Card>
          <h3 style={sectionTitle}>Login Page Text & Labels</h3>
          <div style={fieldRow}>
            <Field label="Login Title" value={draft.login_title} onChange={(v) => update('login_title', v)} placeholder="KCET ERP" />
            <Field label="Login Subtitle" value={draft.login_subtitle} onChange={(v) => update('login_subtitle', v)} placeholder="Academic Management System" />
          </div>
          <Field label="Login Description (optional)" value={draft.login_description} onChange={(v) => update('login_description', v)} placeholder="Sign in to access the KCET Academic ERP Portal" fullWidth />
          <div style={fieldRow}>
            <Field label="Username Field Label" value={draft.username_label} onChange={(v) => update('username_label', v)} placeholder="Email / Staff Code / Register Number" />
            <Field label="Username Placeholder" value={draft.username_placeholder} onChange={(v) => update('username_placeholder', v)} placeholder="Enter your email or register number" />
          </div>
          <div style={fieldRow}>
            <Field label="Password Field Label" value={draft.password_label} onChange={(v) => update('password_label', v)} placeholder="Password" />
            <Field label="Password Placeholder" value={draft.password_placeholder} onChange={(v) => update('password_placeholder', v)} placeholder="Enter your password" />
          </div>
          <Field label="Login Button Text" value={draft.login_button_text} onChange={(v) => update('login_button_text', v)} placeholder="Sign In to KCET ERP" fullWidth />
          <Field label="Footer Text" value={draft.footer_text} onChange={(v) => update('footer_text', v)} placeholder="© 2026 Krishnasamy College..." fullWidth />
        </Card>
      )}

      {/* ADDRESS TAB */}
      {activeTab === 'address' && (
        <Card>
          <h3 style={sectionTitle}>Institution Address & Contact</h3>
          <Field label="Address Line 1" value={draft.address_line_1} onChange={(v) => update('address_line_1', v)} placeholder="Anand Nagar, Nellikuppam Main Road" fullWidth />
          <Field label="Address Line 2" value={draft.address_line_2} onChange={(v) => update('address_line_2', v)} placeholder="S. Kumarapuram" fullWidth />
          <div style={fieldRow}>
            <Field label="City" value={draft.city} onChange={(v) => update('city', v)} placeholder="Cuddalore" />
            <Field label="District" value={draft.district} onChange={(v) => update('district', v)} placeholder="Cuddalore" />
          </div>
          <div style={fieldRow}>
            <Field label="PIN Code" value={draft.postal_code} onChange={(v) => update('postal_code', v)} placeholder="607 109" />
            <Field label="Phone Number" value={draft.phone} onChange={(v) => update('phone', v)} placeholder="04142-285601 to 285604" />
          </div>
          <div style={fieldRow}>
            <Field label="Email Address" value={draft.email} onChange={(v) => update('email', v)} type="email" placeholder="info@kcet.in" />
            <Field label="Website URL" value={draft.website_url} onChange={(v) => update('website_url', v)} type="url" placeholder="https://www.kcet.in" />
          </div>
        </Card>
      )}

      {/* COLORS TAB */}
      {activeTab === 'colors' && (
        <Card>
          <h3 style={sectionTitle}>Brand Color Tokens</h3>
          <p style={{ fontSize: '12px', color: 'var(--muted-fg)', margin: '0 0 16px' }}>
            These color values become CSS custom properties used throughout the ERP. Use HSL, HEX, or RGB values.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Primary Color (--brand-primary)', field: 'primary_color' as const, hint: 'Main interactive color, buttons' },
              { label: 'Secondary Color (--brand-secondary)', field: 'secondary_color' as const, hint: 'Sidebar, dark backgrounds' },
              { label: 'Accent Color (--brand-accent)', field: 'accent_color' as const, hint: 'Hover states, highlights' },
              { label: 'Background Color (--brand-background)', field: 'background_color' as const, hint: 'Main page background' },
              { label: 'Text Color (--brand-text)', field: 'text_color' as const, hint: 'Main body text' },
              { label: 'Border Color (--brand-border)', field: 'border_color' as const, hint: 'Card and input borders' },
            ].map((item) => (
              <div key={item.field} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div>
                  <div
                    style={{
                      width: '36px', height: '36px', borderRadius: '6px', marginTop: '18px',
                      backgroundColor: draft[item.field] as string,
                      border: '1px solid var(--border-color)',
                      flexShrink: 0,
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{item.label}</label>
                  <input
                    type="text"
                    value={draft[item.field] as string}
                    onChange={(e) => update(item.field, e.target.value)}
                    placeholder="#3b82f6 or hsl(215, 72%, 43%)"
                    style={inputStyle}
                  />
                  <p style={{ fontSize: '10px', color: 'var(--muted-fg)', margin: '3px 0 0' }}>{item.hint}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* BACKGROUND TAB */}
      {activeTab === 'background' && (
        <div>
          <Card>
            <h3 style={sectionTitle}>Login Page Background Image</h3>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flexShrink: 0 }}>
                <p style={labelStyle}>Current Background</p>
                {(bgPreview || liveSettings.background_url) ? (
                  <img
                    src={bgPreview || liveSettings.background_url!}
                    alt="Background Preview"
                    style={{ width: '200px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  />
                ) : (
                  <div style={{
                    width: '200px', height: '120px', border: '2px dashed var(--border-color)',
                    borderRadius: '8px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--muted-fg)',
                    background: 'linear-gradient(135deg, #0a1628, #0c2855)',
                  }}>
                    <Image size={24} style={{ opacity: 0.4 }} />
                    <span style={{ fontSize: '10px' }}>Default gradient</span>
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <p style={labelStyle}>Upload Background Image</p>
                <p style={{ fontSize: '11px', color: 'var(--muted-fg)', margin: '0 0 10px' }}>
                  Supported: PNG, JPG, WEBP. Maximum: 5 MB. Recommended: 1920×1080 or wider.
                </p>
                <input
                  ref={bgInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleBgSelect}
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => bgInputRef.current?.click()} style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Upload size={13} /> Choose Image
                  </button>
                  {bgFile && (
                    <button onClick={handleUploadBg} disabled={uploadingBg} style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary)', color: '#fff', cursor: uploadingBg ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {uploadingBg ? 'Uploading…' : 'Upload Background'}
                    </button>
                  )}
                  {liveSettings.background_url && (
                    <button onClick={handleDeleteBg} style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Trash2 size={13} /> Remove Background
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 style={sectionTitle}>Background Display Options</h3>
            <div style={fieldRow}>
              <div>
                <label style={labelStyle}>Background Position</label>
                <select
                  value={draft.background_position}
                  onChange={(e) => update('background_position', e.target.value)}
                  style={{ ...inputStyle }}
                >
                  <option value="center center">Center Center</option>
                  <option value="top center">Top Center</option>
                  <option value="bottom center">Bottom Center</option>
                  <option value="center left">Center Left</option>
                  <option value="center right">Center Right</option>
                  <option value="top left">Top Left</option>
                  <option value="top right">Top Right</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Overlay Opacity (0 = transparent, 1 = opaque)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={draft.background_overlay_opacity}
                    onChange={(e) => update('background_overlay_opacity', parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '36px' }}>
                    {Math.round((draft.background_overlay_opacity ?? 0.55) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* VISIBILITY TAB */}
      {activeTab === 'visibility' && (
        <Card>
          <h3 style={sectionTitle}>Login Page Visibility Flags</h3>
          <Toggle
            label="Show College Logo"
            description="Display the college logo in the institutional header and login page."
            value={draft.show_logo}
            onChange={(v) => update('show_logo', v)}
          />
          <Toggle
            label="Show Institutional Information"
            description="Show affiliation, accreditation, address and contact info in the header."
            value={draft.show_institutional_info}
            onChange={(v) => update('show_institutional_info', v)}
          />
          <Toggle
            label="Show Password Toggle"
            description="Show the eye icon to reveal/hide the password while typing."
            value={draft.show_password_toggle}
            onChange={(v) => update('show_password_toggle', v)}
          />
          <Toggle
            label="Show Development Credentials"
            description="Display sample login credentials on the login page (for development/testing only — disable in production)."
            value={draft.show_development_credentials}
            onChange={(v) => update('show_development_credentials', v)}
          />
        </Card>
      )}

      {/* PREVIEW TAB */}
      {activeTab === 'preview' && (
        <div>
          <div style={{ padding: '12px 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '14px' }}>Live Login Page Preview</p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted-fg)' }}>Reflects your current unsaved draft settings. Save to apply to actual login page.</p>
            </div>
            <a
              href="/login"
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--card-bg)', cursor: 'pointer', textDecoration: 'none', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Eye size={13} /> Open Login Page
            </a>
          </div>
          <PreviewPanel />
        </div>
      )}
    </div>
  );
};
