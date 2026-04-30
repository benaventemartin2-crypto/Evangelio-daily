# Evangelio Daily 

Automatización mínima que cada día a las **07:00 AM hora Chile** te envía por
**Gmail** el Evangelio del día con su cita, texto completo y una breve
reflexión.

- Sin dashboard, sin web, sin base de datos.
- Corre en **GitHub Actions** (gratis).
- Opcionalmente, también puedes correrlo localmente con `cron`.

---

## 1. Estructura

```
evangelio-daily/
├── README.md
├── .gitignore
├── .env.example
├── package.json
├── src/
│   ├── fetchGospel.js   # Obtiene el Evangelio del día
│   ├── reflection.js    # Genera la reflexión breve
│   ├── sendEmail.js     # Envío por Gmail (SMTP)
│   └── index.js         # Orquestador
└── .github/
    └── workflows/
        └── daily-evangelio.yml
```

---

## 2. Fuente del Evangelio

Se obtiene desde **Vatican News (es)**:
<https://www.vaticannews.va/es/evangelio-de-hoy.html>

Es una fuente pública y gratuita. Si en algún momento cambia su estructura HTML,
basta con ajustar los selectores en `src/fetchGospel.js`.

---

## 3. Configurar el envío por Gmail

Gmail ya **no** permite usar tu contraseña normal por SMTP. Hay que crear una
**Contraseña de aplicación**:

1. Activa la **verificación en dos pasos** en tu cuenta de Google:
   <https://myaccount.google.com/security>
2. Entra a <https://myaccount.google.com/apppasswords>.
3. Crea una contraseña de aplicación llamada `evangelio-daily`.
4. Copia los 16 caracteres que te entrega (sin espacios).

Esa cadena es la que va en `GMAIL_APP_PASSWORD`.

---

## 4. Secrets de GitHub que debes configurar

En tu repositorio de GitHub:

> `Settings` → `Secrets and variables` → `Actions` → pestaña **Secrets** →
> botón **New repository secret**.

Crea estos secrets (los nombres deben ser **exactamente** estos):

| Nombre               | Valor                                                          | Obligatorio |
| -------------------- | -------------------------------------------------------------- | ----------- |
| `GMAIL_USER`         | tu correo Gmail desde el que se envía (ej. `tucorreo@gmail.com`) | Sí          |
| `GMAIL_APP_PASSWORD` | la contraseña de aplicación de 16 caracteres                   | Sí          |
| `TO_EMAIL`           | el correo donde quieres **recibir** el Evangelio               | Sí          |
| `API_KEY`            | reservado para una API externa futura (déjalo vacío por ahora) | No          |

> Nota: nunca subas el `.env` real al repo. Solo está commiteado `.env.example`.

---

## 5. Horario y zona horaria (importante)

GitHub Actions ejecuta los `cron` en **UTC** y **no** respeta el horario de
verano de Chile. Para que el correo siempre llegue a las **07:00 hora Chile**,
hacemos dos cosas:

1. Programamos el workflow en **dos** horas UTC distintas:
   - `0 10 * * *` (10:00 UTC) → equivale a 07:00 en horario de **verano** chileno (CLST, UTC-3).
   - `0 11 * * *` (11:00 UTC) → equivale a 07:00 en horario de **invierno** chileno (CLT, UTC-4).
2. El script `src/index.js` consulta la hora actual con `TZ=America/Santiago` y
   **solo envía el correo si realmente son las 07:00 locales**. La otra
   ejecución sale sin hacer nada.

Resultado: recibes **exactamente un correo al día** a las 07:00 Chile, sin
importar si estamos en horario de verano o invierno.

> Aviso: GitHub Actions puede retrasar la ejecución de los `cron` algunos
> minutos cuando hay alta carga. Es un comportamiento conocido de la plataforma.

---

## 6. Uso local (opcional)

### Requisitos

- Node.js 18 o superior.

### Instalar y probar

```bash
git clone https://github.com/<tu-usuario>/evangelio-daily.git
cd evangelio-daily
npm install

cp .env.example .env
# edita .env con tus credenciales reales
```

### Probar sin enviar correo (dry-run)

```bash
DRY_RUN=1 FORCE_RUN=1 node src/index.js
```

### Enviar de verdad ahora mismo

```bash
FORCE_RUN=1 node --env-file=.env src/index.js
```

`FORCE_RUN=1` se salta la validación de "07:00 Chile" para que puedas probar a
cualquier hora.

### Programar con cron local

Edita tu crontab:

```bash
crontab -e
```

Y agrega (ajusta las rutas):

```cron
# Evangelio diario a las 07:00 hora Chile
0 7 * * * cd /ruta/al/repo/evangelio-daily && \
  TZ=America/Santiago FORCE_RUN=1 \
  /usr/bin/node --env-file=.env src/index.js \
  >> ./logs/evangelio.log 2>&1
```

`TZ=America/Santiago` asegura que el `0 7 * * *` se interprete en hora Chile
(útil si el sistema corre en otra zona horaria, p. ej. servidores en UTC).

---

## 7. Probar el workflow en GitHub manualmente

En GitHub: pestaña **Actions** → workflow **"Evangelio diario"** → botón
**Run workflow** → marca `force = true` → **Run workflow**.

Te debería llegar el correo en 1–2 minutos.

---

## 8. Formato del correo

**Asunto:** `Evangelio del día — DD-MM-AAAA`

**Cuerpo:**

```
Evangelio del día
DD-MM-AAAA

Fecha litúrgica:
…

Cita:
…

Texto:
…

Reflexión breve:
…
```

Se envía también una versión HTML con el mismo contenido, mejor formateada.

---

## 9. Mantenimiento

- Si cambia el HTML de Vatican News y deja de obtenerse el texto: ajustar los
  selectores en `src/fetchGospel.js`.
- Si quieres que la reflexión la genere una IA: reemplazar
  `src/reflection.js` por una llamada a tu API preferida usando `API_KEY`.
- Para silenciar temporalmente el envío: deshabilitar el workflow desde
  `Actions` → `Evangelio diario` → `…` → `Disable workflow`.
