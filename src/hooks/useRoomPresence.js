import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { newId } from '../lib/utils';

// Per-room presence: drives the member sidebar, join/leave notices and
// enforces the room's user limit (earliest joiners keep their seat).
export function useRoomPresence({ room, userId, username, onRoomFull }) {
  const [members, setMembers] = useState([]);
  const [systemMessages, setSystemMessages] = useState([]);
  const channelRef = useRef(null);
  const joinedAtRef = useRef(0);
  const usernameRef = useRef(username);
  const onRoomFullRef = useRef(onRoomFull);
  const readyRef = useRef(false);

  usernameRef.current = username;
  onRoomFullRef.current = onRoomFull;

  const roomId = room?.id;
  const maxUsers = room?.max_users;

  useEffect(() => {
    setMembers([]);
    setSystemMessages([]);
    readyRef.current = false;
    if (!roomId) return undefined;

    joinedAtRef.current = Date.now();
    let synced = false;
    let kicked = false;

    const channel = supabase.channel(`room:${roomId}`, { config: { presence: { key: userId } } });
    channelRef.current = channel;

    const pushSystem = (text) =>
      setSystemMessages((prev) => [
        ...prev,
        { id: newId(), type: 'system', text, created_at: new Date().toISOString() },
      ]);

    channel
      .on('presence', { event: 'sync' }, () => {
        if (kicked) return;
        const list = Object.entries(channel.presenceState())
          .map(([key, metas]) => ({
            userId: key,
            username: metas[metas.length - 1].username,
            joinedAt: Math.min(...metas.map((m) => m.joinedAt ?? 0)),
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
      .on('presence', { event: 'join' }, ({ key, newPresences, currentPresences }) => {
        if (!synced || kicked || key === userId || currentPresences.length > 0) return;
        pushSystem(`${newPresences[0]?.username ?? 'Someone'} joined the lobby`);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        if (!synced || kicked || key === userId) return;
        if ((channel.presenceState()[key] ?? []).length > 0) return;
        pushSystem(`${leftPresences[0]?.username ?? 'Someone'} left the lobby`);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          readyRef.current = true;
          channel.track({ username: usernameRef.current, joinedAt: joinedAtRef.current });
        }
      });

    return () => {
      readyRef.current = false;
      channelRef.current = null;
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [roomId, maxUsers, userId]);

  useEffect(() => {
    if (readyRef.current && channelRef.current) {
      channelRef.current.track({ username, joinedAt: joinedAtRef.current });
    }
  }, [username]);

  return { members, systemMessages };
}
