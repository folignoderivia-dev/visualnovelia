-- =====================================================================
-- 008_character_voice.sql — Voz Gemini TTS de cada NPC
-- Rode este arquivo no SQL Editor do Supabase se o banco já existe.
-- =====================================================================

alter table public.characters
  add column if not exists voice text;
