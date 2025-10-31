alter table body_log_entries
  add column if not exists analysis_summary text;

