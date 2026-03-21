create table if not exists public.user_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  image_path text,
  tint_color text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_timestamp_user_programs
before update on public.user_programs
for each row execute function public.set_updated_at();

create index if not exists idx_user_programs_user on public.user_programs(user_id);

alter table public.user_programs enable row level security;

create policy user_programs_select on public.user_programs
  for select using (user_id = auth.uid());

create policy user_programs_insert on public.user_programs
  for insert with check (user_id = auth.uid());

create policy user_programs_update on public.user_programs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy user_programs_delete on public.user_programs
  for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.user_programs to authenticated;

-- Add program_id to workout_routines
alter table public.workout_routines
add column program_id uuid references public.user_programs(id) on delete set null;

create index if not exists idx_workout_routines_program on public.workout_routines(program_id);
