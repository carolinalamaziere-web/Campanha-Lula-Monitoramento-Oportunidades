const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const raiz = path.resolve(__dirname, "..");
const arquivoDados = path.join(raiz, "dados.json");
const modelo = String(process.env.OPENAI_REPORT_MODEL || "gpt-4o").trim();
const dias = numeroInteiro(process.env.REPORT_DAYS, 28, 1, 90);

function numeroInteiro(valor, padrao, minimo, maximo) {
  const numero = Number.parseInt(valor, 10);
  if (!Number.isFinite(numero)) return padrao;
  return Math.min(maximo, Math.max(minimo, numero));
}

function assinatura(valor) {
  return crypto.createHash("sha256").update(JSON.stringify(valor)).digest("hex");
}

function texto(valor, limite = 700) {
  return String(valor || "").replace(/\s+/g, " ").trim().slice(0, limite);
}

function dataBrasilia(data) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(data);
}

function formato(item) {
  const bruto = String(item.formato || item.tipo || "OUTROS").toUpperCase();
  const mapa = {
    CAROUSEL_ALBUM: "Carrossel",
    CAROUSEL: "Carrossel",
    VIDEO: "Vídeo",
    REEL: "Reels",
    REELS: "Reels",
    IMAGE: "Imagem",
    PHOTO: "Imagem",
    STORY: "Stories"
  };
  return mapa[bruto] || texto(item.formato || item.tipo || "Outros", 80);
}

function itemParaPrompt(item) {
  return {
    id: item.id,
    campoPolitico: item.campoPolitico,
    plataforma: item.rede,
    formato: formato(item),
    conta: item.contaUsuario ? `@${item.contaUsuario}` : item.contaNome,
    publicadoEm: item.publicadoEm,
    legenda: texto(item.legenda),
    interacoes: Number(item.interacoes || 0),
    curtidas: Number(item.curtidas || 0),
    reacoes: Number(item.reacoes || 0),
    comentarios: Number(item.comentarios || 0),
    compartilhamentos: Number(item.compartilhamentos || 0),
    crescimentoPercentual: Number(item.crescimentoPercentual || 0),
    permalink: item.permalink
  };
}

function esquemaRelatorio() {
  const referencia = {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      titulo: { type: "string" },
      resumoFactual: { type: "string" },
      leituraEngajamento: { type: "string" }
    },
    required: ["id", "titulo", "resumoFactual", "leituraEngajamento"]
  };
  const fontesIds = { type: "array", items: { type: "string" } };
  return {
    type: "json_schema",
    json_schema: {
      name: "relatorio_meta_28_dias",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          resumoExecutivo: { type: "string" },
          analises: { type: "array", items: referencia },
          pautasInteressantes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                titulo: { type: "string" },
                justificativa: { type: "string" },
                fontesIds
              },
              required: ["titulo", "justificativa", "fontesIds"]
            }
          },
          plataformasFormatosPrioritarios: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                plataforma: { type: "string" },
                formato: { type: "string" },
                justificativa: { type: "string" },
                fontesIds
              },
              required: ["plataforma", "formato", "justificativa", "fontesIds"]
            }
          },
          conteudosGerados: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                titulo: { type: "string" },
                plataforma: { type: "string" },
                formato: { type: "string" },
                gancho: { type: "string" },
                roteiro28s: { type: "string" },
                cta: { type: "string" },
                fontesIds
              },
              required: ["titulo", "plataforma", "formato", "gancho", "roteiro28s", "cta", "fontesIds"]
            }
          },
          limitacoes: { type: "array", items: { type: "string" } }
        },
        required: [
          "resumoExecutivo",
          "analises",
          "pautasInteressantes",
          "plataformasFormatosPrioritarios",
          "conteudosGerados",
          "limitacoes"
        ]
      }
    }
  };
}

async function gerarAnaliseOpenAI(entrada, periodo) {
  const chave = String(process.env.OPENAI_API_KEY || "").trim();
  if (!chave) throw new Error("OPENAI_API_KEY não configurada.");

  const controle = new AbortController();
  const temporizador = setTimeout(() => controle.abort(), 120000);
  try {
    const resposta = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelo,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: [
              "Você é o analista editorial do War Room Lula 2026.",
              "Use exclusivamente os registros Meta fornecidos e nunca invente métricas, fontes, links, falas, fatos, causalidade ou crescimento.",
              "Analise cada registro pelo id. Diferencie descrição factual de interpretação.",
              "Gere pautas e peças originais baseadas nas evidências, sem copiar legendas extensas.",
              "Cada roteiro deve ter de 58 a 72 palavras, linguagem brasileira direta e um CTA para conferir a fonte.",
              "Em fontesIds, use somente ids existentes na entrada. Quando faltarem dados, declare a limitação."
            ].join(" ")
          },
          {
            role: "user",
            content: [
              `Gere o relatório das últimas ${dias} dias, de ${periodo.inicioLocal} até ${periodo.fimLocal}.`,
              "A apresentação no painel começará por 'O que mais engajou no campo pró-Bolsonaro' e depois mostrará o campo pró-Lula.",
              "Produza uma análise curta para cada registro, até 8 pautas, prioridades reais de plataforma/formato e até 5 conteúdos novos.",
              `DADOS META:\n${JSON.stringify(entrada)}`
            ].join("\n")
          }
        ],
        response_format: esquemaRelatorio()
      }),
      signal: controle.signal
    });
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new Error(corpo?.error?.message || `OpenAI HTTP ${resposta.status}`);
    const conteudo = corpo?.choices?.[0]?.message?.content;
    if (!conteudo) throw new Error("A OpenAI retornou uma resposta vazia.");
    return { resultado: JSON.parse(conteudo), responseId: corpo.id || null };
  } finally {
    clearTimeout(temporizador);
  }
}

function analisePorId(resultado, idsValidos) {
  const mapa = new Map();
  for (const analise of resultado.analises || []) {
    if (idsValidos.has(analise.id) && !mapa.has(analise.id)) mapa.set(analise.id, analise);
  }
  return mapa;
}

function fontesValidas(itens, idsValidos) {
  return (itens || []).map((item) => ({
    ...item,
    fontesIds: [...new Set((item.fontesIds || []).filter((id) => idsValidos.has(id)))]
  })).filter((item) => item.fontesIds.length);
}

function enriquecer(item, analises) {
  const analise = analises.get(item.id) || {};
  const legenda = texto(item.legenda, 360);
  return {
    id: item.id,
    titulo: texto(analise.titulo || legenda || "Conteúdo sem título", 140),
    resumoFactual: texto(analise.resumoFactual || legenda || "Descrição indisponível.", 500),
    leituraEngajamento: texto(
      analise.leituraEngajamento || "A posição considera somente as interações públicas disponíveis na coleta.",
      500
    ),
    plataforma: item.rede,
    formato: formato(item),
    contaNome: item.contaNome,
    contaUsuario: item.contaUsuario,
    publicadoEm: item.publicadoEm,
    interacoes: Number(item.interacoes || 0),
    curtidas: Number(item.curtidas || 0),
    reacoes: Number(item.reacoes || 0),
    comentarios: Number(item.comentarios || 0),
    compartilhamentos: Number(item.compartilhamentos || 0),
    crescimentoPercentual: Number(item.crescimentoPercentual || 0),
    historico: Array.isArray(item.historico) ? item.historico : [],
    permalink: item.permalink,
    miniaturaUrl: item.miniaturaUrl || null
  };
}

function linhaDesempenho(item) {
  const partes = [`${item.interacoes.toLocaleString("pt-BR")} interações públicas`];
  if (item.curtidas) partes.push(`${item.curtidas.toLocaleString("pt-BR")} curtidas`);
  if (item.reacoes) partes.push(`${item.reacoes.toLocaleString("pt-BR")} reações`);
  if (item.comentarios) partes.push(`${item.comentarios.toLocaleString("pt-BR")} comentários`);
  if (item.compartilhamentos) partes.push(`${item.compartilhamentos.toLocaleString("pt-BR")} compartilhamentos`);
  return partes.join("; ");
}

function secaoMarkdown(titulo, itens) {
  const linhas = [`### ${titulo}`, ""];
  if (!itens.length) {
    linhas.push("_Nenhum conteúdo classificado neste campo foi retornado pela coleta configurada._", "");
    return linhas;
  }
  itens.forEach((item, indice) => {
    const conta = item.contaUsuario ? `@${item.contaUsuario}` : item.contaNome || "conta não identificada";
    const data = item.publicadoEm ? dataBrasilia(new Date(item.publicadoEm)) : "data indisponível";
    linhas.push(
      `**${indice + 1}. ${item.titulo}**  `,
      `${item.plataforma} • ${item.formato} • ${conta} • ${data}  `,
      `${item.resumoFactual}  `,
      `Desempenho: ${linhaDesempenho(item)}.  `,
      `Leitura: ${item.leituraEngajamento}  `,
      `Fonte: ${item.permalink}`,
      ""
    );
  });
  return linhas;
}

function montarMarkdown(relatorio) {
  return [
    ...secaoMarkdown("O que mais engajou no campo pró-Bolsonaro", relatorio.campos.bolsonaro),
    ...secaoMarkdown("O que mais engajou no campo pró-Lula", relatorio.campos.lula)
  ].join("\n").trim();
}

async function executar() {
  const dados = JSON.parse(await fs.readFile(arquivoDados, "utf8"));
  const meta = dados.metaGraph;
  if (!Array.isArray(meta?.itens) || !meta.itens.length) {
    throw new Error("A coleta Meta não retornou conteúdos; o relatório não será fabricado.");
  }

  const fim = new Date();
  const inicio = new Date(fim);
  inicio.setUTCDate(inicio.getUTCDate() - dias);
  const periodo = {
    dias,
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    inicioLocal: dataBrasilia(inicio),
    fimLocal: dataBrasilia(fim)
  };

  const itens = meta.itens
    .filter((item) => {
      const publicado = item.publicadoEm ? new Date(item.publicadoEm) : null;
      return publicado && !Number.isNaN(publicado.getTime()) && publicado >= inicio && publicado <= fim;
    })
    .sort((a, b) => Number(b.interacoes || 0) - Number(a.interacoes || 0));

  const bolsonaro = itens.filter((item) => item.campoPolitico === "pro-bolsonaro").slice(0, 20);
  const lula = itens.filter((item) => item.campoPolitico === "pro-lula").slice(0, 20);
  const entrada = { bolsonaro: bolsonaro.map(itemParaPrompt), lula: lula.map(itemParaPrompt) };
  if (!bolsonaro.length && !lula.length) {
    throw new Error("Nenhuma conta foi classificada. Configure META_BOLSONARO_ACCOUNTS e META_LULA_ACCOUNTS.");
  }

  const assinaturaEntrada = assinatura({ periodo: [periodo.inicioLocal, periodo.fimLocal], entrada });
  const { resultado, responseId } = await gerarAnaliseOpenAI(entrada, periodo);
  const idsValidos = new Set([...bolsonaro, ...lula].map((item) => item.id));
  const analises = analisePorId(resultado, idsValidos);

  const relatorio = {
    status: bolsonaro.length && lula.length ? "completo" : "parcial",
    fonte: "Meta Graph API",
    modelo,
    geradoEm: fim.toISOString(),
    assinaturaEntrada,
    responseId,
    periodo,
    cobertura: {
      contas: meta.fontes || [],
      totalColetado: meta.itens.length,
      totalNoPeriodo: itens.length,
      naoClassificados: itens.filter((item) => !item.campoPolitico).length,
      criterioRanking: meta.criterioRanking
    },
    resumoExecutivo: texto(resultado.resumoExecutivo, 1600),
    campos: {
      bolsonaro: bolsonaro.map((item) => enriquecer(item, analises)),
      lula: lula.map((item) => enriquecer(item, analises))
    },
    pautasInteressantes: fontesValidas(resultado.pautasInteressantes, idsValidos),
    plataformasFormatosPrioritarios: fontesValidas(resultado.plataformasFormatosPrioritarios, idsValidos),
    conteudosGerados: fontesValidas(resultado.conteudosGerados, idsValidos),
    limitacoes: [
      ...(resultado.limitacoes || []).map((item) => texto(item, 500)).filter(Boolean),
      ...(bolsonaro.length ? [] : ["Nenhum conteúdo de conta classificada como pró-Bolsonaro foi coletado no período."]),
      ...(lula.length ? [] : ["Nenhum conteúdo de conta classificada como pró-Lula foi coletado no período."]),
      "A cobertura se limita às contas, permissões e métricas públicas disponíveis na integração configurada."
    ]
  };
  relatorio.textoMarkdown = montarMarkdown(relatorio);

  dados.relatorioQuatroSemanas = relatorio;
  dados.atualizadoEm = fim.toISOString();
  dados.atualizacaoAutomatica = "Diariamente pelo agente GitHub Actions";
  await fs.writeFile(arquivoDados, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
  console.log(`Relatório diário gerado com ${bolsonaro.length} item(ns) pró-Bolsonaro e ${lula.length} item(ns) pró-Lula.`);
}

module.exports = { formato, itemParaPrompt, montarMarkdown };

if (require.main === module) {
  executar().catch((erro) => {
    console.error(`Falha no relatório diário: ${erro.message}`);
    process.exitCode = 1;
  });
}
