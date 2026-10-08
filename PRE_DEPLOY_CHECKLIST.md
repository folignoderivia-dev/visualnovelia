# Checklist Pré-Deploy - AI NOVEL CREATOR

Esta lista consolida todas as ações e configurações necessárias para que o projeto esteja 100% pronto para uso em produção com o Supabase e o Gemini.

## 1. Banco de Dados e Supabase 🟩
- [x] Migrations criadas (001_initial_schema.sql até 006_indexes_functions.sql) e revisadas.
- [x] RLS (Row Level Security) aplicado e testado em todas as tabelas (profiles, stories, story_messages, etc.).
- [x] Políticas de Storage definidas (controle de acesso por `user_id/story_id/`).
- [x] Acesso `anon` revogado.
- [x] Funções RPC atômicas (`create_story`, `commit_story_turn`) configuradas para prevenir race conditions.
- [ ] **Configuração Manual**: Rodar `supabase db push` ou executar o conteúdo das migrations no SQL Editor do Supabase de produção.
- [ ] **Configuração Manual**: Criar os buckets de Storage (`campaign-assets`, `character-assets`, `player-assets`, `scenario-assets`) marcados como **Public** para leitura, mas limitados via RLS para escrita.

## 2. Edge Functions e Integração Gemini 🟩
- [x] Lógica de negócio isolada em `_shared/core.ts` e 100% validada através de testes unitários NodeJS nativos.
- [x] Edge Functions estruturadas (`generate-story-response`, `create-story-summary`, etc.).
- [x] Proteções contra timeouts, MAX_TOKENS, injeção de prompt e "empty beats" implementadas.
- [x] Validação rigorosa dos IDs dos personagens (ignorando personagens inventados).
- [ ] **Configuração Manual**: Fazer o deploy das Edge Functions (`supabase functions deploy`).
- [ ] **Configuração Manual**: Configurar os secrets no Supabase (`supabase secrets set GEMINI_API_KEY=sua-chave`).

## 3. Frontend (Next.js) 🟩
- [x] Projeto rodando com base nos componentes e identidade visual originais do V0.
- [x] Conexão com Supabase via `supabase-js` refatorada e validada (`editor.tsx`, `library.tsx`, `visual-novel.tsx`).
- [x] Telas de Autenticação (`auth-gate.tsx`, `auth-screen.tsx`) implementadas.
- [x] Proteções de interface: Autosave com fallback, bloqueio contra double-clicks na geração, e strict mode handle para recovery na visual novel.
- [x] Configuração PWA mantida.
- [ ] **Configuração Manual**: Definir as variáveis de ambiente em produção:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 4. Segurança Geral 🟩
- [x] `SUPABASE_SERVICE_ROLE_KEY` e `GEMINI_API_KEY` **nunca** expostas ao frontend.
- [x] Concorrência bloqueada com `generating_until` impedindo geração dupla por spam de cliques.
- [x] Somente usuários logados (`auth.uid()`) têm acesso aos seus dados por design de RLS e validação do JWT nas Edge Functions (`getUser(token)`).

---
## Resumo do Status (VERDE/AMARELO/VERMELHO)

- **Frontend & UI Original**: 🟩 VERDE
- **Estrutura de Banco e Migrations**: 🟩 VERDE
- **Segurança (RLS, Auth e JWT)**: 🟩 VERDE
- **Lógica de Geração e Testes**: 🟩 VERDE
- **Deploy Automático no Vercel/Supabase**: 🟨 AMARELO (requer preenchimento manual das chaves em cada ambiente, deploy de Edge Functions e buckets)
