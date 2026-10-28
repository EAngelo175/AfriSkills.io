const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 4173);
const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const root = __dirname;
const maxBodyBytes = 32_000;
const maxMessages = 12;
const maxMessageLength = 2_000;
const rateWindowMs = 60_000;
const rateLimit = 12;
const requestsByAddress = new Map();

function geminiServiceError(status) {
  const messages = {
    400: "Gemini rejected the request. Check the model name and request settings.",
    401: "Gemini rejected the API key. Replace it with a valid key from Google AI Studio.",
    403: "Gemini denied access. Check that the key is valid and Gemini API access is enabled.",
    404: `Gemini model "${model}" was not found. Set GEMINI_MODEL to a supported model.`,
    429: "Gemini quota or rate limit reached. Check the API quota and billing settings.",
  };
  const error = new Error(messages[status] || `Gemini service returned HTTP ${status}. Check the API configuration and try again.`);
  error.status = 502;
  throw error;
}

const publicFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/provider.js", ["provider.js", "text/javascript; charset=utf-8"]],
  ["/coach.js", ["coach.js", "text/javascript; charset=utf-8"]],
]);

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  });
  response.end(JSON.stringify(data));
}

function securityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Cache-Control", "no-store");
}

function takeRateLimit(address) {
  const now = Date.now();
  const current = requestsByAddress.get(address);
  if (!current || now - current.startedAt >= rateWindowMs) {
    requestsByAddress.set(address, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= rateLimit;
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error("Message is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Send a valid JSON request.");
    error.status = 400;
    throw error;
  }
}

function validateMessages(body) {
  if (!Array.isArray(body?.messages) || body.messages.length < 1 || body.messages.length > maxMessages) {
    throw new Error(`Send between 1 and ${maxMessages} chat messages.`);
  }
  const messages = body.messages.map((message) => {
    if (!["user", "model"].includes(message?.role) || typeof message.text !== "string") {
      throw new Error("Each chat message must have a valid role and text.");
    }
    const text = message.text.trim();
    if (!text || text.length > maxMessageLength) {
      throw new Error(`Each message must be between 1 and ${maxMessageLength} characters.`);
    }
    return { role: message.role, parts: [{ text }] };
  });
  if (messages[messages.length - 1].role !== "user") {
    throw new Error("The latest chat message must be from the learner.");
  }
  if (!["en", "lg"].includes(body.language)) {
    throw new Error("Choose English or Luganda for the coach response.");
  }
  return { messages, language: body.language };
}

async function generateCoachReply(messages, language) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    );
    url.searchParams.set("key", process.env.GEMINI_API_KEY);
    const result = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: `You are AfriSkills.io's learning and career coach. ${
              language === "lg"
                ? "Respond in clear, natural Luganda (also called Ganda). Use Luganda for the entire response unless the learner explicitly asks for a translation or a technical term is best kept in English; explain such terms in Luganda."
                : "Respond in clear English."
            } Give practical, encouraging, concise guidance. Help learners make realistic plans, understand concepts, and develop honest portfolio projects. Ask clarifying questions when useful. Do not invent course fees, deadlines, accreditation, certificates, or job availability. Do not claim to enroll learners or complete actions for them. Encourage learners to verify important information with official providers. Do not request passwords or sensitive personal information.`,
          }],
        },
        contents: messages,
        generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
      }),
    });

    if (!result.ok) {
      geminiServiceError(result.status);
    }

    const data = await result.json();
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();
    if (!text) {
      const error = new Error("Gemini did not return a text response. Please try again.");
      error.status = 502;
      throw error;
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

function validateTranslation(body) {
  if (typeof body?.text !== "string") {
    throw new Error("Provide English text to translate.");
  }
  const text = body.text.trim();
  if (!text || text.length > maxMessageLength) {
    throw new Error(`Text must be between 1 and ${maxMessageLength} characters.`);
  }
  if (body.source_language !== "en" || body.target_language !== "lg") {
    throw new Error("This translation service supports English to Luganda.");
  }
  if (body.context !== "AI coaching") {
    throw new Error('Context must be "AI coaching".');
  }
  return text;
}

async function generateTranslation(text) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    );
    url.searchParams.set("key", process.env.GEMINI_API_KEY);
    const result = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text: "Translate the user's English text into natural, accurate Luganda (Ganda). Preserve its meaning and tone. Return only the translated text, without explanations, quotation marks, or labels.",
          }],
        },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
    });

    if (!result.ok) {
      geminiServiceError(result.status);
    }

    const data = await result.json();
    const translatedText = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();
    if (!translatedText) {
      const error = new Error("Gemini did not return a translation. Please try again.");
      error.status = 502;
      throw error;
    }
    return translatedText;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleRequest(request, response) {
  securityHeaders(response);
  const requestUrl = new URL(request.url, `http://${host}:${port}`);

  if (request.method === "GET" && requestUrl.pathname === "/api/coach/status") {
    sendJson(response, 200, {
      configured: Boolean(process.env.GEMINI_API_KEY),
      model,
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/coach") {
    if (!takeRateLimit(request.socket.remoteAddress || "local")) {
      sendJson(response, 429, { error: "Too many requests. Please wait a minute and try again." });
      return;
    }
    if (!process.env.GEMINI_API_KEY) {
      sendJson(response, 503, { error: "Gemini is not configured. Set GEMINI_API_KEY in the server environment and restart." });
      return;
    }
    try {
      const body = await readJsonBody(request);
      let messages;
      try {
        messages = validateMessages(body);
      } catch (error) {
        error.status = 400;
        throw error;
      }
      const text = await generateCoachReply(messages.messages, messages.language);
      sendJson(response, 200, { text });
    } catch (error) {
      const status = error.status || 502;
      sendJson(response, status, {
        error: status === 413
            ? error.message
            : status === 400
              ? error.message || "Unable to process the coach request."
              : error.status
                ? error.message
                : "Unable to reach Gemini. Check the server connection and try again.",
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/translate") {
    if (!takeRateLimit(request.socket.remoteAddress || "local")) {
      sendJson(response, 429, { error: "Too many requests. Please wait a minute and try again." });
      return;
    }
    try {
      const body = await readJsonBody(request);
      let text;
      try {
        text = validateTranslation(body);
      } catch (error) {
        error.status = 400;
        throw error;
      }
      if (!process.env.GEMINI_API_KEY) {
        sendJson(response, 503, { error: "Gemini is not configured. Set GEMINI_API_KEY in the server environment and restart." });
        return;
      }
      const translatedText = await generateTranslation(text);
      sendJson(response, 200, {
        source_language: "en",
        target_language: "lg",
        translated_text: translatedText,
        request_id: randomUUID(),
      });
    } catch (error) {
      const status = error.status || 502;
      sendJson(response, status, {
        error: status === 413
          ? error.message
          : status === 400
            ? error.message || "Unable to process the translation request."
            : error.status
              ? error.message
              : "Unable to reach Gemini. Check the server connection and try again.",
      });
    }
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  const file = publicFiles.get(requestUrl.pathname);
  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found.");
    return;
  }

  try {
    const content = await readFile(path.join(root, file[0]));
    response.writeHead(200, { "Content-Type": file[1] });
    response.end(content);
  } catch (error) {
    console.error("Unable to serve the application file.", error);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Unable to load the application.");
  }
}

http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error("Unhandled server request error.", error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: "An unexpected server error occurred." });
    } else {
      response.destroy();
    }
  });
}).listen(port, host, () => {
  console.log(`AfriSkills.io listening on ${host}:${port}. On this Wi-Fi, open http://<computer-ip>:${port}`);
  console.log(process.env.GEMINI_API_KEY ? `Gemini coach enabled (${model}).` : "Gemini coach disabled. Set GEMINI_API_KEY and restart to enable it.");
});
