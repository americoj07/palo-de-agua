import { store }         from "../../data/store.js";
import { socket }        from "../../socket.js";
import { onStoreUpdate } from "../../socketStore.js";
import "./statistics.css";

// ❌ ELIMINADO: localStorage — las propinas viven en el servidor

export function statistics(container) {
    container.innerHTML = `
    <div class="stats-header">
        <h2>📊 Estadísticas del día</h2>
        <div class="stats-header-buttons">
            <button id="btn-clear-history">🗑️ Limpiar historial</button>
        </div>
    </div>

    <div class="stats-body">
        <div class="stats-summary">
            <div class="summary-card">
                <span>🍽️ Mesas atendidas</span>
                <strong id="stat-tables">0</strong>
            </div>
            <div class="summary-card">
                <span>💰 Total recaudado</span>
                <strong id="stat-total">$0</strong>
            </div>
            <div class="summary-card">
                <span>🤝 Total servicio</span>
                <strong id="stat-service">$0</strong>
            </div>
            <div class="summary-card">
                <span>📋 Sin servicio</span>
                <strong id="stat-subtotal">$0</strong>
            </div>
        </div>

        <div class="stats-closed">
            <h3>📋 Historial de mesas</h3>
            <div id="closed-tables-list"></div>
        </div>
    </div>
    `;

    renderStats();

    const unsubscribe = onStoreUpdate(() => {
        if (document.getElementById("closed-tables-list")) {
            renderStats();
        } else {
            unsubscribe();
        }
    });

    document.getElementById("btn-clear-history").addEventListener("click", () => {
        if (!window.confirm("¿Seguro que deseas limpiar el historial del día?")) return;
        socket.emit("clear-history"); // también resetea totalTips en el servidor
    });
}

function renderStats() {
    const tips          = store.totalTips    || 0;
    const totalTables   = store.closedTables.length;
    const totalRecaudo  = store.closedTables.reduce((s, t) => s + t.total,    0);
    const totalService  = store.closedTables.reduce((s, t) => s + t.service,  0);
    const totalSubtotal = store.closedTables.reduce((s, t) => s + t.subtotal, 0);

    const fmt = (n) => `$${n.toLocaleString()}`;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    set("stat-tables",   totalTables);
    set("stat-total",    fmt(totalRecaudo + tips));   // mesas + propinas
    set("stat-service",  fmt(totalService + tips));   // servicio + propinas
    set("stat-subtotal", fmt(totalSubtotal));
    set("stat-tips",     fmt(tips));

    const list = document.getElementById("closed-tables-list");
    if (!list) return;

    if (store.closedTables.length === 0) {
        list.innerHTML = `<p class="no-data">No hay mesas cerradas hoy</p>`;
        return;
    }

    list.innerHTML = store.closedTables.map((table) => {
        const key = table.closeId || table.id; // closeId es el nuevo campo estable
        return `
        <div class="closed-table-card">
            <div class="closed-table-header">
                <span class="closed-table-title">
                    ${table.type === "llevar" ? "🥡 Llevar" : `Mesa ${table.tableNumber ?? table.id}`}
                </span>
                <span class="closed-table-time">🕐 ${table.closedAt}</span>
                <button class="btn-toggle-detail" data-key="${key}">Ver detalle ▼</button>
            </div>
            <div class="closed-table-totals">
                <span>Subtotal: $${table.subtotal.toLocaleString()}</span>
                <span>Servicio: $${table.service.toLocaleString()}</span>
                <span class="closed-table-total">Total: $${table.total.toLocaleString()}</span>
            </div>
            <div class="closed-table-detail hidden" id="detail-${key}">
                ${table.order.map(item => `
                    <div class="detail-item">
                        <span>${item.name}</span>
                        <span>x${item.quantity}</span>
                        <span>$${item.subtotal.toLocaleString()}</span>
                    </div>
                `).join("")}
            </div>
            <div class="closed-table-actions">
                <button class="btn-reopen-table" data-key="${key}">Devolver</button>
            </div>
        </div>
    `}).join("");

    list.querySelectorAll(".btn-toggle-detail").forEach(btn => {
        btn.addEventListener("click", () => {
            const key    = btn.getAttribute("data-key");
            const detail = document.getElementById(`detail-${key}`);
            const hidden = detail.classList.contains("hidden");
            detail.classList.toggle("hidden");
            btn.textContent = hidden ? "Ocultar ▲" : "Ver detalle ▼";
        });
    });

    list.querySelectorAll(".btn-reopen-table").forEach(btn => {
        btn.addEventListener("click", () => {
            const key = btn.getAttribute("data-key");
            const label = btn.closest(".closed-table-card")
                            .querySelector(".closed-table-title").textContent.trim();
            if (!window.confirm(`¿Devolver "${label}" a mesas activas?`)) return;
            socket.emit("reopen-table", { closeId: key });
        });
    });
}