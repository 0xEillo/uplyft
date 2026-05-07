-- Keep strength-standard features available when a profile has not provided
-- a gender value. This is a functional default for rank calculations.
update public.profiles
set gender = 'male'
where gender is null;

alter table public.profiles
  alter column gender set default 'male';
