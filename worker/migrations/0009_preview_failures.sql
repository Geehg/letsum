-- Hourly aggregate only: no IP, full UA, URL, message, input text or visitor ID.
CREATE TABLE IF NOT EXISTS preview_failures (
 hour TEXT NOT NULL, font TEXT NOT NULL, weight INTEGER NOT NULL,
 reason TEXT NOT NULL, error TEXT NOT NULL, browser TEXT NOT NULL,
 device TEXT NOT NULL, os TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(hour,font,weight,reason,error,browser,device,os)
);
