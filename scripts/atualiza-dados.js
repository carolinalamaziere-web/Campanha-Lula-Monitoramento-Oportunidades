const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { sincronizarFonteExterna } = require("./importa-conteudo.js");

const raiz = path.resolve(__dirname, "..");
const arquivo = path.join(raiz, "dados.json");
const modeloOpenAI = "gpt-4o-mini";

const series = {
  ipca: {
    url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json",
    formatar: (valor) => `${valor}%`
  },
  selic: {
    url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json",
    formatar: (valor) => `${valor}% ao ano`
  },
  dolar: {
    url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.10813/dados?formato=json",
    formatar: (valor) => `R$ ${valor}`
  }
};

function assinatura(valor) {
  return crypto.createHash("sha256").update(JSON.stringify(valor)).digest("hex");
}

async function buscar(url) {
  const partesHoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const mapaHoje = Object.fromEntries(partesHoje.map((parte) => [parte.type, parte.value]));
  const hojeUtc = new Date(Date.UTC(Number(mapaHoje.year), Number(mapaHoje.month) - 1, Number(mapaHoje.day)));
  const inicioUtc = new Date(hojeUtc);
  inicioUtc.setUTCDate(inicioUtc.getUTCDate() - 90);
  const br = (data) => `${String(data.getUTCDate()).padStart(2, "0")}/${String(data.getUTCMonth() + 1).padStart(2, "0")}/${data.getUTCFullYear()}`;
  const consulta = new URL(url);
  consulta.searchParams.set("dataInicial", br(inicioUtc));
  consulta.searchParams.set("dataFinal", br(hojeUtc));

  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 20000);
  try {
    const resposta = await fetch(consulta, {
      headers: { Accept: "application/json", "User-Agent": "war-room-lula-2026/1.0" },
      signal: controle.signal
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const corpo = await resposta.json();
    if (!Array.isArray(corpo) || !corpo.length) throw new Error("Resposta vazia");

    const hoje = Number(`${mapaHoje.year}${mapaHoje.month}${mapaHoje.day}`);
    const chave = (data) => {
      const [dia, mes, ano] = String(data).split("/");
      return Number(`${ano}${mes}${dia}`);
    };
    const disponiveis = corpo.filter((registro) => chave(registro.data) <= hoje);
    if (!disponiveis.length) throw new Error("Nenhum registro vigente encontrado");
    return { registro: disponiveis[disponiveis.length - 1], fonte: consulta.toString() };
  } finally {
    clearTimeout(limite);
  }
}

function esquemaRoteiro() {
  return {
    type: "json_schema",
    json_schema: {
      name: "roteiro_zap_28s",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          titulo: { type: "string" },
          texto: { type: "string" },
          chamadaFinal: { type: "string" },
          alertaEditorial: { type: "string" }
        },
        required: ["titulo", "texto", "chamadaFinal", "alertaEditorial"]
      }
    }
  };
}

async function gerarComChatGPT(trending) {
  const chave = String(process.env.OPENAI_API_KEY || "").trim();
  if (!chave) return null;

  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 90000);
  try {
    const resposta = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modeloOpenAI,
        messages: [
          {
            role: "developer",
            content: [
              "Você escreve um roteiro para áudio de WhatsApp em português do Brasil.",
              "Use somente os dados fornecidos. Não invente números, fontes, comparações, causas, promessas ou acusações.",
              "O texto falado deve ter aproximadamente 28 segundos, entre 58 e 72 palavras.",
              "Se algum dado estiver sem fonte ou data, registre a limitação no alerta editorial.",
              "Tom popular, direto e respeitoso. Termine convidando a pessoa a conferir a fonte."
            ].join(" ")
          },
          {
            role: "user",
            content: `Crie um roteiro a partir destes assuntos em monitoramento:\n${JSON.stringify(trending)}`
          }
        ],
        response_format: esquemaRoteiro()
      }),
      signal: controle.signal
    });
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new Error(corpo?.error?.message || `HTTP ${resposta.status}`);
    const conteudo = corpo?.choices?.[0]?.message?.content;
    if (!conteudo) throw new Error("A OpenAI retornou resposta sem conteúdo.");
    return { ...JSON.parse(conteudo), responseId: corpo.id || null };
  } finally {
    clearTimeout(limite);
  }
}

async function atualizarIndicadores(dados, erros) {
  let mudou = false;
  for (const indicador of dados.indicadores || []) {
    const serie = series[indicador.id];
    if (!serie) continue;
    try {
      const { registro, fonte } = await buscar(serie.url);
      const valor = serie.formatar(String(registro.valor).replace(".", ","));
      if (indicador.valor !== valor || indicador.periodo !== registro.data || indicador.fonte !== fonte) {
        indicador.valor = valor;
        indicador.periodo = registro.data;
        indicador.fonte = fonte;
        mudou = true;
      }
    } catch (erro) {
      erros.push(`${indicador.id}: ${erro.message}`);
    }
  }
  return mudou;
}

async function executar() {
  const dados = JSON.parse(await fs.readFile(arquivo, "utf8"));
  const erros = [];
  let mudou = await atualizarIndicadores(dados, erros);

  try {
    const fonte = await sincronizarFonteExterna(dados);
    mudou = mudou || fonte.mudou;
  } catch (erro) {
    erros.push(`fonte externa: ${erro.message}`);
  }

  const assinaturaTrending = assinatura(dados.trending || []);
  if (process.env.OPENAI_API_KEY && dados.roteiro?.assinaturaEntrada !== assinaturaTrending) {
    try {
      const gerado = await gerarComChatGPT(dados.trending || []);
      if (gerado) {
        dados.roteiro = {
          status: "gerado",
          modelo: modeloOpenAI,
          duracaoSegundos: 28,
          geradoEm: new Date().toISOString(),
          assinaturaEntrada: assinaturaTrending,
          ...gerado
        };
        mudou = true;
      }
    } catch (erro) {
      erros.push(`OpenAI: ${erro.message}`);
    }
  } else if (!process.env.OPENAI_API_KEY) {
    console.log("OPENAI_API_KEY não configurada; roteiro automático ignorado.");
  } else {
    console.log("OpenAI: dados sem mudança; nova chamada evitada.");
  }

  if (!mudou) {
    if (erros.length) console.warn("Atualização sem alterações:", erros.join(" | "));
    else console.log("Nenhuma alteração detectada em dados.json.");
    return;
  }

  dados.atualizadoEm = new Date().toISOString();
  dados.historico = [
    ...(dados.historico || []),
    { atualizadoEm: dados.atualizadoEm, sucesso: erros.length === 0, erros }
  ].slice(-30);
  await fs.writeFile(arquivo, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
  if (erros.length) console.warn("Atualização parcial:", erros.join(" | "));
  console.log(`dados.json atualizado em ${dados.atualizadoEm}`);
}

module.exports = { gerarComChatGPT };

if (require.main === module) {
  executar().catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  });
}
