let backdrop;
let contentWrapper;

const createStructure = () => {
  backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  contentWrapper = document.createElement("div");
  contentWrapper.className = "modal";
  backdrop.append(contentWrapper);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeModal();
    }
  });
  document.body.append(backdrop);
};

export const initModalSystem = () => {
  if (!backdrop) {
    createStructure();
  }
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
};

export const openModal = (html) => {
  if (!backdrop) createStructure();
  contentWrapper.innerHTML = html;
  backdrop.classList.add("open");
};

export const closeModal = () => {
  if (!backdrop) return;
  backdrop.classList.remove("open");
  contentWrapper.innerHTML = "";
};
