# AI Novel Creator - Guia de Conexão Real (Deployment)

Este documento detalha o processo de conexão do projeto local com os serviços reais de produção (GitHub, Supabase, Gemini e Render).

> **Aviso de Segurança**: Nunca faça commit de arquivos `.env` ou coloque chaves secretas no código fonte.

---

## PARTE 1 - GITHUB

O repositório local já foi inicializado com Git, o arquivo `.gitignore` foi rigorosamente atualizado para não expor os `.env*`, e o primeiro commit ("Initial functional AI Novel Creator with Supabase architecture") foi criado na branch `main`.

**Ação Manual Necessária:**
1. Abra o terminal na pasta do projeto (`D:\ai-novel-creator`).
2. Como a CLI e o ambiente dependem da sua credencial autenticada do GitHub, você precisa executar o push manualmente:
   ```bash
   git push -u origin main
   ```

---

## PARTE 2 - SUPABASE

**Project ID**: `zbeapeiztarhlkqoqkks`  
**URL**: `https://zbeapeiztarhlkqoqkks.supabase.co`

As dependências de Migrations, Edge Functions e RLS estão prontas e validadas localmente, mas não apliquei as operações destrutivas no seu banco remoto para sua segurança. 

**Ação Manual Necessária:**
1. **Autenticar na CLI do Supabase:**
   ```bash
   npx supabase login
   ```
   *(Isso abrirá uma janela no navegador para gerar um token seguro sem expor keys)*

2. **Vincular o Projeto Remoto:**
   ```bash
   npx supabase link --project-ref zbeapeiztarhlkqoqkks
   ```
   *(Se pedir senha do banco de dados, insira a senha que você configurou no painel do Supabase)*

3. **Subir o Esquema do Banco (Migrations):**
   ```bash
   npx supabase db push
   ```
   *(Isto vai criar as tabelas, indexes, RLS e Functions RPC sem apagar os dados existentes)*

4. **Criar os Buckets de Storage:**
   Vá ao painel do Supabase -> **Storage** -> e crie manualmente os seguintes buckets (marcando "Public" para leitura):
   - `campaign-assets`
   - `character-assets`
   - `player-assets`
   - `scenario-assets`

---

## PARTE 3 - GEMINI

A chave fornecida: `AQ.Ab8RN6IMvIv-Q2dSNkRQui8Dfo4elUSClgzsviJCWSinPPJYMQ`

Ela **nunca** deve ser colocada no frontend ou comitada no Git. Ela é consumida pelas **Edge Functions** executadas no ambiente seguro do Supabase.

**Ação Manual Necessária:**
1. Cadastrar a secret remotamente via Supabase CLI (após o login e link explicados acima):
   ```bash
   npx supabase secrets set GEMINI_API_KEY=AQ.Ab8RN6IMvIv-Q2dSNkRQui8Dfo4elUSClgzsviJCWSinPPJYMQ
   ```

---

## PARTE 4 - EDGE FUNCTIONS

As Edge Functions (`generate-story-response`, `create-story-summary`, etc.) estão implementadas e testadas. Após subir o banco e o secret da Gemini, precisamos subí-las para produção.

**Ação Manual Necessária:**
1. Fazer deploy de todas as functions para o projeto remoto:
   ```bash
   npx supabase functions deploy
   ```

---

## PARTE 5 - VARIÁVEIS DE AMBIENTE (FRONTEND)

O aplicativo (Next.js) precisa se comunicar com o Supabase. Para testar **localmente**, crie um arquivo chamado `.env.local` em `D:\ai-novel-creator` contendo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://zbeapeiztarhlkqoqkks.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=coloque_sua_anon_key_aqui
```
*(A `anon_key` você pega no painel do Supabase > Settings > API. O `.gitignore` protege este arquivo de ir pro GitHub).*

---

## PARTE 6 - PREPARAÇÃO PARA O RENDER

O aplicativo é um projeto Next.js (TypeScript, PWA). 
Para hospedá-lo no Render, você usará o **Web Service** (Next.js dinâmico, não estático) devido aos endpoints de servidor (Server Components) e otimizações nativas do Next.js.

- **Build command**: `pnpm build`
- **Start command**: `pnpm start`
- **Variáveis que devem ser inseridas no Render Dashboard**:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

*Nota: Não faça deploy no Render ainda, conforme solicitado. Primeiro valide o fluxo em localhost conectado aos serviços.*

---

## PARTE 7 - TESTE FINAL (FLUXO REAL)

Depois que você concluir as ações manuais (Partes 1 a 5), rode a aplicação localmente:
```bash
pnpm dev
```
E realize o teste de End-to-End:
1. Cadastre-se na aplicação.
2. Faça o login.
3. Crie uma história e o protagonista.
4. Faça o upload de imagens para garantir que o Storage tá de pé.
5. Inicie a história e faça uma ação, observando a resposta real do Gemini vindo das Edge Functions.
