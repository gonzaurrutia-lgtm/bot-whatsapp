import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

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

app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from || "";
    const text =
    message.text?.body ||
    message.document?.caption ||
    message.image?.caption ||
    "";
    const messageId = message.id || "";

    const mediaInfo = await extraerMediaWhatsApp(message);

    console.log("Mensaje recibido:", {
      from,
      text,
      messageId,
      type: message.type,
      mediaInfo
    });

    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        whatsapp: "+" + from,
        texto: text,
        message_id: messageId,
        media_url: mediaInfo.media_url,
        media_type: mediaInfo.media_type,
        media_filename: mediaInfo.media_filename,
        media_id: mediaInfo.media_id,
        media_count: mediaInfo.media_id ? 1 : 0
      })
    });

    const data = await response.json();

    console.log("Respuesta Apps Script:", data);

    if (data && data.mensaje) {
      await enviarMensajeWhatsApp(from, data.mensaje);
    }

    return res.sendStatus(200);

  } catch (error) {
    console.error("Error en webhook:", error);
    return res.sendStatus(500);
  }
});

async function extraerMediaWhatsApp(message) {
  const tipo = message.type || "";

  let mediaId = "";
  let mediaType = "";
  let filename = "";

  if (tipo === "document") {
    mediaId = message.document?.id || "";
    mediaType = message.document?.mime_type || "";
    filename = message.document?.filename || "";
  }

  if (tipo === "image") {
    mediaId = message.image?.id || "";
    mediaType = message.image?.mime_type || "";
    filename = "imagen_whatsapp";
  }

  if (!mediaId) {
    return {
      media_id: "",
      media_url: "",
      media_type: "",
      media_filename: ""
    };
  }

  const url = `https://graph.facebook.com/v18.0/${mediaId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`
    }
  });

  const rawResponse = await response.text();

let data;
try {
  data = JSON.parse(rawResponse);
} catch (e) {
  console.error("Apps Script no devolvió JSON:", rawResponse.slice(0, 500));

  data = {
    ok: false,
    mensaje: "Error: Apps Script no devolvió una respuesta válida. Revisar ejecuciones."
  };
}

  if (!response.ok) {
    console.error("Error obteniendo media de Meta:", data);
    return {
      media_id: mediaId,
      media_url: "",
      media_type: mediaType,
      media_filename: filename
    };
  }

  return {
    media_id: mediaId,
    media_url: data.url || "",
    media_type: mediaType,
    media_filename: filename
  };
}

async function enviarMensajeWhatsApp(to, mensaje) {
  const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to,
      text: { body: mensaje }
    })
  });

  const data = await response.text();
  console.log("Respuesta Meta envío:", data);
}

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto", PORT);
});
