import { apiClient } from "../apiClient.js";
import { showToast } from "../ui/toast.js";

const table = () => document.querySelector("[data-admin-products-table]");
const form = () => document.querySelector("[data-admin-product-form]");

const toTagString = (tags = []) => tags.join(", ");
const toTagArray = (value = "") =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const loadProducts = async () => {
  const tableEl = table();
  if (!tableEl) return;
  tableEl.innerHTML = `<tr><td colspan="6">Loading…</td></tr>`;
  try {
    const data = await apiClient.get("/admin/products");
    tableEl.innerHTML = data.products
      .map(
        (product) => `
          <tr>
            <td>${product.title}</td>
            <td>${product.slug}</td>
            <td>${product.isActive ? "Active" : "Draft"}</td>
            <td>$${(product.priceCents / 100).toFixed(2)}</td>
            <td>${product.tags?.join(", ") || "–"}</td>
            <td class="table-actions">
              <button class="secondary" data-edit-product='${JSON.stringify(product)}'>Edit</button>
              <button class="secondary" data-delete-product="${product.id}">Delete</button>
            </td>
          </tr>
        `
      )
      .join("");

    tableEl.querySelectorAll("[data-edit-product]").forEach((button) => {
      button.addEventListener("click", () => {
        const product = JSON.parse(button.dataset.editProduct);
        const formEl = form();
        formEl.dataset.productId = product.id;
        formEl.title.value = product.title;
        formEl.slug.value = product.slug;
        formEl.description.value = product.description;
        formEl.priceCents.value = product.priceCents;
        formEl.isActive.checked = product.isActive;
        formEl.sku.value = product.sku || "";
        formEl.coverImageUrl.value = product.coverImageUrl || "";
        formEl.digitalFileUrl.value = product.digitalFileUrl || "";
        formEl.tags.value = toTagString(product.tags);
      });
    });

    tableEl.querySelectorAll("[data-delete-product]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this product?")) return;
        try {
          await apiClient.del(`/admin/products/${button.dataset.deleteProduct}`);
          showToast({ message: "Product deleted", variant: "success" });
          await loadProducts();
        } catch (error) {
          showToast({ message: error.message || "Unable to delete product", variant: "error" });
        }
      });
    });
  } catch (error) {
    tableEl.innerHTML = `<tr><td colspan="6">${error.message || "Unable to load products."}</td></tr>`;
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
      priceCents: Number(formData.get("priceCents")),
      isActive: formEl.isActive.checked,
      sku: formData.get("sku") || null,
      coverImageUrl: formData.get("coverImageUrl") || null,
      digitalFileUrl: formData.get("digitalFileUrl") || null,
      tags: toTagArray(formData.get("tags"))
    };

    try {
      if (formEl.dataset.productId) {
        await apiClient.patch(`/admin/products/${formEl.dataset.productId}`, payload);
        showToast({ message: "Product updated", variant: "success" });
      } else {
        await apiClient.post("/admin/products", payload);
        showToast({ message: "Product created", variant: "success" });
      }
      formEl.reset();
      delete formEl.dataset.productId;
      await loadProducts();
    } catch (error) {
      showToast({ message: error.message || "Unable to save product", variant: "error" });
    }
  });

  const resetButton = document.querySelector("[data-admin-product-reset]");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      formEl.reset();
      delete formEl.dataset.productId;
    });
  }
};

const init = () => {
  loadProducts();
  bindForm();
};

if (document.readyState !== "loading") {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}
