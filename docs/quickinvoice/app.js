"use strict";

// QuickInvoice — fully client-side invoice generator.
// State lives in localStorage; no network, no account.

const STORAGE_KEY = "quickinvoice.v1";
const LOGO_KEY = "quickinvoice.logo";
const SAVED_KEY = "quickinvoice.saved.v1";
const CLIENTS_KEY = "quickinvoice.clients.v1";

const defaultState = () => ({
  fromName: "",
  fromDetails: "",
  toName: "",
  toDetails: "",
  number: "INV-001",
  currency: "$",
  issued: today(),
  due: "",
  taxRate: "",
  discountRate: "",
  notes: "",
  items: [{ desc: "", qty: "1", rate: "" }],
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    const merged = { ...base, ...parsed };
    if (!Array.isArray(merged.items) || merged.items.length === 0) {
      merged.items = base.items;
    }
    return merged;
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — preview still works in-memory */
  }
}

// ---- Saved invoices (a keepable list, separate from the autosaved draft) ----
function loadSaved() {
  try {
    const arr = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persistSaved(list) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked */
  }
}

// ---- Saved clients (remembered Bill-To parties, refillable in one click) ----
function loadClients() {
  try {
    const arr = JSON.parse(localStorage.getItem(CLIENTS_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persistClients(list) {
  try {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked */
  }
}

// "INV-001" -> "INV-002", preserving prefix and zero-padding.
function bumpNumber(numStr) {
  const s = String(numStr || "");
  const m = s.match(/(\d+)(\D*)$/);
  if (!m) return s ? s + "-2" : "INV-002";
  const next = String(Number(m[1]) + 1).padStart(m[1].length, "0");
  return s.slice(0, m.index) + next + m[2];
}

// ---- Recurring invoices (client-side schedule, no backend) ----
const RECUR_CYCLE = { "": "monthly", monthly: "weekly", weekly: "" };

// All schedule math runs in UTC so stored ISO dates never drift by a day
// across timezones (parsing local midnight but serializing to UTC would).
function addPeriod(iso, every) {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  if (every === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayGap(aIso, bIso) {
  if (!aIso || !bIso) return null;
  const a = new Date(aIso + "T00:00:00Z");
  const b = new Date(bIso + "T00:00:00Z");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
}

// First scheduled date strictly in the future, stepping from `start` by `every`.
function firstFutureOccurrence(start, every) {
  let cur = /^\d{4}-\d{2}-\d{2}$/.test(start || "") ? start : today();
  const t = today();
  let guard = 0;
  while (cur <= t && guard < 600) {
    cur = addPeriod(cur, every);
    guard++;
  }
  return cur;
}

// ---- Money helpers ----
function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function computeTotals(state) {
  const subtotal = state.items.reduce(
    (sum, it) => sum + num(it.qty) * num(it.rate),
    0
  );
  const discount = subtotal * (num(state.discountRate) / 100);
  const taxed = subtotal - discount;
  const tax = taxed * (num(state.taxRate) / 100);
  const total = taxed + tax;
  return { subtotal, discount, tax, total };
}

function fmt(state, amount) {
  const cur = (state.currency || "").trim() || "$";
  return `${cur}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---- Rendering ----
const $ = (id) => document.getElementById(id);

function setText(id, value, fallback = "") {
  const el = $(id);
  if (el) el.textContent = value || fallback;
}

function renderPreview(state) {
  setText("pNumber", state.number, "INV-001");
  setText("pFromName", state.fromName, "Your name or company");
  setText("pFromDetails", state.fromDetails);
  setText("pToName", state.toName, "Client name");
  setText("pToDetails", state.toDetails);
  setText("pIssued", fmtDate(state.issued));
  setText("pDue", fmtDate(state.due));

  const tbody = $("pItems");
  tbody.innerHTML = "";
  const visible = state.items.filter(
    (it) => it.desc || num(it.qty) || num(it.rate)
  );
  const rows = visible.length ? visible : [{ desc: "", qty: "", rate: "" }];
  for (const it of rows) {
    const amount = num(it.qty) * num(it.rate);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="ta-l"></td>
      <td class="ta-r"></td>
      <td class="ta-r"></td>
      <td class="ta-r"></td>`;
    tr.children[0].textContent = it.desc || "—";
    tr.children[1].textContent = it.qty ? num(it.qty).toString() : "";
    tr.children[2].textContent = it.rate ? fmt(state, num(it.rate)) : "";
    tr.children[3].textContent = it.desc || it.rate ? fmt(state, amount) : "";
    tbody.appendChild(tr);
  }

  const t = computeTotals(state);
  setText("pSubtotal", fmt(state, t.subtotal));

  const discountRow = $("pDiscountRow");
  if (t.discount > 0) {
    discountRow.hidden = false;
    setText("pDiscount", "−" + fmt(state, t.discount));
  } else {
    discountRow.hidden = true;
  }

  const taxRow = $("pTaxRow");
  if (t.tax > 0) {
    taxRow.hidden = false;
    setText("pTax", fmt(state, t.tax));
  } else {
    taxRow.hidden = true;
  }

  setText("pTotal", fmt(state, t.total));

  const notesWrap = $("pNotesWrap");
  if (state.notes && state.notes.trim()) {
    notesWrap.hidden = false;
    setText("pNotes", state.notes);
  } else {
    notesWrap.hidden = true;
  }
}

function renderItemsEditor(state) {
  const wrap = $("itemsEditor");
  wrap.innerHTML = "";
  state.items.forEach((it, i) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <input class="inp" placeholder="Description" data-item="desc" data-i="${i}" />
      <input class="inp ta-r" type="number" step="0.01" min="0" placeholder="Qty" data-item="qty" data-i="${i}" />
      <input class="inp ta-r" type="number" step="0.01" min="0" placeholder="Rate" data-item="rate" data-i="${i}" />
      <button class="item-del" type="button" data-del="${i}" aria-label="Remove line">×</button>`;
    row.querySelector('[data-item="desc"]').value = it.desc;
    row.querySelector('[data-item="qty"]').value = it.qty;
    row.querySelector('[data-item="rate"]').value = it.rate;
    wrap.appendChild(row);
  });
}

// ---- Wiring ----
function init() {
  let state = loadState();
  // id of the saved-invoice entry the editor is currently bound to (null = unsaved draft)
  let currentSavedId = null;

  // Bind top-level fields.
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const key = el.dataset.bind;
    if (state[key] != null) el.value = state[key];
    el.addEventListener("input", () => {
      state = { ...state, [key]: el.value };
      saveState(state);
      renderPreview(state);
    });
  });

  // Item edits (event-delegated; editor is re-rendered on structural change).
  const itemsEditor = $("itemsEditor");
  itemsEditor.addEventListener("input", (e) => {
    const t = e.target;
    if (!t.dataset.item) return;
    const i = Number(t.dataset.i);
    const field = t.dataset.item;
    const items = state.items.map((it, idx) =>
      idx === i ? { ...it, [field]: t.value } : it
    );
    state = { ...state, items };
    saveState(state);
    renderPreview(state);
  });
  itemsEditor.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (!del) return;
    const i = Number(del.dataset.del);
    const items = state.items.filter((_, idx) => idx !== i);
    state = { ...state, items: items.length ? items : defaultState().items };
    saveState(state);
    renderItemsEditor(state);
    renderPreview(state);
  });

  $("addItemBtn").addEventListener("click", () => {
    state = { ...state, items: [...state.items, { desc: "", qty: "1", rate: "" }] };
    saveState(state);
    renderItemsEditor(state);
    renderPreview(state);
  });

  // ---- Feedback / demand capture ----
  const feedbackMailto =
    "mailto:nohuntme@gmail.com" +
    "?subject=" + encodeURIComponent("QuickInvoice feedback") +
    "&body=" + encodeURIComponent(
      "What one feature would make QuickInvoice worth paying for to you?\n\n" +
      "(One line is plenty — thank you for helping shape it.)"
    );
  $("feedbackLink").href = feedbackMailto;
  $("toastLink").href = feedbackMailto;

  // Surface the ask at the highest-intent moment: right after a download.
  const toast = $("postDownloadToast");
  const dismissToast = () => { toast.hidden = true; };
  $("toastClose").addEventListener("click", dismissToast);
  $("toastLink").addEventListener("click", dismissToast);
  let feedbackShown = false;
  window.addEventListener("afterprint", () => {
    try { if (sessionStorage.getItem("qi.feedbackShown")) feedbackShown = true; } catch {}
    if (feedbackShown) return;
    feedbackShown = true;
    try { sessionStorage.setItem("qi.feedbackShown", "1"); } catch {}
    toast.hidden = false;
    setTimeout(dismissToast, 12000);
  });

  $("printBtn").addEventListener("click", () => window.print());

  $("shareBtn").addEventListener("click", () => {
    const url = "https://nohunt-bot.github.io/claude/quickinvoice/";
    if (navigator.share) {
      navigator.share({ title: "QuickInvoice", text: "Free invoice generator — no signup, runs in your browser.", url });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        const btn = $("shareBtn");
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Share"; }, 2000);
      });
    }
  });

  $("resetBtn").addEventListener("click", () => {
    if (!confirm("Start a new blank invoice? Your saved invoices are kept.")) return;
    state = defaultState();
    currentSavedId = null;
    saveState(state);
    try { localStorage.removeItem(LOGO_KEY); } catch {}
    applyLogo("");
    logoInput.value = "";
    syncTopFields(state);
    renderItemsEditor(state);
    renderPreview(state);
    renderSaved();
  });

  // Logo upload
  const logoInput = $("logoInput");
  const logoStatus = $("logoStatus");
  const clearLogoBtn = $("clearLogoBtn");

  function applyLogo(dataUrl) {
    const img = $("pLogo");
    if (dataUrl) {
      img.src = dataUrl;
      img.hidden = false;
      logoStatus.textContent = "Logo uploaded";
      logoStatus.classList.add("has-logo");
      clearLogoBtn.hidden = false;
    } else {
      img.src = "";
      img.hidden = true;
      logoStatus.textContent = "No logo added";
      logoStatus.classList.remove("has-logo");
      clearLogoBtn.hidden = true;
    }
  }

  applyLogo(localStorage.getItem(LOGO_KEY) || "");

  logoStatus.addEventListener("click", () => logoInput.click());
  logoInput.addEventListener("change", () => {
    const file = logoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      try { localStorage.setItem(LOGO_KEY, dataUrl); } catch {}
      applyLogo(dataUrl);
    };
    reader.readAsDataURL(file);
  });
  clearLogoBtn.addEventListener("click", () => {
    try { localStorage.removeItem(LOGO_KEY); } catch {}
    logoInput.value = "";
    applyLogo("");
  });

  // ---- Saved invoices ----
  const savedPanel = $("savedPanel");
  const savedSummary = $("savedSummary");
  const savedList = $("savedList");
  const saveBtn = $("saveBtn");

  // Set/replace the logo for the current draft and reflect it in the UI.
  function applyAndSaveLogo(dataUrl) {
    try {
      if (dataUrl) localStorage.setItem(LOGO_KEY, dataUrl);
      else localStorage.removeItem(LOGO_KEY);
    } catch {}
    logoInput.value = "";
    applyLogo(dataUrl);
  }

  function recurLabel(recur) {
    if (recur === "monthly") return "Repeats monthly";
    if (recur === "weekly") return "Repeats weekly";
    return "One-off";
  }

  // Sum a set of saved entries into a "<amount> <singleSuffix>" line. When they
  // mix currencies we can't add unlike symbols, so fall back to a plain count:
  // "<n> <noun> <mixedSuffix>".
  function summaryLine(entries, singleSuffix, noun, mixedSuffix) {
    const line = document.createElement("div");
    line.className = "summary-line";
    const currencies = new Set(
      entries.map((e) => (e.state.currency || "$").trim() || "$")
    );
    if (currencies.size === 1) {
      const total = entries.reduce((sum, e) => sum + computeTotals(e.state).total, 0);
      const strong = document.createElement("strong");
      strong.textContent = fmt(entries[0].state, total);
      line.append(strong, ` ${singleSuffix}`);
    } else {
      const word = entries.length === 1 ? noun : noun + "s";
      line.textContent = `${entries.length} ${word} ${mixedSuffix}`.trim();
    }
    return line;
  }

  // Mini receivables view: outstanding (unpaid) total on top, and — when any
  // invoice was marked paid this calendar month — a "collected this month" line.
  function renderSummary(list) {
    savedSummary.hidden = false;
    savedSummary.classList.remove("all-paid");
    savedSummary.innerHTML = "";

    const unpaid = list.filter((e) => !e.paid);
    if (!unpaid.length) {
      const line = document.createElement("div");
      line.className = "summary-line all-paid";
      line.textContent = "All caught up — every saved invoice is marked paid.";
      savedSummary.appendChild(line);
    } else {
      const noun = unpaid.length === 1 ? "invoice" : "invoices";
      savedSummary.appendChild(
        summaryLine(unpaid, `outstanding across ${unpaid.length} ${noun}`, "unpaid invoice", "")
      );
    }

    const month = today().slice(0, 7); // YYYY-MM
    const collected = list.filter((e) => e.paid && (e.paidAt || "").slice(0, 7) === month);
    if (collected.length) {
      const line = summaryLine(collected, "collected this month", "invoice", "collected this month");
      line.classList.add("summary-collected");
      savedSummary.appendChild(line);
    }
  }

  function renderSaved() {
    const list = loadSaved();
    if (!list.length) {
      savedPanel.hidden = true;
      savedSummary.hidden = true;
      savedList.innerHTML = "";
      return;
    }
    savedPanel.hidden = false;
    savedList.innerHTML = "";
    renderSummary(list);
    const t = today();
    // Newest first.
    list.slice().reverse().forEach((entry) => {
      const li = document.createElement("li");
      li.className = "saved-item";
      if (entry.id === currentSavedId) li.classList.add("is-current");
      const paid = !!entry.paid;
      if (paid) li.classList.add("is-paid");
      const recur = entry.recur || "";
      const dueNow = recur && entry.nextDate && entry.nextDate <= t;
      const paidOn = paid && entry.paidAt
        ? new Date(entry.paidAt + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "";
      const paidText = paid ? (paidOn ? "Paid " + paidOn : "Paid") : "Mark paid";
      li.innerHTML = `
        <div class="saved-row">
          <button class="saved-open" type="button" data-open="${entry.id}">
            <span class="saved-num"></span>${paid ? `<span class="saved-paid-pill">Paid</span>` : ""}
            <span class="saved-meta"></span>
          </button>
          <span class="saved-actions">
            <button class="btn btn-ghost btn-xs" type="button" data-dup="${entry.id}">Duplicate</button>
            <button class="item-del" type="button" data-rm="${entry.id}" aria-label="Delete saved invoice">×</button>
          </span>
        </div>
        <div class="saved-recur">
          <button class="paid-toggle${paid ? " is-paid" : ""}" type="button" data-paid="${entry.id}" aria-pressed="${paid}">
            <span class="paid-check"></span><span class="paid-text">${paidText}</span>
          </button>
          <button class="recur-toggle" type="button" data-recur="${entry.id}" aria-label="Change recurrence">
            <span class="recur-dot${recur ? " on" : ""}"></span><span class="recur-text"></span>
          </button>
          ${recur ? `
          <span class="recur-next${dueNow ? " due" : ""}"></span>
          <button class="btn btn-ghost btn-xs gen-next" type="button" data-gennext="${entry.id}">Generate next →</button>` : ""}
        </div>`;
      const when = new Date(entry.savedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      li.querySelector(".saved-num").textContent = entry.state.number || "Untitled";
      li.querySelector(".saved-meta").textContent =
        (entry.state.toName || "No client") + " · " + when;
      li.querySelector(".recur-text").textContent = recurLabel(recur);
      if (recur) {
        li.querySelector(".recur-next").textContent = dueNow
          ? "Due now"
          : "Next: " + fmtDate(entry.nextDate);
      }
      savedList.appendChild(li);
    });
  }

  function loadEntry(entry, { asDuplicate }) {
    const snap = JSON.parse(JSON.stringify(entry.state));
    if (asDuplicate) {
      state = { ...snap, number: bumpNumber(snap.number) };
      currentSavedId = null; // a duplicate is a fresh, unsaved invoice
    } else {
      state = snap;
      currentSavedId = entry.id;
    }
    applyAndSaveLogo(entry.logo || "");
    saveState(state);
    syncTopFields(state);
    renderItemsEditor(state);
    renderPreview(state);
    renderSaved();
  }

  saveBtn.addEventListener("click", () => {
    const list = loadSaved();
    const snap = {
      state: JSON.parse(JSON.stringify(state)),
      logo: localStorage.getItem(LOGO_KEY) || "",
    };
    const idx = currentSavedId ? list.findIndex((e) => e.id === currentSavedId) : -1;
    let next;
    if (idx >= 0) {
      next = list.map((e, i) =>
        i === idx ? { ...e, ...snap, savedAt: Date.now() } : e
      );
    } else {
      currentSavedId =
        "inv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      next = [...list, { id: currentSavedId, savedAt: Date.now(), ...snap }];
    }
    persistSaved(next);
    renderSaved();
    saveBtn.textContent = "Saved ✓";
    setTimeout(() => { saveBtn.textContent = "Save"; }, 1600);
  });

  savedList.addEventListener("click", (e) => {
    // Toggle paid / unpaid status.
    const pd = e.target.closest("[data-paid]");
    if (pd) {
      const id = pd.dataset.paid;
      const next = loadSaved().map((entry) =>
        entry.id === id
          ? { ...entry, paid: !entry.paid, paidAt: !entry.paid ? today() : "" }
          : entry
      );
      persistSaved(next);
      renderSaved();
      return;
    }
    // Cycle recurrence: one-off → monthly → weekly → one-off.
    const rec = e.target.closest("[data-recur]");
    if (rec) {
      const id = rec.dataset.recur;
      const next = loadSaved().map((entry) => {
        if (entry.id !== id) return entry;
        const every = RECUR_CYCLE[entry.recur || ""];
        const nextDate = every
          ? firstFutureOccurrence(entry.state.issued, every)
          : "";
        return { ...entry, recur: every, nextDate };
      });
      persistSaved(next);
      renderSaved();
      return;
    }
    // Spin up the next invoice in the series as a fresh, unsaved draft.
    const gen = e.target.closest("[data-gennext]");
    if (gen) {
      const id = gen.dataset.gennext;
      const list = loadSaved();
      const entry = list.find((x) => x.id === id);
      if (!entry || !entry.recur) return;
      const nd = entry.nextDate || firstFutureOccurrence(entry.state.issued, entry.recur);
      const gap = dayGap(entry.state.issued, entry.state.due);
      const newDue = gap != null ? addDays(nd, gap) : entry.state.due;
      const newNumber = bumpNumber(entry.state.number);
      state = {
        ...JSON.parse(JSON.stringify(entry.state)),
        number: newNumber,
        issued: nd,
        due: newDue,
      };
      currentSavedId = null; // a generated invoice is a fresh, unsaved draft
      applyAndSaveLogo(entry.logo || "");
      saveState(state);
      syncTopFields(state);
      renderItemsEditor(state);
      renderPreview(state);
      // March the template forward so the next generation continues the series.
      const advanced = list.map((x) =>
        x.id === id
          ? { ...x, nextDate: addPeriod(nd, entry.recur), state: { ...x.state, number: newNumber, issued: nd, due: newDue } }
          : x
      );
      persistSaved(advanced);
      renderSaved();
      return;
    }
    const dup = e.target.closest("[data-dup]");
    if (dup) {
      const entry = loadSaved().find((x) => x.id === dup.dataset.dup);
      if (entry) loadEntry(entry, { asDuplicate: true });
      return;
    }
    const rm = e.target.closest("[data-rm]");
    if (rm) {
      if (!confirm("Delete this saved invoice?")) return;
      persistSaved(loadSaved().filter((x) => x.id !== rm.dataset.rm));
      if (currentSavedId === rm.dataset.rm) currentSavedId = null;
      renderSaved();
      return;
    }
    const open = e.target.closest("[data-open]");
    if (open) {
      const entry = loadSaved().find((x) => x.id === open.dataset.open);
      if (entry) loadEntry(entry, { asDuplicate: false });
    }
  });

  // ---- Saved clients ----
  const clientBar = $("clientBar");
  const clientChips = $("clientChips");
  const saveClientBtn = $("saveClientBtn");

  function renderClients() {
    const list = loadClients();
    if (!list.length) {
      clientBar.hidden = true;
      clientChips.innerHTML = "";
      return;
    }
    clientBar.hidden = false;
    clientChips.innerHTML = "";
    list.forEach((c, i) => {
      const chip = document.createElement("span");
      chip.className = "client-chip";
      chip.innerHTML = `
        <button class="client-fill" type="button" data-fill="${i}"></button>
        <button class="client-rm" type="button" data-rmclient="${i}" aria-label="Forget client">×</button>`;
      chip.querySelector(".client-fill").textContent = c.name;
      clientChips.appendChild(chip);
    });
  }

  saveClientBtn.addEventListener("click", () => {
    const name = (state.toName || "").trim();
    if (!name) {
      saveClientBtn.textContent = "Add a client name first";
      setTimeout(() => { saveClientBtn.textContent = "+ Remember this client"; }, 1600);
      return;
    }
    const list = loadClients();
    const details = state.toDetails || "";
    const idx = list.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
    let next;
    if (idx >= 0) {
      next = list.map((c, i) => (i === idx ? { name, details } : c));
    } else {
      next = [...list, { name, details }];
    }
    persistClients(next);
    renderClients();
    saveClientBtn.textContent = "Saved ✓";
    setTimeout(() => { saveClientBtn.textContent = "+ Remember this client"; }, 1600);
  });

  clientChips.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rmclient]");
    if (rm) {
      const i = Number(rm.dataset.rmclient);
      persistClients(loadClients().filter((_, idx) => idx !== i));
      renderClients();
      return;
    }
    const fill = e.target.closest("[data-fill]");
    if (fill) {
      const c = loadClients()[Number(fill.dataset.fill)];
      if (!c) return;
      state = { ...state, toName: c.name, toDetails: c.details || "" };
      saveState(state);
      syncTopFields(state);
      renderPreview(state);
    }
  });

  renderItemsEditor(state);
  renderPreview(state);
  renderSaved();
  renderClients();
}

function syncTopFields(state) {
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const key = el.dataset.bind;
    el.value = state[key] != null ? state[key] : "";
  });
}

document.addEventListener("DOMContentLoaded", init);
