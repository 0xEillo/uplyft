create table if not exists public.onboarding_strength_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  working_weight_kg numeric not null check (working_weight_kg > 0),
  reps integer not null check (reps > 0),
  estimated_1rm_kg numeric not null check (estimated_1rm_kg > 0),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists onboarding_strength_snapshots_exercise_id_idx
  on public.onboarding_strength_snapshots(exercise_id);

alter table public.onboarding_strength_snapshots enable row level security;

drop policy if exists "Users can view own onboarding strength snapshots" on public.onboarding_strength_snapshots;
drop policy if exists "Users can insert own onboarding strength snapshots" on public.onboarding_strength_snapshots;
drop policy if exists "Users can update own onboarding strength snapshots" on public.onboarding_strength_snapshots;
drop policy if exists "Users can delete own onboarding strength snapshots" on public.onboarding_strength_snapshots;

create policy "Users can view own onboarding strength snapshots"
  on public.onboarding_strength_snapshots
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own onboarding strength snapshots"
  on public.onboarding_strength_snapshots
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own onboarding strength snapshots"
  on public.onboarding_strength_snapshots
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own onboarding strength snapshots"
  on public.onboarding_strength_snapshots
  for delete
  using (auth.uid() = user_id);

drop trigger if exists onboarding_strength_snapshots_set_updated_at on public.onboarding_strength_snapshots;
create trigger onboarding_strength_snapshots_set_updated_at
before update on public.onboarding_strength_snapshots
for each row execute function public.set_updated_at();
