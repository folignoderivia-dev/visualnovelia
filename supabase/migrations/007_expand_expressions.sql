-- =====================================================================
-- 007_expand_expressions.sql — Permite novas expressões e fotos
-- =====================================================================

alter table public.character_expressions
  drop constraint if exists character_expressions_expression_type_check;

alter table public.character_expressions
  add constraint character_expressions_expression_type_check
  check (expression_type in (
    'neutral','happy','sad','angry','scared','surprised','in_love','worried','ashamed','intimate',
    'foto_casual','foto_sensual','foto_pe','foto_18'
  ));
