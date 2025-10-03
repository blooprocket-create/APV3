import { apiClient } from "../apiClient.js";
import { showToast } from "../ui/toast.js";
import { renderKanban } from "../ui/kanban.js";
import { openModal, closeModal } from "../ui/modal.js";

const statusCategories = {
  Open: ["open", "needs_info"],
  Quoted: ["quoted"],
  "In Progress": ["paid", "in_progress"],
  Delivery: ["delivered", "completed", "declined"]
};

const allStatuses = Array.from(new Set(Object.values(statusCategories).flat()));

const boardContainer = () => document.querySelector("[data-admin-requests-board]");

const formatDate = (value) => new Date(value).toLocaleString();
const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;

let cachedRequests = [];

const buildColumns = (requests) => {
  return Object.entries(statusCategories).map(([title, statuses]) => ({
    title,
    items: requests
      .filter((req) => statuses.includes(req.status))
      .map((req) => ({
        id: req.id,
        title: req.serviceTitle,
        subtitle: `${req.customerName} • ${formatDate(req.updatedAt || req.createdAt)}`,
        meta: req.status
      }))
  }));
};

const loadRequests = async () => {
  const container = boardContainer();
  if (!container) return;
  container.innerHTML = `<div class="muted">Loading requests…</div>`;
  try {
    const data = await apiClient.get("/requests");
    cachedRequests = data.requests;
    renderKanban(container, buildColumns(cachedRequests), (item) => openRequestDetail(item.id));
  } catch (error) {
    container.innerHTML = `<div class="empty-state">${error.message || "Unable to load requests."}</div>`;
  }
};

const bindStatusForm = (requestId) => {
  const form = document.querySelector("[data-admin-status-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = form.status.value;
    try {
      await apiClient.post(`/requests/${requestId}/status`, { status });
      showToast({ message: "Status updated", variant: "success" });
      closeModal();
      await loadRequests();
    } catch (error) {
      showToast({ message: error.message || "Unable to update status", variant: "error" });
    }
  });
};

const bindMessageForm = (requestId) => {
  const form = document.querySelector("[data-admin-message-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = form.message.value;
    if (!body) return;
    try {
      await apiClient.post(`/requests/${requestId}/messages`, { body });
      showToast({ message: "Message sent", variant: "success" });
      closeModal();
      await loadRequests();
    } catch (error) {
      showToast({ message: error.message || "Unable to send message", variant: "error" });
    }
  });
};

const bindQuoteForm = (requestId, existingQuote) => {
  const form = document.querySelector("[data-admin-quote-form]");
  if (!form) return;
  if (existingQuote) {
    form.amountCents.value = existingQuote.amountCents;
    form.notes.value = existingQuote.notes || "";
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const amountCents = Number(form.amountCents.value);
    const notes = form.notes.value;
    try {
      await apiClient.post(`/requests/${requestId}/quote`, { amountCents, notes });
      showToast({ message: "Quote sent", variant: "success" });
      closeModal();
      await loadRequests();
    } catch (error) {
      showToast({ message: error.message || "Unable to create quote", variant: "error" });
    }
  });
};

const bindDeliverableForm = (requestId) => {
  const form = document.querySelector("[data-admin-deliverable-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      title: formData.get("title"),
      description: formData.get("description"),
      fileUrl: formData.get("fileUrl")
    };
    try {
      await apiClient.post(`/requests/${requestId}/deliverables`, payload);
      showToast({ message: "Deliverable uploaded", variant: "success" });
      closeModal();
      await loadRequests();
    } catch (error) {
      showToast({ message: error.message || "Unable to add deliverable", variant: "error" });
    }
  });
};

const renderMessages = (messages) => {
  if (!messages.length) return `<p class="muted">No messages yet.</p>`;
  return `
    <div class="timeline">
      ${messages
        .map(
          (msg) => `
            <div class="timeline-item">
              <strong>${msg.senderName} <span class="muted">(${msg.senderRole})</span></strong>
              <p>${msg.body}</p>
              <small class="muted">${formatDate(msg.createdAt)}</small>
            </div>
          `
        )
        .join("")}
    </div>
  `;
};

const renderDeliverables = (deliverables) => {
  if (!deliverables.length) return `<p class="muted">No deliverables yet.</p>`;
  return `
    <div class="list">
      ${deliverables
        .map(
          (item) => `
            <div class="item">
              <strong>${item.title}</strong>
              <p class="muted">${item.description || ""}</p>
              <a class="button secondary" href="${item.fileUrl}" target="_blank" rel="noopener">Open</a>
            </div>
          `
        )
        .join("")}
    </div>
  `;
};

const openRequestDetail = async (requestId) => {
  try {
    const data = await apiClient.get(`/requests/${requestId}`);
    const request = data.request;
    const quote = request.quote;

    const statusOptions = allStatuses
      .map((status) => `<option value="${status}" ${status === request.status ? "selected" : ""}>${status}</option>`)
      .join("");

    openModal(`
      <div class="tabs">
        <button class="active" data-tab-button="overview">Overview</button>
        <button data-tab-button="messages">Messages</button>
        <button data-tab-button="deliverables">Deliverables</button>
      </div>
      <div data-tab-panel="overview">
        <h2>${request.service.title}</h2>
        <p class="muted">Customer: ${request.customer.name} (${request.customer.email})</p>
        <form data-admin-status-form>
          <label>
            <span>Status</span>
            <select name="status" required>${statusOptions}</select>
          </label>
          <button type="submit">Update status</button>
        </form>
        <section>
          <h3>Quote</h3>
          <form data-admin-quote-form>
            <label>
              <span>Amount (cents)</span>
              <input type="number" name="amountCents" min="0" required />
            </label>
            <label>
              <span>Notes</span>
              <textarea name="notes" placeholder="Scope summary"></textarea>
            </label>
            <button type="submit">${quote ? "Update quote" : "Send quote"}</button>
          </form>
          ${quote ? `<p class="muted">Current quote: ${formatPrice(quote.amountCents)} (${quote.status})</p>` : ""}
        </section>
      </div>
      <div data-tab-panel="messages" hidden>
        <h3>Thread</h3>
        ${renderMessages(request.messages)}
        <form data-admin-message-form>
          <label>
            <span>Reply</span>
            <textarea name="message" required></textarea>
          </label>
          <button type="submit">Send</button>
        </form>
      </div>
      <div data-tab-panel="deliverables" hidden>
        <h3>Deliverables</h3>
        ${renderDeliverables(request.deliverables)}
        <form data-admin-deliverable-form>
          <label>
            <span>Title</span>
            <input type="text" name="title" required />
          </label>
          <label>
            <span>Description</span>
            <textarea name="description"></textarea>
          </label>
          <label>
            <span>File URL</span>
            <input type="url" name="fileUrl" required />
          </label>
          <button type="submit">Add deliverable</button>
        </form>
      </div>
    `);

    const buttons = document.querySelectorAll("[data-tab-button]");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        button.classList.add("active");
        document
          .querySelectorAll("[data-tab-panel]")
          .forEach((panel) => (panel.hidden = panel.dataset.tabPanel !== button.dataset.tabButton));
      });
    });

    bindStatusForm(requestId);
    bindMessageForm(requestId);
    bindQuoteForm(requestId, quote);
    bindDeliverableForm(requestId);
  } catch (error) {
    showToast({ message: error.message || "Unable to load request", variant: "error" });
  }
};

const init = () => {
  loadRequests();
};

if (document.readyState !== "loading") {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}
