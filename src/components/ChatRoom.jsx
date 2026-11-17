import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Lock, LogOut, Menu, SendHorizontal, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { colorFor, formatTime, initialOf, newId, shortTime } from '../lib/utils';
import ConfirmLeaveModal from './ConfirmLeaveModal';

const MAX_LEN = 2000;
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const TYPING_REFRESH_MS = 2500;
const TYPING_IDLE_MS = 3000;

function typingText(names) {
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length > 3 ? 's' : ''} are typing`;
}

function TypingIndicator({ names }) {
  return (
    <div className="flex h-5 items-center gap-2 text-xs font-medium text-discord-text" aria-live="polite">
      {names.length > 0 && (
        <>
          <span className="flex items-center gap-0.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-discord-text"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
          <span className="truncate">{typingText(names)}…</span>
        </>
      )}
    </div>
  );
}

function SeenRow({ readers }) {
  const names = readers.map((r) => r.username);
  const label = names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ');
  return (
    <div className="flex items-center gap-1.5 py-0.5 pl-[4.5rem] pr-4" title={`Seen by ${names.join(', ')}`}>
      <span className="flex -space-x-1">
        {readers.slice(0, 5).map((r) => (
          <span
            key={r.userId}
            className="flex h-4 w-4 items-center justify-center rounded-full border border-discord-chat text-[9px] font-bold text-white"
            style={{ backgroundColor: colorFor(r.userId) }}
          >
            {initialOf(r.username)}
          </span>
        ))}
      </span>
      <span className="truncate text-xs text-discord-muted">Seen by {label}</span>
    </div>
  );
}

export default function ChatRoom({
  room,
  userId,
  username,
  visible = true,
  systemMessages,
  memberCount,
  members,
  typingNames = [],
  onSeen,
  onTyping,
  onLeave,
  onOpenLobbies,
  onOpenMembers,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const scrollRef = useRef(null);
  const stickRef = useRef(true);
  const latestIdRef = useRef(null);
  const visibleRef = useRef(visible);
  const typingSentAt = useRef(0);
  const typingIdle = useRef(null);

  visibleRef.current = visible;

  useEffect(() => {
    setMessages([]);
    setLoading(true);
    setError('');
    let cancelled = false;

    const merge = (incoming) =>
      setMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        incoming.forEach((m) => map.set(m.id, m));
        return [...map.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });

    const channel = supabase
      .channel(`messages:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        (payload) => merge([payload.new]),
      )
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        const { data, error: err } = await supabase
          .from('messages')
          .select('id, room_id, user_id, username, content, created_at')
          .eq('room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(100);
        if (cancelled) return;
        if (err) setError(err.message);
        else merge(data);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [room.id]);

  const items = useMemo(
    () =>
      [...messages, ...systemMessages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [messages, systemMessages],
  );

  // Show each author's current name, so renames also apply to earlier messages.
  const currentNames = useMemo(() => {
    const map = new Map(members.map((m) => [m.userId, m.username]));
    map.set(userId, username);
    return map;
  }, [members, userId, username]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [items, visible]);

  latestIdRef.current = messages[messages.length - 1]?.id ?? null;

  // A message counts as seen once this lobby is on screen, the tab is in the
  // foreground and the newest message is in view.
  const reportSeen = useCallback(() => {
    if (visibleRef.current && document.visibilityState === 'visible' && stickRef.current) {
      onSeen(latestIdRef.current);
    }
  }, [onSeen]);

  useEffect(() => {
    reportSeen();
  }, [messages, visible, reportSeen]);

  useEffect(() => {
    document.addEventListener('visibilitychange', reportSeen);
    window.addEventListener('focus', reportSeen);
    return () => {
      document.removeEventListener('visibilitychange', reportSeen);
      window.removeEventListener('focus', reportSeen);
    };
  }, [reportSeen]);

  // For each other member, show their avatar under the newest message from someone
  // else that they have seen (like Messenger read receipts).
  const seenBy = useMemo(() => {
    const byMessage = new Map();
    members.forEach((m) => {
      if (m.userId === userId || !m.seenId) return;
      let idx = messages.findIndex((x) => x.id === m.seenId);
      while (idx >= 0 && messages[idx].user_id === m.userId) idx -= 1;
      if (idx < 0) return;
      const id = messages[idx].id;
      byMessage.set(id, [...(byMessage.get(id) ?? []), m]);
    });
    return byMessage;
  }, [members, messages, userId]);

  const onScroll = () => {
    const el = scrollRef.current;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (stickRef.current) reportSeen();
  };

  const stopTyping = () => {
    clearTimeout(typingIdle.current);
    if (typingSentAt.current) onTyping(false);
    typingSentAt.current = 0;
  };

  useEffect(() => () => clearTimeout(typingIdle.current), []);

  const handleChange = (e) => {
    const value = e.target.value;
    setDraft(value);
    if (!value.trim()) return stopTyping();
    const now = Date.now();
    if (now - typingSentAt.current > TYPING_REFRESH_MS) {
      typingSentAt.current = now;
      onTyping(true);
    }
    clearTimeout(typingIdle.current);
    typingIdle.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const send = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    setError('');
    stickRef.current = true;
    stopTyping();

    const message = {
      id: newId(),
      room_id: room.id,
      user_id: userId,
      username,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, message]);

    const { error: err } = await supabase.from('messages').insert(message);
    if (err) {
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      setDraft(content);
      setError(`Message failed to send: ${err.message}`);
    }
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-discord-chat">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/20 px-3 shadow-sm">
        <button type="button" onClick={onOpenLobbies} className="text-discord-muted hover:text-white md:hidden" aria-label="Open lobbies">
          <Menu size={22} />
        </button>
        <Hash size={22} className="shrink-0 text-discord-muted" />
        <h1 className="truncate font-semibold text-white">{room.name}</h1>
        <span className="flex items-center gap-1 rounded bg-discord-rail px-1.5 py-0.5 text-xs text-discord-muted">
          <Lock size={12} /> Private
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            className="flex items-center gap-1.5 rounded bg-discord-red px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700"
          >
            <LogOut size={15} /> <span className="hidden sm:inline">Leave Lobby</span>
          </button>
          <button type="button" onClick={onOpenMembers} className="flex items-center gap-1 text-discord-muted hover:text-white lg:hidden" aria-label="Show members">
            <Users size={20} />
            <span className="text-sm">{memberCount}</span>
          </button>
        </div>
      </header>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto py-4">
        <div className="px-4 pb-6">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-discord-input text-white">
            <Hash size={36} />
          </div>
          <h2 className="text-3xl font-bold text-white">Welcome to {room.name}!</h2>
          <p className="text-discord-muted">This is the start of the lobby. Say hi!</p>
        </div>

        {loading && <p className="px-4 text-sm text-discord-muted">Loading messages...</p>}

        {items.map((item, i) => {
          if (item.type === 'system') {
            return (
              <div key={item.id} className="flex items-center gap-2 px-4 py-1 text-sm text-discord-muted">
                <span className="text-discord-green">→</span>
                <span>{item.text}</span>
                <span className="text-xs">{shortTime(item.created_at)}</span>
              </div>
            );
          }
          const prev = items[i - 1];
          const grouped =
            prev &&
            prev.type !== 'system' &&
            prev.user_id === item.user_id &&
            new Date(item.created_at) - new Date(prev.created_at) < GROUP_WINDOW_MS;
          const color = colorFor(item.user_id);
          const author = currentNames.get(item.user_id) ?? item.username;

          const readers = seenBy.get(item.id);

          const row = grouped ? (
            <div className="group relative flex px-4 py-0.5 hover:bg-black/5">
              <span className="w-10 shrink-0 pt-0.5 text-center text-[10px] text-transparent group-hover:text-discord-muted">
                {shortTime(item.created_at)}
              </span>
              <p className="ml-4 min-w-0 whitespace-pre-wrap break-words text-discord-text">{item.content}</p>
            </div>
          ) : (
            <div className="mt-3 flex px-4 py-0.5 hover:bg-black/5">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {initialOf(author)}
              </div>
              <div className="ml-4 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium" style={{ color }}>
                    {author}
                  </span>
                  <span className="text-xs text-discord-muted">{formatTime(item.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-discord-text">{item.content}</p>
              </div>
            </div>
          );

          return (
            <Fragment key={item.id}>
              {row}
              {readers && <SeenRow readers={readers} />}
            </Fragment>
          );
        })}
      </div>

      <form onSubmit={send} className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 md:px-4 md:pb-6">
        <TypingIndicator names={typingNames} />
        {error && <p className="mb-2 text-sm text-discord-red">{error}</p>}
        <div className="flex items-center gap-2 rounded-lg bg-discord-input px-4">
          <input
            value={draft}
            maxLength={MAX_LEN}
            onChange={handleChange}
            onFocus={() => {
              stickRef.current = true;
              setTimeout(() => {
                const el = scrollRef.current;
                if (el) el.scrollTop = el.scrollHeight;
              }, 300);
            }}
            placeholder={`Message #${room.name}`}
            className="min-w-0 flex-1 bg-transparent py-3 text-discord-text outline-none placeholder:text-discord-muted"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send"
            className="text-discord-muted transition hover:text-discord-blurple disabled:opacity-40 disabled:hover:text-discord-muted"
          >
            <SendHorizontal size={20} />
          </button>
        </div>
      </form>
      {confirmLeave && (
        <ConfirmLeaveModal
          room={room}
          isLast={memberCount <= 1}
          onConfirm={() => {
            setConfirmLeave(false);
            onLeave();
          }}
          onClose={() => setConfirmLeave(false)}
        />
      )}
    </section>
  );
}
