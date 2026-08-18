// mailer.js
// Encargado de mandar los dos unicos correos que existen en este sistema:
// 1) al amigo, pidiendole que confirme su ubicacion (cuando se crea el envio)
// 2) al amigo, con el mensaje real, cuando el caracol llega a destino

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendConfirmationRequest({ to, snailId }) {
  const link = `${process.env.PUBLIC_URL}/confirm/${snailId}`;
  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: "Alguien te mando un caracol 🐌",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Te mandaron un mensaje... a paso de caracol</h2>
        <p>Alguien te esta mandando un mensaje que va a tardar en llegar (en serio, semanas).
        Para que el caracol sepa hasta donde caminar, confirmá tu ubicación aproximada:</p>
        <p><a href="${link}" style="background:#f2a65a;color:#241203;padding:12px 20px;
        border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
        Confirmar mi ubicación</a></p>
        <p style="color:#888;font-size:12px;">No vas a ver el mensaje todavía — recién te llega
        cuando el caracol complete el viaje.</p>
      </div>
    `,
  });
}

async function sendFinalMessage({ to, message, senderCity, destCity }) {
  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: "📬 Tu caracol llegó",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2>Tu caracol llegó de ${senderCity} a ${destCity} 🐌</h2>
        <div style="background:#f4f1ea;padding:16px;border-radius:10px;margin:16px 0;">
          <p style="white-space:pre-wrap;margin:0;">${message}</p>
        </div>
        <p style="color:#888;font-size:12px;">Entregado por CaracolPost.</p>
      </div>
    `,
  });
}

module.exports = { sendConfirmationRequest, sendFinalMessage };
