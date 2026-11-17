-- Talk2Me schema. Paste into Supabase Dashboard -> SQL Editor -> Run. Safe to re-run.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  max_users   int  not null check (max_users between 2 and 50),
  created_by  text,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

-- Empty lobbies are archived (not deleted): hidden from the lobby list but
-- messages and settings are kept, and the lobby can be restored with its password.
alter table public.rooms add column if not exists archived_at timestamptz;

-- Who is currently inside each room (refreshed by client heartbeats, removed on leave).
-- Used to detect empty lobbies. Kept out of Realtime so heartbeats don't spam clients.
create table if not exists public.room_members (
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    text not null,
  last_seen  timestamptz not null default now(),
  primary key (room_id, user_id)
);
drop table if exists public.room_activity;

-- Password hashes live in a separate table that anon can NEVER read
-- (RLS enabled + no policies). Access only through the functions below.
create table if not exists public.room_secrets (
  room_id        uuid primary key references public.rooms(id) on delete cascade,
  password_hash  text not null
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  user_id     text not null check (char_length(user_id) between 1 and 64),
  username    text not null check (char_length(btrim(username)) between 1 and 32),
  content     text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists messages_room_created_idx on public.messages (room_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security (anonymous access)
-- ---------------------------------------------------------------------------
alter table public.rooms         enable row level security;
alter table public.room_secrets  enable row level security;
alter table public.room_members  enable row level security;
alter table public.messages      enable row level security;

drop policy if exists "rooms are publicly readable"    on public.rooms;
drop policy if exists "messages are publicly readable" on public.messages;
drop policy if exists "anyone can post messages"       on public.messages;

create policy "rooms are publicly readable"
  on public.rooms for select to anon, authenticated using (true);

create policy "messages are publicly readable"
  on public.messages for select to anon, authenticated using (true);

create policy "anyone can post messages"
  on public.messages for insert to anon, authenticated
  with check (exists (select 1 from public.rooms r where r.id = room_id and r.archived_at is null));

-- No insert/update/delete policies on rooms; rooms are created via create_room().
-- No policies at all on room_secrets / room_members.

-- Explicit table privileges (works even if "Automatically expose new tables" is off).
grant select on public.rooms to anon, authenticated;
grant select, insert on public.messages to anon, authenticated;
revoke all on public.room_secrets from anon, authenticated;
revoke all on public.room_members from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------
create or replace function public.create_room(p_name text, p_password text, p_max_users int, p_created_by text default null)
returns public.rooms
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_room public.rooms;
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 40 then
    raise exception 'Room name must be 1-40 characters';
  end if;
  if p_password is null or char_length(p_password) not between 1 and 64 then
    raise exception 'Password must be 1-64 characters';
  end if;
  if p_max_users is null or p_max_users not between 2 and 50 then
    raise exception 'User limit must be between 2 and 50';
  end if;

  insert into public.rooms (name, max_users, created_by)
  values (btrim(p_name), p_max_users, p_created_by)
  returning * into new_room;

  insert into public.room_secrets (room_id, password_hash)
  values (new_room.id, crypt(p_password, gen_salt('bf')));

  return new_room;
end;
$$;

create or replace function public.verify_room_password(p_room_id uuid, p_password text)
returns boolean
language sql
security definer
stable
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.room_secrets s
    where s.room_id = p_room_id
      and s.password_hash = crypt(p_password, s.password_hash)
  );
$$;

drop function if exists public.room_heartbeat(uuid);

-- Called every ~15s by each client inside a room.
create or replace function public.room_heartbeat(p_room_id uuid, p_user_id text)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  insert into public.room_members (room_id, user_id, last_seen)
  select r.id, p_user_id, now() from public.rooms r where r.id = p_room_id and r.archived_at is null
  on conflict (room_id, user_id) do update set last_seen = excluded.last_seen;
$$;

-- Called when a client leaves; archives the lobby right away if nobody is left.
create or replace function public.leave_room(p_room_id uuid, p_user_id text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.room_members where room_id = p_room_id and user_id = p_user_id;
  update public.rooms r
     set archived_at = now()
   where r.id = p_room_id
     and r.archived_at is null
     and not exists (
       select 1 from public.room_members m
       where m.room_id = r.id and m.last_seen > now() - interval '60 seconds'
     );
end;
$$;

-- Restores an archived lobby; requires the room password.
create or replace function public.restore_room(p_room_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.verify_room_password(p_room_id, p_password) then
    return false;
  end if;
  update public.rooms set archived_at = null where id = p_room_id;
  return true;
end;
$$;

-- Safety net for crashed tabs / lost connections: archives lobbies with no recent
-- heartbeat (new lobbies get 60s grace). Called by pg_cron, not by clients.
create or replace function public.archive_idle_rooms()
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  n int;
begin
  delete from public.room_members where last_seen < now() - interval '10 minutes';
  update public.rooms r
     set archived_at = now()
   where r.archived_at is null
     and r.created_at < now() - interval '60 seconds'
     and not exists (
       select 1 from public.room_members m
       where m.room_id = r.id and m.last_seen > now() - interval '60 seconds'
     );
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.create_room(text, text, int, text) from public;
revoke all on function public.verify_room_password(uuid, text)  from public;
revoke all on function public.room_heartbeat(uuid, text)        from public;
revoke all on function public.leave_room(uuid, text)            from public;
revoke all on function public.restore_room(uuid, text)          from public;
revoke all on function public.archive_idle_rooms()              from public, anon, authenticated;
grant execute on function public.create_room(text, text, int, text) to anon, authenticated;
grant execute on function public.verify_room_password(uuid, text)  to anon, authenticated;
grant execute on function public.room_heartbeat(uuid, text)        to anon, authenticated;
grant execute on function public.leave_room(uuid, text)            to anon, authenticated;
grant execute on function public.restore_room(uuid, text)          to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Scheduled safety net (pg_cron, every 30 seconds)
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('archive-idle-rooms', '30 seconds', 'select public.archive_idle_rooms()');

-- ---------------------------------------------------------------------------
-- Realtime replication (postgres_changes)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms') then
    alter publication supabase_realtime add table public.rooms;
  end if;
end
$$;
