const COLORS = [
  '#f47b67', '#f0b232', '#23a55a', '#5865F2', '#eb459e',
  '#3ba7e0', '#c77dff', '#4fd1c5', '#ff8a5b', '#a3e635',
];

export function colorFor(id = '') {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export function initialOf(name = '?') {
  return (name.trim()[0] || '?').toUpperCase();
}

export function formatTime(iso) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Today at ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString()} ${time}`;
}

export function shortTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function newId() {
  return crypto.randomUUID();
}

let cachedSecret = null;

// Private per-browser secret proving ownership of this user id for edits/reactions.
export function getUserSecret() {
  if (!cachedSecret) {
    cachedSecret = localStorage.getItem('talk2me.secret');
    if (!cachedSecret) {
      cachedSecret = `${newId()}${newId()}`;
      localStorage.setItem('talk2me.secret', cachedSecret);
    }
  }
  return cachedSecret;
}
