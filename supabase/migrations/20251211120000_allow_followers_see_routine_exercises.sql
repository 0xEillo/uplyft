-- Allow followers to see custom exercises used in routines they can view
-- Fixes crash when viewing a friend's routine that contains their custom exercises

drop policy if exists "Exercises visible to owners or global" on exercises;

create policy "Exercises visible to owners, global, or via followed routines"
  on exercises for select
  using (
    created_by is null
    or created_by = (select auth.uid())
    or exists (
      select 1
      from public.workout_routine_exercises wre
      join public.workout_routines wr on wr.id = wre.routine_id
      where wre.exercise_id = exercises.id
        and exists (
          select 1 from public.follows
          where follower_id = auth.uid()
            and followee_id = wr.user_id
        )
    )
  );
