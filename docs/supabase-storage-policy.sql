-- Supabase Storage policy for Pilketos candidate photos.
--
-- Run this in Supabase SQL editor for the production project after the
-- `candidate-photos` bucket exists. The application writes through the
-- server-side service role key only; browser clients receive public read URLs.

update storage.buckets
set public = true
where id = 'candidate-photos';

drop policy if exists "candidate photos are publicly readable" on storage.objects;
drop policy if exists "candidate photos are not client writable" on storage.objects;
drop policy if exists "candidate photos are not client updatable" on storage.objects;
drop policy if exists "candidate photos are not client deletable" on storage.objects;

create policy "candidate photos are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'candidate-photos');

create policy "candidate photos are not client writable"
on storage.objects
for insert
to anon, authenticated
with check (false);

create policy "candidate photos are not client updatable"
on storage.objects
for update
to anon, authenticated
using (false)
with check (false);

create policy "candidate photos are not client deletable"
on storage.objects
for delete
to anon, authenticated
using (false);
