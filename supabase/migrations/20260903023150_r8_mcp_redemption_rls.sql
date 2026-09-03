alter table public.life_mcp_code_redemptions enable row level security;

revoke all on table public.life_mcp_code_redemptions from public, anon, authenticated;
grant insert, select, delete on table public.life_mcp_code_redemptions to service_role;
