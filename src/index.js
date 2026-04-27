import { fetchGospel } from "./fetchGospel.js";
import { sendEmail } from "./sendEmail.js";
import { buildReflection } from "./reflection.js";

const TZ = "America/Santiago";
const TARGET_HOUR = 7; // 07:00 hora Chile

function nowInChile() {
  const fmt = new Intl.DateTimeFormat("es-CL", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return {
    fecha: `${parts.day}-${parts.month}-${parts.year}`,
    hour: parseInt(parts.hour, 10),
  };
}

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function annotate(level, message) {
  // GitHub Actions annotations: aparecen en la página del run.
  console.log(`::${level}::${message.replace(/\n/g, "%0A")}`);
}

async function main() {
  const { fecha, hour } = nowInChile();
  log(`Hora Chile: ${hour}:00 — fecha ${fecha}`);

  if (process.env.FORCE_RUN !== "1" && hour !== TARGET_HOUR) {
    log(`No es la hora objetivo (${TARGET_HOUR}:00 Chile). Saliendo OK.`);
    return;
  }

  let payload;
  let fetchError = null;

  try {
    log("Obteniendo Evangelio…");
    const g = await fetchGospel();
    payload = {
      fecha,
      fechaLiturgica: g.fechaLiturgica,
      cita: g.cita,
      texto: g.texto,
      reflexion: buildReflection({ texto: g.texto, cita: g.cita }),
      fuente: g.fuente,
    };
    log(
      `Evangelio OK. Cita="${g.cita}". Texto=${g.texto.length} chars. Fuente=${g.fuente}.`,
    );
  } catch (err) {
    fetchError = err;
    annotate("error", `fetchGospel falló: ${err.message}`);
    log(`[ERROR] fetchGospel: ${err.message}`);
    payload = {
      fecha,
      fechaLiturgica: "(no disponible hoy)",
      cita: "(no disponible hoy)",
      texto:
        "Hoy no fue posible obtener automáticamente el texto del " +
        "Evangelio. Mientras se ajusta la fuente, puedes leerlo en:\n\n" +
        "  • https://www.vaticannews.va/es/evangelio-de-hoy.html\n" +
        "  • https://es.catholic.net/op/articulos/evangelio_del_dia.html\n\n" +
        "Detalle técnico del error (para diagnóstico):\n" +
        err.message,
      reflexion:
        "Aunque hoy falle la técnica, la Palabra sigue viva.\n" +
        "Tomemos un momento para leer el Evangelio en alguna app o web.\n" +
        "Que la jornada sea ocasión de escucha y de gesto concreto.\n" +
        "La fidelidad pequeña abre paso a la gracia.\n" +
        "Mañana volvemos a intentarlo.",
      fuente: "—",
    };
  }

  try {
    log("Enviando correo…");
    const result = await sendEmail(payload);
    if (result.dryRun) {
      log("Dry-run completado.");
    } else {
      log(`Correo enviado. messageId=${result.messageId}`);
    }
  } catch (err) {
    annotate("error", `sendEmail falló: ${err.message}`);
    log(`[ERROR] sendEmail: ${err.message}`);
    throw err;
  }

  // Si llegó hasta acá, el correo se envió. El run queda verde aunque
  // alguna fuente del scraping haya fallado en cascada — la única cosa
  // que importa es que te haya llegado el mail.
  if (fetchError) {
    annotate(
      "warning",
      "Todas las fuentes de Evangelio fallaron, se envió correo de diagnóstico.",
    );
  }
}

main().catch((err) => {
  annotate("error", err.message || String(err));
  console.error("[FATAL]", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
