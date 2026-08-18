# CaracolPost — Backend

Esto es la "parte de atrás" del sitio: guarda cada envío, calcula cuánto va a
tardar el caracol (1 km/h, en serio), y manda el correo al amigo **recién
cuando el caracol llega**.

## Qué hace cada archivo

- `server.js` — el servidor. Tiene las rutas (endpoints) que el frontend usa.
- `db.js` — guarda los envíos en un archivo JSON (`data/snails.json`). No hace
  falta instalar una base de datos para arrancar.
- `mailer.js` — manda los correos (confirmación de ubicación + entrega final).
- `public/confirm.html` — la página que ve el amigo cuando confirma su ciudad.

## Cómo funciona el flujo completo

1. Vos llenás el formulario en el frontend → se llama a `POST /api/snails`.
2. El backend calcula distancia real (haversine) y ETA a 1 km/h.
3. Se decide, una sola vez, si hay un "evento" en el camino (tormenta, etc.)
   con una probabilidad que sube según la distancia — igual que hablamos.
4. Se le manda un correo al amigo pidiéndole que confirme su ubicación.
5. El amigo hace click → entra a `/confirm/:id` → el servidor lee su IP con
   `geoip-lite` (esto es **offline**, no depende de ningún servicio externo
   ni tiene límite de uso) y ajusta la ciudad de destino real.
6. Un cron job revisa cada rato (`CRON_SCHEDULE` en `.env`) si algún caracol
   ya cumplió su ETA. Si es así, manda el mensaje real por correo.

## Instalar y correr en tu compu (para probar)

```bash
npm install
cp .env.example .env
# editá .env con tus datos de correo
npm start
```

El servidor va a estar en `http://localhost:3000`.

## Configurar el correo (SMTP)

La forma más simple y gratis para arrancar es [Resend](https://resend.com):
1. Creás cuenta gratis.
2. Verificás un dominio (o usás el de prueba que te dan).
3. Te da una API key — esa va en `SMTP_PASS`, con `SMTP_USER=resend`.

También podés usar Gmail con una "contraseña de aplicación" si querés algo
rapidísimo para probar (buscá "Gmail app password" en Google), pero para
producción real conviene Resend o SendGrid.

## Subirlo a internet (para que quede prendido 24/7)

Este backend necesita un servidor real (no "serverless") porque tiene un
cron job corriendo todo el tiempo. Las opciones más simples y gratis para
empezar:

### Railway (recomendado, más fácil)
1. Creá cuenta en [railway.app](https://railway.app).
2. "New Project" → "Deploy from GitHub repo" (subí esta carpeta a un repo).
3. En "Variables" pegás el contenido de tu `.env`.
4. Railway te da una URL pública — esa es tu `PUBLIC_URL`.

### Render
1. Creá cuenta en [render.com](https://render.com).
2. "New Web Service" → conectás el repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Agregás las variables de entorno igual que arriba.

## Conectarlo con el frontend (el mapa/globo)

En el HTML del frontend, donde está el botón "Soltar el caracol", hay que
cambiar la simulación local por una llamada real:

```js
const res = await fetch(`${API_BASE_URL}/api/snails`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    senderCity, senderLat, senderLon,
    destCity, destLat, destLon,
    friendEmail, message, senderName
  })
});
const data = await res.json();
// data.trackUrl es el link que le podés pasar al que mandó el caracol
```

Y la página de tracking consulta el progreso real con:

```js
const status = await fetch(`${API_BASE_URL}/api/snails/${id}`).then(r => r.json());
// status.progress va de 0 a 1, status.delivered te dice si ya llegó
```

## Siguiente paso lógico

Cuando esto tenga tráfico real, lo primero que conviene migrar es `db.js` de
JSON-a-archivo a una base de datos de verdad (Postgres, por ejemplo, con
Railway te la dan gratis en el mismo proyecto). Toda la lógica ya está
separada en ese archivo, así que el resto del código no cambia.




  
