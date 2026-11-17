import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

// One global presence channel: every client reports which room it is in, so the
// lobby browser can show live occupancy for every room.
export function useLobbyPresence({ userId, username, roomId }) {
  const [occupancy, setOccupancy] = useState({});
  const [ready, setReady] = useState(false);
  const channelRef = useRef(null);

  useEffect(() => {
    const channel = supabase.channel('lobby-presence', { config: { presence: { key: userId } } });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const sets = {};
        Object.entries(channel.presenceState()).forEach(([key, metas]) => {
          metas.forEach((m) => {
            if (!m.roomId) return;
            (sets[m.roomId] ||= new Set()).add(key);
          });
        });
        const counts = {};
        Object.entries(sets).forEach(([id, set]) => (counts[id] = set.size));
        setOccupancy(counts);
      })
      .subscribe((status) => setReady(status === 'SUBSCRIBED'));

    return () => {
      setReady(false);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (ready && channelRef.current) {
      channelRef.current.track({ roomId: roomId ?? null, username });
    }
  }, [ready, roomId, username]);

  return occupancy;
}
