import { useCallback } from 'react';
import ChatRoom from './ChatRoom';
import MemberSidebar from './MemberSidebar';
import { useRoomPresence } from '../hooks/useRoomPresence';
import { useRoomHeartbeat } from '../hooks/useRoomHeartbeat';

// One mounted instance per joined lobby: it keeps presence, heartbeat and
// messages live even while another lobby is being viewed.
export default function RoomView({
  room,
  visible,
  userId,
  username,
  rightOpen,
  onCloseMembers,
  onLeave,
  onRoomFull,
  onOpenLobbies,
  onOpenMembers,
}) {
  const handleFull = useCallback(() => onRoomFull(room), [onRoomFull, room]);
  const { members, systemMessages } = useRoomPresence({ room, userId, username, onRoomFull: handleFull });
  useRoomHeartbeat(room.id, userId);

  return (
    <div className={visible ? 'contents' : 'hidden'}>
      <ChatRoom
        room={room}
        visible={visible}
        userId={userId}
        username={username}
        systemMessages={systemMessages}
        memberCount={members.length}
        members={members}
        onLeave={() => onLeave(room)}
        onOpenLobbies={onOpenLobbies}
        onOpenMembers={onOpenMembers}
      />
      <MemberSidebar
        members={members}
        limit={room.max_users}
        userId={userId}
        open={rightOpen}
        onClose={onCloseMembers}
      />
    </div>
  );
}
