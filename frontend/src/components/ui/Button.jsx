import React from 'react';
import Spinner from './Spinner';

const variants = {
  primary: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
  },
  secondary: {
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  },
  danger: {
    background: '#c0392b',
    color: '#fff',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
  },
};

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  style = {},
  size = 'md',
}) {
  const padding = size === 'sm' ? '5px 10px' : size === 'lg' ? '12px 24px' : '8px 16px';
  const fontSize = size === 'sm' ? '0.8rem' : size === 'lg' ? '1rem' : '0.875rem';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...variants[variant],
        padding,
        fontSize,
        borderRadius: 'var(--radius-sm)',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.2s, opacity 0.2s',
        ...style,
      }}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}
