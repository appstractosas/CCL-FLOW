import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled, size = 'sm' }) => {
  const w = size === 'md' ? 'w-11 h-6' : 'w-9 h-5';
  const dot = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex items-center ${w} rounded-full transition-colors shrink-0 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-emerald-500' : 'bg-zinc-700'}`}
    >
      <span
        className={`inline-block ${dot} bg-white rounded-full shadow transform transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
};
