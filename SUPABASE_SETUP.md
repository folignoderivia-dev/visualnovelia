# Configurar o Supabase (passo a passo)

> **AÇÃO MANUAL NECESSÁRIA** — leva ~10 minutos.

## 1. Criar o projeto
1. Entre em https://supabase.com → **New project**. Escolha nome, senha do banco (guarde) e região (ex.: South America).
2. Espere o projeto terminar de criar.

## 2. Copiar URL e chave pública
1. No projeto: **Project Settings (engrenagem) → API**.
2. Copie **Project URL** e a chave **anon / public** (NÃO copie a `service_role`).
3. Na pasta do projeto, copie `.env.example` para `.env.local` e cole:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
4. Se já estiver rodando `pnpm dev`, pare e inicie de novo.

## 3. Criar as tabelas (SQL Editor)
Opção rápida: **SQL Editor → New query**, cole TODO o conteúdo de `supabase/complete_schema.sql` e clique **Run**.

Opção organizada: rode, nesta ordem, cada arquivo de `supabase/migrations/`:
`001_initial_schema` → `002_characters` → `003_story_runtime` → `004_rls_policies` → `005_storage` → `006_indexes_functions`.

Pode rodar de novo sem medo: os scripts são idempotentes.
> Se aparecer um aviso sobre `vector` (pgvector), ignore: a busca semântica é opcional e o app funciona sem ela.

## 4. Storage (imagens)
Já é criado pela migration `005_storage` (buckets `campaign-assets`, `character-assets`, `player-assets`, `scenario-assets`).
Confira em **Storage**: devem aparecer 4 buckets. Nada mais a fazer.

## 5. Autenticação
1. **Authentication → Providers → Email**: deixe habilitado.
   - Para testar rápido, em **Authentication → Sign In / Providers → Email** desligue *Confirm email*. Em produção, deixe ligado.
2. **Authentication → URL Configuration**: em **Site URL** coloque a URL do seu site (em testes: `http://localhost:3000`) e adicione a mesma URL (e a de produção) em **Redirect URLs**. Isso faz a recuperação de senha e o Google funcionarem.
3. **Google (opcional)**: Authentication → Providers → Google → ligue e cole *Client ID* e *Secret* criados em https://console.cloud.google.com (APIs e serviços → Credenciais → ID do cliente OAuth → Aplicativo da Web). Em "URI de redirecionamento autorizado" use a **Callback URL** que o Supabase mostra nessa tela.

## 6. Edge Functions (o narrador)
Veja **[GEMINI_SETUP.md](GEMINI_SETUP.md)**.

## 7. Como testar
1. `pnpm dev` → http://localhost:3000 → **Criar uma conta**.
2. Crie uma história, dê nome ao protagonista, envie uma imagem de cenário e veja-a aparecer no Storage.
3. Feche a aba e abra de novo: sua história continua em **Minhas histórias**.
4. Teste de segurança: crie outra conta — ela não deve enxergar as histórias da primeira.
