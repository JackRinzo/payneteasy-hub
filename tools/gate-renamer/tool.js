function run({ findText, replaceWith, currency }) {
  function setReactInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function isGateNameInput(input) {
    if (!input) return false;
    const type = (input.type || "text").toLowerCase();
    return type !== "checkbox" && type !== "radio" && type !== "hidden";
  }

  function getNewGateNameInput(row) {
    return [...row.querySelectorAll("input")].find(isGateNameInput) || null;
  }

  function getGateNameFromRow(row, textInput) {
    const cells = [...row.querySelectorAll("td")];
    if (!cells.length) return "";

    const inputCellIndex = cells.findIndex((cell) => cell.contains(textInput));
    if (inputCellIndex > 0) {
      const fromPreviousCell = cells[inputCellIndex - 1].innerText.trim();
      if (fromPreviousCell) return fromPreviousCell;
    }

    let best = "";
    for (const cell of cells) {
      if (textInput && cell.contains(textInput)) continue;
      const text = cell.innerText.trim();
      if (text.length > best.length) best = text;
    }
    return best;
  }

  function isCloneGateTable(table) {
    const text = table.innerText || "";
    return /gate name/i.test(text) && /new gate name/i.test(text);
  }

  function collectRowsFromTable(table) {
    return [...table.querySelectorAll("tr")].filter((row) => {
      const input = getNewGateNameInput(row);
      if (!input) return false;
      return Boolean(getGateNameFromRow(row, input));
    });
  }

  function findCloneGateRows() {
    for (const table of document.querySelectorAll("table")) {
      if (!isCloneGateTable(table)) continue;
      const rows = collectRowsFromTable(table);
      if (rows.length) return rows;
    }

    const modalRoots = document.querySelectorAll('[role="dialog"], [class*="modal" i], [class*="Modal"]');
    for (const root of modalRoots) {
      if (!/clone project/i.test(root.textContent || "")) continue;
      const rows = [...root.querySelectorAll("tr")].filter((row) => {
        const input = getNewGateNameInput(row);
        if (!input) return false;
        return Boolean(getGateNameFromRow(row, input));
      });
      if (rows.length) return rows;
    }

    return [...document.querySelectorAll("tr")].filter((row) => {
      const input = getNewGateNameInput(row);
      if (!input) return false;
      const name = getGateNameFromRow(row, input);
      return name.length > 1;
    });
  }

  const search = (findText || "").trim();
  const replacement = replaceWith ?? "";

  if (!search) {
    throw new Error("Text to find is required");
  }

  const rows = findCloneGateRows();
  let count = 0;
  let skipped = 0;

  if (!rows.length) {
    throw new Error("No gate rows found. Open Clone Project, select CLONE GATE, and try again.");
  }

  rows.forEach((row) => {
    const input = getNewGateNameInput(row);
    const originalName = getGateNameFromRow(row, input);
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

  if (count === 0 && skipped === 0) {
    throw new Error(`Found ${rows.length} gate row(s), but could not read gate names.`);
  }

  if (count === 0 && skipped > 0) {
    throw new Error(
      `Text "${search}" was not found in any gate name (${skipped} row(s) checked). Use exact text from the Gate name column.`
    );
  }

  return { success: true, count, skipped, rowsFound: rows.length };
}
