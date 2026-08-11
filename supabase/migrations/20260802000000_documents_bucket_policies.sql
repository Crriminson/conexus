create policy "anon can upload to documents bucket"
on storage.objects for insert
to anon
with check (bucket_id = 'documents');

create policy "anon can read documents bucket"
on storage.objects for select
to anon
using (bucket_id = 'documents');
