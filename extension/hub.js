const REGISTRY_URL = "https://jackrinzo.github.io/payneteasy-hub/tools/index.json";

const state = {
  tools: [],
  activeTool: null,
  activePaynetEasyTab: null
};

const sidebarEl = document.getElementById("sidebar");
const toolHeaderEl = document.getElementById("toolHeader");
const toolContainerEl = document.getElementById("toolContainer");
const statusEl = document.getElementById("status");

function setStatus(message, type = "info") {
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
}

async function findTargetTab() {
  const tabs = await chrome.tabs.query({ url: ["https://*.payneteasy.eu/*"] });
  if (!tabs.length) {
    state.activePaynetEasyTab = null;
    return null;
  }

  const newest = [...tabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
  state.activePaynetEasyTab = newest;
  return newest;
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return response.text();
}

function absoluteToolUrl(relativePath) {
  return new URL(relativePath, REGISTRY_URL).toString();
}

function getFormData(formElement) {
  const raw = new FormData(formElement);
  return Object.fromEntries(raw.entries());
}

function normalizeFilename(name, fallback) {
  const trimmed = (name || "").trim();
  const base = trimmed || fallback;
  const cleaned = base.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  return cleaned.toLowerCase().endsWith(".txt") ? cleaned : `${cleaned}.txt`;
}

function runInjectedToolSource(source, params, tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (toolSource, toolParams) => {
      const resolver = new Function(`
        ${toolSource}
        if (typeof run !== "function") {
          throw new Error("Tool script must define a run(params) function.");
        }
        return run;
      `);
      const runFn = resolver();
      return await runFn(toolParams);
    },
    args: [source, params]
  });
}

async function executeActiveTool() {
  const button = toolContainerEl.querySelector("[data-default-action='true']");
  const form = toolContainerEl.querySelector("form");

  if (!state.activeTool) {
    setStatus("No tool selected.", "error");
    return;
  }
  if (!button || !form) {
    setStatus("Active tool UI is missing form/action elements.", "error");
    return;
  }

  const tab = await findTargetTab();
  if (!tab) {
    setStatus("No active payneteasy.eu tab found. Open a PaynetEasy page and try again.", "error");
    return;
  }

  try {
    button.disabled = true;
    setStatus("Running tool...", "info");

    const payload = getFormData(form);
    const requestedFileName = payload.fileName;
    delete payload.fileName;
    const scriptUrl = absoluteToolUrl(state.activeTool.script);
    const toolSource = await fetchText(scriptUrl);
    const result = await runInjectedToolSource(toolSource, payload, tab.id);
    const output = Array.isArray(result) && result[0] ? result[0].result : null;

    if (output === null || output === undefined || output === "") {
      const isProcessorLogExtractor =
        state.activeTool.id === "log-extractor" && payload.mode === "processor";
      setStatus(isProcessorLogExtractor ? "No logs for your request" : "Completed. No output returned.", "ok");
      return;
    }

    if (typeof output === "string") {
      const fallbackName = `${state.activeTool.id}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;
      const suggestedFile = normalizeFilename(requestedFileName, fallbackName);
      const blob = new Blob([output], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      await chrome.downloads.download({ url, filename: suggestedFile, saveAs: true });
      URL.revokeObjectURL(url);
      setStatus(`Completed. Output downloaded as ${suggestedFile}.`, "ok");
      return;
    }

    if (typeof output === "object" && output.success) {
      const parts = [];
      if (typeof output.count === "number") parts.push(`updated: ${output.count}`);
      if (typeof output.skipped === "number" && output.skipped > 0) {
        parts.push(`skipped (no match): ${output.skipped}`);
      }
      const detailText = parts.length ? ` ${parts.join(", ")}.` : "";
      setStatus(`Completed successfully.${detailText}`, "ok");
      return;
    }

    setStatus(`Completed: ${JSON.stringify(output)}`, "ok");
  } catch (error) {
    setStatus(`Execution failed: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
}

function wireToolUiActions() {
  const actionButton = toolContainerEl.querySelector("[data-default-action='true']");
  if (actionButton) {
    actionButton.addEventListener("click", (event) => {
      event.preventDefault();
      executeActiveTool();
    });
  }
}

function wireToolSpecificBehavior(tool) {
  if (tool.id !== "log-extractor") return;

  const modeSelect = toolContainerEl.querySelector("#modeSelect");
  const processorNameField = toolContainerEl.querySelector("#processorNameField");
  const gateIdField = toolContainerEl.querySelector("#gateIdField");
  if (!modeSelect || !processorNameField || !gateIdField) return;

  const syncModeFields = () => {
    const isProcessorMode = modeSelect.value === "processor";
    processorNameField.style.display = isProcessorMode ? "grid" : "none";
    gateIdField.style.display = isProcessorMode ? "grid" : "none";
  };

  modeSelect.addEventListener("change", syncModeFields);
  syncModeFields();
}

async function renderTool(tool) {
  state.activeTool = tool;
  toolHeaderEl.innerHTML = `
    <h2 style="margin: 0 0 4px; font-size: 14px;">${tool.icon || "🧩"} ${tool.name}</h2>
    <div style="color: #5f7ea7; font-size: 12px; margin-bottom: 8px; line-height: 1.2;">${tool.description || ""}</div>
  `;

  try {
    toolContainerEl.classList.remove("loading");
    toolContainerEl.innerHTML = await fetchText(absoluteToolUrl(tool.ui));
    wireToolUiActions();
    wireToolSpecificBehavior(tool);
    setStatus(`Loaded ${tool.name}.`, "info");
  } catch (error) {
    toolContainerEl.innerHTML = `<div style="color:#fda4af;">Failed to load tool UI: ${error.message}</div>`;
    setStatus(`Could not load ${tool.name}.`, "error");
  }

  for (const button of sidebarEl.querySelectorAll(".tool-tab")) {
    button.classList.toggle("active", button.dataset.toolId === tool.id);
  }
}

function renderSidebar() {
  sidebarEl.innerHTML = "";
  for (const tool of state.tools) {
    const btn = document.createElement("button");
    btn.className = "tool-tab";
    btn.dataset.toolId = tool.id;
    btn.innerHTML = `
      <span class="tool-icon">${tool.icon || "🧩"}</span>
      <span>${tool.name}</span>
    `;
    btn.addEventListener("click", () => renderTool(tool));
    sidebarEl.appendChild(btn);
  }
}

async function loadRegistry() {
  const response = await fetch(REGISTRY_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Registry fetch failed (${response.status}).`);
  }
  const registry = await response.json();
  if (!registry.tools || !Array.isArray(registry.tools)) {
    throw new Error("Registry is missing tools array.");
  }
  return registry;
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (!state.activeTool) return;
  const target = event.target;
  const isTextarea = target && target.tagName === "TEXTAREA";
  if (isTextarea) return;
  const btn = toolContainerEl.querySelector("[data-default-action='true']");
  if (btn) {
    event.preventDefault();
    btn.click();
  }
});

async function init() {
  try {
    await findTargetTab();
    const registry = await loadRegistry();
    state.tools = registry.tools;
    renderSidebar();

    if (!state.tools.length) {
      toolContainerEl.innerHTML = "<div>No tools found in registry.</div>";
      setStatus("Registry loaded, but no tools are configured.", "error");
      return;
    }

    await renderTool(state.tools[0]);
  } catch (error) {
    toolContainerEl.classList.remove("loading");
    toolContainerEl.innerHTML = `<div style="color:#fda4af;">${error.message}</div>`;
    setStatus("Failed to initialize hub.", "error");
  }
}

init();
