-- Database setup for Where Should We Eat?
-- Run once: Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
--
-- Security model: every table has Row Level Security (RLS) turned on, so a
-- signed-in user can only read/write rows belonging to the couple they're in.

-- ─── Tables ──────────────────────────────────────────────────────────────

-- A shared space for two people. The partner joins with the invite code.
create table public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_at timestamptz not null default now()
);

-- Who is in which couple. A person can be in only one couple.
create table public.couple_members (
  couple_id uuid not null references public.couples on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id),
  unique (user_id)
);

-- Restaurants the couple has interacted with (visited, wishlisted, or hidden).
-- We keep a copy of the basic info so history still shows even without Google.
create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples on delete cascade,
  place_id text not null, -- Google's place ID
  name text not null,
  address text,
  cuisine_label text,
  price smallint check (price between 1 and 4),
  maps_url text,
  wishlist boolean not null default false,
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (couple_id, place_id)
);

-- Each time you go somewhere.
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples on delete cascade,
  saved_place_id uuid not null references public.saved_places on delete cascade,
  visited_on date not null default current_date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index visits_couple_idx on public.visits (couple_id, visited_on desc);

-- Each person's own rating of a visit.
create table public.visit_ratings (
  visit_id uuid not null references public.visits on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  note text check (char_length(note) <= 500),
  primary key (visit_id, user_id)
);

-- ─── Helper ──────────────────────────────────────────────────────────────

-- True if the signed-in user belongs to couple `c`.
create function public.is_member(c uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = c and user_id = auth.uid()
  );
$$;

-- ─── Row Level Security ──────────────────────────────────────────────────

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.saved_places enable row level security;
alter table public.visits enable row level security;
alter table public.visit_ratings enable row level security;

create policy "members read their couple" on public.couples
  for select to authenticated using (public.is_member(id));

create policy "members see each other" on public.couple_members
  for select to authenticated using (public.is_member(couple_id));

create policy "members manage saved places" on public.saved_places
  for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));

create policy "members manage visits" on public.visits
  for all to authenticated
  using (public.is_member(couple_id)) with check (public.is_member(couple_id));

create policy "members read ratings" on public.visit_ratings
  for select to authenticated
  using (exists (select 1 from public.visits v where v.id = visit_id and public.is_member(v.couple_id)));

create policy "add own rating" on public.visit_ratings
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.visits v where v.id = visit_id and public.is_member(v.couple_id))
  );

create policy "edit own rating" on public.visit_ratings
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "delete own rating" on public.visit_ratings
  for delete to authenticated using (user_id = auth.uid());

-- ─── Creating and joining a couple ───────────────────────────────────────
-- These run with extra privileges (security definer) because a person who
-- isn't in a couple yet can't see it, so they can't join by normal means.

create function public.create_couple(my_name text) returns public.couples
language plpgsql security definer set search_path = ''
as $$
declare
  c public.couples;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'You are already in a couple';
  end if;
  insert into public.couples default values returning * into c;
  insert into public.couple_members (couple_id, user_id, display_name)
    values (c.id, auth.uid(), trim(my_name));
  return c;
end;
$$;

create function public.join_couple(code text, my_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'You are already in a couple';
  end if;
  select id into cid from public.couples where invite_code = upper(trim(code));
  if cid is null then
    raise exception 'That invite code doesn''t exist';
  end if;
  if (select count(*) from public.couple_members where couple_id = cid) >= 2 then
    raise exception 'That couple already has two people';
  end if;
  insert into public.couple_members (couple_id, user_id, display_name)
    values (cid, auth.uid(), trim(my_name));
  return cid;
end;
$$;

revoke execute on function public.create_couple(text) from public, anon;
revoke execute on function public.join_couple(text, text) from public, anon;
grant execute on function public.create_couple(text) to authenticated;
grant execute on function public.join_couple(text, text) to authenticated;
