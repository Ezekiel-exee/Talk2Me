import { useCallback, useState } from 'react';
import { newId } from '../lib/utils';

const ID_KEY = 'talk2me.userId';
const NAME_KEY = 'talk2me.username';

function loadUserId() {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = newId();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function useIdentity() {
  const [userId] = useState(loadUserId);
  const [username, setUsernameState] = useState(() => localStorage.getItem(NAME_KEY) || '');

  const setUsername = useCallback((name) => {
    const clean = name.trim();
    localStorage.setItem(NAME_KEY, clean);
    setUsernameState(clean);
  }, []);

  return { userId, username, setUsername };
}
