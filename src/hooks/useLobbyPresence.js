import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';

// One global presence channel: every client reports which rooms it is in, so the
// lobby browser can show live occupancy for every room.
export function useLobbyPresence({ userId, username, roomIds }) {
  const [occupancy, setOccupancy] = useState({});
  const [ready, setReady] = useState(false);
  const channelRef = useRef(null);
  const roomsKey = roomIds.join(',');

  useEffect(() => {
    const channel = supabase.channel('lobby-presence', { config: { presence: { key: userId } } });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const sets = {};
        Object.entries(channel.presenceState()).forEach(([key, metas]) => {
          metas.forEach((m) => {
            (m.roomIds ?? []).forEach((id) => (sets[id] ||= new Set()).add(key));
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
      channelRef.current.track({ roomIds: roomsKey ? roomsKey.split(',') : [], username });
    }
  }, [ready, roomsKey, username]);

  return occupancy;
}
