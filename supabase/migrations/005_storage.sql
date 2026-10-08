-- =====================================================================
-- 005_storage.sql — buckets e políticas do Supabase Storage
--
-- DECISÃO DE ARQUITETURA (documentada): os buckets são PÚBLICOS para leitura por URL.
--   * As imagens são exibidas com <img src=URL>; URL pública evita expirar links assinados e mantém o app simples.
--   * Os caminhos são <user_id>/<story_id>/<uuid-aleatório>.webp → não adivinháveis.
--   * A LISTAGEM dos arquivos NÃO é pública: não existe policy de SELECT para anônimos,
--     então ninguém consegue enumerar os caminhos (a URL pública funciona sem policy).
--   * Escrever/apagar/listar só é possível dentro da própria pasta do usuário.
--   * Se você precisar de imagens privadas no futuro: torne o bucket privado
--     (public = false) e troque getPublicUrl por createSignedUrl em lib/story/storage.ts.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('campaign-assets',  'campaign-assets',  true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('character-assets', 'character-assets', true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('player-assets',    'player-assets',    true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('scenario-assets',  'scenario-assets',  true, 8388608, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Upload só em <meu user_id>/<id de uma história MINHA>/arquivo
create or replace function public.storage_upload_path_ok(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare parts text[] := storage.foldername(p_name);
begin
  if auth.uid() is null then return false; end if;
  if coalesce(array_length(parts, 1), 0) <> 2 then return false; end if;
  if parts[1] <> auth.uid()::text then return false; end if;
  if parts[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return exists (select 1 from public.stories s where s.id = parts[2]::uuid and s.user_id = auth.uid());
end $$;
grant execute on function public.storage_upload_path_ok(text) to authenticated;

do $$
declare b text;
begin
  foreach b in array array['campaign-assets','character-assets','player-assets','scenario-assets']
  loop
    execute format('drop policy if exists "%1$s_read" on storage.objects', b);
    execute format('drop policy if exists "%1$s_insert" on storage.objects', b);
    execute format('drop policy if exists "%1$s_update" on storage.objects', b);
    execute format('drop policy if exists "%1$s_delete" on storage.objects', b);

    -- listar/ler pela API: só a própria pasta (a URL pública não depende disto)
    execute format($f$create policy "%1$s_read" on storage.objects for select to authenticated
      using (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text)$f$, b);
    execute format($f$create policy "%1$s_insert" on storage.objects for insert to authenticated
      with check (bucket_id = %1$L and public.storage_upload_path_ok(name))$f$, b);
    execute format($f$create policy "%1$s_update" on storage.objects for update to authenticated
      using (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = %1$L and public.storage_upload_path_ok(name))$f$, b);
    -- apagar: só a própria pasta (mesmo se a história já foi excluída, para limpar órfãos)
    execute format($f$create policy "%1$s_delete" on storage.objects for delete to authenticated
      using (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text)$f$, b);
  end loop;
end $$;
