import { apiClient } from "./apiClient.js";
import { showToast } from "./ui/toast.js";

const redirect = (url) => {
  window.location.href = url;
};

const bindSignIn = () => {
  const form = document.querySelector("form[data-auth-sign-in]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      email: formData.get("email"),
      password: formData.get("password")
    };
    try {
      await apiClient.post("/auth/login", payload);
      showToast({ message: "Welcome back!", variant: "success" });
      redirect("/account/index.html");
    } catch (error) {
      console.error("Sign in failed", error);
      showToast({ message: error.message || "Unable to sign in", variant: "error" });
    }
  });
};

const bindSignUp = () => {
  const form = document.querySelector("form[data-auth-sign-up]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password")
    };
    try {
      await apiClient.post("/auth/register", payload);
      showToast({ message: "Account created!", variant: "success" });
      redirect("/account/index.html");
    } catch (error) {
      console.error("Sign up failed", error);
      showToast({ message: error.message || "Unable to sign up", variant: "error" });
    }
  });
};

const bindSignOut = () => {
  const trigger = document.querySelector("[data-auth-sign-out]");
  if (!trigger) return;
  const signOut = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch (error) {
      console.warn("Logout error", error);
    }
    redirect("/index.html");
  };
  if (trigger.tagName === "FORM") {
    trigger.addEventListener("submit", (event) => {
      event.preventDefault();
      signOut();
    });
  } else {
    signOut();
  }
};

const init = () => {
  bindSignIn();
  bindSignUp();
  bindSignOut();
};

if (document.readyState !== "loading") {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}
