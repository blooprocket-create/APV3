import { apiClient } from "./apiClient.js";
import { showToast } from "./ui/toast.js";

const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;

const renderOverview = async () => {
  const overview = document.querySelector("[data-account-overview]");
  if (!overview) return;
  try {
    const [ordersRes, requestsRes, notificationsRes] = await Promise.all([
      apiClient.get("/orders", { mine: 1 }),
      apiClient.get("/requests", { mine: 1 }),
      apiClient.get("/notifications", { mine: 1 })
    ]);

    const orders = ordersRes.orders;
    const requests = requestsRes.requests;
    const notifications = notificationsRes.notifications;

    const totalSpent = orders
      .filter((order) => order.status === "paid")
      .reduce((sum, order) => sum + order.totalCents, 0);

    overview.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <h3>Mock Revenue</h3>
          <strong>${formatPrice(totalSpent)}</strong>
          <span class="muted">Lifetime digital purchases</span>
        </div>
        <div class="kpi-card">
          <h3>Orders</h3>
          <strong>${orders.length}</strong>
          <span class="muted">Pending + paid</span>
        </div>
        <div class="kpi-card">
          <h3>Open Requests</h3>
          <strong>${requests.filter((r) => r.status !== "completed" && r.status !== "declined").length}</strong>
          <span class="muted">Service pipeline</span>
        </div>
      </div>
      <section>
        <div class="section-header">
          <h2>Recent Orders</h2>
          <a class="secondary" href="/account/order.html">View all</a>
        </div>
        ${orders.length
          ? `<table class="table">
              <thead>
                <tr><th>ID</th><th>Total</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                ${orders
                  .slice(0, 5)
                  .map(
                    (order) => `
                      <tr>
                        <td><a href="/account/order.html?id=${order.id}">${order.id.slice(0, 8)}…</a></td>
                        <td>${formatPrice(order.totalCents)}</td>
                        <td>${order.status}</td>
                        <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>`
          : `<div class="empty-state">No orders yet. Explore the product catalog to get started.</div>`}
      </section>
      <section>
        <div class="section-header">
          <h2>Latest Notifications</h2>
          <a class="secondary" href="/account/requests.html">Go to requests</a>
        </div>
        ${notifications.length
          ? `<div class="list">
              ${notifications
                .slice(0, 5)
                .map(
                  (n) => `
                    <div class="item">
                      <strong>${n.title}</strong>
                      <p class="muted">${n.body}</p>
                      <small>${new Date(n.createdAt).toLocaleString()}</small>
                    </div>
                  `
                )
                .join("")}
            </div>`
          : `<div class="empty-state">You are all caught up.</div>`}
      </section>
    `;
  } catch (error) {
    overview.innerHTML = `<div class="empty-state">${error.message || "Unable to load account overview."}</div>`;
  }
};

const renderOrderDetail = async () => {
  const container = document.querySelector("[data-order-detail]");
  if (!container) return;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  try {
    const data = await apiClient.get("/orders", { mine: 1 });
    const orders = data.orders;
    if (!orders.length) {
      container.innerHTML = `<div class="empty-state">No orders to display.</div>`;
      return;
    }
    const order = id ? orders.find((o) => o.id === id) : orders[0];
    if (!order) {
      container.innerHTML = `<div class="empty-state">Order not found.</div>`;
      return;
    }
    container.innerHTML = `
      <section class="card">
        <h1>Order ${order.id.slice(0, 8)}…</h1>
        <p class="muted">Placed ${new Date(order.createdAt).toLocaleString()}</p>
        <div class="badge">${order.status.toUpperCase()}</div>
        <h3>Items</h3>
        <div class="list">
          ${order.items
            .map(
              (item) => `
                <div class="item">
                  <strong>${item.title}</strong>
                  <p class="muted">${item.quantity} × ${formatPrice(item.unitPriceCents)}</p>
                  ${item.productId ? `<a class="button secondary" href="/products.html#${item.productId}">View product</a>` : ""}
                </div>
              `
            )
            .join("")}
        </div>
        <h3>Total</h3>
        <strong>${formatPrice(order.totalCents)}</strong>
        ${order.type === "digital" && order.status === "paid"
          ? `<p class="muted">Downloads are available in the Deliverables section of the related request.</p>`
          : ""}
      </section>
    `;
  } catch (error) {
    container.innerHTML = `<div class="empty-state">${error.message || "Unable to load order."}</div>`;
  }
};

const init = () => {
  renderOverview();
  renderOrderDetail();
};

if (document.readyState !== "loading") {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}
