import { useState } from 'react';
import Modal, { Field, inputClass, primaryBtn } from './Modal';

export default function UsernameModal({ initialName = '', required = false, onSubmit, onClose }) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 24;

  const submit = (e) => {
    e.preventDefault();
    if (valid) onSubmit(trimmed);
  };

  return (
    <Modal
      title={required ? 'Welcome to Talk2Me!' : 'Change username'}
      subtitle={required ? 'Pick a username to get started. No account needed.' : 'Your new name shows up instantly in lobbies.'}
      onClose={required ? undefined : onClose}
    >
      <form onSubmit={submit}>
        <Field label="Username" hint="2-24 characters">
          <input
            autoFocus
            className={inputClass}
            value={name}
            maxLength={24}
            placeholder="CoolPanda42"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          {!required && (
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-white hover:underline">
              Cancel
            </button>
          )}
          <button type="submit" disabled={!valid} className={primaryBtn}>
            {required ? "Let's go" : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
