import { apiClient } from "../apiClient.js";
import { showToast } from "../ui/toast.js";

const statsContainer = () => document.querySelector("[data-admin-stats]");
const ordersTable = () => document.querySelector("[data-admin-recent-orders]");

const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;

const loadDashboard = async () => {
  const statsEl = statsContainer();
  const ordersEl = ordersTable();
  if (!statsEl || !ordersEl) return;

  statsEl.innerHTML = `<div class="muted">Loading…</div>`;
  ordersEl.innerHTML = "";

  try {
    const data = await apiClient.get("/admin/stats");
    const { stats, recentOrders } = data;

    statsEl.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card"><h3>Users</h3><strong>${stats.users}</strong><span class="muted">Total accounts</span></div>
        <div class="kpi-card"><h3>Products</h3><strong>${stats.products}</strong><span class="muted">Active listings</span></div>
        <div class="kpi-card"><h3>Services</h3><strong>${stats.services}</strong><span class="muted">Available engagements</span></div>
        <div class="kpi-card"><h3>Mock revenue</h3><strong>${formatPrice(stats.mockRevenueCents)}</strong><span class="muted">Paid orders</span></div>
      </div>
    `;

    ordersEl.innerHTML = `
      <thead>
        <tr><th>ID</th><th>Total</th><th>Status</th><th>Type</th><th>Created</th></tr>
      </thead>
      <tbody>
        ${recentOrders
          .map(
            (order) => `
              <tr>
                <td>${order.id.slice(0, 8)}…</td>
                <td>${formatPrice(order.totalCents)}</td>
                <td>${order.status}</td>
                <td>${order.type}</td>
                <td>${new Date(order.createdAt).toLocaleString()}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    `;
  } catch (error) {
    statsEl.innerHTML = `<div class="empty-state">${error.message || "Unable to load stats."}</div>`;
    showToast({ message: error.message || "Dashboard error", variant: "error" });
  }
};

if (document.readyState !== "loading") {
  loadDashboard();
} else {
  document.addEventListener("DOMContentLoaded", loadDashboard);
}
