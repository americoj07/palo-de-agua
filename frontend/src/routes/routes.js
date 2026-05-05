import { dishes }     from "../page/dishes/dishes.js";
import { drink }      from "../page/drink/drinks.js";
import { login }      from "../page/login/login.js";
import { tables }     from "../page/tables/tables.js";
import { statistics } from "../page/statistics/statistics.js";

export const routes = {
    "/dishes"     : dishes,
    "/drinks"     : drink,
    "/tables"     : tables,
    "/statistics" : statistics,
    "/login"      : login,
};

// ===== RUTAS PROTEGIDAS (requieren sesión) =====
const protectedRoutes = ["/dishes", "/drinks", "/tables", "/statistics"];

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
    window.history.pushState({}, "", route);
    router();
}
window.navigateTo = navigate;

// ===== HELPERS DE SESIÓN =====
export function isLoggedIn() {
    return sessionStorage.getItem("auth") === "true";
}

export function setLoggedIn(value) {
    if (value) {
        sessionStorage.setItem("auth", "true");
    } else {
        sessionStorage.removeItem("auth");
    }
}

// ===== ROUTER PRINCIPAL =====
export function router() {
    const path         = window.location.pathname;
    const appContainer = document.getElementById("app");
    const view         = routes[path];

    // Ruta raíz → login
    if (path === "/" || path === "") {
        window.history.replaceState({}, "", "/login");
        login(appContainer);
        return;
    }

    // Ruta protegida sin sesión → login
    if (protectedRoutes.includes(path) && !isLoggedIn()) {
        window.history.replaceState({}, "", "/login");
        login(appContainer);
        return;
    }

    if (view) {
        appContainer.innerHTML = "";
        view(appContainer);
    } else {
        appContainer.innerHTML = "<h2>404 - pagina no encontrada</h2>";
    }
}

window.addEventListener("popstate", router);