create table if not exists public.conteudos_painel (
  id text primary key,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicar', 'arquivado')),
  titulo text not null,
  fato text not null,
  valor text,
  data_referencia text,
  fonte text,
  publico text,
  plataforma text,
  formato text,
  volume bigint,
  interacoes bigint,
  crescimento numeric,
  publicado_em timestamptz,
  analise text,
  orientacao text,
  updated_at timestamptz not null default now()
);

alter table public.conteudos_painel add column if not exists plataforma text;
alter table public.conteudos_painel add column if not exists volume bigint;
alter table public.conteudos_painel add column if not exists interacoes bigint;
alter table public.conteudos_painel add column if not exists crescimento numeric;
alter table public.conteudos_painel add column if not exists publicado_em timestamptz;
alter table public.conteudos_painel add column if not exists analise text;

alter table public.conteudos_painel enable row level security;
revoke all on table public.conteudos_painel from anon, authenticated;

comment on table public.conteudos_painel is
  'Fonte editorial do War Room. O GitHub Actions lê com uma chave secreta mantida no servidor.';
