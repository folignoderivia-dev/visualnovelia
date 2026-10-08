# Arquitetura

```
USUÁRIO → FRONTEND/PWA (Next.js) → SUPABASE
                                    ├─ Auth
                                    ├─ PostgreSQL (+RLS)
                                    ├─ Storage (imagens)
                                    └─ Edge Functions → Gemini API
```

## Princípios
- **Preservar o visual do V0**: `globals.css` não foi alterado; funcionalidade nova está em `extra.css` e reutiliza as mesmas classes.
- **Segurança no banco**: RLS em todas as tabelas. Cliente só escreve conteúdo de criação (história, mundo, personagens…). Mensagens, estado, memórias e resumos são escritos **somente** pelas Edge Functions.
- **Chave do Gemini só no servidor**. O usuário é sempre identificado pelo token (nunca por `user_id` vindo do corpo da requisição).
- **A IA não tem poder sobre o banco**: a resposta do Gemini é JSON com schema; o backend valida IDs (personagens/cenários precisam pertencer à história), limita tamanhos/quantidades e só então grava.

## Camadas do frontend
`components/*` (visual) → `lib/story/service.ts`, `lib/gemini/client.ts`, `lib/story/storage.ts` (serviços) → `lib/supabase/client.ts`.

## Turno de jogo (`generate-story-response`)
1. Autentica e confere dono da história.
2. Carrega **só o necessário**: mundo, regras do Mestre, protagonista, NPCs relevantes (mencionados/recentes), cenário e estado atuais, até 8 memórias relevantes, último resumo, 12 últimas mensagens.
3. Monta prompt em seções (regras do app → Mestre → mundo → personagens → estado → memórias → resumo → recentes → ação).
4. Gemini responde JSON: `beats` (narração/diálogo), `current_scenario_id`, `state_updates`, `memories`, `relationship_updates`.
5. Valida e grava mensagens, estado, memórias (máx. 3/turno), relacionamentos.
6. A cada 30 mensagens novas gera resumo em segundo plano.

## Memória vs. Estado
- **Memória** (`story_memories`): fatos que importam no futuro ("Maria tem um irmão desaparecido").
- **Estado** (`story_state`): situação atual (local, cenário, capítulo, flags).
- Recuperação atual: palavras-chave (full-text PT-BR) + personagens citados + importância. A coluna `embedding vector(768)` já existe (se pgvector estiver ativo) para a fase 3.

## Roadmap pronto para evoluir
- Embeddings/pgvector (função `search_story_memories`).
- Expressões múltiplas (`character_expressions` já existe).
- Geração de imagens (`generate-scenario` preparada).
- Rewind com snapshots (histórico hoje é somente leitura).
