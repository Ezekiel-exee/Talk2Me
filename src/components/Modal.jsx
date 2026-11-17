import { X } from 'lucide-react';

export default function Modal({ title, subtitle, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="relative w-full max-w-md rounded-md bg-discord-chat p-6 shadow-2xl">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 rounded p-1 text-discord-muted hover:text-white"
          >
            <X size={20} />
          </button>
        )}
        <h2 className="text-center text-2xl font-bold text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-center text-sm text-discord-muted">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-discord-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-discord-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded bg-discord-rail px-3 py-2.5 text-discord-text outline-none ring-discord-blurple placeholder:text-discord-muted/60 focus:ring-2';

export const primaryBtn =
  'rounded bg-discord-blurple px-4 py-2.5 text-sm font-medium text-white transition hover:bg-discord-blurpleHover disabled:cursor-not-allowed disabled:opacity-50';
