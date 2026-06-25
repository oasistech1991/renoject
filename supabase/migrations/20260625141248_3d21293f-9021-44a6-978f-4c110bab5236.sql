
-- 1. construction_schedules
CREATE TABLE public.construction_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NULL,
  name text NOT NULL,
  planned_start date,
  planned_finish date,
  working_days int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  non_working_dates date[] NOT NULL DEFAULT ARRAY[]::date[],
  colour_palette jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_of_id uuid NULL REFERENCES public.construction_schedules(id) ON DELETE SET NULL,
  is_template boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construction_schedules TO authenticated;
GRANT ALL ON public.construction_schedules TO service_role;
ALTER TABLE public.construction_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner or admin can read schedule" ON public.construction_schedules
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner or admin can insert schedule" ON public.construction_schedules
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner or admin can update schedule" ON public.construction_schedules
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner or admin can delete schedule" ON public.construction_schedules
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_construction_schedules_updated BEFORE UPDATE ON public.construction_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. construction_phases
CREATE TABLE public.construction_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.construction_schedules(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  colour text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construction_phases TO authenticated;
GRANT ALL ON public.construction_phases TO service_role;
ALTER TABLE public.construction_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phase via owner schedule" ON public.construction_phases
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.construction_schedules s WHERE s.id = schedule_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.construction_schedules s WHERE s.id = schedule_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE INDEX idx_construction_phases_schedule ON public.construction_phases(schedule_id);

-- 3. construction_tasks
CREATE TABLE public.construction_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.construction_schedules(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.construction_phases(id) ON DELETE SET NULL,
  name text NOT NULL,
  trade text,
  assignee_tradesman_id uuid NULL,
  planned_start date,
  planned_finish date,
  duration_days int NOT NULL DEFAULT 1,
  actual_start date,
  actual_finish date,
  percent_complete int NOT NULL DEFAULT 0,
  is_milestone boolean NOT NULL DEFAULT false,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  notes text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construction_tasks TO authenticated;
GRANT ALL ON public.construction_tasks TO service_role;
ALTER TABLE public.construction_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task via owner schedule" ON public.construction_tasks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.construction_schedules s WHERE s.id = schedule_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.construction_schedules s WHERE s.id = schedule_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE INDEX idx_construction_tasks_schedule ON public.construction_tasks(schedule_id);
CREATE INDEX idx_construction_tasks_phase ON public.construction_tasks(phase_id);
CREATE TRIGGER trg_construction_tasks_updated BEFORE UPDATE ON public.construction_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. construction_task_links
CREATE TABLE public.construction_task_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.construction_schedules(id) ON DELETE CASCADE,
  from_task_id uuid NOT NULL REFERENCES public.construction_tasks(id) ON DELETE CASCADE,
  to_task_id uuid NOT NULL REFERENCES public.construction_tasks(id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'FS' CHECK (link_type IN ('FS','SS','FF','SF')),
  lag_days int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_task_id, to_task_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construction_task_links TO authenticated;
GRANT ALL ON public.construction_task_links TO service_role;
ALTER TABLE public.construction_task_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "link via owner schedule" ON public.construction_task_links
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.construction_schedules s WHERE s.id = schedule_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.construction_schedules s WHERE s.id = schedule_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE INDEX idx_construction_task_links_schedule ON public.construction_task_links(schedule_id);

-- 5. construction_daily_logs
CREATE TABLE public.construction_daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.construction_schedules(id) ON DELETE CASCADE,
  task_id uuid NULL REFERENCES public.construction_tasks(id) ON DELETE SET NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  weather text,
  crew_count int,
  hours_worked numeric,
  notes text,
  delay_reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construction_daily_logs TO authenticated;
GRANT ALL ON public.construction_daily_logs TO service_role;
ALTER TABLE public.construction_daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log via owner schedule" ON public.construction_daily_logs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.construction_schedules s WHERE s.id = schedule_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.construction_schedules s WHERE s.id = schedule_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE INDEX idx_construction_daily_logs_schedule ON public.construction_daily_logs(schedule_id);

-- 6. construction_attachments
CREATE TABLE public.construction_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.construction_schedules(id) ON DELETE CASCADE,
  task_id uuid NULL REFERENCES public.construction_tasks(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'document' CHECK (kind IN ('document','drawing','rfi','approval')),
  title text NOT NULL,
  url text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','rejected','answered')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.construction_attachments TO authenticated;
GRANT ALL ON public.construction_attachments TO service_role;
ALTER TABLE public.construction_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att via owner schedule" ON public.construction_attachments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.construction_schedules s WHERE s.id = schedule_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.construction_schedules s WHERE s.id = schedule_id AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE INDEX idx_construction_attachments_schedule ON public.construction_attachments(schedule_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.construction_schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.construction_phases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.construction_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.construction_task_links;
