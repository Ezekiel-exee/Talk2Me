import { useState } from 'react';
import { Lock } from 'lucide-react';
import Modal, { Field, inputClass, primaryBtn } from './Modal';

export default function PasswordModal({ room, restore = false, onSubmit, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    const message = await onSubmit(password);
    if (message) {
      setError(message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={room.name}
      subtitle={restore ? 'This lobby was archived. Enter its password to restore it.' : 'This lobby is password protected.'}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Field label="Room password">
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-discord-muted" />
            <input
              autoFocus
              type="password"
              className={`${inputClass} pl-9`}
              value={password}
              maxLength={64}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </Field>
        {error && <p className="-mt-2 mb-4 text-sm text-discord-red">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-white hover:underline">
            Cancel
          </button>
          <button type="submit" disabled={!password || busy} className={primaryBtn}>
            {busy ? 'Checking...' : restore ? 'Restore Lobby' : 'Join Lobby'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
