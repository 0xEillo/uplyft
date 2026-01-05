-- Explore content: pre-made programs and routines for users to discover and save
-- Programs are groups of routines that make sense together

-- 1) Explore Programs (groups of routines)
create table if not exists public.explore_programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  level text check (level in ('beginner', 'intermediate', 'advanced')),
  goal text,
  is_published boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Explore Routines (individual template routines)
create table if not exists public.explore_routines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  level text check (level in ('beginner', 'intermediate', 'advanced')),
  duration_minutes int,
  equipment text[],
  is_published boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Link table: programs contain routines
create table if not exists public.explore_program_routines (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.explore_programs(id) on delete cascade,
  routine_id uuid not null references public.explore_routines(id) on delete cascade,
  day_number int,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(program_id, routine_id)
);

-- 4) Exercises within an explore routine
create table if not exists public.explore_routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.explore_routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  order_index int not null,
  sets int not null default 3,
  reps_min int,
  reps_max int,
  notes text,
  created_at timestamptz not null default now(),
  unique(routine_id, order_index)
);

-- 5) Timestamp triggers
create trigger set_timestamp_explore_programs
before update on public.explore_programs
for each row execute function public.set_updated_at();

create trigger set_timestamp_explore_routines
before update on public.explore_routines
for each row execute function public.set_updated_at();

-- 6) Indexes for common queries
create index if not exists idx_explore_programs_published on public.explore_programs(is_published, display_order);
create index if not exists idx_explore_routines_published on public.explore_routines(is_published, display_order);
create index if not exists idx_explore_program_routines_program on public.explore_program_routines(program_id, display_order);
create index if not exists idx_explore_routine_exercises_routine on public.explore_routine_exercises(routine_id, order_index);

-- 7) Enable RLS (but allow public read for published content)
alter table public.explore_programs enable row level security;
alter table public.explore_routines enable row level security;
alter table public.explore_program_routines enable row level security;
alter table public.explore_routine_exercises enable row level security;

-- 8) RLS Policies: Anyone authenticated can READ published content
create policy explore_programs_select on public.explore_programs
  for select
  using (is_published = true);

create policy explore_routines_select on public.explore_routines
  for select
  using (is_published = true);

create policy explore_program_routines_select on public.explore_program_routines
  for select
  using (exists (
    select 1 from public.explore_programs p
    where p.id = program_id and p.is_published = true
  ));

create policy explore_routine_exercises_select on public.explore_routine_exercises
  for select
  using (exists (
    select 1 from public.explore_routines r
    where r.id = routine_id and r.is_published = true
  ));

-- 9) Grants for authenticated users (read-only via policies)
grant select on public.explore_programs to authenticated;
grant select on public.explore_routines to authenticated;
grant select on public.explore_program_routines to authenticated;
grant select on public.explore_routine_exercises to authenticated;

-- Note: INSERT/UPDATE/DELETE for explore content will be done by admins
-- via service role or a separate admin interface, not through client RLS.
