const fs = require("node:fs/promises");
const path = require("node:path");

const raiz = path.resolve(__dirname, "..");
const arquivo = path.join(raiz, "dados.json");

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

async function executar() {
  const dados = JSON.parse(await fs.readFile(arquivo, "utf8"));
  const erros = [];

  for (const indicador of dados.indicadores || []) {
    const serie = series[indicador.id];
    if (!serie) continue;
    try {
      const { registro, fonte } = await buscar(serie.url);
      indicador.valor = serie.formatar(String(registro.valor).replace(".", ","));
      indicador.periodo = registro.data;
      indicador.fonte = fonte;
    } catch (erro) {
      erros.push(`${indicador.id}: ${erro.message}`);
    }
  }

  const agora = new Date();
  dados.atualizadoEm = agora.toISOString();
  dados.historico = [
    ...(dados.historico || []),
    { atualizadoEm: dados.atualizadoEm, sucesso: erros.length === 0, erros }
  ].slice(-30);

  await fs.writeFile(arquivo, `${JSON.stringify(dados, null, 2)}\n`, "utf8");
  if (erros.length) console.warn("Atualização parcial:", erros.join(" | "));
  console.log(`dados.json atualizado em ${dados.atualizadoEm}`);
}

executar().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
