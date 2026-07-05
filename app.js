const STARTER = window.STARDEW_MOD_WIKI_DATA;
const STORAGE_KEY = "modded-stardew-lookup-data-v2";

let state = {
  tab: "crops",
  query: "",
  type: "all",
  mod: "all",
  season: "all",
  data: loadData()
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const content = $("#content");
const searchInput = $("#searchInput");
const typeFilter = $("#typeFilter");
const modFilter = $("#modFilter");
const seasonFilter = $("#seasonFilter");
const detailDialog = $("#detailDialog");
const detailKind = $("#detailKind");
const detailTitle = $("#detailTitle");
const detailBody = $("#detailBody");

const TAB_TITLES = {
  all: "All",
  crops: "Crops",
  fish: "Fish",
  machines: "Machines",
  cooking: "Cooking",
  food: "Food",
  forage: "Forage",
  trees: "Trees",
  animals: "Animals",
  sources: "Sources",
  data: "Data"
};

init();

function init() {
  populateFilters();
  bindEvents();
  render();
  registerInstallPrompt();
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(STARTER);
  try {
    return normalizeData(JSON.parse(saved));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return structuredClone(STARTER);
  }
}

function normalizeData(data) {
  return {
    meta: { ...STARTER.meta, ...(data.meta || {}) },
    mods: data.mods || [],
    sources: data.sources || [],
    items: data.items || [],
    machines: data.machines || [],
    recipes: data.recipes || [],
    animals: data.animals || []
  };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data, null, 2));
}

function bindEvents() {
  searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });
  typeFilter.addEventListener("change", (event) => {
    state.type = event.target.value;
    render();
  });
  modFilter.addEventListener("change", (event) => {
    state.mod = event.target.value;
    render();
  });
  seasonFilter.addEventListener("change", (event) => {
    state.season = event.target.value;
    render();
  });
  $$(".tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      $$(".tabs button").forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });
  $("#closeDetail").addEventListener("click", () => detailDialog.close());
  detailDialog.addEventListener("click", (event) => {
    const rect = detailDialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) detailDialog.close();
  });
}

function populateFilters() {
  const types = unique([
    ...state.data.items.map((item) => item.type),
    "machine",
    "recipe",
    "animal"
  ]).sort();
  typeFilter.innerHTML = [`<option value="all">All types</option>`, ...types.map((type) => `<option value="${esc(type)}">${title(type)}</option>`)].join("");
  modFilter.innerHTML = [`<option value="all">All mods</option>`, ...state.data.mods.map((mod) => `<option value="${esc(mod.id)}">${esc(mod.name)}</option>`)].join("");
}

function render() {
  const counts = countByCategory();
  $("#datasetMeta").textContent = `${counts.crops} crops · ${counts.fish} fish · ${state.data.machines.length} machines`;
  if (state.tab === "data") return renderDataPanel();
  if (state.tab === "sources") return renderSources();

  const rows = filteredRows();
  content.innerHTML = `
    <div class="sectionTitle">
      <h2>${TAB_TITLES[state.tab] || "All"}</h2>
      <span class="count">${rows.length}</span>
    </div>
    ${rows.length ? `<div class="cardGrid">${rows.map(renderCard).join("")}</div>` : emptyState()}
  `;
  $$(".card[data-kind]", content).forEach((card) => card.addEventListener("click", () => openDetail(card.dataset.kind, card.dataset.id)));
}

function countByCategory() {
  const rows = allRows();
  return {
    crops: rows.filter((row) => isCrop(row)).length,
    fish: rows.filter((row) => isFish(row)).length
  };
}

function filteredRows() {
  let rows = allRows().filter(matchesTab);
  if (state.type !== "all") rows = rows.filter((row) => row.type === state.type || row.kind === state.type);
  if (state.mod !== "all") rows = rows.filter((row) => row.mod === state.mod);
  if (state.season !== "all") {
    rows = rows.filter((row) => {
      if (!row.season) return false;
      return row.season.includes(state.season) || (state.season !== "all-season" && row.season.includes("all-season"));
    });
  }
  if (state.query) rows = rows.filter((row) => searchableText(row).includes(state.query));
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

function allRows() {
  return [
    ...state.data.items.map((item) => ({ ...item, kind: "item" })),
    ...state.data.machines.map((machine) => ({ ...machine, kind: "machine", type: "machine" })),
    ...state.data.recipes.map((recipe) => ({ ...recipe, kind: "recipe", type: "recipe" })),
    ...state.data.animals.map((animal) => ({ ...animal, kind: "animal", type: "animal" }))
  ];
}

function matchesTab(row) {
  if (state.tab === "all") return true;
  if (state.tab === "crops") return isCrop(row);
  if (state.tab === "fish") return isFish(row);
  if (state.tab === "machines") return row.kind === "machine";
  if (state.tab === "cooking") return row.kind === "recipe";
  if (state.tab === "food") return row.kind === "item" && hasType(row, ["food", "consumable", "dish", "meal"]);
  if (state.tab === "forage") return row.kind === "item" && hasType(row, ["forage", "mushroom", "bush"]);
  if (state.tab === "trees") return row.kind === "item" && hasType(row, ["tree"]);
  if (state.tab === "animals") return row.kind === "animal";
  return true;
}

function isCrop(row) {
  return row.kind === "item" && hasType(row, ["crop", "flower"]);
}

function isFish(row) {
  return row.kind === "item" && hasType(row, ["fish"]);
}

function hasType(row, terms) {
  const value = normalize(row.type || "");
  return terms.some((term) => value.includes(normalize(term)));
}

function renderCard(row) {
  const meta = modName(row.mod);
  const detail = cardDetail(row);
  const tags = (row.tags || []).slice(0, 2).map((tag) => `<span class="chip">#${esc(tag)}</span>`).join("");
  return `
    <button class="card" data-kind="${esc(row.kind)}" data-id="${esc(row.id)}" type="button">
      <div class="cardTop">
        ${sprite(row)}
        <div class="cardText">
          <h3>${esc(row.name)}</h3>
          <p>${esc(detail)}</p>
        </div>
        <span class="badge">${esc(shortKind(row))}</span>
      </div>
      <div class="tagRow">
        <span class="chip good">${esc(meta)}</span>
        ${tags}
      </div>
    </button>
  `;
}

function shortKind(row) {
  if (row.kind === "item") return row.type || "item";
  if (row.kind === "recipe") return "recipe";
  return row.kind;
}

function cardDetail(row) {
  if (row.kind === "item") {
    const season = row.season?.length ? ` · ${row.season.join(", ")}` : "";
    return `${title(row.type || "item")}${season}`;
  }
  if (row.kind === "machine") return `${compatibleItems(row).length} matches`;
  if (row.kind === "recipe") return `${row.flexible ? "Flexible" : "Fixed"} · ${(row.ingredients || []).length}`;
  if (row.kind === "animal") return `${row.building || ""} · ${(row.products || []).join(", ")}`;
  return "";
}

function openDetail(kind, id) {
  const map = {
    item: state.data.items,
    machine: state.data.machines,
    recipe: state.data.recipes,
    animal: state.data.animals
  };
  const entity = map[kind]?.find((entry) => entry.id === id);
  if (!entity) return;
  detailKind.textContent = `${kind} · ${modName(entity.mod)}`;
  detailTitle.textContent = entity.name;
  detailBody.innerHTML = `${heroImage(entity)}${detailHtml(kind, entity)}`;
  detailDialog.showModal();
}

function detailHtml(kind, entity) {
  if (kind === "item") return itemDetail(entity);
  if (kind === "machine") return machineDetail(entity);
  if (kind === "recipe") return recipeDetail(entity);
  if (kind === "animal") return animalDetail(entity);
  return "";
}

function itemDetail(item) {
  const machines = machinesUsingItem(item);
  const recipes = recipesUsingItem(item);
  return `
    ${basicFacts(item)}
    ${tagSection(item.tags)}
    ${detailRows("Machines", machines.map((entry) => ({
      title: entry.machine.name,
      text: `${entry.rule.output}${entry.rule.time ? ` · ${entry.rule.time}` : ""}${entry.rule.note ? ` · ${entry.rule.note}` : ""}`
    })))}
    ${detailRows("Cooking", recipes.map((recipe) => ({
      title: recipe.name,
      text: recipe.flexible ? "flexible tag" : "fixed ingredient"
    })))}
    ${sourceLine(item.source)}
  `;
}

function machineDetail(machine) {
  const matches = compatibleItems(machine);
  return `
    ${basicFacts(machine)}
    ${detailRows("Outputs", (machine.rules || []).map((rule) => ({
      title: rule.output,
      text: `${formatRule(rule)}${rule.note ? ` · ${rule.note}` : ""}`
    })))}
    ${detailRows("Matching items", matches.map((match) => ({
      title: match.item.name,
      text: `${modName(match.item.mod)} · ${match.rule.output}${match.rule.time ? ` · ${match.rule.time}` : ""}`
    })))}
    ${sourceLine(machine.source)}
  `;
}

function recipeDetail(recipe) {
  const flexibleRows = (recipe.ingredients || []).flatMap((ingredient) => {
    if (!ingredient.tag) return [{ title: ingredient.label || ingredient.item, text: "fixed" }];
    const matches = state.data.items.filter((item) => hasTag(item, ingredient.tag));
    if (!matches.length) return [{ title: ingredient.label || ingredient.tag, text: `#${ingredient.tag}` }];
    return matches.map((item) => ({ title: item.name, text: `${ingredient.label || ingredient.tag} · ${modName(item.mod)}` }));
  });
  return `
    ${basicFacts(recipe)}
    ${detailRows("Ingredients", (recipe.ingredients || []).map((ingredient) => ({
      title: ingredient.label || ingredient.item || ingredient.tag,
      text: ingredient.tag ? `#${ingredient.tag}` : "fixed"
    })))}
    ${detailRows("Substitutes", flexibleRows)}
    ${recipe.notes ? `<section class="detailSection"><h3>Note</h3><p class="notice">${esc(recipe.notes)}</p></section>` : ""}
    ${sourceLine(recipe.source)}
  `;
}

function animalDetail(animal) {
  const productItems = state.data.items.filter((item) => (animal.products || []).some((product) => normalize(product) === normalize(item.name)));
  return `
    ${basicFacts(animal)}
    ${detailRows("Products", (animal.products || []).map((product) => ({ title: product, text: "" })))}
    ${animal.frequency ? `<section class="detailSection"><h3>Frequency</h3><p class="notice">${esc(animal.frequency)}</p></section>` : ""}
    ${detailRows("Machine uses", productItems.flatMap((item) => machinesUsingItem(item).map((match) => ({
      title: `${item.name} → ${match.machine.name}`,
      text: match.rule.output
    }))))}
    ${animal.notes ? `<section class="detailSection"><h3>Note</h3><p class="notice">${esc(animal.notes)}</p></section>` : ""}
    ${sourceLine(animal.source)}
  `;
}

function basicFacts(entity) {
  const rows = [];
  if (entity.type) rows.push(["Type", title(entity.type)]);
  if (entity.mod) rows.push(["Mod", modName(entity.mod)]);
  if (entity.season?.length) rows.push(["Season", entity.season.join(", ")]);
  if (entity.locations?.length) rows.push(["Location", entity.locations.join(", ")]);
  if (entity.time) rows.push(["Time", entity.time]);
  if (entity.weather) rows.push(["Weather", entity.weather]);
  if (entity.price) rows.push(["Price", `${entity.price}g`]);
  if (entity.building) rows.push(["Building", entity.building]);
  if (!rows.length) return "";
  return `<section class="detailSection">${rows.map(([key, value]) => `<div class="kv"><b>${esc(key)}</b><span>${esc(value)}</span></div>`).join("")}</section>`;
}

function tagSection(tags = []) {
  if (!tags.length) return `<section class="detailSection"><h3>Tags</h3><span class="chip warn">none</span></section>`;
  return `<section class="detailSection"><h3>Tags</h3><div class="tagRow">${tags.map((tag) => `<span class="chip">#${esc(tag)}</span>`).join("")}</div></section>`;
}

function detailRows(titleText, rows) {
  if (!rows?.length) return "";
  return `
    <section class="detailSection">
      <h3>${esc(titleText)}</h3>
      <div class="detailList">
        ${rows.map((row) => `<div class="detailRow">${smallSprite(row.entity || row.item || null)}<strong>${esc(row.title)}</strong>${row.text ? `<span>${esc(row.text)}</span>` : ""}</div>`).join("")}
      </div>
    </section>
  `;
}

function sourceLine(sourceId) {
  const source = state.data.sources.find((item) => item.id === sourceId);
  if (!source) return "";
  return `<section class="detailSection"><h3>Source</h3><p class="notice"><a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)}</a></p></section>`;
}

function compatibleItems(machine) {
  return (machine.rules || []).flatMap((rule) => {
    return state.data.items
      .filter((item) => ruleMatchesItem(rule, item))
      .map((item) => ({ machine, rule, item }));
  });
}

function machinesUsingItem(item) {
  return state.data.machines.flatMap((machine) => {
    return (machine.rules || [])
      .filter((rule) => ruleMatchesItem(rule, item))
      .map((rule) => ({ machine, rule, item }));
  });
}

function recipesUsingItem(item) {
  return state.data.recipes.filter((recipe) => (recipe.ingredients || []).some((ingredient) => {
    if (ingredient.item) return normalize(ingredient.item) === normalize(item.id) || normalize(ingredient.item) === normalize(item.name);
    if (ingredient.tag) return hasTag(item, ingredient.tag);
    return false;
  }));
}

function ruleMatchesItem(rule, item) {
  const any = rule.anyTags || [];
  const all = rule.allTags || [];
  const not = rule.notTags || [];
  if (not.some((tag) => hasTag(item, tag))) return false;
  if (all.length && !all.every((tag) => hasTag(item, tag))) return false;
  if (any.length && !any.some((tag) => hasTag(item, tag))) return false;
  return any.length > 0 || all.length > 0;
}

function formatRule(rule) {
  const parts = [];
  if (rule.anyTags?.length) parts.push(`any: ${rule.anyTags.map((tag) => `#${tag}`).join(", ")}`);
  if (rule.allTags?.length) parts.push(`all: ${rule.allTags.map((tag) => `#${tag}`).join(", ")}`);
  if (rule.notTags?.length) parts.push(`not: ${rule.notTags.map((tag) => `#${tag}`).join(", ")}`);
  if (rule.time) parts.push(rule.time);
  return parts.join(" · ");
}

function renderSources() {
  const rows = state.data.sources
    .filter((source) => state.mod === "all" || source.mod === state.mod)
    .filter((source) => !state.query || searchableText(source).includes(state.query))
    .sort((a, b) => modName(a.mod).localeCompare(modName(b.mod)) || a.title.localeCompare(b.title));
  content.innerHTML = `
    <div class="sectionTitle">
      <h2>Sources</h2>
      <span class="count">${rows.length}</span>
    </div>
    <div class="cardGrid">
      ${rows.map((source) => `
        <a class="card sourceCard" href="${esc(source.url)}" target="_blank" rel="noreferrer">
          <div class="cardTop">
            ${sourceIcon(source)}
            <div class="cardText">
              <h3>${esc(source.title)}</h3>
              <p>${esc(modName(source.mod))}</p>
            </div>
            <span class="badge">${esc(source.kind)}</span>
          </div>
        </a>
      `).join("")}
    </div>
  `;
}

function renderDataPanel() {
  const dataText = JSON.stringify(state.data, null, 2);
  const tagged = state.data.items.filter((item) => item.tags?.length).length;
  const untagged = state.data.items.length - tagged;
  content.innerHTML = `
    <div class="sectionTitle">
      <h2>Data</h2>
      <span class="count">${tagged} tagged · ${untagged} untagged</span>
    </div>
    <section class="dataPanel">
      <textarea id="dataTextarea" spellcheck="false">${esc(dataText)}</textarea>
      <div class="sectionActions">
        <button class="miniButton primary" id="importData" type="button">Import</button>
        <button class="miniButton" id="exportData" type="button">Export</button>
        <button class="miniButton" id="resetData" type="button">Reset</button>
      </div>
      <p id="dataStatus" class="notice"></p>
    </section>
  `;
  $("#importData").addEventListener("click", importDataFromTextarea);
  $("#exportData").addEventListener("click", exportDataFile);
  $("#resetData").addEventListener("click", resetData);
}

function importDataFromTextarea() {
  const status = $("#dataStatus");
  try {
    const next = normalizeData(JSON.parse($("#dataTextarea").value));
    state.data = next;
    saveData();
    populateFilters();
    status.textContent = "Imported.";
    render();
  } catch (error) {
    status.textContent = `Import failed: ${error.message}`;
  }
}

function exportDataFile() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modded-stardew-lookup-data.json";
  a.click();
  URL.revokeObjectURL(url);
}

function resetData() {
  state.data = structuredClone(STARTER);
  localStorage.removeItem(STORAGE_KEY);
  populateFilters();
  render();
}

function registerInstallPrompt() {
  let deferredPrompt;
  const installBtn = $("#installBtn");
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn.classList.remove("hidden");
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add("hidden");
  });
}

function hasTag(item, tag) {
  return (item.tags || []).map(normalize).includes(normalize(tag));
}

function searchableText(row) {
  return JSON.stringify(row).toLowerCase();
}

function modName(id) {
  return state.data.mods.find((mod) => mod.id === id)?.name || id || "Unknown";
}

function sourceById(id) {
  return state.data.sources.find((source) => source.id === id);
}

function imageUrl(entity) {
  if (!entity) return "";
  if (entity.image) return entity.image;
  const source = sourceById(entity.source);
  const sourceUrl = source?.url || entity.sourcePage || "";
  const file = fileName(entity);
  if (!file) return "";
  const encoded = encodeURIComponent(file).replaceAll("%2F", "/");
  if (sourceUrl.includes("stardewcornucopia.wiki.gg")) return `https://stardewcornucopia.wiki.gg/wiki/Special:Redirect/file/${encoded}`;
  if (sourceUrl.includes("stardew-valley-expanded.fandom.com")) return `https://stardew-valley-expanded.fandom.com/wiki/Special:Redirect/file/${encoded}`;
  if (sourceUrl.includes("ridgeside.fandom.com")) return `https://ridgeside.fandom.com/wiki/Special:Redirect/file/${encoded}`;
  if (sourceUrl.includes("eastscarp.fandom.com")) return `https://eastscarp.fandom.com/wiki/Special:Redirect/file/${encoded}`;
  if (entity.mod === "vanilla") return `https://stardewvalleywiki.com/mediawiki/index.php?title=Special:Redirect/file/${encoded}`;
  return "";
}

function fileName(entity) {
  if (entity.imageFile) return entity.imageFile;
  if (!entity.name) return "";
  return `${String(entity.name).replaceAll(" / ", " ").replaceAll("/", " ").replaceAll(" ", "_")}.png`;
}

function sprite(entity) {
  const url = imageUrl(entity);
  const letter = (entity?.name || "?").trim().slice(0, 1);
  if (!url) return `<span class="sprite empty" aria-hidden="true"><span>${esc(letter)}</span></span>`;
  return `<span class="sprite" aria-hidden="true"><img src="${esc(url)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('empty');this.remove();"><span>${esc(letter)}</span></span>`;
}

function smallSprite(entity) {
  if (!entity) return "";
  return sprite(entity).replace('class="sprite"', 'class="sprite small"').replace('class="sprite empty"', 'class="sprite small empty"');
}

function heroImage(entity) {
  const url = imageUrl(entity);
  if (!url) return "";
  return `<div class="heroSprite">${sprite(entity)}</div>`;
}

function sourceIcon(source) {
  const letter = (modName(source.mod) || "?").trim().slice(0, 1);
  return `<span class="sprite empty" aria-hidden="true"><span>${esc(letter)}</span></span>`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function title(value) {
  return String(value || "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function emptyState() {
  return $("#emptyStateTemplate").innerHTML;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
