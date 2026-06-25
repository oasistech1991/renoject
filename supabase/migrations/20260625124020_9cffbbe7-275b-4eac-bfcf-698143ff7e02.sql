
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.crm_lead_status AS ENUM ('new','contacted','qualified','unqualified','converted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_lead_source AS ENUM ('referral','feed','portal','event','cold','website','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_property_type AS ENUM ('btl','hmo','flip','commercial','mixed','dev_site','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_property_status AS ENUM ('sourcing','under_offer','owned','refurb','let','sold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_project_type AS ENUM ('light_refurb','heavy_refurb','conversion','new_build');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_project_stage AS ENUM ('planning','permits','demo','first_fix','second_fix','snagging','complete','refinanced');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_unit_status AS ENUM ('vacant','marketing','offer','referencing','let','notice','refurb');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_tenant_status AS ENUM ('current','past','arrears','notice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_risk AS ENUM ('low','med','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ LEADS ============
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  source public.crm_lead_source DEFAULT 'other',
  status public.crm_lead_status DEFAULT 'new',
  interested_in text,
  budget_min numeric,
  budget_max numeric,
  area_pref text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  last_contacted_at timestamptz,
  next_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage leads" ON public.crm_leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER set_updated_at_crm_leads BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PROPERTIES ============
CREATE TABLE IF NOT EXISTS public.crm_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  postcode text,
  lat double precision,
  lng double precision,
  property_type public.crm_property_type DEFAULT 'btl',
  beds int,
  baths int,
  sqft int,
  tenure text,
  status public.crm_property_status DEFAULT 'sourcing',
  purchase_price numeric,
  current_value numeric,
  equity numeric,
  owner_entity text,
  source_post_id uuid REFERENCES public.feed_posts(id) ON DELETE SET NULL,
  hero_image_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.crm_properties TO authenticated;
GRANT ALL ON public.crm_properties TO service_role;
ALTER TABLE public.crm_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage properties" ON public.crm_properties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER set_updated_at_crm_properties BEFORE UPDATE ON public.crm_properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PROJECTS ============
CREATE TABLE IF NOT EXISTS public.crm_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.crm_properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.crm_project_type DEFAULT 'light_refurb',
  stage public.crm_project_stage DEFAULT 'planning',
  budget numeric DEFAULT 0,
  spent numeric DEFAULT 0,
  start_date date,
  target_end date,
  actual_end date,
  pm_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  risk public.crm_risk DEFAULT 'low',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.crm_projects TO authenticated;
GRANT ALL ON public.crm_projects TO service_role;
ALTER TABLE public.crm_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage projects" ON public.crm_projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER set_updated_at_crm_projects BEFORE UPDATE ON public.crm_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ UNITS ============
CREATE TABLE IF NOT EXISTS public.crm_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.crm_properties(id) ON DELETE CASCADE,
  label text NOT NULL,
  beds int,
  rent_pcm numeric,
  status public.crm_unit_status DEFAULT 'vacant',
  marketed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.crm_units TO authenticated;
GRANT ALL ON public.crm_units TO service_role;
ALTER TABLE public.crm_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage units" ON public.crm_units FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER set_updated_at_crm_units BEFORE UPDATE ON public.crm_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ TENANTS ============
CREATE TABLE IF NOT EXISTS public.crm_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES public.crm_units(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  tenancy_start date,
  tenancy_end date,
  rent_pcm numeric,
  deposit numeric,
  status public.crm_tenant_status DEFAULT 'current',
  arrears_amount numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.crm_tenants TO authenticated;
GRANT ALL ON public.crm_tenants TO service_role;
ALTER TABLE public.crm_tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage tenants" ON public.crm_tenants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER set_updated_at_crm_tenants BEFORE UPDATE ON public.crm_tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CONTRACTOR META ============
CREATE TABLE IF NOT EXISTS public.crm_contractor_meta (
  tradesman_id uuid PRIMARY KEY REFERENCES public.tradesmen(id) ON DELETE CASCADE,
  rating int CHECK (rating BETWEEN 1 AND 5),
  default_rate numeric,
  preferred boolean DEFAULT false,
  last_used_at timestamptz,
  total_spend numeric DEFAULT 0,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.crm_contractor_meta TO authenticated;
GRANT ALL ON public.crm_contractor_meta TO service_role;
ALTER TABLE public.crm_contractor_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage contractor meta" ON public.crm_contractor_meta FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER set_updated_at_crm_contractor_meta BEFORE UPDATE ON public.crm_contractor_meta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PROJECT TASKS (Gantt) ============
CREATE TABLE IF NOT EXISTS public.crm_project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.crm_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contractor_id uuid REFERENCES public.tradesmen(id) ON DELETE SET NULL,
  start_date date,
  duration_days int DEFAULT 1,
  depends_on uuid REFERENCES public.crm_project_tasks(id) ON DELETE SET NULL,
  status text DEFAULT 'open',
  cost numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.crm_project_tasks TO authenticated;
GRANT ALL ON public.crm_project_tasks TO service_role;
ALTER TABLE public.crm_project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage project tasks" ON public.crm_project_tasks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER set_updated_at_crm_project_tasks BEFORE UPDATE ON public.crm_project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ TRIGGERS: auto-create property from new feed deal ============
CREATE OR REPLACE FUNCTION public.crm_on_feed_post_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.address IS NOT NULL AND length(trim(NEW.address)) > 0 THEN
    INSERT INTO public.crm_properties (address, status, source_post_id, hero_image_url)
    VALUES (NEW.address, 'sourcing', NEW.id, NULL)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS feed_post_to_property ON public.feed_posts;
CREATE TRIGGER feed_post_to_property AFTER INSERT ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.crm_on_feed_post_insert();

-- Auto-create project stub when a property flips to 'owned'
CREATE OR REPLACE FUNCTION public.crm_on_property_owned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'owned' AND (OLD.status IS DISTINCT FROM 'owned') THEN
    INSERT INTO public.crm_projects (property_id, name, stage)
    VALUES (NEW.id, 'Refurb — ' || NEW.address, 'planning')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS property_status_to_project ON public.crm_properties;
CREATE TRIGGER property_status_to_project AFTER UPDATE OF status ON public.crm_properties
  FOR EACH ROW EXECUTE FUNCTION public.crm_on_property_owned();
