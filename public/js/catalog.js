import { apiClient } from "./apiClient.js";
import { showToast } from "./ui/toast.js";
import { openModal, closeModal } from "./ui/modal.js";

const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;

const renderProducts = async () => {
  const grid = document.querySelector("[data-products-grid]");
  if (!grid) return;
  try {
    const data = await apiClient.get("/products");
    grid.innerHTML = data.products
      .map(
        (product) => `
          <article class="card reveal">
            <img class="cover" src="${product.coverImageUrl ?? "https://images.unsplash.com/photo-1454165205744-3b78555e5572"}" alt="${product.title}" />
            <h3>${product.title}</h3>
            <p class="muted">${product.description}</p>
            <div class="tags">
              ${(product.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join("")}
            </div>
            <div class="price">${formatPrice(product.priceCents)}</div>
            <a class="button button--ghost card__cta" href="/product.html?slug=${encodeURIComponent(product.slug)}">View details</a>
          </article>
        `
      )
      .join("");
  } catch (error) {
    grid.innerHTML = `<div class="card">${error.message || "Could not load products."}</div>`;
  }
};

const renderServices = async () => {
  const grid = document.querySelector("[data-services-grid]");
  if (!grid) return;
  try {
    const data = await apiClient.get("/services");
    grid.innerHTML = data.services
      .map(
        (service) => `
          <article class="card reveal">
            <h3>${service.title}</h3>
            <p class="muted">${service.description}</p>
            <div class="tags">
              ${(service.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join("")}
            </div>
            <div class="price">Starting at ${formatPrice(service.basePriceCents)}</div>
            <a class="button button--ghost card__cta" href="/service.html?slug=${encodeURIComponent(service.slug)}">Explore service</a>
          </article>
        `
      )
      .join("");
  } catch (error) {
    grid.innerHTML = `<div class="card">${error.message || "Could not load services."}</div>`;
  }
};

const purchaseProduct = async (productId) => {
  if (!window.AppState?.user) {
    window.location.href = "/auth/sign-in.html";
    return;
  }
  try {
    const order = await apiClient.post("/orders", {
      type: "digital",
      items: [{ productId, quantity: 1 }]
    });
    await apiClient.post("/payments/mock", { orderId: order.order.id });
    showToast({ message: "Download unlocked in your account", variant: "success" });
    window.location.href = `/account/order.html?id=${order.order.id}`;
  } catch (error) {
    showToast({ message: error.message || "Unable to complete mock purchase", variant: "error" });
  }
};

const submitServiceRequest = async (serviceId, brief) => {
  if (!window.AppState?.user) {
    window.location.href = "/auth/sign-in.html";
    return;
  }
  try {
    await apiClient.post("/requests", { serviceId, brief });
    closeModal();
    showToast({ message: "Request submitted!", variant: "success" });
    window.location.href = "/account/requests.html";
  } catch (error) {
    showToast({ message: error.message || "Unable to submit request", variant: "error" });
  }
};

const renderProductDetail = async () => {
  const container = document.querySelector("[data-product-detail]");
  if (!container) return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  if (!slug) {
    container.innerHTML = `<div class="card">Missing product slug.</div>`;
    return;
  }
  try {
    const data = await apiClient.get(`/products/${encodeURIComponent(slug)}`);
    const product = data.product;
    container.innerHTML = `
      <section class="card article-card">
        <img class="cover" src="${product.coverImageUrl ?? "https://images.unsplash.com/photo-1454165205744-3b78555e5572"}" alt="${product.title}" />
        <h1>${product.title}</h1>
        <p>${product.description}</p>
        <div class="tags">${(product.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
        <div class="price" style="margin:1rem 0;">${formatPrice(product.priceCents)}</div>
        <button type="button" data-buy-product>Buy (Mock)</button>
      </section>
    `;
    container.querySelector("[data-buy-product]").addEventListener("click", () => purchaseProduct(product.id));
  } catch (error) {
    container.innerHTML = `<div class="card">${error.message || "Product not found."}</div>`;
  }
};

const renderServiceDetail = async () => {
  const container = document.querySelector("[data-service-detail]");
  if (!container) return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug") || container.dataset.slug;
  if (!slug) {
    container.innerHTML = `<div class="card">Missing service slug.</div>`;
    return;
  }
  try {
    const data = await apiClient.get(`/services/${encodeURIComponent(slug)}`);
    const service = data.service;
    container.innerHTML = `
      <section class="card article-card">
        <h1>${service.title}</h1>
        <p>${service.description}</p>
        <div class="tags">${(service.tags || []).map((tag) => `<span class="tag">${tag}</span>`).join("")}</div>
        <div class="price" style="margin:1rem 0;">Starting at ${formatPrice(service.basePriceCents)}</div>
        <button type="button" data-request-service>Request service</button>
      </section>
    `;

    container.querySelector("[data-request-service]").addEventListener("click", () => {
      openModal(`
        <h2>Request ${service.title}</h2>
        <form data-modal-request>
          <label>
            <span>Project goal</span>
            <input type="text" name="goal" required />
          </label>
          <label>
            <span>Target audience</span>
            <input type="text" name="audience" required />
          </label>
          <label>
            <span>Key details</span>
            <textarea name="details" required></textarea>
          </label>
          <div style="display:flex; gap:1rem; justify-content:flex-end;">
            <button type="button" class="button button--ghost" data-close-modal>Cancel</button>
            <button type="submit" class="button">Submit request</button>
          </div>
        </form>
      `);
      const form = document.querySelector("form[data-modal-request]");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const brief = {
          goal: formData.get("goal"),
          audience: formData.get("audience"),
          details: formData.get("details"),
          serviceTitle: service.title
        };
        submitServiceRequest(service.id, brief);
      });
      document.querySelector("[data-close-modal]").addEventListener("click", () => closeModal());
    });
  } catch (error) {
    container.innerHTML = `<div class="card">${error.message || "Service not found."}</div>`;
  }
};

const init = () => {
  renderProducts();
  renderServices();
  renderProductDetail();
  renderServiceDetail();
};

if (document.readyState !== "loading") {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}
