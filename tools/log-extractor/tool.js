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

  const lines = document.body.innerText.split("\n");
  let output = "";

  if (mode === "merchant") {
    const logBlockStart =
      /request_data|response_data|NOTIFICATION_START|NOTIFICATION_OK|NOTIFICATION_ERROR|REDIRECTED_TO_MERCHANT/i;
    const timestampLine = /^\d{4}-\d{2}-\d{2}/;
    const uiNoise =
      /^(declined|sale|Current status|Balance:|Initial amount:|Last change|Currency conv|Exchange rate|Effective rate|Memos|Order actions|Chargeback|Mark as fraud|Query status|Change transaction|Rollback|Enable partial|Callbacks|Documents|\d+\.\d{2}\s+[A-Z]{3}|[\d\.-]+)$/i;
    let collecting = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (logBlockStart.test(line)) {
        collecting = true;
        if (!uiNoise.test(trimmed)) output += `\n${line}\n`;
        continue;
      }
      if (collecting && timestampLine.test(line) && !logBlockStart.test(line)) {
        collecting = false;
        continue;
      }
      if (collecting && !uiNoise.test(trimmed)) output += `${line}\n`;
    }
  } else {
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
