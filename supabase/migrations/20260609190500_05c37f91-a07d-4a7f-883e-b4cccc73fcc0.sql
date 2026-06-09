-- Grant Data API privileges on all public tables (remix had none)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_media TO authenticated;
GRANT ALL ON public.property_media TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_reviews TO authenticated;
GRANT ALL ON public.expert_reviews TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hmo_analyses TO authenticated;
GRANT ALL ON public.hmo_analyses TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_watchlist TO authenticated;
GRANT ALL ON public.market_watchlist TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.token_fractions TO authenticated;
GRANT ALL ON public.token_fractions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.token_holdings TO authenticated;
GRANT ALL ON public.token_holdings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.token_transfers TO authenticated;
GRANT ALL ON public.token_transfers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tokens TO authenticated;
GRANT ALL ON public.tokens TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tradesmen TO authenticated;
GRANT ALL ON public.tradesmen TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tradesmen_candidates TO authenticated;
GRANT ALL ON public.tradesmen_candidates TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;