import { store }         from "../../data/store.js";
import { socket }        from "../../socket.js";
import { onStoreUpdate } from "../../socketStore.js";
import "./dishes.css";

const COCINA_CATS = ["tickets", "dishes", "other"];

const kitchenStore = new Map();

function syncKitchenStore(newStore) {
    newStore.tables.forEach(table => {
        if (table.status !== "open") return;

        const hasPendingFood = table.order.some(item =>
            COCINA_CATS.includes(item.category) && !item.servedKitchen
        );

        if (hasPendingFood) {
            // Guardar copia completa actualizada (incluye notas, id, label)
            kitchenStore.set(table.id, JSON.parse(JSON.stringify(table)));
        } else if (kitchenStore.has(table.id)) {
            // Sin items pendientes: actualizar notas e id por si la mesa fue renombrada
            const local = kitchenStore.get(table.id);
            local.notes = table.notes ?? local.notes ?? "";
            local.id    = table.id;
            local.label = table.label;
            kitchenStore.set(table.id, local);
        }
    });

    // Limpiar mesas cerradas o marcadas como listas
    newStore.tables.forEach(table => {
        if (table.kitchenDone && kitchenStore.has(table.id)) {
            kitchenStore.delete(table.id);
        }
    });
    // Limpiar mesas que ya no están abiertas
    kitchenStore.forEach((_, id) => {
        const stillOpen = newStore.tables.find(t => t.id === id && t.status === "open");
        if (!stillOpen) kitchenStore.delete(id);
    });
}

function renderDishes() {
    const body = document.getElementById("dishes-body");
    if (!body) return;

    const tablesWithFood = [...kitchenStore.values()].filter(table =>
        !table.kitchenDone &&
        table.order.some(item =>
            COCINA_CATS.includes(item.category) && !item.servedKitchen
        )
    );

    if (tablesWithFood.length === 0) {
        body.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🍽️</div>
                <h3>No hay pedidos activos</h3>
                <p>Los pedidos de las mesas aparecerán aquí</p>
            </div>
        `;
        return;
    }

    body.innerHTML = tablesWithFood.map(table => {

        const appetizers = table.order.filter(i => i.category === "tickets" && !i.servedKitchen);
        const dishes     = table.order.filter(i => i.category === "dishes"  && !i.servedKitchen);
        const additions  = table.order.filter(i => i.category === "other"   && !i.servedKitchen);

        const titleLabel = table.type === "llevar" ? "🥡 Llevar" : `Mesa ${table.id}`;

        return `
        <div class="table-order-card">
            <div class="table-order-header">
                <span class="table-order-title">${titleLabel}</span>
                <span class="table-order-time">🕐 ${table.createdAt}</span>
            </div>

            ${appetizers.length > 0 ? `
                <div class="order-section">
                    <h4 class="order-section-title">🍟 Entradas</h4>
                    ${appetizers.map(item => `
                        <div class="order-row">
                            <span class="order-row-qty">x${item.quantity}</span>
                            <span class="order-row-name">${item.name}</span>
                        </div>
                    `).join("")}
                </div>
            ` : ""}

            ${dishes.length > 0 ? `
                <div class="order-section">
                    <h4 class="order-section-title">🍽️ Platos</h4>
                    ${dishes.map(item => `
                        <div class="order-row">
                            <span class="order-row-qty">x${item.quantity}</span>
                            <span class="order-row-name">${item.name}</span>
                            ${item.term ? `<span class="order-row-term">${item.term}</span>` : ""}
                        </div>
                    `).join("")}
                </div>
            ` : ""}

            ${additions.length > 0 ? `
                <div class="order-section">
                    <h4 class="order-section-title">🧆 Adiciones</h4>
                    ${additions.map(item => `
                        <div class="order-row">
                            <span class="order-row-qty">x${item.quantity}</span>
                            <span class="order-row-name">${item.name}</span>
                        </div>
                    `).join("")}
                </div>
            ` : ""}

            ${table.notes ? `
            <div class="order-section order-notes-section">
                <h4 class="order-section-title">📝 Notas</h4>
                <p class="order-notes-text">${table.notes}</p>
            </div>
            ` : ""}

            <div class="order-section">
                <button class="btn-done-kitchen" data-id="${table.id}">
                    ✅ Pedido listo — Cocina
                </button>
            </div>
        </div>
        `;
    }).join("");

    body.querySelectorAll(".btn-done-kitchen").forEach(btn => {
        btn.addEventListener("click", () => {
            const tableId = parseInt(btn.getAttribute("data-id"));
            kitchenStore.delete(tableId);
            socket.emit("kitchen-done", tableId);
            renderDishes();
        });
    });
}

export function dishes(container) {
    container.innerHTML = `
    <div class="menu-header">
        <h2>🍽️ Pedidos activos — Cocina</h2>
        <button id="btn-refresh">🔄 Actualizar</button>
    </div>
    <div class="dishes-body" id="dishes-body"></div>
    `;

    syncKitchenStore(store);
    renderDishes();

    const unsubscribe = onStoreUpdate(() => {
        if (!document.getElementById("dishes-body")) {
            unsubscribe();
            return;
        }
        syncKitchenStore(store);
        renderDishes();
    });

    document.getElementById("btn-refresh").addEventListener("click", () => {
        syncKitchenStore(store);
        renderDishes();
    });
}