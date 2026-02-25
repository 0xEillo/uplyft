-- View-only exercise fetch by ID for social/profile contexts without broadening exercises search/select lists

drop function if exists public.get_viewable_exercise_by_id(uuid);

create or replace function public.get_viewable_exercise_by_id(
  p_exercise_id uuid
)
returns setof public.exercises
language sql
stable
security definer
set search_path = public
as $$
  select e.*
  from public.exercises e
  where e.id = p_exercise_id
    and (
      e.created_by is null
      or e.created_by = auth.uid()
      or public.can_view_user_content(e.created_by)
    )
  limit 1;
$$;
