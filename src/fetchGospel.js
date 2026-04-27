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
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

const TIMEOUT_MS = 12000;

function clean(text) {
  return (text || "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getHtml(url) {
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
    if (!text || text.length < 200) throw new Error("respuesta vacía");
    return text;
  } finally {
    clearTimeout(t);
  }
}

function pickParagraphs($, selectors) {
  const seen = new Set();
  const parrafos = [];
  $(selectors.join(", ")).each((_, el) => {
    const t = clean($(el).text());
    if (!t || t.length < 30) return;
    if (seen.has(t)) return;
    seen.add(t);
    parrafos.push(t);
  });
  return parrafos.join("\n\n").trim();
}

// --- Fuente 1: Vatican News (es) ----------------------------------------
async function fromVaticanNews() {
  const url = "https://www.vaticannews.va/es/evangelio-de-hoy.html";
  const html = await getHtml(url);
  const $ = cheerio.load(html);

  const fechaLiturgica =
    clean($(".section__head__title").first().text()) ||
    clean($("h1").first().text());
  const cita =
    clean($(".section__head__subtitle").first().text()) ||
    clean($("h2").first().text());
  const texto = pickParagraphs($, [
    "article p",
    ".section__content p",
    ".editorialcontent p",
    "main p",
  ]);
  if (!texto) throw new Error("sin texto");
  return { fechaLiturgica, cita, texto, fuente: url };
}

// --- Fuente 2: Catholic.net ---------------------------------------------
async function fromCatholicNet() {
  const url = "https://es.catholic.net/op/articulos/evangelio_del_dia.html";
  const html = await getHtml(url);
  const $ = cheerio.load(html);
  const fechaLiturgica = clean($("h1, h2").first().text());
  const cita = clean($("h3, em, strong").first().text());
  const texto = pickParagraphs($, ["article p", "#contenido p", "p"]);
  if (!texto) throw new Error("sin texto");
  return { fechaLiturgica, cita, texto, fuente: url };
}

// --- Fuente 3: Evangelio.org (Latinoamérica) ----------------------------
async function fromEvangelioOrg() {
  const url = "https://www.evangelio.org/";
  const html = await getHtml(url);
  const $ = cheerio.load(html);
  const fechaLiturgica = clean($("h1, h2").first().text());
  const cita = clean($("h3, .cita, em").first().text());
  const texto = pickParagraphs($, ["article p", ".entry-content p", "p"]);
  if (!texto) throw new Error("sin texto");
  return { fechaLiturgica, cita, texto, fuente: url };
}

// --- Fuente 4: Aleteia (es) ---------------------------------------------
async function fromAleteia() {
  const url = "https://es.aleteia.org/evangelio-del-dia/";
  const html = await getHtml(url);
  const $ = cheerio.load(html);
  const fechaLiturgica = clean($("h1, h2").first().text());
  const cita = clean($("h2, h3, em").first().text());
  const texto = pickParagraphs($, [
    "article p",
    ".article-content p",
    ".entry-content p",
    "p",
  ]);
  if (!texto) throw new Error("sin texto");
  return { fechaLiturgica, cita, texto, fuente: url };
}

// --- Fuente 5: Universalis (Spain) JSONP --------------------------------
async function fromUniversalis() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const url = `https://universalis.com/Spain/${today}/jsonpmass.htm`;
  const raw = await getHtml(url);
  const m = raw.match(/^\s*[A-Za-z_][\w]*\s*\(([\s\S]*)\)\s*;?\s*$/);
  const body = m ? m[1] : raw;
  const data = JSON.parse(body);

  const date = clean(data.date || "");
  const day = clean(data.day || "");
  const fechaLiturgica = [date, day].filter(Boolean).join(" — ");

  const gospelObj = (data.Mass_G || data.Gospel || data.Mass_Gospel || {}) ;
  const cita = clean(gospelObj.source || gospelObj.heading || "");
  const htmlText = gospelObj.text_HTML || gospelObj.text || "";
  const $ = cheerio.load(`<div>${htmlText}</div>`);
  const texto = pickParagraphs($, ["p"]) || clean($("div").text());
  if (!texto) throw new Error("sin texto en JSON");
  return { fechaLiturgica, cita, texto, fuente: "https://universalis.com" };
}

const SOURCES = [
  { name: "Vatican News", fn: fromVaticanNews },
  { name: "Catholic.net", fn: fromCatholicNet },
  { name: "Evangelio.org", fn: fromEvangelioOrg },
  { name: "Aleteia", fn: fromAleteia },
  { name: "Universalis", fn: fromUniversalis },
];

/**
 * Obtiene el Evangelio del día probando varias fuentes en cascada.
 * Loguea cada intento. Si todas fallan, lanza un error con el detalle.
 */
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
