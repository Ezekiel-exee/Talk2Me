import { useCallback, useEffect, useState } from 'react';
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
  const { members, typingNames, markSeen, sendTyping } = useRoomPresence({
    room,
    userId,
    username,
    onRoomFull: handleFull,
  });

  // Only start reporting to the server once presence has given us a seat, so a
  // rejected join to a full lobby never posts "joined"/"left" notices.
  const [seated, setSeated] = useState(false);
  useEffect(() => {
    if (members.some((m) => m.userId === userId)) setSeated(true);
  }, [members, userId]);
  useRoomHeartbeat(room.id, userId, username, seated);

  return (
    <div className={visible ? 'contents' : 'hidden'}>
      <ChatRoom
        room={room}
        visible={visible}
        userId={userId}
        username={username}
        memberCount={members.length}
        members={members}
        typingNames={typingNames}
        onSeen={markSeen}
        onTyping={sendTyping}
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
