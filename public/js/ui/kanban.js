export const renderKanban = (container, columns, onSelect) => {
  container.innerHTML = "";
  const board = document.createElement("div");
  board.className = "k-board";

  columns.forEach((column) => {
    const columnEl = document.createElement("div");
    columnEl.className = "k-column";
    columnEl.innerHTML = `<h3>${column.title}</h3>`;

    if (!column.items?.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No requests";
      columnEl.append(empty);
    } else {
      column.items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "k-card";
        card.dataset.id = item.id;
        card.innerHTML = `
          <strong>${item.title}</strong>
          <span class="muted">${item.subtitle || ""}</span>
          <span class="badge-outline">${item.meta || ""}</span>
        `;
        card.addEventListener("click", () => onSelect?.(item));
        columnEl.append(card);
      });
    }

    board.append(columnEl);
  });

  container.append(board);
};
