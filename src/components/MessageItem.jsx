import { useEffect, useRef, useState } from 'react';
import { CornerUpLeft, Pencil, SmilePlus } from 'lucide-react';
import { colorFor, formatTime, initialOf, shortTime } from '../lib/utils';
import { QUICK_EMOJIS } from '../lib/emojis';
import EmojiPicker from './EmojiPicker';

const SWIPE_TRIGGER_PX = 56;
const SWIPE_MAX_PX = 84;
const LONG_PRESS_MS = 450;

function EditBox({ initial, onSave, onCancel }) {
  const [text, setText] = useState(initial);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  useEffect(() => {
    const el = ref.current;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const save = () => {
    const value = text.trim();
    if (!value) return;
    if (value === initial.trim()) return onCancel();
    onSave(value);
  };

  return (
    <div className="mt-1 max-w-full">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
          else if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(pointer: coarse)').matches) {
            e.preventDefault();
            save();
          }
        }}
        className="w-full resize-none rounded-lg bg-discord-input px-3 py-2 leading-6 text-discord-text outline-none"
      />
      <div className="mt-1 text-xs text-discord-muted">
        escape to{' '}
        <button type="button" onClick={onCancel} className="text-discord-blurple hover:underline">
          cancel
        </button>{' '}
        • enter to{' '}
        <button type="button" onClick={save} className="text-discord-blurple hover:underline">
          save
        </button>
      </div>
    </div>
  );
}

export default function MessageItem({
  item,
  grouped,
  author,
  replyTarget,
  reactions,
  reactorNames,
  myId,
  isMine,
  editing,
  highlight,
  onReply,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onReact,
  onJump,
  onLongPress,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerUp, setPickerUp] = useState(false);
  const rowRef = useRef(null);
  const slideRef = useRef(null);
  const iconRef = useRef(null);
  const touch = useRef(null);
  const color = colorFor(item.user_id);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const close = (e) => {
      if (!rowRef.current?.querySelector('[data-picker]')?.contains(e.target)) setPickerOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setPickerOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [pickerOpen]);

  const react = (emoji) => {
    setPickerOpen(false);
    onReact(item, emoji);
  };

  // Open the picker upwards for messages in the lower half of the screen.
  const togglePicker = () => {
    const rect = rowRef.current?.getBoundingClientRect();
    setPickerUp(Boolean(rect) && rect.top > window.innerHeight / 2);
    setPickerOpen((v) => !v);
  };

  const setSlide = (dx, animate) => {
    const slide = slideRef.current;
    if (!slide) return;
    slide.style.transition = animate ? 'transform 200ms cubic-bezier(0.32,0.72,0,1)' : 'none';
    slide.style.transform = dx ? `translateX(${dx}px)` : '';
    if (iconRef.current) {
      iconRef.current.style.opacity = String(Math.min(1, Math.abs(dx) / SWIPE_TRIGGER_PX));
      iconRef.current.style.transform = `scale(${0.6 + 0.4 * Math.min(1, Math.abs(dx) / SWIPE_TRIGGER_PX)})`;
    }
  };

  // Touch: swipe left to reply, long-press for the action sheet.
  const onTouchStart = (e) => {
    if (editing || e.touches.length !== 1) return;
    const t = e.touches[0];
    const state = { x: t.clientX, y: t.clientY, mode: null, dx: 0, timer: null };
    state.timer = setTimeout(() => {
      if (state.mode === null) {
        state.mode = 'press';
        navigator.vibrate?.(15);
        onLongPress(item);
      }
    }, LONG_PRESS_MS);
    touch.current = state;
  };

  const onTouchMove = (e) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (s.mode === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      clearTimeout(s.timer);
      s.mode = dx < 0 && Math.abs(dx) > Math.abs(dy) * 1.2 ? 'swipe' : 'scroll';
    }
    if (s.mode === 'swipe') {
      s.dx = Math.max(dx, -SWIPE_MAX_PX);
      setSlide(s.dx, false);
    }
  };

  const onTouchEnd = () => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    clearTimeout(s.timer);
    if (s.mode === 'swipe') {
      setSlide(0, true);
      if (-s.dx >= SWIPE_TRIGGER_PX) {
        navigator.vibrate?.(10);
        onReply(item);
      }
    }
  };

  const content = editing ? (
    <EditBox initial={item.content} onSave={(text) => onSaveEdit(item, text)} onCancel={onCancelEdit} />
  ) : (
    <p className="whitespace-pre-wrap break-words text-discord-text">
      {item.content}
      {item.edited_at && (
        <span className="ml-1 text-[10px] text-discord-muted" title={`Edited ${formatTime(item.edited_at)}`}>
          (edited)
        </span>
      )}
    </p>
  );

  const reactionBar = reactions.length > 0 && (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((r) => {
        const mine = r.userIds.includes(myId);
        const names = r.userIds.map((id) => reactorNames.get(id) ?? 'Someone');
        return (
          <button
            key={r.emoji}
            type="button"
            onClick={() => onReact(item, r.emoji)}
            title={`${names.join(', ')} reacted with ${r.emoji}`}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-sm transition ${
              mine
                ? 'border-discord-blurple bg-discord-blurple/20 text-white'
                : 'border-transparent bg-discord-input text-discord-text hover:border-white/20'
            }`}
          >
            <span>{r.emoji}</span>
            <span className="text-xs font-semibold">{r.userIds.length}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={togglePicker}
        aria-label="Add reaction"
        className="rounded-md bg-discord-input px-1.5 py-1 text-discord-muted opacity-0 transition hover:text-white group-hover:opacity-100 [@media(pointer:coarse)]:hidden"
      >
        <SmilePlus size={14} />
      </button>
    </div>
  );

  const toolbar = !editing && (
    <div
      data-picker
      className={`absolute -top-3 right-4 z-10 ${pickerOpen ? 'flex' : 'hidden group-hover:flex'} [@media(pointer:coarse)]:!hidden`}
    >
      <div className="flex items-center rounded-md border border-black/30 bg-discord-sidebar p-0.5 shadow-lg">
        {QUICK_EMOJIS.slice(0, 3).map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => react(emoji)}
            className="flex h-7 w-7 items-center justify-center rounded text-base hover:bg-discord-hover"
            aria-label={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={togglePicker}
          className="flex h-7 w-7 items-center justify-center rounded text-discord-muted hover:bg-discord-hover hover:text-white"
          aria-label="Add reaction"
          title="Add reaction"
        >
          <SmilePlus size={16} />
        </button>
        <button
          type="button"
          onClick={() => onReply(item)}
          className="flex h-7 w-7 items-center justify-center rounded text-discord-muted hover:bg-discord-hover hover:text-white"
          aria-label="Reply"
          title="Reply"
        >
          <CornerUpLeft size={16} />
        </button>
        {isMine && (
          <button
            type="button"
            onClick={() => onStartEdit(item)}
            className="flex h-7 w-7 items-center justify-center rounded text-discord-muted hover:bg-discord-hover hover:text-white"
            aria-label="Edit"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
        )}
      </div>
      {pickerOpen && (
        <div className={`absolute right-0 ${pickerUp ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <EmojiPicker onPick={react} />
        </div>
      )}
    </div>
  );

  const replyLine = item.reply_to && (
    <button
      type="button"
      onClick={() => replyTarget?.found && onJump(item.reply_to)}
      className="mb-0.5 flex max-w-full items-center gap-1.5 pl-[3.5rem] text-left text-xs text-discord-muted hover:text-discord-text"
    >
      <CornerUpLeft size={12} className="shrink-0" />
      {replyTarget?.found ? (
        <>
          <span className="shrink-0 font-semibold" style={{ color: colorFor(replyTarget.userId) }}>
            {replyTarget.author}
          </span>
          <span className="truncate">{replyTarget.content}</span>
        </>
      ) : (
        <span className="italic">Original message unavailable</span>
      )}
    </button>
  );

  return (
    <div
      ref={rowRef}
      data-mid={item.id}
      className={`group relative touch-pan-y px-0 transition-colors duration-700 [@media(pointer:coarse)]:select-none [@media(pointer:coarse)]:[-webkit-touch-callout:none] ${
        highlight ? 'bg-discord-blurple/20' : 'hover:bg-black/5'
      } ${grouped ? 'py-0.5' : 'mt-3 py-0.5'}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onContextMenu={(e) => window.matchMedia('(pointer: coarse)').matches && e.preventDefault()}
    >
      <span
        ref={iconRef}
        aria-hidden="true"
        className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-discord-muted opacity-0"
      >
        <CornerUpLeft size={22} />
      </span>
      <div ref={slideRef} className="relative will-change-transform">
        {toolbar}
        {replyLine}
        {grouped ? (
          <div className="flex px-4">
            <span className="w-10 shrink-0 pt-0.5 text-center text-[10px] text-transparent group-hover:text-discord-muted">
              {shortTime(item.created_at)}
            </span>
            <div className="ml-4 min-w-0 flex-1">
              {content}
              {reactionBar}
            </div>
          </div>
        ) : (
          <div className="flex px-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {initialOf(author)}
            </div>
            <div className="ml-4 min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-medium" style={{ color }}>
                  {author}
                </span>
                <span className="text-xs text-discord-muted">{formatTime(item.created_at)}</span>
              </div>
              {content}
              {reactionBar}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
