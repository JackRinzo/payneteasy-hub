(async function openHubTab() {
  const status = document.getElementById("status");
  const hubUrl = chrome.runtime.getURL("hub.html");

  try {
    const existingTabs = await chrome.tabs.query({ url: hubUrl });
    if (existingTabs.length > 0) {
      await chrome.tabs.update(existingTabs[0].id, { active: true });
      status.textContent = "Hub already open. Switched to existing tab.";
    } else {
      await chrome.tabs.create({ url: hubUrl });
      status.textContent = "Hub opened successfully.";
    }
  } catch (error) {
    status.textContent = `Failed to open hub: ${error.message}`;
  } finally {
    setTimeout(() => window.close(), 400);
  }
})();
