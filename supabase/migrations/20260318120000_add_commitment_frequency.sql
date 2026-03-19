alter table public.profiles
  add column if not exists commitment_frequency text;

alter table public.profiles
  drop constraint if exists valid_commitment_frequency;

alter table public.profiles
  add constraint valid_commitment_frequency
  check (
    commitment_frequency is null
    or commitment_frequency in (
      '1_time',
      '2_times',
      '3_times',
      '4_times',
      '5_plus',
      'not_sure'
    )
  );

alter table public.profiles
  drop constraint if exists valid_commitment_selection;

alter table public.profiles
  add constraint valid_commitment_selection
  check (commitment is null or commitment_frequency is null);

comment on column public.profiles.commitment_frequency is
  'Flexible weekly workout frequency when the user does not choose specific days.';
