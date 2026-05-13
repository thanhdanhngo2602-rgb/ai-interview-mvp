-- Optional database schema for later V2 persistence.
-- MVP V1 can run without Supabase because it stores config in browser sessionStorage.

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  jd_text text not null,
  language text default 'vi',
  created_at timestamptz default now()
);

create table if not exists job_questions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  order_no int not null,
  question_text text not null,
  expected_core_json jsonb default '[]'::jsonb,
  expected_bonus_json jsonb default '[]'::jsonb,
  criteria_json jsonb default '{}'::jsonb,
  weight numeric default 10
);

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id),
  candidate_name text,
  consent_accepted boolean default false,
  started_at timestamptz default now(),
  ended_at timestamptz,
  total_score numeric,
  summary_text text
);

create table if not exists interview_turns (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid references interviews(id) on delete cascade,
  question_id uuid references job_questions(id),
  speaker text not null,
  transcript_text text not null,
  created_at timestamptz default now()
);

create table if not exists question_scores (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid references interviews(id) on delete cascade,
  question_id uuid references job_questions(id),
  core_score numeric,
  quality_score numeric,
  bonus_score numeric,
  penalty_score numeric,
  total_score numeric,
  explanation text,
  criterion_breakdown_json jsonb default '{}'::jsonb
);
