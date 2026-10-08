'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Upload } from 'lucide-react'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/toast'

/** Campo de texto — mesmo markup/estilo criado no V0. */
export function Field({ label, placeholder, multiline = false, value, onChange, rows = 4 }: {
  label: string; placeholder: string; multiline?: boolean; value: string; onChange: (v: string) => void; rows?: number
}) {
  const shared = { value, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value), placeholder, 'aria-label': label }
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? <textarea {...shared} rows={rows} /> : <input {...shared} />}
    </label>
  )
}

/** Seleção múltipla em chips; guarda como "A, B, C". Inclui opção personalizada. */
export function ChipPicker({ options, value, onChange, label, hint }: {
  options: string[]; value: string; onChange: (v: string) => void; label: string; hint?: string
}) {
  const selected = value.split(',').map((x) => x.trim()).filter(Boolean)
  const [adding, setAdding] = useState(false)
  const [custom, setCustom] = useState('')
  const toggle = (item: string) => {
    const next = selected.includes(item) ? selected.filter((x) => x !== item) : [...selected, item]
    onChange(next.join(', '))
  }
  const customSelected = selected.filter((x) => !options.includes(x))
  return (
    <div className="field">
      <span>{label}{hint && <em>{hint}</em>}</span>
      <div className="chip-grid">
        {options.map((item) => <button type="button" key={item} className={`chip ${selected.includes(item) ? 'selected' : ''}`} onClick={() => toggle(item)}>{item}</button>)}
        {customSelected.map((item) => <button type="button" key={item} className="chip selected" onClick={() => toggle(item)}>{item}</button>)}
        {adding ? (
          <input className="chip-input" autoFocus value={custom} placeholder="Digite e Enter" maxLength={30}
            onChange={(e) => setCustom(e.target.value)}
            onBlur={() => { setAdding(false); setCustom('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = custom.trim(); if (v && !selected.includes(v)) onChange([...selected, v].join(', ')); setAdding(false); setCustom('') } }} />
        ) : <button type="button" className="chip custom-chip" onClick={() => setAdding(true)}>+ Personalizado</button>}
      </div>
    </div>
  )
}

/** Pré-visualização + upload (usa o placeholder do V0 quando não há imagem). */
export function ImageUpload({ url, onFile, large = false, placeholder = 'Seu cenário aparece aqui', buttonClass = 'outline-button' }: {
  url: string | null; onFile: (file: File) => Promise<void>; large?: boolean; placeholder?: string; buttonClass?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const { notify } = useToast()
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try { await onFile(file) } catch (err) { notify(friendlyError(err, 'Não foi possível enviar a imagem.'), 'error') } finally { setBusy(false) }
  }
  return (
    <>
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <div className={`placeholder-art has-image ${large ? 'placeholder-art-large' : ''}`}><img src={url} alt="" loading="lazy" /></div>
        : <div className={`placeholder-art ${large ? 'placeholder-art-large' : ''}`}><ImagePlus aria-hidden="true" /><span>{placeholder}</span></div>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pick} />
      <button type="button" className={`${buttonClass} upload-full`} disabled={busy} onClick={() => input.current?.click()}>
        <Upload /> {busy ? 'Enviando…' : url ? 'Trocar imagem' : 'Carregar imagem'}
      </button>
    </>
  )
}
