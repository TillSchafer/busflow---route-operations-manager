# Supabase Migrations (Canonical)

This directory is the canonical source for all new database migrations.

## Rules
- Create and maintain new SQL migrations here only.
- Apply via Supabase CLI (`supabase db push`, `supabase migration list`, `supabase db pull`).
- Do not add new operational migrations under `docs/migrations`.

## Legacy History
Historical SQL files remain under `docs/migrations` as archive/reference.
