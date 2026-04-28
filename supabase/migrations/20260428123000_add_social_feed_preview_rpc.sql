-- Compact feed payload for the home screen workout cards.

drop function if exists public.get_social_feed_preview(uuid, integer, integer);

create or replace function public.get_social_feed_preview(
  p_user_id uuid,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  date timestamptz,
  raw_text text,
  notes text,
  type text,
  image_url text,
  song jsonb,
  routine_id uuid,
  duration integer,
  record_count integer,
  created_at timestamptz,
  routine jsonb,
  workout_exercises jsonb,
  profile jsonb,
  social jsonb,
  feed_preview jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with author_ids as (
    select p_user_id as id
    where p_user_id = auth.uid()
    union
    select f.followee_id as id
    from public.follows f
    where f.follower_id = p_user_id
      and p_user_id = auth.uid()
  ),
  feed_sessions as (
    select ws.*
    from public.workout_sessions ws
    join author_ids authors
      on authors.id = ws.user_id
    where ws.is_processing = false
    order by ws.created_at desc, ws.date desc
    limit greatest(coalesce(p_limit, 10), 0)
    offset greatest(coalesce(p_offset, 0), 0)
  ),
  workout_stats as (
    select
      fs.id as workout_id,
      count(distinct we.id)::integer as total_exercise_count,
      count(s.id)::integer as total_set_count,
      coalesce(
        sum(
          case
            when coalesce(s.reps, 0) > 0 then
              greatest(coalesce(s.weight, 1), 1) * s.reps
            else 0
          end
        ),
        0
      ) as total_volume_kg
    from feed_sessions fs
    left join public.workout_exercises we
      on we.session_id = fs.id
    left join public.sets s
      on s.workout_exercise_id = we.id
    group by fs.id
  )
  select
    fs.id,
    fs.user_id,
    fs.date,
    fs.raw_text,
    fs.notes,
    fs.type,
    fs.image_url,
    to_jsonb(fs.song) as song,
    fs.routine_id,
    fs.duration,
    coalesce(fs.record_count, 0) as record_count,
    fs.created_at,
    case
      when r.id is null then null
      else jsonb_build_object('id', r.id, 'name', r.name)
    end as routine,
    coalesce(preview.workout_exercises, '[]'::jsonb) as workout_exercises,
    jsonb_build_object(
      'id', p.id,
      'user_tag', p.user_tag,
      'display_name', p.display_name,
      'avatar_url', p.avatar_url,
      'overall_strength_score', p.overall_strength_score,
      'overall_strength_level', p.overall_strength_level,
      'overall_strength_progress', p.overall_strength_progress,
      'overall_strength_updated_at', p.overall_strength_updated_at
    ) as profile,
    jsonb_build_object(
      'likeCount', coalesce(wss.like_count, 0),
      'commentCount', coalesce(wss.comment_count, 0),
      'isLiked', exists (
        select 1
        from public.workout_likes wl
        where wl.workout_id = fs.id
          and wl.user_id = auth.uid()
      )
    ) as social,
    jsonb_build_object(
      'totalExerciseCount', coalesce(stats.total_exercise_count, 0),
      'totalSetCount', coalesce(stats.total_set_count, 0),
      'totalVolumeKg', coalesce(stats.total_volume_kg, 0)
    ) as feed_preview
  from feed_sessions fs
  left join public.workout_routines r
    on r.id = fs.routine_id
  left join public.profiles p
    on p.id = fs.user_id
  left join public.workout_social_stats wss
    on wss.workout_id = fs.id
  left join workout_stats stats
    on stats.workout_id = fs.id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', preview_we.id,
        'session_id', preview_we.session_id,
        'exercise_id', preview_we.exercise_id,
        'order_index', preview_we.order_index,
        'notes', preview_we.notes,
        'exercise_name', null,
        'created_at', preview_we.created_at,
        'exercise', jsonb_build_object(
          'id', e.id,
          'name', e.name,
          'muscle_group', e.muscle_group,
          'type', e.type,
          'equipment', e.equipment,
          'created_by', e.created_by,
          'created_at', e.created_at,
          'aliases', e.aliases,
          'exercise_id', e.exercise_id,
          'gif_url', e.gif_url,
          'target_muscles', e.target_muscles,
          'body_parts', e.body_parts,
          'equipments', e.equipments,
          'secondary_muscles', e.secondary_muscles,
          'instructions', e.instructions
        ),
        'sets', coalesce(preview_sets.sets, '[]'::jsonb)
      )
      order by preview_we.order_index
    ) as workout_exercises
    from (
      select we.*
      from public.workout_exercises we
      where we.session_id = fs.id
      order by we.order_index
      limit 5
    ) preview_we
    join public.exercises e
      on e.id = preview_we.exercise_id
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'workout_exercise_id', s.workout_exercise_id,
          'set_number', s.set_number,
          'reps', s.reps,
          'weight', s.weight,
          'rpe', s.rpe,
          'notes', s.notes,
          'is_warmup', s.is_warmup,
          'created_at', s.created_at
        )
        order by s.set_number
      ) as sets
      from public.sets s
      where s.workout_exercise_id = preview_we.id
    ) preview_sets on true
  ) preview on true
  order by fs.created_at desc, fs.date desc;
$$;

revoke all on function public.get_social_feed_preview(uuid, integer, integer) from public;
grant execute on function public.get_social_feed_preview(uuid, integer, integer) to authenticated;
