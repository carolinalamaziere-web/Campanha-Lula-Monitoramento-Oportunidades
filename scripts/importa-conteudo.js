const crypto = require("node:crypto");

function texto(valor) {
  return valor == null ? "" : String(valor).trim();
}

function chave(valor) {
  return texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function primeiro(objeto, nomes) {
  for (const nome of nomes) {
    const valor = objeto[nome];
    if (valor != null && texto(valor)) return texto(valor);
  }
  return "";
}

function sha256(valor) {
  return crypto.createHash("sha256").update(JSON.stringify(valor)).digest("hex");
}

function ativo(valor) {
  return ["publicar", "publicado", "aprovado", "ativo", "sim", "true", "1"].includes(chave(valor));
}

function normalizarLinhas(linhas, origem) {
  const itens = [];
  for (const linhaOriginal of linhas) {
    const linha = Object.fromEntries(Object.entries(linhaOriginal || {}).map(([nome, valor]) => [chave(nome), valor]));
    if (!ativo(primeiro(linha, ["status", "situacao", "publicar"]))) continue;

    const titulo = primeiro(linha, ["titulo", "tema", "nome"]);
    const fato = primeiro(linha, ["fato", "conteudo_base", "texto_base", "conteudo", "descricao"]);
    const fonte = primeiro(linha, ["fonte", "url_fonte", "link_fonte", "url"]);
    if (!titulo || !fato) continue;

    const fornecido = primeiro(linha, ["id", "codigo", "slug"]);
    const id = fornecido || `conteudo-${sha256([titulo, fato, fonte]).slice(0, 12)}`;
    itens.push({
      id,
      titulo,
      fato,
      valor: primeiro(linha, ["valor", "numero", "dado"]),
      dataReferencia: primeiro(linha, ["data_referencia", "data", "periodo"]),
      fonte,
      publico: primeiro(linha, ["publico", "publico_alvo", "audiencia"]),
      formato: primeiro(linha, ["formato", "canal", "tipo"]),
      orientacao: primeiro(linha, ["orientacao", "observacoes", "observacao", "notas"]),
      atualizadoEm: primeiro(linha, ["atualizado_em", "updated_at", "modificado_em"]),
      origem
    });
  }

  const unicos = new Map();
  for (const item of itens) unicos.set(item.id, item);
  return [...unicos.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function base64Url(valor) {
  return Buffer.from(valor).toString("base64url");
}

function lerContaServico(valor) {
  const bruto = texto(valor);
  if (!bruto) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurado.");
  try {
    return JSON.parse(bruto);
  } catch {
    try {
      return JSON.parse(Buffer.from(bruto, "base64").toString("utf8"));
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não contém JSON válido nem JSON codificado em base64.");
    }
  }
}

async function tokenGoogle(conta) {
  if (!conta.client_email || !conta.private_key) {
    throw new Error("A credencial Google precisa de client_email e private_key.");
  }
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const carga = base64Url(JSON.stringify({
    iss: conta.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: conta.token_uri || "https://oauth2.googleapis.com/token",
    iat: agora,
    exp: agora + 3600
  }));
  const conteudo = `${cabecalho}.${carga}`;
  const assinatura = crypto.sign("RSA-SHA256", Buffer.from(conteudo), conta.private_key).toString("base64url");
  const jwt = `${conteudo}.${assinatura}`;

  const resposta = await fetch(conta.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok || !corpo?.access_token) {
    throw new Error(`Falha na autenticação Google: ${corpo?.error_description || corpo?.error || `HTTP ${resposta.status}`}`);
  }
  return corpo.access_token;
}

async function buscarGoogleSheets() {
  const spreadsheetId = texto(process.env.GOOGLE_SHEETS_ID);
  const intervalo = texto(process.env.GOOGLE_SHEETS_RANGE) || "Conteudos!A:K";
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID não configurado.");
  const conta = lerContaServico(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const accessToken = await tokenGoogle(conta);
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(intervalo)}`);
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(`Google Sheets: ${corpo?.error?.message || `HTTP ${resposta.status}`}`);

  const valores = corpo.values || [];
  if (!valores.length) return [];
  const cabecalhos = valores[0].map(chave);
  return valores.slice(1).map((valoresLinha) => Object.fromEntries(cabecalhos.map((nome, indice) => [nome, valoresLinha[indice]])));
}

async function buscarSupabase() {
  const base = texto(process.env.SUPABASE_URL).replace(/\/$/, "");
  const segredo = texto(process.env.SUPABASE_SECRET_KEY);
  const tabela = texto(process.env.SUPABASE_TABLE) || "conteudos_painel";
  if (!base || !segredo) throw new Error("SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórios.");
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tabela)) throw new Error("SUPABASE_TABLE inválida.");

  const url = new URL(`${base}/rest/v1/${tabela}`);
  url.searchParams.set("select", "*");
  url.searchParams.set("status", "eq.publicar");
  url.searchParams.set("order", "updated_at.desc.nullslast");
  const resposta = await fetch(url, {
    headers: {
      apikey: segredo,
      Authorization: `Bearer ${segredo}`,
      Accept: "application/json"
    }
  });
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(`Supabase: ${corpo?.message || corpo?.error || `HTTP ${resposta.status}`}`);
  return Array.isArray(corpo) ? corpo : [];
}

function escolherFonte() {
  const escolha = chave(process.env.CONTENT_SOURCE);
  if (escolha) {
    if (["google", "google_sheets", "sheets", "planilha"].includes(escolha)) return "google_sheets";
    if (escolha === "supabase") return "supabase";
    throw new Error("CONTENT_SOURCE deve ser google_sheets ou supabase.");
  }

  const google = texto(process.env.GOOGLE_SHEETS_ID) && texto(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const supabase = texto(process.env.SUPABASE_URL) && texto(process.env.SUPABASE_SECRET_KEY);
  if (google && supabase) throw new Error("As duas fontes estão configuradas; defina CONTENT_SOURCE.");
  if (google) return "google_sheets";
  if (supabase) return "supabase";
  return null;
}

async function sincronizarFonteExterna(dados) {
  const fonte = escolherFonte();
  if (!fonte) {
    console.log("Nenhuma fonte editorial configurada; importação ignorada.");
    return { mudou: false, fonte: null, itens: [] };
  }

  const linhas = fonte === "google_sheets" ? await buscarGoogleSheets() : await buscarSupabase();
  const itens = normalizarLinhas(linhas, fonte);
  const assinatura = sha256(itens);

  if (dados.editorial?.assinatura === assinatura) {
    console.log(`Fonte ${fonte}: sem alterações em ${itens.length} item(ns).`);
    return { mudou: false, fonte, itens };
  }

  dados.editorial = {
    status: "sincronizada",
    fonte,
    sincronizadoEm: new Date().toISOString(),
    assinatura,
    total: itens.length,
    itens
  };
  dados.trending = itens.map((item) => ({
    id: item.id,
    titulo: item.titulo,
    status: "publicar",
    orientacao: item.fato,
    valor: item.valor,
    periodo: item.dataReferencia,
    fonte: item.fonte,
    publico: item.publico,
    formato: item.formato
  }));
  console.log(`Fonte ${fonte}: ${itens.length} item(ns) importado(s).`);
  return { mudou: true, fonte, itens };
}

async function executar() {
  const fs = require("node:fs/promises");
  const path = require("node:path");
  const arquivoDados = path.resolve(__dirname, "..", "dados.json");
  const dados = JSON.parse(await fs.readFile(arquivoDados, "utf8"));
  const resultado = await sincronizarFonteExterna(dados);
  if (!resultado.mudou) return;
  await fs.writeFile(arquivoDados, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
}

module.exports = { sincronizarFonteExterna };

if (require.main === module) {
  executar().catch((erro) => {
    console.error(`Falha ao importar conteúdo: ${erro.message}`);
    process.exitCode = 1;
  });
}
