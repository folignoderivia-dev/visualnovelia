# Configurar o Gemini (narrador de IA)

> **AÇÃO MANUAL NECESSÁRIA** — a chave do Gemini fica **somente no servidor** (Edge Functions), nunca no site.

## 1. Pegar a chave
1. Acesse https://aistudio.google.com/apikey → **Create API key**. Copie.

## 2. Instalar a CLI do Supabase
No terminal (precisa do Node): `npm i -g supabase` (ou use `npx supabase ...` antes de cada comando).

## 3. Conectar ao seu projeto
```
supabase login
supabase link --project-ref SEU_PROJECT_REF
```
O *project ref* é o trecho da URL: `https://SEU_PROJECT_REF.supabase.co`.

## 4. Guardar a chave como secret
```
supabase secrets set GEMINI_API_KEY=COLE_A_CHAVE_AQUI
```
(Opcional) trocar de modelo: `supabase secrets set GEMINI_MODEL=gemini-2.5-flash`

## 5. Publicar as funções
```
supabase functions deploy generate-story-response
supabase functions deploy create-story-summary
supabase functions deploy extract-story-memory
supabase functions deploy search-story-memory
supabase functions deploy generate-scenario
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo Supabase.

## 6. Testar
Abra uma história pronta e clique **Iniciar história**. Você deve ver "A história está se desenrolando…" e depois a abertura narrada.

### Problemas comuns
| Mensagem | O que fazer |
|---|---|
| "A IA ainda não foi configurada" | Faltou o passo 4 (secret) ou 5 (deploy). |
| "A chave da IA parece inválida" | Gere outra chave e refaça o passo 4. |
| "O narrador está sobrecarregado" | Limite gratuito da API. Aguarde um pouco. |
| Erro de sessão | Saia e entre novamente na conta. |

Logs técnicos: Supabase → **Edge Functions → generate-story-response → Logs**.
