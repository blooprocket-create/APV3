import { apiClient } from "./apiClient.js";
import { showToast } from "./ui/toast.js";
import { initModalSystem } from "./ui/modal.js";
import { initNotifications } from "./notifications.js";

const state = {
  user: null,
  notifications: []
};

const routes = [
  { href: "/index.html", label: "Home" },
  { href: "/products.html", label: "Products" },
  { href: "/services.html", label: "Services" },
  { href: "/coaching.html", label: "Coaching" }
];

const accountLinks = [
  { href: "/account/index.html", label: "Account" },
  { href: "/account/requests.html", label: "Requests" }
];

const adminLinks = [
  { href: "/admin/index.html", label: "Dashboard" },
  { href: "/admin/users.html", label: "Users" },
  { href: "/admin/products.html", label: "Products" },
  { href: "/admin/services.html", label: "Services" },
  { href: "/admin/requests.html", label: "Requests" }
];

const pathMatches = (href) => {
  const url = new URL(href, window.location.origin);
  return window.location.pathname.endsWith(url.pathname);
};

const createNavLinks = (links, container) => {
  links.forEach((link) => {
    const anchor = document.createElement("a");
    anchor.href = link.href;
    anchor.textContent = link.label;
    if (pathMatches(link.href)) {
      anchor.classList.add("active");
    }
    container.append(anchor);
  });
};

const renderHeader = () => {
  const header = document.querySelector("header[data-site-header]");
  if (!header) return;

  header.innerHTML = "";
  const inner = document.createElement("div");
  inner.className = "inner";

  const brandLink = document.createElement("a");
  brandLink.href = "/index.html";
  brandLink.className = "brand";
  brandLink.innerHTML = `
    <img class="brand-logo" src="/assets/logo.svg" alt="A.production monogram" width="48" height="48" />
    <div class="brand-text">
      <span class="brand-name">A.production</span>
      <span class="brand-tagline">(of sorts)</span>
    </div>
  `;

  const nav = document.createElement("nav");
  nav.className = "nav-links";

  createNavLinks(routes, nav);


  if (state.user) {
    const divider = document.createElement("span");
    divider.className = "badge small";
    divider.textContent = state.user.role.toUpperCase();
    nav.append(divider);

    createNavLinks(accountLinks, nav);

    if (state.user.role === "admin" || state.user.role === "editor") {
      createNavLinks(adminLinks, nav);
    }

    const signOut = document.createElement("a");
    signOut.href = "/auth/sign-out.html";
    signOut.textContent = "Sign out";
    nav.append(signOut);
  } else {
    const signUp = document.createElement("a");
    signUp.href = "/auth/sign-up.html";
    signUp.textContent = "Create account";
    nav.append(signUp);

    const signIn = document.createElement("a");
    signIn.href = "/auth/sign-in.html";
    signIn.textContent = "Sign in";
    nav.append(signIn);
  }

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "0.75rem";
  actions.style.alignItems = "center";

  if (state.user) {
    const bell = document.createElement("button");
    bell.className = "notification-bell";
    bell.type = "button";
    bell.dataset.notificationBell = "";
    bell.innerHTML = '<span aria-hidden="true">&#128276;</span>';
    actions.append(bell);
  }

  const burger = document.createElement("button");
  burger.className = "burger";
  burger.setAttribute("aria-label", "Toggle navigation");
  burger.innerHTML = '<span aria-hidden="true">&#9776;</span>';

  burger.addEventListener("click", () => {
    nav.classList.toggle("open");
  });

  actions.append(burger);
  inner.append(brandLink, nav, actions);
  header.append(inner);
};

const renderFooter = () => {
  const footer = document.querySelector("footer[data-site-footer]");
  if (!footer) return;
  footer.innerHTML = `
    <div class="inner">
      <div>
        <strong>A.production</strong>
        <p class="muted">Stories crafted in code &mdash; digital products, services, and coaching designed to move ideas forward.</p>
      </div>
      <div class="list-inline">
        <a href="/privacy.html">Privacy</a>
        <a href="/terms.html">Terms</a>
        <a href="/sitemap.xml">Sitemap</a>
      </div>
      <small>&copy; ${new Date().getFullYear()} A.production. All rights reserved.</small>
    </div>
  `;
};

const initializeReveal = () => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
};

const fetchSession = async () => {
  try {
    const { user } = await apiClient.get("/auth/me");
    state.user = user;
    window.AppState.user = user;
  } catch (error) {
    console.warn("Unable to fetch session", error);
  }
};

const setupGlobalShortcuts = () => {
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      showToast({ message: "Quick finder coming soon", variant: "info" });
    }
  });
};

const init = async () => {
  window.AppState = state;
  initModalSystem();
  await fetchSession();
  renderHeader();
  renderFooter();
  initializeReveal();
  setupGlobalShortcuts();
  initNotifications();
};

init();

