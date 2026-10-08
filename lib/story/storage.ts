// Upload de imagens para o Supabase Storage (com redução de tamanho no navegador).
import { supabase } from '@/lib/supabase/client'
import { AppError } from '@/lib/errors'

export type Bucket = 'campaign-assets' | 'character-assets' | 'player-assets' | 'scenario-assets'

const MAX_INPUT_BYTES = 12 * 1024 * 1024

async function shrink(file: File, maxSide: number): Promise<Blob> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new AppError('Use uma imagem PNG, JPG ou WebP.')
  if (file.size > MAX_INPUT_BYTES) throw new AppError('A imagem é grande demais (máximo 12 MB).')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.85))
  if (!blob) throw new AppError('Não foi possível processar a imagem.')
  return blob
}

/** Caminho: <user_id>/<story_id>/<uuid>.webp — a política do Storage exige a pasta do próprio usuário. */
export async function uploadImage(opts: {
  bucket: Bucket; userId: string; storyId: string; file: File; maxSide?: number
}): Promise<{ url: string; path: string }> {
  const blob = await shrink(opts.file, opts.maxSide ?? 1600)
  const path = `${opts.userId}/${opts.storyId}/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage.from(opts.bucket).upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' })
  if (error) throw error
  const { data } = supabase.storage.from(opts.bucket).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

export async function removeImage(bucket: Bucket, path: string | null) {
  if (path) await supabase.storage.from(bucket).remove([path])
}
