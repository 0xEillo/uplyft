-- Add short public descriptions to athlete profiles

alter table public.profiles
  add column if not exists profile_description text;

do $$
begin
  if not exists (
    select 1
    from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'profiles'
      and constraint_name = 'profiles_profile_description_length_check'
  ) then
    alter table public.profiles
      add constraint profiles_profile_description_length_check
      check (
        profile_description is null
        or char_length(profile_description) <= 160
      );
  end if;
end;
$$;

comment on column public.profiles.profile_description is
  'Short public profile description (max 160 chars)';


