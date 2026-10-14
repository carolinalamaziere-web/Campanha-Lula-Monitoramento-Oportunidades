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

    const grade = criar("div", "wr-v4__grade");
    for (const indicador of dados.indicadores || []) {
      const card = criar("article", "wr-v4__card");
      card.append(criar("p", "wr-v4__rotulo", indicador.rotulo));
      card.append(criar("strong", "wr-v4__valor", indicador.valor));
      card.append(criar("span", "wr-v4__periodo", indicador.periodo));
      const fonte = criar("a", "wr-v4__fonte", "Fonte oficial ↗");
      fonte.href = indicador.fonte;
      fonte.target = "_blank";
      fonte.rel = "noopener noreferrer";
      card.append(fonte);
      grade.append(card);
    }

    const rodape = criar("div", "wr-v4__rodape");
    rodape.append(criar("span", "", dados.estrategia?.prioridade || "Uma informação verificável por peça."));
    rodape.append(criar("span", "wr-v4__pulso", "Atualiza a cada 5 min"));

    painel.append(topo, grade, rodape);

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
    .wr-v4__grade{max-width:1200px;margin:18px auto 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .wr-v4__card{background:#151517;border:1px solid #2a2a2f;border-radius:14px;padding:15px;display:grid;gap:7px}
    .wr-v4__rotulo{margin:0;color:#bcbcc2;font-size:12px}
    .wr-v4__valor{font-size:22px;color:#ffd400}
    .wr-v4__periodo{font:11px ui-monospace,monospace;color:#8f8f95}
    .wr-v4__fonte{color:#fff;font-size:11px;text-decoration:underline;text-underline-offset:3px}
    .wr-v4__rodape{max-width:1200px;margin:12px auto 0;display:flex;justify-content:space-between;gap:16px;color:#bcbcc2;font-size:12px}
    .wr-v4__pulso{color:#62e6b5;white-space:nowrap}
    .wr-v4--erro{color:#ffcc66;font-size:13px}
    @media(max-width:760px){.wr-v4{padding:16px}.wr-v4__topo,.wr-v4__rodape{align-items:flex-start;flex-direction:column}.wr-v4__atualizado{text-align:left}.wr-v4__grade{grid-template-columns:1fr}}
  `;
  document.head.append(estilo);

  carregar();
  window.setInterval(carregar, INTERVALO);
})();
