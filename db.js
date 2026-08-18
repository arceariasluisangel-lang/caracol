// db.js
// Base de datos simple en un archivo JSON. No necesita instalar Postgres/Mongo
// para empezar. Si el proyecto crece en serio, esto se migra facil a una
// base real (Postgres con Prisma, por ejemplo) porque toda la logica de
// lectura/escritura esta aca, en un solo lugar.

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "snails.json");

function ensureDbFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ snails: [] }, null, 2));
  }
}

function readAll() {
  ensureDbFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function writeAll(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getSnail(id) {
  const data = readAll();
  return data.snails.find((s) => s.id === id) || null;
}

function insertSnail(snail) {
  const data = readAll();
  data.snails.push(snail);
  writeAll(data);
  return snail;
}

function updateSnail(id, patch) {
  const data = readAll();
  const idx = data.snails.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  data.snails[idx] = { ...data.snails[idx], ...patch };
  writeAll(data);
  return data.snails[idx];
}

function getPendingDeliveries(nowIso) {
  const data = readAll();
  return data.snails.filter((s) => !s.delivered && s.eta_iso <= nowIso);
}

module.exports = {
  getSnail,
  insertSnail,
  updateSnail,
  getPendingDeliveries,
};
