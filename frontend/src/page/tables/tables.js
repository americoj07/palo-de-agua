import { store }         from "../../data/store.js";
import { socket }        from "../../socket.js";
import { onStoreUpdate } from "../../socketStore.js";
import "./tables.css";
import { openTableDetail } from "./tableDetail.js";

export function tables(container) {
    container.innerHTML = `
    <div class="tables-header">
        <h2>Mesas</h2>
        <button id="btn-add-table">+ Agregar pedido</button>
    </div>
    <div class="tables-grid" id="tables-grid"></div>

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