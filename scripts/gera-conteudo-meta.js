const fs = require("node:fs/promises");
const path = require("node:path");

const MODELO = "muse-spark-1.3";
const ENDPOINT = "https://api.meta.ai/v1/chat/completions";
const raiz = path.resolve(__dirname, "..");
const arquivo = path.join(raiz, "dados.json");

function fatosVerificados(dados) {
  return (dados.indicadores || [])
    .filter((item) => item.id && item.rotulo && item.valor && item.periodo && item.fonte)
    .map((item) => ({
      id: String(item.id),
      titulo: String(item.rotulo),
      valor: String(item.valor),
      dataReferencia: String(item.periodo),
      fonte: String(item.fonte)
    }));
}

function esquema(ids) {
  return {
    type: "json_schema",
    json_schema: {
      name: "conteudo_painel",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          itens: {
            type: "array",
            minItems: 1,
            maxItems: ids.length,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string", enum: ids },
                titulo: { type: "string" },
                resumoPopular: { type: "string" },
                ganchoVideo: { type: "string" },
                roteiroVideo: { type: "string" },
                statusWhatsapp: { type: "string" }
              },
              required: [
                "id",
                "titulo",
                "resumoPopular",
                "ganchoVideo",
                "roteiroVideo",
                "statusWhatsapp"
              ]
            }
          },
          alertaEditorial: { type: "string" }
        },
        required: ["itens", "alertaEditorial"]
      }
    }
  };
}

async function chamarMeta(chave, fatos) {
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 60000);

  const instrucao = [
    "Você transforma dados públicos em conteúdo curto em português do Brasil.",
    "Use somente os fatos fornecidos pelo usuário.",
    "Preserve exatamente números e datas; não invente comparações, causas, promessas ou contexto.",
    "Não converta indicador macroeconômico em preço de alimento ou produto específico sem esse dado.",
    "Escreva de forma popular, direta e respeitosa, com uma informação verificável por peça.",
    "O roteiro de vídeo deve ter de 20 a 35 segundos e terminar convidando a pessoa a consultar a fonte.",
    "O alerta editorial deve informar qualquer cuidado necessário para não exagerar a conclusão."
  ].join(" ");

  try {
    const resposta = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODELO,
        messages: [
          { role: "system", content: instrucao },
          {
            role: "user",
            content: `Crie uma versão para cada fato deste JSON:\n${JSON.stringify(fatos)}`
          }
        ],
        response_format: esquema(fatos.map((item) => item.id))
      }),
      signal: controle.signal
    });

    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      const detalhe = corpo?.error?.message || corpo?.message || `HTTP ${resposta.status}`;
      throw new Error(`Meta Model API: ${detalhe}`);
    }

    const conteudo = corpo?.choices?.[0]?.message?.content;
    if (!conteudo) throw new Error("Meta Model API retornou uma resposta sem conteúdo.");
    return JSON.parse(conteudo);
  } finally {
    clearTimeout(limite);
  }
}

async function executar() {
  const chave = process.env.MODEL_API_KEY;
  if (!chave) {
    console.log("MODEL_API_KEY não configurada; geração com a Meta foi ignorada.");
    return;
  }

  const dados = JSON.parse(await fs.readFile(arquivo, "utf8"));
  const fatos = fatosVerificados(dados);
  if (!fatos.length) throw new Error("Nenhum fato com fonte e data foi encontrado em dados.json.");

  const gerado = await chamarMeta(chave, fatos);
  const porId = new Map(fatos.map((fato) => [fato.id, fato]));
  const vistos = new Set();
  const itens = [];

  for (const item of gerado.itens || []) {
    const fato = porId.get(item.id);
    if (!fato || vistos.has(item.id)) continue;
    vistos.add(item.id);
    itens.push({
      ...item,
      valorOriginal: fato.valor,
      dataReferencia: fato.dataReferencia,
      fonte: fato.fonte,
      verificacao: "confirmado pela fonte oficial informada"
    });
  }

  if (!itens.length) throw new Error("A Meta não devolveu itens válidos para os fatos enviados.");

  dados.metaIA = {
    status: "integrada",
    provedor: "Meta Model API",
    modelo: MODELO,
    geradoEm: new Date().toISOString(),
    origem: "Indicadores com fonte e data existentes em dados.json",
    alertaEditorial: gerado.alertaEditorial,
    itens
  };

  await fs.writeFile(arquivo, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
  console.log(`Conteúdo da Meta gerado: ${itens.length} item(ns).`);
}

executar().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
