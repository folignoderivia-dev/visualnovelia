# Supabase

- `migrations/` — SQL em ordem (001 → 006). Cada arquivo pode ser rodado no **SQL Editor**.
- `complete_schema.sql` — todas as migrations concatenadas. Regenerar: `Get-Content migrations\*.sql | Set-Content -Encoding utf8 complete_schema.sql` (PowerShell).
- `functions/` — Edge Functions (Deno). `_shared/` tem código comum.

Guia completo: `../SUPABASE_SETUP.md` e `../GEMINI_SETUP.md`.
