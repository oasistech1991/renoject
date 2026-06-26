
-- 1. Remove overly-permissive SELECT policy exposing financial columns
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.client_profiles;

-- 2. Safe public view of client_profiles (no financial fields)
CREATE OR REPLACE VIEW public.public_client_profiles
WITH (security_invoker = false) AS
SELECT user_id, display_name, avatar_url, headline, location,
       preferred_areas, preferred_deal_types, created_at, updated_at
FROM public.client_profiles;

GRANT SELECT ON public.public_client_profiles TO authenticated, anon;

-- 3. Revoke EXECUTE on SECURITY DEFINER trigger-only functions from signed-in users
REVOKE EXECUTE ON FUNCTION public.crm_log_stage_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_on_feed_save() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_on_direct_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_default_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_on_feed_poll_vote() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_seed_contact_meta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_on_feed_interest() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_on_feed_post_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_on_property_owned() FROM PUBLIC, anon, authenticated;
