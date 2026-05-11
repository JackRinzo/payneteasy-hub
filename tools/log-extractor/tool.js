async function run({ mode, processorName, gateId }) {
  await new Promise((resolve) => {
    let totalHeight = 0;
    const distance = 800;
    const timer = setInterval(() => {
      window.scrollBy(0, distance);
      totalHeight += distance;
      if (totalHeight >= document.body.scrollHeight) {
        clearInterval(timer);
        resolve();
      }
    }, 200);
  });

  let output = "";

  if (mode === "merchant") {
    const allText = document.body.innerText;
    const logDataStart = allText.indexOf("Log data");
    if (logDataStart === -1) return null;

    const logSection = allText.substring(logDataStart + "Log data".length);
    const lines = logSection.split("\n");

    const logBlockStart =
      /request_data|response_data|NOTIFICATION_START|NOTIFICATION_OK|NOTIFICATION_ERROR|REDIRECTED_TO_MERCHANT/i;
    const timestampLine = /^\d{4}-\d{2}-\d{2}/;
    const endMarkers = /^Current status|^Balance:|^Order actions|^Callbacks|^Documents|^Memos/i;

    let collecting = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (endMarkers.test(trimmed)) break;

      if (logBlockStart.test(line)) {
        collecting = true;
        output += `\n${line}\n`;
        continue;
      }
      if (collecting && timestampLine.test(line) && !logBlockStart.test(line)) {
        collecting = false;
        continue;
      }
      if (collecting) output += `${line}\n`;
    }
  } else {
    const lines = document.body.innerText.split("\n");
    const normalizedProcessor = (processorName || "").trim().toLowerCase();
    const normalizedGateId = (gateId || "").trim();
    const pattern = /PROCESSOR_REQUEST|PROCESSOR_RESPONSE/i;
    let collecting = false;
    let block = [];
    let blockMatches = false;

    for (const line of lines) {
      if (pattern.test(line)) {
        collecting = true;
        block = [];
        blockMatches = false;
      }

      if (collecting) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("Log time:") && !trimmed.startsWith("Processor:")) {
          block.push(line);
        }
        if (line.includes("Processor:")) {
          if (normalizedProcessor && !line.toLowerCase().includes(normalizedProcessor)) {
            blockMatches = false;
          } else if (normalizedGateId) {
            const blocks = line.match(/\[([^\]]+)\]/g);
            if (blocks && blocks.length >= 3 && blocks[2].replace(/\[|\]/g, "") === normalizedGateId) {
              blockMatches = true;
            }
          } else {
            blockMatches = true;
          }
        }
      }

      if (collecting && /^\d{4}-\d{2}-\d{2}/.test(line) && !pattern.test(line)) {
        if (blockMatches) output += `\n${block.join("\n")}\n`;
        collecting = false;
      }
    }

    if (collecting && blockMatches) {
      output += `\n${block.join("\n")}\n`;
    }
  }

  return output.trim() ? output : null;
}
