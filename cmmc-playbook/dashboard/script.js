// Simple CSV parser that supports quoted fields
function parseCSV(text) {
  const rows = [];
  let current = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      // Escaped quote
      value += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      current.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (value !== "" || current.length > 0) {
        current.push(value.trim());
        rows.push(current);
        current = [];
        value = "";
      }
    } else {
      value += char;
    }
  }

  if (value !== "" || current.length > 0) {
    current.push(value.trim());
    rows.push(current);
  }

  return rows;
}

// Global state
let allPractices = [];
let filteredPractices = [];
let currentSort = { field: null, direction: "asc" };
let selectedRowIndex = null;

// DOM refs
const tableBody = document.getElementById("tableBody");
const emptyState = document.getElementById("emptyState");
const domainFilter = document.getElementById("domainFilter");
const searchInput = document.getElementById("searchInput");
const levelChips = document.getElementById("levelChips");
const totalCountEl = document.getElementById("totalCount");
const level1CountEl = document.getElementById("level1Count");
const level2CountEl = document.getElementById("level2Count");
const domainCountEl = document.getElementById("domainCount");

// Detail panel refs
const detailLevel = document.getElementById("detailLevel");
const detailId = document.getElementById("detailId");
const detailDomain = document.getElementById("detailDomain");
const detailName = document.getElementById("detailName");
const detailDescription = document.getElementById("detailDescription");
const detailSource = document.getElementById("detailSource");

async function loadPractices() {
  const datasets = [
    { url: "../data/cmmc_level1.csv", level: "L1" },
    { url: "../data/cmmc_level2.csv", level: "L2" },
  ];

  const loaded = [];

  for (const ds of datasets) {
    try {
      const response = await fetch(ds.url);
      if (!response.ok) {
        console.warn(`Could not load ${ds.url}`, response.statusText);
        continue;
      }
      const text = await response.text();
      const rows = parseCSV(text);
      if (!rows.length) continue;

      const headers = rows[0].map((h) => h.toLowerCase());
      const idxId = headers.indexOf("practice id");
      const idxDomain = headers.indexOf("domain");
      const idxName = headers.indexOf("practice name");
      const idxDescription = headers.indexOf("description");
      const idxSource = headers.indexOf("source");

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[idxId]) continue;
        loaded.push({
          level: ds.level,
          id: r[idxId] || "",
          domain: r[idxDomain] || "",
          name: r[idxName] || "",
          description: r[idxDescription] || "",
          source: r[idxSource] || "",
        });
      }
    } catch (err) {
      console.error("Error loading CSV:", ds.url, err);
    }
  }

  allPractices = loaded;
  applyFilters();
  populateStats();
  populateDomainFilter();
}

function populateStats() {
  const total = allPractices.length;
  const l1 = allPractices.filter((p) => p.level === "L1").length;
  const l2 = allPractices.filter((p) => p.level === "L2").length;
  const domains = new Set(allPractices.map((p) => p.domain).filter(Boolean));

  totalCountEl.textContent = total || "0";
  level1CountEl.textContent = l1 || "0";
  level2CountEl.textContent = l2 || "0";
  domainCountEl.textContent = domains.size || "0";
}

function populateDomainFilter() {
  const domains = Array.from(
    new Set(allPractices.map((p) => p.domain).filter(Boolean))
  ).sort();

  // Clear existing
  while (domainFilter.options.length > 1) {
    domainFilter.remove(1);
  }

  for (const d of domains) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    domainFilter.appendChild(opt);
  }
}

function getActiveLevelFilter() {
  const active = levelChips.querySelector(".chip-active");
  return active ? active.dataset.level : "all";
}

function applyFilters() {
  const levelFilter = getActiveLevelFilter();
  const domain = domainFilter.value;
  const query = searchInput.value.toLowerCase().trim();

  filteredPractices = allPractices.filter((p) => {
    if (levelFilter === "L1" && p.level !== "L1") return false;
    if (levelFilter === "L2" && p.level !== "L2") return false;

    if (domain !== "all" && p.domain !== domain) return false;

    if (query) {
      const haystack = `${p.id} ${p.domain} ${p.name} ${p.description} ${p.source}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  sortPractices();
  renderTable();
}

function sortPractices() {
  if (!currentSort.field) return;

  const dir = currentSort.direction === "asc" ? 1 : -1;

  filteredPractices.sort((a, b) => {
    let valA;
    let valB;

    switch (currentSort.field) {
      case "level":
        valA = a.level;
        valB = b.level;
        break;
      case "id":
        valA = a.id;
        valB = b.id;
        break;
      case "domain":
        valA = a.domain;
        valB = b.domain;
        break;
      case "name":
        valA = a.name;
        valB = b.name;
        break;
      case "source":
        valA = a.source;
        valB = b.source;
        break;
      default:
        return 0;
    }

    return valA.localeCompare(valB, undefined, { numeric: true }) * dir;
  });
}

function renderTable() {
  tableBody.innerHTML = "";
  selectedRowIndex = null;

  if (!filteredPractices.length) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  filteredPractices.forEach((p, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;

    const tdLevel = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = "badge " + (p.level === "L1" ? "badge-l1" : "badge-l2");
    badge.textContent = p.level === "L1" ? "L1" : "L2";
    tdLevel.appendChild(badge);

    const tdId = document.createElement("td");
    tdId.textContent = p.id;

    const tdDomain = document.createElement("td");
    tdDomain.textContent = p.domain;

    const tdName = document.createElement("td");
    tdName.textContent = p.name;

    const tdDescription = document.createElement("td");
    tdDescription.textContent = p.description;

    const tdSource = document.createElement("td");
    tdSource.textContent = p.source;

    tr.append(tdLevel, tdId, tdDomain, tdName, tdDescription, tdSource);

    tr.addEventListener("click", () => {
      selectRow(index);
    });

    tableBody.appendChild(tr);
  });

  // Auto-select first row for detail view
  if (filteredPractices.length > 0) {
    selectRow(0);
  }
}

function selectRow(index) {
  selectedRowIndex = index;

  const rows = tableBody.querySelectorAll("tr");
  rows.forEach((row, i) => {
    row.classList.toggle("selected-row", i === index);
  });

  const practice = filteredPractices[index];
  if (!practice) return;

  detailLevel.textContent =
    practice.level === "L1" ? "Level 1 – Foundational" : "Level 2 – Advanced";
  detailId.textContent = practice.id || "–";
  detailDomain.textContent = practice.domain || "–";
  detailName.textContent = practice.name || "–";
  detailDescription.textContent = practice.description || "–";
  detailSource.textContent = practice.source || "–";
}

function setupEvents() {
  domainFilter.addEventListener("change", applyFilters);
  searchInput.addEventListener("input", () => {
    applyFilters();
  });

  levelChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;

    levelChips
      .querySelectorAll(".chip")
      .forEach((c) => c.classList.remove("chip-active"));
    chip.classList.add("chip-active");
    applyFilters();
  });

  // Sorting
  document
    .querySelectorAll("#practicesTable thead th[data-sort]")
    .forEach((th) => {
      th.addEventListener("click", () => {
        const field = th.dataset.sort;
        if (currentSort.field === field) {
          currentSort.direction =
            currentSort.direction === "asc" ? "desc" : "asc";
        } else {
          currentSort.field = field;
          currentSort.direction = "asc";
        }
        sortPractices();
        renderTable();
      });
    });

  // Theme toggle
  const themeToggle = document.getElementById("themeToggle");
  const root = document.documentElement;

  themeToggle.addEventListener("click", () => {
    const current = root.getAttribute("data-theme");
    if (current === "light") {
      root.removeAttribute("data-theme");
      localStorage.setItem("tano-cmmc-theme", "dark");
    } else {
      root.setAttribute("data-theme", "light");
      localStorage.setItem("tano-cmmc-theme", "light");
    }
  });

  // Load stored theme
  const storedTheme = localStorage.getItem("tano-cmmc-theme");
  if (storedTheme === "light") {
    root.setAttribute("data-theme", "light");
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupEvents();
  loadPractices();
});
