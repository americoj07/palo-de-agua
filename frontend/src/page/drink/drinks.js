import { store }         from "../../data/store.js";
import { socket }        from "../../socket.js";
import { onStoreUpdate } from "../../socketStore.js";
import "./drinks.css";

const barStore = new Map();

function syncBarStore(newStore) {
    newStore.tables.forEach(table => {
        if (table.status !== "open") return;

        const hasPendingDrinks = table.order.some(item =>
            item.category === "drinks" && !item.servedBar
        );

        if (hasPendingDrinks) {
            // Guardar copia completa actualizada (incluye notas, id, label)
            barStore.set(table.id, JSON.parse(JSON.stringify(table)));
        } else if (barStore.has(table.id)) {
            // Sin bebidas pendientes: actualizar notas e id por si la mesa fue renombrada
            const local = barStore.get(table.id);
            local.notes = table.notes ?? local.notes ?? "";
            local.id    = table.id;
            local.label = table.label;
            barStore.set(table.id, local);
        }
    });

    // Limpiar mesas marcadas como listas
    newStore.tables.forEach(table => {
        if (table.barDone && barStore.has(table.id)) {
            barStore.delete(table.id);
        }
    });
    // Limpiar mesas que ya no están abiertas
    barStore.forEach((_, id) => {
        const stillOpen = newStore.tables.find(t => t.id === id && t.status === "open");
        if (!stillOpen) barStore.delete(id);
    });
}

function renderDrinks() {
    const body = document.getElementById("drinks-body");
    if (!body) return;

    const tablesWithDrinks = [...barStore.values()].filter(table =>
        !table.barDone &&
        table.order.some(item => item.category === "drinks" && !item.servedBar)
    );

    if (tablesWithDrinks.length === 0) {
        body.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🥤</div>
                <h3>No hay pedidos activos</h3>
                <p>Los pedidos de bebidas aparecerán aquí</p>
            </div>
        `;
        return;
    }

    body.innerHTML = tablesWithDrinks.map(table => {
        const drinks     = table.order.filter(i => i.category === "drinks" && !i.servedBar);
        const titleLabel = table.type === "llevar" ? "🥡 Llevar" : `Mesa ${table.id}`;

        return `
        <div class="table-order-card">
            <div class="table-order-header">
                <span class="table-order-title">${titleLabel}</span>
                <span class="table-order-time">🕐 ${table.createdAt}</span>
            </div>

            <div class="order-section">
                <h4 class="order-section-title">🥤 Bebidas</h4>
                ${drinks.map(item => `
                    <div class="order-row">
                        <span class="order-row-qty">x${item.quantity}</span>
                        <span class="order-row-name">${item.name}</span>
                        ${item.term ? `<span class="order-row-term">${item.term}</span>` : ""}
                    </div>
                `).join("")}
            </div>

            ${table.notes ? `
            <div class="order-section order-notes-section">
                <h4 class="order-section-title">📝 Notas</h4>
                <p class="order-notes-text">${table.notes}</p>
            </div>
            ` : ""}

            <div class="order-section">
                <button class="btn-done-bar" data-id="${table.id}">
                    ✅ Pedido listo — Barra
                </button>
            </div>
        </div>
        `;
    }).join("");

    body.querySelectorAll(".btn-done-bar").forEach(btn => {
        btn.addEventListener("click", () => {
            const tableId = parseInt(btn.getAttribute("data-id"));
            barStore.delete(tableId);
            socket.emit("bar-done", tableId);
            renderDrinks();
        });
    });
}

export function drink(container) {
    container.innerHTML = `
    <div class="menu-header">
        <h2>🥤 Pedidos activos — Barra</h2>
        <button id="btn-refresh-bar">🔄 Actualizar</button>
    </div>
    <div class="drinks-body" id="drinks-body"></div>
    `;

    syncBarStore(store);
    renderDrinks();

    const unsubscribe = onStoreUpdate(() => {
        if (!document.getElementById("drinks-body")) {
            unsubscribe();
            return;
        }
        syncBarStore(store);
        renderDrinks();
    });

    document.getElementById("btn-refresh-bar").addEventListener("click", () => {
        syncBarStore(store);
        renderDrinks();
    });
}