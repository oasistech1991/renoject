
-- ============== ENUMS ==============
CREATE TYPE public.crm_stage AS ENUM ('new','qualified','interested','negotiating','won','lost');
CREATE TYPE public.crm_task_status AS ENUM ('open','done','snoozed');
CREATE TYPE public.crm_activity_type AS ENUM ('note','call','meeting','email','dm','interest','vote','save','stage_change','task_done');

-- ============== crm_contact_meta ==============
CREATE TABLE public.crm_contact_meta (
  client_id uuid PRIMARY KEY,
  owner_id uuid,
  stage public.crm_stage NOT NULL DEFAULT 'new',
  lifecycle_value numeric NOT NULL DEFAULT 0,
  last_contacted_at timestamptz,
  next_action_at timestamptz,
  tags text[] NOT NULL DEFAULT '{}',
  source text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contact_meta TO authenticated;
GRANT ALL ON public.crm_contact_meta TO service_role;
ALTER TABLE public.crm_contact_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage contact meta" ON public.crm_contact_meta
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_crm_contact_meta_updated BEFORE UPDATE ON public.crm_contact_meta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== crm_deal_clients ==============
CREATE TABLE public.crm_deal_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  feed_post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  stage public.crm_stage NOT NULL DEFAULT 'interested',
  probability int NOT NULL DEFAULT 30 CHECK (probability BETWEEN 0 AND 100),
  amount numeric,
  owner_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, feed_post_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_deal_clients TO authenticated;
GRANT ALL ON public.crm_deal_clients TO service_role;
ALTER TABLE public.crm_deal_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage deal clients" ON public.crm_deal_clients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_crm_deal_clients_updated BEFORE UPDATE ON public.crm_deal_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_crm_deal_clients_client ON public.crm_deal_clients(client_id);
CREATE INDEX idx_crm_deal_clients_post ON public.crm_deal_clients(feed_post_id);

-- ============== crm_activities ==============
CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  team_member_id uuid,
  type public.crm_activity_type NOT NULL,
  subject text,
  body text,
  feed_post_id uuid REFERENCES public.feed_posts(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage activities" ON public.crm_activities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_crm_activities_client_time ON public.crm_activities(client_id, occurred_at DESC);
CREATE INDEX idx_crm_activities_team ON public.crm_activities(team_member_id, occurred_at DESC);

-- ============== crm_tasks ==============
CREATE TABLE public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  client_id uuid,
  feed_post_id uuid REFERENCES public.feed_posts(id) ON DELETE SET NULL,
  assignee_id uuid,
  created_by uuid,
  due_at timestamptz,
  priority int NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  status public.crm_task_status NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_tasks TO service_role;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tasks" ON public.crm_tasks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_crm_tasks_updated BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_crm_tasks_assignee_due ON public.crm_tasks(assignee_id, due_at);
CREATE INDEX idx_crm_tasks_client ON public.crm_tasks(client_id);

-- ============== Seed contact_meta for existing clients ==============
INSERT INTO public.crm_contact_meta (client_id, stage)
SELECT user_id, 'new' FROM public.client_profiles
ON CONFLICT (client_id) DO NOTHING;

-- ============== Trigger: new client_profile -> seed crm_contact_meta ==============
CREATE OR REPLACE FUNCTION public.crm_seed_contact_meta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.crm_contact_meta (client_id, stage)
  VALUES (NEW.user_id, 'new')
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_crm_seed_contact_meta
AFTER INSERT ON public.client_profiles
FOR EACH ROW EXECUTE FUNCTION public.crm_seed_contact_meta();

-- ============== Trigger: feed_interest -> upsert deal_clients + activity ==============
CREATE OR REPLACE FUNCTION public.crm_on_feed_interest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.crm_contact_meta (client_id, stage)
  VALUES (NEW.user_id, 'new') ON CONFLICT (client_id) DO NOTHING;

  INSERT INTO public.crm_deal_clients (client_id, feed_post_id, stage, probability)
  VALUES (NEW.user_id, NEW.post_id, 'interested', 40)
  ON CONFLICT (client_id, feed_post_id) DO UPDATE
    SET stage = CASE WHEN public.crm_deal_clients.stage IN ('new') THEN 'interested' ELSE public.crm_deal_clients.stage END,
        updated_at = now();

  INSERT INTO public.crm_activities (client_id, type, subject, feed_post_id)
  VALUES (NEW.user_id, 'interest', 'Showed interest in deal', NEW.post_id);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_crm_on_feed_interest
AFTER INSERT ON public.feed_interest
FOR EACH ROW EXECUTE FUNCTION public.crm_on_feed_interest();

-- ============== Trigger: feed_poll_votes -> activity ==============
CREATE OR REPLACE FUNCTION public.crm_on_feed_poll_vote()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.crm_contact_meta (client_id, stage)
  VALUES (NEW.user_id, 'new') ON CONFLICT (client_id) DO NOTHING;
  INSERT INTO public.crm_activities (client_id, type, subject, feed_post_id)
  VALUES (NEW.user_id, 'vote', 'Voted on deal poll', NEW.post_id);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_crm_on_feed_poll_vote
AFTER INSERT ON public.feed_poll_votes
FOR EACH ROW EXECUTE FUNCTION public.crm_on_feed_poll_vote();

-- ============== Trigger: feed_saves -> activity ==============
CREATE OR REPLACE FUNCTION public.crm_on_feed_save()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.crm_contact_meta (client_id, stage)
  VALUES (NEW.user_id, 'new') ON CONFLICT (client_id) DO NOTHING;
  INSERT INTO public.crm_activities (client_id, type, subject, feed_post_id)
  VALUES (NEW.user_id, 'save', 'Saved deal', NEW.post_id);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_crm_on_feed_save
AFTER INSERT ON public.feed_saves
FOR EACH ROW EXECUTE FUNCTION public.crm_on_feed_save();

-- ============== Trigger: direct_messages -> activity + last_contacted ==============
CREATE OR REPLACE FUNCTION public.crm_on_direct_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_team_reply boolean;
BEGIN
  INSERT INTO public.crm_contact_meta (client_id, stage)
  VALUES (NEW.client_id, 'new') ON CONFLICT (client_id) DO NOTHING;

  is_team_reply := NEW.sender_id IS DISTINCT FROM NEW.client_id;

  INSERT INTO public.crm_activities (client_id, team_member_id, type, subject, body, feed_post_id)
  VALUES (
    NEW.client_id,
    CASE WHEN is_team_reply THEN NEW.sender_id ELSE NULL END,
    'dm',
    CASE WHEN is_team_reply THEN 'Team replied' ELSE 'Client sent a message' END,
    LEFT(NEW.body, 240),
    NEW.deal_id
  );

  IF is_team_reply THEN
    UPDATE public.crm_contact_meta
       SET last_contacted_at = now()
     WHERE client_id = NEW.client_id;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_crm_on_direct_message
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.crm_on_direct_message();

-- ============== Trigger: stage change -> activity ==============
CREATE OR REPLACE FUNCTION public.crm_log_stage_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.crm_activities (client_id, team_member_id, type, subject)
    VALUES (NEW.client_id, auth.uid(), 'stage_change',
            'Stage: ' || OLD.stage::text || ' → ' || NEW.stage::text);
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_crm_log_stage_change
AFTER UPDATE ON public.crm_contact_meta
FOR EACH ROW EXECUTE FUNCTION public.crm_log_stage_change();
