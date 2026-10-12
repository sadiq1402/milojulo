-- Deleting an account cascades into photos and prompts, which fires this trigger as the deleting
-- role. The Auth service can't read profiles, so it ran as the caller and failed every delete of a
-- submitted Member (#56). It only reads, so it runs as its owner.
alter function public.enforce_profile_minimum() security definer;
