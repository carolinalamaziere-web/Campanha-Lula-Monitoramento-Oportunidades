const fs = require("node:fs/promises");
const path = require("node:path");

const raiz = path.resolve(__dirname, "..");
const arquivoDados = path.join(raiz, "dados.json");
const versaoApi = normalizarVersao(process.env.META_GRAPH_API_VERSION || "v26.0");
const limiteBusca = numeroInteiro(process.env.META_GRAPH_FETCH_LIMIT, 100, 1, 100);
const limiteRanking = numeroInteiro(process.env.META_GRAPH_TOP_LIMIT, 240, 20, 1000);
const janelaDias = numeroInteiro(process.env.META_TRENDING_DAYS, 7, 1, 90);
const token = String(process.env.META_ACCESS_TOKEN || "").trim();

function numeroInteiro(valor, padrao, minimo, maximo) {
  const numero = Number.parseInt(valor, 10);
  if (!Number.isFinite(numero)) return padrao;
  return Math.min(maximo, Math.max(minimo, numero));
}

function normalizarVersao(valor) {
  const versao = String(valor || "").trim();
  if (!/^v\d+\.\d+$/.test(versao)) {
    throw new Error("META_GRAPH_API_VERSION deve seguir o formato v26.0.");
  }
  return versao;
}

function listaAmbiente(nome) {
  return [...new Set(String(process.env[nome] || "")
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean))];
}

function usuarioInstagram(valor) {
  return String(valor || "")
    .trim()
    .replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0];
}

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function urlSegura(valor) {
  if (!valor) return null;
  try {
    const url = new URL(String(valor));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function graph(caminho, parametros = {}) {
  const url = new URL(`https://graph.facebook.com/${versaoApi}/${String(caminho).replace(/^\//, "")}`);
  for (const [nome, valor] of Object.entries(parametros)) {
    if (valor != null && valor !== "") url.searchParams.set(nome, String(valor));
  }

  const controle = new AbortController();
  const temporizador = setTimeout(() => controle.abort(), 30000);
  try {
    const resposta = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "war-room-lula-2026/1.0"
      },
      signal: controle.signal
    });
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok || corpo?.error) {
      const detalhe = corpo?.error?.message || `HTTP ${resposta.status}`;
      const codigo = corpo?.error?.code ? ` (código ${corpo.error.code})` : "";
      throw new Error(`${detalhe}${codigo}`);
    }
    return corpo;
  } finally {
    clearTimeout(temporizador);
  }
}

function resumo(conexao) {
  return numero(conexao?.summary?.total_count);
}

function anexosEmProfundidade(anexos) {
  const fila = [...(anexos?.data || [])];
  const resultado = [];
  while (fila.length) {
    const anexo = fila.shift();
    if (!anexo) continue;
    resultado.push(anexo);
    fila.push(...(anexo.subattachments?.data || []));
  }
  return resultado;
}

function midiaFacebook(post) {
  const anexos = anexosEmProfundidade(post.attachments);
  const anexo = anexos.find((item) => item.media?.source || item.media?.image?.src) || anexos[0];
  const tipoBruto = String(anexo?.type || "").toUpperCase();
  const video = tipoBruto.includes("VIDEO");
  const imagem = urlSegura(anexo?.media?.image?.src || post.full_picture);
  const fonte = urlSegura(anexo?.media?.source);
  return {
    tipo: video ? "VIDEO" : tipoBruto.includes("ALBUM") ? "CAROUSEL_ALBUM" : "IMAGE",
    midiaUrl: video ? fonte : imagem,
    miniaturaUrl: imagem
  };
}

async function coletarFacebook(alvo) {
  let perfil = { id: alvo, name: alvo };
  try {
    perfil = await graph(alvo, {
      fields: "id,name,username,fan_count,picture.type(large){url}"
    });
  } catch (erro) {
    console.warn(`Facebook ${alvo}: metadados indisponíveis (${erro.message}).`);
  }

  const resposta = await graph(`${alvo}/posts`, {
    limit: limiteBusca,
    fields: [
      "id",
      "message",
      "created_time",
      "permalink_url",
      "full_picture",
      "shares",
      "reactions.limit(0).summary(true)",
      "comments.limit(0).summary(true)",
      "attachments{media,type,url,title,subattachments{media,type,url,title}}"
    ].join(",")
  });

  const seguidores = numero(perfil.fan_count);
  return (resposta.data || []).map((post) => {
    const reacoes = resumo(post.reactions);
    const comentarios = resumo(post.comments);
    const compartilhamentos = numero(post.shares?.count);
    const interacoes = reacoes + comentarios + compartilhamentos;
    return {
      id: `facebook:${post.id}`,
      rede: "Facebook",
      contaId: String(perfil.id || alvo),
      contaNome: perfil.name || perfil.username || alvo,
      contaUsuario: perfil.username || null,
      fotoContaUrl: urlSegura(perfil.picture?.data?.url),
      seguidores,
      legenda: post.message || "Publicação sem texto.",
      publicadoEm: post.created_time || null,
      permalink: urlSegura(post.permalink_url),
      ...midiaFacebook(post),
      curtidas: 0,
      reacoes,
      comentarios,
      compartilhamentos,
      interacoes,
      taxaEngajamentoEstimada: seguidores > 0 ? Number(((interacoes / seguidores) * 100).toFixed(4)) : null
    };
  });
}

function escaparCampoGraph(valor) {
  if (!/^[A-Za-z0-9._]+$/.test(valor)) throw new Error(`Usuário do Instagram inválido: ${valor}`);
  return valor;
}

function midiaInstagram(item) {
  const filhos = item.children?.data || [];
  const principal = filhos.find((filho) => filho.media_url || filho.thumbnail_url) || item;
  const tipo = String(item.media_type || principal.media_type || "IMAGE").toUpperCase();
  return {
    tipo,
    midiaUrl: urlSegura(principal.media_url || item.media_url),
    miniaturaUrl: urlSegura(principal.thumbnail_url || item.thumbnail_url || principal.media_url || item.media_url)
  };
}

async function coletarInstagram(usuario, igUserId) {
  const nomeSeguro = escaparCampoGraph(usuarioInstagram(usuario));
  const camposMidia = [
    "id",
    "caption",
    "media_type",
    "media_url",
    "thumbnail_url",
    "permalink",
    "timestamp",
    "like_count",
    "comments_count",
    "children{media_type,media_url,thumbnail_url}"
  ].join(",");
  const fields = [
    "id",
    "username",
    "name",
    "profile_picture_url",
    "followers_count",
    "media_count",
    `media.limit(${limiteBusca}){${camposMidia}}`
  ].join(",");
  const resposta = await graph(igUserId, {
    fields: `business_discovery.username(${nomeSeguro}){${fields}}`
  });
  const perfil = resposta.business_discovery;
  if (!perfil) throw new Error("A Meta não retornou business_discovery para esta conta.");

  const seguidores = numero(perfil.followers_count);
  return (perfil.media?.data || []).map((item) => {
    const curtidas = numero(item.like_count);
    const comentarios = numero(item.comments_count);
    const interacoes = curtidas + comentarios;
    return {
      id: `instagram:${item.id}`,
      rede: "Instagram",
      contaId: String(perfil.id || nomeSeguro),
      contaNome: perfil.name || perfil.username || nomeSeguro,
      contaUsuario: perfil.username || nomeSeguro,
      fotoContaUrl: urlSegura(perfil.profile_picture_url),
      seguidores,
      legenda: item.caption || "Publicação sem legenda.",
      publicadoEm: item.timestamp || null,
      permalink: urlSegura(item.permalink),
      ...midiaInstagram(item),
      curtidas,
      reacoes: 0,
      comentarios,
      compartilhamentos: 0,
      interacoes,
      taxaEngajamentoEstimada: seguidores > 0 ? Number(((interacoes / seguidores) * 100).toFixed(4)) : null
    };
  });
}

async function executar() {
  const paginasFacebook = listaAmbiente("META_FACEBOOK_PAGE_IDS");
  const contasInstagram = listaAmbiente("META_INSTAGRAM_USERNAMES").map(usuarioInstagram).filter(Boolean);
  const igUserId = String(process.env.META_IG_USER_ID || "").trim();

  if (!token) {
    console.log("META_ACCESS_TOKEN não configurado; coleta da Meta Graph API ignorada.");
    return;
  }
  if (!paginasFacebook.length && !contasInstagram.length) {
    console.log("Nenhuma fonte configurada em META_FACEBOOK_PAGE_IDS ou META_INSTAGRAM_USERNAMES.");
    return;
  }
  if (contasInstagram.length && !igUserId) {
    throw new Error("META_IG_USER_ID é obrigatório para consultar contas externas do Instagram.");
  }

  const resultados = [];
  const fontes = [];
  const avisos = [];

  for (const pagina of paginasFacebook) {
    try {
      const itens = await coletarFacebook(pagina);
      resultados.push(...itens);
      fontes.push({ rede: "Facebook", alvo: pagina, itens: itens.length, status: "ok" });
    } catch (erro) {
      avisos.push(`Facebook ${pagina}: ${erro.message}`);
      fontes.push({ rede: "Facebook", alvo: pagina, itens: 0, status: "erro" });
    }
  }

  for (const conta of contasInstagram) {
    try {
      const itens = await coletarInstagram(conta, igUserId);
      resultados.push(...itens);
      fontes.push({ rede: "Instagram", alvo: `@${conta}`, itens: itens.length, status: "ok" });
    } catch (erro) {
      avisos.push(`Instagram @${conta}: ${erro.message}`);
      fontes.push({ rede: "Instagram", alvo: `@${conta}`, itens: 0, status: "erro" });
    }
  }

  const agora = new Date();
  const inicioJanela = new Date(agora);
  inicioJanela.setUTCDate(inicioJanela.getUTCDate() - janelaDias);
  const ranqueados = resultados
    .filter((item) => {
      const publicado = item.publicadoEm ? new Date(item.publicadoEm) : null;
      return !publicado || Number.isNaN(publicado.getTime()) || publicado >= inicioJanela;
    })
    .filter((item) => item.permalink)
    .sort((a, b) => b.interacoes - a.interacoes || String(b.publicadoEm).localeCompare(String(a.publicadoEm)))
    .slice(0, limiteRanking)
    .map((item, indice) => ({ ...item, posicao: indice + 1 }));

  if (!ranqueados.length && avisos.length) {
    throw new Error(`Nenhum conteúdo foi coletado. ${avisos.join(" | ")}`);
  }

  const dados = JSON.parse(await fs.readFile(arquivoDados, "utf8"));
  const anteriores = new Map((dados.metaGraph?.itens || []).map((item) => [item.id, item]));
  const registradoEm = agora.toISOString();
  const itens = ranqueados.map((item) => {
    const anterior = anteriores.get(item.id);
    const historico = Array.isArray(anterior?.historico) ? [...anterior.historico] : [];
    historico.push({ registradoEm, interacoes: item.interacoes });
    const amostras = historico
      .filter((amostra) => Number.isFinite(Number(amostra.interacoes)))
      .slice(-288);
    const primeiro = Number(amostras[0]?.interacoes || 0);
    const ultimo = Number(amostras[amostras.length - 1]?.interacoes || 0);
    const crescimentoPercentual = primeiro > 0
      ? Number((((ultimo - primeiro) / primeiro) * 100).toFixed(2))
      : 0;
    return { ...item, crescimentoPercentual, historico: amostras };
  });
  dados.metaGraph = {
    status: avisos.length ? "parcial" : "integrada",
    atualizadoEm: registradoEm,
    apiVersion: versaoApi,
    periodo: {
      dias: janelaDias,
      inicio: inicioJanela.toISOString(),
      fim: registradoEm
    },
    criterioRanking: "Soma das interações públicas disponíveis em cada rede",
    observacao: "A taxa usa o total atual de seguidores e não substitui alcance ou impressões privadas.",
    fontes,
    avisos,
    itens
  };
  await fs.writeFile(arquivoDados, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
  console.log(`Meta Graph API: ${itens.length} conteúdo(s) ranqueado(s), ${avisos.length} aviso(s).`);
}

executar().catch((erro) => {
  console.error(`Falha na Meta Graph API: ${erro.message}`);
  process.exitCode = 1;
});
