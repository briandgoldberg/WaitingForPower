-- Removed the Support/Against community vote feature (GreenlightVote) and
-- its UI/API entirely — dropping the now-unused table and its 18 rows of
-- historical vote data at the user's explicit request, not just leaving it
-- as orphaned schema.
DROP TABLE IF EXISTS "ProjectVerdict";
