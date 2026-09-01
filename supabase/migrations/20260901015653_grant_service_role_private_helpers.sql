grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
alter default privileges in schema private grant execute on functions to service_role;