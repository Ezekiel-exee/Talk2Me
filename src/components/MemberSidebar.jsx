import { X } from 'lucide-react';
import { colorFor, initialOf } from '../lib/utils';
import { useSwipeToClose } from '../hooks/useSwipeToClose';

export default function MemberSidebar({ members, limit, userId, open, onClose }) {
  const swipe = useSwipeToClose('right', onClose);
  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/60 transition-opacity duration-300 ease-out motion-reduce:transition-none lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        {...swipe}
        className={`fixed inset-y-0 right-0 z-40 flex w-60 transform-gpu flex-col bg-discord-sidebar transition-[transform,visibility,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none lg:visible lg:static lg:translate-x-0 lg:shadow-none ${
          open ? 'visible translate-x-0 shadow-2xl' : 'invisible translate-x-full shadow-none'
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
