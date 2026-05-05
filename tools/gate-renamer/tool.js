function run({ word, currency }) {
  function setReactInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (!word || !word.trim()) {
    throw new Error("word is required");
  }

  const rows = document.querySelectorAll("tr");
  let count = 0;

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) return;
    const originalName = cells[0].innerText.trim();
    const input = cells[1].querySelector("input");
    if (!originalName || !input) return;

    let updated = originalName.replace(/^\S+/, word.trim());
    if (currency && currency.trim()) {
      updated = updated.replace(/\b[A-Z]{3}\b$/, currency.trim().toUpperCase());
    }

    setReactInputValue(input, updated);
    count++;
  });

  return { success: true, count };
}
