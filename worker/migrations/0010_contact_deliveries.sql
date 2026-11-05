-- Content-free, 7-day contact deduplication and abuse protection.
CREATE TABLE IF NOT EXISTS contact_deliveries (
  id TEXT PRIMARY KEY,
  voter TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','sent')),
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS contact_deliveries_voter_created ON contact_deliveries(voter,created);
CREATE INDEX IF NOT EXISTS contact_deliveries_created ON contact_deliveries(created);
