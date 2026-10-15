(function () {
  const INTERVALO = 30 * 1000;
  let dadosAtuais = null;
  let monitoramentoAgendado = false;
  let filtroTrendingPlataforma = "TODOS";
  let filtroTrendingFormato = "TODOS";

  function texto(elemento, valor) {
    elemento.textContent = valor == null ? "—" : String(valor);
  }

  function criar(tag, classe, conteudo) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (conteudo != null) texto(elemento, conteudo);
    return elemento;
  }

  function urlHttps(valor) {
    if (!valor) return null;
    try {
      const url = new URL(String(valor));
      return url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }

  function formatarNumero(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero.toLocaleString("pt-BR") : "0";
  }

  function adicionarMetrica(container, valor, rotulo) {
    if (!Number(valor)) return;
    const metrica = criar("span", "wr-v4__social-metrica");
    metrica.append(criar("strong", "", formatarNumero(valor)), document.createTextNode(` ${rotulo}`));
    container.append(metrica);
  }

  function montarMidiaSocial(item) {
    const midiaUrl = urlHttps(item.midiaUrl);
    const miniaturaUrl = urlHttps(item.miniaturaUrl);
    if (!midiaUrl && !miniaturaUrl) return criar("div", "wr-v4__social-sem-midia", item.tipo || "CONTEÚDO");

    const moldura = criar("div", "wr-v4__social-midia");
    const ehVideo = String(item.tipo || "").toUpperCase().includes("VIDEO");
    if (ehVideo && midiaUrl && midiaUrl !== miniaturaUrl) {
      const video = document.createElement("video");
      video.src = midiaUrl;
      video.controls = true;
      video.preload = "metadata";
      video.playsInline = true;
      if (miniaturaUrl) video.poster = miniaturaUrl;
      video.setAttribute("aria-label", `Vídeo de ${item.contaNome || item.rede}`);
      moldura.append(video);
    } else {
      const imagem = document.createElement("img");
      imagem.src = miniaturaUrl || midiaUrl;
      imagem.alt = `Conteúdo de ${item.contaNome || item.rede}`;
      imagem.loading = "lazy";
      imagem.decoding = "async";
      moldura.append(imagem);
    }
    return moldura;
  }

  function montarMetaGraph(dados) {
    if (!Array.isArray(dados.metaGraph?.itens) || !dados.metaGraph.itens.length) return null;

    const secao = criar("section", "wr-v4__social");
    const topo = criar("div", "wr-v4__social-topo");
    const titulo = criar("div");
    titulo.append(
      criar("span", "wr-v4__social-selo", "META GRAPH API • ENGAJAMENTO PÚBLICO"),
      criar("h2", "", "Conteúdos com maior engajamento")
    );
    const atualizado = dados.metaGraph.atualizadoEm
      ? `Atualizado em ${new Date(dados.metaGraph.atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
      : "Atualização pendente";
    topo.append(titulo, criar("span", "wr-v4__social-atualizado", atualizado));

    const grade = criar("div", "wr-v4__social-grade");
    for (const item of dados.metaGraph.itens.slice(0, 12)) {
      const card = criar("article", "wr-v4__social-card");
      const cabecalho = criar("div", "wr-v4__social-card-topo");
      const conta = criar("div", "wr-v4__social-conta");
      const fotoConta = urlHttps(item.fotoContaUrl);
      if (fotoConta) {
        const avatar = document.createElement("img");
        avatar.src = fotoConta;
        avatar.alt = "";
        avatar.loading = "lazy";
        conta.append(avatar);
      }
      const identificacao = criar("div");
      identificacao.append(
        criar("strong", "", item.contaNome || item.contaUsuario || item.rede),
        criar("small", "", `${item.rede}${item.contaUsuario ? ` • @${item.contaUsuario}` : ""}`)
      );
      conta.append(identificacao);
      cabecalho.append(conta, criar("span", "wr-v4__social-posicao", `#${item.posicao || "—"}`));

      card.append(cabecalho, montarMidiaSocial(item));
      card.append(criar("p", "wr-v4__social-legenda", item.legenda || "Publicação sem legenda."));

      const metricas = criar("div", "wr-v4__social-metricas");
      adicionarMetrica(metricas, item.curtidas, "curtidas");
      adicionarMetrica(metricas, item.reacoes, "reações");
      adicionarMetrica(metricas, item.comentarios, "comentários");
      adicionarMetrica(metricas, item.compartilhamentos, "compartilhamentos");
      if (item.taxaEngajamentoEstimada != null) {
        adicionarMetrica(metricas, item.taxaEngajamentoEstimada, "% estimada");
      }
      if (!metricas.childNodes.length) metricas.append(criar("span", "", "Métricas públicas indisponíveis"));
      card.append(metricas);

      const link = urlHttps(item.permalink);
      if (link) {
        const abrir = criar("a", "wr-v4__social-link", "Abrir publicação original ↗");
        abrir.href = link;
        abrir.target = "_blank";
        abrir.rel = "noopener noreferrer";
        card.append(abrir);
      }
      grade.append(card);
    }

    const nota = criar("p", "wr-v4__social-nota", dados.metaGraph.observacao || dados.metaGraph.criterioRanking);
    secao.append(topo, grade, nota);
    return secao;
  }

  function criarLinkFonte(valor) {
    const url = urlHttps(valor);
    if (!url) return null;
    const link = criar("a", "wr-v4__fonte", "Fonte ↗");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  function numeroMonitor(valor) {
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? convertido : 0;
  }

  function formatoMonitor(item) {
    const bruto = String(item.formato || item.tipo || item.mediaType || "Outros").trim().toUpperCase();
    const nomes = {
      CAROUSEL_ALBUM: "Carrossel",
      CAROUSEL: "Carrossel",
      VIDEO: "Vídeo",
      REEL: "Reels",
      REELS: "Reels",
      IMAGE: "Imagem",
      PHOTO: "Imagem",
      STORY: "Stories",
      STORIES: "Stories",
      STATUS: "Status",
      AUDIO: "Áudio",
      FIGURINHA: "Figurinha"
    };
    return nomes[bruto] || String(item.formato || item.tipo || "Outros").trim();
  }

  function ladoMonitor(item) {
    const identidade = [item.candidato, item.publico, item.lado, item.contaNome, item.contaUsuario]
      .filter(Boolean)
      .join(" ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (/\bbolsonaro\b/.test(identidade)) return "bolsonaro";
    if (/\blula\b/.test(identidade)) return "lula";
    return null;
  }

  function totaisMonitoramento(dados) {
    const configurados = Array.isArray(dados.monitoramento?.porFormato)
      ? dados.monitoramento.porFormato
      : [];
    if (configurados.length) {
      return configurados.map((item) => ({
        formato: item.formato || "Outros",
        bolsonaro: {
          conteudos: numeroMonitor(item.bolsonaro?.conteudos ?? item.bolsonaro),
          interacoes: numeroMonitor(item.bolsonaro?.interacoes)
        },
        lula: {
          conteudos: numeroMonitor(item.lula?.conteudos ?? item.lula),
          interacoes: numeroMonitor(item.lula?.interacoes)
        }
      }));
    }

    const totais = new Map();
    const itens = [...(dados.metaGraph?.itens || []), ...(dados.trending || [])];
    for (const item of itens) {
      const lado = ladoMonitor(item);
      if (!lado) continue;
      const formato = formatoMonitor(item);
      if (!totais.has(formato)) {
        totais.set(formato, {
          formato,
          bolsonaro: { conteudos: 0, interacoes: 0 },
          lula: { conteudos: 0, interacoes: 0 }
        });
      }
      const atual = totais.get(formato)[lado];
      atual.conteudos += 1;
      atual.interacoes += numeroMonitor(item.interacoes);
    }

    const ordem = ["Reels", "Vídeo", "Carrossel", "Stories", "Imagem", "Status", "Áudio", "Figurinha", "Outros"];
    return [...totais.values()].sort((a, b) => {
      const indiceA = ordem.indexOf(a.formato);
      const indiceB = ordem.indexOf(b.formato);
      return (indiceA < 0 ? 99 : indiceA) - (indiceB < 0 ? 99 : indiceB);
    });
  }

  function resumoLadoMonitor(lado) {
    const bloco = criar("div", "wr-monitor__valor");
    bloco.append(criar("strong", "", formatarNumero(lado.conteudos)));
    bloco.append(criar("small", "", `${formatarNumero(lado.interacoes)} interações`));
    return bloco;
  }

  function preencherComparativoMonitor(secao, linhas, assinatura) {
    secao.replaceChildren();
    secao.dataset.assinatura = assinatura;
    const titulo = criar("div", "wr-monitor__topo");
    titulo.append(
      criar("h3", "", "VISÃO TOTAL • BOLSONARO × LULA POR FORMATO"),
      criar("span", "", "CONTEÚDOS / INTERAÇÕES PÚBLICAS")
    );
    secao.append(titulo);

    if (!linhas.length) {
      secao.append(
        criar(
          "p",
          "wr-monitor__vazio",
          "Aguardando conteúdos classificados por conta Bolsonaro/Lula na Meta Graph API."
        )
      );
      return;
    }

    const tabela = criar("div", "wr-monitor__tabela");
    const cabecalho = criar("div", "wr-monitor__linha wr-monitor__cabecalho");
    for (const coluna of ["Formato", "Bolsonaro", "Lula", "Total"]) cabecalho.append(criar("span", "", coluna));
    tabela.append(cabecalho);

    for (const item of linhas) {
      const linha = criar("div", "wr-monitor__linha");
      const total = {
        conteudos: item.bolsonaro.conteudos + item.lula.conteudos,
        interacoes: item.bolsonaro.interacoes + item.lula.interacoes
      };
      linha.append(
        criar("strong", "wr-monitor__formato", item.formato),
        resumoLadoMonitor(item.bolsonaro),
        resumoLadoMonitor(item.lula),
        resumoLadoMonitor(total)
      );
      tabela.append(linha);
    }
    secao.append(tabela);
  }

  function aprimorarAbaMonitoramento() {
    const titulo = [...document.querySelectorAll("h2")].find((elemento) =>
      /(MONITOR CANAL FORMATO|IMPACTO POR FORMATO DE REDE SOCIAL)/i.test(elemento.textContent || "")
    );
    if (!titulo) return;

    const container = titulo.parentElement;
    const tabelaLegada = container?.querySelector("table");
    const insight = [...(container?.children || [])].find((elemento) =>
      /INSIGHT BRANDWATCH/i.test(elemento.textContent || "")
    );
    if (!container || !tabelaLegada || !insight) return;

    insight.classList.add("wr-monitor__insight");
    if (titulo.nextElementSibling !== insight) titulo.after(insight);

    let comparativo = document.getElementById("wr-monitor-comparativo");
    if (!comparativo) {
      comparativo = criar("section", "wr-monitor");
      comparativo.id = "wr-monitor-comparativo";
    }
    if (insight.nextElementSibling !== comparativo) insight.after(comparativo);

    const linhas = totaisMonitoramento(dadosAtuais || {});
    const assinatura = JSON.stringify(linhas);
    if (comparativo.dataset.assinatura !== assinatura) {
      preencherComparativoMonitor(comparativo, linhas, assinatura);
    }
  }

  function ocultarDestaqueLegadoFormatos() {
    const raiz = document.getElementById("root");
    if (!raiz) return;
    const destaque = [...raiz.querySelectorAll("div")].find((elemento) =>
      /^Reels 45% \+ Figurinha 25% = 70% do alcance\. Foco total\.$/i.test(
        (elemento.textContent || "").trim()
      )
    );
    if (destaque && !destaque.hidden) destaque.hidden = true;
  }

  function numeroTrending(valor) {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
    const bruto = String(valor || "").trim().replace(/\s+/g, "");
    const compacto = bruto.match(/(-?\d+(?:[.,]\d+)?)\s*([KMB])/i);
    if (compacto) {
      const numero = Number(compacto[1].replace(",", "."));
      const multiplicador = { K: 1e3, M: 1e6, B: 1e9 }[compacto[2].toUpperCase()];
      return Number.isFinite(numero) ? numero * multiplicador : 0;
    }
    const normalizado = bruto.includes(",")
      ? bruto.replace(/\./g, "").replace(",", ".")
      : bruto.replace(/[^0-9.-]/g, "");
    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : 0;
  }

  function percentualTrending(valor) {
    const encontrado = String(valor ?? "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    const numero = encontrado ? Number(encontrado[0]) : Number(valor);
    return Number.isFinite(numero) ? numero : 0;
  }

  function formatarCompacto(valor) {
    return new Intl.NumberFormat("pt-BR", {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(numeroTrending(valor));
  }

  function historicoTrending(item, pontuacao, crescimento) {
    const amostras = Array.isArray(item.historico)
      ? item.historico
          .map((amostra) => numeroTrending(amostra?.interacoes ?? amostra?.volume ?? amostra?.valor ?? amostra))
          .filter((valor) => Number.isFinite(valor))
      : [];
    if (amostras.length >= 2) return amostras;
    if (pontuacao > 0 && crescimento !== 0 && crescimento > -100) {
      return [pontuacao / (1 + crescimento / 100), pontuacao];
    }
    return [pontuacao, pontuacao];
  }

  function campoTrending(item) {
    const identidade = [item.campo, item.publico, item.candidato, item.lado, item.contaNome, item.contaUsuario]
      .filter(Boolean)
      .join(" ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (/anti[-\s]?bolsonaro/.test(identidade)) return "anti-Bolsonaro";
    if (/anti[-\s]?lula/.test(identidade)) return "anti-Lula";
    if (/pro[-\s]?bolsonaro|bolsonarista|\bbolsonaro\b/.test(identidade)) return "pró-Bolsonaro";
    if (/pro[-\s]?lula|lulista|\blula\b/.test(identidade)) return "pró-Lula";
    return "monitoramento geral";
  }

  function resumirTextoTrending(valor, limite = 420) {
    const limpo = String(valor || "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!limpo) return "Descrição editorial ainda não informada para este conteúdo.";
    return limpo.length > limite ? `${limpo.slice(0, limite - 1).trim()}…` : limpo;
  }

  function normalizarTrending(dados) {
    const analises = new Map();
    for (const campo of ["bolsonaro", "lula"]) {
      for (const item of dados.relatorioQuatroSemanas?.campos?.[campo] || []) analises.set(String(item.id), item);
    }
    const combinados = [...(dados.metaGraph?.itens || []), ...(dados.trending || [])];
    const unicos = new Map();
    for (const item of combinados) {
      const titulo = resumirTextoTrending(
        item.titulo || item.topic || item.legenda || item.fato || "Conteúdo sem título",
        120
      );
      const plataforma = String(item.plataforma || item.rede || item.canal || "Outros").trim();
      const formato = formatoMonitor(item);
      const pontuacao = Math.max(
        numeroTrending(item.interacoes),
        numeroTrending(item.visualizacoes),
        numeroTrending(item.views),
        numeroTrending(item.alcance),
        numeroTrending(item.volume),
        numeroTrending(item.vol)
      );
      const crescimento = percentualTrending(item.crescimentoPercentual ?? item.crescimento ?? item.growth);
      const id = String(item.id || item.permalink || item.fonte || `${plataforma}:${formato}:${titulo}`);
      const analise = analises.get(id) || {};
      const anterior = unicos.get(id) || {};
      unicos.set(id, {
        ...anterior,
        id,
        titulo,
        resumo: resumirTextoTrending(
          analise.resumoFactual || item.resumoFactual || item.resumo || item.fato || item.legenda
        ),
        porqueFuncionou: resumirTextoTrending(
          analise.leituraEngajamento || item.leituraEngajamento || item.analise || item.resumoEngajamento || item.orientacao,
          300
        ),
        campo: campoTrending(item),
        plataforma,
        formato,
        pontuacao,
        alcance: item.alcance == null ? (anterior.alcance ?? null) : numeroTrending(item.alcance),
        compartilhamentos: item.compartilhamentos == null
          ? (anterior.compartilhamentos ?? null)
          : numeroTrending(item.compartilhamentos),
        comentarios: item.comentarios == null ? (anterior.comentarios ?? null) : numeroTrending(item.comentarios),
        midiaUrl: urlHttps(item.midiaUrl || analise.midiaUrl) || anterior.midiaUrl || null,
        miniaturaUrl: urlHttps(item.miniaturaUrl || analise.miniaturaUrl) || anterior.miniaturaUrl || null,
        tipo: item.tipo || item.formato || analise.formato || "CONTEÚDO",
        contaNome: item.contaNome || analise.contaNome || plataforma,
        crescimento,
        historico: historicoTrending(item, pontuacao, crescimento),
        publicadoEm: item.publicadoEm || item.dataReferencia || item.periodo || null,
        url: urlHttps(item.permalink || item.fonte)
      });
    }
    return [...unicos.values()].sort((a, b) => b.pontuacao - a.pontuacao || b.crescimento - a.crescimento);
  }

  function criarSparkline(pontos) {
    const largura = 132;
    const altura = 42;
    const margem = 3;
    const valores = pontos.length ? pontos : [0, 0];
    const minimo = Math.min(...valores);
    const maximo = Math.max(...valores);
    const intervalo = maximo - minimo || 1;
    const coordenadas = valores.map((valor, indice) => {
      const x = margem + (indice * (largura - margem * 2)) / Math.max(1, valores.length - 1);
      const y = altura - margem - ((valor - minimo) / intervalo) * (altura - margem * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${largura} ${altura}`);
    svg.setAttribute("class", "wr-trending__grafico");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Curva de crescimento do conteúdo");
    const linhaBase = document.createElementNS("http://www.w3.org/2000/svg", "line");
    linhaBase.setAttribute("x1", "0");
    linhaBase.setAttribute("x2", String(largura));
    linhaBase.setAttribute("y1", String(altura - 2));
    linhaBase.setAttribute("y2", String(altura - 2));
    linhaBase.setAttribute("class", "wr-trending__grafico-base");
    const linha = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    linha.setAttribute("points", coordenadas.join(" "));
    linha.setAttribute("class", "wr-trending__grafico-linha");
    svg.append(linhaBase, linha);
    return svg;
  }

  function botaoFiltroTrending(rotulo, tipo, ativo) {
    const botao = criar("button", ativo ? "wr-trending__filtro is-active" : "wr-trending__filtro", rotulo);
    botao.type = "button";
    botao.addEventListener("click", () => {
      if (tipo === "plataforma") filtroTrendingPlataforma = rotulo;
      else filtroTrendingFormato = rotulo;
      const secao = document.getElementById("wr-trending-dinamico");
      if (secao) preencherTrending(secao, dadosAtuais || {});
    });
    return botao;
  }

  function montarAnalisesTrending(itens) {
    const secao = criar("section", "wr-trending__analises");
    const grupos = new Map();
    for (const item of itens) {
      if (!grupos.has(item.campo)) grupos.set(item.campo, []);
      grupos.get(item.campo).push(item);
    }

    for (const [campo, conteudos] of grupos) {
      const grupo = criar("div", "wr-trending__grupo");
      grupo.append(criar("h3", "", `O que mais engajou no campo ${campo}`));
      conteudos.forEach((item, indice) => {
        const card = criar("article", "wr-trending__analise");
        const texto = criar("div", "wr-trending__analise-texto");
        texto.append(
          criar("h4", "", `${indice + 1}. ${item.formato}-${item.plataforma} “${item.titulo}”`),
          criar(
            "p",
            "",
            `Publicado em ${item.plataforma} no formato ${item.formato}. ${item.resumo} ${item.porqueFuncionou}`
          )
        );
        const desempenho = criar("div", "wr-trending__analise-desempenho");
        desempenho.append(
          criarSparkline(item.historico),
          criar("strong", "", `${formatarCompacto(item.pontuacao)} interações/volume`),
          criar(
            "span",
            item.crescimento >= 0 ? "is-up" : "is-down",
            `${item.crescimento >= 0 ? "+" : ""}${item.crescimento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
          )
        );
        card.append(texto, desempenho);
        grupo.append(card);
      });
      secao.append(grupo);
    }
    return secao;
  }

  function preencherTrending(secao, dados) {
    const todos = normalizarTrending(dados);
    const plataformasPadrao = ["Instagram", "WhatsApp", "TikTok", "Facebook"];
    const formatosPadrao = ["Reels", "Stories", "Feed", "Status", "Áudio", "Vídeo", "Figurinha", "Carrossel", "Outros"];
    const plataformas = [...new Set([...plataformasPadrao, ...todos.map((item) => item.plataforma).filter(Boolean)])];
    const formatos = [...new Set([...formatosPadrao, ...todos.map((item) => item.formato).filter(Boolean)])];
    const filtrados = todos
      .filter((item) => filtroTrendingPlataforma === "TODOS" || item.plataforma === filtroTrendingPlataforma)
      .filter((item) => filtroTrendingFormato === "TODOS" || item.formato === filtroTrendingFormato)
      .slice(0, 20);
    const volumeTotal = todos.reduce((total, item) => total + item.pontuacao, 0);

    secao.replaceChildren();
    const topo = criar("div", "wr-trending__topo");
    const cabecalho = criar("div");
    cabecalho.append(
      criar("h2", "", "TRENDING AGORA • TOP 20 POR PLATAFORMA E FORMATO"),
      criar(
        "small",
        "",
        dados.metaGraph?.periodo?.dias
          ? `Janela móvel: últimos ${dados.metaGraph.periodo.dias} dias`
          : "Período ainda não informado pela fonte"
      )
    );
    topo.append(cabecalho, criar("span", "wr-trending__total", `${formatarCompacto(volumeTotal)} VOL. TOTAL`));

    const filtrosPlataforma = criar("div", "wr-trending__filtros");
    for (const plataforma of ["TODOS", ...plataformas]) {
      filtrosPlataforma.append(
        botaoFiltroTrending(plataforma, "plataforma", filtroTrendingPlataforma === plataforma)
      );
    }
    const filtrosFormato = criar("div", "wr-trending__filtros wr-trending__filtros--formato");
    for (const formato of ["TODOS", ...formatos]) {
      filtrosFormato.append(botaoFiltroTrending(formato, "formato", filtroTrendingFormato === formato));
    }

    const lista = criar("div", "wr-trending__lista");
    if (!filtrados.length) {
      const exigeConectorExterno = ["WhatsApp", "TikTok"].includes(filtroTrendingPlataforma);
      lista.append(
        criar(
          "p",
          "wr-trending__vazio",
          exigeConectorExterno
            ? `Nenhum dado de ${filtroTrendingPlataforma}: esta plataforma não é fornecida pela Meta Graph API. Conecte a API própria ou envie os registros via Google Sheets/Supabase.`
            : "Nenhum conteúdo real encontrado para esta combinação no período. O painel mostrará até 20 itens quando a fonte retornar dados."
        )
      );
    }
    filtrados.forEach((item, indice) => {
      const linha = criar("article", "wr-trending__item");
      const lateral = criar("div", "wr-trending__lateral");
      lateral.append(criar("span", "wr-trending__rank", indice + 1), montarMidiaSocial(item));
      const conteudo = criar("div", "wr-trending__conteudo");
      const titulo = item.url ? criar("a", "", item.titulo) : criar("strong", "", item.titulo);
      if (item.url) {
        titulo.href = item.url;
        titulo.target = "_blank";
        titulo.rel = "noopener noreferrer";
      }
      const meta = criar("div", "wr-trending__meta");
      meta.append(
        criar("span", "", item.plataforma),
        criar("span", "", item.formato),
        criar("span", "", item.publicadoEm || "data não informada")
      );
      const leitura = criar("div", "wr-trending__leitura");
      leitura.append(
        criar("p", "", item.resumo),
        criar("p", "", `Por que funcionou: ${item.porqueFuncionou}`)
      );
      conteudo.append(titulo, meta, leitura);

      const metricas = criar("div", "wr-trending__metricas");
      const blocosMetrica = [
        [item.alcance, "alcance"],
        [item.compartilhamentos, "compartilhamentos"],
        [item.pontuacao, "interações públicas"]
      ];
      for (const [valor, rotulo] of blocosMetrica) {
        const bloco = criar("span", "wr-trending__metrica");
        bloco.append(
          criar("strong", "", valor == null ? "N/D" : formatarCompacto(valor)),
          criar("small", "", valor == null ? `${rotulo} não liberado pela fonte` : rotulo)
        );
        metricas.append(bloco);
      }
      const tendencia = criar("div", "wr-trending__tendencia");
      tendencia.append(
        criarSparkline(item.historico),
        criar(
          "span",
          item.crescimento >= 0 ? "is-up" : "is-down",
          `${item.crescimento >= 0 ? "+" : ""}${item.crescimento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
        )
      );
      linha.append(lateral, conteudo, metricas, tendencia);
      lista.append(linha);
    });

    secao.append(topo, filtrosPlataforma, filtrosFormato, lista);
    secao.dataset.assinatura = JSON.stringify({
      atualizadoEm: dados.metaGraph?.atualizadoEm || dados.atualizadoEm,
      total: todos.length,
      plataforma: filtroTrendingPlataforma,
      formato: filtroTrendingFormato
    });
  }

  function aprimorarTrending() {
    const raiz = document.getElementById("root");
    const titulo = [...(raiz?.querySelectorAll("h2") || [])].find(
      (elemento) => !elemento.closest("#wr-trending-dinamico") && /TRENDING AGORA/i.test(elemento.textContent || "")
    );
    if (!titulo) return;
    const legado = titulo.parentElement?.parentElement;
    const pai = legado?.parentElement;
    if (!legado || !pai) return;
    legado.hidden = true;

    let secao = document.getElementById("wr-trending-dinamico");
    if (!secao) {
      secao = criar("section", "wr-trending");
      secao.id = "wr-trending-dinamico";
      pai.insertBefore(secao, legado);
    }
    const assinatura = JSON.stringify({
      atualizadoEm: dadosAtuais?.metaGraph?.atualizadoEm || dadosAtuais?.atualizadoEm,
      total: normalizarTrending(dadosAtuais || {}).length,
      plataforma: filtroTrendingPlataforma,
      formato: filtroTrendingFormato
    });
    if (secao.dataset.assinatura !== assinatura) preencherTrending(secao, dadosAtuais || {});
  }

  function preencherOportunidades(secao, dados) {
    const relatorio = dados.relatorioQuatroSemanas;
    const oportunidades = relatorio?.oportunidadesPorFormato || relatorio?.conteudosGerados || [];
    secao.replaceChildren();
    const topo = criar("div", "wr-oportunidades__topo");
    const periodo = relatorio?.periodo
      ? `${relatorio.periodo.inicioLocal} até ${relatorio.periodo.fimLocal}`
      : "aguardando primeira coleta Meta válida";
    topo.append(
      criar("strong", "", "NARRATIVAS DIÁRIAS POR FORMATO"),
      criar("span", "", periodo)
    );
    secao.append(topo);

    if (!oportunidades.length) {
      secao.append(
        criar(
          "p",
          "wr-oportunidades__vazio",
          "A geração aguarda dados reais da Meta Graph API. Nenhuma narrativa será fabricada sem fontes e métricas coletadas."
        )
      );
      return;
    }

    const grade = criar("div", "wr-oportunidades__grade");
    oportunidades.forEach((item) => {
      const card = criar("article", "wr-oportunidades__card");
      card.append(
        criar("span", "wr-oportunidades__formato", `${item.plataforma || "Plataforma"} • ${item.formato}`),
        criar("h3", "", item.titulo),
        criar("p", "wr-oportunidades__narrativa", item.narrativa || item.gancho),
        criar("p", "", `Gancho: ${item.gancho}`),
        criar("p", "", `Desenvolvimento: ${item.desenvolvimento || item.roteiro28s || "—"}`),
        criar("b", "", `CTA: ${item.cta}`),
        criar("small", "", `Estrutura: ${item.duracaoOuEstrutura || "28 segundos"}`),
        criar("small", "", `Teste: ${item.hipoteseTeste || "Medir retenção e compartilhamentos."}`),
        criar(
          "em",
          "",
          item.tipoEvidencia || (["Status", "Figurinha"].includes(item.formato) ? "Adaptação editorial de sinais Meta" : "Evidência Meta")
        )
      );
      const fontes = criar("div", "wr-oportunidades__fontes");
      (item.fontes || []).forEach((fonte, indice) => {
        const url = urlHttps(fonte.permalink);
        if (!url) return;
        const link = criar("a", "", `Fonte ${indice + 1} ↗`);
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        fontes.append(link);
      });
      if (fontes.childNodes.length) card.append(fontes);
      grade.append(card);
    });
    secao.append(grade);
  }

  function aprimorarAbaOportunidades() {
    const raiz = document.getElementById("root");
    const titulo = [...(raiz?.querySelectorAll("h2") || [])].find((elemento) =>
      /PILARES ESTRATÉGICOS|OPORTUNIDADES DO DIA/i.test(elemento.textContent || "")
    );
    if (!titulo) return;
    texto(titulo, "OPORTUNIDADES DO DIA • META API");
    const legado = titulo.nextElementSibling;
    if (legado && legado.id !== "wr-oportunidades-diarias") legado.hidden = true;
    let secao = document.getElementById("wr-oportunidades-diarias");
    if (!secao) {
      secao = criar("section", "wr-oportunidades");
      secao.id = "wr-oportunidades-diarias";
      titulo.insertAdjacentElement("afterend", secao);
    }
    const assinatura = JSON.stringify({
      geradoEm: dadosAtuais?.relatorioQuatroSemanas?.geradoEm || null,
      total: (dadosAtuais?.relatorioQuatroSemanas?.oportunidadesPorFormato || []).length
    });
    if (secao.dataset.assinatura !== assinatura) {
      preencherOportunidades(secao, dadosAtuais || {});
      secao.dataset.assinatura = assinatura;
    }
  }

  function agendarMonitoramento() {
    if (monitoramentoAgendado) return;
    monitoramentoAgendado = true;
    window.requestAnimationFrame(() => {
      monitoramentoAgendado = false;
      aprimorarAbaMonitoramento();
      aprimorarTrending();
      aprimorarAbaOportunidades();
      ocultarDestaqueLegadoFormatos();
    });
  }

  function montarRelatorioQuatroSemanas(dados) {
    const relatorio = dados.relatorioQuatroSemanas;
    if (!relatorio?.campos) return null;

    const secao = criar("section", "wr-relatorio");
    const topo = criar("div", "wr-relatorio__topo");
    const titulo = criar("div");
    titulo.append(
      criar("span", "wr-relatorio__selo", "AGENTE DIÁRIO • META GRAPH API"),
      criar("h2", "", "Relatório das últimas 4 semanas")
    );
    const periodo = relatorio.periodo
      ? `${relatorio.periodo.inicioLocal} até ${relatorio.periodo.fimLocal}`
      : "Período não informado";
    topo.append(titulo, criar("span", "wr-relatorio__periodo", periodo));
    secao.append(topo);

    if (relatorio.resumoExecutivo) {
      secao.append(criar("p", "wr-relatorio__resumo", relatorio.resumoExecutivo));
    }

    const grupos = [
      ["O que mais engajou no campo pró-Bolsonaro", relatorio.campos.bolsonaro || []],
      ["O que mais engajou no campo pró-Lula", relatorio.campos.lula || []]
    ];
    for (const [rotulo, itens] of grupos) {
      const grupo = criar("div", "wr-relatorio__grupo");
      grupo.append(criar("h3", "", rotulo));
      if (!itens.length) {
        grupo.append(criar("p", "wr-relatorio__vazio", "Nenhum conteúdo classificado neste campo foi retornado pela coleta configurada."));
      }
      itens.forEach((item, indice) => {
        const card = criar("article", "wr-relatorio__item");
        const cabecalho = criar("div", "wr-relatorio__item-topo");
        cabecalho.append(
          criar("strong", "", `${indice + 1}. ${item.titulo || "Conteúdo sem título"}`),
          criar("span", "", `${item.plataforma || "Plataforma"} • ${item.formato || "Formato"}`)
        );
        card.append(cabecalho, criar("p", "", item.resumoFactual || "Descrição indisponível."));
        const desempenho = criar("div", "wr-relatorio__metricas");
        desempenho.append(criar("b", "", `${formatarNumero(item.interacoes)} interações públicas`));
        if (item.comentarios) desempenho.append(criar("span", "", `${formatarNumero(item.comentarios)} comentários`));
        if (item.compartilhamentos) desempenho.append(criar("span", "", `${formatarNumero(item.compartilhamentos)} compartilhamentos`));
        card.append(desempenho, criar("p", "wr-relatorio__leitura", item.leituraEngajamento || ""));
        const fonte = criarLinkFonte(item.permalink);
        if (fonte) card.append(fonte);
        grupo.append(card);
      });
      secao.append(grupo);
    }

    const criativos = relatorio.oportunidadesPorFormato || relatorio.conteudosGerados || [];
    if (criativos.length) {
      const bloco = criar("div", "wr-relatorio__criativos");
      bloco.append(criar("h3", "", "Conteúdos gerados a partir dos dados"));
      const grade = criar("div", "wr-relatorio__criativos-grade");
      criativos.forEach((item) => {
        const card = criar("article", "wr-relatorio__criativo");
        card.append(
          criar("span", "", `${item.plataforma} • ${item.formato}`),
          criar("strong", "", item.titulo),
          criar("p", "", item.narrativa || item.gancho),
          criar("div", "wr-relatorio__roteiro", item.desenvolvimento || item.roteiro28s),
          criar("b", "", `CTA: ${item.cta}`),
          criar("small", "", item.hipoteseTeste || "")
        );
        grade.append(card);
      });
      bloco.append(grade);
      secao.append(bloco);
    }

    if (Array.isArray(relatorio.limitacoes) && relatorio.limitacoes.length) {
      const detalhes = document.createElement("details");
      detalhes.className = "wr-relatorio__limitacoes";
      detalhes.append(criar("summary", "", "Cobertura e limitações dos dados"));
      const lista = document.createElement("ul");
      relatorio.limitacoes.forEach((item) => lista.append(criar("li", "", item)));
      detalhes.append(lista);
      secao.append(detalhes);
    }
    return secao;
  }

  function montarOperacao(dados) {
    const temTrending = Array.isArray(dados.trending) && dados.trending.length;
    const pilares = Array.isArray(dados.estrategia?.pilares) ? dados.estrategia.pilares : [];
    if (!temTrending && !pilares.length && !dados.roteiro) return null;

    const secao = criar("section", "wr-v4__live");
    secao.append(criar("h2", "wr-v4__live-titulo", "WAR ROOM • ATUALIZAÇÃO AO VIVO"));

    if (temTrending) {
      const bloco = criar("div", "wr-v4__live-bloco");
      bloco.append(criar("h3", "", "Trending e prioridades"));
      const grade = criar("div", "wr-v4__live-grade");
      for (const item of dados.trending) {
        const card = criar("article", "wr-v4__live-card");
        card.append(
          criar("span", "wr-v4__live-status", item.status || "monitorar"),
          criar("strong", "", item.titulo || "Tema sem título"),
          criar("p", "", item.orientacao || "Sem orientação editorial.")
        );
        if (item.valor) card.append(criar("b", "wr-v4__live-valor", item.valor));
        const fonte = criarLinkFonte(item.fonte);
        if (fonte) card.append(fonte);
        grade.append(card);
      }
      bloco.append(grade);
      secao.append(bloco);
    }

    if (pilares.length) {
      const bloco = criar("div", "wr-v4__live-bloco");
      bloco.append(criar("h3", "", "Pilares da estratégia"));
      const grade = criar("div", "wr-v4__pilares");
      for (const pilar of pilares) {
        const card = criar("article", "wr-v4__pilar");
        card.append(
          criar("span", "", pilar.selo || "PILAR"),
          criar("strong", "", pilar.titulo),
          criar("p", "", pilar.descricao)
        );
        if (/PLATAFORMAS E FORMATOS PRIORITÁRIOS/i.test(pilar.titulo || "")) {
          card.append(
            criar(
              "div",
              "wr-v4__pilar-destaque",
              "Reels 45% + Figurinha 25% = 70% do alcance. Foco total."
            )
          );
        }
        grade.append(card);
      }
      bloco.append(grade);
      secao.append(bloco);
    }

    if (dados.roteiro?.texto) {
      const roteiro = criar("article", "wr-v4__roteiro");
      roteiro.append(
        criar("span", "", `ROTEIRO ZAP • ${dados.roteiro.duracaoSegundos || 28}s • ${dados.roteiro.modelo || "OpenAI"}`),
        criar("h3", "", dados.roteiro.titulo || "Roteiro automático"),
        criar("p", "", dados.roteiro.texto),
        criar("strong", "", dados.roteiro.chamadaFinal || ""),
        criar("small", "", dados.roteiro.alertaEditorial || "")
      );
      secao.append(roteiro);
    }

    return secao;
  }

  function montarPainel(dados) {
    let painel = document.getElementById("war-room-dados-v4");
    if (!painel) {
      painel = criar("section", "wr-v4");
      painel.id = "war-room-dados-v4";
      const raiz = document.getElementById("root");
      document.body.insertBefore(painel, raiz || document.body.firstChild);
    }

    painel.replaceChildren();

    const topo = criar("div", "wr-v4__topo");
    const titulo = criar("div");
    titulo.append(criar("span", "wr-v4__selo", "DADOS OFICIAIS • ATUALIZAÇÃO AUTOMÁTICA"));
    titulo.append(criar("h2", "wr-v4__titulo", "PAINEL MASTER v4 • AGORA DINÂMICO"));
    const atualizado = criar("p", "wr-v4__atualizado");
    const data = dados.atualizadoEm ? new Date(dados.atualizadoEm) : null;
    texto(
      atualizado,
      data && !Number.isNaN(data.getTime())
        ? `Atualizado em ${data.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
        : "Atualização pendente"
    );
    topo.append(titulo, atualizado);

    const rodape = criar("div", "wr-v4__rodape");
    rodape.append(criar("span", "", dados.estrategia?.prioridade || "Uma informação verificável por peça."));
    rodape.append(criar("span", "wr-v4__pulso", "Consulta dados a cada 30s"));

    painel.append(topo, rodape);

    const operacao = montarOperacao(dados);
    if (operacao) painel.append(operacao);

    const relatorio = montarRelatorioQuatroSemanas(dados);
    if (relatorio) painel.append(relatorio);

    const metaGraph = montarMetaGraph(dados);
    if (metaGraph) painel.append(metaGraph);

    const raizLegada = document.getElementById("root");
    if (raizLegada) {
      const textos = document.createTreeWalker(raizLegada, NodeFilter.SHOW_TEXT);
      let no;
      while ((no = textos.nextNode())) {
        if (/PAINEL MASTER FINAL v3/i.test(no.nodeValue || "")) {
          no.nodeValue = no.nodeValue.replace(/PAINEL MASTER FINAL v3/gi, "PAINEL MASTER FINAL v4");
        }
      }
    }
  }

  function mostrarErro() {
    let aviso = document.getElementById("war-room-dados-v4");
    if (!aviso) {
      aviso = criar("section", "wr-v4 wr-v4--erro", "Dados automáticos temporariamente indisponíveis. O restante do painel continua funcionando.");
      aviso.id = "war-room-dados-v4";
      const raiz = document.getElementById("root");
      document.body.insertBefore(aviso, raiz || document.body.firstChild);
    }
  }

  async function carregar() {
    try {
      const resposta = await fetch(`./dados.json?v=${Date.now()}`, { cache: "no-store" });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      dadosAtuais = await resposta.json();
      montarPainel(dadosAtuais);
      agendarMonitoramento();
    } catch (erro) {
      console.error("Falha ao carregar dados.json", erro);
      mostrarErro();
    }
  }

  const estilo = document.createElement("style");
  estilo.textContent = `
    .wr-v4{background:#0a0a0b;color:#f7f7f4;border-bottom:1px solid #2a2a2f;padding:18px 28px;font-family:Inter,system-ui,sans-serif}
    .wr-v4__topo{max-width:1200px;margin:auto;display:flex;align-items:end;justify-content:space-between;gap:20px}
    .wr-v4__selo{display:inline-block;color:#0a0a0b;background:#ffd400;border-radius:999px;padding:5px 9px;font:700 10px/1 ui-monospace,monospace;letter-spacing:.08em}
    .wr-v4__titulo{margin:10px 0 0;font-size:clamp(20px,3vw,34px);line-height:1}
    .wr-v4__atualizado{color:#a8a8ad;font:12px/1.4 ui-monospace,monospace;text-align:right}
    .wr-v4__rodape{max-width:1200px;margin:12px auto 0;display:flex;justify-content:space-between;gap:16px;color:#bcbcc2;font-size:12px}
    .wr-v4__pulso{color:#62e6b5;white-space:nowrap}
    .wr-v4__live{max-width:1200px;margin:18px auto 0;border-top:1px solid #2a2a2f;padding-top:18px}
    .wr-v4__live-titulo{margin:0 0 16px;color:#ffd400;font:800 13px/1 ui-monospace,monospace;letter-spacing:.06em}
    .wr-v4__live-bloco{margin-top:16px}.wr-v4__live-bloco>h3{margin:0 0 9px;color:#a8a8ad;font:700 11px/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em}
    .wr-v4__live-grade{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .wr-v4__live-card{display:flex;flex-direction:column;gap:7px;background:#151517;border:1px solid #2a2a2f;border-radius:12px;padding:12px}
    .wr-v4__live-card strong{font-size:13px}.wr-v4__live-card p{margin:0;color:#bdbdc3;font-size:11px;line-height:1.45}
    .wr-v4__live-status{align-self:flex-start;color:#0a0a0b;background:#62e6b5;border-radius:999px;padding:4px 7px;font:800 9px/1 ui-monospace,monospace;text-transform:uppercase}
    .wr-v4__live-valor{color:#ffd400;font-size:15px}.wr-v4__fonte{color:#ffd400;font-size:10px;text-decoration:underline}
    .wr-v4__pilares{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .wr-v4__pilar{background:linear-gradient(135deg,#201d09,#151517 55%);border:1px solid #504512;border-radius:12px;padding:14px}
    .wr-v4__pilar span{color:#ffd400;font:800 9px/1 ui-monospace,monospace}.wr-v4__pilar strong{display:block;margin-top:7px;font-size:17px}.wr-v4__pilar p{margin:7px 0 0;color:#c9c9cd;font-size:11px;line-height:1.45}
    .wr-v4__pilar-destaque{margin-top:12px;padding:10px 12px;background:#ffd400;color:#0a0a0b;border-radius:9px;font:800 11px/1.45 ui-monospace,monospace;text-align:center}
    .wr-v4__roteiro{margin-top:16px;background:#101c18;border:1px solid #245d4a;border-radius:12px;padding:15px}
    .wr-v4__roteiro>span{color:#62e6b5;font:800 9px/1 ui-monospace,monospace;letter-spacing:.06em}.wr-v4__roteiro h3{margin:8px 0;font-size:16px}.wr-v4__roteiro p{margin:0;color:#e4eee9;font-size:13px;line-height:1.55}.wr-v4__roteiro strong,.wr-v4__roteiro small{display:block;margin-top:9px}.wr-v4__roteiro small{color:#9ca9a3;font-size:10px}
    .wr-v4__social{max-width:1200px;margin:18px auto 0;border-top:1px solid #2a2a2f;padding-top:18px}
    .wr-v4__social-topo{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:14px}
    .wr-v4__social-topo h2{font-size:clamp(18px,2.4vw,26px);margin:8px 0 0}
    .wr-v4__social-selo{color:#62e6b5;font:700 10px/1 ui-monospace,monospace;letter-spacing:.08em}
    .wr-v4__social-atualizado{color:#8f8f96;font:11px/1.4 ui-monospace,monospace;text-align:right}
    .wr-relatorio{margin-top:18px;padding:22px;background:#111113;border:1px solid #303036;border-radius:20px;color:#f7f7f4}
    .wr-relatorio__topo{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.wr-relatorio__topo h2{margin:7px 0 0;font-size:22px}.wr-relatorio__selo{color:#ffd400;font:800 9px/1 ui-monospace,monospace;letter-spacing:.08em}.wr-relatorio__periodo{padding:7px 10px;background:#202024;border-radius:999px;color:#d7d7da;font:700 10px/1 ui-monospace,monospace;white-space:nowrap}
    .wr-relatorio__resumo{margin:18px 0 0;padding:15px;background:#18181b;border-left:3px solid #ffd400;border-radius:10px;color:#d8d8dc;font-size:13px;line-height:1.6}
    .wr-relatorio__grupo{margin-top:24px}.wr-relatorio__grupo h3,.wr-relatorio__criativos h3{margin:0 0 12px;color:#ffd400;font-size:17px}.wr-relatorio__item{padding:16px 0;border-top:1px solid #29292e}.wr-relatorio__grupo h3+.wr-relatorio__item{border-top:0}.wr-relatorio__item-topo{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.wr-relatorio__item-topo strong{font-size:14px;line-height:1.45}.wr-relatorio__item-topo span{flex:none;color:#9d9da5;font:10px/1.3 ui-monospace,monospace}.wr-relatorio__item>p{margin:8px 0 0;color:#c7c7cd;font-size:12px;line-height:1.55}.wr-relatorio__item .wr-relatorio__leitura{color:#9fa0a7}.wr-relatorio__metricas{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.wr-relatorio__metricas>*{padding:5px 7px;background:#202024;border-radius:7px;color:#dedee2;font:700 9px/1 ui-monospace,monospace}.wr-relatorio__vazio{padding:14px;border:1px dashed #3a3a40;border-radius:10px;color:#9b9ba3;font-size:12px}
    .wr-relatorio__criativos{margin-top:25px;padding-top:20px;border-top:1px solid #303036}.wr-relatorio__criativos-grade{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.wr-relatorio__criativo{padding:15px;background:#0c1713;border:1px solid #245d4a;border-radius:13px}.wr-relatorio__criativo>span{color:#62e6b5;font:800 9px/1 ui-monospace,monospace}.wr-relatorio__criativo>strong{display:block;margin-top:8px;font-size:14px}.wr-relatorio__criativo>p{margin:8px 0;color:#c2d2cb;font-size:12px}.wr-relatorio__roteiro{padding:11px;background:#111f1a;border-radius:9px;color:#e7f1ed;font-size:12px;line-height:1.55}.wr-relatorio__criativo>b{display:block;margin-top:9px;color:#62e6b5;font-size:11px}.wr-relatorio__limitacoes{margin-top:18px;color:#9e9ea6;font-size:11px}.wr-relatorio__limitacoes summary{cursor:pointer}.wr-relatorio__limitacoes li{margin-top:6px;line-height:1.5}
    .wr-oportunidades{margin:0 0 16px}.wr-oportunidades__topo{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;color:#9c9ca3;font:700 9px/1.3 ui-monospace,monospace;letter-spacing:.05em}.wr-oportunidades__topo strong{color:#ffd400}.wr-oportunidades__grade{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.wr-oportunidades__card{padding:14px;background:#0d1512;border:1px solid #245d4a;border-radius:13px}.wr-oportunidades__formato{display:inline-block;color:#0a0a0b;background:#62e6b5;border-radius:999px;padding:4px 7px;font:900 9px/1 ui-monospace,monospace}.wr-oportunidades__card h3{margin:9px 0 0;font-size:14px;line-height:1.35}.wr-oportunidades__card p{margin:7px 0 0;color:#c5d1cb;font-size:11px;line-height:1.5}.wr-oportunidades__card .wr-oportunidades__narrativa{color:#f7f7f4;font-size:12px}.wr-oportunidades__card b,.wr-oportunidades__card small,.wr-oportunidades__card em{display:block;margin-top:8px}.wr-oportunidades__card b{color:#62e6b5;font-size:11px}.wr-oportunidades__card small,.wr-oportunidades__card em{color:#8f9d96;font-size:9px;line-height:1.4}.wr-oportunidades__fontes{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.wr-oportunidades__fontes a{color:#ffd400;font:800 9px/1 ui-monospace,monospace}.wr-oportunidades__vazio{margin:0;padding:14px;border:1px dashed #4d4316;border-radius:10px;color:#b9b5a5;font:11px/1.5 ui-monospace,monospace}
    .wr-v4__social-grade{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .wr-v4__social-card{min-width:0;overflow:hidden;background:#151517;border:1px solid #2a2a2f;border-radius:14px}
    .wr-v4__social-card-topo{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px}
    .wr-v4__social-conta{display:flex;align-items:center;gap:8px;min-width:0}
    .wr-v4__social-conta img{width:30px;height:30px;flex:none;border-radius:50%;object-fit:cover;background:#26262b}
    .wr-v4__social-conta div{min-width:0}
    .wr-v4__social-conta strong,.wr-v4__social-conta small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .wr-v4__social-conta strong{font-size:12px}.wr-v4__social-conta small{color:#8f8f96;font-size:10px;margin-top:2px}
    .wr-v4__social-posicao{color:#0a0a0b;background:#ffd400;border-radius:999px;padding:4px 7px;font:800 10px/1 ui-monospace,monospace}
    .wr-v4__social-midia,.wr-v4__social-sem-midia{position:relative;aspect-ratio:16/10;background:#09090a;border-block:1px solid #26262b}
    .wr-v4__social-midia img,.wr-v4__social-midia video{width:100%;height:100%;display:block;object-fit:cover;background:#09090a}
    .wr-v4__social-sem-midia{display:grid;place-items:center;color:#6f6f76;font:700 11px/1 ui-monospace,monospace;letter-spacing:.08em}
    .wr-v4__social-legenda{display:-webkit-box;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:3;min-height:54px;margin:12px;color:#dedee2;font-size:12px;line-height:1.5}
    .wr-v4__social-metricas{display:flex;flex-wrap:wrap;gap:5px;padding:0 12px;color:#aaaab1;font-size:10px}
    .wr-v4__social-metrica{background:#202024;border-radius:999px;padding:5px 7px}.wr-v4__social-metrica strong{color:#f7f7f4}
    .wr-v4__social-link{display:block;margin:11px 12px 13px;color:#ffd400;font-size:11px;text-decoration:underline}
    .wr-v4__social-nota{margin:10px 0 0;color:#7f7f86;font:10px/1.5 ui-monospace,monospace}
    .wr-trending{grid-column:span 8/span 8;min-width:0;padding:20px;background:#131315;border:1px solid #27272c;border-radius:20px;color:#f7f7f4}
    .wr-trending__topo{display:flex;align-items:start;justify-content:space-between;gap:16px;margin-bottom:18px}
    .wr-trending__topo h2{margin:0;font-size:18px;line-height:1.25}.wr-trending__topo small{display:block;margin-top:6px;color:#8f8f96;font:10px/1.4 ui-monospace,monospace;text-transform:uppercase}
    .wr-trending__total{flex:none;padding:7px 10px;background:#202024;border-radius:999px;font:700 10px/1 ui-monospace,monospace}
    .wr-trending__filtros{display:flex;flex-wrap:wrap;gap:7px;padding-bottom:12px}.wr-trending__filtros--formato{padding-top:12px;border-top:1px solid #27272c}
    .wr-trending__filtro{appearance:none;padding:8px 12px;background:#0a0a0b;border:1px solid #2b2b31;border-radius:999px;color:#a7a7ae;font:11px/1 ui-monospace,monospace;cursor:pointer}
    .wr-trending__filtro:hover{border-color:#5a5a62;color:#fff}.wr-trending__filtro.is-active{background:#ffd400;border-color:#ffd400;color:#0a0a0b;font-weight:800}
    .wr-trending__filtros--formato .wr-trending__filtro.is-active{background:#f7f7f4;border-color:#f7f7f4}
    .wr-trending__lista{display:grid;gap:11px;margin-top:4px}.wr-trending__item{display:grid;grid-template-columns:130px minmax(260px,1fr) minmax(145px,auto) 150px;align-items:center;gap:14px;padding:12px;background:#0b0b0d;border:1px solid #25252a;border-radius:13px}
    .wr-trending__lateral{position:relative;min-width:0}.wr-trending__lateral .wr-v4__social-midia,.wr-trending__lateral .wr-v4__social-sem-midia{width:130px;aspect-ratio:16/10;overflow:hidden;border:1px solid #29292e;border-radius:10px}.wr-trending__rank{position:absolute;z-index:2;top:5px;left:5px;width:28px;height:28px;display:grid;place-items:center;background:#ffd400;color:#09090a;border-radius:50%;font:900 10px/1 ui-monospace,monospace;box-shadow:0 2px 10px #0008}
    .wr-trending__conteudo{min-width:0}.wr-trending__conteudo>a,.wr-trending__conteudo>strong{display:block;color:#f7f7f4;font-size:13px;font-weight:800;line-height:1.35;text-decoration:none}.wr-trending__conteudo>a:hover{color:#ffd400}
    .wr-trending__meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.wr-trending__meta span{padding:4px 6px;background:#1b1b1f;border-radius:6px;color:#9a9aa2;font:9px/1 ui-monospace,monospace}
    .wr-trending__leitura{margin-top:8px}.wr-trending__leitura p{margin:4px 0 0;color:#aaaab1;font-size:10px;line-height:1.45}.wr-trending__leitura p:last-child{color:#d0d0d5}
    .wr-trending__metricas{display:grid;gap:6px}.wr-trending__metrica{padding:7px 8px;background:#17171a;border-radius:8px}.wr-trending__metricas strong,.wr-trending__metricas small{display:block}.wr-trending__metricas strong{font-size:14px}.wr-trending__metricas small{margin-top:3px;color:#86868e;font-size:8px;line-height:1.25}
    .wr-trending__tendencia{display:flex;align-items:center;gap:7px}.wr-trending__tendencia>span{min-width:42px;font:800 10px/1 ui-monospace,monospace;text-align:right}.wr-trending__tendencia .is-up{color:#62e6b5}.wr-trending__tendencia .is-down{color:#ff6b6b}
    .wr-trending__grafico{width:100px;height:42px}.wr-trending__grafico-base{stroke:#29292e;stroke-width:1}.wr-trending__grafico-linha{fill:none;stroke:#ff3158;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
    .wr-trending__vazio{margin:0;padding:18px;border:1px dashed #3a3a40;border-radius:12px;color:#a8a8ad;font:11px/1.5 ui-monospace,monospace}
    .wr-trending__analises{display:grid;gap:20px;margin-top:24px;padding-top:20px;border-top:1px solid #2a2a2f}
    .wr-trending__grupo>h3{margin:0 0 12px;color:#ffd400;font-size:16px;line-height:1.3}
    .wr-trending__analise{display:grid;grid-template-columns:minmax(0,1fr) 170px;gap:18px;padding:15px 0;border-top:1px solid #25252a}.wr-trending__grupo>h3+.wr-trending__analise{border-top:0;padding-top:0}
    .wr-trending__analise-texto h4{margin:0;color:#f7f7f4;font-size:13px;line-height:1.4}.wr-trending__analise-texto p{margin:7px 0 0;color:#bdbdc4;font-size:12px;line-height:1.55}
    .wr-trending__analise-desempenho{display:grid;justify-items:end;align-content:start;gap:5px}.wr-trending__analise-desempenho .wr-trending__grafico{width:150px}.wr-trending__analise-desempenho strong{font-size:10px}.wr-trending__analise-desempenho span{font:800 10px/1 ui-monospace,monospace}.wr-trending__analise-desempenho .is-up{color:#62e6b5}.wr-trending__analise-desempenho .is-down{color:#ff6b6b}
    .wr-monitor__insight{margin:0 0 16px!important}
    .wr-monitor{margin:0 0 18px;padding:16px;background:#0d0d0f;border:1px solid #303035;border-radius:14px;color:#f7f7f4}
    .wr-monitor__topo{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:12px}
    .wr-monitor__topo h3{margin:0;color:#f7f7f4;font:800 13px/1.25 ui-monospace,monospace;letter-spacing:.04em}
    .wr-monitor__topo span{color:#8f8f96;font:9px/1.25 ui-monospace,monospace;letter-spacing:.05em}
    .wr-monitor__tabela{overflow:hidden;border:1px solid #25252a;border-radius:10px}
    .wr-monitor__linha{display:grid;grid-template-columns:minmax(110px,1.15fr) repeat(3,minmax(105px,1fr));align-items:center;gap:8px;padding:10px 12px;border-top:1px solid #25252a}
    .wr-monitor__linha:first-child{border-top:0}.wr-monitor__cabecalho{background:#18181b;color:#929299;font:700 9px/1 ui-monospace,monospace;text-transform:uppercase}
    .wr-monitor__formato{font-size:12px}.wr-monitor__valor strong,.wr-monitor__valor small{display:block}.wr-monitor__valor strong{font-size:15px}.wr-monitor__valor small{margin-top:2px;color:#8f8f96;font-size:9px}
    .wr-monitor__linha .wr-monitor__valor:nth-child(2) strong{color:#ff6b6b}.wr-monitor__linha .wr-monitor__valor:nth-child(3) strong{color:#62e6b5}.wr-monitor__linha .wr-monitor__valor:nth-child(4) strong{color:#ffd400}
    .wr-monitor__vazio{margin:0;padding:14px;border:1px dashed #38383e;border-radius:10px;color:#a8a8ad;font:11px/1.5 ui-monospace,monospace}
    .wr-v4--erro{color:#ffcc66;font-size:13px}
    @media(max-width:1050px){.wr-trending__item{grid-template-columns:120px minmax(230px,1fr) minmax(135px,auto)}.wr-trending__tendencia{grid-column:2/-1}.wr-trending__lateral .wr-v4__social-midia,.wr-trending__lateral .wr-v4__social-sem-midia{width:120px}.wr-trending__grafico{width:150px}}
    @media(max-width:900px){.wr-v4__social-grade,.wr-v4__live-grade{grid-template-columns:repeat(2,minmax(0,1fr))}.wr-trending__item{grid-template-columns:120px minmax(0,1fr)}.wr-trending__metricas{grid-column:2;grid-template-columns:repeat(3,minmax(0,1fr))}.wr-trending__tendencia{grid-column:2}.wr-trending__grafico{width:130px}}
    @media(max-width:760px){.wr-v4{padding:16px}.wr-v4__topo,.wr-v4__rodape,.wr-v4__social-topo,.wr-monitor__topo,.wr-trending__topo,.wr-relatorio__topo,.wr-relatorio__item-topo,.wr-oportunidades__topo{align-items:flex-start;flex-direction:column}.wr-v4__atualizado,.wr-v4__social-atualizado{text-align:left}.wr-v4__social-grade,.wr-v4__live-grade,.wr-v4__pilares,.wr-relatorio__criativos-grade,.wr-oportunidades__grade{grid-template-columns:1fr}.wr-monitor__tabela{overflow-x:auto}.wr-monitor__linha{min-width:540px}.wr-trending{grid-column:1/-1;padding:15px}.wr-trending__item{grid-template-columns:1fr}.wr-trending__lateral,.wr-trending__lateral .wr-v4__social-midia,.wr-trending__lateral .wr-v4__social-sem-midia{width:100%}.wr-trending__lateral .wr-v4__social-midia,.wr-trending__lateral .wr-v4__social-sem-midia{aspect-ratio:16/9}.wr-trending__metricas,.wr-trending__tendencia{grid-column:1}.wr-trending__metricas{grid-template-columns:1fr}.wr-trending__total{white-space:nowrap}.wr-trending__analise{grid-template-columns:1fr}.wr-trending__analise-desempenho{justify-items:start}.wr-trending__analise-desempenho .wr-trending__grafico{width:min(100%,220px)}}
  `;
  document.head.append(estilo);

  new MutationObserver(agendarMonitoramento).observe(document.body, { childList: true, subtree: true });

  carregar();
  window.setInterval(carregar, INTERVALO);
})();
