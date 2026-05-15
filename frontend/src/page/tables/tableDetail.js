import { menuItems } from "../../data/menu.js";
import { store }     from "../../data/store.js";
import { socket }    from "../../socket.js";
import "./tableDetail.css";

const isMobile = () => window.innerWidth <= 480;

const COCINA_CATS = ["tickets", "dishes", "other"];
const BARRA_CATS  = ["drinks"];

export function openTableDetail(tableId) {
    const table = store.tables.find(t => t.id === tableId);
    if (!table) return;

    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
    <div class="modal">
        <div class="modal-header">
            <div>
                <h2>${table.type === "llevar" ? "🥡 Para llevar" : `Mesa ${table.id}`}</h2>
                <span class="table-time">🕐 ${table.createdAt}</span>
            </div>
            <button class="btn-close">✕</button>
        </div>

        <div class="modal-body">

            <div class="view-toggle">
                <button class="view-toggle-btn active" data-view="menu">🍽️ Menú</button>
                <button class="view-toggle-btn" data-view="order">
                    🧾 Pedido <span class="order-badge" id="order-count">0</span>
                </button>
            </div>

            <!-- ===== PANEL MENÚ ===== -->
            <div class="panel-menu" id="panel-menu">
                <div class="search-bar">
                    <input type="text" id="search-input" placeholder="🔍 Buscar plato, bebida o adición..." autocomplete="off"/>
                </div>
                <div class="menu-list" id="menu-list">
                    <div class="search-hint">
                        <span class="search-hint-icon">🔍</span>
                        <span>Escribe para buscar en el menú completo</span>
                    </div>
                </div>
            </div>

            <!-- ===== MODAL ÍTEM PERSONALIZADO ===== -->
            <div class="notes-modal-overlay hidden" id="custom-item-overlay">
                <div class="notes-modal">
                    <div class="notes-modal-header">
                        <span>✨ Ítem personalizado</span>
                        <button class="notes-modal-close" id="btn-close-custom-item">✕</button>
                    </div>
                    <div class="custom-item-body">
                        <label class="custom-item-label">Nombre del ítem</label>
                        <input type="text" id="custom-item-name" class="custom-item-input"
                            placeholder="Ej: Copa de vino, Bandeja especial..." autocomplete="off"/>
                        <label class="custom-item-label">Precio</label>
                        <input type="number" id="custom-item-price" class="custom-item-input"
                            placeholder="Ej: 15000" min="0"/>
                        <label class="custom-item-label">¿A dónde va?</label>
                        <div class="custom-item-dest">
                            <button class="custom-dest-btn active" data-dest="other" id="dest-cocina">🍳 Cocina</button>
                            <button class="custom-dest-btn" data-dest="drinks" id="dest-barra">🥤 Barra</button>
                        </div>
                    </div>
                    <div class="notes-modal-footer">
                        <button class="btn-notes-cancel" id="btn-cancel-custom-item">Cancelar</button>
                        <button class="btn-notes-save" id="btn-save-custom-item">✅ Agregar</button>
                    </div>
                </div>
            </div>

            <!-- ===== PANEL PEDIDO ===== -->
            <div class="panel-order hidden" id="panel-order">
                <div id="order-list"></div>

                <div class="service-toggle">
                    <span>Servicio (10%)</span>
                    <label class="switch">
                        <input type="checkbox" id="service-check" checked>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="order-total">
                    <div class="total-row"><span>Subtotal</span><span id="order-subtotal">$0</span></div>
                    <div class="total-row"><span>Servicio 10%</span><span id="order-service">$0</span></div>
                    <div class="total-row total-final"><strong>Total</strong><strong id="order-total">$0</strong></div>
                </div>

                <div class="action-btns">
                    <button class="btn-custom-item-icon" id="btn-custom-item-desktop" title="Ítem personalizado">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="12" y1="18" x2="12" y2="12"/>
                            <line x1="9" y1="15" x2="15" y2="15"/>
                        </svg>
                    </button>
                    <div class="btn-print-group">
                        <button class="btn-print-order">🖨️ Pedido</button>
                        <button class="btn-reprint-order" title="Reimprimir último pedido">↑</button>
                    </div>
                    <button class="btn-print-ticket">🧾 Factura</button>
                    <button class="btn-close-table">✖ Cerrar</button>
                </div>
            </div>

        </div>

        <div class="mobile-order-panel" id="mobile-order-panel"></div>

        <!-- Barra acción móvil SIN botón de notas global -->
        <div class="mobile-action-bar">
            <button class="btn-custom-item-icon" id="btn-custom-item" title="Ítem personalizado">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
            </button>
            <div class="btn-print-group">
                <button class="btn-print-order mob">🖨️ Pedido</button>
                <button class="btn-reprint-order mob" title="Reimprimir último pedido">↑</button>
            </div>
            <button class="btn-print-ticket mob">🧾 Factura</button>
            <button class="btn-close-table mob">✖ Cerrar</button>
        </div>
    </div>

    <!-- ===== MODAL NOTA DE ITEM ===== -->
    <div class="notes-modal-overlay hidden" id="item-note-overlay">
        <div class="notes-modal">
            <div class="notes-modal-header">
                <span id="item-note-title">📝 Nota del item</span>
                <button class="notes-modal-close" id="btn-close-item-note">✕</button>
            </div>
            <textarea id="item-note-textarea" class="notes-textarea"
                placeholder="Ej: sin cebolla, sin guacamole..."
                rows="4"></textarea>
            <div class="notes-modal-footer">
                <button class="btn-notes-cancel" id="btn-cancel-item-note">Cancelar</button>
                <button class="btn-notes-save" id="btn-save-item-note">✅ Guardar</button>
            </div>
        </div>
    </div>
    `;

    document.body.appendChild(modal);

    // ===== STORE UPDATE =====
    const onStoreUpdate = () => {
        const updated = store.tables.find(t => t.id === tableId);
        if (updated) renderOrder(updated);
    };
    socket.off("store-update", onStoreUpdate);
    socket.on("store-update",  onStoreUpdate);

    // ===== CERRAR MODAL =====
    const closeModal = () => { socket.off("store-update", onStoreUpdate); modal.remove(); };
    modal.querySelector(".btn-close").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

    // ===== SWITCH MENÚ / PEDIDO =====
    const panelMenu  = modal.querySelector("#panel-menu");
    const panelOrder = modal.querySelector("#panel-order");

    modal.querySelectorAll(".view-toggle-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            modal.querySelectorAll(".view-toggle-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            if (btn.getAttribute("data-view") === "menu") {
                panelMenu.classList.remove("hidden");
                panelOrder.classList.add("hidden");
            } else {
                panelMenu.classList.add("hidden");
                panelOrder.classList.remove("hidden");
            }
        });
    });

    // ===== BUSCADOR =====
    const searchInput = modal.querySelector("#search-input");
    const menuList    = modal.querySelector("#menu-list");

    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (isMobile() && query.length === 0) {
            menuList.classList.remove("has-query");
            menuList.innerHTML = `<div class="search-hint"><span class="search-hint-icon">🔍</span><span>Escribe para buscar en el menú completo</span></div>`;
            return;
        }
        menuList.classList.add("has-query");
        renderMenuList(query, table);
    });

    // ===== TOGGLE SERVICIO =====
    modal.querySelector("#service-check").addEventListener("change", () => {
        const updated = store.tables.find(t => t.id === tableId);
        if (updated) renderOrder(updated);
    });

    // ===== MODAL NOTA DE ITEM =====
    const itemNoteOverlay  = modal.querySelector("#item-note-overlay");
    const itemNoteTextarea = modal.querySelector("#item-note-textarea");
    const itemNoteTitle    = modal.querySelector("#item-note-title");
    let currentItemNoteKey = null; // "id|category|term|printed"

    const openItemNote = (item) => {
        currentItemNoteKey = `${item.id}|${item.category}|${item.term || ""}|${item.printed}`;
        itemNoteTitle.textContent = `📝 ${item.name}`;
        itemNoteTextarea.value = item.note || "";
        itemNoteOverlay.classList.remove("hidden");
        setTimeout(() => itemNoteTextarea.focus(), 50);
    };
    const closeItemNote = () => { itemNoteOverlay.classList.add("hidden"); currentItemNoteKey = null; };

    modal.querySelector("#btn-close-item-note").addEventListener("click", closeItemNote);
    modal.querySelector("#btn-cancel-item-note").addEventListener("click", closeItemNote);
    itemNoteOverlay.addEventListener("click", (e) => { if (e.target === itemNoteOverlay) closeItemNote(); });

    modal.querySelector("#btn-save-item-note").addEventListener("click", () => {
        if (!currentItemNoteKey) return;
        const [id, category, term, printed] = currentItemNoteKey.split("|");
        socket.emit("set-item-note", {
            tableId,
            id:       parseInt(id),
            category,
            term:     term || null,
            printed:  printed === "true",
            note:     itemNoteTextarea.value.trim()
        });
        closeItemNote();
    });

    // Delegación de clicks en notas de item (desktop panel + mobile panel)
    const handleNoteClick = (e) => {
        const btn = e.target.closest(".btn-item-note");
        if (!btn) return;
        const currentTable = store.tables.find(t => t.id === tableId);
        if (!currentTable) return;
        const id       = parseInt(btn.getAttribute("data-id"));
        const category = btn.getAttribute("data-category");
        const term     = btn.getAttribute("data-term") || null;
        const printed  = btn.getAttribute("data-printed") === "true";
        const item     = currentTable.order.find(o =>
            o.id === id && o.category === category &&
            (o.term || "") === (term || "") && o.printed === printed
        );
        if (item) openItemNote(item);
    };

    modal.querySelector("#order-list").addEventListener("click", handleNoteClick);
    modal.querySelector("#mobile-order-panel").addEventListener("click", handleNoteClick);

    // ===== MODAL ÍTEM PERSONALIZADO =====
    const customItemOverlay = modal.querySelector("#custom-item-overlay");
    let customDest = "other"; // default: cocina

    const openCustomItemModal = () => {
        modal.querySelector("#custom-item-name").value  = "";
        modal.querySelector("#custom-item-price").value = "";
        customDest = "other";
        modal.querySelectorAll(".custom-dest-btn").forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-dest") === "other");
        });
        customItemOverlay.classList.remove("hidden");
        setTimeout(() => modal.querySelector("#custom-item-name").focus(), 50);
    };
    const closeCustomItemModal = () => customItemOverlay.classList.add("hidden");

    modal.querySelector("#btn-custom-item").addEventListener("click", openCustomItemModal);
    const desktopCustomBtn = modal.querySelector("#btn-custom-item-desktop");
    if (desktopCustomBtn) desktopCustomBtn.addEventListener("click", openCustomItemModal);
    modal.querySelector("#btn-close-custom-item").addEventListener("click", closeCustomItemModal);
    modal.querySelector("#btn-cancel-custom-item").addEventListener("click", closeCustomItemModal);
    customItemOverlay.addEventListener("click", (e) => { if (e.target === customItemOverlay) closeCustomItemModal(); });

    modal.querySelectorAll(".custom-dest-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            customDest = btn.getAttribute("data-dest");
            modal.querySelectorAll(".custom-dest-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
        });
    });

    modal.querySelector("#btn-save-custom-item").addEventListener("click", () => {
        const nameInput  = modal.querySelector("#custom-item-name");
        const priceInput = modal.querySelector("#custom-item-price");
        const name  = nameInput.value.trim();
        const price = parseInt(priceInput.value);

        if (!name) { alert("Por favor escribe un nombre para el ítem"); nameInput.focus(); return; }
        if (isNaN(price) || price < 0) { alert("Por favor ingresa un precio válido"); priceInput.focus(); return; }

        const customTable = store.tables.find(t => t.id === tableId);
        if (!customTable) return;

        socket.emit("add-item", {
            tableId,
            item: {
                id:            Date.now(),   // ID único para este ítem
                category:      customDest,   // "other" → cocina | "drinks" → barra
                name,
                price,
                quantity:      1,
                subtotal:      price,
                term:          null,
                note:          null,
                servedKitchen: false,
                servedBar:     false,
                printed:       false
            }
        });

        closeCustomItemModal();

        // Feedback visual: ir al panel de pedido
        const orderBtn = modal.querySelector(".view-toggle-btn[data-view='order']");
        if (orderBtn) orderBtn.click();
    });

    // ===== IMPRIMIR PEDIDO =====
    const handlePrintOrder = () => {
        const currentTable = store.tables.find(t => t.id === tableId);
        if (!currentTable || currentTable.order.length === 0) { alert("No hay items para imprimir"); return; }
        socket.emit("print-order", { table: currentTable });
        const onSuccess = () => { socket.off("print-error", onError); alert("✅ Pedido enviado"); };
        const onError   = (msg) => { socket.off("print-success", onSuccess); alert(`⚠️ Error: ${msg}`); };
        socket.once("print-success", onSuccess);
        socket.once("print-error",   onError);
    };
    modal.querySelectorAll(".btn-print-order").forEach(b => b.addEventListener("click", handlePrintOrder));

    // ===== REIMPRIMIR PEDIDO (items ya enviados) =====
    const handleReprintOrder = () => {
        const currentTable = store.tables.find(t => t.id === tableId);
        if (!currentTable) return;
        const printedItems = currentTable.order.filter(i => i.printed);
        if (printedItems.length === 0) {
            alert("No hay pedidos impresos anteriormente para reimprimir");
            return;
        }
        // Enviamos el pedido con los items ya impresos para reimprimir
        socket.emit("reprint-order", { table: currentTable });
        const onSuccess = () => { socket.off("print-error", onError); alert("✅ Pedido reimpreso"); };
        const onError   = (msg) => { socket.off("print-success", onSuccess); alert(`⚠️ Error: ${msg}`); };
        socket.once("print-success", onSuccess);
        socket.once("print-error",   onError);
    };
    modal.querySelectorAll(".btn-reprint-order").forEach(b => b.addEventListener("click", handleReprintOrder));

    // ===== IMPRIMIR FACTURA =====
    const handlePrintTicket = () => {
        const currentTable   = store.tables.find(t => t.id === tableId);
        if (!currentTable || currentTable.order.length === 0) { alert("No hay items para facturar"); return; }
        const serviceCheck   = modal.querySelector("#service-check");
        const includeService = serviceCheck ? serviceCheck.checked : true;
        const subtotal       = currentTable.order.reduce((s, i) => s + i.subtotal, 0);
        const service        = includeService ? Math.round(subtotal * 0.10) : 0;
        const total          = subtotal + service;
        socket.emit("print-ticket", { table: currentTable, subtotal, service, total, includeService });
        const onSuccess = () => { socket.off("print-error", onError); alert("✅ Factura impresa"); };
        const onError   = (msg) => { socket.off("print-success", onSuccess); alert(`⚠️ Error: ${msg}`); };
        socket.once("print-success", onSuccess);
        socket.once("print-error",   onError);
    };
    modal.querySelectorAll(".btn-print-ticket").forEach(b => b.addEventListener("click", handlePrintTicket));

    // ===== CERRAR CUENTA =====
    const handleCloseTable = () => {
        const label = table.type === "llevar" ? "Para llevar" : `Mesa ${table.id}`;
        if (!window.confirm(`¿Cerrar la cuenta de ${label}?`)) return;
        const currentTable   = store.tables.find(t => t.id === tableId);
        const serviceCheck   = modal.querySelector("#service-check");
        const includeService = serviceCheck ? serviceCheck.checked : true;
        const subtotal       = currentTable.order.reduce((s, i) => s + i.subtotal, 0);
        const service        = includeService ? Math.round(subtotal * 0.10) : 0;
        socket.emit("close-table", { tableId: table.id, subtotal, service, total: subtotal + service });
        closeModal();
    };
    modal.querySelectorAll(".btn-close-table").forEach(b => b.addEventListener("click", handleCloseTable));

    // ===== CARGA INICIAL =====
    if (!isMobile()) renderMenuList("", table);
    renderOrder(table);

    // ===== FUNCIÓN INTERNA: renderizar lista del menú =====
    function renderMenuList(query, tableRef) {
        const content = modal.querySelector("#menu-list");
        if (!content) return;

        let items = menuItems;
        if (query) items = items.filter(i => i.name.toLowerCase().includes(query));

        if (items.length === 0) {
            content.innerHTML = `<p class="no-results">No se encontró "${query}"</p>`;
            return;
        }

        const tickets = items.filter(i => i.category === "tickets");
        const dishes  = items.filter(i => i.category === "dishes");
        const drinks  = items.filter(i => i.category === "drinks");
        const others  = items.filter(i => i.category === "other");

        let html = "";
        if (tickets.length > 0) { html += `<div class="menu-category-title">🥗 Entradas</div>`; html += tickets.map(buildItemHTML).join(""); }
        if (dishes.length  > 0) { html += `<div class="menu-category-title">🍖 Platos</div>`;   html += dishes.map(buildItemHTML).join("");  }
        if (drinks.length  > 0) { html += `<div class="menu-category-title">🥤 Bebidas</div>`;  html += drinks.map(buildItemHTML).join("");  }
        if (others.length  > 0) { html += `<div class="menu-category-title">🧆 Adiciones</div>`; html += others.map(buildItemHTML).join(""); }

        content.innerHTML = html;

        content.querySelectorAll(".btn-add-item").forEach(btn => {
            btn.addEventListener("click", () => {
                const itemId   = parseInt(btn.getAttribute("data-id"));
                const menuItem = menuItems.find(i => i.id === itemId);
                if (!menuItem) return;

                const isCarne = menuItem.term && menuItem.category !== "drinks";
                const isDrink = menuItem.category === "drinks";

                if (isCarne) {
                    const termSelect = content.querySelector(`.term-select[data-id="${itemId}"]`);
                    if (!termSelect || !termSelect.value) { alert("Selecciona el término de cocción"); return; }
                    addItem(tableRef, menuItem, termSelect.value);
                } else if (isDrink) {
                    const azucar = content.querySelector(`.term-azucar[data-id="${itemId}"]`)?.value || "";
                    const hielo  = content.querySelector(`.term-hielo[data-id="${itemId}"]`)?.value  || "";
                    addItem(tableRef, menuItem, [azucar, hielo].filter(Boolean).join(" / ") || null);
                } else {
                    addItem(tableRef, menuItem, null);
                }

                btn.style.transform = "scale(0.85)";
                setTimeout(() => btn.style.transform = "", 150);

                if (isMobile()) {
                    searchInput.value = "";
                    content.classList.remove("has-query");
                    content.innerHTML = `<div class="search-hint"><span class="search-hint-icon">✅</span><span>Agregado. Busca otro item.</span></div>`;
                    setTimeout(() => {
                        content.innerHTML = `<div class="search-hint"><span class="search-hint-icon">🔍</span><span>Escribe para buscar en el menú completo</span></div>`;
                    }, 1500);
                }
            });
        });
    }
}

// ===== BUILD ITEM HTML (menú) =====
function buildItemHTML(item) {
    const isDrink = item.category === "drinks";
    const isCarne = item.term && !isDrink;
    return `
    <div class="menu-item">
        <span class="item-name">${item.name}</span>
        <span class="item-price">$${item.price.toLocaleString("es-CO")}</span>
        ${isCarne ? `
        <select class="term-select" data-id="${item.id}">
            <option value="">Término</option>
            <option value="Azul">Azul</option>
            <option value="1/2">1/2</option>
            <option value="3/4">3/4</option>
            <option value="100%">100%</option>
        </select>` : ""}
        ${isDrink ? `
        <select class="term-select term-azucar" data-id="${item.id}">
            <option value="">Azúcar</option>
            <option value="S/A">S/A</option>
            <option value="P/A">P/A</option>
        </select>
        <select class="term-select term-hielo" data-id="${item.id}">
            <option value="">Hielo</option>
            <option value="S/H">S/H</option>
            <option value="P/H">P/H</option>
        </select>` : ""}
        <button class="btn-add-item" data-id="${item.id}">+</button>
    </div>`;
}

// ===== ADD ITEM =====
function addItem(table, menuItem, term) {
    socket.emit("add-item", {
        tableId: table.id,
        item: {
            id:            menuItem.id,
            category:      menuItem.category,
            name:          menuItem.name,
            price:         menuItem.price,
            quantity:      1,
            subtotal:      menuItem.price,
            term:          term || null,
            note:          null,
            servedKitchen: false,
            servedBar:     false,
            printed:       false
        }
    });
}

// ===== RENDER ORDER =====
function renderOrder(table) {
    const orderList = document.getElementById("order-list");
    const badge     = document.getElementById("order-count");
    if (!orderList) return;

    const totalItems = table.order.reduce((s, i) => s + i.quantity, 0);
    if (badge) badge.textContent = totalItems;

    const buildGroup = (items, buildFn) => items.map(buildFn).join("");

    // ── Panel móvil ──
    const mobilePanel = document.getElementById("mobile-order-panel");
    if (mobilePanel) {
        if (table.order.length === 0) {
            mobilePanel.innerHTML = "";
        } else {
            const t = table.order.filter(i => i.category === "tickets");
            const d = table.order.filter(i => i.category === "dishes");
            const b = table.order.filter(i => i.category === "drinks");
            const o = table.order.filter(i => i.category === "other");
            let mHtml = "";
            if (t.length > 0) { mHtml += `<div class="order-category-title">🥗 Entradas</div>`; mHtml += buildGroup(t, buildOrderItemHTMLMob); }
            if (d.length > 0) { mHtml += `<div class="order-category-title">🍖 Platos</div>`;   mHtml += buildGroup(d, buildOrderItemHTMLMob); }
            if (b.length > 0) { mHtml += `<div class="order-category-title">🥤 Bebidas</div>`;  mHtml += buildGroup(b, buildOrderItemHTMLMob); }
            if (o.length > 0) { mHtml += `<div class="order-category-title">🧆 Adiciones</div>`; mHtml += buildGroup(o, buildOrderItemHTMLMob); }
            mobilePanel.innerHTML = mHtml;

            mobilePanel.querySelectorAll(".btn-qty").forEach(btn => {
                btn.addEventListener("click", () => {
                    socket.emit("change-quantity", {
                        tableId:  table.id,
                        id:       parseInt(btn.getAttribute("data-id")),
                        category: btn.getAttribute("data-category"),
                        term:     btn.getAttribute("data-term") || null,
                        printed:  btn.getAttribute("data-printed") === "true",
                        action:   btn.getAttribute("data-action")
                    });
                });
            });
        }
    }

    if (table.order.length === 0) {
        orderList.innerHTML = "<p>No hay items aún</p>";
        ["order-subtotal","order-service","order-total"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "$0";
        });
        return;
    }

    const tickets = table.order.filter(i => i.category === "tickets");
    const dishes  = table.order.filter(i => i.category === "dishes");
    const drinks  = table.order.filter(i => i.category === "drinks");
    const others  = table.order.filter(i => i.category === "other");

    let html = "";
    if (tickets.length > 0) { html += `<div class="order-category-title">🥗 Entradas</div>`; html += buildGroup(tickets, buildOrderItemHTML); }
    if (dishes.length  > 0) { html += `<div class="order-category-title">🍖 Platos</div>`;   html += buildGroup(dishes,  buildOrderItemHTML); }
    if (drinks.length  > 0) { html += `<div class="order-category-title">🥤 Bebidas</div>`;  html += buildGroup(drinks,  buildOrderItemHTML); }
    if (others.length  > 0) { html += `<div class="order-category-title">🧆 Adiciones</div>`; html += buildGroup(others, buildOrderItemHTML); }

    orderList.innerHTML = html;

    const serviceCheck   = document.getElementById("service-check");
    const includeService = serviceCheck ? serviceCheck.checked : true;
    const subtotal       = table.order.reduce((s, i) => s + i.subtotal, 0);
    const service        = includeService ? Math.round(subtotal * 0.10) : 0;

    const sub = document.getElementById("order-subtotal");
    const srv = document.getElementById("order-service");
    const tot = document.getElementById("order-total");
    if (sub) sub.textContent = `$${subtotal.toLocaleString("es-CO")}`;
    if (srv) srv.textContent = `$${service.toLocaleString("es-CO")}`;
    if (tot) tot.textContent = `$${(subtotal + service).toLocaleString("es-CO")}`;

    orderList.querySelectorAll(".btn-qty").forEach(btn => {
        btn.addEventListener("click", () => {
            socket.emit("change-quantity", {
                tableId:  table.id,
                id:       parseInt(btn.getAttribute("data-id")),
                category: btn.getAttribute("data-category"),
                term:     btn.getAttribute("data-term") || null,
                printed:  btn.getAttribute("data-printed") === "true",
                action:   btn.getAttribute("data-action")
            });
        });
    });
}

// ===== BUILD ORDER ITEM HTML (desktop) =====
function buildOrderItemHTML(item) {
    const locked = item.printed;
    return `
    <div class="order-item ${locked ? 'order-item-printed' : ''}">
        <button class="btn-item-note ${item.note ? 'btn-item-note-active' : ''}"
            data-id="${item.id}" data-category="${item.category}"
            data-term="${item.term || ''}" data-printed="${locked}"
            title="${item.note || 'Agregar nota'}">📝</button>
        <span class="order-item-name">
            ${item.name}
            ${item.term ? `<span class="order-item-term">${item.term}</span>` : ""}
            ${locked ? `<span class="order-item-sent">✓</span>` : ""}
            ${item.note ? `<span class="order-item-note-text">(${item.note})</span>` : ""}
        </span>
        <div class="order-item-controls">
            <button class="btn-qty ${locked ? 'btn-qty-minus-printed' : ''}"
                data-id="${item.id}" data-category="${item.category}"
                data-term="${item.term || ''}" data-printed="${locked}" data-action="minus">−</button>
            <span>${item.quantity}</span>
            <button class="btn-qty ${locked ? 'btn-qty-locked' : ''}"
                data-id="${item.id}" data-category="${item.category}"
                data-term="${item.term || ''}" data-printed="${locked}" data-action="plus"
                ${locked ? 'disabled' : ''}>+</button>
        </div>
        <span class="order-item-subtotal">$${item.subtotal.toLocaleString("es-CO")}</span>
    </div>`;
}

// ===== BUILD ORDER ITEM HTML (móvil) =====
function buildOrderItemHTMLMob(item) {
    const locked = item.printed;
    return `
    <div class="order-item ${locked ? 'order-item-printed' : ''}">
        <button class="btn-item-note ${item.note ? 'btn-item-note-active' : ''}"
            data-id="${item.id}" data-category="${item.category}"
            data-term="${item.term || ''}" data-printed="${locked}"
            title="${item.note || 'Agregar nota'}">📝</button>
        <span class="order-item-name">
            ${item.name}
            ${item.term ? `<span class="order-item-term">${item.term}</span>` : ""}
            ${locked ? `<span class="order-item-sent">✓</span>` : ""}
            ${item.note ? `<span class="order-item-note-text">(${item.note})</span>` : ""}
        </span>
        <div class="order-item-controls">
            <button class="btn-qty ${locked ? 'btn-qty-minus-printed' : ''}"
                data-id="${item.id}" data-category="${item.category}"
                data-term="${item.term || ''}" data-printed="${locked}" data-action="minus">−</button>
            <span>${item.quantity}</span>
            <button class="btn-qty ${locked ? 'btn-qty-locked' : ''}"
                data-id="${item.id}" data-category="${item.category}"
                data-term="${item.term || ''}" data-printed="${locked}" data-action="plus"
                ${locked ? 'disabled' : ''}>+</button>
        </div>
    </div>`;
}