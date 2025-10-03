import { apiClient } from "./apiClient.js";
import { showToast } from "./ui/toast.js";
import { openModal, closeModal } from "./ui/modal.js";

const statusLabels = {
  open: "Open",
  needs_info: "Needs Info",
  quoted: "Quoted",
  paid: "Paid",
  in_progress: "In Progress",
  delivered: "Delivered",
  completed: "Completed",
  declined: "Declined"
};

const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;

const listContainer = () => document.querySelector("[data-request-list]");

const formatDate = (value) => new Date(value).toLocaleString();

const loadRequests = async () => {
  const container = listContainer();
  if (!container) return;
  container.innerHTML = `<div class="muted">Loading requests…</div>`;
  try {
    const data = await apiClient.get("/requests", { mine: 1 });
    if (!data.requests.length) {
      container.innerHTML = `<div class="empty-state">No service requests yet. Explore a service to get started.</div>`;
      return;
    }
    container.innerHTML = data.requests
      .map(
        (request) => `
          <div class="item" data-request-id="${request.id}">
            <div class="status-pill">${statusLabels[request.status] || request.status}</div>
            <strong>${request.serviceTitle}</strong>
            <p class="muted">Last updated ${formatDate(request.updatedAt || request.createdAt)}</p>
            <button class="secondary" data-open-request="${request.id}">Open thread</button>
          </div>
        `
      )
      .join("");

    container.querySelectorAll("[data-open-request]").forEach((button) => {
      button.addEventListener("click", () => showRequestDetail(button.dataset.openRequest));
    });
  } catch (error) {
    container.innerHTML = `<div class="empty-state">${error.message || "Unable to load requests."}</div>`;
  }
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
  if (!deliverables.length) return `<p class="muted">Deliverables will appear here once ready.</p>`;
  return `
    <div class="list">
      ${deliverables
        .map(
          (item) => `
            <div class="item">
              <strong>${item.title}</strong>
              <p class="muted">${item.description || ""}</p>
              <a class="button secondary" href="${item.fileUrl}" target="_blank" rel="noopener">Download</a>
            </div>
          `
        )
        .join("")}
    </div>
  `;
};

const handleMessageSubmit = (requestId, form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const body = formData.get("message");
    if (!body) return;
    form.querySelector("textarea").disabled = true;
    form.querySelector("button").disabled = true;
    try {
      await apiClient.post(`/requests/${requestId}/messages`, { body });
      showToast({ message: "Message sent", variant: "success" });
      closeModal();
      await loadRequests();
    } catch (error) {
      showToast({ message: error.message || "Unable to send message", variant: "error" });
    } finally {
      form.querySelector("textarea").disabled = false;
      form.querySelector("button").disabled = false;
    }
  });
};

const handleQuoteActions = (request, quote) => {
  const acceptButton = document.querySelector("[data-quote-accept]");
  const declineButton = document.querySelector("[data-quote-decline]");

  if (acceptButton) {
    acceptButton.addEventListener("click", async () => {
      try {
        const data = await apiClient.post(`/quotes/${quote.id}/accept`);
        await apiClient.post("/payments/mock", { orderId: data.orderId });
        showToast({ message: "Quote accepted. Mock payment processed!", variant: "success" });
        closeModal();
        await loadRequests();
      } catch (error) {
        showToast({ message: error.message || "Unable to accept quote", variant: "error" });
      }
    });
  }

  if (declineButton) {
    declineButton.addEventListener("click", async () => {
      try {
        await apiClient.post(`/quotes/${quote.id}/decline`);
        showToast({ message: "Quote declined", variant: "info" });
        closeModal();
        await loadRequests();
      } catch (error) {
        showToast({ message: error.message || "Unable to decline quote", variant: "error" });
      }
    });
  }
};

const showRequestDetail = async (requestId) => {
  try {
    const data = await apiClient.get(`/requests/${requestId}`);
    const request = data.request;
    const quote = request.quote;
    openModal(`
      <div class="tabs">
        <button class="active" data-tab-button="thread">Thread</button>
        <button data-tab-button="deliverables">Deliverables</button>
      </div>
      <div data-tab-panel="thread">
        <div class="badge">${statusLabels[request.status] || request.status}</div>
        <h2>${request.service.title}</h2>
        <p class="muted">Submitted ${formatDate(request.createdAt)}</p>
        <h3>Messages</h3>
        ${renderMessages(request.messages)}
        <form data-request-message>
          <label>
            <span>Add a message</span>
            <textarea name="message" required placeholder="Share updates or ask a question"></textarea>
          </label>
          <button type="submit">Send message</button>
        </form>
        ${quote ? `
          <div class="notice" style="margin-top:1.5rem;">
            <strong>Quote: ${formatPrice(quote.amountCents)}</strong>
            <p>${quote.notes || "No notes provided."}</p>
            ${quote.status === "sent" ? `
              <div style="display:flex; gap:1rem;">
                <button type="button" data-quote-accept>Accept & mock pay</button>
                <button type="button" class="secondary" data-quote-decline>Decline</button>
              </div>
            ` : `<p class="muted">Quote status: ${quote.status}</p>`}
          </div>
        ` : ""}
      </div>
      <div data-tab-panel="deliverables" hidden>
        <h3>Deliverables</h3>
        ${renderDeliverables(request.deliverables)}
      </div>
    `);

    const form = document.querySelector("form[data-request-message]");
    handleMessageSubmit(requestId, form);

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

    if (quote) {
      handleQuoteActions(request, quote);
    }
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
