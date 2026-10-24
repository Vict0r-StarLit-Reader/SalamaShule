/*
# Create Salama Shule learning data

1. New Tables
- `salama_modules` stores the three offline-first course modules and their reading content.
- `salama_questions` stores multiple-choice and short-answer assessment prompts.
- `salama_attempts` stores student quiz submissions, answers, scores, timestamps, and sync status.

2. New Columns
- `salama_modules.id`, `title`, `subtitle`, `description`, `duration_minutes`, `accent`, `order_index`, `created_at`.
- `salama_questions.id`, `module_id`, `prompt`, `question_type`, `options`, `correct_answer`, `points`, `order_index`.
- `salama_attempts.id`, `student_identifier`, `module_id`, `answers`, `score`, `max_score`, `submitted_at`, `client_timestamp`, `sync_status`, `created_at`.

3. Security
- Enable row-level security on every table.
- Grant the public demo application only the CRUD operations it needs.
- Policies intentionally allow shared demo access because this version uses the supplied fixed evaluation credentials rather than account registration.

4. Important Notes
- The tables are additive and safe to re-run.
- Seed content is inserted only when matching records do not already exist.
*/

CREATE TABLE IF NOT EXISTS public.salama_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text NOT NULL,
  description text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 20,
  accent text NOT NULL DEFAULT 'blue',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.salama_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.salama_modules(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('mcq', 'short_answer')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text,
  points integer NOT NULL DEFAULT 1,
  order_index integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.salama_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_identifier text NOT NULL,
  module_id uuid NOT NULL REFERENCES public.salama_modules(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer NOT NULL DEFAULT 0,
  max_score integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  client_timestamp timestamptz NOT NULL DEFAULT now(),
  sync_status text NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('queued', 'synced')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS salama_questions_module_id_idx ON public.salama_questions(module_id, order_index);
CREATE INDEX IF NOT EXISTS salama_attempts_student_id_idx ON public.salama_attempts(student_identifier, submitted_at DESC);

ALTER TABLE public.salama_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salama_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salama_attempts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salama_modules TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salama_questions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salama_attempts TO anon, authenticated;

DROP POLICY IF EXISTS "demo_read_modules" ON public.salama_modules;
CREATE POLICY "demo_read_modules" ON public.salama_modules FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "demo_insert_modules" ON public.salama_modules;
CREATE POLICY "demo_insert_modules" ON public.salama_modules FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "demo_update_modules" ON public.salama_modules;
CREATE POLICY "demo_update_modules" ON public.salama_modules FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "demo_delete_modules" ON public.salama_modules;
CREATE POLICY "demo_delete_modules" ON public.salama_modules FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "demo_read_questions" ON public.salama_questions;
CREATE POLICY "demo_read_questions" ON public.salama_questions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "demo_insert_questions" ON public.salama_questions;
CREATE POLICY "demo_insert_questions" ON public.salama_questions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "demo_update_questions" ON public.salama_questions;
CREATE POLICY "demo_update_questions" ON public.salama_questions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "demo_delete_questions" ON public.salama_questions;
CREATE POLICY "demo_delete_questions" ON public.salama_questions FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "demo_read_attempts" ON public.salama_attempts;
CREATE POLICY "demo_read_attempts" ON public.salama_attempts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "demo_insert_attempts" ON public.salama_attempts;
CREATE POLICY "demo_insert_attempts" ON public.salama_attempts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "demo_update_attempts" ON public.salama_attempts;
CREATE POLICY "demo_update_attempts" ON public.salama_attempts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "demo_delete_attempts" ON public.salama_attempts;
CREATE POLICY "demo_delete_attempts" ON public.salama_attempts FOR DELETE TO anon, authenticated USING (true);

INSERT INTO public.salama_modules (title, subtitle, description, duration_minutes, accent, order_index)
SELECT * FROM (VALUES
  ('Cybersecurity & Data Protection', 'Module 01 · Foundations', 'Build safer habits around data, access, and Kenya Data Protection Act 2019 principles.', 18, 'blue', 1),
  ('Web Architecture & Progressive Web Apps', 'Module 02 · Delivery', 'Understand cache-first delivery, resilient interfaces, and offline-ready web architecture.', 22, 'teal', 2),
  ('Database Synchronization & Network Protocols', 'Module 03 · Systems', 'Explore queue pipelines, optimistic UI patterns, and eventual consistency.', 25, 'amber', 3)
) AS seed(title, subtitle, description, duration_minutes, accent, order_index)
WHERE NOT EXISTS (SELECT 1 FROM public.salama_modules);

INSERT INTO public.salama_questions (module_id, prompt, question_type, options, correct_answer, points, order_index)
SELECT m.id, q.prompt, q.question_type, q.options::jsonb, q.correct_answer, q.points, q.order_index
FROM public.salama_modules m
JOIN (VALUES
  ('Cybersecurity & Data Protection', 'Which principle limits access to only what a person needs?', 'mcq', '["Least privilege", "Maximum availability", "Open access", "Data duplication"]', 'Least privilege', 1, 1),
  ('Cybersecurity & Data Protection', 'Name one practice that helps protect personal data on a shared device.', 'short_answer', '[]', 'screen lock', 1, 2),
  ('Web Architecture & Progressive Web Apps', 'What should an offline-first app show when a network request is unavailable?', 'mcq', '["A blank page", "An offline status and cached content", "A forced sign-out", "A password reset"]', 'An offline status and cached content', 1, 1),
  ('Web Architecture & Progressive Web Apps', 'A service worker can help a web app cache which type of resource?', 'mcq', '["Only printed documents", "Core text assets", "Physical devices", "Bank cards"]', 'Core text assets', 1, 2),
  ('Database Synchronization & Network Protocols', 'What does idempotent mean for a queued sync request?', 'mcq', '["It can safely be retried without duplicating the result", "It never needs a network", "It deletes every record", "It always runs instantly"]', 'It can safely be retried without duplicating the result', 1, 1),
  ('Database Synchronization & Network Protocols', 'Which pattern updates the screen before the server confirms a change?', 'mcq', '["Optimistic UI", "Hard refresh", "Cold boot", "Static rendering"]', 'Optimistic UI', 1, 2)
) AS q(module_title, prompt, question_type, options, correct_answer, points, order_index) ON q.module_title = m.title
WHERE NOT EXISTS (SELECT 1 FROM public.salama_questions existing WHERE existing.module_id = m.id);
