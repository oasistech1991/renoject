
-- Rent payments
CREATE TABLE public.crm_rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.crm_tenants(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  due_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  paid_on date,
  method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_rent_payments TO authenticated;
GRANT ALL ON public.crm_rent_payments TO service_role;
ALTER TABLE public.crm_rent_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage rent payments" ON public.crm_rent_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_crm_rent_payments_updated BEFORE UPDATE ON public.crm_rent_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_crm_rent_payments_tenant ON public.crm_rent_payments(tenant_id, due_date);

-- Expenses
CREATE TABLE public.crm_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.crm_properties(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.tradesmen(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'maintenance',
  amount numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  notes text,
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_expenses TO authenticated;
GRANT ALL ON public.crm_expenses TO service_role;
ALTER TABLE public.crm_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage expenses" ON public.crm_expenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_crm_expenses_updated BEFORE UPDATE ON public.crm_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_crm_expenses_property ON public.crm_expenses(property_id, date DESC);

-- Compliance certificates
CREATE TABLE public.crm_compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.crm_properties(id) ON DELETE CASCADE,
  type text NOT NULL,
  issued_on date,
  expires_on date,
  document_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_compliance_items TO authenticated;
GRANT ALL ON public.crm_compliance_items TO service_role;
ALTER TABLE public.crm_compliance_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage compliance" ON public.crm_compliance_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_crm_compliance_updated BEFORE UPDATE ON public.crm_compliance_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_crm_compliance_property ON public.crm_compliance_items(property_id, expires_on);

-- Documents
CREATE TABLE public.crm_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.crm_properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  file_url text NOT NULL,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_documents TO authenticated;
GRANT ALL ON public.crm_documents TO service_role;
ALTER TABLE public.crm_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage documents" ON public.crm_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_crm_documents_property ON public.crm_documents(property_id, uploaded_at DESC);
