import { useState } from 'react';
import Modal, { Field, inputClass, primaryBtn } from './Modal';

export default function CreateRoomModal({ onSubmit, onClose }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [limit, setLimit] = useState(10);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const limitValid = Number.isInteger(limit) && limit >= 2 && limit <= 50;
  const valid = name.trim().length > 0 && password.length > 0 && limitValid;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError('');
    const message = await onSubmit({ name: name.trim(), password, maxUsers: limit });
    if (message) {
      setError(message);
      setBusy(false);
    }
  };

  return (
    <Modal title="Create a Lobby" subtitle="Set a password and a member limit for your group chat." onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Room name">
          <input
            autoFocus
            className={inputClass}
            value={name}
            maxLength={40}
            placeholder="Friday Night Squad"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Room password">
          <input
            type="password"
            className={inputClass}
            value={password}
            maxLength={64}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label={`User limit (${limitValid ? limit : '2-50'})`} hint="Between 2 and 50 users">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={2}
              max={50}
              value={limitValid ? limit : 2}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="flex-1 accent-discord-blurple"
            />
            <input
              type="number"
              min={2}
              max={50}
              value={Number.isNaN(limit) ? '' : limit}
              onChange={(e) => setLimit(e.target.value === '' ? NaN : parseInt(e.target.value, 10))}
              className={`${inputClass} w-20`}
            />
          </div>
        </Field>
        {error && <p className="mb-4 text-sm text-discord-red">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-white hover:underline">
            Cancel
          </button>
          <button type="submit" disabled={!valid || busy} className={primaryBtn}>
            {busy ? 'Creating...' : 'Create Lobby'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
