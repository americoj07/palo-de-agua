import { store }         from "../../data/store.js";
import { socket }        from "../../socket.js";
import { onStoreUpdate } from "../../socketStore.js";
import "./tables.css";
import { openTableDetail } from "./tableDetail.js";

export function tables(container) {
    container.innerHTML = `
    <div class="tables-header">
        <h2>Mesas</h2>
        <div class="tables-header-buttons">
            <div class="tip-btn-container">
                <div class="tip-btn-group">
                    <button id="btn-add-tip">💰 Agregar propina</button>
                    <button id="btn-tip-history-toggle" title="Ver historial de propinas">▾</button>
                </div>
                <div class="tip-history-dropdown hidden" id="tip-history-dropdown">
                    <div class="tip-history-header">
                        <span class="tip-history-title">💰 Historial de propinas</span>
                        <span class="tip-history-total" id="tip-history-total">$0</span>
                    </div>
                    <div class="tip-history-list" id="tip-history-list">
                        <p class="tip-history-empty">Aún no hay propinas registradas</p>
                    </div>
                </div>
            </div>
            <button id="btn-add-table">+ Agregar pedido</button>
        </div>
    </div>
    <div class="tables-grid" id="tables-grid"></div>

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


    <!-- Modal tipo de pedido -->
    <div class="order-modal-overlay hidden" id="order-modal-overlay">
        <div class="order-modal">
            <div class="order-modal-header">
                <h3>¿Qué tipo de pedido es?</h3>
                <button class="order-modal-close" id="btn-close-order-modal">✕</button>
            </div>
            <div class="order-modal-options">
                <button class="order-option-btn" id="btn-tipo-mesa">
                    🍽️ Mesa
                </button>
                <button class="order-option-btn" id="btn-tipo-llevar">
                    🥡 Para llevar
                </button>
            </div>
        </div>
    </div>

    <!-- Modal número de mesa -->
    <div class="order-modal-overlay hidden" id="mesa-modal-overlay">
        <div class="order-modal">
            <div class="order-modal-header">
                <h3>¿Número de mesa?</h3>
                <button class="order-modal-close" id="btn-close-mesa-modal">✕</button>
            </div>
            <div class="order-modal-body">
                <input
                    type="number"
                    id="mesa-input"
                    placeholder="Ej: 5"
                    min="1"
                />
            </div>
            <div class="order-modal-footer">
                <button id="btn-cancel-mesa">Cancelar</button>
                <button id="btn-confirm-mesa">✅ Confirmar</button>
            </div>
        </div>
    </div>
    `;

    renderTables();

    const unsubscribe = onStoreUpdate(() => {
        if (document.getElementById("tables-grid")) {
            renderTables();
        } else {
            unsubscribe();
        }
    });

    // ===== MODAL TIPO DE PEDIDO =====
    const orderOverlay = document.getElementById("order-modal-overlay");
    const mesaOverlay  = document.getElementById("mesa-modal-overlay");

    document.getElementById("btn-add-table").addEventListener("click", () => {
        orderOverlay.classList.remove("hidden");
    });

    const closeOrderModal = () => orderOverlay.classList.add("hidden");
    document.getElementById("btn-close-order-modal").addEventListener("click", closeOrderModal);
    orderOverlay.addEventListener("click", (e) => {
        if (e.target === orderOverlay) closeOrderModal();
    });

    const closeMesaModal = () => {
        mesaOverlay.classList.add("hidden");
        document.getElementById("mesa-input").value = "";
    };
    document.getElementById("btn-close-mesa-modal").addEventListener("click", closeMesaModal);
    document.getElementById("btn-cancel-mesa").addEventListener("click", closeMesaModal);
    mesaOverlay.addEventListener("click", (e) => {
        if (e.target === mesaOverlay) closeMesaModal();
    });

    document.getElementById("btn-tipo-mesa").addEventListener("click", () => {
        closeOrderModal();
        mesaOverlay.classList.remove("hidden");
        document.getElementById("mesa-input").focus();
    });

    document.getElementById("btn-confirm-mesa").addEventListener("click", () => {
        const input   = document.getElementById("mesa-input");
        const tableId = parseInt(input.value);

        if (isNaN(tableId) || tableId <= 0) {
            alert("Por favor ingresa un número válido");
            return;
        }

        // Verifica que no esté abierta ya
        const alreadyOpen = store.tables.find(t => t.id === tableId && t.status === "open");
        if (alreadyOpen) {
            alert(`La mesa ${tableId} ya está abierta`);
            return;
        }

        // ✅ CORRECCIÓN: emite siempre con order vacío y pedido limpio
        // El servidor debe reemplazar cualquier entrada anterior con este objeto nuevo
        socket.emit("add-table", {
            id:          tableId,
            type:        "mesa",
            label:       `Mesa ${tableId}`,
            status:      "open",
            order:       [],          // siempre vacío al crear
            createdAt:   new Date().toLocaleString("es-CO"),
            kitchenDone: false,
            barDone:     false
        });

        closeMesaModal();
        // Abrir detalle de la mesa recién creada directamente
        setTimeout(() => openTableDetail(tableId), 120);
    });

    document.getElementById("mesa-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById("btn-confirm-mesa").click();
    });

    document.getElementById("btn-tipo-llevar").addEventListener("click", () => {
        closeOrderModal();
        openLlevarModal();
    });

    // ===== MODAL PROPINA =====
    const tipOverlay = document.getElementById("tip-modal-overlay");

    document.getElementById("btn-add-tip").addEventListener("click", () => {
        document.getElementById("tip-input").value = "";
        // Mostrar total actual desde el store del servidor
        const el = document.getElementById("tip-total");
        if (el) el.textContent = `$${(store.totalTips || 0).toLocaleString()}`;
        tipOverlay.classList.remove("hidden");
        setTimeout(() => document.getElementById("tip-input").focus(), 50);
    });

    const closeTipModal = () => tipOverlay.classList.add("hidden");
    document.getElementById("btn-close-tip-modal").addEventListener("click", closeTipModal);
    document.getElementById("btn-cancel-tip").addEventListener("click", closeTipModal);
    tipOverlay.addEventListener("click", (e) => { if (e.target === tipOverlay) closeTipModal(); });

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

    // ===== HISTORIAL DE PROPINAS (panel desplegable) =====
    const tipHistoryDropdown = document.getElementById("tip-history-dropdown");
    const tipHistoryToggle   = document.getElementById("btn-tip-history-toggle");
    const tipBtnGroup        = document.querySelector(".tip-btn-group");

    // Convierte "28/7/2026, 9:50:42 a. m." -> "28/07/2026 9:50am"
    function formatTipDate(atString) {
        const m = atString.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(a\.\s*m\.|p\.\s*m\.)/i);
        if (!m) return atString; // si no matchea el formato esperado, mostramos tal cual
        const [, d, mo, y, h, min, , ampmRaw] = m;
        const ampm = /a/i.test(ampmRaw) ? "am" : "pm";
        const dd = d.padStart(2, "0");
        const mm = mo.padStart(2, "0");
        return `${dd}/${mm}/${y} ${h}:${min}${ampm}`;
    }

    function renderTipHistory() {
        const total     = store.totalTips   || 0;
        const historial = store.tipsHistory || [];

        document.getElementById("tip-history-total").textContent = `$${total.toLocaleString("es-CO")}`;

        const listEl = document.getElementById("tip-history-list");

        if (historial.length === 0) {
            listEl.innerHTML = `<p class="tip-history-empty">Aún no hay propinas registradas</p>`;
            return;
        }

        listEl.innerHTML = historial.map((entry, i) => `
            <div class="tip-history-item">
                <span class="tip-history-index">${i + 1}</span>
                <span class="tip-history-amount">$${entry.amount.toLocaleString("es-CO")}</span>
                <span class="tip-history-datetime">${formatTipDate(entry.at)}</span>
                <button class="btn-delete-tip" data-id="${entry.id}" title="Eliminar esta propina">🗑️</button>
            </div>
        `).join("");

        listEl.querySelectorAll(".btn-delete-tip").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                if (!window.confirm("¿Eliminar esta propina? Se restará del total acumulado.")) return;
                socket.emit("delete-tip", { id });
            });
        });
    }

    // Posiciona el panel con position:fixed usando las coordenadas reales del botón,
    // así funciona igual en cualquier tamaño de pantalla sin depender del layout del padre.
    function positionTipHistoryDropdown() {
        const margin        = 8;
        const viewportWidth = window.innerWidth;
        const width         = Math.min(320, viewportWidth - margin * 2);
        const groupRect     = tipBtnGroup.getBoundingClientRect();

        let left = groupRect.left;
        if (left + width > viewportWidth - margin) left = viewportWidth - width - margin;
        if (left < margin) left = margin;

        tipHistoryDropdown.style.width = `${width}px`;
        tipHistoryDropdown.style.left  = `${left}px`;
        tipHistoryDropdown.style.top   = `${groupRect.bottom + margin}px`;
    }

    tipHistoryToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = tipHistoryDropdown.classList.contains("hidden");
        if (isHidden) {
            renderTipHistory();
            positionTipHistoryDropdown();
            tipHistoryDropdown.classList.remove("hidden");
        } else {
            tipHistoryDropdown.classList.add("hidden");
        }
    });

    // Si cambia el tamaño de la ventana (ej. rotar el celular) mientras está abierto, reposicionamos
    window.addEventListener("resize", () => {
        if (!tipHistoryDropdown.classList.contains("hidden")) {
            positionTipHistoryDropdown();
        }
    });

    // Cerrar el panel al hacer clic afuera
    function handleOutsideClick(e) {
        if (!document.body.contains(tipHistoryDropdown)) {
            document.removeEventListener("click", handleOutsideClick);
            return;
        }
        if (!tipHistoryDropdown.classList.contains("hidden") &&
            !tipHistoryDropdown.contains(e.target) &&
            e.target !== tipHistoryToggle) {
            tipHistoryDropdown.classList.add("hidden");
        }
    }
    document.addEventListener("click", handleOutsideClick);

    // Si el panel está abierto y llega una actualización del store (ej. otro dispositivo
    // agrega una propina), refrescamos la lista en tiempo real
    const unsubscribeTipHistory = onStoreUpdate(() => {
        if (!document.getElementById("tip-history-dropdown")) {
            unsubscribeTipHistory();
            return;
        }
        if (!tipHistoryDropdown.classList.contains("hidden")) {
            renderTipHistory();
        }
    });
}

// ===== MODAL NOMBRE PARA LLEVAR =====
function openLlevarModal() {
    const existing = document.getElementById("llevar-modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "llevar-modal-overlay";
    overlay.className = "order-modal-overlay";
    overlay.innerHTML = `
        <div class="order-modal">
            <div class="order-modal-header">
                <h3>¿Nombre del pedido?</h3>
                <button class="order-modal-close" id="btn-close-llevar-modal">✕</button>
            </div>
            <div class="order-modal-body">
                <input
                    type="text"
                    id="llevar-name-input"
                    placeholder="Ej: Juan, Mesa 3, Delivery..."
                    maxlength="30"
                    autocomplete="off"
                />
            </div>
            <div class="order-modal-footer">
                <button id="btn-cancel-llevar">Cancelar</button>
                <button id="btn-confirm-llevar">✅ Confirmar</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    document.getElementById("btn-close-llevar-modal").addEventListener("click", closeModal);
    document.getElementById("btn-cancel-llevar").addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

    const input = document.getElementById("llevar-name-input");
    setTimeout(() => input.focus(), 50);

    const confirm = () => {
        const name     = input.value.trim();
        const llevarId = Date.now();
        socket.emit("add-table", {
            id:          llevarId,
            type:        "llevar",
            label:       "Llevar",
            clientName:  name || "",
            status:      "open",
            order:       [],
            createdAt:   new Date().toLocaleString("es-CO"),
            kitchenDone: false,
            barDone:     false
        });
        closeModal();
        setTimeout(() => openTableDetail(llevarId), 120);
    };

    document.getElementById("btn-confirm-llevar").addEventListener("click", confirm);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") confirm(); });
}

export function renderTables() {
    const grid = document.getElementById("tables-grid");
    if (!grid) return;

    const openTables = store.tables.filter(t => t.status === "open");

    if (openTables.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🍽️</div>
                <h3>No hay pedidos activos</h3>
                <p>Haz clic en <strong>"Agregar pedido"</strong> para comenzar el servicio</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = openTables.map(table =>
        `<div class="table-card ${table.type === 'llevar' ? 'table-card-llevar' : ''}" data-id="${table.id}">
            ${table.type !== 'llevar' ? `
            <button class="btn-rename-table" data-id="${table.id}" title="Cambiar número de mesa">✏️</button>
            ` : ''}
            <strong>${table.type === 'llevar' ? '🥡' : table.id}</strong>
            <div class="table-card-info">
                <span>${table.type === 'llevar'
                    ? (table.clientName ? `🥡 ${table.clientName}` : 'Para llevar')
                    : 'Mesa'}</span>
                <span class="table-card-time">${table.createdAt}</span>
            </div>
        </div>`
    ).join("");

    grid.querySelectorAll(".table-card").forEach(card => {
        card.addEventListener("click", (e) => {
            // No abrir detalle si se clickeó el botón de renombrar
            if (e.target.closest(".btn-rename-table")) return;
            const tableId = parseInt(card.getAttribute("data-id"));
            openTableDetail(tableId);
        });
    });

    // ===== BOTONES RENOMBRAR =====
    grid.querySelectorAll(".btn-rename-table").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const oldId = parseInt(btn.getAttribute("data-id"));
            openRenameModal(oldId);
        });
    });
}
// ===== MODAL CAMBIAR NÚMERO DE MESA =====
function openRenameModal(oldId) {
    // Evitar duplicados
    const existing = document.getElementById("rename-modal-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "rename-modal-overlay";
    overlay.className = "order-modal-overlay";
    overlay.innerHTML = `
        <div class="order-modal">
            <div class="order-modal-header">
                <h3>Cambiar número — Mesa ${oldId}</h3>
                <button class="order-modal-close" id="btn-close-rename">✕</button>
            </div>
            <div class="order-modal-body">
                <input
                    type="number"
                    id="rename-input"
                    placeholder="Nuevo número (ej: 7)"
                    min="1"
                    autocomplete="off"
                />
            </div>
            <div class="order-modal-footer">
                <button id="btn-cancel-rename">Cancelar</button>
                <button id="btn-confirm-rename">✅ Confirmar</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();

    document.getElementById("btn-close-rename").addEventListener("click", closeModal);
    document.getElementById("btn-cancel-rename").addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

    const input = document.getElementById("rename-input");
    input.focus();

    const confirm = () => {
        const newId = parseInt(input.value);
        if (isNaN(newId) || newId <= 0) {
            alert("Por favor ingresa un número válido");
            return;
        }
        if (newId === oldId) {
            alert("El número nuevo es igual al actual");
            return;
        }
        const alreadyOpen = store.tables.find(t => t.id === newId && t.status === "open");
        if (alreadyOpen) {
            alert(`La mesa ${newId} ya está ocupada`);
            return;
        }
        socket.emit("rename-table", { oldId, newId });
        closeModal();
    };

    document.getElementById("btn-confirm-rename").addEventListener("click", confirm);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") confirm(); });
}