// server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const geoip = require("geoip-lite");
const { nanoid } = require("nanoid");
const path = require("path");

const db = require("./db");
const { sendConfirmationRequest, sendFinalMessage } = require("./mailer");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SNAIL_SPEED_KMH = 1; // la velocidad real de un caracol, tal cual pediste

// ---------- Helpers de geografia ----------
function toRad(d) {
  return (d * Math.PI) / 180;
}
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Probabilidad de que un envio sufra un "evento" (tormenta, ave, calor, etc)
// Mientras mas larga la ruta, mas chance. Tope en 35% para que sea raro,
// tal como pediste ("seria casi rarooo" que se pierda).
function computeRiskPct(km) {
  return Math.min(35, 3 + km / 900);
}

// ---------- POST /api/snails : crear un envio ----------
app.post("/api/snails", async (req, res) => {
  try {
    const {
      senderCity, senderLat, senderLon,
      destCity, destLat, destLon,
      friendEmail, message, senderName,
    } = req.body;

    if (!friendEmail || !message || senderLat == null || destLat == null) {
      return res.status(400).json({ error: "Faltan datos del envio." });
    }

    const km = haversineKm(senderLat, senderLon, destLat, destLon);
    const baseHours = km / SNAIL_SPEED_KMH;
    const riskPct = computeRiskPct(km);

    // Se decide una sola vez, al crear el envio, si va a haber un evento
    // climatico/etc en el camino, y cuanto retraso agrega (en horas).
    const willHaveEvent = Math.random() * 100 < riskPct;
    const delayHours = willHaveEvent ? 24 * (1 + Math.random() * 4) : 0; // 1-5 dias extra

    const now = new Date();
    const etaDate = new Date(now.getTime() + (baseHours + delayHours) * 3600 * 1000);

    const snail = {
      id: nanoid(10),
      senderName: senderName || "Alguien",
      senderCity, senderLat, senderLon,
      destCity, destLat, destLon,
      friendEmail,
      message,
      distanceKm: Math.round(km),
      speedKmh: SNAIL_SPEED_KMH,
      riskPct: Math.round(riskPct),
      hadEvent: willHaveEvent,
      created_iso: now.toISOString(),
      eta_iso: etaDate.toISOString(),
      delivered: false,
      locationConfirmed: false,
    };

    db.insertSnail(snail);

    try {
      await sendConfirmationRequest({ to: friendEmail, snailId: snail.id });
    } catch (mailErr) {
      console.error("No se pudo mandar el correo de confirmacion:", mailErr.message);
      // No frenamos el flujo si el mail falla en el demo; en produccion
      // conviene reintentar o avisarle al remitente.
    }

    res.json({
      id: snail.id,
      distanceKm: snail.distanceKm,
      etaIso: snail.eta_iso,
      riskPct: snail.riskPct,
      trackUrl: `${process.env.FRONTEND_URL}/track/${snail.id}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando el envio." });
  }
});

// ---------- GET /api/snails/:id : estado para la pagina de tracking ----------
app.get("/api/snails/:id", (req, res) => {
  const snail = db.getSnail(req.params.id);
  if (!snail) return res.status(404).json({ error: "No existe ese caracol." });

  const now = Date.now();
  const start = new Date(snail.created_iso).getTime();
  const end = new Date(snail.eta_iso).getTime();
  const progress = Math.min(1, Math.max(0, (now - start) / (end - start)));

  res.json({
    id: snail.id,
    senderCity: snail.senderCity,
    destCity: snail.destCity,
    senderLat: snail.senderLat, senderLon: snail.senderLon,
    destLat: snail.destLat, destLon: snail.destLon,
    distanceKm: snail.distanceKm,
    etaIso: snail.eta_iso,
    progress,
    delivered: snail.delivered,
    hadEvent: snail.hadEvent,
    // el mensaje NUNCA se manda en esta respuesta -- solo se entrega por mail
  });
});

// ---------- GET /confirm/:id : el amigo confirma su ubicacion por IP ----------
app.get("/confirm/:id", (req, res) => {
  const snail = db.getSnail(req.params.id);
  if (!snail) return res.status(404).send("Ese caracol no existe.");

  // req.ip trae la IP real del visitante (configurar 'trust proxy' si estas
  // detras de un proxy como Railway/Render, ya esta abajo en app.set)
  const ip = req.ip === "::1" ? "8.8.8.8" : req.ip; // fallback para pruebas locales
  const geo = geoip.lookup(ip);

  if (geo) {
    db.updateSnail(snail.id, {
      destLat: geo.ll[0],
      destLon: geo.ll[1],
      destCity: `${geo.city || geo.region || "Ubicación"}, ${geo.country}`,
      locationConfirmed: true,
    });
  }

  res.sendFile(path.join(__dirname, "public", "confirm.html"));
});

app.set("trust proxy", true);

// ---------- Cron: revisa cada rato si algun caracol ya llego ----------
const schedule = process.env.CRON_SCHEDULE || "*/30 * * * *";
cron.schedule(schedule, async () => {
  const now = new Date().toISOString();
  const pending = db.getPendingDeliveries(now);
  for (const snail of pending) {
    try {
      await sendFinalMessage({
        to: snail.friendEmail,
        message: snail.message,
        senderCity: snail.senderCity,
        destCity: snail.destCity,
      });
      db.updateSnail(snail.id, { delivered: true });
      console.log(`Entregado: ${snail.id} -> ${snail.friendEmail}`);
    } catch (err) {
      console.error(`Fallo entrega ${snail.id}:`, err.message);
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`CaracolPost backend corriendo en puerto ${PORT}`);
  console.log(`Cron de entregas: "${schedule}"`);
});
