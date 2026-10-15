const TIPOS = new Set(["clique", "download", "play"]);

function resposta(statusCode, corpo) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(corpo)
  };
}

function texto(valor, limite) {
  const limpo = String(valor || "").replace(/\s+/g, " ").trim();
  return limpo ? limpo.slice(0, limite) : null;
}

function urlHttps(valor) {
  if (!valor) return null;
  try {
    const url = new URL(String(valor));
    return url.protocol === "https:" ? url.toString().slice(0, 2000) : null;
  } catch {
    return null;
  }
}

function origemPermitida(origem) {
  if (!origem) return true;
  const permitidas = [process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.SITE_ORIGIN]
    .filter(Boolean)
    .map((valor) => {
      try {
        return new URL(valor).origin;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return permitidas.includes(origem);
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") return resposta(204, {});
  if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
  if (!origemPermitida(event.headers.origin)) return resposta(403, { erro: "Origem não permitida." });

  const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseKey = String(process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!supabaseUrl || !supabaseKey) return resposta(503, { erro: "Registro de eventos não configurado." });

  let entrada;
  try {
    entrada = JSON.parse(event.body || "{}");
  } catch {
    return resposta(400, { erro: "JSON inválido." });
  }

  const tipo = texto(entrada.tipo, 20);
  const conteudoId = texto(entrada.conteudoId, 300);
  if (!TIPOS.has(tipo) || !conteudoId) return resposta(400, { erro: "Evento inválido." });

  const registro = {
    conteudo_id: conteudoId,
    tipo,
    plataforma: texto(entrada.plataforma, 80),
    formato: texto(entrada.formato, 80),
    url_destino: urlHttps(entrada.urlDestino),
    origem: "painel"
  };
  const tabela = String(process.env.SUPABASE_EVENT_TABLE || "eventos_conteudo").replace(/[^a-zA-Z0-9_]/g, "");
  const destino = `${supabaseUrl}/rest/v1/${tabela}`;
  const gravacao = await fetch(destino, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(registro)
  });

  if (!gravacao.ok) {
    console.error("Falha Supabase", gravacao.status, (await gravacao.text()).slice(0, 300));
    return resposta(502, { erro: "Não foi possível registrar o evento." });
  }
  return { statusCode: 204, headers: { "Cache-Control": "no-store" }, body: "" };
};
