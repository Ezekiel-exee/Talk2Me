import { X } from 'lucide-react';
import { colorFor, initialOf } from '../lib/utils';

export default function MemberSidebar({ members, limit, userId, open, onClose }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-60 flex-col bg-discord-sidebar transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-12 items-center justify-between border-b border-black/20 px-4 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-discord-muted">
            Online in Lobby ({members.length}/{limit})
          </span>
          <button type="button" onClick={onClose} className="text-discord-muted hover:text-white lg:hidden" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-discord-hover">
              <div className="relative">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: colorFor(m.userId) }}
                >
                  {initialOf(m.username)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-discord-sidebar bg-discord-green" />
              </div>
              <span className="min-w-0 flex-1 truncate font-medium" style={{ color: colorFor(m.userId) }}>
                {m.username}
              </span>
              {m.userId === userId && <span className="text-xs text-discord-muted">(you)</span>}
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
