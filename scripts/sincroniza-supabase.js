const fs = require("node:fs/promises");
const path = require("node:path");

const raiz = path.resolve(__dirname, "..");
const arquivoDados = path.join(raiz, "dados.json");
const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const supabaseKey = String(process.env.SUPABASE_SECRET_KEY || "").trim();

function texto(valor, limite = 1200) {
  const limpo = String(valor || "").replace(/\s+/g, " ").trim();
  return limpo ? limpo.slice(0, limite) : null;
}

function numero(valor, { nulo = false } = {}) {
  if (valor == null || valor === "") return nulo ? null : 0;
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : nulo ? null : 0;
}

function dataIso(valor) {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

async function gravar(tabela, linhas, conflito) {
  if (!linhas.length) return;
  const url = new URL(`${supabaseUrl}/rest/v1/${encodeURIComponent(tabela)}`);
  if (conflito) url.searchParams.set("on_conflict", conflito);
  const resposta = await fetch(url, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: conflito ? "resolution=merge-duplicates,return=minimal" : "return=minimal"
    },
    body: JSON.stringify(linhas)
  });
  if (!resposta.ok) {
    const detalhe = (await resposta.text()).slice(0, 500);
    throw new Error(`${tabela}: HTTP ${resposta.status}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

function mapaAnalises(relatorio) {
  const resultado = new Map();
  for (const campo of ["bolsonaro", "lula"]) {
    for (const item of relatorio?.campos?.[campo] || []) resultado.set(String(item.id), item);
  }
  return resultado;
}

function linhasTrending(dados) {
  const relatorio = dados.relatorioQuatroSemanas;
  const analises = mapaAnalises(relatorio);
  const periodo = dados.metaGraph?.periodo || relatorio?.periodo || {};
  const atualizadoEm = dataIso(dados.metaGraph?.atualizadoEm || dados.atualizadoEm) || new Date().toISOString();
  return (dados.metaGraph?.itens || []).map((item) => {
    const analise = analises.get(String(item.id)) || {};
    return {
      id: String(item.id),
      campo_politico: texto(item.campoPolitico, 60),
      plataforma: texto(item.rede || item.plataforma, 80),
      formato: texto(item.formato || item.tipo, 80),
      autor: texto(item.contaUsuario || item.contaNome, 160),
      titulo: texto(analise.titulo || item.legenda || "Conteúdo sem título", 240),
      resumo: texto(analise.resumoFactual || item.legenda, 1200),
      analise: texto(analise.leituraEngajamento, 1200),
      permalink: texto(item.permalink, 2000),
      midia_url: texto(item.midiaUrl, 2000),
      miniatura_url: texto(item.miniaturaUrl, 2000),
      alcance: numero(item.alcance, { nulo: true }),
      compartilhamentos: numero(item.compartilhamentos, { nulo: true }),
      interacoes: numero(item.interacoes),
      visualizacoes: numero(item.visualizacoes, { nulo: true }),
      crescimento: numero(item.crescimentoPercentual),
      metricas_disponiveis: Array.isArray(item.metricasDisponiveis) ? item.metricasDisponiveis.map(String) : [],
      publicado_em: dataIso(item.publicadoEm),
      periodo_inicio: dataIso(periodo.inicio),
      periodo_fim: dataIso(periodo.fim),
      fonte: "Meta Graph API",
      atualizado_em: atualizadoEm
    };
  });
}

function linhasOportunidades(dados) {
  const relatorio = dados.relatorioQuatroSemanas;
  const periodoFim = dataIso(relatorio?.periodo?.fim || relatorio?.geradoEm || dados.atualizadoEm);
  const dia = (periodoFim || new Date().toISOString()).slice(0, 10);
  return (relatorio?.oportunidadesPorFormato || relatorio?.conteudosGerados || []).map((item) => ({
    id: `${dia}:${String(item.formato || "outros").toLowerCase()}`,
    data_referencia: dia,
    titulo: texto(item.titulo, 240) || "Oportunidade sem título",
    plataforma: texto(item.plataforma, 80),
    formato: texto(item.formato, 80),
    narrativa: texto(item.narrativa, 2000),
    gancho: texto(item.gancho, 1000),
    desenvolvimento: texto(item.desenvolvimento, 4000),
    cta: texto(item.cta, 1000),
    estrutura: texto(item.duracaoOuEstrutura, 1000),
    hipotese_teste: texto(item.hipoteseTeste, 1200),
    fontes: Array.isArray(item.fontes) ? item.fontes : [],
    gerado_em: dataIso(relatorio?.geradoEm) || new Date().toISOString()
  }));
}

async function executar() {
  if (!supabaseUrl || !supabaseKey) {
    console.log("Supabase não configurado; espelhamento opcional ignorado.");
    return;
  }

  const dados = JSON.parse(await fs.readFile(arquivoDados, "utf8"));
  const trending = linhasTrending(dados);
  const oportunidades = linhasOportunidades(dados);

  for (let indice = 0; indice < trending.length; indice += 100) {
    await gravar("trending_top20", trending.slice(indice, indice + 100), "id");
  }
  await gravar("oportunidades_diarias", oportunidades, "id");
  await gravar("config", [
    {
      chave: "ultima_sincronizacao",
      valor: {
        em: new Date().toISOString(),
        metaStatus: dados.metaGraph?.status || "sem_coleta",
        trending: trending.length,
        oportunidades: oportunidades.length
      },
      atualizado_em: new Date().toISOString()
    }
  ], "chave");

  console.log(`Supabase: ${trending.length} conteúdo(s) e ${oportunidades.length} oportunidade(s) sincronizados.`);
}

executar().catch((erro) => {
  console.error(`Falha ao sincronizar Supabase: ${erro.message}`);
  process.exitCode = 1;
});
