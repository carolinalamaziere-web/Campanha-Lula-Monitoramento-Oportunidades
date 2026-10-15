# War Room Lula 2026 — painel automático ao vivo

Painel estático de oito abas publicado pelo Netlify a partir do GitHub. O conteúdo dinâmico fica em `dados.json`; o navegador consulta esse arquivo a cada 30 segundos sem recarregar a página.

## Fluxo

```text
Google Sheets ou Supabase
        ↓
GitHub Actions a cada 5 minutos
        ↓
Banco Central + OpenAI + Meta Graph API opcional
        ↓
commit de dados.json + Build Hook
        ↓
deploy conectado ao Git no Netlify
        ↓
site consulta dados.json a cada 30 segundos
```

O GitHub Actions aceita cinco minutos como menor intervalo de agendamento. Execuções agendadas podem sofrer atraso de fila. A API da OpenAI só é chamada quando o conteúdo de `trending` muda, evitando uma cobrança a cada execução.

## Arquivos principais

- `index.html`: painel completo com as oito abas.
- `dados.json`: indicadores, trending, comparativo, estratégia, roteiro e conteúdo social.
- `scripts/painel-dinamico.js`: polling de 30 segundos e renderização dos blocos ao vivo.
- `scripts/atualiza-dados.js`: Banco Central, fonte externa e roteiro de 28 segundos via OpenAI.
- `scripts/importa-conteudo.js`: adaptadores para Google Sheets e Supabase.
- `scripts/atualiza-meta-graph.js`: ranking público de Facebook e Instagram.
- `.github/workflows/daily.yml`: automação executada a cada cinco minutos.
- `supabase/schema.sql`: tabela opcional para a fonte editorial.
- `scripts/supabase-realtime-exemplo.js`: exemplo opcional de canal Realtime no navegador.
- `netlify.toml`: publicação da raiz e `dados.json` sem cache.

## 1. Enviar ao GitHub

Repositório:

`https://github.com/carolinalamaziere-web/Campanha-Lula-Monitoramento-Oportunidades`

O projeto já pode ser enviado por Git. Se usar o ZIP entregue, descompacte-o primeiro e envie os arquivos e pastas internos por **Add file > Upload files**. O GitHub não descompacta um ZIP enviado como arquivo.

Confirme que `index.html`, `dados.json`, `scripts/`, `.github/`, `supabase/` e `netlify.toml` ficaram na raiz do repositório.

## 2. Criar os secrets do GitHub

Abra **Settings > Secrets and variables > Actions > New repository secret**.

### Obrigatórios

- `GH_TOKEN`: fine-grained personal access token com acesso somente a este repositório e permissão **Contents: Read and write**.
- `NETLIFY_HOOK`: endereço completo do Build Hook criado no Netlify.
- `OPENAI_API_KEY`: chave de projeto da OpenAI. O script usa exatamente `gpt-4o-mini` no endpoint `/v1/chat/completions`.

Nunca coloque essas chaves em `dados.json`, `index.html`, arquivos `.env` versionados ou variáveis públicas do Netlify.

### Criar o PAT `GH_TOKEN`

1. No GitHub, abra **Settings > Developer settings > Personal access tokens > Fine-grained tokens**.
2. Escolha somente o repositório `Campanha-Lula-Monitoramento-Oportunidades`.
3. Em **Repository permissions**, conceda **Contents: Read and write**.
4. Gere o token e salve-o como secret `GH_TOKEN`.

## 3. Conectar o Netlify ao GitHub — não usar Drop

No site `coruscating-tulumba-757d4e`:

1. Abra **Site configuration > Build & deploy > Continuous deployment**.
2. Selecione **Link repository**.
3. Autorize o GitHub e escolha `carolinalamaziere-web/Campanha-Lula-Monitoramento-Oportunidades`.
4. Deixe **Build command** vazio.
5. Defina **Publish directory** como `.`.
6. Salve e faça um deploy.

Para criar o hook:

1. Abra **Site configuration > Build & deploy > Build hooks**.
2. Crie um hook chamado `Atualiza Painel` para a branch `main`.
3. Copie a URL e salve-a no GitHub como secret `NETLIFY_HOOK`.

Um push em um site conectado ao Git já aciona o deploy normalmente. O workflow também chama o Build Hook, como fallback explícito solicitado; se o Netlify produzir dois deploys por alteração, remova o passo `Acionar deploy do Netlify` ou deixe `NETLIFY_HOOK` vazio.

## 4. OpenAI — roteiro automático de 28 segundos

`scripts/atualiza-dados.js` envia `trending` para:

`POST https://api.openai.com/v1/chat/completions`

O modelo configurado é `gpt-4o-mini`, com saída JSON estruturada. O resultado é salvo em `dados.json.roteiro` com título, texto, chamada final, alerta editorial, horário e assinatura da entrada.

Por segurança editorial, a instrução proíbe inventar números, fontes, comparações, causas, promessas e acusações. Dados sem fonte ou data devem gerar um alerta. A chave fica apenas no GitHub Actions.

## 5. Opção A — Google Sheets

Crie uma planilha com uma aba chamada `Conteudos` e a primeira linha:

```text
id | status | titulo | fato | valor | data_referencia | fonte | publico | plataforma | formato | volume | interacoes | crescimento | publicado_em | orientacao | atualizado_em
```

Somente linhas com `status` igual a `publicar`, `publicado`, `aprovado`, `ativo`, `sim`, `true` ou `1` entram no painel.

Depois:

1. Crie uma Service Account no Google Cloud e ative a Google Sheets API.
2. Compartilhe a planilha com o e-mail `client_email` da Service Account como leitor.
3. Em **GitHub > Settings > Secrets and variables > Actions > Variables**, crie:
   - `CONTENT_SOURCE` = `google_sheets`
   - `GOOGLE_SHEETS_ID` = trecho entre `/d/` e `/edit` na URL da planilha
   - `GOOGLE_SHEETS_RANGE` = `Conteudos!A:P`
4. Em **Secrets**, crie `GOOGLE_SERVICE_ACCOUNT_JSON` com o JSON completo da Service Account. Também é aceito o JSON codificado em base64.

O acesso é feito por `fetch` à Google Sheets API com escopo somente de leitura.

## 6. Opção B — Supabase

1. Abra o SQL Editor do Supabase.
2. Execute `supabase/schema.sql`.
3. Cadastre as linhas em `public.conteudos_painel`, usando `status = publicar` para o que deve entrar no site.
4. Em **GitHub > Settings > Secrets and variables > Actions > Variables**, crie:
   - `CONTENT_SOURCE` = `supabase`
   - `SUPABASE_URL` = URL do projeto
   - `SUPABASE_TABLE` = `conteudos_painel`
5. Em **Secrets**, crie `SUPABASE_SECRET_KEY` com uma chave secreta de servidor.

A chave secreta do Supabase ignora RLS e nunca pode ir para o navegador. O arquivo `scripts/supabase-realtime-exemplo.js` mostra um canal Realtime opcional usando apenas uma chave pública/publishable; ele não é necessário para o fluxo via `dados.json`.

## 7. Meta Graph API opcional

Para manter o ranking público de Facebook e Instagram, configure:

### Secrets

- `META_ACCESS_TOKEN`

### Variables

- `META_FACEBOOK_PAGE_IDS`: IDs ou nomes de usuário separados por vírgula.
- `META_INSTAGRAM_USERNAMES`: usuários sem `@`, separados por vírgula.
- `META_IG_USER_ID`: ID da conta profissional autenticada para Business Discovery.
- `META_GRAPH_API_VERSION`: por exemplo, `v26.0`.
- `META_GRAPH_FETCH_LIMIT`: padrão `100` por conta.
- `META_GRAPH_TOP_LIMIT`: padrão `240`, para permitir até 20 resultados em cada filtro de plataforma/formato.
- `META_TRENDING_DAYS`: janela móvel do ranking; padrão `7` dias.

O bloco **Trending Agora** mostra no máximo 20 conteúdos por combinação de plataforma e formato. O gráfico de cada linha usa o histórico real de interações armazenado a cada execução; no primeiro ciclo ele começa como uma linha estável e ganha forma conforme novas amostras chegam.

A Meta Graph API alimenta Facebook e Instagram. TikTok, YouTube, X/Twitter e WhatsApp precisam entrar pela API autorizada de cada plataforma ou pelas colunas `plataforma`, `formato`, `volume`, `interacoes` e `crescimento` do Google Sheets/Supabase; o painel não apresenta esses canais como se fossem dados da Meta.

Para Páginas externas do Facebook, o aplicativo pode precisar de **Page Public Content Access**. No Instagram, Business Discovery consulta contas profissionais públicas.

## 8. Ativar e testar

1. Abra a aba **Actions** do repositório.
2. Escolha **Atualiza Painel ao Vivo**.
3. Clique em **Run workflow**.
4. Confirme que o job criou um commit somente quando os dados mudaram.
5. Confira o deploy no Netlify.
6. Abra `https://coruscating-tulumba-757d4e.netlify.app/` e mantenha a página aberta; o navegador consulta `dados.json` a cada 30 segundos.

Teste local no PowerShell:

```powershell
$env:OPENAI_API_KEY="sua-chave"
node scripts/atualiza-dados.js
```

Sem as credenciais opcionais de Google Sheets, Supabase ou Meta, o script mantém os dados já existentes. Sem `OPENAI_API_KEY`, atualiza as demais fontes e preserva o último roteiro válido.

## Observações operacionais

- O site não precisa de framework nem comando de build.
- Como `dados.json` faz parte do deploy estático, uma mudança ainda precisa ser publicada pelo Netlify; o polling evita que o visitante recarregue a página manualmente.
- A rotina evita commits e chamadas à OpenAI quando nada mudou.
- Workflows agendados de repositórios públicos podem ser desativados pelo GitHub após longo período sem atividade.
- Os valores comparativos fornecidos no briefing estão marcados como pendentes de fonte e data-base no `dados.json`.
