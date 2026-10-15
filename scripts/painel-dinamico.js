(function () {
  const INTERVALO = 5 * 60 * 1000;

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
    rodape.append(criar("span", "wr-v4__pulso", "Atualiza a cada 5 min"));

    painel.append(topo, rodape);

    const metaGraph = montarMetaGraph(dados);
    if (metaGraph) painel.append(metaGraph);

    if (Array.isArray(dados.metaIA?.itens) && dados.metaIA.itens.length) {
      const meta = criar("div", "wr-v4__meta");
      const metaTopo = criar("div", "wr-v4__meta-topo");
      metaTopo.append(
        criar("strong", "", "SUGESTÕES META IA • DADOS COM FONTE"),
        criar(
          "span",
          "",
          dados.metaIA.geradoEm
            ? `Gerado em ${new Date(dados.metaIA.geradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
            : dados.metaIA.modelo || "Meta Model API"
        )
      );

      const grade = criar("div", "wr-v4__meta-grade");
      for (const item of dados.metaIA.itens) {
        const card = criar("article", "wr-v4__meta-card");
        card.append(
          criar("h3", "", item.titulo),
          criar("p", "", item.resumoPopular),
          criar("small", "", `Gancho: ${item.ganchoVideo}`)
        );
        if (item.fonte) {
          const fonte = criar("a", "", "Consultar fonte oficial ↗");
          fonte.href = item.fonte;
          fonte.target = "_blank";
          fonte.rel = "noopener noreferrer";
          card.append(fonte);
        }
        grade.append(card);
      }

      meta.append(metaTopo, grade);
      painel.append(meta);
    }

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
      montarPainel(await resposta.json());
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
    .wr-v4__meta{max-width:1200px;margin:18px auto 0;border-top:1px solid #2a2a2f;padding-top:16px}
    .wr-v4__meta-topo{display:flex;justify-content:space-between;gap:16px;color:#a8a8ad;font:11px/1.4 ui-monospace,monospace}
    .wr-v4__meta-topo strong{color:#ffd400}
    .wr-v4__meta-grade{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px}
    .wr-v4__meta-card{background:#151517;border:1px solid #2a2a2f;border-radius:14px;padding:14px}
    .wr-v4__meta-card h3{font-size:14px;margin:0 0 8px}
    .wr-v4__meta-card p{color:#e3e3e6;font-size:13px;line-height:1.45;margin:0 0 9px}
    .wr-v4__meta-card small{display:block;color:#a8a8ad;font-size:11px;line-height:1.4}
    .wr-v4__meta-card a{display:inline-block;color:#ffd400;font-size:11px;margin-top:10px;text-decoration:underline}
    .wr-v4--erro{color:#ffcc66;font-size:13px}
    @media(max-width:900px){.wr-v4__social-grade{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:760px){.wr-v4{padding:16px}.wr-v4__topo,.wr-v4__rodape,.wr-v4__meta-topo,.wr-v4__social-topo{align-items:flex-start;flex-direction:column}.wr-v4__atualizado,.wr-v4__social-atualizado{text-align:left}.wr-v4__meta-grade,.wr-v4__social-grade{grid-template-columns:1fr}}
  `;
  document.head.append(estilo);

  carregar();
  window.setInterval(carregar, INTERVALO);
})();
