-- Jungle Coach: run this once in the Supabase SQL editor (Dashboard > SQL editor > New query > Run).
-- Each signed-in player can read and write only their own rows. The stats function acts as the signed-in player,
-- so the server needs no database secret.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  riot_name text,
  riot_tag text,
  region text not null default 'na',
  role text not null default 'jungle' check (role in ('jungle', 'support', 'top')),
  mains text[] not null default '{}',
  puuid text,
  updated_at timestamptz not null default now()
);

-- One row per game, kept for good: the review list reads these. role is the position played ('jungle', 'support', 'top',
-- 'mid', 'adc') or 'skip' for a game with nothing to review (a remake). v is the version of the saved analysis; the sync
-- redoes rows with an older one. note and reviewed_at are the player's own review of that game.
create table if not exists public.player_games (
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id text not null,
  role text not null,
  created timestamptz not null,
  analysis jsonb,
  v smallint not null default 1,
  note text,
  reviewed_at timestamptz,
  primary key (user_id, match_id),
  constraint player_games_note_length check (note is null or char_length(note) <= 4000)
);
alter table public.player_games add column if not exists v smallint not null default 1;
alter table public.player_games add column if not exists note text;
alter table public.player_games add column if not exists reviewed_at timestamptz;
-- The main role a player can pick grew with the site: top was added after jungle and support.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('jungle', 'support', 'top'));
create index if not exists player_games_recent on public.player_games (user_id, created desc);

create table if not exists public.player_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stats jsonb not null,
  updated_at timestamptz not null default now()
);

-- Lesson and drill progress, and the live-game tracker, so they follow the player across devices.
create table if not exists public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.player_games enable row level security;
alter table public.player_stats enable row level security;
alter table public.app_state enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "read own games" on public.player_games;
drop policy if exists "own games" on public.player_games;
create policy "own games" on public.player_games for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "read own stats" on public.player_stats;
drop policy if exists "own stats" on public.player_stats;
create policy "own stats" on public.player_stats for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "own state" on public.app_state;
create policy "own state" on public.app_state for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- A player may change their Riot ID but must not be able to point the cached account id at someone else by hand:
-- clear it whenever the Riot ID or region changes, so the server looks it up again.
create or replace function public.profiles_reset_puuid() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.riot_name is distinct from old.riot_name or new.riot_tag is distinct from old.riot_tag or new.region is distinct from old.region then
    new.puuid := null;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_reset_puuid on public.profiles;
create trigger profiles_reset_puuid before update on public.profiles for each row execute function public.profiles_reset_puuid();
