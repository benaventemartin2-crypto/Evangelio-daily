import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
};

const TIMEOUT_MS = 15000;

function clean(text) {
  return (text || "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getText(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text || text.length < 200) {
      throw new Error(`respuesta muy corta (${text.length} bytes)`);
    }
    return text;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Busca el bloque de texto más sustancioso en la página. Recorre todos los
 * <p>, <div>, <article> y se queda con el conjunto de párrafos más largo.
 * Mucho más resiliente a cambios de layout que selectores específicos.
 */
function extractMainText($) {
  const candidates = [];
  $("article, main, section, div").each((_, el) => {
    const $el = $(el);
    const ps = [];
    $el.children("p").each((_, p) => {
      const t = clean($(p).text());
      if (t && t.length > 30) ps.push(t);
    });
    const joined = ps.join("\n\n");
    if (joined.length > 100) candidates.push(joined);
  });

  // Fallback global: todos los <p> de la página.
  const allPs = [];
  $("p").each((_, p) => {
    const t = clean($(p).text());
    if (t && t.length > 30) allPs.push(t);
  });
  const allJoined = allPs.join("\n\n");
  if (allJoined.length > 100) candidates.push(allJoined);

  if (candidates.length === 0) return "";
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function logHtmlInfo(label, html, $) {
  const title = $ ? clean($("title").first().text()) : "";
  console.log(
    `[fetchGospel] ${label}: html=${html.length} bytes, title="${title.slice(0, 80)}"`,
  );
}

// --- Fuente 1: Universalis (Spain) JSONP --------------------------------
// JSON real, no SPA, muy estable. La ponemos primera.
async function fromUniversalis() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const url = `https://universalis.com/Spain/${today}/jsonpmass.htm`;
  const raw = await getText(url);
  console.log(`[fetchGospel] Universalis: bytes=${raw.length}`);

  const m = raw.match(/^[\s\S]*?\(([\s\S]*)\)\s*;?\s*$/);
  const body = m ? m[1] : raw;
  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    throw new Error(`JSON inválido: ${e.message}`);
  }

  const fechaLiturgica = clean(
    [data.date, data.day].filter(Boolean).join(" — "),
  );

  // Buscamos el evangelio en cualquier campo plausible.
  const gospelKey = Object.keys(data).find((k) =>
    /gospel|evang|mass_g\b/i.test(k),
  );
  const gospelObj = (gospelKey && data[gospelKey]) || data.Mass_G || {};
  const cita = clean(gospelObj.source || gospelObj.heading || "");
  const htmlText = gospelObj.text_HTML || gospelObj.text || "";
  const $ = cheerio.load(`<div id="root">${htmlText}</div>`);
  const texto = extractMainText($) || clean($("#root").text());

  if (!texto) throw new Error("JSON sin texto de Evangelio");
  return { fechaLiturgica, cita, texto, fuente: "https://universalis.com" };
}

// --- Fuente 2: ACI Prensa (es) ------------------------------------------
async function fromAciPrensa() {
  const url = "https://www.aciprensa.com/calendario/today";
  const html = await getText(url);
  const $ = cheerio.load(html);
  logHtmlInfo("ACI Prensa", html, $);
  const fechaLiturgica = clean($("h1, h2").first().text());
  const cita = clean($("h2, h3").first().text());
  const texto = extractMainText($);
  if (!texto) throw new Error("sin texto");
  return { fechaLiturgica, cita, texto, fuente: url };
}

// --- Fuente 3: Catholic.net ---------------------------------------------
async function fromCatholicNet() {
  const url = "https://es.catholic.net/op/articulos/evangelio_del_dia.html";
  const html = await getText(url);
  const $ = cheerio.load(html);
  logHtmlInfo("Catholic.net", html, $);
  const fechaLiturgica = clean($("h1, h2").first().text());
  const cita = clean($("h3, em, strong").first().text());
  const texto = extractMainText($);
  if (!texto) throw new Error("sin texto");
  return { fechaLiturgica, cita, texto, fuente: url };
}

// --- Fuente 4: Vatican News (es) ----------------------------------------
async function fromVaticanNews() {
  const url = "https://www.vaticannews.va/es/evangelio-de-hoy.html";
  const html = await getText(url);
  const $ = cheerio.load(html);
  logHtmlInfo("Vatican News", html, $);
  const fechaLiturgica =
    clean($(".section__head__title").first().text()) ||
    clean($("h1").first().text());
  const cita =
    clean($(".section__head__subtitle").first().text()) ||
    clean($("h2").first().text());
  const texto = extractMainText($);
  if (!texto) throw new Error("sin texto");
  return { fechaLiturgica, cita, texto, fuente: url };
}

// --- Fuente 5: Devocionales Católicos (Blogger) -------------------------
// Blogspot/Blogger es server-rendered, sin JS, muy fácil de scrapear.
async function fromDevocionalesCatolicos() {
  const url = "https://www.devocionalescatolicos.com/p/evangelio-del-dia.html";
  const html = await getText(url);
  const $ = cheerio.load(html);
  logHtmlInfo("Devocionales Católicos", html, $);
  const fechaLiturgica = clean($(".post-title, h1, h2").first().text());
  const cita = clean($(".post-body em, .post-body strong, h3").first().text());
  const texto =
    pickParagraphsFromBody($, ".post-body") || extractMainText($);
  if (!texto) throw new Error("sin texto");
  return { fechaLiturgica, cita, texto, fuente: url };
}

function pickParagraphsFromBody($, selector) {
  const ps = [];
  $(`${selector} p, ${selector} div`).each((_, el) => {
    const t = clean($(el).text());
    if (t && t.length > 30 && !ps.includes(t)) ps.push(t);
  });
  return ps.join("\n\n").trim();
}

const SOURCES = [
  { name: "Universalis", fn: fromUniversalis },
  { name: "Devocionales Católicos", fn: fromDevocionalesCatolicos },
  { name: "ACI Prensa", fn: fromAciPrensa },
  { name: "Catholic.net", fn: fromCatholicNet },
  { name: "Vatican News", fn: fromVaticanNews },
];

export async function fetchGospel() {
  const errores = [];
  for (const { name, fn } of SOURCES) {
    const t0 = Date.now();
    try {
      console.log(`[fetchGospel] intentando ${name}…`);
      const res = await fn();
      console.log(
        `[fetchGospel] OK ${name} en ${Date.now() - t0}ms ` +
          `(cita="${res.cita}", texto=${res.texto.length} chars)`,
      );
      return res;
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      console.log(
        `[fetchGospel] FAIL ${name} en ${Date.now() - t0}ms: ${msg}`,
      );
      errores.push(`${name}: ${msg}`);
    }
  }
  const e = new Error(
    "Todas las fuentes fallaron:\n - " + errores.join("\n - "),
  );
  e.detalleFuentes = errores;
  throw e;
}
