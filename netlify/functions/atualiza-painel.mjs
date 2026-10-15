const VERSAO_META = process.env.META_GRAPH_API_VERSION || "v26.0";
const JANELA_DIAS = 28;

export const config = { schedule: "0 * * * *" };

function lista(nome) {
  return String(process.env[nome] || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function texto(valor, limite = 1200) {
  const limpo = String(valor || "").replace(/\s+/g, " ").trim();
  return limpo ? limpo.slice(0, limite) : null;
}

function contaNormalizada(valor) {
  return String(valor || "").replace(/^@/, "").trim().toLowerCase();
}

function classificarCampo(conta) {
  const identidades = [conta.id, conta.username, conta.name].map(contaNormalizada);
  const bolsonaro = lista("META_BOLSONARO_ACCOUNTS").map(contaNormalizada);
  const lula = lista("META_LULA_ACCOUNTS").map(contaNormalizada);
  if (identidades.some((id) => bolsonaro.includes(id))) return "pro-bolsonaro";
  if (identidades.some((id) => lula.includes(id))) return "pro-lula";
  return null;
}

async function jsonOuErro(resposta, contexto) {
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new Error(`${contexto}: ${corpo?.error?.message || `HTTP ${resposta.status}`}`);
  return corpo;
}

async function graph(caminho, parametros = {}) {
  const url = new URL(`https://graph.facebook.com/${VERSAO_META}/${caminho}`);
  Object.entries(parametros).forEach(([chave, valor]) => url.searchParams.set(chave, String(valor)));
  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}` }
  });
  return jsonOuErro(resposta, `Meta ${caminho}`);
}

async function facebook(pagina) {
  const perfil = await graph(pagina, { fields: "id,name,username" });
  const posts = await graph(`${pagina}/posts`, {
    limit: 100,
    fields: "id,message,created_time,permalink_url,full_picture,shares,reactions.limit(0).summary(true),comments.limit(0).summary(true),attachments{media,type}"
  });
  return (posts.data || []).map((post) => {
    const reacoes = numero(post.reactions?.summary?.total_count);
    const comentarios = numero(post.comments?.summary?.total_count);
    const compartilhamentos = numero(post.shares?.count);
    return {
      id: `facebook:${post.id}`,
      campo_politico: classificarCampo(perfil),
      plataforma: "Facebook",
      formato: String(post.attachments?.data?.[0]?.type || "").includes("video") ? "Vídeo" : "Feed",
      autor: perfil.username || perfil.name || pagina,
      titulo: texto(post.message || "Publicação sem texto", 240),
      resumo: texto(post.message),
      permalink: post.permalink_url || null,
      midia_url: post.attachments?.data?.[0]?.media?.source || post.full_picture || null,
      miniatura_url: post.attachments?.data?.[0]?.media?.image?.src || post.full_picture || null,
      alcance: null,
      compartilhamentos,
      interacoes: reacoes + comentarios + compartilhamentos,
      visualizacoes: null,
      metricas_disponiveis: ["reações", "comentários", "compartilhamentos"],
      publicado_em: post.created_time || null,
      fonte: "Meta Graph API"
    };
  });
}

async function instagram(usuario, igUserId) {
  const nome = contaNormalizada(usuario);
  if (!/^[a-z0-9._]+$/.test(nome)) throw new Error(`Instagram inválido: ${usuario}`);
  const camposMidia = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
  const consulta = `business_discovery.username(${nome}){id,username,name,media.limit(100){${camposMidia}}}`;
  const resposta = await graph(igUserId, { fields: consulta });
  const perfil = resposta.business_discovery;
  return (perfil?.media?.data || []).map((post) => {
    const curtidas = numero(post.like_count);
    const comentarios = numero(post.comments_count);
    const tipo = String(post.media_type || "IMAGE").toUpperCase();
    const produto = String(post.media_product_type || "").toUpperCase();
    return {
      id: `instagram:${post.id}`,
      campo_politico: classificarCampo(perfil || { username: nome }),
      plataforma: "Instagram",
      formato: produto === "REELS" ? "Reels" : tipo === "CAROUSEL_ALBUM" ? "Carrossel" : tipo === "VIDEO" ? "Vídeo" : "Feed",
      autor: perfil?.username || perfil?.name || nome,
      titulo: texto(post.caption || "Publicação sem legenda", 240),
      resumo: texto(post.caption),
      permalink: post.permalink || null,
      midia_url: post.media_url || post.thumbnail_url || null,
      miniatura_url: post.thumbnail_url || post.media_url || null,
      alcance: null,
      compartilhamentos: null,
      interacoes: curtidas + comentarios,
      visualizacoes: null,
      metricas_disponiveis: ["curtidas", "comentários"],
      publicado_em: post.timestamp || null,
      fonte: "Meta Graph API"
    };
  });
}

async function tiktok() {
  const token = String(process.env.TIKTOK_ACCESS_TOKEN || "").trim();
  if (!token) return [];
  const campos = [
    "id", "title", "video_description", "create_time", "cover_image_url", "share_url",
    "embed_link", "like_count", "comment_count", "share_count", "view_count"
  ].join(",");
  const resposta = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${campos}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ max_count: 20 })
  });
  const corpo = await jsonOuErro(resposta, "TikTok Display API");
  return (corpo.data?.videos || []).map((video) => ({
    id: `tiktok:${video.id}`,
    campo_politico: null,
    plataforma: "TikTok",
    formato: "Vídeo",
    autor: texto(process.env.TIKTOK_ACCOUNT_LABEL || "Conta autorizada", 160),
    titulo: texto(video.title || video.video_description || "Vídeo sem título", 240),
    resumo: texto(video.video_description || video.title),
    permalink: video.share_url || video.embed_link || null,
    midia_url: video.cover_image_url || null,
    miniatura_url: video.cover_image_url || null,
    alcance: null,
    compartilhamentos: numero(video.share_count),
    interacoes: numero(video.like_count) + numero(video.comment_count) + numero(video.share_count),
    visualizacoes: video.view_count == null ? null : numero(video.view_count),
    metricas_disponiveis: ["curtidas", "comentários", "compartilhamentos", "visualizações"],
    publicado_em: video.create_time ? new Date(numero(video.create_time) * 1000).toISOString() : null,
    fonte: "TikTok Display API"
  }));
}

async function upsertSupabase(tabela, linhas, conflito) {
  if (!linhas.length) return;
  const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const chave = String(process.env.SUPABASE_SECRET_KEY || "").trim();
  const url = new URL(`${base}/rest/v1/${tabela}`);
  url.searchParams.set("on_conflict", conflito);
  const resposta = await fetch(url, {
    method: "POST",
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(linhas)
  });
  if (!resposta.ok) throw new Error(`Supabase ${tabela}: HTTP ${resposta.status} — ${(await resposta.text()).slice(0, 300)}`);
}

export default async function atualizar() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return new Response(JSON.stringify({ erro: "Supabase não configurado." }), { status: 503 });
  }
  if (!process.env.META_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ erro: "META_ACCESS_TOKEN não configurado." }), { status: 503 });
  }

  const tarefas = [];
  const igUserId = String(process.env.META_IG_USER_ID || "").trim();
  for (const pagina of lista("META_FACEBOOK_PAGE_IDS")) tarefas.push(facebook(pagina));
  if (igUserId) for (const conta of lista("META_INSTAGRAM_USERNAMES")) tarefas.push(instagram(conta, igUserId));
  tarefas.push(tiktok());

  const resultados = await Promise.allSettled(tarefas);
  const avisos = resultados.filter((item) => item.status === "rejected").map((item) => item.reason.message);
  const agora = new Date();
  const inicio = new Date(agora.getTime() - JANELA_DIAS * 86400000);
  const itens = resultados
    .filter((item) => item.status === "fulfilled")
    .flatMap((item) => item.value)
    .filter((item) => !item.publicado_em || new Date(item.publicado_em) >= inicio)
    .map((item) => ({
      ...item,
      crescimento: 0,
      periodo_inicio: inicio.toISOString(),
      periodo_fim: agora.toISOString(),
      atualizado_em: agora.toISOString()
    }));

  if (!itens.length) {
    return new Response(JSON.stringify({ erro: "Nenhum conteúdo oficial coletado.", avisos }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }

  await upsertSupabase("trending_top20", itens, "id");
  await upsertSupabase("config", [{
    chave: "ultima_coleta_horaria",
    valor: { em: agora.toISOString(), itens: itens.length, avisos },
    atualizado_em: agora.toISOString()
  }], "chave");

  return new Response(JSON.stringify({ ok: true, itens: itens.length, avisos }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
