// Grupo PowerMetrics · comportamento do site (todas as páginas).
// Efeitos com referência no Kinetics (kinetics.colorion.co): Momentum Marquee (CSS), Odometer Count-up,
// Stagger Entrance, Packet Trace (fios), Accordion Spring (curvas de mola), Magnetic Button.
(() => {
  'use strict';
  const raiz = document.documentElement;
  const reduzido = raiz.classList.contains('reduzido');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const reiniciar = (el, classe) => { el.classList.remove(classe); void el.offsetWidth; el.classList.add(classe); };
  const topoH = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--topo-h')) || 76;
  const mouseFino = matchMedia('(hover: hover) and (pointer: fine)').matches;
  window.__siteOk = true;

  // ---------- topo: fica sólido e mostra o botão quando a abertura termina ----------
  const abertura = $('.abertura');
  function estadoTopo() {
    const y = scrollY;
    const fim = abertura ? abertura.offsetTop + abertura.offsetHeight - innerHeight * 0.6 : 0;
    raiz.classList.toggle('passou', abertura ? y > fim : y > 160);
    raiz.classList.toggle('topo-solido', abertura ? y > fim : y > 10);
  }
  addEventListener('scroll', estadoTopo, { passive: true });
  addEventListener('resize', estadoTopo);
  estadoTopo();

  // submenu "Frentes": abre no hover (CSS), no clique e no teclado
  const sub = $('.tem-sub');
  if (sub) {
    const botao = $('[data-sub]', sub);
    const abrir = (sim) => { sub.classList.toggle('aberto', sim); botao.setAttribute('aria-expanded', String(sim)); };
    botao.addEventListener('click', () => abrir(!sub.classList.contains('aberto')));
    sub.addEventListener('mouseleave', () => abrir(false));
    sub.addEventListener('focusout', (e) => { if (!sub.contains(e.relatedTarget)) abrir(false); });
    $$('a', sub).forEach((a) => a.addEventListener('click', () => abrir(false)));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && sub.classList.contains('aberto')) { abrir(false); botao.focus(); } });
  }

  // menu do celular
  const menuBotao = $('[data-menu]');
  const menu = $('#menu-celular');
  if (menuBotao && menu) {
    const abrirMenu = (sim) => {
      menu.hidden = !sim;
      raiz.classList.toggle('menu-aberto', sim);
      menuBotao.setAttribute('aria-expanded', String(sim));
      menuBotao.setAttribute('aria-label', sim ? 'Fechar menu' : 'Abrir menu');
    };
    menuBotao.addEventListener('click', () => abrirMenu(menu.hidden));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => abrirMenu(false)));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { abrirMenu(false); menuBotao.focus(); } });
    matchMedia('(min-width: 1024px)').addEventListener('change', (m) => { if (m.matches) abrirMenu(false); });
  }

  // ---------- entrada ao rolar (Kinetics · Stagger Entrance) ----------
  $$('[data-revelar-grupo]').forEach((grupo) => {
    $$(':scope > [data-revelar]', grupo).forEach((el, i) => el.style.setProperty('--i', String(i % 6)));
  });
  const ioRevelar = new IntersectionObserver((entradas) => {
    for (const e of entradas) if (e.isIntersecting) { e.target.classList.add('visivel'); ioRevelar.unobserve(e.target); }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
  $$('[data-revelar]').forEach((el) => ioRevelar.observe(el));

  // ---------- números (Kinetics · Odometer Count-up) ----------
  const ioContar = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      ioContar.unobserve(e.target);
      const el = e.target, alvo = Number(el.dataset.contar);
      if (reduzido) { el.textContent = String(alvo); continue; }
      const t0 = performance.now();
      const passo = (t) => {
        const p = clamp((t - t0) / 1400, 0, 1);
        el.textContent = String(Math.round(alvo * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    }
  }, { threshold: 0.6 });
  $$('[data-contar]').forEach((el) => {
    el.style.minWidth = `${el.dataset.contar.length}ch`;
    if (!reduzido) el.textContent = '0';
    ioContar.observe(el);
  });

  // ---------- frases do dono: a que passa pelo meio da tela acende ----------
  $$('[data-foco]').forEach((lista) => {
    if (reduzido) return;
    const itens = $$('.frase', lista);
    let visivel = false, atual = null;
    const atualizar = () => {
      const meio = innerHeight * 0.5;
      let melhor = null, dist = Infinity;
      for (const it of itens) {
        const r = it.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - meio);
        if (d < dist) { dist = d; melhor = it; }
      }
      if (dist > innerHeight * 0.38) melhor = null;
      if (melhor !== atual) { atual?.classList.remove('foco'); atual = melhor; atual?.classList.add('foco'); }
    };
    new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) atualizar(); }).observe(lista);
    addEventListener('scroll', () => { if (visivel) atualizar(); }, { passive: true });
  });

  // ---------- frentes: o anel gira até a frente escolhida ficar embaixo, ligada à ficha ----------
  const dial = $('[data-dial]');
  let selecionarFrente = () => {};
  if (dial) {
    const roda = $('.dial-roda', dial);
    const rotulos = $$('[role="tab"]', dial);
    const arcos = $$('.arco', dial);
    const fichas = rotulos.map((b) => document.getElementById(b.getAttribute('aria-controls')));
    const nEl = $('.dial-n', dial), verboEl = $('.dial-verbo', dial);
    let atual = -1, giro = 0;
    const girarPara = (i, extra = 0) => {
      const alvo = 90 - (-90 + i * 72); // ângulo do arco i no SVG: -90° + 72°·i; 90° = embaixo
      giro += (((alvo - giro) % 360) + 540) % 360 - 180 + extra;
      roda.style.setProperty('--giro', `${giro}deg`);
    };
    selecionarFrente = (i, focar = false) => {
      i = (i + rotulos.length) % rotulos.length;
      if (focar) rotulos[i].focus();
      if (i === atual) return;
      atual = i;
      rotulos.forEach((b, j) => {
        const sel = j === i;
        b.setAttribute('aria-selected', String(sel));
        b.tabIndex = sel ? 0 : -1;
        fichas[j].hidden = !sel;
      });
      arcos.forEach((a, j) => a.classList.toggle('aceso', j === i));
      girarPara(i);
      nEl.textContent = rotulos[i].dataset.frente;
      verboEl.textContent = rotulos[i].dataset.verbo;
      reiniciar(nEl, 'troca');
      reiniciar(verboEl, 'troca');
      reiniciar(fichas[i], 'anima');
    };
    rotulos.forEach((b, i) => b.addEventListener('click', () => selecionarFrente(i)));
    arcos.forEach((a, i) => a.addEventListener('click', () => selecionarFrente(i)));
    $('[role="tablist"]', dial).addEventListener('keydown', (e) => {
      const mapa = { ArrowRight: atual + 1, ArrowDown: atual + 1, ArrowLeft: atual - 1, ArrowUp: atual - 1, Home: 0, End: rotulos.length - 1 };
      if (e.key in mapa) { e.preventDefault(); selecionarFrente(mapa[e.key], true); }
    });
    // começa uma volta atrás, sem transição; ao aparecer na tela, o anel dá uma volta e para na Consultoria
    roda.style.transition = 'none';
    selecionarFrente(0);
    giro -= 360;
    roda.style.setProperty('--giro', `${giro}deg`);
    void roda.offsetWidth;
    roda.style.transition = '';
    const ioDial = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      ioDial.disconnect();
      if (!reduzido) roda.style.transition = '--giro 1.8s cubic-bezier(.65, 0, .35, 1)';
      giro += 360;
      roda.style.setProperty('--giro', `${giro}deg`);
      setTimeout(() => { roda.style.transition = ''; }, 1900);
    }, { threshold: 0.4 });
    ioDial.observe(dial);
  }

  // ---------- na prática: esteira horizontal guiada pela rolagem (desktop) ----------
  const pratica = $('.pratica');
  if (pratica) {
    const esteira = $('.esteira', pratica);
    const estacoes = $$('.estacao', esteira);
    const nos = $$('.pratica-nos li', pratica);
    const modo = matchMedia('(min-width: 900px) and (min-height: 620px)');
    let ativo = false, visivel = false, centros = [];
    const atualizar = () => {
      if (!ativo) return;
      const faixa = Math.max(1, pratica.offsetHeight - innerHeight);
      const p = clamp((scrollY - pratica.offsetTop) / faixa, 0, 1);
      const c = p * (estacoes.length - 1);
      const i0 = Math.floor(c), i1 = Math.min(estacoes.length - 1, i0 + 1), f = c - i0;
      const centro = centros[i0] + (centros[i1] - centros[i0]) * f;
      esteira.style.setProperty('--x', `${(innerWidth / 2 - centro).toFixed(1)}px`);
      estacoes.forEach((e, i) => {
        const d = Math.min(1, Math.abs(i - c));
        e.style.setProperty('--s', (1 - d * 0.14).toFixed(3));
        e.style.setProperty('--o', (1 - d * 0.6).toFixed(3));
        e.classList.toggle('aceso', Math.abs(i - c) < 0.5);
      });
      const ia = Math.round(c); // estação 0 é a abertura; as frentes são 1 a 5
      nos.forEach((no, k) => { no.classList.toggle('atual', k + 1 === ia); no.classList.toggle('aceso', k + 1 < ia); });
      pratica.classList.toggle('no-fim', p > 0.96);
    };
    const medir = () => {
      if (!ativo) return;
      pratica.style.height = `${Math.round(innerHeight + (estacoes.length - 1) * innerHeight * 0.6)}px`;
      centros = estacoes.map((e) => e.offsetLeft + e.offsetWidth / 2);
      atualizar();
    };
    const ligar = () => {
      ativo = modo.matches && !reduzido;
      pratica.classList.toggle('esteira-ativa', ativo);
      if (!ativo) {
        pratica.style.height = '';
        esteira.style.removeProperty('--x');
        estacoes.forEach((e) => { e.style.removeProperty('--s'); e.style.removeProperty('--o'); });
        if (reduzido) estacoes.forEach((e) => e.classList.add('aceso'));
      }
      medir();
    };
    // no modo vertical (celular), cada estação acende quando entra na tela
    const ioEstacao = new IntersectionObserver((entradas) => {
      if (ativo || reduzido) return;
      for (const e of entradas) e.target.classList.toggle('aceso', e.isIntersecting);
    }, { threshold: 0.4 });
    estacoes.forEach((e) => ioEstacao.observe(e));
    new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) atualizar(); }).observe(pratica);
    addEventListener('scroll', () => { if (visivel) atualizar(); }, { passive: true });
    addEventListener('resize', medir);
    modo.addEventListener('change', ligar);
    document.fonts?.ready.then(medir);
    ligar();
  }

  // ---------- depoimentos: uma frase por vez, como stories ----------
  const depoSecao = $('[data-depoimentos]');
  if (depoSecao) {
    const depos = $$('.depo', depoSecao);
    const barras = $$('.depo-barras > i', depoSecao);
    const contador = $('.depo-contador b', depoSecao);
    depos.forEach((d) => {
      const p = $('blockquote p', d);
      const palavras = p.textContent.trim().split(/\s+/);
      p.textContent = '';
      palavras.forEach((w, i) => {
        const s = document.createElement('span');
        s.className = 'palavra';
        s.style.setProperty('--i', String(i));
        s.textContent = w;
        p.append(s, ' ');
      });
    });
    let atual = 0, emVista = false;
    const mostrar = (i) => {
      atual = (i + depos.length) % depos.length;
      depos.forEach((d, j) => d.classList.toggle('ativo', j === atual));
      barras.forEach((b, j) => { b.classList.toggle('feita', j < atual); b.classList.remove('atual'); });
      reiniciar(barras[atual], 'atual');
      contador.textContent = String(atual + 1);
    };
    barras.forEach((b) => b.firstElementChild.addEventListener('animationend', () => { if (emVista && !reduzido) mostrar(atual + 1); }));
    $$('[data-depo]', depoSecao).forEach((b) => b.addEventListener('click', () => mostrar(atual + Number(b.dataset.depo))));
    const pausa = (sim) => depoSecao.classList.toggle('pausado', sim || !emVista);
    depoSecao.addEventListener('mouseenter', () => pausa(true));
    depoSecao.addEventListener('mouseleave', () => pausa(false));
    depoSecao.addEventListener('focusin', () => pausa(true));
    depoSecao.addEventListener('focusout', () => pausa(false));
    new IntersectionObserver(([e]) => { emVista = e.isIntersecting; pausa(false); }, { threshold: 0.35 }).observe(depoSecao);
    if (reduzido) depoSecao.classList.add('sem-auto');
    mostrar(0);
  }

  // ---------- perguntas: vira uma conversa ----------
  const conversa = $('[data-conversa]');
  if (conversa) {
    const msgs = $('.conversa-msgs', conversa);
    const itens = $$('.faq-item', conversa).map((it) => ({ p: $('dt', it).textContent.trim(), r: $('dd', it).textContent.trim() }));
    const opcoes = document.createElement('div');
    opcoes.className = 'conversa-opcoes';
    opcoes.setAttribute('role', 'group');
    opcoes.setAttribute('aria-label', 'Perguntas');
    let ocupado = false;
    const rolar = () => msgs.scrollTo({ top: msgs.scrollHeight, behavior: reduzido ? 'instant' : 'smooth' });
    const bolha = (texto, quem) => {
      const p = document.createElement('p');
      p.className = `msg ${quem}`;
      p.textContent = texto;
      msgs.append(p);
      rolar();
    };
    const perguntar = async (i) => {
      if (ocupado) return;
      ocupado = true;
      botoes[i].classList.add('feita');
      bolha(itens[i].p, 'eu');
      await espera(reduzido ? 0 : 320);
      const digitando = document.createElement('p');
      digitando.className = 'msg digitando';
      digitando.setAttribute('aria-label', 'digitando');
      digitando.innerHTML = '<i></i><i></i><i></i>';
      msgs.append(digitando);
      rolar();
      await espera(reduzido ? 0 : 850);
      digitando.remove();
      bolha(itens[i].r, 'pm');
      ocupado = false;
    };
    const botoes = itens.map((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opcao';
      b.textContent = it.p;
      b.addEventListener('click', () => perguntar(i));
      opcoes.append(b);
      return b;
    });
    $('.conversa-janela', conversa).after(opcoes);
    conversa.classList.add('pronta');
    const ioConversa = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting) return;
      ioConversa.disconnect();
      bolha('Oi! Essas são as perguntas que mais chegam pra gente. Toca numa delas.', 'pm');
      await espera(reduzido ? 0 : 900);
      perguntar(0);
    }, { threshold: 0.35 });
    ioConversa.observe(conversa);
  }

  // ---------- lista de artigos: a capa segue o mouse ----------
  if (mouseFino) {
    $$('.linha-artigo').forEach((linha) => {
      const capa = $('.la-capa', linha);
      if (!capa) return;
      linha.addEventListener('mousemove', (e) => {
        const r = linha.getBoundingClientRect();
        capa.style.setProperty("--cx", `${Math.round(e.clientX - r.left - 160)}px`);
        capa.style.setProperty("--cy", `${Math.round(e.clientY - r.top - 90)}px`);
      });
    });
  }

  // ---------- chamada final: o símbolo acende quando a seção aparece ----------
  $$('.cta-luz').forEach((sec) => {
    new IntersectionObserver(([e]) => sec.classList.toggle('acesa', e.isIntersecting), { threshold: 0.2 }).observe(sec);
  });

  // ---------- filtros do blog ----------
  const filtros = $$('.filtro');
  if (filtros.length) {
    const itens = $$('.blog-lista [data-frente]');
    filtros.forEach((f) => f.addEventListener('click', () => {
      filtros.forEach((o) => o.setAttribute('aria-pressed', String(o === f)));
      const v = f.dataset.filtro;
      itens.forEach((c) => { c.hidden = v !== 'todos' && c.dataset.frente !== v; });
    }));
  }

  // ---------- botões com ímã (Kinetics · Magnetic Button) ----------
  if (!reduzido && mouseFino) {
    $$('.ima').forEach((zona) => {
      const botao = $('.btn', zona);
      zona.addEventListener('mousemove', (e) => {
        const r = zona.getBoundingClientRect();
        botao.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * 0.3).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px)`;
      });
      zona.addEventListener('mouseleave', () => { botao.style.transform = ''; });
    });
  }

  // ---------- âncoras: rolagem com desconto do topo; #frente-0N escolhe a frente ----------
  function irPara(alvo, suave) {
    const y = Math.max(0, alvo.getBoundingClientRect().top + scrollY - topoH() - 8);
    const longe = Math.abs(y - scrollY) > innerHeight * 2.5;
    scrollTo({ top: y, behavior: suave && !reduzido && !longe ? 'smooth' : 'instant' });
  }
  function seguirAncora(hash, suave) {
    if (!hash || hash === '#') return false;
    const m = hash.match(/^#frente-0([1-5])$/);
    if (m && dial) { selecionarFrente(Number(m[1]) - 1); irPara(dial, suave); return true; }
    if (hash === '#inicio') { scrollTo({ top: 0, behavior: suave && !reduzido ? 'smooth' : 'instant' }); return true; }
    const alvo = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (alvo) { irPara(alvo, suave); return true; }
    return false;
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('pular-conteudo') || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const hash = a.getAttribute('href');
    if (seguirAncora(hash, true)) { e.preventDefault(); history.replaceState(null, '', hash); }
  });
  if (location.hash) requestAnimationFrame(() => seguirAncora(location.hash, false));
  addEventListener('hashchange', () => seguirAncora(location.hash, true));
})();
