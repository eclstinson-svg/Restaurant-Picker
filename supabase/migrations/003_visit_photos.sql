-- Photos on visits.
-- Run once: Supabase dashboard → SQL Editor → New query → paste → Run.
--
-- Files live in a PRIVATE storage bucket, in folders named after the couple:
--   visit-photos/<couple_id>/<visit_id>/<random>.jpg
-- Only members of that couple can see, add, or delete them.

-- ─── Table: which photos belong to which visit ───────────────────────────

create table public.visit_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits on delete cascade,
  couple_id uuid not null references public.couples on delete cascade,
  path text not null unique, -- location in the storage bucket
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index visit_photos_visit_idx on public.visit_photos (visit_id);

alter table public.visit_photos enable row level security;

create policy "members manage visit photos" on public.visit_photos
  for all to authenticated
  using (public.is_member(couple_id))
  with check (
    public.is_member(couple_id)
    and exists (select 1 from public.visits v where v.id = visit_id and v.couple_id = visit_photos.couple_id)
  );

-- ─── Storage bucket for the image files ──────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visit-photos', 'visit-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- The first folder in the file path is the couple's id.
create policy "members read couple photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'visit-photos' and public.is_member(((storage.foldername(name))[1])::uuid));

create policy "members upload couple photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'visit-photos' and public.is_member(((storage.foldername(name))[1])::uuid));

create policy "members delete couple photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'visit-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
