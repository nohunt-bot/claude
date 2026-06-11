"use strict";

// QuickInvoice — fully client-side invoice generator.
// State lives in localStorage; no network, no account.

const STORAGE_KEY = "quickinvoice.v1";
const LOGO_KEY = "quickinvoice.logo";

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
    if (!confirm("Clear this invoice and start over?")) return;
    state = defaultState();
    saveState(state);
    try { localStorage.removeItem(LOGO_KEY); } catch {}
    applyLogo("");
    logoInput.value = "";
    syncTopFields(state);
    renderItemsEditor(state);
    renderPreview(state);
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

  renderItemsEditor(state);
  renderPreview(state);
}

function syncTopFields(state) {
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const key = el.dataset.bind;
    el.value = state[key] != null ? state[key] : "";
  });
}

document.addEventListener("DOMContentLoaded", init);
