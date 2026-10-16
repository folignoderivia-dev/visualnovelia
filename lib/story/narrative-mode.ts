export type NarrativeMode = 'visual' | 'aventura' | 'rpg' | 'namoro' | 'tema' | 'harem' | 'adulto' | 'reality' | 'companion' | 'verdade' | 'web'

export const NARRATIVE_MODES: { id: NarrativeMode; label: string; hint: string }[] = [
  { id: 'visual', label: 'Visual novel', hint: 'Conversa entre os personagens. A narração só descreve a cena e oferece opções.' },
  { id: 'aventura', label: 'Aventura', hint: 'Narra a campanha inteira, com capítulos, perigos e ganchos de aventura.' },
  { id: 'rpg', label: 'RPG de mesa', hint: 'Age como mestre: pede dados, testes e aplica regras.' },
  { id: 'namoro', label: 'Simulador de namoro', hint: 'Slice of life com 3 ou 4 personagens por capítulo, um de cada vez.' },
  { id: 'harem', label: 'Harem', hint: 'Duas mulheres por capítulo. Três cenas com cada uma. Depois você escolhe quem fica.' },
  { id: 'adulto', label: '+18', hint: 'Falas adultas, sem filtro e sem censura, no jeito da ficha.' },
  { id: 'reality', label: 'Reality', hint: 'Sete participantes. Convivência, desafios, intimidade, provas e o voto do público.' },
  { id: 'companion', label: 'Companion', hint: 'Cada fala sua gera aprovação ou desaprovação. Quem perde pontos sai da equipe.' },
  { id: 'verdade', label: 'Verdade ou desafio', hint: 'O narrador sorteia quem pergunta para quem. Você pergunta numa vez e recebe na outra.' },
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
${state}Só mulheres da ficha, cada uma tentando conquistar, seduzir ou mostrar qualidades, 100% na ficha. Sem homens e sem gente inventada.
O capítulo é uma dupla. Escreva [[DUPLA:Nome A|Nome B]] na narração. São 3 cenas com a primeira e 3 com a segunda: o ESTADO diz o foco e quantas já foram. Na fase cena, narre essa cena e dê 3 ou 4 escolhas. Não peça a escolha final ainda.
Na fase escolha, pare. pending_choices tem SÓ 2 opções, uma com cada nome, dizendo quem fica. A outra some para sempre: não fala, não aparece e não é citada.
Narração com lugar e corpo. Falas só em dialogue, com character_id real. Nada vazio. Não escreva a fala do protagonista.
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
${state}Adultos. Só o protagonista e os 6 nomes do ESTADO. Siga a linha JOGADA, nessa ordem, sem pular ninguém.
VERDADE: resposta sincera, sem desviar, com segredos, objetivos, medos e o que pensa do protagonista. Vale pergunta íntima, constrangedora, tabu, fetiche, preferência e escolha tensa. DESAFIO: a pessoa cumpre beijo, toque ou o que a ficha permitir.
Se a JOGADA diz que o protagonista pergunta: não invente a pergunta. O alvo responde ou cumpre agora. pending_choices vazio.
Se a JOGADA diz que ele recebe e ainda não ouviu: escreva SÓ a pergunta ou o desafio, em dialogue, com o character_id de quem pergunta. Não responda por ele. pending_choices vazio.
Se a JOGADA diz que ele já respondeu: quem perguntou reage em uma fala curta. pending_choices vazio.
Se a JOGADA é entre dois NPCs: os dois jogam agora, pergunta e resposta. pending_choices vazio.
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

export type HaremPhase = 'cena' | 'escolha'
export function haremFlow(rules: string | null | undefined): { fase: HaremPhase; dupla: [string, string] | null; cenas: number } {
  const body = readBlock(rules || '', HAREM_FLOW_S, HAREM_FLOW_E)
  const fase: HaremPhase = /fase:\s*escolha/i.test(body) ? 'escolha' : 'cena'
  const pair = namesOf(body, 'dupla')
  const cenas = Number(body.match(/cenas:\s*(\d+)/)?.[1] || 0)
  return { fase, dupla: pair.length >= 2 ? [pair[0], pair[1]] : null, cenas: Number.isFinite(cenas) ? cenas : 0 }
}

function writeHaremFlow(rules: string, fase: HaremPhase, dupla: [string, string] | null, cenas: number): string {
  const body = `fase: ${fase}\ndupla: ${dupla ? dupla.join('; ') : ''}\ncenas: ${cenas}`
  return refreshMode(replaceBlock(rules, HAREM_FLOW_S, HAREM_FLOW_E, body))
}

/** Conta uma cena da dupla. Na 6ª (3 de cada) trava na escolha. */
export function noteHaremScene(rules: string, dupla: [string, string] | null): string {
  if (!dupla) return rules
  const gone = haremRoster(rules).eliminated.map((n) => n.toLowerCase())
  if (dupla.some((n) => gone.includes(n.toLowerCase()))) return writeHaremFlow(rules, 'cena', null, 0)
  const cur = haremFlow(rules)
  const same = cur.dupla
    && cur.dupla[0].toLowerCase() === dupla[0].toLowerCase()
    && cur.dupla[1].toLowerCase() === dupla[1].toLowerCase()
  const cenas = same ? cur.cenas + 1 : 1
  return writeHaremFlow(rules, cenas >= 6 ? 'escolha' : 'cena', dupla, Math.min(cenas, 6))
}

export function resetHaremChapter(rules: string): string {
  return writeHaremFlow(rules, 'cena', null, 0)
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

export interface VerdadePlay { asker: string; target: string; kind: 'verdade' | 'desafio' }
export function verdadeFlow(rules: string | null | undefined): {
  rodada: number
  indice: number
  sub: '' | 'ouvir' | 'responder'
  fila: VerdadePlay[]
  alvo: string
  tipo: '' | 'verdade' | 'desafio'
  jogador: string
} {
  const body = readBlock(rules || '', VERDADE_FLOW_S, VERDADE_FLOW_E)
  const fila = (body.match(/fila:\s*(.*)/)?.[1] || '').split(';').map((part) => {
    const [asker, target, kind] = part.split('::').map((x) => x.trim())
    if (!asker || !target) return null
    return { asker, target, kind: kind === 'desafio' ? 'desafio' as const : 'verdade' as const }
  }).filter((x): x is VerdadePlay => !!x)
  const subRaw = body.match(/sub:\s*(\w+)/)?.[1] || ''
  const tipoRaw = body.match(/tipo:\s*(\w+)/)?.[1] || ''
  return {
    rodada: Number(body.match(/rodada:\s*(\d+)/)?.[1] || 1) || 1,
    indice: Number(body.match(/indice:\s*(\d+)/)?.[1] || 0) || 0,
    sub: subRaw === 'ouvir' || subRaw === 'responder' ? subRaw : '',
    fila,
    alvo: body.match(/alvo:\s*(.*)/)?.[1]?.trim() || '',
    tipo: tipoRaw === 'verdade' || tipoRaw === 'desafio' ? tipoRaw : '',
    jogador: body.match(/jogador:\s*(.*)/)?.[1]?.trim() || '',
  }
}

function writeVerdade(rules: string, flow: ReturnType<typeof verdadeFlow>): string {
  const fila = flow.fila.map((p) => `${p.asker}::${p.target}::${p.kind}`).join('; ')
  const body = `rodada: ${flow.rodada}\nindice: ${flow.indice}\nsub: ${flow.sub}\njogador: ${flow.jogador}\nalvo: ${flow.alvo}\ntipo: ${flow.tipo}\nfila: ${fila}`
  return refreshMode(replaceBlock(rules, VERDADE_FLOW_S, VERDADE_FLOW_E, body))
}

export function startVerdadeRound(rules: string, npcNames: string[], playerName: string, rodada = 1): string {
  const names = unique(npcNames).slice(0, 6)
  const askers = shuffle(names)
  const recebe = Math.floor(Math.random() * Math.max(askers.length, 1))
  const fila: VerdadePlay[] = askers.map((asker, i) => {
    const kind: VerdadePlay['kind'] = Math.random() < 0.5 ? 'verdade' : 'desafio'
    if (i === recebe) return { asker, target: playerName || 'protagonista', kind }
    const others = names.filter((n) => n.toLowerCase() !== asker.toLowerCase())
    const target = others[Math.floor(Math.random() * Math.max(others.length, 1))] || asker
    return { asker, target, kind }
  })
  return writeVerdade(rules, { rodada, indice: 0, sub: '', fila, alvo: '', tipo: '', jogador: playerName || 'protagonista' })
}

export function withVerdadeAsk(rules: string, target: string, kind: 'verdade' | 'desafio'): string {
  const cur = verdadeFlow(rules)
  return writeVerdade(rules, { ...cur, indice: 0, sub: '', alvo: target, tipo: kind })
}

/** Avança a rodada depois que o narrador respondeu a jogada atual. */
export function advanceVerdade(rules: string, playerName: string): string {
  const cur = verdadeFlow(rules)
  const you = (playerName || 'protagonista').toLowerCase()
  if (!cur.fila.length) return rules
  if (cur.indice <= 0) {
    const first = cur.fila[0]
    const sub = first && first.target.toLowerCase() === you ? 'ouvir' as const : '' as const
    return writeVerdade(rules, { ...cur, indice: 1, sub, alvo: '', tipo: '' })
  }
  const play = cur.fila[cur.indice - 1]
  if (play && play.target.toLowerCase() === you && cur.sub === 'ouvir') {
    return writeVerdade(rules, { ...cur, sub: 'responder' })
  }
  const indice = cur.indice + 1
  if (indice > cur.fila.length) {
    const names = unique(cur.fila.map((p) => p.asker))
    return startVerdadeRound(rules, names, playerName, cur.rodada + 1)
  }
  const next = cur.fila[indice - 1]
  const sub = next && next.target.toLowerCase() === you ? 'ouvir' as const : '' as const
  return writeVerdade(rules, { ...cur, indice, sub, alvo: '', tipo: '' })
}

export function verdadeJogada(rules: string | null | undefined, playerName = ''): string {
  const f = verdadeFlow(rules)
  const you = playerName || f.jogador || 'protagonista'
  if (!f.fila.length) return 'JOGADA: ainda sem sorteio. Espere o jogador confirmar os 6.'
  if (f.indice <= 0) {
    if (f.alvo && f.tipo) return `JOGADA: o protagonista pergunta ${f.tipo} para ${f.alvo}. ${f.alvo} responde ou cumpre agora. Sem pending_choices.`
    return 'JOGADA: vez do protagonista perguntar ou desafiar. Espere o nome e o tipo na ação. Sem pending_choices.'
  }
  const play = f.fila[f.indice - 1]
  if (!play) return 'JOGADA: rode de novo.'
  if (play.target.toLowerCase() === you.toLowerCase()) {
    if (f.sub === 'responder') return `JOGADA: o protagonista responde agora na ação ao ${play.kind} de ${play.asker}. ${play.asker} só reage, curto. Sem pending_choices.`
    return `JOGADA: ${play.asker} faz um ${play.kind} para o protagonista. Escreva só a pergunta ou o desafio. Sem pending_choices.`
  }
  return `JOGADA: ${play.asker} faz um ${play.kind} para ${play.target}. Os dois jogam agora. Sem pending_choices.`
}

export function webSince(rules: string | null | undefined): number {
  const body = readBlock(rules || '', WEB_FLOW_S, WEB_FLOW_E)
  return Number(body.match(/desde:\s*(\d+)/)?.[1] || 0) || 0
}

export function withWebSince(rules: string, seq: number): string {
  return refreshMode(replaceBlock(rules, WEB_FLOW_S, WEB_FLOW_E, `desde: ${Math.max(0, seq)}`))
}

function shuffle<T>(list: T[]): T[] {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
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
      ? hf.fase === 'escolha'
        ? `harem fase: escolha. dupla: ${hf.dupla[0]} e ${hf.dupla[1]}. As 6 cenas acabaram. pending_choices só com esses dois nomes.`
        : `harem fase: cena. dupla: ${hf.dupla[0]} e ${hf.dupla[1]}. cenas feitas: ${hf.cenas} de 6. próxima cena com: ${hf.cenas % 2 === 0 ? hf.dupla[0] : hf.dupla[1]}`
      : '',
    mode === 'harem' && !hf.dupla ? 'harem fase: cena. Ainda sem dupla: apresente duas mulheres novas que não foram eliminadas.' : '',
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
  let photo = 'Não pediu foto. Não mande foto.'
  if (PHOTO_ASK.test(message)) {
    const roll = Math.floor(Math.random() * 100) + 1
    photo = roll <= chance
      ? `DADO DE FOTO: ACEITOU. Chance ${chance}%. Mande a foto.`
      : `DADO DE FOTO: RECUSOU. Chance ${chance}%. Recuse a foto e não use expression de foto.`
  }
  return `${message}\n[[ISOLADO]]\nIsto é uma conversa nova de ${app}, do zero. Proibido continuar a campanha, citar cenas, narrador, lugares ou fatos do modo normal. A única memória da campanha é a intimidade: ${chance}/100. ${photo}`
}

export function stripStageDirections(text: string): string {
  return text.split('[[ISOLADO]]')[0]
    .replace(/\[\[APROVACAO:[^\]]+\]\]/g, '')
    .replace(/\[\[DUPLA:[^\]]+\]\]/g, '')
    .replace(/\[\[ELIMINADO:[^\]]+\]\]/g, '')
    .replace(/\[\[FICA:[^\]]+\]\]/g, '')
    .replace(/\[\[SAI:[^\]]+\]\]/g, '')
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
