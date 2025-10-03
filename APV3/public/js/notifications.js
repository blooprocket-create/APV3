import { apiClient } from "./apiClient.js";
import { showToast } from "./ui/toast.js";

const state = {
  notifications: [],
  unread: 0,
  polling: null
};

const bell = () => document.querySelector("[data-notification-bell]");
const list = () => document.querySelector("[data-notifications-list]");

const renderBell = () => {
  const bellEl = bell();
  if (!bellEl) return;
  bellEl.innerHTML = `<span>??</span>${state.unread ? '<span class="dot"></span>' : ""}`;
};

const renderList = () => {
  const listEl = list();
  if (!listEl) return;

  if (!state.notifications.length) {
    listEl.innerHTML = `<div class="empty-state">All caught up! No notifications right now.</div>`;
    return;
  }

  listEl.innerHTML = state.notifications
    .map(
      (n) => `
        <div class="item">
          <div class="status-pill">${n.type}</div>
          <strong>${n.title}</strong>
          <p class="muted">${n.body}</p>
          <small>${new Date(n.createdAt).toLocaleString()}</small>
        </div>
      `
    )
    .join("");
};

const refresh = async () => {
  if (!window.AppState?.user) return;
  try {
    const data = await apiClient.get("/notifications", { mine: 1 });
    state.notifications = data.notifications;
    state.unread = data.notifications.filter((n) => !n.readAt).length;
    renderBell();
    renderList();
  } catch (error) {
    console.warn("Failed to load notifications", error);
  }
};

const markAllRead = async () => {
  const unreadIds = state.notifications.filter((n) => !n.readAt).map((n) => n.id);
  if (!unreadIds.length) return;
  try {
    await apiClient.post("/notifications/mark-read", { ids: unreadIds });
    await refresh();
  } catch (error) {
    showToast({ message: error.message || "Unable to mark notifications", variant: "error" });
  }
};

export const initNotifications = () => {
  if (!window.AppState?.user) return;
  refresh();
  if (state.polling) clearInterval(state.polling);
  state.polling = setInterval(refresh, 60_000);

  const bellEl = bell();
  if (bellEl && !bellEl.dataset.bound) {
    bellEl.dataset.bound = "true";
    bellEl.addEventListener("click", () => {
      markAllRead();
      showToast({ message: "Notifications opened", variant: "info", duration: 1800 });
    });
  }
};
