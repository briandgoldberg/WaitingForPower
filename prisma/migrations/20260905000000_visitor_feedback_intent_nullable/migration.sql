-- The feedback widget (src/components/FeedbackWidget.tsx, formerly
-- IntentWidget.tsx) no longer asks an "intent" question — it's a single
-- optional comment+email screen now. Made nullable rather than dropped so
-- historical answers aren't destroyed; no longer written by anything.
ALTER TABLE "VisitorFeedback" ALTER COLUMN "intent" DROP NOT NULL;
