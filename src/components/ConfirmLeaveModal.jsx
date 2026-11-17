import { useState } from 'react';
import Modal, { primaryBtn } from './Modal';

export default function ConfirmLeaveModal({ room, isLast, onConfirm, onClose }) {
  const [forget, setForget] = useState(false);
  const isPrivate = Boolean(room.is_private);

  return (
    <Modal title={`Leave ${room.name}?`} onClose={onClose}>
      <p className="text-center text-discord-muted">
        {isLast
          ? isPrivate
            ? "You're the only one here, so the lobby will be archived. Opening it from your list or its invite link brings it back."
            : "You're the only one here, so the lobby will be archived. You can restore it later with its password."
          : "You'll stop receiving messages from this lobby."}
      </p>
      {isPrivate && (
        <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg bg-discord-rail p-3 text-sm text-discord-text">
          <input
            type="checkbox"
            checked={forget}
            onChange={(e) => setForget(e.target.checked)}
            className="mt-0.5 accent-discord-blurple"
          />
          <span>
            Also remove it from my private lobbies
            <span className="block text-xs text-discord-muted">You'll need the invite link to get back in.</span>
          </span>
        </label>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-white hover:underline">
          Stay
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => onConfirm(forget)}
          className={`${primaryBtn} !bg-discord-red hover:!bg-red-700`}
        >
          Leave Lobby
        </button>
      </div>
    </Modal>
  );
}
