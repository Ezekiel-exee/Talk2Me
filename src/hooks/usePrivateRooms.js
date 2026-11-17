import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getUserSecret } from '../lib/utils';

// Private lobbies the user has joined through an invite link. They are hidden
// from the public list, so they are fetched with the user's secret instead.
export function usePrivateRooms(userId) {
  const [privateRooms, setPrivateRooms] = useState([]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc('list_private_rooms', { p_user_id: userId, p_secret: getUserSecret() })
      .then(({ data }) => {
        if (!cancelled && Array.isArray(data)) setPrivateRooms(data);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const upsertPrivateRoom = useCallback((room) => {
    setPrivateRooms((prev) =>
      prev.some((r) => r.id === room.id)
        ? prev.map((r) => (r.id === room.id ? { ...r, ...room } : r))
        : [room, ...prev],
    );
  }, []);

  const removePrivateRoom = useCallback((id) => {
    setPrivateRooms((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { privateRooms, upsertPrivateRoom, removePrivateRoom };
}
