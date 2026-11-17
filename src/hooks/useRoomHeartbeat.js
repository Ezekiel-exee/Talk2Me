import { useEffect, useRef } from 'react';
import { supabase, supabaseKey, supabaseUrl } from '../supabaseClient';
import { getUserSecret } from '../lib/utils';

const INTERVAL_MS = 15000;
const LEAVE_DELAY_MS = 1500;

// Pending "leave" calls are delayed briefly so a quick unmount/remount of the
// same room (React StrictMode, reconnects) never posts a leave notice or archives
// an occupied lobby.
const pendingLeaves = new Map();

// Tells the server who is inside a lobby. The server posts the "joined"/"left"
// notices from these calls and archives the lobby when the last member leaves;
// a scheduled job covers crashed tabs. Only runs once `enabled` (i.e. we hold a seat).
export function useRoomHeartbeat(roomId, userId, username, enabled = true) {
  const usernameRef = useRef(username);
  usernameRef.current = username;

  useEffect(() => {
    if (!roomId || !enabled) return undefined;
    const key = `${roomId}:${userId}`;
    clearTimeout(pendingLeaves.get(key));
    pendingLeaves.delete(key);

    // PostgREST builders only send the request once awaited, hence the .then().
    const beat = () =>
      supabase
        .rpc('room_heartbeat', {
          p_room_id: roomId,
          p_user_id: userId,
          p_secret: getUserSecret(),
          p_username: usernameRef.current,
        })
        .then(() => {}, () => {});
    beat();
    const timer = setInterval(beat, INTERVAL_MS);
    const onVisible = () => document.visibilityState === 'visible' && beat();
    // Closing the tab: keepalive lets the request outlive the page.
    const onPageHide = () => {
      fetch(`${supabaseUrl}/rest/v1/rpc/leave_room`, {
        method: 'POST',
        keepalive: true,
        headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_room_id: roomId, p_user_id: userId, p_secret: getUserSecret() }),
      }).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onPageHide);
      pendingLeaves.set(
        key,
        setTimeout(() => {
          pendingLeaves.delete(key);
          supabase
            .rpc('leave_room', { p_room_id: roomId, p_user_id: userId, p_secret: getUserSecret() })
            .then(() => {}, () => {});
        }, LEAVE_DELAY_MS),
      );
    };
  }, [roomId, userId, enabled]);
}
