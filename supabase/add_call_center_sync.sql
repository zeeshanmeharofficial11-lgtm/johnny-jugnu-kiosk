-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New Query).
-- Adds the columns the Call Center panel uses to track which backup-kiosk
-- orders have been manually re-entered into the real EXE ordering system.

alter table orders
  add column if not exists sent_to_exe boolean not null default false,
  add column if not exists sent_to_exe_at timestamptz;
