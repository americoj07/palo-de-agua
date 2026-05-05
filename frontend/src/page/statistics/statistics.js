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
            <button id="btn-add-tip">💰 Agregar propina</button>
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

    <!-- Modal propina -->
    <div class="tip-modal-overlay hidden" id="tip-modal-overlay">
        <div class="tip-modal">
            <div class="tip-modal-header">
                <h3>💰 Agregar propina</h3>
                <button class="tip-modal-close" id="btn-close-tip-modal">✕</button>
            </div>
            <div class="tip-modal-body">
                <p class="tip-modal-label">Ingresa el monto de la propina:</p>
                <input type="number" id="tip-input" placeholder="Ej: 10000" min="1"/>
                <p class="tip-accumulated">
                    Propinas acumuladas: <span id="tip-total">$0</span>
                </p>
            </div>
            <div class="tip-modal-footer">
                <button id="btn-cancel-tip">Cancelar</button>
                <button id="btn-confirm-tip">✅ Confirmar</button>
            </div>
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

    // ===== MODAL PROPINA =====
    const overlay = document.getElementById("tip-modal-overlay");

    document.getElementById("btn-add-tip").addEventListener("click", () => {
        document.getElementById("tip-input").value = "";
        // Mostrar total actual desde el store del servidor
        const el = document.getElementById("tip-total");
        if (el) el.textContent = `$${(store.totalTips || 0).toLocaleString()}`;
        overlay.classList.remove("hidden");
        setTimeout(() => document.getElementById("tip-input").focus(), 50);
    });

    const closeTipModal = () => overlay.classList.add("hidden");
    document.getElementById("btn-close-tip-modal").addEventListener("click", closeTipModal);
    document.getElementById("btn-cancel-tip").addEventListener("click", closeTipModal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeTipModal(); });

    document.getElementById("btn-confirm-tip").addEventListener("click", () => {
        const input  = document.getElementById("tip-input");
        const amount = parseInt(input.value) || 0;
        if (amount <= 0) { alert("Por favor ingresa un monto válido"); return; }
        // ✅ Se envía al servidor → servidor actualiza store.totalTips
        //    → io.emit("store-update") → TODOS los dispositivos lo reciben
        socket.emit("add-tip", { amount });
        closeTipModal();
    });

    document.getElementById("tip-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("btn-confirm-tip").click();
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
    set("tip-total",     fmt(tips));                  // actualiza dentro del modal también

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
}