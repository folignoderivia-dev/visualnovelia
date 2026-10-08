# AI Novel Creator

Um "RPG Maker de navegador" para **Web Novels / Visual Novels narrativas controladas por IA**.
Você cria o mundo, os personagens e o seu protagonista. A IA (Google Gemini) narra, dá voz aos NPCs e
lembra do que aconteceu. Você escreve livremente o que o seu protagonista faz.

## Como rodar (resumo)

1. Siga **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** (cria banco, login, imagens).
2. Siga **[GEMINI_SETUP.md](GEMINI_SETUP.md)** (liga o narrador de IA).
3. Na pasta do projeto: `pnpm install` e depois `pnpm dev` → abra http://localhost:3000
4. Para publicar: **[DEPLOY.md](DEPLOY.md)**.

Como funciona por dentro: **[ARCHITECTURE.md](ARCHITECTURE.md)**.

## Fluxo do produto

Login → Minhas histórias → Nova história → Mundo/Cenário → Mestre → Personagens → Protagonista →
Revisão → **Iniciar história** → Gemini narra → você age → Gemini responde → memória/estado salvos →
continue depois de onde parou.

## Pastas

| Pasta | O que tem |
|---|---|
| `app/` | Páginas, estilos (`globals.css` = visual V0; `extra.css` = funcionalidade), manifest PWA |
| `components/` | `auth`, `editor`, `story`, `visual-novel`, `navigation`, `ui` |
| `lib/` | Serviços: `supabase`, `story`, `gemini`, tipos e erros |
| `supabase/migrations/` | SQL organizado (execute em ordem 001 → 006) |
| `supabase/complete_schema.sql` | Todas as migrations juntas, para colar de uma vez |
| `supabase/functions/` | Edge Functions (backend seguro com o Gemini) |
| `public/` | Ícones e `sw.js` (PWA) |

## Instalar no celular (PWA)

Abra o site publicado no Chrome (Android) → menu ⋮ → **Instalar app**. No iPhone (Safari): Compartilhar → **Adicionar à Tela de Início**.
