import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

function clean(text) {
  return (text || "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getHtml(url) {
  const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} en ${url}`);
  }
  return await res.text();
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

  const parrafos = [];
  $(
    "article p, .section__content p, .editorialcontent p, main p",
  ).each((_, el) => {
    const t = clean($(el).text());
    if (t && t.length > 20) parrafos.push(t);
  });

  const texto = parrafos.join("\n\n").trim();
  if (!texto) throw new Error("Vatican News: sin texto");
  return { fechaLiturgica, cita, texto, fuente: url };
}

// --- Fuente 2: Catholic.net ---------------------------------------------
async function fromCatholicNet() {
  const url = "https://es.catholic.net/op/articulos/evangelio_del_dia.html";
  const html = await getHtml(url);
  const $ = cheerio.load(html);

  const fechaLiturgica = clean($("h1, h2").first().text());
  const cita = clean($("h3, .cita, em").first().text());

  const parrafos = [];
  $("p").each((_, el) => {
    const t = clean($(el).text());
    if (t && t.length > 30) parrafos.push(t);
  });

  const texto = parrafos.join("\n\n").trim();
  if (!texto) throw new Error("Catholic.net: sin texto");
  return { fechaLiturgica, cita, texto, fuente: url };
}

// --- Fuente 3: Evangelizo (feed) ----------------------------------------
async function fromEvangelizo() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const url = `https://feed.evangelizo.org/v2/reader.php?type=gospel&date=${today}&lang=ES`;
  const html = await getHtml(url);
  const $ = cheerio.load(html);

  const fechaLiturgica = clean($("h1, .liturgical-day").first().text());
  const cita = clean($("h2, .reference, .ref").first().text());

  const parrafos = [];
  $("p, .text").each((_, el) => {
    const t = clean($(el).text());
    if (t && t.length > 30) parrafos.push(t);
  });

  const texto = parrafos.join("\n\n").trim();
  if (!texto) throw new Error("Evangelizo: sin texto");
  return { fechaLiturgica, cita, texto, fuente: url };
}

const SOURCES = [
  { name: "Vatican News", fn: fromVaticanNews },
  { name: "Catholic.net", fn: fromCatholicNet },
  { name: "Evangelizo", fn: fromEvangelizo },
];

/**
 * Obtiene el Evangelio del día probando varias fuentes en cascada.
 * Devuelve la primera que tenga éxito.
 */
export async function fetchGospel() {
  const errores = [];
  for (const { name, fn } of SOURCES) {
    try {
      console.log(`[fetchGospel] Intentando fuente: ${name}…`);
      const res = await fn();
      console.log(`[fetchGospel] OK con ${name}.`);
      return res;
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      console.log(`[fetchGospel] Falló ${name}: ${msg}`);
      errores.push(`${name}: ${msg}`);
    }
  }
  throw new Error(
    "Todas las fuentes fallaron al obtener el Evangelio:\n - " +
      errores.join("\n - "),
  );
}
