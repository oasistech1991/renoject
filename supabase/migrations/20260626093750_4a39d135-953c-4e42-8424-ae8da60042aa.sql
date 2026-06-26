
-- 1) Client assignment on construction schedules
ALTER TABLE public.construction_schedules
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS construction_schedules_client_id_idx
  ON public.construction_schedules(client_id);

-- Read-only access for the assigned client
DROP POLICY IF EXISTS "assigned client can read schedule" ON public.construction_schedules;
CREATE POLICY "assigned client can read schedule"
  ON public.construction_schedules FOR SELECT TO authenticated
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "assigned client can read phases" ON public.construction_phases;
CREATE POLICY "assigned client can read phases"
  ON public.construction_phases FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.construction_schedules s
    WHERE s.id = construction_phases.schedule_id AND s.client_id = auth.uid()));

DROP POLICY IF EXISTS "assigned client can read tasks" ON public.construction_tasks;
CREATE POLICY "assigned client can read tasks"
  ON public.construction_tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.construction_schedules s
    WHERE s.id = construction_tasks.schedule_id AND s.client_id = auth.uid()));

DROP POLICY IF EXISTS "assigned client can read logs" ON public.construction_daily_logs;
CREATE POLICY "assigned client can read logs"
  ON public.construction_daily_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.construction_schedules s
    WHERE s.id = construction_daily_logs.schedule_id AND s.client_id = auth.uid()));

DROP POLICY IF EXISTS "assigned client can read attachments" ON public.construction_attachments;
CREATE POLICY "assigned client can read attachments"
  ON public.construction_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.construction_schedules s
    WHERE s.id = construction_attachments.schedule_id AND s.client_id = auth.uid()));

-- 2) Comments table for progress updates
CREATE TABLE IF NOT EXISTS public.construction_progress_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.construction_schedules(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.construction_tasks(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.construction_phases(id) ON DELETE CASCADE,
  daily_log_id uuid REFERENCES public.construction_daily_logs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.construction_progress_comments TO authenticated;
GRANT ALL ON public.construction_progress_comments TO service_role;

ALTER TABLE public.construction_progress_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read comments if owner/admin/assigned client"
  ON public.construction_progress_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.construction_schedules s
    WHERE s.id = construction_progress_comments.schedule_id
      AND (s.user_id = auth.uid() OR s.client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE POLICY "insert comments if owner/admin/assigned client"
  ON public.construction_progress_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.construction_schedules s
      WHERE s.id = construction_progress_comments.schedule_id
        AND (s.user_id = auth.uid() OR s.client_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE POLICY "author can delete own comment"
  ON public.construction_progress_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE INDEX IF NOT EXISTS construction_progress_comments_schedule_idx
  ON public.construction_progress_comments(schedule_id, created_at DESC);
