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

async function main() {
  const { fecha, hour } = nowInChile();
  log(`Hora actual en Chile: ${hour}:00 — fecha ${fecha}`);

  // GitHub Actions corre en UTC y dispara dos veces (10 y 11 UTC) para cubrir
  // el cambio de horario CLT/CLST. Solo ejecutamos en la corrida que coincide
  // con las 07:00 en Chile (salvo que se fuerce con FORCE_RUN=1).
  if (process.env.FORCE_RUN !== "1" && hour !== TARGET_HOUR) {
    log(
      `No es la hora objetivo (${TARGET_HOUR}:00 Chile). Saliendo sin enviar.`,
    );
    return;
  }

  log("Obteniendo Evangelio del día…");
  const { fechaLiturgica, cita, texto, fuente } = await fetchGospel();
  log(`OK. Cita: "${cita}". Caracteres de texto: ${texto.length}.`);

  const reflexion = buildReflection({ texto, cita });

  log("Enviando correo…");
  const result = await sendEmail({
    fecha,
    fechaLiturgica,
    cita,
    texto,
    reflexion,
    fuente,
  });

  if (result.dryRun) {
    log("Dry-run completado.");
  } else {
    log(`Correo enviado. messageId=${result.messageId}`);
  }
}

main().catch((err) => {
  console.error("[ERROR]", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
