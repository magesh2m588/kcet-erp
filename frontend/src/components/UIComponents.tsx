import React from 'react';
import styles from './UIComponents.module.css';
import { AlertTriangle, Info, Loader2, X } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'normal' | 'sm';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'normal',
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const variantClass =
    variant === 'primary'
      ? styles.btnPrimary
      : variant === 'danger'
      ? styles.btnDanger
      : styles.btnSecondary;
  const sizeClass = size === 'sm' ? styles.btnSm : '';

  return (
    <button
      className={`${styles.btn} ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" size={14} />}
      {children}
    </button>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className = '', ...props }, ref) => {
  return <input ref={ref} className={`${styles.input} ${className}`} {...props} />;
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className = '', children, ...props }, ref) => {
  return (
    <select ref={ref} className={`${styles.select} ${className}`} {...props}>
      {children}
    </select>
  );
});

export interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ label, error, children }) => {
  return (
    <div className={styles.formField}>
      <label className={styles.label}>{label}</label>
      {children}
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
};

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span>{title}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer && <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>
  );
};

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  loading = false,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Confirm
          </Button>
        </>
      }
    >
      <p style={{ fontSize: '13px', lineHeight: '1.5' }}>{message}</p>
    </Modal>
  );
};

export interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'neutral';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children }) => {
  const badgeClass =
    variant === 'success'
      ? styles.badgeSuccess
      : variant === 'warning'
      ? styles.badgeWarning
      : variant === 'error'
      ? styles.badgeError
      : styles.badgeNeutral;

  return <span className={`${styles.badge} ${badgeClass}`}>{children}</span>;
};

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, onClick }) => {
  return (
    <div
      className={styles.statCard}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div className={styles.statIcon}>{icon}</div>
      <div>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{title}</div>
      </div>
    </div>
  );
};

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading KCET ERP data...' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '10px' }}>
      <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary-color)' }} />
      <span style={{ fontSize: '13px', color: 'var(--muted-fg)' }}>{message}</span>
    </div>
  );
};

export const EmptyState: React.FC<{ message: string; action?: React.ReactNode }> = ({ message, action }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
      <Info size={24} style={{ color: 'var(--muted-fg)', marginBottom: '8px' }} />
      <p style={{ fontSize: '13px', color: 'var(--muted-fg)', marginBottom: action ? '12px' : '0' }}>{message}</p>
      {action}
    </div>
  );
};

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', border: '1px solid var(--badge-error-bg)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--subtle-bg)' }}>
      <AlertTriangle size={24} style={{ color: 'var(--badge-error-fg)', marginBottom: '8px' }} />
      <p style={{ fontSize: '13px', color: 'var(--badge-error-fg)', marginBottom: onRetry ? '12px' : '0' }}>{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
};
