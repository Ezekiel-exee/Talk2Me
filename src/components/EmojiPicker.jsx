import { EMOJI_GROUPS } from '../lib/emojis';

export default function EmojiPicker({ onPick, className = '' }) {
  return (
    <div
      className={`max-h-64 w-72 overflow-y-auto rounded-lg border border-black/30 bg-discord-sidebar p-2 shadow-2xl ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {EMOJI_GROUPS.map((group) => (
        <div key={group.name} className="mb-2 last:mb-0">
          <div className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-discord-muted">{group.name}</div>
          <div className="grid grid-cols-8 gap-0.5">
            {group.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onPick(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded text-xl hover:bg-discord-hover"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
