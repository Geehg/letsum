-- Public scanner results. request_id is an unpublished per-operation retry key.
CREATE TABLE IF NOT EXISTS scan_board (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  created INTEGER NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('high','low')),
  candidates TEXT NOT NULL
);
