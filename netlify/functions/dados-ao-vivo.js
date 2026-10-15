function resposta(statusCode, corpo) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0"
    },
    body: JSON.stringify(corpo)
  };
}

async function consultar(tabela, parametros) {
  const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const chave = String(process.env.SUPABASE_SECRET_KEY || "").trim();
  const url = new URL(`${base}/rest/v1/${tabela}`);
  Object.entries(parametros).forEach(([nome, valor]) => url.searchParams.set(nome, valor));
  const resultado = await fetch(url, {
    headers: { apikey: chave, Authorization: `Bearer ${chave}` },
    cache: "no-store"
  });
  if (!resultado.ok) throw new Error(`${tabela}: HTTP ${resultado.status}`);
  return resultado.json();
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") return resposta(405, { erro: "Método não permitido." });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return resposta(503, { erro: "Fonte ao vivo não configurada." });
  }
  try {
    const [itens, oportunidades] = await Promise.all([
      consultar("trending_top20", { select: "*", order: "interacoes.desc,publicado_em.desc.nullslast", limit: "1000" }),
      consultar("oportunidades_diarias", { select: "*", order: "data_referencia.desc,formato.asc", limit: "4" })
    ]);
    const fim = itens.map((item) => item.periodo_fim || item.atualizado_em).filter(Boolean).sort().at(-1) || null;
    const inicio = itens.map((item) => item.periodo_inicio).filter(Boolean).sort().at(0) || null;
    return resposta(200, {
      metaGraph: {
        status: itens.length ? "integrada" : "sem_dados",
        atualizadoEm: fim,
        periodo: { dias: 28, inicio, fim },
        criterioRanking: "Soma das interações públicas disponíveis em cada rede",
        observacao: "Valores ausentes permanecem como N/D; eventos do painel não são convertidos em alcance social.",
        itens: itens.map((item, indice) => ({
          id: item.id,
          posicao: indice + 1,
          campoPolitico: item.campo_politico,
          rede: item.plataforma,
          formato: item.formato,
          tipo: item.formato,
          contaNome: item.autor,
          contaUsuario: item.autor,
          legenda: item.titulo,
          resumoFactual: item.resumo,
          leituraEngajamento: item.analise,
          permalink: item.permalink,
          midiaUrl: item.midia_url,
          miniaturaUrl: item.miniatura_url,
          alcance: item.alcance,
          compartilhamentos: item.compartilhamentos,
          interacoes: item.interacoes,
          visualizacoes: item.visualizacoes,
          crescimentoPercentual: Number(item.crescimento || 0),
          metricasDisponiveis: item.metricas_disponiveis || [],
          publicadoEm: item.publicado_em
        }))
      },
      oportunidades: oportunidades.map((item) => ({
        titulo: item.titulo,
        plataforma: item.plataforma,
        formato: item.formato,
        narrativa: item.narrativa,
        gancho: item.gancho,
        desenvolvimento: item.desenvolvimento,
        cta: item.cta,
        duracaoOuEstrutura: item.estrutura,
        hipoteseTeste: item.hipotese_teste,
        fontes: item.fontes || []
      }))
    });
  } catch (erro) {
    console.error(erro);
    return resposta(502, { erro: "Não foi possível consultar a fonte ao vivo." });
  }
};
