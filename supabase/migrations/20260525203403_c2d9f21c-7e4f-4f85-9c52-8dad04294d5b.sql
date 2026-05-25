
-- ENUM for room ranks
create type public.room_rank as enum ('owner', 'admin', 'member');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  bio text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);
create policy "users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);
create policy "users insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- Rooms
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.rooms enable row level security;

create policy "rooms readable by authenticated"
  on public.rooms for select to authenticated using (true);
create policy "authenticated can create rooms"
  on public.rooms for insert to authenticated with check (auth.uid() = owner_id);
create policy "owner can update room"
  on public.rooms for update to authenticated using (auth.uid() = owner_id);
create policy "owner can delete room"
  on public.rooms for delete to authenticated using (auth.uid() = owner_id);

-- Room members (membership + rank + mute)
create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rank public.room_rank not null default 'member',
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table public.room_members enable row level security;

-- Helper: is user a member of a room
create or replace function public.is_room_member(_room uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.room_members where room_id = _room and user_id = _user)
$$;

-- Helper: user's rank in a room
create or replace function public.room_rank_of(_room uuid, _user uuid)
returns public.room_rank language sql stable security definer set search_path = public as $$
  select rank from public.room_members where room_id = _room and user_id = _user
$$;

-- Helper: user's joined_at in a room
create or replace function public.room_joined_at(_room uuid, _user uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select joined_at from public.room_members where room_id = _room and user_id = _user
$$;

create policy "members readable by authenticated"
  on public.room_members for select to authenticated using (true);
create policy "users can join rooms themselves"
  on public.room_members for insert to authenticated with check (auth.uid() = user_id);
create policy "users can leave (delete own membership)"
  on public.room_members for delete to authenticated using (
    auth.uid() = user_id
    or public.room_rank_of(room_id, auth.uid()) in ('owner','admin')
  );
create policy "owners/admins can update memberships"
  on public.room_members for update to authenticated using (
    public.room_rank_of(room_id, auth.uid()) in ('owner','admin')
    or auth.uid() = user_id
  );

-- Room messages
create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.room_messages enable row level security;
create index on public.room_messages (room_id, created_at desc);

create policy "members read messages after their join time"
  on public.room_messages for select to authenticated using (
    public.is_room_member(room_id, auth.uid())
    and created_at >= public.room_joined_at(room_id, auth.uid())
  );
create policy "members can send messages"
  on public.room_messages for insert to authenticated with check (
    auth.uid() = user_id
    and public.is_room_member(room_id, auth.uid())
    and coalesce((select muted from public.room_members where room_id = room_messages.room_id and user_id = auth.uid()), false) = false
  );
create policy "sender or admins can delete"
  on public.room_messages for delete to authenticated using (
    auth.uid() = user_id
    or public.room_rank_of(room_id, auth.uid()) in ('owner','admin')
  );

-- Auto-create profile on signup (username from raw_user_meta_data)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-add owner as room member with owner rank
create or replace function public.handle_new_room()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.room_members (room_id, user_id, rank)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;
create trigger on_room_created
  after insert on public.rooms
  for each row execute function public.handle_new_room();

-- Realtime
alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.room_members;

-- Seed a couple of default rooms (owned by no one specific; use a placeholder via first user trigger? skip seed - users will create)
