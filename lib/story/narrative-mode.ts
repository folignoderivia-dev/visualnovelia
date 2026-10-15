export type NarrativeMode = 'visual' | 'aventura' | 'rpg' | 'namoro' | 'tema' | 'harem' | 'adulto' | 'reality' | 'companion' | 'verdade' | 'web'

export const NARRATIVE_MODES: { id: NarrativeMode; label: string; hint: string }[] = [
  { id: 'visual', label: 'Visual novel', hint: 'Conversa entre os personagens. A narração só descreve a cena e oferece opções.' },
  { id: 'aventura', label: 'Aventura', hint: 'Narra a campanha inteira, com capítulos, perigos e ganchos de aventura.' },
  { id: 'rpg', label: 'RPG de mesa', hint: 'Age como mestre: pede dados, testes e aplica regras.' },
  { id: 'namoro', label: 'Simulador de namoro', hint: 'Slice of life com 3 ou 4 personagens por capítulo, um de cada vez.' },
  { id: 'harem', label: 'Harem', hint: 'Duas mulheres por cena. Você recruta uma. A outra sai e não volta.' },
  { id: 'adulto', label: '+18', hint: 'Falas adultas, sem filtro e sem censura, no jeito da ficha.' },
  { id: 'reality', label: 'Reality', hint: 'Ilha do Desafio: provas, romance, voto do público e uma eliminação por capítulo.' },
  { id: 'companion', label: 'Companion', hint: 'Mistério e romance. Dois personagens por capítulo; um fica, pelo placar de aprovação.' },
  { id: 'verdade', label: 'Verdade ou desafio', hint: 'Você escolhe 6 personagens. Cada um joga uma vez, inclusive você.' },
  { id: 'web', label: 'Web namorada', hint: 'Você escolhe uma personagem. A aventura inteira é só o diálogo com ela.' },
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
${state}Simulador de namoro com eliminação. Foco só em personagens femininas da ficha, cada uma tentando seduzir o protagonista, 100% dentro da ficha.
Cada cena traz exatamente 2 mulheres que ainda não foram eliminadas. Na primeira linha da narração escreva [[DUPLA:Nome A|Nome B]].
O jogador recruta só uma. A outra sai para sempre neste modo: não fala, não aparece e não é citada de novo. Quem foi recrutada fica no relacionamento e pode voltar depois. A cena seguinte usa outras duas que ainda estão no jogo.
pending_choices tem só 2 opções, cada uma com o nome de quem fica. Não traga homens para a sedução. Não invente personagens.
${common}`
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
${state}Você é o mestre e o apresentador de um reality no estilo Ilha do Desafio. Neste modo você pode falar como apresentador. Use o elenco inteiro.
Cada capítulo tem prova, romance, escolha difícil e consequência. No fim do capítulo alguém é eliminado. O jogo mede até onde o protagonista dura; ele também pode sair se o voto decidir isso.
O voto do público é um D20. Sem "[D20: N]" ou "[O jogador rolou um D20 e tirou: N]" na ação, peça o dado e não elimine ainda.
1-5: o protagonista quase sai ou sai. 6-10: um aliado sai por pouco. 11-15: o protagonista fica e outro sai. 16-20: o protagonista domina o voto.
Ao eliminar, escreva [[ELIMINADO:Nome]]. Essa pessoa não volta.
${common}`
  }
  if (mode === 'companion') {
    return `MODO ATIVO: COMPANION.
${state}Aventura de mistério e romance no espírito de Baldur's Gate 3. Cada capítulo o protagonista conhece 2 personagens novos. Na narração escreva [[DUPLA:Nome A|Nome B]].
No fim do capítulo só o de maior aprovação segue na equipe. Escreva [[FICA:Nome]] e [[SAI:Nome]]. Quem sai não viaja junto. Quem já está na equipe continua.
Cada fala, escolha e comportamento do protagonista gera reação coerente com a personalidade. No fim da narração, uma linha por personagem presente, só com +1, +5, +10, -1, -5 ou -10: [[APROVACAO:Nome:+5]]. 1 é um gesto pequeno, 5 uma escolha que importa, 10 acerta ou fere o núcleo da ficha. Não invente outro número.
${common}`
  }
  if (mode === 'verdade') {
    return `MODO ATIVO: VERDADE OU DESAFIO.
${state}Todos são adultos. Jogam só o protagonista e os 6 nomes do ESTADO, uma vez cada por rodada, sempre incluindo o protagonista, e depois a rodada recomeça.
No turno de um NPC ele joga de verdade. VERDADE: responde com sinceridade, sem desviar, usando segredos, objetivos, medos e o que pensa do protagonista na ficha. Vale pergunta íntima, constrangedora, tabu, fetiche, preferência e escolha tensa. DESAFIO: cumpre beijo, toque ou o que a ficha permitir.
No turno do protagonista, não escreva a resposta dele. Em pending_choices ofereça "Verdade" e "Desafio", com a pergunta ou o desafio já dito para ele reagir. Não traga ninguém de fora da lista.
${common}`
  }
  if (mode === 'web') {
    return `MODO ATIVO: WEB NAMORADA.
${state}A aventura inteira é só o protagonista e a personagem nomeada no ESTADO. Nenhuma outra pessoa entra ou fala.
O foco é diálogo imersivo entre os dois, roleplay autêntico, 100% a ficha dela. A narração só descreve o lugar, curto. Toda fala dela vai em dialogue com o character_id real. Não escreva a fala do protagonista.
${common}`
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

export function persistentStateLine(rules: string | null | undefined, mode?: NarrativeMode): string {
  const text = rules || ''
  const harem = haremRoster(text)
  const team = companionTeam(text)
  const gone = realityOut(text)
  const chosen = chosenCast(text)
  const bits = [
    harem.eliminated.length ? `harem eliminadas: ${harem.eliminated.join(', ')}` : '',
    harem.recruited.length ? `harem recrutadas: ${harem.recruited.join(', ')}` : '',
    gone.length ? `reality fora: ${gone.join(', ')}` : '',
    team.team ? `companion na equipe: ${team.team}` : '',
    Object.keys(team.scores).length
      ? `companion placar: ${Object.entries(team.scores).map(([n, v]) => `${n}=${v}`).join(', ')}`
      : '',
    chosen.verdade.length && mode !== 'web' ? `verdade jogadores: ${chosen.verdade.join(', ')}` : '',
    chosen.web && mode !== 'verdade' ? `web namorada: ${chosen.web}` : '',
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
): string {
  const cur = companionTeam(rules)
  const scores = { ...cur.scores }
  for (const d of deltas) {
    if (!d.name) continue
    scores[d.name] = (scores[d.name] || 0) + d.delta
  }
  const team = stays?.trim() || cur.team
  const placar = Object.entries(scores).map(([n, v]) => `${n}=${v}`).join('; ')
  const body = `na_equipe: ${team}\nplacar: ${placar}`
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
} {
  const approvals: { name: string; delta: number }[] = []
  const eliminated: string[] = []
  let stays = ''
  for (const message of messages) {
    for (const m of message.content.matchAll(/\[\[APROVACAO:\s*([^:\]]+?)\s*:\s*([+-]?(?:1|5|10))\s*\]\]/g)) {
      approvals.push({ name: m[1].trim(), delta: Number(m[2]) })
    }
    for (const m of message.content.matchAll(/\[\[ELIMINADO:\s*([^\]]+?)\s*\]\]/g)) eliminated.push(m[1].trim())
    const fica = message.content.match(/\[\[FICA:\s*([^\]]+?)\s*\]\]/)
    if (fica) stays = fica[1].trim()
  }
  return { approvals, eliminated, stays }
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
