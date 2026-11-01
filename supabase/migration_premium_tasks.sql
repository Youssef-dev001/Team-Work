-- Run this migration in Supabase SQL Editor after deploying the updated frontend.
-- Stores multiple video/source links as a JSON array while keeping video_url for legacy rows.
alter table public.tasks
  add column if not exists video_urls jsonb not null default '[]'::jsonb;

-- Normalize old single video links into the new array field without overwriting existing arrays.
update public.tasks
set video_urls = jsonb_build_array(video_url)
where video_url is not null
  and btrim(video_url) <> ''
  and (video_urls is null or video_urls = '[]'::jsonb);

comment on column public.tasks.video_urls is 'List of video/source URLs attached to a task';
