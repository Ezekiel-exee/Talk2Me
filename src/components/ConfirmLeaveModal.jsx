import Modal, { primaryBtn } from './Modal';

export default function ConfirmLeaveModal({ room, isLast, onConfirm, onClose }) {
  return (
    <Modal title={`Leave ${room.name}?`} onClose={onClose}>
      <p className="text-center text-discord-muted">
        {isLast
          ? "You're the only one here, so the lobby will be archived. You can restore it later with its password."
          : "You'll stop receiving messages from this lobby."}
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-white hover:underline">
          Stay
        </button>
        <button
          type="button"
          autoFocus
          onClick={onConfirm}
          className={`${primaryBtn} !bg-discord-red hover:!bg-red-700`}
        >
          Leave Lobby
        </button>
      </div>
    </Modal>
  );
}
