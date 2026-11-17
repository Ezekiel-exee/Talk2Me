import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

const TYPING_TTL_MS = 5000;

// Per-room realtime channel: presence drives the member sidebar, the user limit
// (earliest joiners keep their seat) and read receipts; broadcast drives the typing
// indicator. Join/leave notices are persisted by the server (see room_heartbeat).
export function useRoomPresence({ room, userId, username, onRoomFull }) {
  const [members, setMembers] = useState([]);
  const [typing, setTyping] = useState({});
  const channelRef = useRef(null);
  const joinedAtRef = useRef(0);
  const seenRef = useRef(null);
  const usernameRef = useRef(username);
  const onRoomFullRef = useRef(onRoomFull);
  const readyRef = useRef(false);
  const typingTimers = useRef(new Map());

  usernameRef.current = username;
  onRoomFullRef.current = onRoomFull;

  const roomId = room?.id;
  const maxUsers = room?.max_users;

  const trackSelf = useCallback(() => {
    if (!readyRef.current || !channelRef.current) return;
    channelRef.current.track({
      username: usernameRef.current,
      joinedAt: joinedAtRef.current,
      seenId: seenRef.current,
    });
  }, []);

  useEffect(() => {
    setMembers([]);
    setTyping({});
    readyRef.current = false;
    seenRef.current = null;
    if (!roomId) return undefined;

    joinedAtRef.current = Date.now();
    let synced = false;
    let kicked = false;
    const timers = typingTimers.current;

    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    const clearTyping = (id) => {
      clearTimeout(timers.get(id));
      timers.delete(id);
      setTyping((prev) => {
        if (!(id in prev)) return prev;
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        if (kicked) return;
        const list = Object.entries(channel.presenceState())
          .map(([key, metas]) => ({
            userId: key,
            username: metas[metas.length - 1].username,
            joinedAt: Math.min(...metas.map((m) => m.joinedAt ?? 0)),
            seenId: [...metas].reverse().find((m) => m.seenId)?.seenId ?? null,
          }))
          .sort((a, b) => a.joinedAt - b.joinedAt || a.userId.localeCompare(b.userId));

        const myIndex = list.findIndex((m) => m.userId === userId);
        if (myIndex >= maxUsers) {
          kicked = true;
          channel.untrack();
          onRoomFullRef.current?.();
          return;
        }
        if (myIndex >= 0) synced = true;
        setMembers(list);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (!synced || kicked || key === userId) return;
        if ((channel.presenceState()[key] ?? []).length > 0) return;
        clearTyping(key);
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload?.userId || payload.userId === userId) return;
        if (!payload.typing) return clearTyping(payload.userId);
        setTyping((prev) => ({ ...prev, [payload.userId]: payload.username }));
        clearTimeout(timers.get(payload.userId));
        timers.set(
          payload.userId,
          setTimeout(() => clearTyping(payload.userId), TYPING_TTL_MS),
        );
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          readyRef.current = true;
          trackSelf();
        }
      });

    return () => {
      readyRef.current = false;
      channelRef.current = null;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [roomId, maxUsers, userId, trackSelf]);

  useEffect(() => {
    trackSelf();
  }, [username, trackSelf]);

  // Marks everything up to this message as read by me (shown to others as "Seen").
  const markSeen = useCallback(
    (messageId) => {
      if (!messageId || seenRef.current === messageId) return;
      seenRef.current = messageId;
      trackSelf();
    },
    [trackSelf],
  );

  const sendTyping = useCallback(
    (isTyping) => {
      if (!readyRef.current || !channelRef.current) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId, username: usernameRef.current, typing: isTyping },
      });
    },
    [userId],
  );

  const typingNames = Object.entries(typing)
    .filter(([id]) => members.some((m) => m.userId === id))
    .map(([id, name]) => members.find((m) => m.userId === id)?.username ?? name);

  return { members, typingNames, markSeen, sendTyping };
}
