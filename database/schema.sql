-- Sitewise Database Schema
-- Run this in your Supabase SQL Editor

-- 1. Create assessments table
create table if not exists public.assessments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  project_name text not null,
  budget int not null check(budget >= 1 and budget <= 10),
  timeline int not null check(timeline >= 1 and timeline <= 10),
  safety int not null check(safety >= 1 and safety <= 10),
  resources int not null check(resources >= 1 and resources <= 10),
  score int not null check(score >= 0 and score <= 100),
  risk_label text not null check(risk_label in ('LOW', 'MEDIUM', 'HIGH')),
  executive_summary text,
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security
alter table public.assessments enable row level security;

-- 3. RLS Policies
-- Users can only insert their own assessments
create policy "Users can insert their own assessments"
  on public.assessments for insert
  with check (auth.uid() = user_id);

-- Users can only view their own assessments
create policy "Users can view their own assessments"
  on public.assessments for select
  using (auth.uid() = user_id);

-- Users can update their own assessments
create policy "Users can update their own assessments"
  on public.assessments for update
  using (auth.uid() = user_id);

-- Users can delete their own assessments
create policy "Users can delete their own assessments"
  on public.assessments for delete
  using (auth.uid() = user_id);

-- 4. Index for fast history queries (ordered by most recent)
create index if not exists assessments_user_id_created_at_idx
  on public.assessments(user_id, created_at desc);
