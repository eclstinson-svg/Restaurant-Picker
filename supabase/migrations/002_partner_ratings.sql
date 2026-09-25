-- Let either partner record both people's ratings when logging a visit together.
-- Run once: Supabase dashboard → SQL Editor → New query → paste → Run.
--
-- Before: you could only add your own rating.
-- After:  you can add a rating for anyone in your couple (still nobody else).
--         Editing and deleting a rating remain limited to its owner.

drop policy "add own rating" on public.visit_ratings;

create policy "add ratings for your couple" on public.visit_ratings
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.visits v
      join public.couple_members m on m.couple_id = v.couple_id
      where v.id = visit_ratings.visit_id
        and m.user_id = visit_ratings.user_id
        and public.is_member(v.couple_id)
    )
  );
