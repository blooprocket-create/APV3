const ensureContainer = () => {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.append(container);
  }
  return container;
};

export const showToast = ({ message, variant = "success", duration = 3200 }) => {
  const container = ensureContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${variant}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="secondary">×</button>
  `;

  const close = () => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 200);
  };

  toast.querySelector("button").addEventListener("click", close);
  container.append(toast);

  if (duration !== Infinity) {
    setTimeout(close, duration);
  }
};
