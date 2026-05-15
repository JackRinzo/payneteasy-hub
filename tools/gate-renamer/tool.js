function run({ findText, replaceWith, currency }) {
  function setReactInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  const search = (findText || "").trim();
  const replacement = replaceWith ?? "";

  if (!search) {
    throw new Error("Text to find is required");
  }

  const rows = document.querySelectorAll("tr");
  let count = 0;
  let skipped = 0;

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) return;
    const originalName = cells[0].innerText.trim();
    const input = cells[1].querySelector("input");
    if (!originalName || !input) return;

    if (!originalName.includes(search)) {
      skipped++;
      return;
    }

    let updated = originalName.split(search).join(replacement);
    if (currency && currency.trim()) {
      updated = updated.replace(/\b[A-Z]{3}\b$/, currency.trim().toUpperCase());
    }

    setReactInputValue(input, updated);
    count++;
  });

  return { success: true, count, skipped };
}
