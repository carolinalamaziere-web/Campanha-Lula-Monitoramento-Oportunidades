(function () {
  const INTERVALO = 30 * 1000;
  let dadosAtuais = null;
  let monitoramentoAgendado = false;

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
    for (const item of dados.metaGraph.itens) {
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
      /MONITOR CANAL FORMATO/i.test(elemento.textContent || "")
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

  function agendarMonitoramento() {
    if (monitoramentoAgendado) return;
    monitoramentoAgendado = true;
    window.requestAnimationFrame(() => {
      monitoramentoAgendado = false;
      aprimorarAbaMonitoramento();
      ocultarDestaqueLegadoFormatos();
    });
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
    @media(max-width:900px){.wr-v4__social-grade,.wr-v4__live-grade{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:760px){.wr-v4{padding:16px}.wr-v4__topo,.wr-v4__rodape,.wr-v4__social-topo,.wr-monitor__topo{align-items:flex-start;flex-direction:column}.wr-v4__atualizado,.wr-v4__social-atualizado{text-align:left}.wr-v4__social-grade,.wr-v4__live-grade,.wr-v4__pilares{grid-template-columns:1fr}.wr-monitor__tabela{overflow-x:auto}.wr-monitor__linha{min-width:540px}}
  `;
  document.head.append(estilo);

  new MutationObserver(agendarMonitoramento).observe(document.body, { childList: true, subtree: true });

  carregar();
  window.setInterval(carregar, INTERVALO);
})();
