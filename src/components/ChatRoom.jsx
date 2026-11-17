import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Hash, Lock, LogOut, Menu, SendHorizontal, Users, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { colorFor, getUserSecret, initialOf, newId, shortTime } from '../lib/utils';
import ConfirmLeaveModal from './ConfirmLeaveModal';
import MessageItem from './MessageItem';
import MessageActionSheet from './MessageActionSheet';

const MAX_LEN = 2000;
const MAX_INPUT_PX = 120;
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const TYPING_REFRESH_MS = 2500;
const TYPING_IDLE_MS = 3000;
const MESSAGE_COLUMNS = 'id, room_id, user_id, username, content, created_at, reply_to, edited_at';

const reactionKey = (r) => `${r.message_id}|${r.user_id}|${r.emoji}`;
const oneLine = (text, max = 100) => text.replace(/\s+/g, ' ').trim().slice(0, max);

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
  const [reactions, setReactions] = useState([]);
  const [replyCache, setReplyCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [sheetMsg, setSheetMsg] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const stickRef = useRef(true);
  const latestIdRef = useRef(null);
  const visibleRef = useRef(visible);
  const typingSentAt = useRef(0);
  const typingIdle = useRef(null);
  const reactionsRef = useRef([]);
  const requestedReplies = useRef(new Set());

  visibleRef.current = visible;
  reactionsRef.current = reactions;

  const addReactions = useCallback((rows) => {
    setReactions((prev) => {
      const seen = new Set(prev.map(reactionKey));
      const fresh = rows.filter((r) => !seen.has(reactionKey(r)));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, []);

  const removeReaction = useCallback((row) => {
    setReactions((prev) => prev.filter((r) => reactionKey(r) !== reactionKey(row)));
  }, []);

  useEffect(() => {
    setMessages([]);
    setReactions([]);
    setReplyCache({});
    setReplyingTo(null);
    setEditingId(null);
    requestedReplies.current = new Set();
    setLoading(true);
    setError('');
    let cancelled = false;

    const merge = (incoming) =>
      setMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        incoming.forEach((m) => map.set(m.id, { ...map.get(m.id), ...m }));
        return [...map.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      });

    const msgFilter = { schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` };
    const reactFilter = { schema: 'public', table: 'message_reactions' };

    const channel = supabase
      .channel(`messages:${room.id}`)
      .on('postgres_changes', { event: 'INSERT', ...msgFilter }, (p) => merge([p.new]))
      .on('postgres_changes', { event: 'UPDATE', ...msgFilter }, (p) => merge([p.new]))
      .on('postgres_changes', { event: 'INSERT', ...reactFilter, filter: `room_id=eq.${room.id}` }, (p) =>
        addReactions([p.new]),
      )
      // DELETE events can't be filtered server-side, so check the room here.
      .on('postgres_changes', { event: 'DELETE', ...reactFilter }, (p) => {
        if (p.old?.room_id === room.id) removeReaction(p.old);
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;
        const { data, error: err } = await supabase
          .from('messages')
          .select(MESSAGE_COLUMNS)
          .eq('room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(100);
        if (cancelled) return;
        if (err) setError(err.message);
        else merge(data);
        setLoading(false);

        const { data: rows } = await supabase
          .from('message_reactions')
          .select('message_id, room_id, user_id, emoji')
          .eq('room_id', room.id)
          .order('created_at', { ascending: true })
          .limit(3000);
        if (!cancelled && rows) addReactions(rows);
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [room.id, addReactions, removeReaction]);

  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  // Fetch replied-to messages that are older than the loaded history.
  useEffect(() => {
    const missing = messages
      .map((m) => m.reply_to)
      .filter((id) => id && !messagesById.has(id) && !requestedReplies.current.has(id));
    if (!missing.length) return;
    const ids = [...new Set(missing)];
    ids.forEach((id) => requestedReplies.current.add(id));
    supabase
      .from('messages')
      .select('id, user_id, username, content')
      .in('id', ids)
      .then(({ data }) => {
        if (data) setReplyCache((prev) => ({ ...prev, ...Object.fromEntries(data.map((m) => [m.id, m])) }));
      });
  }, [messages, messagesById]);

  const items = useMemo(
    () =>
      [...messages, ...systemMessages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [messages, systemMessages],
  );

  // Current display name for each user: live presence name first, else the name on their messages.
  const currentNames = useMemo(() => {
    const map = new Map();
    messages.forEach((m) => map.set(m.user_id, m.username));
    members.forEach((m) => map.set(m.userId, m.username));
    map.set(userId, username);
    return map;
  }, [messages, members, userId, username]);

  const reactionsByMessage = useMemo(() => {
    const byMessage = new Map();
    reactions.forEach((r) => {
      const list = byMessage.get(r.message_id) ?? [];
      const entry = list.find((x) => x.emoji === r.emoji);
      if (entry) entry.userIds.push(r.user_id);
      else list.push({ emoji: r.emoji, userIds: [r.user_id] });
      byMessage.set(r.message_id, list);
    });
    return byMessage;
  }, [reactions]);

  const replyInfo = (item) => {
    if (!item.reply_to) return null;
    const target = messagesById.get(item.reply_to) ?? replyCache[item.reply_to];
    if (!target) return { found: false };
    return {
      found: true,
      userId: target.user_id,
      author: currentNames.get(target.user_id) ?? target.username,
      content: oneLine(target.content),
    };
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [items, visible, reactions]);

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

  // Grow with the text up to 4 lines (24px each + 24px padding), then scroll inside.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_INPUT_PX ? 'auto' : 'hidden';
    const list = scrollRef.current;
    if (list && stickRef.current) list.scrollTop = list.scrollHeight;
  }, [draft, visible, replyingTo]);

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

  const startReply = useCallback((item) => {
    setEditingId(null);
    setReplyingTo(item);
    inputRef.current?.focus();
  }, []);

  const startEdit = useCallback((item) => {
    setReplyingTo(null);
    setEditingId(item.id);
  }, []);

  const jumpTo = useCallback((id) => {
    const el = scrollRef.current?.querySelector(`[data-mid="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHighlightId(id);
    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1600);
  }, []);

  const secretArgs = () => ({ p_user_id: userId, p_secret: getUserSecret() });

  const react = async (item, emoji) => {
    const row = { message_id: item.id, room_id: room.id, user_id: userId, emoji };
    const had = reactionsRef.current.some((r) => reactionKey(r) === reactionKey(row));
    if (had) removeReaction(row);
    else addReactions([row]);

    const { error: err } = await supabase.rpc('toggle_reaction', {
      p_message_id: item.id,
      p_emoji: emoji,
      ...secretArgs(),
    });
    if (err) {
      if (had) addReactions([row]);
      else removeReaction(row);
      setError(`Couldn't react: ${err.message}`);
    }
  };

  const saveEdit = async (item, text) => {
    setEditingId(null);
    const previous = item;
    setMessages((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, content: text, edited_at: new Date().toISOString() } : m)),
    );
    const { error: err } = await supabase.rpc('edit_message', {
      p_id: item.id,
      p_content: text,
      ...secretArgs(),
    });
    if (err) {
      setMessages((prev) => prev.map((m) => (m.id === item.id ? previous : m)));
      setError(`Couldn't edit message: ${err.message}`);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    const replyTo = replyingTo?.id ?? null;
    setDraft('');
    setError('');
    setReplyingTo(null);
    stickRef.current = true;
    stopTyping();

    const message = {
      id: newId(),
      room_id: room.id,
      user_id: userId,
      username,
      content,
      reply_to: replyTo,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, message]);

    const { error: err } = await supabase.rpc('send_message', {
      p_id: message.id,
      p_room_id: room.id,
      p_username: username,
      p_content: content,
      p_reply_to: replyTo,
      ...secretArgs(),
    });
    if (err) {
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      setDraft(content);
      setError(`Message failed to send: ${err.message}`);
    }
  };

  // Enter sends, Shift+Enter adds a line. On touch screens Enter adds a line (use the send button).
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && replyingTo) {
      setReplyingTo(null);
      return;
    }
    if (e.key === 'ArrowUp' && !draft) {
      const last = [...messages].reverse().find((m) => m.user_id === userId);
      if (last) {
        e.preventDefault();
        startEdit(last);
      }
      return;
    }
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    e.currentTarget.form.requestSubmit();
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

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto overflow-x-hidden py-4">
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
            !item.reply_to &&
            prev.user_id === item.user_id &&
            new Date(item.created_at) - new Date(prev.created_at) < GROUP_WINDOW_MS;
          const readers = seenBy.get(item.id);

          return (
            <Fragment key={item.id}>
              <MessageItem
                item={item}
                grouped={grouped}
                author={currentNames.get(item.user_id) ?? item.username}
                replyTarget={replyInfo(item)}
                reactions={reactionsByMessage.get(item.id) ?? []}
                reactorNames={currentNames}
                myId={userId}
                isMine={item.user_id === userId}
                editing={editingId === item.id}
                highlight={highlightId === item.id}
                onReply={startReply}
                onStartEdit={startEdit}
                onCancelEdit={() => setEditingId(null)}
                onSaveEdit={saveEdit}
                onReact={react}
                onJump={jumpTo}
                onLongPress={setSheetMsg}
              />
              {readers && <SeenRow readers={readers} />}
            </Fragment>
          );
        })}
      </div>

      <form onSubmit={send} className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 md:px-4 md:pb-6">
        <TypingIndicator names={typingNames} />
        {error && <p className="mb-2 text-sm text-discord-red">{error}</p>}
        {replyingTo && (
          <div className="mb-1 flex items-center gap-2 rounded-lg bg-discord-sidebar px-3 py-1.5 text-sm text-discord-muted">
            <span className="shrink-0">Replying to</span>
            <span className="shrink-0 font-semibold" style={{ color: colorFor(replyingTo.user_id) }}>
              {currentNames.get(replyingTo.user_id) ?? replyingTo.username}
            </span>
            <span className="min-w-0 flex-1 truncate">{oneLine(replyingTo.content)}</span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Cancel reply"
              className="shrink-0 rounded-full p-0.5 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-lg bg-discord-input px-4">
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={MAX_LEN}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              stickRef.current = true;
              setTimeout(() => {
                const el = scrollRef.current;
                if (el) el.scrollTop = el.scrollHeight;
              }, 300);
            }}
            placeholder={`Message #${room.name}`}
            className="min-w-0 flex-1 resize-none bg-transparent py-3 leading-6 text-discord-text outline-none placeholder:text-discord-muted"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send"
            className="mb-3 text-discord-muted transition hover:text-discord-blurple disabled:opacity-40 disabled:hover:text-discord-muted"
          >
            <SendHorizontal size={20} />
          </button>
        </div>
      </form>

      <MessageActionSheet
        message={sheetMsg}
        isMine={sheetMsg?.user_id === userId}
        onClose={() => setSheetMsg(null)}
        onReact={react}
        onReply={startReply}
        onEdit={startEdit}
      />

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
