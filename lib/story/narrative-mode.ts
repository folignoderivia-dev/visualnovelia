export type NarrativeMode = 'visual' | 'aventura' | 'rpg' | 'namoro' | 'tema'

export const NARRATIVE_MODES: { id: NarrativeMode; label: string; hint: string }[] = [
  { id: 'visual', label: 'Visual novel', hint: 'Conversa entre os personagens. A narração só descreve a cena e oferece opções.' },
  { id: 'aventura', label: 'Aventura', hint: 'Narra a campanha inteira, com capítulos, perigos e ganchos de aventura.' },
  { id: 'rpg', label: 'RPG de mesa', hint: 'Age como mestre: pede dados, testes e aplica regras.' },
  { id: 'namoro', label: 'Simulador de namoro', hint: 'Slice of life com 3 ou 4 personagens por capítulo, um de cada vez.' },
  { id: 'tema', label: 'Tema regrado', hint: 'Você escreve um filme, jogo ou campanha e a história segue esse cânone.' },
]

const MARK_START = '[[MODO_NARRATIVO]]'
const MARK_END = '[[/MODO_NARRATIVO]]'

const SHEET = `REGRA DE OURO DA FICHA: cada personagem criado segue 100% a ficha editada pelo jogador — nome, apelido, idade, aparência, personalidade, estilo de fala, objetivos, medos, segredos, passado, informações extras e, acima de tudo, o que pensa sobre o protagonista. Não suavize, não contradiga e não invente um jeito de ser diferente do que está escrito. Prompts e campos da ficha são lei.`

export function modeInstructions(mode: NarrativeMode, theme = ''): string {
  const common = `${SHEET}
Sempre termine com 3 ou 4 opções em pending_choices, perguntando o que o jogador quer fazer. Nunca escreva a fala, o pensamento ou a decisão do protagonista.`
  if (mode === 'aventura') {
    return `MODO ATIVO: AVENTURA.
Você narra como narrador de aventura. Conte a cena inteira: o lugar, o perigo, o que o mundo faz e para onde a campanha pode ir. Crie ganchos, capítulos e consequências. Quando a situação mudar de verdade, marque new_chapter. Falas de personagem continuam em dialogue com o character_id real, nunca dentro da narração.
${common}`
  }
  if (mode === 'rpg') {
    return `MODO ATIVO: RPG DE MESA.
Você é o mestre da mesa. Obrigatório regrar a cena: diga qual teste o jogador precisa fazer, a dificuldade e o que está em jogo. Se ele ainda não rolou o dado, pare antes de resolver e peça o D20. Se a ação trouxer "[O jogador rolou um D20 e tirou: X]", aplique: 1-5 falha trágica, 6-10 falha, 11-15 sucesso com custo, 16-20 sucesso épico. Descreva o resultado com clareza de regra.
${common}`
  }
  if (mode === 'namoro') {
    return `MODO ATIVO: SIMULADOR DE NAMORO (slice of life).
Use o elenco para as pessoas se conhecerem. Em cada capítulo, escolha só 3 ou 4 personagens e foque neles um de cada vez, em cenas separadas. Não coloque o elenco inteiro junto. Simule amizade, aproximação, tentativa de flerte, romance e o que a ficha daquele personagem permitir — nada além do que a ficha autoriza. Ao abrir um capítulo novo, troque o grupo de 3 ou 4. A narração só descreve o lugar e o clima; o resto é fala do personagem em dialogue.
${common}`
  }
  if (mode === 'tema') {
    const subject = theme.trim() || '(tema ainda não escrito)'
    return `MODO ATIVO: TEMA REGRADO.
O tema canônico é: "${subject}".
Estude esse filme, jogo ou campanha e narre dentro dele: tom, regras, lugares, fatos e espírito dessa obra. Não quebre o cânone e não troque o tema por outro universo. A aventura do jogador acontece ali. Os personagens criados na ficha continuam existindo dentro desse tema e obedecem 100% a ficha.
${common}`
  }
  return `MODO ATIVO: VISUAL NOVEL.
Isto é uma visual novel interativa. A cena é conversa do protagonista com os personagens criados.
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
  if (modeLine.includes('aventura')) mode = 'aventura'
  else if (modeLine.includes('rpg')) mode = 'rpg'
  else if (modeLine.includes('namoro')) mode = 'namoro'
  else if (modeLine.includes('tema')) mode = 'tema'
  const theme = body.match(/O tema canônico é:\s*"([^"]*)"/)?.[1] || ''
  return { mode, theme: theme === '(tema ainda não escrito)' ? '' : theme }
}

export function withNarrativeMode(additionalRules: string | null | undefined, mode: NarrativeMode, theme = ''): string {
  const text = additionalRules || ''
  const start = text.indexOf(MARK_START)
  const end = text.indexOf(MARK_END)
  const rest = (start !== -1 && end !== -1 && end > start)
    ? (text.slice(0, start) + text.slice(end + MARK_END.length)).trim()
    : text.trim()
  const block = `${MARK_START}\n${modeInstructions(mode, theme)}\n${MARK_END}`
  return rest ? `${block}\n\n${rest}` : block
}
