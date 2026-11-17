import { useState } from 'react';
import { Archive, Hash, Lock, MessageCircle, Pencil, Plus, RotateCcw } from 'lucide-react';
import { colorFor, initialOf } from '../lib/utils';

export default function LobbySidebar({
  rooms,
  archivedRooms,
  occupancy,
  loading,
  error,
  activeRoomId,
  userId,
  username,
  open,
  onClose,
  onSelectRoom,
  onRestoreRoom,
  onCreate,
  onEditName,
}) {
  const [showArchived, setShowArchived] = useState(false);
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[19.5rem] shrink-0 transition-transform md:static md:w-auto md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="flex w-[72px] flex-col items-center gap-2 bg-discord-rail py-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-discord-blurple text-white">
            <MessageCircle size={26} />
          </div>
          <div className="my-1 h-0.5 w-8 rounded bg-discord-hover" />
          <button
            type="button"
            onClick={onCreate}
            title="Create Lobby"
            className="flex h-12 w-12 items-center justify-center rounded-3xl bg-discord-chat text-discord-green transition-all hover:rounded-2xl hover:bg-discord-green hover:text-white"
          >
            <Plus size={24} />
          </button>
        </nav>

        <div className="flex w-60 flex-col bg-discord-sidebar">
          <div className="flex h-12 items-center border-b border-black/20 px-4 font-semibold text-white shadow-sm">
            Talk2Me Lobbies
          </div>

          <div className="px-2 pt-3">
            <button
              type="button"
              onClick={onCreate}
              className="flex w-full items-center justify-center gap-2 rounded bg-discord-blurple px-3 py-2 text-sm font-medium text-white transition hover:bg-discord-blurpleHover"
            >
              <Plus size={16} /> Create Lobby
            </button>
          </div>

          <div className="px-4 pb-1 pt-4 text-xs font-bold uppercase tracking-wide text-discord-muted">
            Public Lobbies - {rooms.length}
          </div>

          <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
            {loading && <p className="px-2 py-2 text-sm text-discord-muted">Loading lobbies...</p>}
            {error && <p className="px-2 py-2 text-sm text-discord-red">Couldn't load lobbies: {error}</p>}
            {!loading && !error && rooms.length === 0 && (
              <p className="px-2 py-2 text-sm text-discord-muted">No lobbies yet. Create the first one!</p>
            )}
            {rooms.map((room) => {
              const count = occupancy[room.id] ?? 0;
              const full = count >= room.max_users;
              const active = room.id === activeRoomId;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => onSelectRoom(room)}
                  className={`group flex w-full items-center gap-2 rounded px-2 py-2 text-left transition ${
                    active ? 'bg-discord-input text-white' : 'text-discord-muted hover:bg-discord-hover hover:text-discord-text'
                  }`}
                >
                  <Hash size={18} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-medium">{room.name}</span>
                  <Lock size={13} className="shrink-0" aria-label="Password protected" />
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                      full ? 'bg-discord-red/20 text-discord-red' : 'bg-discord-rail text-discord-text'
                    }`}
                    title="Members online / limit"
                  >
                    {count}/{room.max_users}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-black/20 px-2 py-2">
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs font-bold uppercase tracking-wide text-discord-muted hover:text-discord-text"
            >
              <Archive size={14} /> Archived Lobbies - {archivedRooms.length}
            </button>
            {showArchived && (
              <div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                {archivedRooms.length === 0 && (
                  <p className="px-2 py-1 text-sm text-discord-muted">Nothing archived. Empty lobbies show up here.</p>
                )}
                {archivedRooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => onRestoreRoom(room)}
                    title="Restore this lobby"
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-discord-muted hover:bg-discord-hover hover:text-discord-text"
                  >
                    <Hash size={16} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{room.name}</span>
                    <RotateCcw size={14} className="shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 bg-[#232428] px-2 py-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-white"
              style={{ backgroundColor: colorFor(userId) }}
            >
              {initialOf(username)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{username}</div>
              <div className="text-xs text-discord-muted">Anonymous</div>
            </div>
            <button
              type="button"
              onClick={onEditName}
              title="Edit username"
              className="rounded p-2 text-discord-muted hover:bg-discord-hover hover:text-white"
            >
              <Pencil size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
