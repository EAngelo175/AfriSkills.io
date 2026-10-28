const providerStore = {
  read(key, fallback) {
    return store.get(key) ?? fallback;
  },
  write(key, value) {
    store.set(key, value);
  },
};

const providerTypes = [
  "University",
  "Institute",
  "NGO",
  "Vocational Training Centre",
  "Private Academy",
  "Government Agency",
  "Other",
];
const courseCategories = ["Technology", "Business", "Design", "Data", "Health", "Education", "Other"];
const courseSkills = ["Communication", "Digital literacy", "Problem solving", "Research", "Teamwork"];
const learningLevels = ["Beginner", "Intermediate", "Advanced"];
const deliveryFormats = ["Online", "In-person", "Hybrid"];
const courseStatuses = ["Draft", "Pending Review", "Published", "Rejected", "Unpublished", "Archived"];
const organizationStatuses = ["Draft", "Pending Review", "Under Review", "Verified", "Rejected", "Suspended"];
let providerTab = "overview";
let adminTab = "overview";
let editingCourseId = null;

function readOrg() {
  return providerStore.read("kbOrganization", {});
}

function safeExternalUrl(value) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function readProviderCourses() {
  return providerStore.read("kbCourses", []);
}

function readTaxonomy() {
  return providerStore.read("kbTaxonomy", { categories: courseCategories, skills: courseSkills });
}

function renderMyLearning() {
  const list = document.querySelector("#my-learning-list");
  if (!list) return;
  const saved = providerStore.read("kbSaved", []);
  const states = providerStore.read("kbLearnerStates", {});
  const available = [
    ...courses.map((course) => ({ id: `curated-${course.t}`, title: course.t, provider: course.p })),
    ...readProviderCourses().map((course) => ({ id: course.id, title: course.title, provider: course.organization })),
  ];
  const mine = available.filter((course) => saved.includes(course.id));
  list.innerHTML = mine.map((course) => `<article class="card">
    <span class="tag">${escapeHtml(states[course.id] || "Saved")}</span>
    <h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.provider)}</p>
    <p class="tiny">Progress and enrolment status are self-reported. No external provider confirmation is received.</p>
  </article>`).join("") || '<p class="card">No saved courses yet. Explore the Learning Hub to add one to My Learning.</p>';
}

function readInteractions() {
  return providerStore.read("kbInteractions", {});
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function options(values, selected = "") {
  return values.map((value) =>
    `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(value)}</option>`,
  ).join("");
}

function audit(message) {
  const entries = providerStore.read("kbAudit", []);
  entries.unshift({ message, date: new Date().toISOString() });
  providerStore.write("kbAudit", entries.slice(0, 100));
}

function setWorkspaceNavigation(forceDashboard = false) {
  const role = document.querySelector("#workspace-role").value;
  const allowed = {
    learner: ["home", "pathway", "courses", "coach", "my-learning", "project", "jobs"],
    recruiter: ["jobs", "recruiter"],
    provider: ["home", "courses", "provider"],
    admin: ["admin"],
  }[role];
  document.querySelectorAll("header nav a").forEach((link) => {
    const section = link.hash.slice(1);
    link.hidden = !allowed.includes(section);
  });
  const destination = {
    learner: "home",
    recruiter: "recruiter",
    provider: "provider",
    admin: "admin",
  }[role];
  if (forceDashboard || !allowed.includes(location.hash.slice(1))) location.hash = destination;
}

function orgStatus() {
  return readOrg().status || "Draft";
}

function providerOverview() {
  const allCourses = readProviderCourses();
  const interactions = readInteractions();
  const status = orgStatus();
  const counts = allCourses.reduce((total, course) => {
    const activity = interactions[course.id] || {};
    total.interest += activity.sharedInterest || 0;
    total.saved += activity.saves || 0;
    total.reportedEnrolments += activity.reportedEnrolments || 0;
    total.reportedCompletions += activity.reportedCompletions || 0;
    return total;
  }, { interest: 0, saved: 0, reportedEnrolments: 0, reportedCompletions: 0 });
  const nextStep = status === "Verified"
    ? `<h3>You're verified. Next, submit a course for review.</h3><p>Courses are reviewed before they appear in the Learning Hub.</p><button class="btn" data-provider-tab="add-course">Add a course</button>`
    : status === "Pending Review" || status === "Under Review"
      ? `<h3>Your organization is awaiting review.</h3><p>You can prepare course drafts while the review is in progress. Publishing is available after identity verification.</p><button class="btn secondary" data-provider-tab="verification">Check verification status</button><button class="btn text-button" data-provider-tab="courses">View course drafts</button>`
      : status === "Rejected"
        ? `<h3>Update your profile to continue.</h3><p>Review the administrator's note, make corrections, and submit the profile again.</p><button class="btn" data-provider-tab="organization">Update organization profile</button>`
        : status === "Suspended"
          ? `<h3>Publishing is paused.</h3><p>Contact the platform administrator and review the notice on your verification page.</p><button class="btn secondary" data-provider-tab="verification">View status and notes</button>`
          : `<h3>Start by completing your organization profile.</h3><p>Submit it for administrator review. Verified organizations can then submit courses for publication.</p><button class="btn" data-provider-tab="organization">Complete organization profile</button>`;
  return `<div class="card next-step"><span class="eye">YOUR NEXT STEP</span>${nextStep}</div>
  <div class="grid summary-grid">
    ${summaryCard("Published courses", allCourses.filter((course) => course.status === "Published").length)}
    ${summaryCard("Draft courses", allCourses.filter((course) => course.status === "Draft").length)}
    ${summaryCard("Pending course reviews", allCourses.filter((course) => course.status === "Pending Review").length)}
    ${summaryCard("Consented learner interest", counts.interest)}
    ${summaryCard("Course engagement", counts.saved + counts.interest)}
    ${summaryCard("Outbound provider clicks", allCourses.reduce((total, course) => total + ((interactions[course.id] || {}).outboundClicks || 0), 0))}
  </div>
  <div class="card"><h3>Organization verification</h3>
    <p>Status: <b>${escapeHtml(orgStatus())}</b></p>
    <p>Verification on AfriSkills.io confirms platform identity review only. It does not represent official education accreditation.</p>
    <button class="btn" data-provider-tab="verification">View status</button>
  </div>
  <p class="tiny">Engagement counts are local prototype interactions only. Page views, provider-confirmed enrolments, verified completions, and in-platform applications are not tracked here.</p>`;
}

function summaryCard(label, value) {
  return `<article class="card metric-card"><span>${escapeHtml(label)}</span><strong>${value}</strong></article>`;
}

function organizationForm() {
  const org = readOrg();
  return `<form id="organization-form" class="card form-grid">
    <label>Official organization name<input name="name" required value="${escapeHtml(org.name)}"></label>
    <label>Organization type<select name="type" required><option value="">Select type</option>${options(providerTypes, org.type)}</select></label>
    <label>Registration / accreditation information (self-reported)<input name="registration" value="${escapeHtml(org.registration)}"></label>
    <label>Official website<input name="website" type="url" placeholder="https://" value="${escapeHtml(org.website)}"></label>
    <label>Organization email<input name="email" type="email" required value="${escapeHtml(org.email)}"></label>
    <label>Public contact information<input name="contact" value="${escapeHtml(org.contact)}"></label>
    <label>Country<input name="country" value="${escapeHtml(org.country)}"></label>
    <label>Region<input name="region" value="${escapeHtml(org.region)}"></label>
    <label>District<input name="district" value="${escapeHtml(org.district)}"></label>
    <label>Physical address<input name="address" value="${escapeHtml(org.address)}"></label>
    <label>Authorized representative name<input name="representative" required value="${escapeHtml(org.representative)}"></label>
    <label>Representative role<input name="representativeRole" value="${escapeHtml(org.representativeRole)}"></label>
    <label class="wide">Organization description<textarea name="description" rows="4">${escapeHtml(org.description)}</textarea></label>
    <label class="wide">Learning areas (comma-separated)<input name="learningAreas" value="${escapeHtml(org.learningAreas)}"></label>
    <label>Organization logo<input type="file" accept="image/*"></label>
    <label>Supporting documentation<input type="file" multiple></label>
    <p class="tiny wide">File selection is not uploaded or stored in this browser demo. Registration or accreditation details are self-reported and are not independently confirmed.</p>
    <div class="wide form-actions"><button class="btn">${org.status === "Verified" ? "Save and resubmit for review" : "Save organization draft"}</button>
      <button class="btn secondary" type="button" data-org-submit>Submit for review</button></div>
  </form>`;
}

function verificationPanel() {
  const org = readOrg();
  const status = org.status || "Draft";
  return `<div class="card"><span class="tag">${escapeHtml(status)}</span>
    <h3>Organization identity review</h3>
    <p>${org.reason ? `Review note: ${escapeHtml(org.reason)}` : "No administrator review note has been recorded."}</p>
    <p>Verified organizations have passed AfriSkills.io's platform identity review. This status is separate from official accreditation, licensing, or recognition by an education authority.</p>
    ${status === "Rejected" ? '<p>Update the organization profile to address the review note, then submit it again.</p>' : ""}
    <button class="btn" data-provider-tab="organization">Review organization profile</button>
  </div>`;
}

function courseForm(course = {}) {
  const value = (key) => escapeHtml(course[key] || "");
  const checked = (key) => course[key] ? "checked" : "";
  return `<form id="course-form" class="card form-grid">
    <label>Course title<input name="title" required value="${value("title")}"></label>
    <label>Short summary<input name="summary" required maxlength="180" value="${value("summary")}"></label>
    <label class="wide">Detailed description<textarea name="description" rows="4" required>${value("description")}</textarea></label>
    <label class="wide">Learning outcomes<textarea name="outcomes" rows="3" placeholder="One outcome per line" required>${value("outcomes")}</textarea></label>
    <label>Provider organization<input value="${escapeHtml(readOrg().name || "Complete organization profile")}" disabled></label>
    <label>Category<select name="category" required><option value="">Select category</option>${options(readTaxonomy().categories, course.category)}</select></label>
    <label>Subject area<input name="subject" value="${value("subject")}"></label>
    <label>Skills taught<input name="skills" placeholder="Comma-separated" value="${value("skills")}"></label>
    <label>Target learner level<select name="level" required><option value="">Select level</option>${options(learningLevels, course.level)}</select></label>
    <label>Prerequisites<input name="prerequisites" value="${value("prerequisites")}"></label>
    <label>Delivery format<select name="format" required><option value="">Select format</option>${options(deliveryFormats, course.format)}</select></label>
    <label>Course duration<input name="duration" placeholder="e.g. 8 weeks" value="${value("duration")}"></label>
    <label>Estimated study hours<input name="studyHours" type="number" min="0" value="${value("studyHours")}"></label>
    <label>Start date<input name="startDate" type="date" value="${value("startDate")}"></label>
    <label>End date<input name="endDate" type="date" value="${value("endDate")}"></label>
    <label class="checkbox-label"><input name="selfPaced" type="checkbox" ${checked("selfPaced")}> Self-paced availability</label>
    <label>Country<input name="country" value="${value("country")}"></label>
    <label>In-person location<input name="location" value="${value("location")}"></label>
    <label>Language of instruction<input name="language" value="${value("language")}"></label>
    <label>Fee status<select name="feeType" required>${options(["", "Free", "Paid", "Scholarship-supported"], course.feeType)}</select></label>
    <label>Course fee<input name="fee" type="number" min="0" step="0.01" value="${value("fee")}"></label>
    <label>Currency<input name="currency" maxlength="3" placeholder="e.g. UGX" value="${value("currency")}"></label>
    <label class="wide">Scholarship eligibility / application details<textarea name="scholarshipDetails" rows="2">${value("scholarshipDetails")}</textarea></label>
    <label>Enrolment deadline<input name="deadline" type="date" value="${value("deadline")}"></label>
    <label>Official registration / enrolment URL<input name="enrolmentUrl" type="url" placeholder="https://" value="${value("enrolmentUrl")}"></label>
    <label>Course image / thumbnail<input type="file" accept="image/*"></label>
    <label class="checkbox-label"><input name="certificate" type="checkbox" ${checked("certificate")}> Certificate availability confirmed by provider</label>
    <label>Certificate issuing organization<input name="certificateIssuer" value="${value("certificateIssuer")}"></label>
    <label class="wide">Assessment or project requirements<textarea name="assessment" rows="2">${value("assessment")}</textarea></label>
    <label class="wide">Accessibility information<textarea name="accessibility" rows="2">${value("accessibility")}</textarea></label>
    <label>Last verified by provider<input name="lastVerified" type="date" value="${value("lastVerified")}"></label>
    <p class="tiny wide">Course information is provider-submitted. Selecting a file does not upload it. This prototype links to external enrolment pages; it does not host course content, process fees or enrolments, or issue certificates.</p>
    <div class="wide form-actions">
      <button class="btn" name="intent" value="draft">Save draft</button>
      <button class="btn secondary" name="intent" value="review">Save and submit for review</button>
      <button class="btn text-button" type="button" data-provider-tab="courses">Cancel</button>
    </div>
  </form>`;
}

function courseList() {
  const courses = readProviderCourses();
  if (!courses.length) return '<div class="card"><p>You have not created any courses yet.</p><button class="btn" data-provider-tab="add-course">Add a course</button></div>';
  return `<div class="grid">${courses.map((course) => `<article class="card">
    <span class="tag">${escapeHtml(course.status)}</span><h3>${escapeHtml(course.title)}</h3>
    <p>${escapeHtml(course.summary)}</p><p>${escapeHtml(course.category || "")} · ${escapeHtml(course.format || "Format not provided")}</p>
    <details><summary>Preview course details</summary><p>${escapeHtml(course.description)}</p>
      <p>Level: ${escapeHtml(course.level || "Not specified")} · Fee: ${escapeHtml(course.feeType || "Not specified")}</p>
      <p>Last verified by provider: ${escapeHtml(course.lastVerified || "Not provided")}</p></details>
    ${course.status === "Rejected" && course.reviewNote ? `<p class="review-note">Review note: ${escapeHtml(course.reviewNote)}</p>` : ""}
    <div class="button-row"><button class="btn small" data-edit-course="${escapeHtml(course.id)}">Edit</button>
    ${course.status === "Draft" || course.status === "Rejected" || course.status === "Unpublished"
      ? `<button class="btn small secondary" data-course-review="${escapeHtml(course.id)}">Submit for review</button>` : ""}
    ${course.status === "Published"
      ? `<button class="btn small secondary" data-course-unpublish="${escapeHtml(course.id)}">Unpublish</button>` : ""}
    ${course.status !== "Archived" ? `<button class="btn small text-button" data-course-archive="${escapeHtml(course.id)}">Archive</button>` : ""}</div>
  </article>`).join("")}</div>`;
}

function providerInterest() {
  const courses = readProviderCourses();
  const interactions = readInteractions();
  if (!courses.length) return '<div class="card"><p>Learner interest will appear after courses are published and learners explicitly opt in to sharing.</p></div>';
  return `<div class="grid">${courses.map((course) => {
    const stats = interactions[course.id] || {};
    return `<article class="card"><h3>${escapeHtml(course.title)}</h3>
      <p>Shared learner interest: <b>${stats.sharedInterest || 0}</b></p>
      <p>Saved: ${stats.saves || 0} · Learner-reported enrolments: ${stats.reportedEnrolments || 0} · Self-reported completions: ${stats.reportedCompletions || 0}</p>
      <p class="tiny">Aggregate counts only; this demo does not disclose learner identities. Enrolments and completions are self-reported, not provider-confirmed.</p></article>`;
  }).join("")}</div>`;
}

function providerAnalytics() {
  const allCourses = readProviderCourses();
  const interactions = readInteractions();
  return `<div class="grid summary-grid">
    ${summaryCard("Total courses created", allCourses.length)}
    ${summaryCard("Published", allCourses.filter((course) => course.status === "Published").length)}
    ${summaryCard("Draft", allCourses.filter((course) => course.status === "Draft").length)}
    ${summaryCard("Saved by learners", allCourses.reduce((sum, course) => sum + ((interactions[course.id] || {}).saves || 0), 0))}
    ${summaryCard("Consented interest", allCourses.reduce((sum, course) => sum + ((interactions[course.id] || {}).sharedInterest || 0), 0))}
    ${summaryCard("Outbound provider clicks", allCourses.reduce((sum, course) => sum + ((interactions[course.id] || {}).outboundClicks || 0), 0))}
  </div><div class="card"><h3>Metrics not available in this prototype</h3>
    <p>Outbound clicks count opening the listed provider URL in this browser; they do not confirm enrolment. Course page views, applications, provider-confirmed enrolments, and verified completions are not tracked. Reported enrolments and completions are learner self-reports only.</p>
    <h4>Most saved courses (local demo counts)</h4>
    <ol>${allCourses.slice().sort((a, b) => ((interactions[b.id] || {}).saves || 0) - ((interactions[a.id] || {}).saves || 0))
      .slice(0, 5).map((course) => `<li>${escapeHtml(course.title)} — ${(interactions[course.id] || {}).saves || 0} saves</li>`).join("") || "<li>No learner saves recorded.</li>"}</ol>
  </div>`;
}

function providerPanel() {
  const panel = document.querySelector("#provider-panel");
  document.querySelector("#provider-status").textContent = orgStatus();
  if (providerTab === "overview") panel.innerHTML = providerOverview();
  if (providerTab === "organization") panel.innerHTML = organizationForm();
  if (providerTab === "courses") panel.innerHTML = courseList();
  if (providerTab === "add-course") {
    const course = editingCourseId ? readProviderCourses().find((item) => item.id === editingCourseId) : null;
    panel.innerHTML = `<h3>${course ? "Edit course" : "Create a course"}</h3>${courseForm(course || {})}`;
  }
  if (providerTab === "interest") panel.innerHTML = providerInterest();
  if (providerTab === "analytics") panel.innerHTML = providerAnalytics();
  if (providerTab === "credentials") panel.innerHTML = `<div class="card"><h3>Certificates and credentials</h3>
    <p>Course certificate availability is displayed only when the provider submits that information. AfriSkills.io does not issue or verify certificates in this prototype.</p>
    <p>No certificate files or learner credentials are stored here.</p></div>`;
  if (providerTab === "verification") panel.innerHTML = verificationPanel();
  if (providerTab === "settings") panel.innerHTML = `<div class="card"><h3>Provider settings</h3>
    <p>Notification preferences, account security, and team access require an authenticated backend and are not available in this demo.</p></div>`;
  document.querySelectorAll("#provider .subnav [data-provider-tab]").forEach((button) => button.classList.toggle("active", button.dataset.providerTab === providerTab));
  document.querySelectorAll("#provider .nav-group").forEach((group) => {
    group.classList.toggle("contains-active", Boolean(group.querySelector("[data-provider-tab].active")));
  });
}

function changeProviderTab(tab) {
  providerTab = tab;
  if (tab !== "add-course") editingCourseId = null;
  document.querySelectorAll("#provider .subnav [data-provider-tab]").forEach((button) => button.classList.toggle("active", button.dataset.providerTab === tab));
  document.querySelector("#provider .subnav [data-provider-tab].active")?.closest("details")?.removeAttribute("open");
  providerPanel();
}

function saveOrganization(form, submitForReview = false) {
  const fields = Object.fromEntries(new FormData(form).entries());
  const previous = readOrg();
  const changed = Object.keys(fields).some((key) => (previous[key] || "") !== fields[key]);
  const requiresReview = submitForReview || (previous.status === "Verified" && changed);
  const organization = {
    ...previous,
    ...fields,
    status: requiresReview ? "Pending Review" : previous.status || "Draft",
    reason: requiresReview ? "" : previous.reason || "",
  };
  providerStore.write("kbOrganization", organization);
  if (previous.status === "Verified" && changed) {
    const allCourses = readProviderCourses();
    allCourses.forEach((course) => {
      if (course.status === "Published") course.status = "Unpublished";
    });
    providerStore.write("kbCourses", allCourses);
  }
  audit(requiresReview ? "Organization submitted for verification review" : "Organization profile saved as draft");
  providerPanel();
  renderAdmin();
}

function saveCourse(form, intent) {
  const fields = Object.fromEntries(new FormData(form).entries());
  if (fields.feeType === "Paid" && (!fields.fee || !fields.currency)) {
    alert("Enter the course fee and currency for a paid course.");
    return;
  }
  if (fields.feeType === "Scholarship-supported" && !fields.scholarshipDetails.trim()) {
    alert("Add scholarship eligibility or application details.");
    return;
  }
  if (fields.format === "In-person" && (!fields.location.trim() || !fields.country.trim())) {
    alert("Add the country and location for in-person training.");
    return;
  }
  const registrationUrl = fields.enrolmentUrl;
  if (registrationUrl && !safeExternalUrl(registrationUrl)) {
    form.elements.enrolmentUrl.setCustomValidity("Use a valid http or https registration URL.");
    form.reportValidity();
    form.elements.enrolmentUrl.setCustomValidity("");
    return;
  }
  const allCourses = readProviderCourses();
  let course = editingCourseId ? allCourses.find((item) => item.id === editingCourseId) : null;
  if (!course) {
    course = { id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, status: "Draft" };
    allCourses.push(course);
  }
  Object.assign(course, fields, {
    selfPaced: form.elements.selfPaced.checked,
    certificate: form.elements.certificate.checked,
    organization: readOrg().name || "",
    status: intent === "review" ? "Pending Review" : "Draft",
    reviewNote: intent === "review" ? "" : course.reviewNote || "",
  });
  providerStore.write("kbCourses", allCourses);
  audit(`${intent === "review" ? "Course submitted for review" : "Course draft saved"}: ${course.title}`);
  editingCourseId = null;
  changeProviderTab("courses");
  renderLearningHub();
  renderAdmin();
}

function adminOrganizations() {
  const org = readOrg();
  if (!org.name) return '<div class="card"><p>No organization verification applications have been submitted.</p></div>';
  const reviewable = ["Pending Review", "Under Review"].includes(org.status);
  const isSuspended = org.status === "Suspended";
  return `<article class="card"><span class="tag">${escapeHtml(org.status || "Draft")}</span><h3>${escapeHtml(org.name)}</h3>
    <p>${escapeHtml(org.type || "Organization type not provided")} · ${escapeHtml(org.country || "")}</p>
    <p>Registration/accreditation self-report: ${escapeHtml(org.registration || "Not provided")}</p>
    <p>Files are not available for review in this demo because uploads are not implemented.</p>
    ${!reviewable && !isSuspended && org.status !== "Verified" ? "<p>This profile has not been submitted for administrator review.</p>" : ""}
    <label>Decision reason<textarea id="org-decision-reason">${escapeHtml(org.reason || "")}</textarea></label>
    ${reviewable ? `<div class="button-row">
      <button class="btn small" data-org-decision="Under Review">Mark under review</button>
      <button class="btn small" data-org-decision="Verified">Verify identity</button>
      <button class="btn small secondary" data-org-decision="Rejected">Reject / request corrections</button>
      <button class="btn small secondary" data-org-decision="Suspended">Suspend</button>
    </div>` : ""}
    ${org.status === "Verified" ? '<button class="btn small secondary" data-org-decision="Suspended">Suspend organization</button>' : ""}
    ${isSuspended ? '<button class="btn small" data-org-decision="Pending Review">Restore to pending review</button>' : ""}
    <p class="tiny">Verification confirms platform identity review only; it does not mean the organization is officially accredited.</p></article>`;
}

function adminCourses() {
  const queued = readProviderCourses().filter((course) => course.status === "Pending Review");
  if (!queued.length) return '<div class="card"><p>No courses are waiting for review.</p></div>';
  return queued.map((course) => `<article class="card"><h3>${escapeHtml(course.title)}</h3>
    <p>${escapeHtml(course.organization)} · ${escapeHtml(course.category)} · ${escapeHtml(course.format)}</p>
    <p>${escapeHtml(course.summary)}</p><p>Last-verified date reported by provider: ${escapeHtml(course.lastVerified || "Not provided")}</p>
    <label>Decision reason<textarea id="course-reason-${escapeHtml(course.id)}">${escapeHtml(course.reviewNote || "")}</textarea></label>
    <div class="button-row">
      <button class="btn small" data-admin-course="${escapeHtml(course.id)}" data-decision="Published" ${orgStatus() !== "Verified" ? "disabled" : ""}>Approve &amp; publish</button>
      <button class="btn small secondary" data-admin-course="${escapeHtml(course.id)}" data-decision="Rejected">Reject / request corrections</button>
    </div>${orgStatus() !== "Verified" ? '<p class="tiny">The organization must be identity-verified before its courses can be approved for publication.</p>' : ""}
  </article>`).join("");
}

function renderAdmin() {
  const panel = document.querySelector("#admin-panel");
  if (!panel) return;
  if (adminTab === "overview") {
    const org = readOrg();
    const pendingCourses = readProviderCourses().filter((course) => course.status === "Pending Review").length;
    const pendingReports = providerStore.read("kbReports", []).filter((report) => report.status !== "Reviewed").length;
    const pendingOpportunities = providerStore.read("kbOpportunities", []).filter((item) => item.status === "Pending Review").length;
    const needsReview = (["Pending Review", "Under Review"].includes(org.status) ? 1 : 0) +
      pendingCourses + pendingReports + pendingOpportunities;
    panel.innerHTML = `<div class="card admin-welcome"><span class="eye">ADMIN WORKSPACE</span>
      <h3>${needsReview ? `${needsReview} item${needsReview === 1 ? "" : "s"} need review` : "You're all caught up"}</h3>
      <p>${needsReview ? "Start with an organization identity review, then check course reports and submissions." : "New submissions and reports will appear in the review queue."}</p>
      <button class="btn" data-admin-tab="organizations">Open review queue</button>
    </div>
    <div class="grid summary-grid">
      ${adminSummaryCard("Organization applications", ["Pending Review", "Under Review"].includes(org.status) ? 1 : 0, "organizations")}
      ${adminSummaryCard("Course reviews", pendingCourses, "courses")}
      ${adminSummaryCard("Course reports", pendingReports, "reports")}
      ${adminSummaryCard("Opportunity reviews", pendingOpportunities, "opportunities")}
    </div>
    <h3 class="section-label">Manage the platform</h3>
    <div class="grid admin-shortcuts">
      <button class="card shortcut-card" data-admin-tab="published"><b>Published courses</b><span>Review or unpublish existing course listings</span></button>
      <button class="card shortcut-card" data-admin-tab="job-listings"><b>Published opportunities</b><span>Manage approved opportunity listings</span></button>
      <button class="card shortcut-card" data-admin-tab="accounts"><b>Provider accounts</b><span>Review provider status</span></button>
      <button class="card shortcut-card" data-admin-tab="taxonomy"><b>Categories &amp; skills</b><span>Maintain course taxonomy</span></button>
      <button class="card shortcut-card" data-admin-tab="audit"><b>Audit log</b><span>See significant recent changes</span></button>
    </div>`;
  }
  if (adminTab === "organizations") panel.innerHTML = adminOrganizations();
  if (adminTab === "courses") panel.innerHTML = adminCourses();
  if (adminTab === "published") {
    const published = readProviderCourses().filter((course) => course.status === "Published");
    panel.innerHTML = published.map((course) => `<article class="card"><h3>${escapeHtml(course.title)}</h3>
      <p>Provider: ${escapeHtml(course.organization)} · Status: Published</p>
      <button class="btn small secondary" data-admin-unpublish="${escapeHtml(course.id)}">Unpublish</button>
    </article>`).join("") || '<div class="card"><p>No approved courses are published.</p></div>';
  }
  if (adminTab === "reports") {
    const reports = providerStore.read("kbReports", []);
    panel.innerHTML = reports.map((report, index) => `<article class="card"><h3>${escapeHtml(report.title)}</h3><p>${escapeHtml(report.reason)}</p><p class="tiny">${escapeHtml(report.date)} · ${escapeHtml(report.status || "Pending review")}</p>
      ${report.status === "Reviewed" ? "" : `<button class="btn small" data-review-report="${index}">Mark reviewed</button>`}</article>`).join("") || '<div class="card"><p>No course reports have been submitted.</p></div>';
  }
  if (adminTab === "accounts") {
    const org = readOrg();
    panel.innerHTML = org.name ? `<div class="card"><h3>${escapeHtml(org.name)}</h3><p>Provider status: ${escapeHtml(org.status || "Draft")}</p>
      <p>Account suspension is represented by the organization verification status in this single-provider demo.</p>
      <label>Reason for status change<textarea id="org-decision-reason"></textarea></label>
      ${org.status !== "Suspended" ? '<button class="btn small secondary" data-org-decision="Suspended">Suspend provider</button>' : '<button class="btn small" data-org-decision="Pending Review">Restore to pending review</button>'}</div>` : '<div class="card"><p>No provider accounts are present.</p></div>';
  }
  if (adminTab === "taxonomy") {
    const taxonomy = readTaxonomy();
    panel.innerHTML = `<form id="taxonomy-form" class="card">
      <h3>Course categories</h3><p>${taxonomy.categories.map(escapeHtml).join(" · ")}</p>
      <label>Add category<input name="category"></label>
      <h3>Skills taxonomy</h3><p>${taxonomy.skills.map(escapeHtml).join(" · ")}</p>
      <label>Add skill<input name="skill"></label>
      <button class="btn">Save taxonomy</button>
    </form>`;
  }
  if (adminTab === "opportunities") {
    const opportunities = providerStore.read("kbOpportunities", []);
    const queue = opportunities.filter((item) => item.status === "Pending Review");
    panel.innerHTML = queue.map((item) => `<article class="card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.organization)}</p>
      <label>Decision reason<textarea id="opportunity-reason-${escapeHtml(item.id)}"></textarea></label>
      <button class="btn small" data-opportunity-decision="${escapeHtml(item.id)}" data-status="Published">Approve and publish</button>
      <button class="btn small secondary" data-opportunity-decision="${escapeHtml(item.id)}" data-status="Rejected">Reject listing</button>
    </article>`).join("") || '<div class="card"><p>No opportunity listings are waiting for review.</p></div>';
  }
  if (adminTab === "job-listings") {
    const opportunities = providerStore.read("kbOpportunities", []).filter((item) => item.status === "Published");
    panel.innerHTML = opportunities.map((item) => `<article class="card"><h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.organization)} · Published</p>
      <button class="btn small secondary" data-opportunity-decision="${escapeHtml(item.id)}" data-status="Archived">Archive listing</button>
    </article>`).join("") || '<div class="card"><p>No published provider opportunities.</p></div>';
  }
  if (adminTab === "audit") {
    const entries = providerStore.read("kbAudit", []);
    panel.innerHTML = `<div class="card"><h3>Local audit history</h3><ol>${entries.map((entry) => `<li>${escapeHtml(entry.date)} — ${escapeHtml(entry.message)}</li>`).join("") || "<li>No changes recorded.</li>"}</ol></div>`;
  }
  document.querySelectorAll("#admin .subnav [data-admin-tab]").forEach((button) => button.classList.toggle("active", button.dataset.adminTab === adminTab));
  document.querySelectorAll("#admin .nav-group").forEach((group) => {
    group.classList.toggle("contains-active", Boolean(group.querySelector("[data-admin-tab].active")));
  });
}

function adminSummaryCard(label, value, tab) {
  return `<button class="card metric-card admin-metric" data-admin-tab="${escapeHtml(tab)}">
    <span>${escapeHtml(label)}</span><strong>${value}</strong><span class="metric-action">${value ? "Review now →" : "View queue →"}</span>
  </button>`;
}

function changeOrgStatus(status, reason) {
  const org = readOrg();
  org.status = status;
  org.reason = reason;
  providerStore.write("kbOrganization", org);
  if (status !== "Verified") {
    const allCourses = readProviderCourses();
    allCourses.forEach((course) => {
      if (course.status === "Published") course.status = "Unpublished";
    });
    providerStore.write("kbCourses", allCourses);
  }
  audit(`Organization status changed to ${status}${reason ? `: ${reason}` : ""}`);
  providerPanel();
  renderAdmin();
  renderLearningHub();
}

function updateCourse(courseId, changes, message) {
  const allCourses = readProviderCourses();
  const course = allCourses.find((item) => item.id === courseId);
  if (!course) return;
  Object.assign(course, changes);
  providerStore.write("kbCourses", allCourses);
  audit(`${message}: ${course.title}`);
  providerPanel();
  renderAdmin();
  renderLearningHub();
}

function updateInteraction(courseId, field, increment = 1) {
  const interactions = readInteractions();
  interactions[courseId] = interactions[courseId] || {};
  interactions[courseId][field] = Math.max(0, (interactions[courseId][field] || 0) + increment);
  providerStore.write("kbInteractions", interactions);
  providerPanel();
}

function setLearnerState(courseId, status) {
  const states = providerStore.read("kbLearnerStates", {});
  const rank = {
    Saved: 1,
    "Intends to enrol": 2,
    "Self-reported enrolled": 3,
    "Completion self-reported": 4,
  };
  const previous = states[courseId];
  if ((rank[previous] || 0) >= rank[status]) return false;
  states[courseId] = status;
  providerStore.write("kbLearnerStates", states);
  return true;
}

function durationGroup(duration) {
  const match = String(duration || "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return "";
  const amount = Number(match[1]);
  if (/year/i.test(duration)) return "long";
  if (/month/i.test(duration)) return amount < 1 ? "short" : amount <= 6 ? "medium" : "long";
  if (/week/i.test(duration)) return amount < 4 ? "short" : amount <= 26 ? "medium" : "long";
  if (/day/i.test(duration)) return amount < 30 ? "short" : "medium";
  return "";
}

function renderLearningHub() {
  const list = document.querySelector("#clist");
  if (!list) return;
  const q = document.querySelector("#q").value.trim().toLowerCase();
  const topic = document.querySelector("#topic").value;
  const provider = document.querySelector("#hub-provider").value;
  const type = document.querySelector("#hub-type").value;
  const price = document.querySelector("#price").value;
  const min = document.querySelector("#min-price").value;
  const max = document.querySelector("#max-price").value;
  const currency = document.querySelector("#currency").value;
  const level = document.querySelector("#hub-level").value;
  const format = document.querySelector("#hub-format").value;
  const certificate = document.querySelector("#hub-certificate").value;
  const duration = document.querySelector("#hub-duration").value;
  const locationQuery = document.querySelector("#hub-location").value.trim().toLowerCase();
  const deadline = document.querySelector("#hub-deadline").value;
  const verified = document.querySelector("#hub-verified").value;
  const registered = readProviderCourses().filter((course) => course.status === "Published").map((course) => ({
    ...course,
    t: course.title,
    p: course.organization,
    topic: course.category,
    providerType: readOrg().type || "",
    price: course.feeType,
    external: true,
    isProviderCourse: true,
    isVerified: orgStatus() === "Verified",
  }));
  const curated = courses.map((course) => ({
    ...course,
    price: "Fee not confirmed",
    external: true,
    providerType: "",
    isProviderCourse: false,
    isVerified: false,
  }));
  const all = [...curated, ...registered];
  const topics = [...new Set(all.map((course) => course.topic).filter(Boolean))];
  const topicSelect = document.querySelector("#topic");
  const oldTopic = topicSelect.value;
  topicSelect.innerHTML = '<option value="">All topics</option>' + topics.map((value) =>
    `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`,
  ).join("");
  topicSelect.value = topics.includes(oldTopic) ? oldTopic : "";
  const filtered = all.filter((course) => {
    const searchable = `${course.t} ${course.p} ${course.topic || ""} ${course.subject || ""}`.toLowerCase();
    const fee = Number(course.fee);
    const deadlineDate = course.deadline ? new Date(`${course.deadline}T23:59:59`) : null;
    const hasUpcomingDeadline = deadlineDate && deadlineDate >= new Date();
    return (!q || searchable.includes(q)) &&
      (!topic || course.topic === topic) &&
      (!provider || course.p === provider) &&
      (!type || course.providerType === type) &&
      (!price || course.price === price) &&
      (!min || (Number.isFinite(fee) && fee >= Number(min))) &&
      (!max || (Number.isFinite(fee) && fee <= Number(max))) &&
      (!currency || course.currency === currency) &&
      (!level || course.level === level) &&
      (!format || course.format === format) &&
      (!certificate || (certificate === "yes" ? course.certificate === true : course.certificate !== true)) &&
      (!duration || durationGroup(course.duration) === duration) &&
      (!locationQuery || `${course.location || ""} ${course.country || ""}`.toLowerCase().includes(locationQuery)) &&
      (!deadline || (deadline === "open" ? !course.deadline || course.selfPaced : Boolean(hasUpcomingDeadline))) &&
      (!verified || (verified === "yes" ? course.isVerified : !course.isVerified));
  });

  const providers = [...new Set(all.map((course) => course.p).filter(Boolean))];
  const providerSelect = document.querySelector("#hub-provider");
  const oldProvider = providerSelect.value;
  providerSelect.innerHTML = '<option value="">All providers</option>' + providers.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  providerSelect.value = providers.includes(oldProvider) ? oldProvider : "";
  const currencies = [...new Set(registered.map((course) => course.currency).filter(Boolean))];
  const currencySelect = document.querySelector("#currency");
  const oldCurrency = currencySelect.value;
  currencySelect.innerHTML = '<option value="">Any currency</option>' + currencies.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  currencySelect.value = currencies.includes(oldCurrency) ? oldCurrency : "";

  list.innerHTML = filtered.map((course) => {
    const id = course.id || `curated-${course.t}`;
    const interactions = readInteractions()[id] || {};
    const isSaved = (providerStore.read("kbSaved", [])).includes(id);
    const verifiedBadge = course.isVerified ? '<span class="tag verified">Identity verified</span>' : "";
    const priceText = course.feeType === "Paid" && course.fee !== ""
      ? `${escapeHtml(course.currency || "")} ${escapeHtml(course.fee)}`
      : escapeHtml(course.price || "Fee not provided");
    return `<article class="card course-card">
      <div class="course-tags"><span class="tag">${escapeHtml(course.topic || "Learning")}</span>${verifiedBadge}
        <span class="tag muted">${course.isProviderCourse ? "Provider-submitted · external" : "Demo external resource · details unverified"}</span></div>
      <h3>${escapeHtml(course.t)}</h3><p class="provider-name">${escapeHtml(course.p)}</p>
      <p>${escapeHtml(course.summary || course.description || "Details not provided. Check the official provider page.")}</p>
      <dl class="course-facts">
        <div><dt>Format</dt><dd>${escapeHtml(course.format || "Not provided")}</dd></div>
        <div><dt>Fee</dt><dd>${priceText}</dd></div>
        <div><dt>Duration</dt><dd>${escapeHtml(course.duration || "Not provided")}</dd></div>
        <div><dt>Level</dt><dd>${escapeHtml(course.level || "Not specified")}</dd></div>
        <div><dt>Certificate</dt><dd>${course.certificate ? "Provider reports available" : "Not confirmed"}</dd></div>
      </dl>
      ${course.isProviderCourse ? `<details><summary>Course details</summary><p>${escapeHtml(course.description)}</p>
        <p>Outcomes: ${escapeHtml(course.outcomes)}</p><p>Prerequisites: ${escapeHtml(course.prerequisites || "Not provided")}</p>
        <p>Last verified by provider: ${escapeHtml(course.lastVerified || "Not provided")}</p></details>` : ""}
      <p class="tiny">${course.isVerified ? "Organization identity verified by AfriSkills.io; this does not confirm accreditation." : "Provider identity is not verified on AfriSkills.io."}</p>
      <div class="button-row"><button class="btn small" data-save-course="${escapeHtml(id)}">${isSaved ? "Saved to My Learning" : "Save to My Learning"}</button>
      ${course.isProviderCourse && safeExternalUrl(course.enrolmentUrl) ? `<a class="btn small secondary" href="${escapeHtml(safeExternalUrl(course.enrolmentUrl))}" target="_blank" rel="noopener noreferrer" data-enrol-link="${escapeHtml(id)}">Enrol with Provider</a>` : ""}
      <button class="btn small secondary" data-course-intent="${escapeHtml(id)}">I intend to enrol</button>
      <button class="btn small text-button" data-report-course="${escapeHtml(id)}" data-course-title="${escapeHtml(course.t)}">Report course</button></div>
      <div class="learner-actions">
        <label class="checkbox-label"><input type="checkbox" data-share-interest="${escapeHtml(id)}" ${(providerStore.read("kbConsent", {})[id] ? "checked" : "")}> Share my interest with this provider (optional consent)</label>
        <button class="btn text-button" data-self-enrolled="${escapeHtml(id)}">Mark as self-reported enrolled</button>
        <button class="btn text-button" data-self-complete="${escapeHtml(id)}">Mark completion as self-reported</button>
      </div>
      <p class="tiny">${interactions.sharedInterest ? "Learner interest shared with provider as an aggregate count." : "Clicking an external link does not confirm enrolment."}</p>
    </article>`;
  }).join("") || '<p class="card">No courses match these filters. Broaden your search or try another filter.</p>';
}

function renderRecruiterOpportunities() {
  const list = document.querySelector("#recruiter-opportunities");
  if (!list) return;
  const opportunities = providerStore.read("kbOpportunities", []);
  list.innerHTML = opportunities.map((item, index) => `<div class="job">
    <h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.organization)} · ${escapeHtml(item.status)}</p>
    ${item.reviewNote ? `<p class="review-note">Review note: ${escapeHtml(item.reviewNote)}</p>` : ""}
    <div class="button-row">
      ${item.status === "Draft" || item.status === "Rejected" ? `<button class="btn small secondary" data-submit-opportunity="${index}">Submit for review</button>` : ""}
      ${item.status === "Draft" ? `<button class="btn small text-button" data-delete-opportunity="${index}">Remove draft</button>` : ""}
    </div></div>`).join("") || "<p>No opportunity drafts.</p>";
}

function renderPublicJobs() {
  const list = document.querySelector("#jlist");
  if (!list) return;
  const interested = providerStore.read("jobInterest", []);
  const published = providerStore.read("kbOpportunities", []).filter((item) => item.status === "Published");
  const baseJobs = jobs.map((job) => `<div class="job"><span class="tag">${escapeHtml(job.ty)}</span>
    <h3>${escapeHtml(job.t)}</h3><p>${escapeHtml(job.o)} · ${escapeHtml(job.loc)} · Not verified</p>
    <button class="btn" data-apply="${escapeHtml(job.t)}" ${interested.includes(job.t) ? "disabled" : ""}>${interested.includes(job.t) ? "Interest saved ✓" : "Save interest"}</button></div>`);
  const providerJobs = published.map((job) => `<div class="job"><span class="tag">Provider listing</span>
    <h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.organization)} · Provider-submitted</p>
    <button class="btn" data-apply="${escapeHtml(job.title)}" ${interested.includes(job.title) ? "disabled" : ""}>${interested.includes(job.title) ? "Interest saved ✓" : "Save interest"}</button></div>`);
  list.innerHTML = [...baseJobs, ...providerJobs].join("");
}

function addToMyLearning(courseId) {
  const saved = providerStore.read("kbSaved", []);
  const isNewSave = !saved.includes(courseId);
  if (isNewSave) saved.push(courseId);
  providerStore.write("kbSaved", saved);
  const states = providerStore.read("kbLearnerStates", {});
  if (!states[courseId]) states[courseId] = "Saved";
  providerStore.write("kbLearnerStates", states);
  if (isNewSave && courseId.startsWith("course-")) updateInteraction(courseId, "saves");
  renderMyLearning();
}

document.querySelector("#workspace-role").addEventListener("change", () => setWorkspaceNavigation(true));
document.querySelectorAll("[data-provider-tab]").forEach((button) =>
  button.addEventListener("click", () => changeProviderTab(button.dataset.providerTab)),
);
document.querySelector("#provider-panel").addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.providerTab) changeProviderTab(target.dataset.providerTab);
  if (target.hasAttribute("data-org-submit")) {
    const form = document.querySelector("#organization-form");
    if (form.reportValidity()) saveOrganization(form, true);
  }
  if (target.dataset.editCourse) {
    editingCourseId = target.dataset.editCourse;
    changeProviderTab("add-course");
  }
  if (target.dataset.courseReview) updateCourse(target.dataset.courseReview, { status: "Pending Review", reviewNote: "" }, "Course resubmitted for review");
  if (target.dataset.courseUnpublish) updateCourse(target.dataset.courseUnpublish, { status: "Unpublished" }, "Course unpublished");
  if (target.dataset.courseArchive) updateCourse(target.dataset.courseArchive, { status: "Archived" }, "Course archived");
});
document.querySelector("#provider-panel").addEventListener("submit", (event) => {
  if (event.target.id === "organization-form") {
    event.preventDefault();
    saveOrganization(event.target);
  }
  if (event.target.id === "course-form") {
    event.preventDefault();
    saveCourse(event.target, event.submitter?.value || "draft");
  }
});

document.querySelectorAll("[data-admin-tab]").forEach((button) =>
  button.addEventListener("click", () => {
    adminTab = button.dataset.adminTab;
    button.closest("details")?.removeAttribute("open");
    renderAdmin();
  }),
);
document.querySelector("#admin-panel").addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.adminTab) {
    adminTab = target.dataset.adminTab;
    renderAdmin();
  }
  if (target.dataset.orgDecision) {
    if (!["Pending Review", "Under Review", "Verified", "Suspended"].includes(orgStatus())) {
      alert("This organization has not submitted a verification application for review.");
      return;
    }
    const reason = document.querySelector("#org-decision-reason").value.trim();
    if (["Rejected", "Suspended"].includes(target.dataset.orgDecision) && !reason) {
      alert("Enter a reason before rejecting or suspending an organization.");
      return;
    }
    changeOrgStatus(target.dataset.orgDecision, reason);
  }
  if (target.dataset.adminCourse) {
    const course = readProviderCourses().find((item) => item.id === target.dataset.adminCourse);
    if (!course || course.status !== "Pending Review") {
      alert("This course is no longer awaiting administrator review.");
      return;
    }
    if (target.dataset.decision === "Published" && orgStatus() !== "Verified") {
      alert("An organization must be identity-verified before its courses can be published.");
      return;
    }
    const reason = document.querySelector(`#course-reason-${CSS.escape(target.dataset.adminCourse)}`).value.trim();
    if (target.dataset.decision === "Rejected" && !reason) {
      alert("Enter a reason or correction request before rejecting a course.");
      return;
    }
    updateCourse(target.dataset.adminCourse, {
      status: target.dataset.decision,
      reviewNote: target.dataset.decision === "Rejected" ? reason : "",
    }, `${target.dataset.decision === "Published" ? "Course approved and published" : `Course rejected / corrections requested: ${reason}`}`);
  }
  if (target.dataset.adminUnpublish) updateCourse(target.dataset.adminUnpublish, { status: "Unpublished" }, "Administrator unpublished course");
  if (target.dataset.reviewReport !== undefined) {
    const reports = providerStore.read("kbReports", []);
    reports[Number(target.dataset.reviewReport)].status = "Reviewed";
    providerStore.write("kbReports", reports);
    audit(`Course report marked reviewed: ${reports[Number(target.dataset.reviewReport)].title}`);
    renderAdmin();
  }
  if (target.dataset.opportunityDecision) {
    const opportunities = providerStore.read("kbOpportunities", []);
    const item = opportunities.find((opportunity) => opportunity.id === target.dataset.opportunityDecision);
    if (!item || (target.dataset.status !== "Archived" && item.status !== "Pending Review")) return;
    const reasonField = document.querySelector(`#opportunity-reason-${CSS.escape(item.id)}`);
    const reason = reasonField?.value.trim() || "";
    if (target.dataset.status === "Rejected" && !reason) {
      alert("Enter a reason before rejecting an opportunity.");
      return;
    }
    item.status = target.dataset.status;
    item.reviewNote = reason;
    providerStore.write("kbOpportunities", opportunities);
    audit(`Opportunity ${target.dataset.status.toLowerCase()}: ${item.title}${reason ? `: ${reason}` : ""}`);
    renderAdmin();
    renderRecruiterOpportunities();
    renderPublicJobs();
  }
});
document.querySelector("#admin-panel").addEventListener("submit", (event) => {
  if (event.target.id !== "taxonomy-form") return;
  event.preventDefault();
  const form = event.target;
  const fields = Object.fromEntries(new FormData(form).entries());
  const taxonomy = readTaxonomy();
  if (fields.category.trim() && !taxonomy.categories.includes(fields.category.trim())) {
    taxonomy.categories.push(fields.category.trim());
  }
  if (fields.skill.trim() && !taxonomy.skills.includes(fields.skill.trim())) {
    taxonomy.skills.push(fields.skill.trim());
  }
  providerStore.write("kbTaxonomy", taxonomy);
  audit("Course category or skills taxonomy updated");
  renderAdmin();
});

document.querySelector("#courses").addEventListener("input", (event) => {
  if (event.target.matches("#q, #min-price, #max-price, #hub-location")) renderLearningHub();
});
document.querySelector("#courses").addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.saveCourse) {
    const saved = providerStore.read("kbSaved", []);
    const isNewSave = !saved.includes(target.dataset.saveCourse);
    if (isNewSave) saved.push(target.dataset.saveCourse);
    providerStore.write("kbSaved", saved);
    const states = providerStore.read("kbLearnerStates", {});
    if (!states[target.dataset.saveCourse]) states[target.dataset.saveCourse] = "Saved";
    providerStore.write("kbLearnerStates", states);
    if (isNewSave && target.dataset.saveCourse.startsWith("course-")) updateInteraction(target.dataset.saveCourse, "saves");
    renderMyLearning();
    renderLearningHub();
  }
  if (target.dataset.courseIntent) {
    addToMyLearning(target.dataset.courseIntent);
    if (setLearnerState(target.dataset.courseIntent, "Intends to enrol")) updateInteraction(target.dataset.courseIntent, "intent");
    renderMyLearning();
    alert("Your intention is saved in this browser only. The provider has not confirmed an enrolment.");
  }
  if (target.dataset.selfEnrolled) {
    addToMyLearning(target.dataset.selfEnrolled);
    if (setLearnerState(target.dataset.selfEnrolled, "Self-reported enrolled")) updateInteraction(target.dataset.selfEnrolled, "reportedEnrolments");
    renderMyLearning();
    alert("Recorded as your self-reported enrolment. The provider has not confirmed it.");
  }
  if (target.dataset.selfComplete) {
    addToMyLearning(target.dataset.selfComplete);
    if (setLearnerState(target.dataset.selfComplete, "Completion self-reported")) updateInteraction(target.dataset.selfComplete, "reportedCompletions");
    renderMyLearning();
    alert("Recorded as a self-reported completion only.");
  }
  if (target.dataset.reportCourse) {
    const reports = providerStore.read("kbReports", []);
    reports.unshift({
      title: target.dataset.courseTitle,
      reason: prompt("What should administrators review about this course?") || "",
      date: new Date().toISOString(),
    });
    if (!reports[0].reason) return;
    providerStore.write("kbReports", reports);
    renderAdmin();
    alert("Your report has been saved in this browser demo.");
  }
});
document.querySelector("#courses").addEventListener("change", (event) => {
  const input = event.target.closest("[data-share-interest]");
  if (input) {
    const consent = providerStore.read("kbConsent", {});
    const previous = Boolean(consent[input.dataset.shareInterest]);
    consent[input.dataset.shareInterest] = input.checked;
    providerStore.write("kbConsent", consent);
    if (input.checked && !previous) updateInteraction(input.dataset.shareInterest, "sharedInterest");
    if (!input.checked && previous) updateInteraction(input.dataset.shareInterest, "sharedInterest", -1);
    alert(input.checked
      ? "Consent recorded. Only aggregate interest is shown in this demo; learner identity is not shared."
      : "Consent withdrawn. Your interest is no longer included in the provider's aggregate count.");
  }
  renderLearningHub();
});
document.querySelector("#courses").addEventListener("click", (event) => {
  const link = event.target.closest("[data-enrol-link]");
  if (link && link.dataset.enrolLink.startsWith("course-")) updateInteraction(link.dataset.enrolLink, "outboundClicks");
});

document.querySelector("#opportunity-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const fields = Object.fromEntries(new FormData(form).entries());
  const intent = event.submitter?.value || "draft";
  const opportunities = providerStore.read("kbOpportunities", []);
  opportunities.push({
    ...fields,
    id: `opportunity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    status: intent === "review" ? "Pending Review" : "Draft",
  });
  providerStore.write("kbOpportunities", opportunities);
  audit(`${intent === "review" ? "Opportunity submitted for review" : "Opportunity draft saved"}: ${fields.title}`);
  form.reset();
  renderRecruiterOpportunities();
  renderAdmin();
});
document.querySelector("#recruiter-opportunities").addEventListener("click", (event) => {
  const target = event.target.closest("[data-delete-opportunity], [data-submit-opportunity]");
  if (!target) return;
  const opportunities = providerStore.read("kbOpportunities", []);
  if (target.dataset.deleteOpportunity !== undefined) {
    opportunities.splice(Number(target.dataset.deleteOpportunity), 1);
  } else {
    const item = opportunities[Number(target.dataset.submitOpportunity)];
    if (item) item.status = "Pending Review";
  }
  providerStore.write("kbOpportunities", opportunities);
  renderRecruiterOpportunities();
  renderAdmin();
});
document.addEventListener("click", (event) => {
  if (event.target.closest("#jlist [data-apply]")) setTimeout(renderPublicJobs, 0);
});

renderLearningHub();
providerPanel();
renderAdmin();
renderRecruiterOpportunities();
renderMyLearning();
renderPublicJobs();
setWorkspaceNavigation();
