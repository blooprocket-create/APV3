import { apiClient } from "../apiClient.js";
import { showToast } from "../ui/toast.js";

const table = () => document.querySelector("[data-admin-users-table]");
const form = () => document.querySelector("[data-admin-user-form]");
const resetButton = () => document.querySelector("[data-admin-user-reset]");

const loadUsers = async () => {
  const tableEl = table();
  if (!tableEl) return;
  tableEl.innerHTML = `<tr><td colspan="5">Loading…</td></tr>`;
  try {
    const data = await apiClient.get("/admin/users");
    tableEl.innerHTML = data.users
      .map(
        (user) => `
          <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${new Date(user.createdAt).toLocaleDateString()}</td>
            <td class="table-actions">
              <button class="secondary" data-edit-user='${JSON.stringify(user)}'>Edit</button>
              <button class="secondary" data-delete-user="${user.id}">Delete</button>
            </td>
          </tr>
        `
      )
      .join("");

    tableEl.querySelectorAll("[data-edit-user]").forEach((button) => {
      button.addEventListener("click", () => {
        const user = JSON.parse(button.dataset.editUser);
        const formEl = form();
        formEl.dataset.userId = user.id;
        formEl.name.value = user.name;
        formEl.email.value = user.email;
        formEl.role.value = user.role;
        formEl.password.value = "";
      });
    });

    tableEl.querySelectorAll("[data-delete-user]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this user?")) return;
        try {
          await apiClient.del(`/admin/users/${button.dataset.deleteUser}`);
          showToast({ message: "User deleted", variant: "success" });
          await loadUsers();
        } catch (error) {
          showToast({ message: error.message || "Unable to delete user", variant: "error" });
        }
      });
    });
  } catch (error) {
    tableEl.innerHTML = `<tr><td colspan="5">${error.message || "Unable to load users"}</td></tr>`;
  }
};

const bindForm = () => {
  const formEl = form();
  if (!formEl) return;
  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(formEl);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role")
    };
    const password = formData.get("password");
    if (password) payload.password = password;

    try {
      if (formEl.dataset.userId) {
        await apiClient.patch(`/admin/users/${formEl.dataset.userId}`, payload);
        showToast({ message: "User updated", variant: "success" });
      } else {
        await apiClient.post("/admin/users", payload);
        showToast({ message: "User created", variant: "success" });
      }
      formEl.reset();
      delete formEl.dataset.userId;
      await loadUsers();
    } catch (error) {
      showToast({ message: error.message || "Unable to save user", variant: "error" });
    }
  });

  const resetEl = resetButton();
  if (resetEl) {
    resetEl.addEventListener("click", () => {
      formEl.reset();
      delete formEl.dataset.userId;
    });
  }
};

const init = () => {
  loadUsers();
  bindForm();
};

if (document.readyState !== "loading") {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}
