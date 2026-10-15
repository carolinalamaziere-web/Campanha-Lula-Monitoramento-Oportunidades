# War Room Lula 2026 — Painel v4

Painel estático ligado a um arquivo de dados independente. O navegador recarrega `dados.json` a cada cinco minutos e o GitHub Actions atualiza indicadores oficiais às 07h e 19h, no horário de Brasília.

## Estrutura

- `index.html`: painel publicado.
- `dados.json`: conteúdo dinâmico e indicadores.
- `scripts/painel-dinamico.js`: busca e renderiza os dados no navegador.
- `scripts/atualiza-dados.js`: consulta séries oficiais do Banco Central.
- `scripts/atualiza-meta-graph.js`: busca publicações públicas e monta o ranking de engajamento da Meta Graph API.
- `scripts/gera-conteudo-meta.js`: transforma fatos com fonte e data em sugestões populares usando a Meta Model API.
- `.github/workflows/daily.yml`: rotina automática e execução manual.
- `netlify.toml`: publicação da raiz e prevenção de cache do JSON.

## Publicar no GitHub

1. Crie um repositório chamado `war-room-lula-2026`.
2. Envie **o conteúdo desta pasta**, não o arquivo ZIP fechado.
3. Confirme que a aba **Actions** está habilitada.
4. Em **Actions > Atualiza Painel Diário**, use **Run workflow** para o primeiro teste.

## Ligar ao site existente do Netlify

1. Abra o projeto `coruscating-tulumba-757d4e`.
2. Acesse **Project configuration > Build & deploy > Continuous deployment**.
3. Escolha **Link repository** e selecione `war-room-lula-2026`.
4. Build command: vazio.
5. Publish directory: `.`.
6. Faça o primeiro deploy e confirme que o domínio continua sendo `coruscating-tulumba-757d4e.netlify.app`.

Não é necessário criar `NETLIFY_HOOK`: o commit feito pelo GitHub Actions já aciona o deploy do Netlify quando o repositório está ligado.

## Fontes automáticas

O script consulta séries públicas do Sistema Gerenciador de Séries Temporais do Banco Central:

- IPCA mensal: série 433.
- Selic: série 432.
- Dólar — venda: série 10813.

Os demais conteúdos editoriais permanecem em `dados.json` para revisão humana. Não publique números ou acusações sem validar a fonte e a data de referência.

## Integração com a Meta Graph API

O painel pode exibir automaticamente imagens, Reels e vídeos públicos de Páginas do Facebook e contas profissionais do Instagram. A coleta ocorre no GitHub Actions; o token nunca é enviado ao navegador nem salvo em `dados.json`.

### 1. Credencial

No GitHub, abra **Settings > Secrets and variables > Actions > Secrets** e crie:

- `META_ACCESS_TOKEN`: token válido da Meta Graph API.

Use um token com as permissões adequadas ao caso, normalmente `pages_show_list`, `pages_read_engagement` e `instagram_basic`. Para Páginas que você não administra, o aplicativo precisa da aprovação **Page Public Content Access**. O Instagram Business Discovery exige uma conta profissional autenticada e só consulta contas profissionais públicas.

### 2. Fontes monitoradas

Em **Settings > Secrets and variables > Actions > Variables**, crie:

- `META_FACEBOOK_PAGE_IDS`: IDs ou nomes de usuário das Páginas, separados por vírgula.
- `META_INSTAGRAM_USERNAMES`: usuários públicos do Instagram, sem `@`, separados por vírgula.
- `META_IG_USER_ID`: ID da conta profissional autenticada usada para o Instagram Business Discovery.

Variáveis opcionais:

- `META_GRAPH_API_VERSION`: versão da Graph API, no formato `v26.0`. Se omitida, o script usa `v26.0`.
- `META_GRAPH_FETCH_LIMIT`: publicações consultadas por conta, de 1 a 100. Padrão: `25`.
- `META_GRAPH_TOP_LIMIT`: conteúdos mantidos no ranking combinado, de 1 a 50. Padrão: `12`.

Depois de configurar, abra **Actions > Atualiza Painel Diário > Run workflow**. O resultado é salvo em `dados.json`, no objeto `metaGraph`, e publicado no painel. Uma falha da Meta não apaga o último ranking válido e não interrompe a atualização dos demais indicadores.

Para testar localmente, defina as mesmas variáveis no terminal e execute `node scripts/atualiza-meta-graph.js`. Não salve o token em arquivos versionados; arquivos `.env` estão bloqueados pelo `.gitignore`.

O ranking soma somente interações públicas retornadas pela plataforma: reações, comentários e compartilhamentos no Facebook; curtidas e comentários no Instagram. Alcance, impressões, salvamentos, retenção e outras métricas privadas não ficam disponíveis para contas externas.

## Integração com a IA da Meta

O fluxo usa a Meta Model API no servidor do GitHub Actions. A chave nunca é enviada ao navegador nem gravada no repositório.

1. Entre no painel da Meta Model API e crie uma API key.
2. No GitHub, abra **Settings > Secrets and variables > Actions**.
3. Crie um secret chamado `MODEL_API_KEY` e cole a chave.
4. Abra **Actions > Atualiza Painel Diário > Run workflow** para testar.

Quando a chave estiver configurada, a rotina envia somente itens de `dados.json` que tenham valor, data e fonte. A resposta estruturada é salva em `dados.json`, dentro de `metaIA`, com o modelo usado, horário de geração e fonte original de cada item.

Para testar localmente no Windows, use `node --use-system-ca scripts/atualiza-dados.js` caso sua instalação do Node precise dos certificados do sistema.
