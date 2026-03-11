-- Legacy percentile ranking helpers are no longer used.
-- The app and coach now rely exclusively on strength standards.

drop function if exists get_exercise_percentiles(uuid, uuid);
drop function if exists calculate_exercise_percentile_filtered(
  uuid,
  numeric,
  text,
  numeric,
  numeric
);
drop function if exists calculate_exercise_percentile(uuid, numeric);
drop function if exists get_weight_for_percentile(
  uuid,
  numeric,
  text,
  numeric,
  numeric
);
