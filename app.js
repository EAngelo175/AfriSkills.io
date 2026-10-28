const $ = (s) => document.querySelector(s);
function reportStorageError(action, key, error) {
  console.error(`Unable to ${action} local data for "${key}".`, error);
  document.dispatchEvent(new CustomEvent("app-storage-error", { detail: { action, key } }));
}

const store = {
  get: (k) => {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch (error) {
      reportStorageError("read", k, error);
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (error) {
      reportStorageError("save", k, error);
    }
  },
};

document.addEventListener("app-storage-error", (event) => {
  const notice = $("#storage-error");
  if (!notice) return;
  notice.textContent = `The browser could not ${event.detail.action} local data for "${event.detail.key}". Changes may not be saved.`;
  notice.hidden = false;
});

const roles = {
  "Junior web developer": [
    "HTML/CSS basics",
    "JavaScript basics",
    "Build a small page",
    "Use Git and GitHub",
    "Add a backend or form",
    "Polish and test",
    "Publish and explain",
  ],
  "Data analyst": [
    "Spreadsheet basics",
    "Clean a dataset",
    "Learn SQL queries",
    "Make charts",
    "Find 3 insights",
    "Write a short report",
    "Present your findings",
  ],
  "UI/UX designer": [
    "Study good interfaces",
    "User research",
    "Sketch wireframes",
    "Visual hierarchy",
    "Prototype",
    "Test with 3 people",
    "Portfolio case study",
  ],
};

const projects = {
  "Junior web developer": "Local business landing page",
  "Data analyst": "Community survey analysis",
  "UI/UX designer": "Mobile app redesign",
};

const courses = [
  { t: "Intro to Web Development", p: "Free Code Camp", topic: "Web", price: "Free" },
  { t: "Data Analysis Basics", p: "Open University", topic: "Data", price: "Free" },
  { t: "UX Design Foundations", p: "Design Academy", topic: "Design", price: "Paid" },
  { t: "Python for Everybody", p: "Coursera (audit)", topic: "Programming", price: "Free" },
  { t: "Digital Marketing Starter", p: "Google Skillshop", topic: "Business", price: "Free" },
  { t: "SQL for Beginners", p: "Khan Academy", topic: "Data", price: "Free" },
];

const jobs = [
  { t: "Junior Web Intern", o: "Kampala Tech Hub", ty: "Internship", loc: "Kampala" },
  { t: "Data Entry Analyst", o: "Green Farms Ltd", ty: "Job", loc: "Remote" },
  { t: "Graduate Attachment — Design", o: "Creative Studio", ty: "Attachment", loc: "Entebbe" },
];

const views = [...document.querySelectorAll(".view")];
const links = [...document.querySelectorAll("nav a")];

function route() {
  const id = (location.hash || "#home").slice(1);
  views.forEach((v) => v.classList.toggle("on", v.id === id));
  links.forEach((a) => a.classList.toggle("on", a.hash === `#${id}`));
}

addEventListener("hashchange", route);
route();

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);

$("#role").innerHTML = Object.keys(roles)
  .map((r) => `<option>${esc(r)}</option>`)
  .join("");

let done = store.get("done") || {};

function showRoad(d) {
  if (!d) {
    $("#road").innerHTML = "";
    return;
  }

  $("#road").innerHTML =
    `<h3>${esc(d.nm || "Your")} learning roadmap <span class="tag">${esc(d.role)}</span></h3>` +
    `<p class="tiny">${d.hrs} hours/week · template plan, review and adapt.</p>` +
    roles[d.role]
      .map(
        (x, i) =>
          `<div class="day"><b>DAY ${i + 1}</b><label><input type="checkbox" data-d="${i}" ${
            done[d.role + i] ? "checked" : ""
          }> ${esc(x)}</label></div>`,
      )
      .join("");

  $("#ptitle").textContent = projects[d.role];
  $("#tasks").innerHTML = [
    "Define the goal",
    "Plan the steps",
    "Build a first version",
    "Test it",
    "Write a short explanation",
  ]
    .map(
      (x, i) =>
        `<li><label><input type="checkbox" data-p="${i}" ${
          done[`p${d.role}${i}`] ? "checked" : ""
        }> ${x}</label></li>`,
    )
    .join("");
}

$("#pf").onsubmit = (e) => {
  e.preventDefault();
  const d = {
    nm: $("#nm").value.trim().slice(0, 60),
    role: $("#role").value,
    hrs: $("#hrs").value,
  };
  store.set("plan", d);
  showRoad(d);
};

document.addEventListener("change", (e) => {
  const t = e.target;
  const p = store.get("plan");
  if (!p) return;
  if (t.dataset.d !== undefined) done[p.role + t.dataset.d] = t.checked;
  if (t.dataset.p !== undefined) done[`p${p.role}${t.dataset.p}`] = t.checked;
  store.set("done", done);
});

showRoad(store.get("plan"));

$("#topic").innerHTML += [...new Set(courses.map((c) => c.topic))]
  .map((t) => `<option>${t}</option>`)
  .join("");

function drawCourses() {
  const q = $("#q").value.toLowerCase();
  const tp = $("#topic").value;
  const pr = $("#price").value;
  const l = courses.filter(
    (c) =>
      (!q || (c.t + c.p).toLowerCase().includes(q)) &&
      (!tp || c.topic === tp) &&
      (!pr || c.price === pr),
  );

  $("#clist").innerHTML =
    l
      .map(
        (c) =>
          `<div class="card"><span class="tag">${c.topic}</span><h3>${c.t}</h3>` +
          `<p>${c.p} · <b>${c.price}</b></p>` +
          `<button class="btn" data-save="${c.t}">${
            (store.get("saved") || []).includes(c.t) ? "Saved ✓" : "Save to My Learning"
          }</button></div>`,
      )
      .join("") || "<p>No matching courses.</p>";
}

["#q", "#topic", "#price"].forEach((s) => $(s).addEventListener("input", drawCourses));
drawCourses();

document.addEventListener("click", (e) => {
  const s = e.target.dataset.save;
  if (s) {
    const a = store.get("saved") || [];
    if (!a.includes(s)) a.push(s);
    store.set("saved", a);
    drawCourses();
  }

  const j = e.target.dataset.apply;
  if (j) {
    const a = store.get("jobInterest") || [];
    if (!a.includes(j)) a.push(j);
    store.set("jobInterest", a);
    drawJobs();
  }
});

function drawJobs() {
  const interested = store.get("jobInterest") || [];
  $("#jlist").innerHTML = jobs
    .map(
      (j) =>
        `<div class="job"><span class="tag">${j.ty}</span><h3>${j.t}</h3>` +
        `<p>${j.o} · ${j.loc} · Not verified</p>` +
        `<button class="btn" data-apply="${j.t}" ${interested.includes(j.t) ? "disabled" : ""}>${
          interested.includes(j.t) ? "Interest saved ✓" : "Save interest"
        }</button></div>`,
    )
    .join("");
}

drawJobs();

const cv = $("#cv");
const savedProfile = store.get("cvProfile") || {};
["name", "education", "skills", "projects"].forEach((field) => {
  if (cv.elements.namedItem(field)) cv.elements.namedItem(field).value = savedProfile[field] || "";
});
const draw = () => {
  const f = new FormData(cv);
  store.set("cvProfile", Object.fromEntries(f.entries()));
  const L = [];
  if (f.get("name")) L.push(f.get("name").toUpperCase());
  [
    ["education", "EDUCATION"],
    ["skills", "SKILLS"],
    ["projects", "PROJECTS"],
  ].forEach(([k, h]) => f.get(k) && L.push(`\n${h}\n${f.get(k)}`));
  $("#out").textContent = L.join("\n") || "Your CV draft appears here. Only add what is true.";
};

cv.addEventListener("input", draw);
draw();

$("#copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("#out").textContent);
    $("#copy").textContent = "Copied!";
  } catch {
    alert("Copy blocked; select the text manually.");
  }
};
