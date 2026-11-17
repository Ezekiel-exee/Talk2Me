import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const COLUMNS = 'id, name, max_users, created_at, archived_at';

export function useRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error: err } = await supabase
        .from('rooms')
        .select(COLUMNS)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (err) setError(err.message);
      else {
        setError(null);
        setRooms(data);
      }
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel('rooms-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setRooms((prev) => (prev.some((r) => r.id === payload.new.id) ? prev : [payload.new, ...prev]));
        } else if (payload.eventType === 'UPDATE') {
          setRooms((prev) => prev.map((r) => (r.id === payload.new.id ? { ...r, ...payload.new } : r)));
        } else if (payload.eventType === 'DELETE') {
          setRooms((prev) => prev.filter((r) => r.id !== payload.old.id));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load();
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { rooms, setRooms, loading, error };
}
