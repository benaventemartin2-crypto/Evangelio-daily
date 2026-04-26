/**
 * Genera una reflexión breve (máx. 5 líneas) a partir del texto del Evangelio.
 * No usa IA externa: toma frases destacadas del propio Evangelio para evitar
 * dependencias y costos. Si en el futuro se quiere usar una API (OpenAI,
 * Anthropic, etc.), reemplazar esta función por una llamada con API_KEY.
 */
export function buildReflection({ texto, cita }) {
  const limpio = (texto || "").replace(/\s+/g, " ").trim();

  const frases = limpio
    .split(/(?<=[\.\!\?])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 25 && f.length < 220);

  const seleccion = [];
  if (frases.length > 0) seleccion.push(frases[0]);
  if (frases.length > 2) seleccion.push(frases[Math.floor(frases.length / 2)]);
  if (frases.length > 1) seleccion.push(frases[frases.length - 1]);

  const lineas = [
    `Hoy el Evangelio (${cita || "lectura del día"}) nos invita a detenernos.`,
    seleccion[0]
      ? `Resuena la frase: "${seleccion[0]}"`
      : "La Palabra nos pide silencio y escucha.",
    seleccion[1]
      ? `También nos interpela: "${seleccion[1]}"`
      : "Cristo nos llama a confiar y a actuar.",
    "Llevemos esta Palabra al día concreto: una decisión, un perdón, un gesto.",
    "Que esta lectura sea luz y compañía durante toda la jornada.",
  ];

  return lineas.slice(0, 5).join("\n");
}
