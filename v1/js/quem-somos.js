// Quem somos: o símbolo se monta peça por peça enquanto a história passa por cima dele,
// e na equipe o anel gira até a frente de quem está no meio da tela, com um fio ligando os dois.
(() => {
  'use strict';
  const raiz = document.documentElement;
  const reduzido = raiz.classList.contains('reduzido');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reiniciar = (el, classe) => { el.classList.remove(classe); void el.offsetWidth; el.classList.add(classe); };

  // ---------- história ----------
  const historia = $('.historia');
  if (historia) {
    const marcos = $$('.marco', historia);
    const celulas = $$('.historia-palco .chevron-celulas rect', historia);
    const contador = $('.historia-contador b', historia);
    let acesas = 0, visivel = false;
    const acender = (n) => {
      if (n === acesas) return;
      if (n > acesas) for (let i = acesas; i < n; i++) celulas[i].classList.add('acesa');
      else for (let i = n; i < acesas; i++) celulas[i].classList.remove('acesa');
      acesas = n;
      contador.textContent = String(n);
    };
    const centro = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
    const atualizar = () => {
      const meio = innerHeight * 0.5, folga = innerHeight * 0.3;
      const c0 = centro(marcos[0]), cN = centro(marcos[marcos.length - 1]);
      // começa a acender quando o primeiro marco se aproxima do meio e completa quando o último chega lá
      const p = clamp((meio + folga - c0) / Math.max(1, cN - c0 + folga), 0, 1);
      marcos.forEach((m) => m.classList.toggle('ativo', Math.abs(centro(m) - meio) < innerHeight * 0.3));
      acender(Math.round(p * celulas.length));
    };
    if (reduzido) {
      acender(celulas.length);
      marcos.forEach((m) => m.classList.add('ativo'));
    } else {
      new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) atualizar(); }).observe(historia);
      addEventListener('scroll', () => { if (visivel) atualizar(); }, { passive: true });
      addEventListener('resize', () => { if (visivel) atualizar(); });
    }
  }

  // ---------- equipe ----------
  const equipe = $('.equipe');
  if (equipe) {
    const pessoas = $$('.pessoa', equipe);
    const fotos = pessoas.map((p) => $('.pessoa-foto', p));
    const dial = $('.dial-equipe', equipe);
    const roda = $('.dial-roda', dial);
    const arcos = $$('.arco', dial);
    const nEl = $('.dial-n', dial), verboEl = $('.dial-verbo', dial), extraEl = $('.dial-extra', dial);
    const faixa = $$('.equipe-faixa span', equipe);
    const fioSvg = $('.equipe-fio', equipe);
    const linhas = $$('.fio-linha', fioSvg), pulsos = $$('.fio-pulso', fioSvg);
    const NOMES = { '01': 'Consultoria', '02': 'Power BI', '03': 'Aplicativos', '04': 'IA', '05': 'Marketing' };
    const largo = matchMedia('(min-width: 1100px)');
    let foco = null, sobre = null, visivel = false, rodando = false, inicioFio = 0, giro = 0;

    // na grade, as pessoas alternam: ímpares à esquerda do anel, pares à direita
    const naEsquerda = (p) => pessoas.indexOf(p) % 2 === 0;

    const definirFoco = (p) => {
      if (p === foco) return;
      foco?.classList.remove('foco');
      foco = p;
      equipe.classList.toggle('com-foco', Boolean(p));
      const frentes = p ? p.dataset.frentes.split(',') : [];
      arcos.forEach((a) => a.classList.toggle('aceso', frentes.includes(a.dataset.frente)));
      faixa.forEach((s) => s.classList.toggle('acesa', frentes.includes(s.dataset.frente)));
      if (p) {
        p.classList.add('foco');
        nEl.textContent = frentes.join(' · ');
        verboEl.textContent = frentes.map((f) => NOMES[f]).join(' + ');
        extraEl.textContent = p.dataset.especialidade;
        // o anel gira até as frentes da pessoa ficarem viradas pra ela (9h pra quem está à esquerda, 3h à direita).
        // Com duas frentes, mira no meio das duas: assim os dois arcos ficam do lado dela e cada um ganha um fio.
        let sx = 0, sy = 0;
        frentes.forEach((f) => { const a = ((-90 + (Number(f) - 1) * 72) * Math.PI) / 180; sx += Math.cos(a); sy += Math.sin(a); });
        const meio = (Math.atan2(sy, sx) * 180) / Math.PI;
        const alvo = (naEsquerda(p) ? 180 : 0) - meio;
        giro += (((alvo - giro) % 360) + 540) % 360 - 180;
        roda.style.setProperty('--giro', `${giro}deg`);
      } else {
        nEl.textContent = '5 frentes';
        verboEl.textContent = 'Um time só';
        extraEl.textContent = '';
      }
      [nEl, verboEl, extraEl].forEach((el) => reiniciar(el, 'troca'));
      inicioFio = performance.now();
    };

    // ponto no meio do arco da frente, já considerando o giro atual (o --giro é animado pelo CSS)
    const pontoArco = (frente) => {
      const r = dial.getBoundingClientRect();
      const g = parseFloat(getComputedStyle(roda).getPropertyValue('--giro')) || 0;
      const ang = ((-90 + (Number(frente) - 1) * 72 + g) * Math.PI) / 180;
      const raio = (140 / 320) * r.width;
      return [r.left + r.width / 2 + Math.cos(ang) * raio, r.top + r.height / 2 + Math.sin(ang) * raio, r.left + r.width / 2];
    };

    const desenhar = (agora) => {
      if (!foco || !largo.matches || reduzido) { fioSvg.classList.remove('ligado'); return; }
      fioSvg.classList.add('ligado');
      const foto = fotos[pessoas.indexOf(foco)].getBoundingClientRect();
      const esq = naEsquerda(foco);
      const sx = esq ? foto.right : foto.left, sy = foto.top + foto.height * 0.5;
      const frentes = foco.dataset.frentes.split(',');
      const t = clamp((agora - inicioFio) / 800, 0, 1), ease = 1 - Math.pow(1 - t, 3);
      linhas.forEach((linha, i) => {
        const f = frentes[i];
        const mostra = Boolean(f);
        let ax = 0, ay = 0;
        if (f) [ax, ay] = pontoArco(f);
        linha.style.display = pulsos[i].style.display = mostra ? '' : 'none';
        if (!mostra) return;
        const dx = ax - sx;
        linha.setAttribute('d', `M${sx.toFixed(1)} ${sy.toFixed(1)} C${(sx + dx * 0.5).toFixed(1)} ${sy.toFixed(1)} ${(ax - dx * 0.3).toFixed(1)} ${ay.toFixed(1)} ${ax.toFixed(1)} ${ay.toFixed(1)}`);
        const len = linha.getTotalLength();
        linha.style.strokeDasharray = `${len.toFixed(1)} ${len.toFixed(1)}`;
        linha.style.strokeDashoffset = (len * (1 - ease)).toFixed(1);
        // Kinetics · Packet Trace: um pulso corre da pessoa até a frente
        const pt = linha.getPointAtLength(len * ease * ((agora / 1500 + i * 0.37) % 1));
        pulsos[i].setAttribute('cx', pt.x.toFixed(1));
        pulsos[i].setAttribute('cy', pt.y.toFixed(1));
        pulsos[i].style.opacity = ease.toFixed(2);
      });
    };

    const escolher = () => {
      if (sobre) { definirFoco(sobre); return; }
      const meio = innerHeight * 0.5;
      let melhor = null, dist = Infinity;
      fotos.forEach((f, i) => {
        const r = f.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - meio);
        if (d < dist) { dist = d; melhor = pessoas[i]; }
      });
      definirFoco(dist < innerHeight * 0.3 ? melhor : null);
    };

    const laco = (agora) => {
      if (!visivel) { rodando = false; fioSvg.classList.remove('ligado'); return; }
      escolher();
      desenhar(agora);
      requestAnimationFrame(laco);
    };

    pessoas.forEach((p) => {
      p.addEventListener('mouseenter', () => { sobre = p; if (reduzido) definirFoco(p); });
      p.addEventListener('mouseleave', () => { if (sobre === p) sobre = null; if (reduzido) definirFoco(null); });
    });
    if (!reduzido) {
      new IntersectionObserver(([e]) => {
        visivel = e.isIntersecting;
        if (visivel && !rodando) { rodando = true; requestAnimationFrame(laco); }
      }).observe($('.equipe-corpo', equipe));
    }
  }
})();
