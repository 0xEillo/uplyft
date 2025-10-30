-- Automatically refresh exercise_user_1rm materialized view when user updates their weight
-- This ensures weight class percentiles are recalculated based on current body weight

create or replace function refresh_exercise_user_1rm_on_weight_change()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Only refresh if weight actually changed
  if (old.weight_kg is distinct from new.weight_kg) then
    refresh materialized view concurrently exercise_user_1rm;
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_exercise_user_1rm_weight_trigger on profiles;
create trigger refresh_exercise_user_1rm_weight_trigger
after update on profiles
for each row
execute function refresh_exercise_user_1rm_on_weight_change();
