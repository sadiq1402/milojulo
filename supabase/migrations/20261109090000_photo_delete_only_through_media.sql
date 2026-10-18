-- #168: a Member deletes a photo only through the media function's photo-delete, which removes
-- the row through delete_photo() and then its R2 file; a direct delete would orphan the file.
drop policy "Members delete their own photos" on public.photos;
revoke delete on public.photos from authenticated;
