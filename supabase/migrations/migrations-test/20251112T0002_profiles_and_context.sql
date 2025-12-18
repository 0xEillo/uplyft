-- Profiles table, RLS, triggers, and contextual fields
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_tag text not null unique,
  display_name text not null,
  bio text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Constraint for user_tag format
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_tag_format') then
    alter table profiles add constraint user_tag_format
      check (user_tag ~ '^[a-z0-9_]{3,30}$');
  end if;
end $$;

-- Index for user_tag lookups
create index if not exists idx_profiles_user_tag on profiles(user_tag);

-- Enable RLS
alter table profiles enable row level security;

-- Profiles are viewable by everyone
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'profiles'
      and policyname = 'Profiles are viewable by everyone'
  ) then
    create policy "Profiles are viewable by everyone"
      on profiles for select
      using (true);
  end if;
end $$;

-- Users can insert their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'profiles'
      and policyname = 'Users can insert their own profile'
  ) then
    create policy "Users can insert their own profile"
      on profiles for insert
      with check (auth.uid() = id);
  end if;
end $$;

-- Users can update their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'profiles'
      and policyname = 'Users can update their own profile'
  ) then
    create policy "Users can update their own profile"
      on profiles for update
      using (auth.uid() = id);
  end if;
end $$;

-- Users can delete their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'profiles'
      and policyname = 'Users can delete their own profile'
  ) then
    create policy "Users can delete their own profile"
      on profiles for delete
      using (auth.uid() = id);
  end if;
end $$;

-- Function to automatically maintain updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to maintain updated_at
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'update_profiles_updated_at') then
    create trigger update_profiles_updated_at
      before update on profiles
      for each row
      execute function update_updated_at_column();
  end if;
end $$;

-- Allow service_role to run the signup trigger while maintaining user inserts
drop policy if exists "Users can insert their own profile" on profiles;
create policy "Users can insert their own profile"
  on profiles for insert
  with check (
    auth.uid() = id
    or auth.role() = 'service_role'
  );

-- Trigger function to create profiles on signup (final version with JWT context & Twitter-style suffix)
create or replace function create_profile_on_signup()
returns trigger as $$
declare
  base_tag text;
  unique_tag text;
  counter integer := 0;
begin
  -- Ensure RLS policies treat this as the new user
  perform set_config('request.jwt.claim.sub', new.id::text, true);

  -- Derive base tag from email username
  base_tag := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]', '', 'g'));

  if length(base_tag) < 3 then
    base_tag := 'user' || substring(new.id::text, 1, 6);
  end if;

  if length(base_tag) > 27 then
    base_tag := substring(base_tag, 1, 27);
  end if;

  unique_tag := base_tag;

  -- Append numeric suffix (1-999) if needed
  while counter <= 999
        and exists (select 1 from profiles where user_tag = unique_tag) loop
    counter := counter + 1;
    unique_tag := base_tag || counter;
  end loop;

  insert into profiles (id, user_tag, display_name)
  values (
    new.id,
    unique_tag,
    split_part(new.email, '@', 1)
  );

  return new;
exception
  when others then
    raise warning 'Failed to create profile for user %: %', new.id, sqlerrm;
    return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger to create profile on auth.users insert
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'create_profile_on_signup_trigger') then
    create trigger create_profile_on_signup_trigger
      after insert on auth.users
      for each row
      execute function create_profile_on_signup();
  end if;
end $$;

-- Add contextual fields: gender, height, weight, goal
alter table profiles
  add column gender text,
  add column height_cm numeric,
  add column weight_kg numeric,
  add column goal text;

alter table profiles add constraint valid_gender
  check (gender is null or gender in ('male', 'female', 'prefer_not_to_say'));

alter table profiles add constraint valid_goal
  check (goal is null or goal in ('build_muscle', 'lose_fat', 'gain_strength', 'general_fitness'));

alter table profiles add constraint valid_height
  check (height_cm is null or (height_cm >= 50 and height_cm <= 300));

alter table profiles add constraint valid_weight
  check (weight_kg is null or (weight_kg >= 20 and weight_kg <= 500));

-- Age and commitment fields
alter table profiles
  add column age integer,
  add column commitment text[];

alter table profiles add constraint valid_age
  check (age is null or (age >= 13 and age <= 120));

alter table profiles add constraint valid_commitment
  check (
    commitment is null 
    or (
      commitment <@ array['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'not_sure']::text[]
      and array_length(commitment, 1) > 0
    )
  );

-- Convert single goal to array of goals
alter table profiles drop constraint if exists valid_goal;
alter table profiles rename column goal to goals;
alter table profiles add column goals_temp text[];

update profiles
set goals_temp = array[goals]::text[]
where goals is not null;

update profiles
set goals_temp = null
where goals is null;

alter table profiles drop column goals;
alter table profiles rename column goals_temp to goals;

alter table profiles add constraint valid_goals
  check (
    goals is null
    or (
      goals <@ array['build_muscle', 'lose_fat', 'gain_strength', 'general_fitness']::text[]
      and array_length(goals, 1) > 0
    )
  );

comment on column profiles.goals is
  'Array of user fitness goals: build_muscle, lose_fat, gain_strength, general_fitness';

-- Training experience metadata
alter table profiles
  add column training_years text,
  add column experience_level text;

alter table profiles add constraint valid_training_years
  check (training_years is null or training_years in ('less_than_1', '1_to_3', '3_to_5', '5_plus'));

alter table profiles add constraint valid_experience_level
  check (experience_level is null or experience_level in ('beginner', 'intermediate', 'advanced'));

-- Remove deprecated experience_level
alter table profiles drop constraint if exists valid_experience_level;
alter table profiles drop column if exists experience_level;

-- Notification scheduling fields
alter table profiles add column if not exists trial_notification_id text;
alter table profiles add column if not exists trial_notification_scheduled_at timestamptz;
alter table profiles add column if not exists trial_start_date timestamptz;

create index if not exists idx_profiles_trial_notification_id
  on profiles(trial_notification_id)
  where trial_notification_id is not null;

create index if not exists idx_profiles_trial_start_date
  on profiles(trial_start_date)
  where trial_start_date is not null;

