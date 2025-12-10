-- Add coach column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS coach text;
