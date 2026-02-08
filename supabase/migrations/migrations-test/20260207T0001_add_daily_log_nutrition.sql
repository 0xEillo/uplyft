-- Test migration: daily log nutrition tracking

create table if not exists public.daily_log_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  log_date date not null,
  weight_kg numeric,
  calorie_goal integer,
  protein_goal_g integer,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  unique (user_id, log_date)
);

create index if not exists daily_log_entries_user_id_log_date_idx
  on public.daily_log_entries(user_id, log_date desc);

alter table public.daily_log_entries enable row level security;

drop policy if exists "Users can view own daily log entries" on public.daily_log_entries;
drop policy if exists "Users can insert own daily log entries" on public.daily_log_entries;
drop policy if exists "Users can update own daily log entries" on public.daily_log_entries;
drop policy if exists "Users can delete own daily log entries" on public.daily_log_entries;

create policy "Users can view own daily log entries"
  on public.daily_log_entries
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own daily log entries"
  on public.daily_log_entries
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own daily log entries"
  on public.daily_log_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own daily log entries"
  on public.daily_log_entries
  for delete
  using (auth.uid() = user_id);

drop trigger if exists daily_log_entries_set_updated_at on public.daily_log_entries;
create trigger daily_log_entries_set_updated_at
before update on public.daily_log_entries
for each row execute function public.set_updated_at();

create table if not exists public.daily_log_meals (
  id uuid default gen_random_uuid() primary key,
  daily_log_entry_id uuid references public.daily_log_entries(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  description text not null check (char_length(trim(description)) > 0),
  calories numeric not null check (calories >= 0),
  protein_g numeric not null check (protein_g >= 0),
  carbs_g numeric not null check (carbs_g >= 0),
  fat_g numeric not null check (fat_g >= 0),
  source text not null default 'text' check (source in ('text', 'photo', 'voice', 'manual', 'correction')),
  confidence text check (confidence in ('low', 'medium', 'high')),
  chat_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists daily_log_meals_entry_id_created_at_idx
  on public.daily_log_meals(daily_log_entry_id, created_at asc);

create index if not exists daily_log_meals_user_id_created_at_idx
  on public.daily_log_meals(user_id, created_at desc);

alter table public.daily_log_meals enable row level security;

drop policy if exists "Users can view own daily log meals" on public.daily_log_meals;
drop policy if exists "Users can insert own daily log meals" on public.daily_log_meals;
drop policy if exists "Users can update own daily log meals" on public.daily_log_meals;
drop policy if exists "Users can delete own daily log meals" on public.daily_log_meals;

create policy "Users can view own daily log meals"
  on public.daily_log_meals
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own daily log meals"
  on public.daily_log_meals
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own daily log meals"
  on public.daily_log_meals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own daily log meals"
  on public.daily_log_meals
  for delete
  using (auth.uid() = user_id);

drop trigger if exists daily_log_meals_set_updated_at on public.daily_log_meals;
create trigger daily_log_meals_set_updated_at
before update on public.daily_log_meals
for each row execute function public.set_updated_at();

create or replace function public.enforce_daily_log_meal_user_match()
returns trigger
language plpgsql
as $$
declare
  entry_user_id uuid;
begin
  select user_id
    into entry_user_id
  from public.daily_log_entries
  where id = new.daily_log_entry_id;

  if entry_user_id is null then
    raise exception 'daily_log_entry_id % does not exist', new.daily_log_entry_id;
  end if;

  if entry_user_id <> new.user_id then
    raise exception 'daily_log_entry_id/user_id mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists daily_log_meals_enforce_user_match on public.daily_log_meals;
create trigger daily_log_meals_enforce_user_match
before insert or update on public.daily_log_meals
for each row execute function public.enforce_daily_log_meal_user_match();

create or replace function public.touch_daily_log_entry_updated_at()
returns trigger
language plpgsql
as $$
declare
  target_entry_id uuid;
begin
  target_entry_id := coalesce(new.daily_log_entry_id, old.daily_log_entry_id);
  if target_entry_id is not null then
    update public.daily_log_entries
      set updated_at = timezone('utc'::text, now())
      where id = target_entry_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists daily_log_meals_touch_entry_insert on public.daily_log_meals;
drop trigger if exists daily_log_meals_touch_entry_update on public.daily_log_meals;
drop trigger if exists daily_log_meals_touch_entry_delete on public.daily_log_meals;

create trigger daily_log_meals_touch_entry_insert
after insert on public.daily_log_meals
for each row execute function public.touch_daily_log_entry_updated_at();

create trigger daily_log_meals_touch_entry_update
after update on public.daily_log_meals
for each row execute function public.touch_daily_log_entry_updated_at();

create trigger daily_log_meals_touch_entry_delete
after delete on public.daily_log_meals
for each row execute function public.touch_daily_log_entry_updated_at();
