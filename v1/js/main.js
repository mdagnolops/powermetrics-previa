// Abertura do Grupo PowerMetrics, em três atos guiados pela rolagem:
//   1. Sua empresa: um prédio de peças cinza (o cliente).
//   2. Despedaça: as peças voam, viram laranja e pousam no círculo 360° da PowerMetrics,
//      cinco arcos (as frentes) em volta do núcleo "Sua empresa".
//   3. Símbolo: o círculo sobe e monta o chevron do logo, e o hero entra.
// As mesmas 873 peças passam pelas três formas. Tudo é função da rolagem (p de 0 a 1), suavizada;
// só a construção inicial, as luzes e o balanço usam o relógio.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LOGO } from './celulas.js';

const raiz = document.documentElement;
const reduzido = raiz.classList.contains('reduzido');
const PARAMS = new URLSearchParams(location.search);
const revisando = PARAMS.has('revisar'); // modo de captura: nada anda sozinho
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const tela = $('.cena');
const secao = $('.abertura');
const palco = $('.palco');
const svg = $('.linhas');
const rotulos = $$('.frente');
const nucleoEl = $('.nucleo');
const holofote = $('.holofote');
const atosEl = $$('.ato');
const etapasEl = $$('.etapa');
const barraEl = $('.etapas-barra i');
const reguaEl = $('.etapas');
const assinaturaEsq = $('.assinatura-esq');
const assinaturaDir = $('.assinatura-dir');
const spanEsq = assinaturaEsq.firstElementChild;
const spanDir = assinaturaDir.firstElementChild;
let alturaAssinatura = 0, assinaturaVisivel = false;

// ---------- utilidades ----------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const etapa = (p, a, b) => clamp01((p - a) / (b - a));
const suave = (t) => t * t * (3 - 2 * t);
const entraSai = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const saiCubica = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;
const amortece = (atual, alvo, lambda, dt) => lerp(atual, alvo, 1 - Math.exp(-lambda * dt));
let semente = 20261007;
const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
const angulo = (x, z) => (Math.atan2(-z, x) + Math.PI * 2) % (Math.PI * 2);

// ---------- renderizador, pós-processamento ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, powerPreference: 'high-performance' });
} catch (erro) {
  raiz.classList.add('sem-3d');
  throw erro;
}
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const cena = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const FOV = 28;
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
const camAux = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(cena, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.45, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- luz ----------
const luzChave = new THREE.DirectionalLight(0xfff0e0, 2.6);
luzChave.position.set(-5, 9, 6);
luzChave.castShadow = true;
luzChave.shadow.mapSize.set(2048, 2048);
Object.assign(luzChave.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
luzChave.shadow.camera.updateProjectionMatrix();
luzChave.shadow.bias = -0.0004;
luzChave.shadow.normalBias = 0.02;
const luzRecorte = new THREE.DirectionalLight(0xbfd0ff, 1.7);
luzRecorte.position.set(6, 3, -7);
cena.add(luzChave, luzChave.target, luzRecorte, new THREE.HemisphereLight(0x9aa3b5, 0x1a1208, 0.35));

// ---------- fundo (gradiente, brilho laranja e grão) ----------
const fundoMat = new THREE.ShaderMaterial({
  uniforms: {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTempo: { value: 0 },
    uDia: { value: 0 },
    uFoco: { value: 0.05 },
    uNoite0: { value: new THREE.Color('#2A2D33') },
    uNoite1: { value: new THREE.Color('#101114') },
    uDia0: { value: new THREE.Color('#3A3E46') },
    uDia1: { value: new THREE.Color('#1C1D21') },
    uLaranja: { value: new THREE.Color('#F58434') },
  },
  vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.9999, 1.0); }',
  fragmentShader: `
    uniform vec2 uRes; uniform float uTempo; uniform float uDia; uniform float uFoco;
    uniform vec3 uNoite0; uniform vec3 uNoite1; uniform vec3 uDia0; uniform vec3 uDia1; uniform vec3 uLaranja;
    float ruido(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
      float d = length(p * vec2(0.8, 1.0) - vec2(0.0, -0.1));
      vec3 noite = mix(uNoite0, uNoite1, smoothstep(0.05, 1.0, d));
      vec3 dia = mix(uDia0, uDia1, smoothstep(0.0, 1.15, d));
      vec3 cor = mix(noite, dia, uDia);
      float g = exp(-pow(length(p * vec2(0.7, 1.0) - vec2(0.0, -0.28)), 2.0) * 5.0);
      cor += uLaranja * g * uFoco;
      cor *= 1.0 + (ruido(gl_FragCoord.xy + fract(uTempo * 0.37) * 911.0) - 0.5) * 0.07;
      gl_FragColor = vec4(cor, 1.0);
    }`,
  depthTest: false,
  depthWrite: false,
});
const fundo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fundoMat);
fundo.frustumCulled = false;
fundo.renderOrder = -10;
cena.add(fundo);

// ---------- piso: escurece o reflexo, grade técnica e sombra ----------
const textura = (tam, desenha) => {
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  desenha(c.getContext('2d'), tam);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
};
const TAM_PISO = 26;
const pisoAlpha = textura(512, (g, s) => {
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, '#fff');
  gr.addColorStop(0.42, '#d0d0d0');
  gr.addColorStop(1, '#000');
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
});
const piso = new THREE.Mesh(
  new THREE.PlaneGeometry(TAM_PISO, TAM_PISO),
  new THREE.MeshBasicMaterial({ color: 0x0e0f12, transparent: true, opacity: 0.8, alphaMap: pisoAlpha, depthWrite: false }),
);
const texGrade = textura(2048, (g, s) => {
  const celulas = TAM_PISO / 0.5;
  const passo = s / celulas;
  g.strokeStyle = 'rgba(255,255,255,0.10)';
  g.lineWidth = 2;
  for (let i = 0; i <= celulas; i++) {
    const v = Math.round(i * passo) + 0.5;
    g.beginPath(); g.moveTo(v, 0); g.lineTo(v, s); g.stroke();
    g.beginPath(); g.moveTo(0, v); g.lineTo(s, v); g.stroke();
  }
  g.globalCompositeOperation = 'destination-in';
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(0.45, 'rgba(0,0,0,0.55)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
});
texGrade.colorSpace = THREE.SRGBColorSpace;
const grade = new THREE.Mesh(
  new THREE.PlaneGeometry(TAM_PISO, TAM_PISO),
  new THREE.MeshBasicMaterial({ map: texGrade, transparent: true, depthWrite: false }),
);
const sombra = new THREE.Mesh(new THREE.PlaneGeometry(TAM_PISO, TAM_PISO), new THREE.ShadowMaterial({ opacity: 0.42, depthWrite: false }));
sombra.receiveShadow = true;
[piso, grade, sombra].forEach((m, i) => {
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.001 * (i + 1);
  m.renderOrder = i + 1;
  cena.add(m);
});

// ---------- peças ----------
const PX = 1 / 60;                 // 60 px do logo = 1 unidade 3D
const CX = 82, CY = 156;            // centro do conjunto no logo (700x310)
const G = LOGO.passo * PX;          // passo da grade de peças
const LADO = G * 0.84;              // lado de cada cubo
const FRENTES = 5;
const R_ANEL = 2.55;
const VAO = (Math.PI * 2) / FRENTES - 0.24;
const ANG0 = Array.from({ length: FRENTES }, (_, k) => Math.PI / 2 - k * ((Math.PI * 2) / FRENTES));
const Y_SIMBOLO = (310 - CY) * PX + 0.24; // o chevron fica de pé, com os quadradinhos rentes ao piso
const Y_PONTA = -(150 - CY) * PX + Y_SIMBOLO; // altura da ponta do chevron (e do fundo do V)
const Q_ID = new THREE.Quaternion();
const EIXO_Y = new THREE.Vector3(0, 1, 0);

// Prédio escalonado: base, corpo, torre, coroa e antena, somando exatamente as 861 células do chevron.
const BLOCOS = [[11, 7, 4, 0], [9, 5, 5, 4], [6, 4, 13, 9], [4, 3, 1, 22], [1, 1, 4, 23]];
const ANDARES = 27;
const vagasPredio = [];
for (const [nx, nz, ny, y0] of BLOCOS) {
  for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
    const x = (ix - (nx - 1) / 2) * G, z = (iz - (nz - 1) / 2) * G;
    const andar = y0 + iy;
    const borda = ix === 0 || ix === nx - 1 || iz === 0 || iz === nz - 1;
    vagasPredio.push({ pos: new THREE.Vector3(x, andar * G + G / 2, z), borda, andar, ang: angulo(x, z) });
  }
}

// Anel: cada frente vira um arco de 4 fileiras e 3 camadas, na mesma ordem em que as células correm no chevron.
const FILEIRAS = 4;
const vagaAnel = new Map();
const celulasFrente = Array.from({ length: FRENTES }, () => []);
LOGO.celulas.forEach((c) => celulasFrente[c.k].push(c));
celulasFrente.forEach((lista, k) => {
  const ordem = [...lista].sort((a, b) => a.t - b.t);
  const colunas = Math.ceil(ordem.length / FILEIRAS);
  for (let col = 0; col < colunas; col++) {
    ordem.slice(col * FILEIRAS, (col + 1) * FILEIRAS)
      .sort((a, b) => a.u - b.u)
      .forEach((c, fila) => vagaAnel.set(c, {
        ang: ANG0[k] + (0.5 - (col + 0.5) / colunas) * VAO,
        raio: R_ANEL + (fila - (FILEIRAS - 1) / 2) * G * 1.1,
      }));
  }
});

const eixoAleatorio = () => new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
const pecas = [];
for (const c of LOGO.celulas) {
  const vaga = vagaAnel.get(c);
  for (const camada of [-1, 0, 1]) {
    pecas.push({
      bit: false, k: c.k, t: c.t, camada,
      ang: vaga.ang, raio: vaga.raio, yAnel: (camada + 1) * G * 1.06 + G / 2,
      simbolo: new THREE.Vector3((c.x - CX) * PX, -(c.y - CY) * PX + Y_SIMBOLO, camada * G),
    });
  }
}
// Cada peça do prédio voa para a vaga do anel no mesmo ângulo: a explosão sai para todos os lados.
{
  const porAngulo = (a, b) => ((a.ang + Math.PI * 2) % (Math.PI * 2)) - ((b.ang + Math.PI * 2) % (Math.PI * 2));
  const ordemPecas = [...pecas].sort((a, b) => porAngulo(a, b) || a.camada - b.camada);
  const ordemVagas = [...vagasPredio].sort((a, b) => a.ang - b.ang || a.andar - b.andar);
  ordemPecas.forEach((pc, i) => {
    const v = ordemVagas[i];
    pc.predio = v.pos;
    pc.andar = v.andar;
    pc.janela = v.borda && v.andar < 22 && rnd() < (v.andar % 5 === 2 ? 0.62 : 0.2) ? 0.45 + rnd() * 0.35 : 0;
    pc.farol = v.andar === ANDARES - 1;
  });
}
// Os quadradinhos soltos do logo: blocos na praça do prédio, núcleo "sua empresa" no anel, pixels do logo no fim.
LOGO.bits.forEach((b, i, todos) => {
  const fi = Math.acos(1 - (2 * (i + 0.5)) / todos.length);
  const te = Math.PI * (1 + Math.sqrt(5)) * i;
  const a = (i / todos.length) * Math.PI * 2 + 0.4;
  const r = 1.0 + rnd() * 0.3;
  const escalaLogo = (b.s * PX * 0.92) / LADO;
  const escalaPraca = Math.min(1.6, escalaLogo * 0.75);
  pecas.push({
    bit: true, k: -1, t: 1 + rnd() * 0.05, camada: 0, andar: 0,
    predio: new THREE.Vector3(Math.cos(a) * r, (escalaPraca * LADO) / 2, -Math.sin(a) * r),
    nucleo: new THREE.Vector3(Math.sin(fi) * Math.cos(te), Math.sin(fi) * Math.sin(te), Math.cos(fi)).multiplyScalar(0.3),
    simbolo: new THREE.Vector3((b.x - CX) * PX, -(b.y - CY) * PX + Y_SIMBOLO, 0),
    escalaPraca, escalaNucleo: 0.62, escalaLogo,
    janela: 0, farol: false,
  });
});
const N = pecas.length;

// Parâmetros de voo, atrasos e cores de cada peça
{
  const corPredio = new THREE.Color('#646B78');
  const corJanela = new THREE.Color('#FFD2A3');
  const corPraca = new THREE.Color('#545A66');
  const corLaranja = new THREE.Color('#F58434');
  const corNucleo = new THREE.Color('#F3F4F6');
  for (const pc of pecas) {
    pc.fase = rnd() * Math.PI * 2;
    pc.eixoQ = eixoAleatorio();
    pc.giroQ = 3 + rnd() * 4;
    pc.altQuebra = 1.3 + rnd() * 1.9;
    pc.eixoM = eixoAleatorio();
    pc.giroM = 2 + rnd() * 2.5;
    pc.altMonta = 0.5 + rnd() * 1.4;
    pc.queda = 2.6 + rnd() * 2.4;
    pc.atrasoChega = (pc.andar / ANDARES) * 0.72 + rnd() * 0.28;
    pc.atrasoQuebra = (1 - pc.andar / ANDARES) * 0.62 + rnd() * 0.38;
    pc.atrasoMonta = clamp01(pc.t) * 0.72 + rnd() * 0.28;
    if (!pc.bit) { pc.escalaPraca = pc.escalaNucleo = pc.escalaLogo = 1; }
    pc.cor0 = (pc.bit ? corPraca : pc.janela ? corJanela : corPredio).clone();
    if (!pc.bit && !pc.janela) pc.cor0.offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
    if (pc.farol) pc.cor0.copy(corLaranja);
    pc.cor1 = pc.bit ? corNucleo.clone() : corLaranja.clone().offsetHSL(0, 0, pc.camada * 0.02 + (rnd() - 0.5) * 0.025);
    pc.cor2 = corLaranja.clone().offsetHSL(0, 0, pc.bit ? 0 : pc.camada * 0.02);
  }
}

// Malha instanciada com brilho por peça (janelas, varredura de luz, cometa no anel)
const geo = new RoundedBoxGeometry(LADO, LADO, LADO, 2, LADO * 0.16);
const atribBrilho = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
atribBrilho.setUsage(THREE.DynamicDrawUsage);
geo.setAttribute('aBrilho', atribBrilho);

function comBrilho(material, forca, chave) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uForca = { value: forca };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBrilho;\nvarying float vBrilho;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBrilho = aBrilho;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uForca;\nvarying float vBrilho;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor * vBrilho * uForca;');
  };
  material.customProgramCacheKey = () => chave;
  return material;
}

const malha = new THREE.InstancedMesh(geo, comBrilho(new THREE.MeshStandardMaterial({
  color: 0xffffff, roughness: 0.36, metalness: 0.14, envMapIntensity: 0.6,
}), 1.5, 'pecas'), N);
malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
malha.frustumCulled = false;
malha.castShadow = true;
malha.receiveShadow = true;
const corTmp = new THREE.Color();
pecas.forEach((pc, i) => malha.setColorAt(i, pc.cor0));
malha.instanceColor.setUsage(THREE.DynamicDrawUsage);
cena.add(malha);

// Reflexo no piso: a mesma malha espelhada, mais escura, coberta pelo piso translúcido
const espelho = new THREE.InstancedMesh(geo, comBrilho(new THREE.MeshStandardMaterial({
  color: 0x4a4a4a, roughness: 0.6, metalness: 0.0, envMapIntensity: 0.25,
}), 1.1, 'espelho'), N);
espelho.instanceMatrix = malha.instanceMatrix;
espelho.instanceColor = malha.instanceColor;
espelho.frustumCulled = false;
const grupoEspelho = new THREE.Group();
grupoEspelho.scale.y = -1;
grupoEspelho.add(espelho);
cena.add(grupoEspelho);

// ---------- extras do anel: órbita, raios com pulsos de dados, feixe do núcleo; ondas de choque ----------
const matLinha = (opacidade) => new THREE.LineBasicMaterial({
  color: 0xf58434, transparent: true, opacity: opacidade, depthWrite: false, blending: THREE.AdditiveBlending,
});
const orbita = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 200 }, (_, i) => {
  const a = (i / 200) * Math.PI * 2;
  return new THREE.Vector3(Math.cos(a) * (R_ANEL + 0.42), 0.012, -Math.sin(a) * (R_ANEL + 0.42));
})), matLinha(0));
const raiosGeo = new THREE.BufferGeometry();
raiosGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FRENTES * 6), 3));
const raios = new THREE.LineSegments(raiosGeo, matLinha(0));
const feixe = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.01, 0), new THREE.Vector3(0, 0.62, 0)]), matLinha(0));
const pulsos = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 0.05),
  new THREE.MeshBasicMaterial({ color: 0xffc89a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), FRENTES * 2);
pulsos.frustumCulled = false;
const onda = () => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.985, 1.0, 160),
    new THREE.MeshBasicMaterial({ color: 0xf58434, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.renderOrder = 5;
  return m;
};
const ondaQuebra = onda();
const ondaSimbolo = onda();
cena.add(orbita, raios, feixe, pulsos, ondaQuebra, ondaSimbolo);

// ---------- linhas dos rótulos (SVG) ----------
const NS = 'http://www.w3.org/2000/svg';
const pinos = rotulos.map(() => {
  const linha = document.createElementNS(NS, 'line');
  const ponto = document.createElementNS(NS, 'circle');
  ponto.setAttribute('r', '2.5');
  svg.append(linha, ponto);
  return { linha, ponto };
});

// ---------- títulos: cada ato vira unidades (olho, palavras, apoio, botões) reveladas pela rolagem ----------
const atos = atosEl.map((el) => {
  const unidades = [];
  const marcar = (no) => { no.classList.add('unidade'); unidades.push(no); };
  const olho = el.querySelector('.olho');
  if (olho) marcar(olho);
  const titulo = el.querySelector('.titulo');
  titulo.setAttribute('aria-label', titulo.textContent.replace(/\s+/g, ' ').trim());
  for (const filho of [...titulo.childNodes]) {
    if (filho.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      for (const parte of filho.textContent.split(/(\s+)/)) {
        if (!parte) continue;
        if (/^\s+$/.test(parte)) { frag.append(' '); continue; }
        const palavra = document.createElement('span');
        palavra.className = 'palavra';
        palavra.textContent = parte;
        palavra.setAttribute('aria-hidden', 'true');
        frag.append(palavra);
        unidades.push(palavra);
        palavra.classList.add('unidade');
      }
      filho.replaceWith(frag);
    } else if (filho.nodeType === Node.ELEMENT_NODE) {
      filho.setAttribute('aria-hidden', 'true');
      marcar(filho); // o destaque laranja entra inteiro, para o brilho correr contínuo
    }
  }
  const sub = el.querySelector('.sub');
  if (sub) marcar(sub);
  const dica = el.querySelector('.dica');
  if (dica) marcar(dica);
  const acoes = el.querySelector('.acoes');
  if (acoes) marcar(acoes);
  return { el, unidades, ultimo: unidades.map(() => ''), olho: el.querySelector('[data-embaralha]'), visto: false };
});

const GLIFOS = '!<>-_/[]{}=+*^?#';
function embaralhar(el) { // Kinetics · Scramble Reveal
  if (!el) return;
  const texto = el.dataset.texto ?? (el.dataset.texto = el.textContent);
  if (reduzido) { el.textContent = texto; return; }
  let quadro = 0;
  const total = 24;
  clearInterval(el._embaralha);
  el._embaralha = setInterval(() => {
    quadro++;
    el.textContent = [...texto].map((c, i) => {
      if (c === ' ' || c === '·') return c;
      return quadro - i * 1.2 > total * 0.6 ? c : GLIFOS[Math.floor(Math.random() * GLIFOS.length)];
    }).join('');
    if (quadro > total + texto.length) {
      clearInterval(el._embaralha);
      el.textContent = texto;
    }
  }, 35);
}

function revelar(ato, vin, vout) {
  const n = ato.unidades.length;
  const st = 0.55;
  ato.unidades.forEach((el, i) => {
    const atraso = (i / Math.max(1, n - 1)) * st;
    const ri = entraSai(clamp01((vin - atraso) / (1 - st)));
    const ro = entraSai(clamp01((vout - atraso) / (1 - st)));
    const r = ri * (1 - ro);
    const y = (1 - ri) * 0.42 - ro * 0.3;
    const desfoque = (1 - ri) * 12 + ro * 10;
    const chave = `${r.toFixed(3)}|${y.toFixed(3)}|${desfoque.toFixed(1)}`;
    if (chave === ato.ultimo[i]) return;
    ato.ultimo[i] = chave;
    el.style.opacity = r.toFixed(3);
    el.style.transform = `translate3d(0, ${y.toFixed(3)}em, 0)`;
    el.style.filter = desfoque > 0.1 ? `blur(${desfoque.toFixed(1)}px)` : 'none';
    el.style.visibility = r < 0.002 ? 'hidden' : 'visible';
  });
  if (vin > 0.35 && vout < 0.5 && !ato.visto) { ato.visto = true; embaralhar(ato.olho); }
  if (vin < 0.05 || vout > 0.95) ato.visto = false;
}

// ---------- enquadramento: cada ato tem uma câmera e uma região da tela abaixo do seu título ----------
const caixaPontos = ([a, b]) => {
  const pts = [];
  for (const x of [a.x, b.x]) for (const y of [a.y, b.y]) for (const z of [a.z, b.z]) pts.push(new THREE.Vector3(x, y, z));
  return pts;
};
const circulo = (raio, y, n = 32) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return new THREE.Vector3(Math.cos(a) * raio, y, -Math.sin(a) * raio);
});
const ESTAGIOS = {
  predio: { alvo: new THREE.Vector3(0, 1.75, 0), elev: 0.22, azim: -0.6,
    pontos: caixaPontos([new THREE.Vector3(-0.8, 0, -0.52), new THREE.Vector3(0.8, ANDARES * G, 0.52)]) },
  anel: { alvo: new THREE.Vector3(0, 0.3, 0), elev: 0.66, azim: -0.12,
    pontos: [...circulo(R_ANEL + 0.45, 0), ...circulo(R_ANEL + 0.45, 0.45), ...circulo(R_ANEL + 1.15, 0.32, 24), new THREE.Vector3(0, 1.6, 0)] },
  simbolo: { alvo: new THREE.Vector3(0, Y_SIMBOLO, 0), elev: 0.07, azim: -0.2,
    pontos: caixaPontos([new THREE.Vector3(-1.42, 0.2, -0.24), new THREE.Vector3(1.42, Y_SIMBOLO + 2.6, 0.24)]) },
};
// No celular a câmera olha o anel mais de cima: ele fica mais redondo e usa a altura da tela.
const ANEL_CELULAR = {
  ...ESTAGIOS.anel, elev: 1.1,
  pontos: [...circulo(R_ANEL + 0.5, 0), ...circulo(R_ANEL + 0.5, 0.45), ...circulo(R_ANEL + 0.8, 0.32, 24), new THREE.Vector3(0, 1.6, 0)],
};
let L = 1, A = 1, aspecto = 1, estreito = false, margem = 32, enq = null;
const vAux = new THREE.Vector3();

function direcao(elev, azim, saida) {
  return saida.set(Math.cos(elev) * Math.sin(azim), Math.sin(elev), Math.cos(elev) * Math.cos(azim));
}
function enquadrar(est, reg) {
  const dir = direcao(est.elev, est.azim, new THREE.Vector3());
  const cantos = est.pontos;
  camAux.aspect = aspecto;
  camAux.clearViewOffset();
  camAux.updateProjectionMatrix();
  const medir = (D) => {
    camAux.position.copy(est.alvo).addScaledVector(dir, D);
    camAux.lookAt(est.alvo);
    camAux.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of cantos) {
      vAux.copy(c).project(camAux);
      const sx = (vAux.x * 0.5 + 0.5) * L, sy = (-vAux.y * 0.5 + 0.5) * A;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    return { x0, x1, y0, y1 };
  };
  const rw = Math.max(40, reg.x1 - reg.x0), rh = Math.max(40, reg.y1 - reg.y0);
  let lo = 4, hi = 160;
  for (let i = 0; i < 30; i++) {
    const D = (lo + hi) / 2;
    const e = medir(D);
    if (e.x1 - e.x0 <= rw && e.y1 - e.y0 <= rh) hi = D; else lo = D;
  }
  const e = medir(hi);
  return {
    D: hi, elev: est.elev, azim: est.azim, alvo: est.alvo,
    dx: (reg.x0 + reg.x1) / 2 - (e.x0 + e.x1) / 2,
    dy: (reg.y0 + reg.y1) / 2 - (e.y0 + e.y1) / 2,
  };
}

function medidas() {
  L = tela.clientWidth || innerWidth;
  A = tela.clientHeight || innerHeight;
  aspecto = L / A;
  estreito = aspecto < 0.9 || L < 760;
  raiz.classList.toggle('estreito', estreito);
  raiz.classList.toggle('compacto', estreito || L < 1100);
  const dpr = Math.min(devicePixelRatio || 1, estreito ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(L, A, false);
  composer.setPixelRatio(dpr);
  composer.setSize(L, A);
  bloom.resolution.set(L * (estreito ? 0.5 : 0.75), A * (estreito ? 0.5 : 0.75));
  const tamSombra = estreito ? 1024 : 2048;
  if (luzChave.shadow.mapSize.x !== tamSombra) {
    luzChave.shadow.mapSize.set(tamSombra, tamSombra);
    luzChave.shadow.map?.dispose();
    luzChave.shadow.map = null;
  }
  fundoMat.uniforms.uRes.value.set(L * dpr, A * dpr);
  camera.aspect = aspecto;
  svg.setAttribute('viewBox', `0 0 ${L} ${A}`);
  margem = Math.min(56, Math.max(16, L * 0.04));

  const topoPalco = palco.getBoundingClientRect().top;
  const fundoAto = (i) => atosEl[i].getBoundingClientRect().bottom - topoPalco;
  const folga = estreito ? 12 : 18;
  const regua = estreito ? 0 : 150; // espaço da régua de etapas (o mesmo dos dois lados, para centrar)
  alturaAssinatura = spanEsq.offsetHeight;
  enq = {
    predio: enquadrar(ESTAGIOS.predio, { x0: margem, y0: fundoAto(0) + folga, x1: L - margem, y1: A - 6 }),
    anel: enquadrar(estreito ? ANEL_CELULAR : ESTAGIOS.anel, { x0: margem + regua, y0: fundoAto(1) + folga, x1: L - margem - regua, y1: A - 8 }),
    simbolo: enquadrar(ESTAGIOS.simbolo, {
      x0: margem, y0: fundoAto(2) + (estreito ? 14 : 22),
      x1: L - margem, y1: A - (estreito ? alturaAssinatura * 2 + 30 : 12),
    }),
  };
  lerRolagem();
}

// ---------- rolagem e interação ----------
let pAlvo = 0;
const faixaRolagem = () => Math.max(1, secao.offsetHeight - palco.offsetHeight);
function lerRolagem() {
  pAlvo = clamp01((scrollY - secao.offsetTop) / faixaRolagem());
}
const rolarPara = (fracao, comportamento = 'smooth') =>
  scrollTo({ top: secao.offsetTop + fracao * faixaRolagem(), behavior: comportamento });
addEventListener('scroll', lerRolagem, { passive: true });
new ResizeObserver(() => medidas()).observe(tela);
document.fonts?.ready.then(() => medidas());

$('[data-pular]')?.addEventListener('click', () => { segurar(2.5); rolarPara(1); });
$('[data-ir-frentes]')?.addEventListener('click', () => rolarPara(0.43));
$('.hero')?.addEventListener('focusin', () => { if (!heroLigado) rolarPara(1, 'auto'); });

let mx = 0, my = 0, mxS = 0, myS = 0;
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  mx = (e.clientX / L) * 2 - 1;
  my = (e.clientY / A) * 2 - 1;
  holofote.style.transform = `translate3d(${e.clientX - 340}px, ${e.clientY - 340}px, 0)`; // Kinetics · Cursor Spotlight
  raiz.classList.add('com-mouse');
}, { passive: true });
// (o ímã dos botões, Kinetics · Magnetic Button, está em js/site.js e vale pro site inteiro)

// ---------- reprodução automática ----------
// Sem interação, a abertura anda sozinha até o hero. Rolar para baixo acelera, para cima volta;
// enquanto a pessoa rola, toca a tela ou usa o teclado, ela manda. Parou, a reprodução retoma de onde está.
const TRECHOS = [ // [início, fim, segundos]: mais tempo onde há o que ler
  [0, 0.09, 1.6], [0.09, 0.36, 3.4], [0.36, 0.48, 2.8], [0.48, 0.7, 2.6], [0.7, 0.8, 1.6], [0.8, 1, 1.8],
];
const ATRASO_INICIAL = 3.0; // deixa o prédio se montar e o primeiro título entrar
let pausaAte = 0, rolagemAuto = null, tocando = false, mouseApertado = false;
function segurar(segundos) {
  pausaAte = Math.max(pausaAte, tempo + segundos);
  rolagemAuto = null;
}
addEventListener('wheel', () => segurar(0.45), { passive: true });
addEventListener('touchstart', () => { tocando = true; segurar(1.2); }, { passive: true });
addEventListener('touchend', () => { tocando = false; segurar(1.2); }, { passive: true });
addEventListener('touchcancel', () => { tocando = false; segurar(1.2); }, { passive: true });
addEventListener('mousedown', () => { mouseApertado = true; segurar(0.5); });
addEventListener('mouseup', () => { mouseApertado = false; segurar(0.5); });
addEventListener('keydown', (e) => {
  if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Spacebar'].includes(e.key)) segurar(0.8);
});

function avancarSozinho(dt) {
  if (reduzido || revisando || tocando || mouseApertado || tempo < ATRASO_INICIAL || tempo < pausaAte) return;
  if (raiz.classList.contains('menu-aberto')) { segurar(0.5); return; }
  const faixa = faixaRolagem();
  const atual = scrollY;
  // a página mexeu sem ser por nós (inércia do toque, barra de rolagem...): a pessoa está no controle
  if (rolagemAuto !== null && Math.abs(rolagemAuto - atual) > 3) { segurar(0.6); return; }
  const pr = clamp01((atual - secao.offsetTop) / faixa);
  if (pr >= 0.999) { rolagemAuto = null; return; }
  if (rolagemAuto === null) rolagemAuto = atual;
  const trecho = TRECHOS.find(([a, b]) => pr >= a && pr < b) ?? TRECHOS[TRECHOS.length - 1];
  const velocidade = ((trecho[1] - trecho[0]) / trecho[2]) * faixa; // px por segundo
  const rampa = clamp01((tempo - Math.max(pausaAte, ATRASO_INICIAL)) / 0.6); // retoma sem tranco
  rolagemAuto = Math.min(secao.offsetTop + faixa, rolagemAuto + velocidade * dt * rampa);
  scrollTo({ top: rolagemAuto, behavior: 'instant' });
  lerRolagem();
}

// ---------- linha do tempo ----------
// p:  0 ─ prédio ─ .05 treme ─ .09 ─ despedaça e pousa no anel ─ .36 ─ anel ─ .5 ─ monta o símbolo ─ .74 ─ hero
const LIGA_HERO = 0.86, DESLIGA_HERO = 0.83;
let p = 0, tempo = 0, chegada = reduzido ? 1 : 0, heroLigado = false, etapaAtual = -1;
let inicioVarredura = -10, varreu = false;
const relogio = new THREE.Clock();
const vPos = new THREE.Vector3(), vAnel = new THREE.Vector3(), vCtrl = new THREE.Vector3(), vEsc = new THREE.Vector3();
const vAlvo = new THREE.Vector3(), vDir = new THREE.Vector3();
const qRot = new THREE.Quaternion(), qAnel = new THREE.Quaternion(), qGiro = new THREE.Quaternion();
const mtx = new THREE.Matrix4();
const arrCor = malha.instanceColor.array;
const arrBrilho = atribBrilho.array;

function bezier(a, c, b, t, saida) {
  const u = 1 - t;
  return saida.set(
    u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    u * u * a.z + 2 * u * t * c.z + t * t * b.z,
  );
}
function noAnel(pc, giro, pos, q) {
  if (pc.bit) {
    pos.copy(pc.nucleo).applyAxisAngle(EIXO_Y, tempo * 0.8).add(vAux.set(0, 0.95 + Math.sin(tempo * 1.6) * 0.05, 0));
    q.setFromAxisAngle(EIXO_Y, tempo * 1.1 + pc.fase);
    return;
  }
  const a = pc.ang + giro;
  pos.set(Math.cos(a) * pc.raio, pc.yAnel, -Math.sin(a) * pc.raio);
  q.setFromAxisAngle(EIXO_Y, a);
}
const distAng = (a, b) => {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

function quadro(dtForcado, desenhar = true) {
  const dt = dtForcado ?? Math.min(relogio.getDelta(), 0.05);
  tempo += dt;
  avancarSozinho(dt);
  p = reduzido ? 1 : amortece(p, pAlvo, 6, dt);
  if (Math.abs(p - pAlvo) < 1e-5) p = pAlvo;
  if (chegada < 1) chegada = Math.min(1, chegada + dt / 2.4);
  const calmo = reduzido ? 0 : 1;

  const eQ = etapa(p, 0.09, 0.36), eM = etapa(p, 0.48, 0.68);
  const sQ = suave(etapa(p, 0.1, 0.34)), sM = suave(etapa(p, 0.48, 0.7));
  const pesoAnel = sQ * (1 - sM);
  const giro = (p - 0.3) * 1.1 + tempo * 0.07 * calmo;
  const tremor = Math.sin(Math.PI * etapa(p, 0.045, 0.1)) * 0.02 * calmo;
  const clarao = Math.sin(Math.PI * etapa(p, 0.085, 0.15)) * 0.7;
  const cometa = tempo * 1.3;

  // varredura de luz no chevron quando ele se completa, e de novo de tempos em tempos no hero
  if (p > 0.68 && !varreu) { varreu = true; inicioVarredura = tempo; }
  if (p < 0.55) varreu = false;
  if (heroLigado && tempo - inicioVarredura > 6.5) inicioVarredura = tempo;
  const faseVarre = (tempo - inicioVarredura) / 1.25;
  const posVarre = -0.15 + faseVarre * 1.35;
  const varrendo = faseVarre >= 0 && faseVarre <= 1;

  const SQ = 0.5, SM = 0.5;
  for (let i = 0; i < N; i++) {
    const pc = pecas[i];
    const lq = entraSai(clamp01((eQ - pc.atrasoQuebra * SQ) / (1 - SQ)));
    const lm = entraSai(clamp01((eM - pc.atrasoMonta * SM) / (1 - SM)));
    noAnel(pc, giro, vAnel, qAnel);

    if (lm > 0) {
      vCtrl.copy(vAnel).add(pc.simbolo).multiplyScalar(0.5);
      vCtrl.y += pc.altMonta;
      bezier(vAnel, vCtrl, pc.simbolo, lm, vPos);
      qRot.copy(qAnel).slerp(Q_ID, lm);
      qRot.multiply(qGiro.setFromAxisAngle(pc.eixoM, Math.sin(Math.PI * lm) * pc.giroM));
    } else if (lq > 0) {
      vCtrl.copy(pc.predio).add(vAnel).multiplyScalar(0.5);
      vCtrl.y += pc.altQuebra;
      bezier(pc.predio, vCtrl, vAnel, lq, vPos);
      qRot.copy(Q_ID).slerp(qAnel, lq);
      qRot.multiply(qGiro.setFromAxisAngle(pc.eixoQ, Math.sin(Math.PI * lq) * pc.giroQ));
    } else {
      vPos.copy(pc.predio);
      qRot.identity();
      if (tremor > 0) {
        vPos.x += Math.sin(tempo * 61 + pc.fase) * tremor * (0.4 + pc.andar / ANDARES);
        vPos.z += Math.cos(tempo * 53 + pc.fase) * tremor * (0.4 + pc.andar / ANDARES);
      }
      if (chegada < 1) {
        const lc = saiCubica(clamp01((chegada - pc.atrasoChega * 0.5) / 0.5));
        vPos.y += (1 - lc) * pc.queda;
        qRot.setFromAxisAngle(pc.eixoQ, (1 - lc) * 1.2);
      }
    }

    // tamanho, cor e brilho
    const esc = lerp(lerp(pc.escalaPraca, pc.escalaNucleo, lq), pc.escalaLogo, lm);
    vEsc.setScalar(esc);
    if (chegada < 1 && lq === 0) {
      const lc = clamp01((chegada - pc.atrasoChega * 0.5) / 0.5);
      vEsc.multiplyScalar(lc > 0 ? 1 : 0.0001);
    }
    mtx.compose(vPos, qRot, vEsc);
    malha.setMatrixAt(i, mtx);

    corTmp.copy(pc.cor0).lerp(pc.cor1, lq).lerp(pc.cor2, lm);
    arrCor[i * 3] = corTmp.r; arrCor[i * 3 + 1] = corTmp.g; arrCor[i * 3 + 2] = corTmp.b;

    let brilho = 0;
    if (pc.janela) brilho += pc.janela * clamp01((tempo - 1.9 - pc.andar * 0.035) / 0.5) * (1 - lq) * (0.88 + 0.12 * Math.sin(tempo * 1.7 + pc.fase));
    if (pc.farol) brilho += (Math.sin(tempo * 3.2) > 0.55 ? 1.2 : 0.12) * (1 - lq);
    brilho += clarao * (1 - lq * 0.6) * (1 - lm);
    if (pc.bit) brilho += pesoAnel * 0.4;
    else {
      const d = distAng(pc.ang + giro, cometa);
      brilho += pesoAnel * (0.03 + Math.exp(-(d * d) / 0.09) * 0.55);
    }
    if (varrendo) brilho += sM * Math.exp(-((pc.t - posVarre) ** 2) / 0.0024) * 1.3;
    arrBrilho[i] = brilho;
  }
  malha.instanceMatrix.needsUpdate = true;
  malha.instanceColor.needsUpdate = true;
  atribBrilho.needsUpdate = true;

  // --- extras do anel e ondas ---
  orbita.material.opacity = pesoAnel * 0.35;
  raios.material.opacity = pesoAnel * 0.55;
  feixe.material.opacity = pesoAnel * 0.8;
  pulsos.material.opacity = pesoAnel;
  const pos = raiosGeo.attributes.position.array;
  for (let k = 0; k < FRENTES; k++) {
    const a = ANG0[k] + giro;
    const fx = Math.cos(a) * (R_ANEL - 0.32), fz = -Math.sin(a) * (R_ANEL - 0.32);
    pos.set([0, 0.012, 0, fx, 0.012, fz], k * 6);
    for (let j = 0; j < 2; j++) {
      const f = 0.12 + ((tempo * 0.5 * calmo + j * 0.5 + k * 0.17) % 1) * 0.88;
      vPos.set(fx * f, 0.04, fz * f);
      vEsc.setScalar(pesoAnel > 0.01 ? 1 : 0.0001);
      mtx.compose(vPos, Q_ID, vEsc);
      pulsos.setMatrixAt(k * 2 + j, mtx);
    }
  }
  raiosGeo.attributes.position.needsUpdate = true;
  pulsos.instanceMatrix.needsUpdate = true;
  const oq = etapa(p, 0.092, 0.22);
  ondaQuebra.scale.setScalar(0.6 + oq * 5.5);
  ondaQuebra.material.opacity = oq > 0 && oq < 1 ? (1 - oq) * 0.75 : 0;
  const os = etapa(p, 0.66, 0.78);
  ondaSimbolo.scale.setScalar(0.4 + os * 4.5);
  ondaSimbolo.material.opacity = os > 0 && os < 1 ? (1 - os) * 0.7 : 0;

  // --- câmera ---
  const E = enq;
  const mistura = (prop) => lerp(lerp(E.predio[prop], E.anel[prop], sQ), E.simbolo[prop], sM);
  vAlvo.lerpVectors(E.predio.alvo, E.anel.alvo, sQ).lerp(E.simbolo.alvo, sM);
  mxS = amortece(mxS, mx, 3, dt);
  myS = amortece(myS, my, 3, dt);
  const elev = mistura('elev') - myS * 0.03 * calmo;
  const azim = mistura('azim') + (mxS * 0.08 + Math.sin(tempo * 0.21) * 0.035) * calmo;
  const D = mistura('D') * (1 + Math.sin(Math.PI * sQ) * 0.18 + Math.sin(Math.PI * sM) * 0.1);
  camera.position.copy(vAlvo).addScaledVector(direcao(elev, azim, vDir), D);
  camera.lookAt(vAlvo);
  const chacoalha = Math.sin(Math.PI * etapa(p, 0.088, 0.13)) * 5 * calmo;
  const dx = mistura('dx') + Math.sin(tempo * 47) * chacoalha;
  const dy = mistura('dy') + Math.cos(tempo * 41) * chacoalha;
  camera.setViewOffset(L, A, -dx, -dy, L, A);
  camera.updateMatrixWorld();

  // --- fundo ---
  const u = fundoMat.uniforms;
  u.uTempo.value = tempo;
  u.uDia.value = sM * 0.85;
  u.uFoco.value = 0.018 + pesoAnel * 0.015 + sM * 0.025 + clarao * 0.02;

  if (desenhar) composer.render(dt);
  atualizarTextos(giro, pesoAnel);
}

// ---------- rótulos, títulos, etapas ----------
const tAncora = [0, 0], tRotulo = [0, 0];
const vAncora = new THREE.Vector3();
let tamanhos = [], larguraNucleo = 0, alturaNucleo = 0, compactoAtual = null;
function naTela(v, saida) {
  vAux.copy(v).project(camera);
  saida[0] = (vAux.x * 0.5 + 0.5) * L;
  saida[1] = (-vAux.y * 0.5 + 0.5) * A;
  return saida;
}

function atualizarTextos(giro, pesoAnel) {
  const compacto = raiz.classList.contains('compacto');
  if (compacto !== compactoAtual) {
    compactoAtual = compacto;
    tamanhos = rotulos.map((el) => [el.offsetWidth, el.offsetHeight]);
    larguraNucleo = nucleoEl.offsetWidth;
    alturaNucleo = nucleoEl.offsetHeight;
  }

  rotulos.forEach((el, k) => {
    const op = reduzido ? 0
      : clamp01((p - (0.33 + k * 0.008)) / 0.035) * (1 - clamp01((p - 0.46) / 0.045));
    const a = ANG0[k] + giro;
    vAncora.set(Math.cos(a) * (R_ANEL + 0.3), 0.32, -Math.sin(a) * (R_ANEL + 0.3));
    naTela(vAncora, tAncora);
    const fora = R_ANEL + (estreito ? 0.8 : 1.1);
    vAncora.set(Math.cos(a) * fora, 0.32, -Math.sin(a) * fora);
    naTela(vAncora, tRotulo);
    const [w, h] = tamanhos[k];
    const x = Math.min(Math.max(tRotulo[0] - w / 2, 8), L - 8 - w);
    const y = tRotulo[1] - h / 2;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    el.style.opacity = op.toFixed(3);
    const { linha, ponto } = pinos[k];
    const lx = Math.min(Math.max(tAncora[0], x), x + w);
    const ly = Math.min(Math.max(tAncora[1], y), y + h);
    linha.setAttribute('x1', lx.toFixed(1));
    linha.setAttribute('y1', ly.toFixed(1));
    linha.setAttribute('x2', tAncora[0].toFixed(1));
    linha.setAttribute('y2', tAncora[1].toFixed(1));
    ponto.setAttribute('cx', tAncora[0].toFixed(1));
    ponto.setAttribute('cy', tAncora[1].toFixed(1));
    linha.style.opacity = ponto.style.opacity = op.toFixed(3);
    if (op > 0.5 && !el._visto) { el._visto = true; embaralhar(el.querySelector(compacto ? '.nome-curto' : '.nome-longo')); }
    if (op < 0.05) el._visto = false;
  });

  const opNucleo = reduzido ? 0 : clamp01((p - 0.31) / 0.04) * (1 - clamp01((p - 0.46) / 0.045));
  naTela(vAncora.set(0, 1.42, 0), tAncora);
  nucleoEl.style.opacity = opNucleo.toFixed(3);
  nucleoEl.style.transform = `translate3d(${(tAncora[0] - larguraNucleo / 2).toFixed(1)}px, ${(tAncora[1] - alturaNucleo).toFixed(1)}px, 0)`;

  // Assinatura: sai de dentro do símbolo. No desktop, "Grupo PowerMetrics" pelo fundo do V e
  // "Ecossistema de crescimento" pela ponta; no celular, as duas linhas descem da base.
  const ra = reduzido ? 1 : entraSai(etapa(p, 0.69, 0.79));
  if (ra < 0.002) {
    if (assinaturaVisivel) {
      assinaturaVisivel = false;
      assinaturaEsq.style.visibility = assinaturaDir.style.visibility = 'hidden';
    }
  } else {
    assinaturaVisivel = true;
    assinaturaEsq.style.visibility = assinaturaDir.style.visibility = 'visible';
    const h = alturaAssinatura;
    if (!estreito) {
      naTela(vAncora.set(0.02, Y_PONTA, 0), tAncora); // fundo do V
      naTela(vAncora.set(1.4, Y_PONTA, 0), tRotulo);  // ponta
      const xEsq = Math.max(0, tAncora[0] - 12);
      const xDir = tRotulo[0] + 14;
      Object.assign(assinaturaEsq.style, { left: '0px', width: `${xEsq.toFixed(1)}px`, top: `${(tAncora[1] - h / 2).toFixed(1)}px`, height: `${h}px` });
      Object.assign(assinaturaDir.style, { left: `${xDir.toFixed(1)}px`, width: `${Math.max(0, L - xDir).toFixed(1)}px`, top: `${(tRotulo[1] - h / 2).toFixed(1)}px`, height: `${h}px` });
      spanEsq.style.transform = `translate3d(${((1 - ra) * 100).toFixed(2)}%, 0, 0)`;
      spanDir.style.transform = `translate3d(${(-(1 - ra) * 100).toFixed(2)}%, 0, 0)`;
    } else {
      naTela(vAncora.set(0, 0.16, 0), tAncora); // base do símbolo
      const y1 = tAncora[1] + 10;
      Object.assign(assinaturaEsq.style, { left: '0px', width: `${L}px`, top: `${y1.toFixed(1)}px`, height: `${h}px` });
      Object.assign(assinaturaDir.style, { left: '0px', width: `${L}px`, top: `${(y1 + h).toFixed(1)}px`, height: `${h}px` });
      spanEsq.style.transform = spanDir.style.transform = `translate3d(0, ${(-(1 - ra) * 100).toFixed(2)}%, 0)`;
    }
    spanEsq.style.opacity = spanDir.style.opacity = ra.toFixed(3);
    spanEsq.style.filter = spanDir.style.filter = ra < 0.99 ? `blur(${((1 - ra) * 8).toFixed(1)}px)` : 'none';
  }

  // títulos
  revelar(atos[0], reduzido ? 0 : clamp01((tempo - 0.35) / 1.3), etapa(p, 0.05, 0.12));
  revelar(atos[1], reduzido ? 0 : etapa(p, 0.15, 0.26), etapa(p, 0.46, 0.54));
  revelar(atos[2], reduzido ? 1 : etapa(p, 0.78, 0.9), 0);

  // etapas
  const et = p < 0.2 ? 0 : p < 0.5 ? 1 : 2;
  if (et !== etapaAtual) {
    etapaAtual = et;
    etapasEl.forEach((el, i) => el.classList.toggle('ativa', i === et));
  }
  barraEl.style.transform = `scaleY(${p.toFixed(4)})`;
  reguaEl.style.opacity = (reduzido ? 0 : 1 - etapa(p, 0.6, 0.68)).toFixed(3);

  if (!heroLigado && p > LIGA_HERO) ligarHero(true);
  else if (heroLigado && p < DESLIGA_HERO) ligarHero(false);
}

function ligarHero(ligar) {
  heroLigado = ligar;
  raiz.classList.toggle('hero-on', ligar);
}

// Atalhos de revisão: __abertura.saltar(0.4) rola até o ponto e pula a suavização;
// __abertura.avancar(2) simula 2 s de animação (útil com a aba em segundo plano).
window.__abertura = {
  saltar(f) {
    if (typeof f === 'number') rolarPara(f, 'instant');
    lerRolagem();
    p = pAlvo;
    chegada = 1;
  },
  avancar(segundos = 1) {
    for (let t = 0; t < segundos; t += 1 / 30) quadro(1 / 30, false);
    quadro(0);
  },
  // Copia o quadro atual para uma imagem sobre o canvas (a captura de tela não vê WebGL com a aba oculta).
  foto() {
    quadro(0);
    let img = document.querySelector('.foto-cena');
    if (!img) {
      img = document.createElement('img');
      img.className = 'foto-cena';
      Object.assign(img.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '1', pointerEvents: 'none' });
      tela.after(img);
    }
    img.src = tela.toDataURL('image/jpeg', 0.9);
  },
};

// ---------- início ----------
medidas();
lerRolagem();
if (pAlvo > 0.04) chegada = 1;
p = pAlvo;
// A cena só desenha enquanto a abertura está na tela: no resto do site, a GPU descansa.
let desenhando = false;
function ligarDesenho(ligar) {
  if (revisando || ligar === desenhando) return;
  desenhando = ligar;
  renderer.setAnimationLoop(ligar ? () => quadro() : null);
  if (ligar) relogio.getDelta(); // descarta o tempo parado
}
ligarDesenho(true);
new IntersectionObserver(([e]) => ligarDesenho(e.isIntersecting)).observe(secao);
window.__cenaPronta = true;
raiz.classList.remove('sem-3d'); // se a rede atrasou e o hero estático já apareceu, a cena assume
raiz.classList.add('cena-ok');

// Revisão por captura: ?revisar=0.42&t=3 leva a animação até o ponto e simula t segundos.
if (revisando) {
  renderer.setAnimationLoop(null); // na captura, um quadro só: nada roda sozinho
  (document.fonts?.ready ?? Promise.resolve()).then(() => {
    medidas();
    window.__abertura.saltar(parseFloat(PARAMS.get('revisar')));
    window.__abertura.avancar(parseFloat(PARAMS.get('t') ?? '3'));
    raiz.classList.add('revisado');
  });
}
