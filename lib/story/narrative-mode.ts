export type NarrativeMode = 'visual' | 'aventura' | 'rpg' | 'namoro' | 'tema' | 'harem' | 'adulto' | 'reality' | 'companion' | 'verdade' | 'web'

export const NARRATIVE_MODES: { id: NarrativeMode; label: string; hint: string }[] = [
  { id: 'visual', label: 'Visual novel', hint: 'Conversa entre os personagens. A narração só descreve a cena e oferece opções.' },
  { id: 'aventura', label: 'Aventura', hint: 'Narra a campanha inteira, com capítulos, perigos e ganchos de aventura.' },
  { id: 'rpg', label: 'RPG de mesa', hint: 'Age como mestre: pede dados, testes e aplica regras.' },
  { id: 'namoro', label: 'Simulador de namoro', hint: 'Slice of life com 3 ou 4 personagens por capítulo, um de cada vez.' },
  { id: 'harem', label: 'Harem', hint: 'As duas chamam sua atenção. Você escolhe uma e fica só com ela. Depois de 5 ações de cada, decide quem segue.' },
  { id: 'adulto', label: '+18', hint: 'Falas adultas, sem filtro e sem censura, no jeito da ficha.' },
  { id: 'reality', label: 'Reality', hint: 'Sete participantes. Convivência, desafios, intimidade, provas e o voto do público.' },
  { id: 'companion', label: 'Companion', hint: 'Cada fala sua gera aprovação ou desaprovação. Quem perde pontos sai da equipe.' },
  { id: 'verdade', label: 'Verdade ou desafio', hint: 'D6: você pergunta, o narrador sorteia quem te pergunta, você desafia, o narrador sorteia quem te desafia.' },
  { id: 'web', label: 'Web namorada', hint: 'Conversa do zero, só vocês dois, sem escolhas. Tudo por texto.' },
  { id: 'tema', label: 'Tema regrado', hint: 'Você escreve um filme, jogo ou campanha e a história segue esse cânone.' },
]

const MARK_START = '[[MODO_NARRATIVO]]'
const MARK_END = '[[/MODO_NARRATIVO]]'
const HAREM_S = '[[ELENCO_HAREM]]'
const HAREM_E = '[[/ELENCO_HAREM]]'
const TEAM_S = '[[EQUIPE_COMPANION]]'
const TEAM_E = '[[/EQUIPE_COMPANION]]'
const REALITY_S = '[[ELIMINADOS_REALITY]]'
const REALITY_E = '[[/ELIMINADOS_REALITY]]'
const PICK_S = '[[ELENCO_ESCOLHIDO]]'
const PICK_E = '[[/ELENCO_ESCOLHIDO]]'
const HAREM_FLOW_S = '[[FLUXO_HAREM]]'
const HAREM_FLOW_E = '[[/FLUXO_HAREM]]'
const REALITY_FLOW_S = '[[FLUXO_REALITY]]'
const REALITY_FLOW_E = '[[/FLUXO_REALITY]]'
const VERDADE_FLOW_S = '[[FLUXO_VERDADE]]'
const VERDADE_FLOW_E = '[[/FLUXO_VERDADE]]'
const WEB_FLOW_S = '[[FLUXO_WEB]]'
const WEB_FLOW_E = '[[/FLUXO_WEB]]'
const PHOTO_S = '[[FOTOS_JOGADOR]]'
const PHOTO_E = '[[/FOTOS_JOGADOR]]'

export const REALITY_PHASES = ['convivencia', 'desafios', 'intimidade', 'provas', 'voto'] as const
export type RealityPhase = (typeof REALITY_PHASES)[number]
export const REALITY_PHASE_LABEL: Record<RealityPhase, string> = {
  convivencia: 'Convivência',
  desafios: 'Desafios',
  intimidade: 'Intimidade',
  provas: 'Provas',
  voto: 'Voto do público',
}

const SHEET = `REGRA DE OURO DA FICHA: cada personagem criado segue 100% a ficha editada pelo jogador — nome, apelido, idade, aparência, personalidade, estilo de fala, objetivos, medos, segredos, passado, informações extras e, acima de tudo, o que pensa sobre o protagonista. Não suavize, não contradiga e não invente um jeito de ser diferente do que está escrito. Prompts e campos da ficha são lei.`

export function modeInstructions(mode: NarrativeMode, theme = '', stateLine = ''): string {
  const state = stateLine ? `ESTADO SALVO (não contradiga): ${stateLine}\n` : ''
  const common = `${SHEET}
Sempre termine com 3 ou 4 opções em pending_choices, perguntando o que o jogador quer fazer. Nunca escreva a fala, o pensamento ou a decisão do protagonista.`
  if (mode === 'aventura') {
    return `MODO ATIVO: AVENTURA.
${state}Você narra como narrador de aventura. Conte a cena inteira: o lugar, o perigo, o que o mundo faz e para onde a campanha pode ir. Crie ganchos, capítulos e consequências. Quando a situação mudar de verdade, marque new_chapter. Falas de personagem continuam em dialogue com o character_id real, nunca dentro da narração.
${common}`
  }
  if (mode === 'rpg') {
    return `MODO ATIVO: RPG DE MESA.
${state}Você é o mestre da mesa. Obrigatório regrar a cena: diga qual teste o jogador precisa fazer, a dificuldade e o que está em jogo. Se ele ainda não rolou o dado, pare antes de resolver e peça o D20. Se a ação trouxer "[O jogador rolou um D20 e tirou: X]" ou "[D20: X]", aplique: 1-5 falha trágica, 6-10 falha, 11-15 sucesso com custo, 16-20 sucesso épico. Descreva o resultado com clareza de regra.
${common}`
  }
  if (mode === 'namoro') {
    return `MODO ATIVO: SIMULADOR DE NAMORO (slice of life).
${state}Use o elenco para as pessoas se conhecerem. Em cada capítulo, escolha só 3 ou 4 personagens e foque neles um de cada vez, em cenas separadas. Não coloque o elenco inteiro junto. Simule amizade, aproximação, tentativa de flerte, romance e o que a ficha daquele personagem permitir — nada além do que a ficha autoriza. Ao abrir um capítulo novo, troque o grupo de 3 ou 4. A narração só descreve o lugar e o clima; o resto é fala do personagem em dialogue.
${common}`
  }
  if (mode === 'harem') {
    return `MODO ATIVO: HAREM.
${state}Só duas mulheres da ficha, 100% no jeito de cada uma. Sem homens e sem gente inventada. pending_choices SEMPRE vazio: o jogo mostra os botões.
Se o ESTADO não tem dupla, apresente duas que não foram eliminadas. Cada uma faz uma proposta. Escreva [[DUPLA:Nome A|Nome B]] e [[PROPOSTA:Nome|a proposta]] na narração. Não faça ele escolher ainda.
Se a fase é apresenta, cada uma faz UMA proposta concreta para o protagonista: um caminho ousado, no jeito da ficha, para encantar, apaixonar, seduzir, apelar ou ousar. Escreva [[PROPOSTA:Nome|a proposta]] para cada uma. Não escolha por ele. Não misture os caminhos.
Se a fase é solo, a cena segue SÓ a proposta do foco, até o fim desse caminho. A outra não fala, não entra e não é citada. No fim, as duas fazem propostas novas.
Se a fase é final, não escreva cena nova.
Narração com lugar. Falas em dialogue com character_id real. Nada vazio. Não escreva a fala do protagonista.
${SHEET}`
  }
  if (mode === 'adulto') {
    return `MODO ATIVO: +18.
${state}Todos os envolvidos são adultos. As falas são imersivas, sem filtro e sem censura: detalhadas, provocantes, no tesão, na vergonha e no poder que a ficha já tem.
Use termos crus quando a personalidade pedir: buceta, pinto, piru, piroca, piroquinha, xereca, pepeka. Fale de tamanho, cheiro, depilação, sado, BDSM, humilhação de pênis pequeno e outros fetiches conhecidos. Não troque isso por eufemismo e não recuse a cena adulta.
Quem fala é o personagem, em dialogue, com o character_id real. A narração só descreve corpo e lugar, também sem censura.
${common}`
  }
  if (mode === 'reality') {
    return `MODO ATIVO: REALITY.
${state}Você é o apresentador. Pode falar como apresentador. Participam só o protagonista e os 7 nomes do elenco no ESTADO. Ninguém de fora.
Faça SOMENTE a parte escrita em "reality fase". Ordem: convivência, desafios, intimidade, provas, voto. Cada uma das 4 primeiras é uma aventura com um desafio criado por você. Narração da parte + falas em dialogue com character_id real. 3 ou 4 escolhas. Não elimine nessas 4 partes.
Na fase voto, sem "[D20: N]" ou "[O jogador rolou um D20 e tirou: N]", peça o dado e não elimine. 1-5: o protagonista sai ou quase sai. 6-10: um aliado sai. 11-15: outro sai. 16-20: o protagonista domina. Escreva [[ELIMINADO:Nome]]. Quem sai não volta.
Nada vazio. Não escreva a fala do protagonista.
${SHEET}`
  }
  if (mode === 'companion') {
    return `MODO ATIVO: COMPANION.
${state}Mistério e romance. PROIBIDO beat vazio, nulo ou só com colchetes. Toda resposta tem narração (lugar e ação) e dialogue com character_id real, mais 3 ou 4 pending_choices com ações de verdade.
Cada capítulo apresenta 2 pessoas novas. Escreva [[DUPLA:Nome A|Nome B]]. Quem já está na equipe continua na cena e fala.
CADA palavra, escolha ou ação do protagonista gera, em cada pessoa presente, uma fala de reação e uma marca no fim da narração: [[APROVACAO:Nome:+1]]. Só +1, +5, +10, -1, -5 ou -10. 1 é gesto pequeno, 5 é escolha que importa, 10 acerta ou fere o núcleo da ficha.
No fim do capítulo, entre a dupla fica quem tem mais aprovação: [[FICA:Nome]] e [[SAI:Nome]]. Quem sai deixa a equipe. Quem fica entra e permanece.
Não escreva a fala do protagonista.
${SHEET}`
  }
  if (mode === 'verdade') {
    return `MODO ATIVO: VERDADE OU DESAFIO.
${state}Adultos. Só o protagonista e os 6 nomes do ESTADO, nesta ordem, sem pular e sem inverter:
1. Ele rola um D6 e faz uma PERGUNTA para quem caiu. Essa pessoa é obrigada a responder com toda a verdade da ficha.
2. O narrador rola um D6. Quem caiu faz uma PERGUNTA para ele.
3. Ele rola um D6 e dá um DESAFIO para quem caiu. Essa pessoa é obrigada a cumprir.
4. O narrador rola um D6. Quem caiu dá um DESAFIO para ele. Aí a ordem recomeça.
VERDADE: sem desviar, com segredos, objetivos, medos e o que pensa do protagonista, até a resposta ficar inteira. DESAFIO: cumpre beijo, toque ou o que a ficha permitir, do começo ao fim, sem resumir e sem recusar.
A jogada dura até estar concluída. Proibido pular, cortar no meio ou passar para outra pessoa antes do fim. Só quando a verdade foi dita por completo ou o desafio foi cumprido até o fim, escreva [[FEITO]] na narração. Sem [[FEITO]], a cena continua.
Se a JOGADA é pergunta dele: não invente a pergunta. Quem caiu responde. pending_choices vazio.
Se a JOGADA é pergunta para ele e ele ainda não ouviu: escreva SÓ a pergunta, em dialogue, com o character_id de quem caiu. Não responda por ele.
Se a JOGADA é o desafio dele: não invente o desafio. Quem caiu começa a cumprir e só para quando acabar.
Se a JOGADA é o desafio para ele e ele ainda não ouviu: escreva SÓ o desafio. Não cumpra por ele.
Se a JOGADA ainda não acabou: continue a mesma cena. Não escreva [[FEITO]].
Não traga gente de fora. Nada vazio.
${SHEET}`
  }
  if (mode === 'web') {
    return `MODO ATIVO: WEB NAMORADA.
${state}Isto é uma conversa do absoluto zero. Duas pessoas estão se conhecendo agora. Ignore campanha, memórias e qualquer pessoa que não seja ela.
Sem escolhas. pending_choices fica vazio sempre. O jogador escreve o texto livre.
Narração: no máximo uma frase sobre o lugar. O resto é a fala dela em dialogue, com o character_id real, 100% na ficha. Não escreva a fala do protagonista. Ninguém mais entra ou fala.
${SHEET}`
  }
  if (mode === 'tema') {
    const subject = theme.trim() || '(tema ainda não escrito)'
    return `MODO ATIVO: TEMA REGRADO.
${state}O tema canônico é: "${subject}".
Estude esse filme, jogo ou campanha e narre dentro dele: tom, regras, lugares, fatos e espírito dessa obra. Não quebre o cânone e não troque o tema por outro universo. A aventura do jogador acontece ali. Os personagens criados na ficha continuam existindo dentro desse tema e obedecem 100% a ficha.
${common}`
  }
  return `MODO ATIVO: VISUAL NOVEL.
${state}Isto é uma visual novel interativa. A cena é conversa do protagonista com os personagens criados.
PROIBIDO o narrador falar como pessoa. PROIBIDO escrever "o narrador disse", "o narrador fala" ou qualquer fala atribuída ao narrador.
O bloco narration só descreve o cenário e o que se vê na cena, curto, sem diálogo e sem opinião. Toda fala de personagem vai em dialogue, com o character_id real. Não invente personagens.
${common}`
}

export function parseNarrativeMode(additionalRules: string | null | undefined): { mode: NarrativeMode; theme: string } {
  const text = additionalRules || ''
  const start = text.indexOf(MARK_START)
  const end = text.indexOf(MARK_END)
  if (start === -1 || end === -1) return { mode: 'visual', theme: '' }
  const body = text.slice(start + MARK_START.length, end)
  const modeLine = body.match(/MODO ATIVO:\s*([^\n.]+)/i)?.[1]?.toLowerCase() || ''
  let mode: NarrativeMode = 'visual'
  if (modeLine.includes('harem')) mode = 'harem'
  else if (modeLine.includes('+18')) mode = 'adulto'
  else if (modeLine.includes('reality')) mode = 'reality'
  else if (modeLine.includes('companion')) mode = 'companion'
  else if (modeLine.includes('verdade')) mode = 'verdade'
  else if (modeLine.includes('web')) mode = 'web'
  else if (modeLine.includes('aventura')) mode = 'aventura'
  else if (modeLine.includes('rpg')) mode = 'rpg'
  else if (modeLine.includes('namoro')) mode = 'namoro'
  else if (modeLine.includes('tema')) mode = 'tema'
  const theme = body.match(/O tema canônico é:\s*"([^"]*)"/)?.[1] || ''
  return { mode, theme: theme === '(tema ainda não escrito)' ? '' : theme }
}

function readBlock(text: string, start: string, end: string): string {
  const a = text.indexOf(start)
  const b = text.indexOf(end)
  if (a === -1 || b === -1 || b < a) return ''
  return text.slice(a + start.length, b).trim()
}

function replaceBlock(text: string, start: string, end: string, body: string): string {
  const a = text.indexOf(start)
  const b = text.indexOf(end)
  const block = body.trim() ? `${start}\n${body.trim()}\n${end}` : ''
  const removed = (a !== -1 && b !== -1 && b > a)
    ? (text.slice(0, a) + text.slice(b + end.length)).trim()
    : text.trim()
  if (!block) return removed
  return `${block}\n\n${removed}`.replace(/\n{3,}/g, '\n\n').trim()
}

function namesOf(body: string, key: string): string[] {
  const raw = body.match(new RegExp(`${key}:\\s*(.*)`))?.[1] || ''
  return raw.split(';').map((x) => x.trim()).filter(Boolean)
}

function unique(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of list) {
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

export function haremRoster(rules: string | null | undefined): { recruited: string[]; eliminated: string[] } {
  const body = readBlock(rules || '', HAREM_S, HAREM_E)
  return { recruited: namesOf(body, 'recrutadas'), eliminated: namesOf(body, 'eliminadas') }
}

export function companionTeam(rules: string | null | undefined): { team: string; scores: Record<string, number> } {
  const body = readBlock(rules || '', TEAM_S, TEAM_E)
  const team = body.match(/na_equipe:\s*(.*)/)?.[1]?.trim() || ''
  const scores: Record<string, number> = {}
  for (const part of (body.match(/placar:\s*(.*)/)?.[1] || '').split(';')) {
    const [name, value] = part.split('=')
    if (name?.trim() && Number.isFinite(Number(value))) scores[name.trim()] = Number(value)
  }
  return { team, scores }
}

export function realityOut(rules: string | null | undefined): string[] {
  return namesOf(readBlock(rules || '', REALITY_S, REALITY_E), 'fora')
}

export function chosenCast(rules: string | null | undefined): { verdade: string[]; web: string } {
  const body = readBlock(rules || '', PICK_S, PICK_E)
  return { verdade: namesOf(body, 'verdade'), web: namesOf(body, 'web')[0] || '' }
}

export function withChosenCast(rules: string, mode: 'verdade' | 'web', names: string[]): string {
  const cur = chosenCast(rules)
  const verdade = mode === 'verdade' ? names : cur.verdade
  const web = mode === 'web' ? (names[0] || '') : cur.web
  const next = replaceBlock(rules, PICK_S, PICK_E, `verdade: ${verdade.join('; ')}\nweb: ${web}`)
  return withNarrativeMode(next, mode, parseNarrativeMode(next).theme)
}

export type HaremPhase = 'apresenta' | 'solo' | 'final'
const HAREM_ACTIONS = 5

export function haremFlow(rules: string | null | undefined): {
  fase: HaremPhase
  dupla: [string, string] | null
  foco: string
  acoes: Record<string, number>
} {
  const body = readBlock(rules || '', HAREM_FLOW_S, HAREM_FLOW_E)
  const rawFase = body.match(/fase:\s*(\w+)/)?.[1] || ''
  const fase: HaremPhase = rawFase === 'solo' ? 'solo' : rawFase === 'final' || rawFase === 'escolha' ? 'final' : 'apresenta'
  const pair = namesOf(body, 'dupla')
  const dupla: [string, string] | null = pair.length >= 2 ? [pair[0], pair[1]] : null
  const acoes: Record<string, number> = {}
  if (dupla) { acoes[dupla[0]] = 0; acoes[dupla[1]] = 0 }
  for (const part of (body.match(/acoes:\s*(.*)/)?.[1] || '').split(';')) {
    const [name, value] = part.split('=')
    if (name?.trim() && Number.isFinite(Number(value))) acoes[name.trim()] = Math.max(0, Math.min(HAREM_ACTIONS, Number(value)))
  }
  return { fase, dupla, foco: body.match(/foco:\s*(.*)/)?.[1]?.trim() || '', acoes }
}

function writeHaremFlow(
  rules: string,
  fase: HaremPhase,
  dupla: [string, string] | null,
  acoes: Record<string, number>,
  foco = '',
): string {
  const score = dupla ? dupla.map((n) => `${n}=${acoes[n] || 0}`).join('; ') : ''
  const body = `fase: ${fase}\ndupla: ${dupla ? dupla.join('; ') : ''}\nfoco: ${foco}\nacoes: ${score}`
  return refreshMode(replaceBlock(rules, HAREM_FLOW_S, HAREM_FLOW_E, body))
}

/** O jogador escolheu com quem falar. A cena ainda não conta até ele escrever. */
export function focusHarem(rules: string, name: string): string {
  const cur = haremFlow(rules)
  if (!cur.dupla || !cur.dupla.some((n) => n.toLowerCase() === name.toLowerCase())) return rules
  if ((cur.acoes[name] || 0) >= HAREM_ACTIONS) return rules
  return writeHaremFlow(rules, 'solo', cur.dupla, cur.acoes, name)
}

/** Uma ação com a mulher em foco. Na quinta de cada uma, a resposta seguinte abre a decisão. */
export function addHaremAction(rules: string, name: string): string {
  const cur = haremFlow(rules)
  if (!cur.dupla) return rules
  const acoes = { ...cur.acoes }
  const key = cur.dupla.find((n) => n.toLowerCase() === name.toLowerCase()) || name
  acoes[key] = Math.min(HAREM_ACTIONS, (acoes[key] || 0) + 1)
  return writeHaremFlow(rules, 'solo', cur.dupla, acoes, key)
}

/** Depois da resposta: guarda a dupla e volta para a escolha, ou trava na decisão final. */
export function settleHaremTurn(rules: string, seen: [string, string] | null): string {
  const cur = haremFlow(rules)
  const gone = haremRoster(rules).eliminated.map((n) => n.toLowerCase())
  if (seen && seen.some((n) => gone.includes(n.toLowerCase()))) return writeHaremFlow(rules, 'apresenta', null, {}, '')
  const dupla = cur.dupla || seen
  if (!dupla) return rules
  const acoes = { ...cur.acoes }
  acoes[dupla[0]] = acoes[dupla[0]] || 0
  acoes[dupla[1]] = acoes[dupla[1]] || 0
  const done = dupla.every((n) => (acoes[n] || 0) >= HAREM_ACTIONS)
  return writeHaremFlow(rules, done ? 'final' : 'apresenta', dupla, acoes, done ? '' : '')
}

export function resetHaremChapter(rules: string): string {
  return writeHaremFlow(rules, 'apresenta', null, {}, '')
}

export function realityFlow(rules: string | null | undefined): { fase: RealityPhase; elenco: string[] } {
  const body = readBlock(rules || '', REALITY_FLOW_S, REALITY_FLOW_E)
  const raw = (body.match(/fase:\s*(\w+)/)?.[1] || 'convivencia') as RealityPhase
  const fase = (REALITY_PHASES as readonly string[]).includes(raw) ? raw : 'convivencia'
  return { fase, elenco: namesOf(body, 'elenco') }
}

export function withRealityCast(rules: string, names: string[]): string {
  const fase = realityFlow(rules).fase || 'convivencia'
  return refreshMode(replaceBlock(rules, REALITY_FLOW_S, REALITY_FLOW_E, `fase: ${fase}\nelenco: ${unique(names).slice(0, 7).join('; ')}`))
}

export function advanceRealityPhase(rules: string): string {
  const cur = realityFlow(rules)
  const i = REALITY_PHASES.indexOf(cur.fase)
  const fase = REALITY_PHASES[(i + 1) % REALITY_PHASES.length]
  return refreshMode(replaceBlock(rules, REALITY_FLOW_S, REALITY_FLOW_E, `fase: ${fase}\nelenco: ${cur.elenco.join('; ')}`))
}

export function realityCastWithout(rules: string, gone: string[]): string {
  const cur = realityFlow(rules)
  const drop = new Set(gone.map((n) => n.toLowerCase()))
  const elenco = cur.elenco.filter((n) => !drop.has(n.toLowerCase()))
  return refreshMode(replaceBlock(rules, REALITY_FLOW_S, REALITY_FLOW_E, `fase: convivencia\nelenco: ${elenco.join('; ')}`))
}

export type VerdadePasso = 0 | 1 | 2 | 3
export type VerdadeFase = 'rolar' | 'escrever' | 'ouvir' | 'responder' | 'cumprir'

export function verdadeFlow(rules: string | null | undefined): {
  rodada: number
  passo: VerdadePasso
  fase: VerdadeFase
  dado: number
  alvo: string
  elenco: string[]
  jogador: string
} {
  const text = rules || ''
  const body = readBlock(text, VERDADE_FLOW_S, VERDADE_FLOW_E)
  const passoRaw = Number(body.match(/passo:\s*(\d+)/)?.[1] || 0)
  const passo = (passoRaw === 1 || passoRaw === 2 || passoRaw === 3 ? passoRaw : 0) as VerdadePasso
  const faseRaw = body.match(/fase:\s*(\w+)/)?.[1] || 'rolar'
  const fase: VerdadeFase = faseRaw === 'escrever' || faseRaw === 'ouvir' || faseRaw === 'responder' || faseRaw === 'cumprir' ? faseRaw : 'rolar'
  const listed = namesOf(body, 'elenco')
  return {
    rodada: Number(body.match(/rodada:\s*(\d+)/)?.[1] || 1) || 1,
    passo,
    fase,
    dado: Number(body.match(/dado:\s*(\d+)/)?.[1] || 0) || 0,
    alvo: body.match(/alvo:\s*(.*)/)?.[1]?.trim() || '',
    elenco: listed.length ? listed : chosenCast(text).verdade,
    jogador: body.match(/jogador:\s*(.*)/)?.[1]?.trim() || '',
  }
}

function writeVerdade(rules: string, flow: ReturnType<typeof verdadeFlow>): string {
  const body = `rodada: ${flow.rodada}\npasso: ${flow.passo}\nfase: ${flow.fase}\ndado: ${flow.dado}\nalvo: ${flow.alvo}\njogador: ${flow.jogador}\nelenco: ${flow.elenco.join('; ')}`
  return refreshMode(replaceBlock(rules, VERDADE_FLOW_S, VERDADE_FLOW_E, body))
}

export function startVerdadeRound(rules: string, npcNames: string[], playerName: string, rodada = 1): string {
  const elenco = unique(npcNames).slice(0, 6)
  return writeVerdade(rules, { rodada, passo: 0, fase: 'rolar', dado: 0, alvo: '', elenco, jogador: playerName || 'protagonista' })
}

/** D6: 1 a 6 cai na pessoa da mesma posição. Passos 0 e 2 esperam o texto dele. 1 e 3 a pessoa fala. */
export function withVerdadeRoll(rules: string, dado: number, alvo: string, fase: 'escrever' | 'ouvir'): string {
  const cur = verdadeFlow(rules)
  return writeVerdade(rules, { ...cur, dado, alvo, fase })
}

/** Sem [[FEITO]], a verdade ou o desafio continua. Com [[FEITO]], a ordem anda. */
export function advanceVerdade(rules: string, _playerName = '', done = false): string {
  const cur = verdadeFlow(rules)
  if (!cur.elenco.length) return rules
  if (cur.fase === 'ouvir') return writeVerdade(rules, { ...cur, fase: 'responder' })
  if (cur.fase !== 'escrever' && cur.fase !== 'responder' && cur.fase !== 'cumprir') return rules
  if (!done) {
    if (cur.fase === 'cumprir') return rules
    return writeVerdade(rules, { ...cur, fase: 'cumprir' })
  }
  const passo = ((cur.passo + 1) % 4) as VerdadePasso
  return writeVerdade(rules, {
    ...cur,
    passo,
    fase: 'rolar',
    dado: 0,
    alvo: '',
    rodada: passo === 0 ? cur.rodada + 1 : cur.rodada,
  })
}

export function verdadeJogada(rules: string | null | undefined, _playerName = ''): string {
  const f = verdadeFlow(rules)
  if (f.elenco.length < 6) return 'JOGADA: faltam os 6 nomes. Espere o jogador confirmar o elenco.'
  const who = f.alvo || 'quem caiu no dado'
  if (f.fase === 'cumprir') {
    const oQue = f.passo >= 2 ? 'desafio' : 'verdade'
    return `JOGADA: o ${oQue} de ${who} AINDA NÃO ACABOU. Continue a mesma cena e a mesma pessoa até o cumprimento completo. Proibido resumir, pular ou abrir outra jogada. Escreva [[FEITO]] só quando estiver concluído de verdade. Sem pending_choices.`
  }
  if (f.passo === 0 && f.fase === 'escrever') return `JOGADA: D6 caiu em ${who}. O protagonista faz uma PERGUNTA. Não invente a pergunta. ${who} é obrigada a responder com toda a verdade da ficha, até o fim. Escreva [[FEITO]] só se a resposta ficou completa. Sem pending_choices.`
  if (f.passo === 1 && f.fase === 'ouvir') return `JOGADA: o narrador rolou o D6 e caiu em ${who}. ${who} faz UMA pergunta para o protagonista. Escreva só a pergunta, em dialogue. Não responda por ele. Sem pending_choices.`
  if (f.passo === 1 && f.fase === 'responder') return `JOGADA: o protagonista responde agora à pergunta de ${who}. A resposta tem que ficar completa. ${who} reage sem encerrar no meio. Escreva [[FEITO]] só quando a verdade dele acabar. Sem pending_choices.`
  if (f.passo === 2 && f.fase === 'escrever') return `JOGADA: D6 caiu em ${who}. O protagonista dá um DESAFIO. Não invente o desafio. ${who} é obrigada a cumprir até o fim, sem resumir. Escreva [[FEITO]] só quando o desafio acabar. Sem pending_choices.`
  if (f.passo === 3 && f.fase === 'ouvir') return `JOGADA: o narrador rolou o D6 e caiu em ${who}. ${who} faz UM desafio para o protagonista. Escreva só o desafio. Não cumpra por ele. Sem pending_choices.`
  if (f.passo === 3 && f.fase === 'responder') return `JOGADA: o protagonista enfrenta o desafio de ${who} até o fim. Não encerre no meio. Escreva [[FEITO]] só quando estiver cumprido. Sem pending_choices.`
  const espera = f.passo === 0 ? 'o protagonista rolar o D6 para perguntar'
    : f.passo === 1 ? 'o narrador rolar o D6 para ver quem pergunta a ele'
    : f.passo === 2 ? 'o protagonista rolar o D6 para desafiar'
    : 'o narrador rolar o D6 para ver quem desafia ele'
  return `JOGADA: espere ${espera}. Não avance a cena. Sem pending_choices.`
}

export function webSince(rules: string | null | undefined): number {
  const body = readBlock(rules || '', WEB_FLOW_S, WEB_FLOW_E)
  return Number(body.match(/desde:\s*(\d+)/)?.[1] || 0) || 0
}

export function withWebSince(rules: string, seq: number): string {
  return refreshMode(replaceBlock(rules, WEB_FLOW_S, WEB_FLOW_E, `desde: ${Math.max(0, seq)}`))
}

/** Lista as fotos do protagonista para o narrador trocar a imagem, como faz com os NPCs. */
export function withPlayerPhotos(rules: string, keys: string[]): string {
  const list = unique(keys.map((k) => k.trim()).filter(Boolean))
  const body = list.length
    ? `chaves: ${list.join(', ')}\nQuando a cena mostrar o protagonista, o humor dele ou uma foto dele, escreva na narração [[FOTO_JOGADOR:chave]] usando só uma chave desta lista. A imagem dele troca do mesmo jeito que a expression troca a imagem de um NPC.`
    : ''
  return replaceBlock(rules, PHOTO_S, PHOTO_E, body)
}

export function persistentStateLine(rules: string | null | undefined, mode?: NarrativeMode): string {
  const text = rules || ''
  const harem = haremRoster(text)
  const team = companionTeam(text)
  const gone = realityOut(text)
  const chosen = chosenCast(text)
  const hf = haremFlow(text)
  const rf = realityFlow(text)
  const bits = [
    mode === 'harem' && hf.dupla
      ? hf.fase === 'final'
        ? `harem fase: final. dupla: ${hf.dupla[0]} e ${hf.dupla[1]}. As duas já tiveram 5 ações. Não escreva cena. Sem pending_choices.`
        : hf.fase === 'solo'
          ? `harem fase: solo. foco: ${hf.foco || hf.dupla[0]}. ações: ${hf.dupla.map((n) => `${n} ${hf.acoes[n] || 0}/5`).join(', ')}. Siga só a proposta escolhida do foco, até o fim desse caminho. A outra não fala nem aparece. Sem pending_choices.`
          : `harem fase: apresenta. dupla: ${hf.dupla[0]} e ${hf.dupla[1]}. ações: ${hf.dupla.map((n) => `${n} ${hf.acoes[n] || 0}/5`).join(', ')}. Cada uma faz uma proposta. Escreva [[PROPOSTA:Nome|proposta]]. O jogador escolhe o caminho. Sem pending_choices.`
      : '',
    mode === 'harem' && !hf.dupla ? 'harem fase: apresenta. Ainda sem dupla: apresente duas mulheres novas que não foram eliminadas. Cada uma faz uma proposta. Escreva [[PROPOSTA:Nome|proposta]] e [[DUPLA:Nome A|Nome B]]. Sem pending_choices.' : '',
    harem.eliminated.length ? `harem eliminadas: ${harem.eliminated.join(', ')}` : '',
    harem.recruited.length ? `harem recrutadas: ${harem.recruited.join(', ')}` : '',
    mode === 'reality' ? `reality fase: ${rf.fase}. reality elenco: ${rf.elenco.join(', ') || '(sorteie 7)'}` : '',
    gone.length ? `reality fora: ${gone.join(', ')}` : '',
    mode === 'companion' ? 'companion: reaja a esta fala com dialogue e [[APROVACAO]] de cada pessoa presente' : '',
    team.team ? `companion na equipe: ${team.team}` : '',
    Object.keys(team.scores).length
      ? `companion placar: ${Object.entries(team.scores).map(([n, v]) => `${n}=${v}`).join(', ')}`
      : '',
    mode === 'verdade' ? verdadeJogada(text, '') : '',
    chosen.verdade.length && mode !== 'web' ? `verdade jogadores: ${chosen.verdade.join(', ')}` : '',
    chosen.web && mode !== 'verdade' ? `web namorada: ${chosen.web}` : '',
    mode === 'web' ? `web desde: ${webSince(text)}` : '',
  ].filter(Boolean)
  return bits.join('. ')
}

export function withNarrativeMode(additionalRules: string | null | undefined, mode: NarrativeMode, theme = ''): string {
  const text = additionalRules || ''
  const start = text.indexOf(MARK_START)
  const end = text.indexOf(MARK_END)
  const rest = (start !== -1 && end !== -1 && end > start)
    ? (text.slice(0, start) + text.slice(end + MARK_END.length)).trim()
    : text.trim()
  const block = `${MARK_START}\n${modeInstructions(mode, theme, persistentStateLine(text, mode))}\n${MARK_END}`
  return rest ? `${block}\n\n${rest}` : block
}

function refreshMode(rules: string): string {
  const { mode, theme } = parseNarrativeMode(rules)
  return withNarrativeMode(rules, mode, theme)
}

export function withHaremRoster(rules: string, recruited: string[], eliminated: string[]): string {
  const cur = haremRoster(rules)
  const elim = unique([...cur.eliminated, ...eliminated])
  const rec = unique([...cur.recruited, ...recruited].filter((n) => !elim.some((e) => e.toLowerCase() === n.toLowerCase())))
  const next = replaceBlock(rules, HAREM_S, HAREM_E, `recrutadas: ${rec.join('; ')}\neliminadas: ${elim.join('; ')}`)
  return refreshMode(next)
}

export function withRealityOut(rules: string, names: string[]): string {
  const gone = unique([...realityOut(rules), ...names])
  return refreshMode(replaceBlock(rules, REALITY_S, REALITY_E, `fora: ${gone.join('; ')}`))
}

export function withCompanionUpdate(
  rules: string,
  deltas: { name: string; delta: number }[],
  stays?: string,
  leaves: string[] = [],
): string {
  const cur = companionTeam(rules)
  const scores = { ...cur.scores }
  for (const d of deltas) {
    if (!d.name) continue
    scores[d.name] = (scores[d.name] || 0) + d.delta
  }
  let members = cur.team.split(';').map((n) => n.trim()).filter(Boolean)
  if (stays?.trim()) members = unique([...members, stays.trim()])
  const drop = new Set(leaves.map((n) => n.toLowerCase()))
  members = members.filter((n) => !drop.has(n.toLowerCase()))
  const placar = Object.entries(scores).map(([n, v]) => `${n}=${v}`).join('; ')
  const body = `na_equipe: ${members.join('; ')}\nplacar: ${placar}`
  return refreshMode(replaceBlock(rules, TEAM_S, TEAM_E, body))
}

export function lastProposals(messages: { content: string; sender_type?: string }[]): { name: string; text: string }[] {
  const found: { name: string; text: string }[] = []
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_type === 'player') break
    const hits = [...messages[i].content.matchAll(/\[\[PROPOSTA:\s*([^|\]]+?)\s*\|\s*([^\]]+?)\s*\]\]/g)]
    for (const m of hits) found.push({ name: m[1].trim(), text: m[2].trim() })
  }
  return found.reverse()
}

export function lastDupla(messages: { content: string }[]): [string, string] | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i].content.match(/\[\[DUPLA:\s*([^|\]]+?)\s*\|\s*([^\]]+?)\s*\]\]/)
    if (m) return [m[1].trim(), m[2].trim()]
  }
  return null
}

export function collectSignals(messages: { content: string }[]): {
  approvals: { name: string; delta: number }[]
  eliminated: string[]
  stays: string
  leaves: string[]
} {
  const approvals: { name: string; delta: number }[] = []
  const eliminated: string[] = []
  const leaves: string[] = []
  let stays = ''
  for (const message of messages) {
    for (const m of message.content.matchAll(/\[\[APROVACAO:\s*([^:\]]+?)\s*:\s*([+-]?(?:1|5|10))\s*\]\]/g)) {
      approvals.push({ name: m[1].trim(), delta: Number(m[2]) })
    }
    for (const m of message.content.matchAll(/\[\[ELIMINADO:\s*([^\]]+?)\s*\]\]/g)) eliminated.push(m[1].trim())
    for (const m of message.content.matchAll(/\[\[SAI:\s*([^\]]+?)\s*\]\]/g)) leaves.push(m[1].trim())
    const fica = message.content.match(/\[\[FICA:\s*([^\]]+?)\s*\]\]/)
    if (fica) stays = fica[1].trim()
  }
  return { approvals, eliminated, stays, leaves }
}

const PHOTO_ASK = /foto|fotos|photo|nudes?|pelad|sem roupa|nua\b|nu\b|pack\b|sensua/i

/** Texto que o chat manda. A parte depois de [[ISOLADO]] é instrução, não a fala. */
export function isolatedChatAction(channel: 'tinder' | 'whatsapp', message: string, points: number): string {
  const chance = Math.max(0, Math.min(100, Math.round(points || 0)))
  const app = channel === 'tinder' ? 'Tinder' : 'WhatsApp'
  const voz = channel === 'tinder'
    ? ' Fale sem papas na língua e sem filtro, 100% na ficha: gíria, NSFW e apelido vulgar se a ficha for assim. Não suavize.'
    : ''
  let photo = 'Não pediu foto. Não mande foto primeiro. Foto só em troca: ninguém manda sem o outro também mandar.'
  if (PHOTO_ASK.test(message)) {
    const roll = Math.floor(Math.random() * 100) + 1
    photo = roll <= chance
      ? `ELE PEDIU FOTO. Se esta mensagem não tiver uma foto dele, não mande a sua: peça a foto dele primeiro. Se ele já mandou a dele, retribua.`
      : `DADO DE FOTO: RECUSOU. Chance ${chance}%. Recuse e não use expression de foto.`
  } else if (chance >= 40 && Math.random() * 100 < Math.min(35, chance / 3)) {
    photo = 'PEÇA A FOTO DELE, no seu jeito. Não mande a sua ainda. Foto nunca sai primeiro e nunca sai sem troca.'
  }
  return `${message}\n[[ISOLADO]]\nIsto é uma conversa nova de ${app}, do zero. Proibido continuar a campanha, citar cenas, narrador, lugares ou fatos do modo normal. A única memória da campanha é a intimidade: ${chance}/100. ${photo}${voz}`
}

export function stripStageDirections(text: string): string {
  return text.split('[[ISOLADO]]')[0]
    .replace(/\[\[APROVACAO:[^\]]+\]\]/g, '')
    .replace(/\[\[DUPLA:[^\]]+\]\]/g, '')
    .replace(/\[\[ELIMINADO:[^\]]+\]\]/g, '')
    .replace(/\[\[FICA:[^\]]+\]\]/g, '')
    .replace(/\[\[SAI:[^\]]+\]\]/g, '')
    .replace(/\[\[FOTO_JOGADOR:[^\]]+\]\]/g, '')
    .replace(/\[\[PROPOSTA:[^\]]+\]\]/g, '')
    .replace(/\[\[FEITO\]\]/g, '')
    .replace(/^\s*(o narrador\s+(disse|fala|falou|narra|narrou|conta|contou)\s*[:,\-–]?\s*)/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function isPhoneMessage(metadata: Record<string, unknown> | null | undefined): boolean {
  const channel = metadata?.channel
  return channel === 'tinder' || channel === 'whatsapp'
}

export function phoneThread<T extends { metadata?: Record<string, unknown> | null; character_id?: string | null }>(
  messages: T[],
  channel: 'tinder' | 'whatsapp',
  characterId: string,
): T[] {
  return messages.filter((m) => {
    if (m.metadata?.channel !== channel) return false
    const who = (typeof m.metadata.character_id === 'string' && m.metadata.character_id) || m.character_id
    return who === characterId
  })
}
