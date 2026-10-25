-- PostgreSQL's global default grants EXECUTE on new functions to PUBLIC.
-- A schema-scoped revoke alone does not remove this built-in grant, so make
-- newly created functions opt-in across postgres-owned schemas. Existing
-- functions and their explicitly reviewed grants are unchanged.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
