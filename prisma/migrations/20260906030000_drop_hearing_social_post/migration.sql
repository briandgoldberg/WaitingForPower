-- Cancelled the Bluesky/Mastodon auto-poster feature before either
-- platform was ever configured (table always had zero rows) — dropping
-- the now-unused tracking table it was built for.
DROP TABLE IF EXISTS "HearingSocialPost";
