import { useRef, useState } from 'react';
import { Copy, CornerUpLeft, Pencil } from 'lucide-react';
import { QUICK_EMOJIS } from '../lib/emojis';
import EmojiPicker from './EmojiPicker';

// Mobile bottom sheet opened by long-pressing a message.
export default function MessageActionSheet({ message, isMine, onClose, onReact, onReply, onEdit }) {
  const [more, setMore] = useState(false);
  const lastRef = useRef(null);
  const open = Boolean(message);
  if (message) lastRef.current = message;
  const shown = message ?? lastRef.current;

  const run = (fn) => () => {
    fn();
    onClose();
  };

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-[55] bg-black/60 transition-opacity duration-300 motion-reduce:transition-none ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-label="Message actions"
        className={`fixed inset-x-0 bottom-0 z-[56] rounded-t-2xl bg-discord-sidebar pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
          open ? 'translate-y-0' : 'invisible translate-y-full'
        }`}
      >
        <div className="mx-auto my-2 h-1 w-10 rounded-full bg-white/20" />
        {shown && (
          <div className="px-4 pb-2">
            <p className="mb-3 line-clamp-2 break-words text-sm text-discord-muted">{shown.content}</p>
            <div className="mb-3 flex items-center justify-between gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={run(() => onReact(shown, emoji))}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-discord-input text-2xl active:bg-discord-hover"
                >
                  {emoji}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMore((v) => !v)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-discord-input text-lg font-bold text-discord-muted active:bg-discord-hover"
                aria-label="More emojis"
              >
                {more ? 'â€“' : '+'}
              </button>
            </div>
            {more && (
              <div className="mb-3 flex justify-center">
                <EmojiPicker onPick={(emoji) => { onReact(shown, emoji); onClose(); }} className="w-full max-w-sm" />
              </div>
            )}
            <div className="divide-y divide-white/5 overflow-hidden rounded-xl bg-discord-input">
              <button type="button" onClick={run(() => onReply(shown))} className="flex w-full items-center gap-3 px-4 py-3 text-left text-discord-text active:bg-discord-hover">
                <CornerUpLeft size={18} /> Reply
              </button>
              {isMine && (
                <button type="button" onClick={run(() => onEdit(shown))} className="flex w-full items-center gap-3 px-4 py-3 text-left text-discord-text active:bg-discord-hover">
                  <Pencil size={18} /> Edit message
                </button>
              )}
              <button
                type="button"
                onClick={run(() => navigator.clipboard?.writeText(shown.content))}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-discord-text active:bg-discord-hover"
              >
                <Copy size={18} /> Copy text
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
