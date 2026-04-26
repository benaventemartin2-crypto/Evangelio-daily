import nodemailer from "nodemailer";

function escapeHtml(s = "") {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toHtml({ fecha, fechaLiturgica, cita, texto, reflexion, fuente }) {
  const parrafos = texto
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n");

  const reflexionHtml = reflexion
    .split("\n")
    .map((l) => escapeHtml(l))
    .join("<br>");

  return `<!doctype html>
<html lang="es">
  <body style="font-family: Georgia, 'Times New Roman', serif; color:#222; max-width:680px; margin:auto; padding:16px; line-height:1.55;">
    <h1 style="margin:0 0 4px 0;">Evangelio del día</h1>
    <p style="margin:0 0 16px 0; color:#666;">${escapeHtml(fecha)}</p>

    ${
      fechaLiturgica
        ? `<p><strong>Fecha litúrgica:</strong> ${escapeHtml(fechaLiturgica)}</p>`
        : ""
    }

    ${cita ? `<p><strong>Cita:</strong> ${escapeHtml(cita)}</p>` : ""}

    <h2 style="margin-top:24px;">Texto</h2>
    ${parrafos}

    <h2 style="margin-top:24px;">Reflexión breve</h2>
    <p>${reflexionHtml}</p>

    <hr style="margin-top:32px;">
    <p style="font-size:12px; color:#888;">
      Fuente: <a href="${escapeHtml(fuente)}">${escapeHtml(fuente)}</a><br>
      Enviado automáticamente por evangelio-daily.
    </p>
  </body>
</html>`;
}

function toText({ fecha, fechaLiturgica, cita, texto, reflexion, fuente }) {
  return [
    "Evangelio del día",
    fecha,
    "",
    fechaLiturgica ? `Fecha litúrgica:\n${fechaLiturgica}` : null,
    cita ? `Cita:\n${cita}` : null,
    `Texto:\n${texto}`,
    `Reflexión breve:\n${reflexion}`,
    "",
    `Fuente: ${fuente}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function sendEmail(payload) {
  const {
    GMAIL_USER,
    GMAIL_APP_PASSWORD,
    TO_EMAIL,
    DRY_RUN,
  } = process.env;

  const subject = `Evangelio del día — ${payload.fecha}`;
  const text = toText(payload);
  const html = toHtml(payload);

  if (DRY_RUN === "1") {
    console.log("=== DRY RUN: no se envía correo ===");
    console.log("Asunto:", subject);
    console.log("\n" + text);
    return { dryRun: true };
  }

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !TO_EMAIL) {
    throw new Error(
      "Faltan variables de entorno: GMAIL_USER, GMAIL_APP_PASSWORD o TO_EMAIL.",
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  const info = await transporter.sendMail({
    from: `"Evangelio del día" <${GMAIL_USER}>`,
    to: TO_EMAIL,
    subject,
    text,
    html,
  });

  return { messageId: info.messageId };
}
