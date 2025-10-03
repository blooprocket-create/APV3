import { apiClient } from "../apiClient.js";
import { showToast } from "../ui/toast.js";

const table = () => document.querySelector("[data-admin-services-table]");
const form = () => document.querySelector("[data-admin-service-form]");

const toTagString = (tags = []) => tags.join(", ");
const toTagArray = (value = "") =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const loadServices = async () => {
  const tableEl = table();
  if (!tableEl) return;
  tableEl.innerHTML = `<tr><td colspan="5">Loading…</td></tr>`;
  try {
    const data = await apiClient.get("/admin/services");
    tableEl.innerHTML = data.services
      .map(
        (service) => `
          <tr>
            <td>${service.title}</td>
            <td>${service.slug}</td>
            <td>${service.isActive ? "Active" : "Draft"}</td>
            <td>$${(service.basePriceCents / 100).toFixed(2)}</td>
            <td class="table-actions">
              <button class="secondary" data-edit-service='${JSON.stringify(service)}'>Edit</button>
              <button class="secondary" data-delete-service="${service.id}">Delete</button>
            </td>
          </tr>
        `
      )
      .join("");

    tableEl.querySelectorAll("[data-edit-service]").forEach((button) => {
      button.addEventListener("click", () => {
        const service = JSON.parse(button.dataset.editService);
        const formEl = form();
        formEl.dataset.serviceId = service.id;
        formEl.title.value = service.title;
        formEl.slug.value = service.slug;
        formEl.description.value = service.description;
        formEl.basePriceCents.value = service.basePriceCents;
        formEl.isActive.checked = service.isActive;
        formEl.tags.value = toTagString(service.tags);
      });
    });

    tableEl.querySelectorAll("[data-delete-service]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this service?")) return;
        try {
          await apiClient.del(`/admin/services/${button.dataset.deleteService}`);
          showToast({ message: "Service deleted", variant: "success" });
          await loadServices();
        } catch (error) {
          showToast({ message: error.message || "Unable to delete service", variant: "error" });
        }
      });
    });
  } catch (error) {
    tableEl.innerHTML = `<tr><td colspan="5">${error.message || "Unable to load services."}</td></tr>`;
  }
};

const bindForm = () => {
  const formEl = form();
  if (!formEl) return;
  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(formEl);
    const payload = {
      title: formData.get("title"),
      slug: formData.get("slug"),
      description: formData.get("description"),
      basePriceCents: Number(formData.get("basePriceCents")),
      isActive: formEl.isActive.checked,
      tags: toTagArray(formData.get("tags"))
    };

    try {
      if (formEl.dataset.serviceId) {
        await apiClient.patch(`/admin/services/${formEl.dataset.serviceId}`, payload);
        showToast({ message: "Service updated", variant: "success" });
      } else {
        await apiClient.post("/admin/services", payload);
        showToast({ message: "Service created", variant: "success" });
      }
      formEl.reset();
      delete formEl.dataset.serviceId;
      await loadServices();
    } catch (error) {
      showToast({ message: error.message || "Unable to save service", variant: "error" });
    }
  });

  const resetButton = document.querySelector("[data-admin-service-reset]");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      formEl.reset();
      delete formEl.dataset.serviceId;
    });
  }
};

const init = () => {
  loadServices();
  bindForm();
};

if (document.readyState !== "loading") {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}
