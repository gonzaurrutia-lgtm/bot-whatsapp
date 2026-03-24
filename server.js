import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 🔴 PEGÁ ACÁ TU URL DE APPS SCRIPT
const APPS_SCRIPT_URL = "PEGAR_URL_WEBAPP_ACA";

// 🔴 TOKEN PARA VALIDACIÓN META
const VERIFY_TOKEN = "mi_token_secreto_123";

// =======================================
// VERIFICACIÓN WEBHOOK (Meta)
// =======================================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// =======================================
// RECEPCIÓN MENSAJES WHATSAPP
// =======================================
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body;

    console.log("Mensaje recibido:", from, text);

    // 🔁 LLAMADA A APPS SCRIPT
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        whatsapp: "+" + from,
        texto: text
      })
    });

    const data = await response.json();

    console.log("Respuesta Apps Script:", data);

    // 👉 RESPONDER A WHATSAPP
    await enviarMensajeWhatsApp(from, data.mensaje);

    res.sendStatus(200);

  } catch (error) {
    console.error("Error:", error);
    res.sendStatus(500);
  }
});

// =======================================
// ENVÍO DE MENSAJES
// =======================================
async function enviarMensajeWhatsApp(to, mensaje) {
  const url = `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`;

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      text: { body: mensaje }
    })
  });
}

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});