import * as cheerio from "cheerio";

const SOURCE_URL = "https://www.vaticannews.va/es/evangelio-de-hoy.html";

function clean(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .replace(/ /g, " ")
    .trim();
}

/**
 * Obtiene el Evangelio del día desde Vatican News (es).
 * Devuelve: { fechaLiturgica, cita, texto, fuente }
 */
export async function fetchGospel() {
  const res = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; EvangelioDailyBot/1.0; +https://github.com/)",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(
      `No se pudo obtener el Evangelio (HTTP ${res.status} en ${SOURCE_URL})`,
    );
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const fechaLiturgica =
    clean($(".section__head__title").first().text()) ||
    clean($("h2").first().text()) ||
    "";

  const cita =
    clean($(".section__head__subtitle").first().text()) ||
    clean($("h3").first().text()) ||
    "";

  const parrafos = [];
  $("article p, .section__content p, .editorialcontent p").each((_, el) => {
    const t = clean($(el).text());
    if (t) parrafos.push(t);
  });

  const texto = parrafos.join("\n\n").trim();

  if (!texto) {
    throw new Error(
      "El sitio fuente cambió de estructura: no se encontró el texto del Evangelio.",
    );
  }

  return {
    fechaLiturgica,
    cita,
    texto,
    fuente: SOURCE_URL,
  };
}
