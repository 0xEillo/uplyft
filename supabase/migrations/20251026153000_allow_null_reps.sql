-- Allow logging sets without explicit rep counts
alter table sets
  alter column reps drop not null;

