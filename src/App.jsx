import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, MessageCircle, Plus } from 'lucide-react';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import { useIdentity } from './hooks/useIdentity';
import { useRooms } from './hooks/useRooms';
import { useLobbyPresence } from './hooks/useLobbyPresence';
import { useRoomPresence } from './hooks/useRoomPresence';
import { useRoomHeartbeat } from './hooks/useRoomHeartbeat';
import LobbySidebar from './components/LobbySidebar';
import ChatRoom from './components/ChatRoom';
import MemberSidebar from './components/MemberSidebar';
import CreateRoomModal from './components/CreateRoomModal';
import PasswordModal from './components/PasswordModal';
import UsernameModal from './components/UsernameModal';

function SetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-discord-rail p-6 text-discord-text">
      <div className="max-w-lg rounded-md bg-discord-chat p-6 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Supabase isn't configured yet</h1>
        <p className="mb-3 text-discord-muted">
          Add your project credentials to the <code className="text-white">.env</code> file in the project root, then
          restart the dev server:
        </p>
        <pre className="overflow-x-auto rounded bg-discord-rail p-3 text-sm">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
        </pre>
      </div>
    </div>
  );
}

export default function App() {
  const { userId, username, setUsername } = useIdentity();
  const { rooms: allRooms, setRooms, loading, error } = useRooms();
  const rooms = allRooms.filter((r) => !r.archived_at);
  const archivedRooms = allRooms.filter((r) => r.archived_at);

  const [activeRoom, setActiveRoom] = useState(null);
  const [pendingRoom, setPendingRoom] = useState(null);
  const [pendingRestore, setPendingRestore] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showUsername, setShowUsername] = useState(false);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const verifiedRef = useRef(new Map());
  const healingRef = useRef('');

  const occupancy = useLobbyPresence({ userId, username, roomId: activeRoom?.id });
  useRoomHeartbeat(activeRoom?.id, userId);

  const flash = useCallback((text) => {
    setNotice(text);
    setTimeout(() => setNotice((current) => (current === text ? '' : current)), 5000);
  }, []);

  const handleRoomFull = useCallback(() => {
    setActiveRoom(null);
    flash('That lobby is full.');
  }, [flash]);

  const { members, systemMessages } = useRoomPresence({
    room: activeRoom,
    userId,
    username,
    onRoomFull: handleRoomFull,
  });

  // Drop out of a room that was deleted server-side.
  useEffect(() => {
    if (!loading && activeRoom && !allRooms.some((r) => r.id === activeRoom.id)) setActiveRoom(null);
  }, [allRooms, loading, activeRoom]);

  // If the lobby got archived while we're still in it (e.g. a throttled background
  // tab missed heartbeats), restore it using the password we already verified.
  useEffect(() => {
    const current = activeRoom && allRooms.find((r) => r.id === activeRoom.id);
    if (!current?.archived_at) {
      healingRef.current = '';
      return;
    }
    const password = verifiedRef.current.get(current.id);
    if (!password || healingRef.current === current.id) return;
    healingRef.current = current.id;
    supabase.rpc('restore_room', { p_room_id: current.id, p_password: password }).then(() => {}, () => {});
  }, [allRooms, activeRoom]);

  const isFull = (room) => (occupancy[room.id] ?? 0) >= room.max_users && room.id !== activeRoom?.id;

  const enterRoom = (room) => {
    setActiveRoom(room);
    setPendingRoom(null);
    setPendingRestore(false);
    setLeftOpen(false);
    setRightOpen(false);
  };

  const selectRoom = (room) => {
    if (room.id === activeRoom?.id) return setLeftOpen(false);
    if (isFull(room)) return flash(`"${room.name}" is full (${room.max_users}/${room.max_users}).`);
    if (verifiedRef.current.has(room.id)) return enterRoom(room);
    setPendingRestore(false);
    setPendingRoom(room);
  };

  const restoreRoom = (room) => {
    setPendingRestore(true);
    setPendingRoom(room);
    setLeftOpen(false);
  };

  const submitPassword = async (password) => {
    if (pendingRestore) {
      const { data, error: err } = await supabase.rpc('restore_room', {
        p_room_id: pendingRoom.id,
        p_password: password,
      });
      if (err) return err.message;
      if (!data) return 'Incorrect password.';
      const restored = { ...pendingRoom, archived_at: null };
      setRooms((prev) => prev.map((r) => (r.id === restored.id ? restored : r)));
      verifiedRef.current.set(restored.id, password);
      enterRoom(restored);
      return null;
    }
    if (isFull(pendingRoom)) return 'This lobby is full.';
    const { data, error: err } = await supabase.rpc('verify_room_password', {
      p_room_id: pendingRoom.id,
      p_password: password,
    });
    if (err) return err.message;
    if (!data) return 'Incorrect password.';
    verifiedRef.current.set(pendingRoom.id, password);
    enterRoom(pendingRoom);
    return null;
  };

  const createRoom = async ({ name, password, maxUsers }) => {
    const { data, error: err } = await supabase.rpc('create_room', {
      p_name: name,
      p_password: password,
      p_max_users: maxUsers,
      p_created_by: userId,
    });
    if (err) return err.message;
    const room = {
      id: data.id,
      name: data.name,
      max_users: data.max_users,
      created_at: data.created_at,
      archived_at: null,
    };
    setRooms((prev) => (prev.some((r) => r.id === room.id) ? prev : [room, ...prev]));
    verifiedRef.current.set(room.id, password);
    setShowCreate(false);
    enterRoom(room);
    return null;
  };

  if (!isSupabaseConfigured) return <SetupNotice />;

  const needsName = !username;

  return (
    <div className="flex h-screen overflow-hidden bg-discord-chat font-sans text-discord-text">
      <LobbySidebar
        rooms={rooms}
        archivedRooms={archivedRooms}
        occupancy={occupancy}
        loading={loading}
        error={error}
        activeRoomId={activeRoom?.id}
        userId={userId}
        username={username || '...'}
        open={leftOpen}
        onClose={() => setLeftOpen(false)}
        onSelectRoom={selectRoom}
        onRestoreRoom={restoreRoom}
        onCreate={() => {
          setShowCreate(true);
          setLeftOpen(false);
        }}
        onEditName={() => setShowUsername(true)}
      />

      {activeRoom ? (
        <>
          <ChatRoom
            key={activeRoom.id}
            room={activeRoom}
            userId={userId}
            username={username}
            systemMessages={systemMessages}
            memberCount={members.length}
            members={members}
            onLeave={() => setActiveRoom(null)}
            onOpenLobbies={() => setLeftOpen(true)}
            onOpenMembers={() => setRightOpen(true)}
          />
          <MemberSidebar
            members={members}
            limit={activeRoom.max_users}
            userId={userId}
            open={rightOpen}
            onClose={() => setRightOpen(false)}
          />
        </>
      ) : (
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 items-center gap-2 border-b border-black/20 px-3 md:hidden">
            <button type="button" onClick={() => setLeftOpen(true)} aria-label="Open lobbies">
              <Menu size={22} />
            </button>
            <span className="font-semibold text-white">Talk2Me</span>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-discord-blurple text-white">
              <MessageCircle size={40} />
            </div>
            <h1 className="text-2xl font-bold text-white">Pick a lobby to start chatting</h1>
            <p className="max-w-sm text-discord-muted">
              Choose a public lobby from the list, or create your own with a password and member limit.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded bg-discord-blurple px-4 py-2.5 font-medium text-white hover:bg-discord-blurpleHover"
            >
              <Plus size={18} /> Create Lobby
            </button>
          </div>
        </section>
      )}

      {notice && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded bg-discord-red px-4 py-2 text-sm font-medium text-white shadow-lg">
          {notice}
        </div>
      )}

      {(needsName || showUsername) && (
        <UsernameModal
          required={needsName}
          initialName={username}
          onSubmit={(name) => {
            setUsername(name);
            setShowUsername(false);
          }}
          onClose={() => setShowUsername(false)}
        />
      )}
      {!needsName && showCreate && <CreateRoomModal onSubmit={createRoom} onClose={() => setShowCreate(false)} />}
      {!needsName && pendingRoom && (
        <PasswordModal
          room={pendingRoom}
          restore={pendingRestore}
          onSubmit={submitPassword}
          onClose={() => setPendingRoom(null)}
        />
      )}
    </div>
  );
}
