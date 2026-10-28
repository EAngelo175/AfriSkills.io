const coachStatus = document.querySelector("#coach-status");
const coachMessages = document.querySelector("#coach-messages");
const coachForm = document.querySelector("#coach-form");
const coachInput = document.querySelector("#coach-input");
const coachSend = document.querySelector("#coach-send");
const coachError = document.querySelector("#coach-error");
const coachLanguage = document.querySelector("#coach-language");
const translationForm = document.querySelector("#translation-form");
const translationSource = document.querySelector("#translation-source");
const translationSubmit = document.querySelector("#translation-submit");
const translationError = document.querySelector("#translation-error");
const translationResult = document.querySelector("#translation-result");
const coachHistory = [];
let coachReady = false;
let sendingMessage = false;
let connectionError = "";
let translating = false;

const coachCopy = {
  en: {
    eyebrow: "PERSONAL LEARNING SUPPORT",
    description: "Get help planning your learning, understanding a topic, or improving a project. Avoid sharing passwords, private contact details, or sensitive information.",
    language: "Coach language",
    introTitle: "What would you like help with?",
    introDescription: "Your coach can help break a goal into manageable steps, explain concepts, or give feedback on a project idea. Review AI suggestions and verify course details independently.",
    prompts: ["Make a study plan", "Explain a topic", "Plan a project", "Translate to Luganda"],
    privacy: "Powered by Google's Gemini when the secure local server is configured. Your chat is sent to Google for a response and is not saved by this demo. To connect it, add GEMINI_API_KEY to a .env file in the project folder, then run node server.js. Never put the key in browser code or share the .env file.",
    welcome: "Hi! Tell me what you’re learning and what you’d like help with.",
    messageLabel: "Your message",
    placeholder: "For example: I have 4 hours a week and want to learn web development…",
    send: "Send message",
    thinking: "Thinking…",
    clear: "Clear conversation",
    configured: "Gemini configured",
    notConfigured: "Gemini not configured",
    offline: "Coach server offline",
    setupError: "Gemini is not configured. Add your rotated key as GEMINI_API_KEY in the project .env file, then restart node server.js. Keep the key private.",
    offlineError: "Gemini needs the secure local server. Open AfriSkills.io through that server to chat.",
    missingError: "Gemini is not connected. Start the secure local server with GEMINI_API_KEY set; do not put the key in browser code.",
    failedError: "Unable to reach Gemini. Please try again.",
    translateDescription: "Enter English text to get a Luganda translation for your learning and coaching.",
    sourceLabel: "English text",
    sourcePlaceholder: "Type or paste English text here…",
    translate: "Translate to Luganda",
    translating: "Translating…",
    translationTitle: "Luganda translation",
    requestLabel: "Request ID",
    translationFailed: "Unable to translate this text. Please try again.",
  },
  lg: {
    eyebrow: "OBUYAMBI MU KUSOMA",
    description: "Funa obuyambi mu kuteekateeka okusoma kwo, okutegeera ensonga, oba okulongoosa pulojekiti. Tokozesa ppasiwedi, bikwata ku bantu ku bubwe, oba amawulire amakulu ag’ekyama.",
    language: "Olulimi lw’omuwabuzi",
    introTitle: "Oyagala buyambi ki?",
    introDescription: "Omuwabuzi ayinza okukuyamba okugabanya ekiruubirirwa mu mitendera emitono, okunnyonnyola ensonga, oba okuwa endowooza ku pulojekiti. Kebera amagezi ga AI era okakase amawulire g’emisomo okuva eri abagitegeka.",
    prompts: ["Nteekateeka y’okusoma", "Nnyonnyola ensonga", "Pulojekiti y’obukugu", "Vvuunula mu Luganda"],
    privacy: "Omuwabuzi akozesa Gemini eya Google nga seva ey’ekyama etandise. Obubaka bwo buweerezebwa eri Google okufuna eky’okuddamu era tebuterekebwa mu demo eno. Okugikozesa, teeka GEMINI_API_KEY mu fayiro .env mu folda ya pulojekiti, oluvannyuma tandika node server.js. Toteka kisumuluzo mu koodi ya browser era togabana fayiro .env.",
    welcome: "Gyebale ko! Tubuulire ky’osoma n’obuyambi bw’oyagala.",
    messageLabel: "Obubaka bwo",
    placeholder: "Okugeza: Nnina essaawa 4 buli wiiki era njagala okuyiga okukola emikutu gya yintaneeti…",
    send: "Weereza obubaka",
    thinking: "Nkyalowooza…",
    clear: "Sangula emboozi",
    configured: "Gemini etegekeddwa",
    notConfigured: "Gemini tenategekebwa",
    offline: "Seva y’omuwabuzi teriiko",
    setupError: "Gemini tenategekebwa. Teeka ekisumuluzo ekipya mu GEMINI_API_KEY mu fayiro .env, oluvannyuma tandika node server.js nate. Kikuume nga kya kyama.",
    offlineError: "Gemini yeetaaga seva ey’ekyama. Yingira AfriSkills.io ng’oyita ku seva eyo okwogera n’omuwabuzi.",
    missingError: "Gemini teyeungiddwa. Tandika seva ey’ekyama ng’olina GEMINI_API_KEY; toteka kisumuluzo mu koodi ya browser.",
    failedError: "Gemini taddamu. Ddamu ogezeeko.",
    translateDescription: "Wandika ebiwandiiko mu Lungereza ofune okuvvuunula mu Luganda okukuyamba mu kusoma.",
    sourceLabel: "Ebiwandiiko mu Lungereza",
    sourcePlaceholder: "Wandiika oba oteekemu ebiwandiiko mu Lungereza…",
    translate: "Vvuunula mu Luganda",
    translating: "Nkyavvuunula…",
    translationTitle: "Ebyavvuunuddwa mu Luganda",
    requestLabel: "Namba y’okusaba",
    translationFailed: "Sisobodde kuvvuunula biwandiiko bino. Ddamu ogezeeko.",
  },
};

function currentLanguage() {
  return coachLanguage.value === "lg" ? "lg" : "en";
}

function updateCoachLanguage() {
  const language = currentLanguage();
  const copy = coachCopy[language];
  document.querySelector("#coach-eyebrow").textContent = copy.eyebrow;
  document.querySelector("#coach-description").firstChild.textContent = `${copy.description} `;
  document.querySelector(".coach-language").firstChild.textContent = `${copy.language} `;
  document.querySelector("#coach-intro-title").textContent = copy.introTitle;
  document.querySelector("#coach-intro-description").textContent = copy.introDescription;
  document.querySelectorAll("[data-coach-en]").forEach((button, index) => {
    button.textContent = copy.prompts[index];
  });
  const privacy = document.querySelector("#coach-privacy");
  privacy.replaceChildren(document.createTextNode(copy.privacy));
  const welcome = document.querySelector("#coach-welcome");
  if (welcome) welcome.textContent = copy.welcome;
  document.querySelector("#coach-messages").setAttribute("aria-label", language === "lg" ? "Emboozi n’omuwabuzi" : "Coach conversation");
  document.querySelector("#coach-message-label").textContent = copy.messageLabel;
  coachInput.placeholder = copy.placeholder;
  coachSend.textContent = sendingMessage ? copy.thinking : copy.send;
  document.querySelector("#translation-description").textContent = copy.translateDescription;
  document.querySelector("#translation-source-label").textContent = copy.sourceLabel;
  translationSource.placeholder = copy.sourcePlaceholder;
  translationSubmit.textContent = translating ? copy.translating : copy.translate;
  document.querySelector("#translation-result-title").textContent = copy.translationTitle;
  document.querySelector("#translation-request-label").textContent = copy.requestLabel;
  document.querySelector("#coach-clear").textContent = copy.clear;
  coachStatus.textContent = coachReady ? copy.configured : coachStatus.classList.contains("muted") && coachStatus.dataset.offline === "true" ? copy.offline : copy.notConfigured;
  if (connectionError === "setup") coachError.textContent = copy.setupError;
  if (connectionError === "offline") coachError.textContent = copy.offlineError;
  document.querySelector("#coach-language").setAttribute("aria-label", copy.language);
  document.querySelector(".coach-prompts").setAttribute("aria-label", language === "lg" ? "Eby’okulabirako by’ebibuuzo" : "Example questions");
}

function addCoachMessage(role, text) {
  coachMessages.querySelector(".coach-welcome")?.remove();
  const message = document.createElement("div");
  message.className = `coach-message ${role}`;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  message.append(paragraph);
  coachMessages.append(message);
  coachMessages.scrollTop = coachMessages.scrollHeight;
}

async function checkCoachConnection() {
  try {
    const response = await fetch("/api/coach/status");
    if (!response.ok) throw new Error("Coach server is not responding.");
    const status = await response.json();
    coachReady = status.configured === true;
    coachStatus.dataset.offline = "false";
    coachStatus.classList.toggle("verified", coachReady);
    coachStatus.classList.toggle("muted", !coachReady);
    connectionError = coachReady ? "" : "setup";
  } catch {
    coachReady = false;
    coachStatus.dataset.offline = "true";
    coachStatus.classList.remove("verified");
    coachStatus.classList.add("muted");
    connectionError = "offline";
  }
  updateCoachLanguage();
}

document.querySelectorAll("[data-coach-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    coachInput.value = currentLanguage() === "lg" ? button.dataset.coachLg : button.dataset.coachEn;
    coachInput.focus();
  });
});

coachLanguage.addEventListener("change", () => {
  try {
    localStorage.setItem("coach-language", currentLanguage());
  } catch (error) {
    console.error("Unable to save the coach language preference.", error);
  }
  updateCoachLanguage();
});

try {
  const savedLanguage = localStorage.getItem("coach-language");
  if (savedLanguage === "lg" || savedLanguage === "en") coachLanguage.value = savedLanguage;
} catch (error) {
  console.error("Unable to read the coach language preference.", error);
}
updateCoachLanguage();

coachForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = coachInput.value.trim();
  if (!message || coachSend.disabled) return;
  if (!coachReady) {
    connectionError = "setup";
    updateCoachLanguage();
    return;
  }

  connectionError = "";
  coachError.textContent = "";
  connectionError = "";
  addCoachMessage("user", message);
  coachHistory.push({ role: "user", text: message });
  coachInput.value = "";
  sendingMessage = true;
  coachSend.disabled = true;
  updateCoachLanguage();

  try {
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: coachHistory.slice(-12),
        language: currentLanguage(),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Gemini could not answer. Please try again.");
    if (typeof result.text !== "string" || !result.text.trim()) {
      throw new Error("Gemini returned an empty response. Please try again.");
    }
    coachHistory.push({ role: "model", text: result.text });
    addCoachMessage("model", result.text);
  } catch (error) {
    coachHistory.pop();
    coachInput.value = message;
    coachError.textContent = error.message || coachCopy[currentLanguage()].failedError;
  } finally {
    sendingMessage = false;
    coachSend.disabled = false;
    updateCoachLanguage();
  }
});

document.querySelector("#coach-clear").addEventListener("click", () => {
  coachHistory.length = 0;
  coachMessages.replaceChildren();
  const welcome = document.createElement("p");
  welcome.id = "coach-welcome";
  welcome.className = "coach-welcome";
  welcome.textContent = coachCopy[currentLanguage()].welcome;
  coachMessages.append(welcome);
  coachError.textContent = "";
  coachInput.value = "";
});

checkCoachConnection();

translationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = translationSource.value.trim();
  if (!text || translating) return;
  if (!coachReady) {
    translationError.textContent = coachCopy[currentLanguage()].setupError;
    return;
  }

  translating = true;
  translationError.textContent = "";
  translationResult.hidden = true;
  translationSubmit.disabled = true;
  updateCoachLanguage();

  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        source_language: "en",
        target_language: "lg",
        context: "AI coaching",
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || coachCopy[currentLanguage()].translationFailed);
    if (typeof result.translated_text !== "string" || !result.translated_text.trim() ||
      typeof result.request_id !== "string" || !result.request_id.trim()) {
      throw new Error(coachCopy[currentLanguage()].translationFailed);
    }

    document.querySelector("#translation-output").textContent = result.translated_text;
    document.querySelector("#translation-request-id").textContent = result.request_id;
    translationResult.hidden = false;
  } catch (error) {
    translationError.textContent = error.message || coachCopy[currentLanguage()].translationFailed;
  } finally {
    translating = false;
    translationSubmit.disabled = false;
    updateCoachLanguage();
  }
});
