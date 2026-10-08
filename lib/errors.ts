// Converte erros técnicos em mensagens amigáveis. Detalhes só no console.

export class AppError extends Error {
  constructor(message: string, public code = 'app_error') {
    super(message)
  }
}

export function friendlyError(err: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  console.error('[app]', err)
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Você está sem conexão. Verifique sua internet e tente novamente.'
  if (err instanceof AppError) return err.message
  const e = err as { message?: string; status?: number; code?: string } | null
  const msg = (e?.message ?? '').toLowerCase()
  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (msg.includes('user already registered')) return 'Este e-mail já está cadastrado. Tente entrar.'
  if (msg.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).'
  if (msg.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (msg.includes('jwt') || msg.includes('not authenticated') || e?.status === 401) return 'Sua sessão expirou. Entre novamente.'
  if (msg.includes('failed to fetch') || msg.includes('networkerror')) return 'Não foi possível conectar ao servidor. Verifique sua conexão.'
  if (msg.includes('row-level security')) return 'Você não tem permissão para fazer isso.'
  if (msg.includes('check constraint') || msg.includes('value too long')) return 'Algum texto ficou longo demais. Encurte e tente de novo.'
  if (msg.includes('not authenticated')) return 'Sua sessão expirou. Entre novamente.'
  if (msg.includes('mime type') || msg.includes('not supported')) return 'Formato de imagem não aceito. Use PNG, JPG ou WebP.'
  if (msg.includes('payload too large') || msg.includes('exceeded the maximum')) return 'A imagem é grande demais.'
  return fallback
}
