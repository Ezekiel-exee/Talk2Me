import { useEffect } from 'react';
import { supabase } from '../supabaseClient';

const INTERVAL_MS = 20000;

// Tells the server this lobby still has someone in it. Lobbies without a
// heartbeat for a couple of minutes are archived by a scheduled job.
export function useRoomHeartbeat(roomId) {
  useEffect(() => {
    if (!roomId) return undefined;
    const beat = () => supabase.rpc('room_heartbeat', { p_room_id: roomId });
    beat();
    const timer = setInterval(beat, INTERVAL_MS);
    const onVisible = () => document.visibilityState === 'visible' && beat();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [roomId]);
}
