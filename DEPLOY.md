# Publicar o app (Vercel)

1. Suba o projeto para um repositório no GitHub.
2. Em https://vercel.com → **Add New → Project** → importe o repositório (Framework: Next.js, detectado sozinho).
3. Em **Environment Variables** adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   **Não** adicione `GEMINI_API_KEY` nem `service_role` aqui — elas ficam só no Supabase (ver GEMINI_SETUP.md).
4. **Deploy**.
5. Volte ao Supabase → **Authentication → URL Configuration** e adicione a URL final (`https://seu-app.vercel.app`) em *Site URL* e *Redirect URLs*.
6. Abra no celular e instale como app (ver README).

## Checklist de segurança antes de divulgar
- [ ] Confirmação de e-mail ligada no Supabase.
- [ ] Nenhuma chave secreta no repositório (`.env.local` está no `.gitignore`).
- [ ] Todas as tabelas com RLS (a migration 004 já faz isso).
- [ ] Funções publicadas (`supabase functions deploy ...`).
