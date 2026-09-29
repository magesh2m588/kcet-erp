import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebsiteSettings } from '../context/WebsiteSettingsContext';
import { Eye, EyeOff, GraduationCap, MapPin, Phone, Mail, Globe } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { settings } = useWebsiteSettings();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Compose the address string
  const addressParts = [
    settings.address_line_1,
    settings.address_line_2,
    settings.city && settings.postal_code
      ? `${settings.city} - ${settings.postal_code}`
      : settings.city || settings.postal_code,
  ].filter(Boolean);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', 'Roboto', system-ui, sans-serif",
        backgroundColor: '#0f1726',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Background Layer ──────────────────────────────────────────── */}
      {settings.background_url ? (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: `url(${settings.background_url})`,
            backgroundSize: 'cover',
            backgroundPosition: settings.background_position || 'center center',
            backgroundRepeat: 'no-repeat',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      ) : (
        // Default gradient background
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'linear-gradient(135deg, #0a1628 0%, #0f1e3d 30%, #0c2855 60%, #0f1726 100%)',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      {/* Overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: `rgba(10, 20, 45, ${settings.background_overlay_opacity ?? 0.55})`,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        {/* ── KCET Institutional Header ─────────────────────────────── */}
        <header
          style={{
            width: '100%',
            backgroundColor: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.10)',
            padding: '20px 24px',
          }}
        >
          <div
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              textAlign: 'center',
            }}
          >
            {/* Logo row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {settings.show_logo && (
                settings.logo_url ? (
                  <img
                    src={settings.logo_url}
                    alt={`${settings.short_name} Logo`}
                    style={{
                      height: '70px',
                      width: 'auto',
                      objectFit: 'contain',
                      borderRadius: '6px',
                      flexShrink: 0,
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '70px',
                      height: '70px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, hsl(215,72%,43%), hsl(215,75%,60%))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      border: '2px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    <GraduationCap size={32} color="white" />
                  </div>
                )
              )}
              <div style={{ textAlign: 'center' }}>
                <h1
                  style={{
                    fontSize: 'clamp(16px, 3vw, 22px)',
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '0.5px',
                    margin: 0,
                    textTransform: 'uppercase',
                  }}
                >
                  {settings.college_name}
                </h1>
                {settings.show_institutional_info && (
                  <>
                    <p style={{ margin: '4px 0 0', fontSize: 'clamp(11px, 1.5vw, 13px)', color: 'rgba(255,255,255,0.75)' }}>
                      {settings.affiliation_text}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 'clamp(10px, 1.5vw, 12px)', color: 'rgba(255,255,255,0.65)' }}>
                      {settings.accreditation_text}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Address row */}
            {settings.show_institutional_info && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px 20px',
                  justifyContent: 'center',
                  fontSize: 'clamp(10px, 1.4vw, 12px)',
                  color: 'rgba(255,255,255,0.65)',
                }}
              >
                {addressParts.length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
                    {addressParts.join(', ')}
                  </span>
                )}
                {settings.phone && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
                    {settings.phone}
                  </span>
                )}
                {settings.email && (
                  <a
                    href={`mailto:${settings.email}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.65)', textDecoration: 'none' }}
                  >
                    <Mail size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
                    {settings.email}
                  </a>
                )}
                {settings.website_url && (
                  <a
                    href={settings.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.65)', textDecoration: 'none' }}
                  >
                    <Globe size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
                    {settings.website_url.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            )}
          </div>
        </header>

        {/* ── Login Card Area ──────────────────────────────────────────── */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '400px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '16px',
              padding: '36px 32px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            {/* ERP Title */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 14px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '20px',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(147,197,253,0.9)', letterSpacing: '1px' }}>
                  {settings.short_name} ERP PORTAL
                </span>
              </div>
              <h2
                style={{
                  fontSize: '26px',
                  fontWeight: 800,
                  color: '#ffffff',
                  margin: '0 0 4px',
                  letterSpacing: '-0.5px',
                }}
              >
                {settings.login_title}
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', margin: 0 }}>
                {settings.login_subtitle}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div
                role="alert"
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  color: '#fca5a5',
                }}
              >
                {error}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} autoComplete="on" noValidate>
              {/* Username */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  htmlFor="login-username"
                  style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '6px', letterSpacing: '0.3px' }}
                >
                  {settings.username_label}
                </label>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={settings.username_placeholder}
                  required
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    fontSize: '14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    color: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, background-color 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59,130,246,0.7)';
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.09)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: '24px' }}>
                <label
                  htmlFor="login-password"
                  style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: '6px', letterSpacing: '0.3px' }}
                >
                  {settings.password_label}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={settings.password_placeholder}
                    required
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: `11px ${settings.show_password_toggle ? '42px' : '14px'} 11px 14px`,
                      fontSize: '14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      color: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s, background-color 0.2s',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(59,130,246,0.7)';
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.09)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                    }}
                  />
                  {settings.show_password_toggle && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: 'rgba(255,255,255,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="login-submit-btn"
                disabled={isLoading || !username || !password}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isLoading || !username || !password ? 'not-allowed' : 'pointer',
                  background: isLoading || !username || !password
                    ? 'rgba(59,130,246,0.4)'
                    : 'linear-gradient(135deg, hsl(215,72%,43%) 0%, hsl(215,75%,60%) 100%)',
                  color: '#ffffff',
                  letterSpacing: '0.3px',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 14px rgba(59,130,246,0.25)',
                }}
              >
                {isLoading ? 'Signing in...' : settings.login_button_text}
              </button>
            </form>

            {/* Dev credentials (admin-controlled) */}
            {settings.show_development_credentials && (
              <div
                style={{
                  marginTop: '20px',
                  padding: '12px 14px',
                  backgroundColor: 'rgba(234,179,8,0.1)',
                  border: '1px solid rgba(234,179,8,0.25)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: 'rgba(253,224,71,0.8)',
                }}
              >
                <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'rgba(253,224,71,0.9)' }}>
                  🔧 Development Credentials
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
                  <span>Admin: <code style={{ fontFamily: 'monospace' }}>admin / admin123</code></span>
                  <span>HOD: <code style={{ fontFamily: 'monospace' }}>hod / hod123</code></span>
                  <span>Teacher: <code style={{ fontFamily: 'monospace' }}>teacher / teacher123</code></span>
                  <span>Student: <code style={{ fontFamily: 'monospace' }}>student / student123</code></span>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer
          style={{
            textAlign: 'center',
            padding: '16px 24px',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.35)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {settings.footer_text || `© ${new Date().getFullYear()} ${settings.college_name}. All rights reserved.`}
        </footer>
      </div>
    </div>
  );
};
