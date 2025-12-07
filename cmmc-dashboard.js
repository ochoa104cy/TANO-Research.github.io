const STORAGE_KEY = "tano_cmmc_assessments_v1";

let all = [];
let filtered = [];
let selectedIndex = null;
let assessments = {};

function loadAssessments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    assessments = raw ? JSON.parse(raw) : {};
  } catch (e) {
    assessments = {};
  }
}

function persistAssessments() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assessments));
  } catch (e) {
    console.warn("Could not save assessments", e);
  }
}

async function loadCSV(url) {
  const text = await fetch(url).then(res => res.text());
  const rows = text.trim().split("\n").map(r => r.split(","));
  const header = rows.shift().map(h => h.trim().toLowerCase());

  const col = {
    id: header.indexOf("practice id"),
    domain: header.indexOf("domain"),
    name: header.indexOf("practice name"),
    description: header.indexOf("description"),
    source: header.indexOf("source")
  };

  return rows.map(r => ({
    id: r[col.id]?.trim(),
    domain: r[col.domain]?.trim(),
    name: r[col.name]?.trim(),
    description: r[col.description]?.trim(),
    source: r[col.source]?.trim(),
  }));
}

// UI refs
const tableBody = document.getElementById("tableBody");
const emptyState = document.getElementById("emptyState");
const domainFilter = document.getElementById("domainFilter");
const searchInput = document.getElementById("searchInput");
const levelChips = document.getElementById("levelChips");

const totalCount = document.getElementById("totalCount");
const level1Count = document.getElementById("level1Count");
const level2Count = document.getElementById("level2Count");
const domainCount = document.getElementById("domainCount");
const applicableCount = document.getElementById("applicableCount");
const implementedCount = document.getElementById("implementedCount");
const readinessPercent = document.getElementById("readinessPercent");

const scopeSelect = document.getElementById("scopeSelect");
const statusSelect = document.getElementById("statusSelect");
const notesInput = document.getElementById("notesInput");
const saveAssessmentBtn = document.getElementById("saveAssessmentBtn");
const clearAssessmentBtn = document.getElementById("clearAssessmentBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");

async function init() {
  loadAssessments();

  const L1 = await loadCSV("cmmc-playbook/controls/L1_Practices.csv");
  const L2 = await loadCSV("cmmc-playbook/controls/L2_Practices.csv");

  L1.forEach(p => (p.level = "L1"));
  L2.forEach(p => (p.level = "L2"));

  all = [...L1, ...L2];

  updateStatsBase();
  populateDomains();
  applyFilters();
  updateAssessmentStats();
}

function updateStatsBase() {
  totalCount.textContent = all.length;
  level1Count.textContent = all.filter(p => p.level === "L1").length;
  level2Count.textContent = all.filter(p => p.level === "L2").length;

  const domains = new Set(all.map(p => p.domain));
  domainCount.textContent = domains.size;
}

function populateDomains() {
  const domains = [...new Set(all.map(p => p.domain))].sort();
  domains.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    domainFilter.appendChild(opt);
  });
}

function getLevelFilter() {
  const active = levelChips.querySelector(".chip-active");
  return active ? active.dataset.level : "all";
}

function applyFilters() {
  const level = getLevelFilter();
  const domain = domainFilter.value;
  const q = searchInput.value.toLowerCase();

  filtered = all.filter(p => {
    if (level !== "all" && p.level !== level) return false;
    if (domain !== "all" && p.domain !== domain) return false;

    const text = `${p.id} ${p.domain} ${p.name} ${p.description} ${p.source}`.toLowerCase();
    if (q && !text.includes(q)) return false;

    return true;
  });

  renderTable();
}

function statusLabel(code) {
  switch (code) {
    case "implemented":
      return "Implemented";
    case "partial":
      return "Partial";
    case "not":
      return "Not Impl.";
    case "na":
      return "N/A";
    case "unknown":
      return "Not Set";
    default:
      return "";
  }
}

function renderTable() {
  tableBody.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  filtered.forEach((p, i) => {
    const tr = document.createElement("tr");
    const meta = assessments[p.id] || {};
    const status = statusLabel(meta.status || "unknown");
    const scope = meta.scope || "in";

    // Optional: dim out-of-scope rows
    const isOut = scope === "out";
    if (isOut) tr.classList.add("row-out-of-scope");

    tr.innerHTML = `
      <td>${p.level}</td>
      <td>${p.id}</td>
      <td>${p.domain}</td>
      <td>${p.name}</td>
      <td>${p.description}</td>
      <td>${p.source}</td>
      <td class="status-cell">${status}</td>
    `;

    tr.onclick = () => selectPractice(i);
    tableBody.appendChild(tr);
  });

  // Keep selection if possible
  if (filtered.length > 0) {
    selectPractice(Math.min(selectedIndex ?? 0, filtered.length - 1));
  }
}

function selectPractice(i) {
  selectedIndex = i;
  const p = filtered[i];
  if (!p) return;

  document.getElementById("detailId").textContent = p.id;
  document.getElementById("detailLevel").textContent = p.level;
  document.getElementById("detailDomain").textContent = p.domain;
  document.getElementById("detailName").textContent = p.name;
  document.getElementById("detailDescription").textContent = p.description;
  document.getElementById("detailSource").textContent = p.source;

  populateAssessmentControls(p);

  [...tableBody.children].forEach((tr, idx) => {
    tr.classList.toggle("selected-row", idx === i);
  });
}

function populateAssessmentControls(p) {
  const meta = assessments[p.id] || {};
  scopeSelect.value = meta.scope || "in";
  statusSelect.value = meta.status || "unknown";
  notesInput.value = meta.notes || "";
}

function updateAssessmentStats() {
  if (!all.length) {
    applicableCount.textContent = "–";
    implementedCount.textContent = "–";
    readinessPercent.textContent = "–";
    return;
  }

  let applicable = 0;
  let implemented = 0;

  all.forEach(p => {
    const meta = assessments[p.id] || {};
    const scope = meta.scope || "in";
    const status = meta.status || "unknown";

    if (scope !== "out") {
      applicable++;
      if (status === "implemented") implemented++;
    }
  });

  applicableCount.textContent = applicable.toString();
  implementedCount.textContent = implemented.toString();
  readinessPercent.textContent =
    applicable > 0 ? Math.round((implemented / applicable) * 100) + "%" : "–";
}

function saveCurrentAssessment() {
  const p = filtered[selectedIndex];
  if (!p) return;

  const meta = {
    scope: scopeSelect.value,
    status: statusSelect.value,
    notes: notesInput.value.trim()
  };

  assessments[p.id] = meta;
  persistAssessments();
  updateAssessmentStats();
  renderTable();

  // quick visual feedback
  saveAssessmentBtn.textContent = "Saved ✓";
  setTimeout(() => {
    saveAssessmentBtn.textContent = "Save Assessment";
  }, 1200);
}

function clearCurrentAssessment() {
  const p = filtered[selectedIndex];
  if (!p) return;

  delete assessments[p.id];
  persistAssessments();
  populateAssessmentControls(p);
  updateAssessmentStats();
  renderTable();
}

function csvEscape(value) {
  if (value === null || value === undefined) return '""';
  const v = String(value).replace(/"/g, '""');
  return `"${v}"`;
}

function exportAssessmentCsv() {
  if (!all.length) return;

  const header = [
    "Level",
    "Practice ID",
    "Domain",
    "Practice Name",
    "Description",
    "Source",
    "Scope",
    "Status",
    "Notes"
  ];

  const rows = [header.map(csvEscape).join(",")];

  all.forEach(p => {
    const meta = assessments[p.id] || {};
    rows.push([
      p.level,
      p.id,
      p.domain,
      p.name,
      p.description,
      p.source,
      meta.scope || "in",
      statusLabel(meta.status || "unknown"),
      meta.notes || ""
    ].map(csvEscape).join(","));
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cmmc_assessment.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Event wiring
levelChips.onclick = e => {
  if (e.target.classList.contains("chip")) {
    [...levelChips.children].forEach(c => c.classList.remove("chip-active"));
    e.target.classList.add("chip-active");
    applyFilters();
  }
};

domainFilter.onchange = applyFilters;
searchInput.oninput = applyFilters;
saveAssessmentBtn.onclick = saveCurrentAssessment;
clearAssessmentBtn.onclick = clearCurrentAssessment;
exportCsvBtn.onclick = exportAssessmentCsv;

init();
