import { dishes }     from "../page/dishes/dishes.js";
import { drink }      from "../page/drink/drinks.js";
import { login, updateNav } from "../page/login/login.js";
import { tables }     from "../page/tables/tables.js";
import { statistics } from "../page/statistics/statistics.js";
import { ventas }     from "../page/ventas/ventas.js";

export const routes = {
    "/dishes"     : dishes,
    "/drinks"     : drink,
    "/tables"     : tables,
    "/statistics" : statistics,
    "/login"      : login,
    "/ventas"     : ventas,
};

// ===== RUTAS PROTEGIDAS (requieren sesión) =====
const protectedRoutes = ["/dishes", "/drinks", "/tables", "/statistics", "/ventas"];

// ===== RUTAS SOLO ADMIN =====
const adminRoutes = ["/ventas"];

document.body.addEventListener("click", (e) => {
    const link = e.target.closest("[data-link]");
    if (link) {
        e.preventDefault();
        navigateTo(link.getAttribute("href"));
    }
});

function navigate(route) {
    if (protectedRoutes.includes(route) && !isLoggedIn()) {
        window.history.pushState({}, "", "/login");
        router();
        return;
    }
    if (route === "/login" && isLoggedIn()) {
        window.history.pushState({}, "", "/tables");
        router();
        return;
    }
    if (adminRoutes.includes(route) && getRol() !== "admin") {
        window.history.pushState({}, "", "/tables");
        router();
        return;
    }
    window.history.pushState({}, "", route);
    router();
}
window.navigateTo = navigate;

// ===== HELPERS DE SESIÓN (localStorage — persiste al cerrar el navegador) =====
export function isLoggedIn() {
    return localStorage.getItem("auth") === "true";
}

export function setLoggedIn(value) {
    if (value) {
        localStorage.setItem("auth", "true");
    } else {
        localStorage.removeItem("auth");
        localStorage.removeItem("rol");
    }
}

export function getRol() {
    return localStorage.getItem("rol") || "";
}

// ===== ROUTER PRINCIPAL =====
export function router() {
    const path         = window.location.pathname;
    const appContainer = document.getElementById("app");
    const view         = routes[path];

    // Ruta raíz → login
    if (path === "/" || path === "") {
        if (isLoggedIn()) {
            window.history.replaceState({}, "", "/tables");
            updateNav("/tables");
            tables(appContainer);
        } else {
            window.history.replaceState({}, "", "/login");
            updateNav("/login");
            login(appContainer);
        }
        return;
    }

    // Ruta protegida sin sesión → login
    if (protectedRoutes.includes(path) && !isLoggedIn()) {
        window.history.replaceState({}, "", "/login");
        updateNav("/login");
        login(appContainer);
        return;
    }

    // Ruta solo admin → redirigir a tables
    if (adminRoutes.includes(path) && getRol() !== "admin") {
        window.history.replaceState({}, "", "/tables");
        updateNav("/tables");
        tables(appContainer);
        return;
    }

    // Sincronizar nav con la ruta actual
    updateNav(path);

    // Mostrar/ocultar enlace de ventas según rol
    const ventasLink = document.querySelector('a[href="/ventas"]');
    if (ventasLink) {
        ventasLink.style.display = getRol() === "admin" ? "" : "none";
    }

    if (view) {
        appContainer.innerHTML = "";
        view(appContainer);
    } else {
        appContainer.innerHTML = "<h2>404 - pagina no encontrada</h2>";
    }
}

window.addEventListener("popstate", router);