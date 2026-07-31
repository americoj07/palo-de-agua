import "./ventas.css";

const API = `http://${window.location.hostname}:3000/api/ventas`;

export function ventas(container) {
    // Usamos hora Bogotá (no UTC) para que el "día" no se adelante después de las 7pm
    const hoy    = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    const hace30 = new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

    container.innerHTML = `
    <div class="ventas-page">
        <div class="ventas-top">
            <h2>📈 Ventas</h2>
            <div class="ventas-tabs">
                <button class="ventas-tab active" data-tab="items">Items</button>
                <button class="ventas-tab" data-tab="ventas">Ventas</button>
                <button class="ventas-tab" data-tab="dia">Día</button>
            </div>
        </div>

        <div class="ventas-filtros" id="ventas-filtros">
            <label>Desde</label>
            <input type="date" id="v-desde" value="${hace30}" />
            <label>Hasta</label>
            <input type="date" id="v-hasta" value="${hoy}" />
            <button class="btn-buscar" id="btn-buscar">Buscar</button>
        </div>

        <div id="ventas-resumen" class="ventas-resumen"></div>
        <div id="ventas-cat-tabs" class="ventas-cat-tabs"></div>
        <div id="ventas-contenido"></div>
    </div>

    <!-- ===== MODAL FACTURA ===== -->
    <div class="factura-overlay hidden" id="factura-overlay">
        <div class="factura-modal">
            <div class="factura-modal-header">
                <h3>Vista previa de factura</h3>
                <button class="factura-close" id="factura-close">✕</button>
            </div>
            <div class="factura-body" id="factura-body"></div>
            <div class="factura-footer">
                <button class="btn-factura-cerrar"   id="btn-factura-cerrar">Cerrar</button>
                <button class="btn-factura-imprimir" id="btn-factura-imprimir">🖨️ Imprimir</button>
            </div>
        </div>
    </div>
    `;

    // ===== MODAL FACTURA =====
    const overlay = document.getElementById("factura-overlay");
    document.getElementById("factura-close").addEventListener("click",     () => overlay.classList.add("hidden"));
    document.getElementById("btn-factura-cerrar").addEventListener("click", () => overlay.classList.add("hidden"));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.add("hidden"); });

    document.getElementById("btn-factura-imprimir").addEventListener("click", () => {
        const body    = document.getElementById("factura-body").innerHTML;
        const ventana = window.open("", "_blank");
        ventana.document.write(`
            <html><head><title></title>
            <style>
                @page { margin: 0; size: 80mm auto; }
                @media print { html, body { margin: 0; padding: 0; } }
                body { font-family: monospace; max-width: 320px; margin: 0 auto; padding: 20px; font-size: 13px; }
                .f-titulo { text-align: center; font-weight: bold; font-size: 16px; margin-bottom: 4px; }
                .f-sub    { text-align: center; color: #555; margin-bottom: 2px; font-size: 12px; }
                .f-linea  { border-top: 1px dashed #999; margin: 8px 0; }
                .f-item   { display: flex; justify-content: space-between; margin: 3px 0; }
                .f-item-nombre { flex: 1; }
                .f-item-cant   { width: 30px; text-align: center; }
                .f-item-precio { width: 80px; text-align: right; }
                .f-total-row   { display: flex; justify-content: space-between; margin: 3px 0; }
                .f-gran-total  { font-weight: bold; font-size: 15px; }
                .f-centro      { text-align: center; margin-top: 8px; color: #555; font-size: 12px; }
            </style></head>
            <body>${body}<script>window.print(); window.onafterprint = () => window.close();<\/script>
            </body></html>
        `);
        ventana.document.close();
    });

    function mostrarFactura(mesa) {
        const fmt      = (n) => `$${Number(n || 0).toLocaleString("es-CO")}`;
        const hora     = mesa.cerrada_at || "—";
        const servicio = Number(mesa.servicio) > 0;

        const itemsHtml = mesa.items.map(item => `
            <div class="f-item">
                <span class="f-item-nombre">${item.nombre}</span>
                <span class="f-item-cant">x${item.cantidad}</span>
                <span class="f-item-precio">${fmt(item.subtotal)}</span>
            </div>
        `).join("");

        document.getElementById("factura-body").innerHTML = `
            <div class="f-titulo">PALO DE AGUA</div>
            <div class="f-sub">RESTAURANTE</div>
            <div class="f-sub">Cra 69 #73-91 | Tel: 300-4524371</div>
            <div class="f-linea"></div>
            <div class="f-sub">${hora}</div>
            <div class="f-linea"></div>
            <div class="f-item" style="font-weight:bold;">
                <span class="f-item-nombre">Descripción</span>
                <span class="f-item-cant">Cant</span>
                <span class="f-item-precio">Total</span>
            </div>
            <div class="f-linea"></div>
            ${itemsHtml}
            <div class="f-linea"></div>
            <div class="f-total-row">
                <span>Subtotal:</span>
                <span>${fmt(mesa.subtotal)}</span>
            </div>
            ${servicio ? `
            <div class="f-total-row">
                <span>Servicio (10%):</span>
                <span>${fmt(mesa.servicio)}</span>
            </div>` : ""}
            <div class="f-linea"></div>
            <div class="f-total-row f-gran-total">
                <span>TOTAL:</span>
                <span>${fmt(mesa.total)}</span>
            </div>
            <div class="f-linea"></div>
            <div class="f-centro">¡Gracias por su visita!</div>
        `;

        overlay.classList.remove("hidden");
    }

    // ===== TABS =====
    let tabActual  = "items";
    let catActual  = "all";
    let datosItems = [];

    const tabs = container.querySelectorAll(".ventas-tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            tabActual = tab.dataset.tab;
            catActual = "all";
            actualizarFiltros();
            cargar();
        });
    });

    container.querySelector("#btn-buscar").addEventListener("click", cargar);

    const fmt      = (n) => `$${Number(n || 0).toLocaleString("es-CO")}`;
    const fmtFecha = (d) => {
        const fecha = new Date(d);
        const dia   = String(fecha.getUTCDate()).padStart(2, "0");
        const mes   = String(fecha.getUTCMonth() + 1).padStart(2, "0");
        const anio  = fecha.getUTCFullYear();
        return `${dia}/${mes}/${anio}`;
    };

    function actualizarFiltros() {
        const filtrosEl = document.getElementById("ventas-filtros");
        const resumenEl = document.getElementById("ventas-resumen");

        if (tabActual === "dia") {
            filtrosEl.innerHTML = `
                <label>Selecciona el día</label>
                <input type="date" id="v-dia" value="${hoy}" />
                <button class="btn-buscar" id="btn-buscar">Buscar</button>
            `;
            resumenEl.innerHTML = "";
        } else {
            filtrosEl.innerHTML = `
                <label>Desde</label>
                <input type="date" id="v-desde" value="${hace30}" />
                <label>Hasta</label>
                <input type="date" id="v-hasta" value="${hoy}" />
                <button class="btn-buscar" id="btn-buscar">Buscar</button>
            `;
        }
        document.getElementById("btn-buscar").addEventListener("click", cargar);
    }

    async function cargar() {
        const contenido = document.getElementById("ventas-contenido");
        const resumenEl = document.getElementById("ventas-resumen");
        const catTabsEl = document.getElementById("ventas-cat-tabs");

        contenido.innerHTML = `<p class="loading">Cargando...</p>`;
        catTabsEl.innerHTML = "";

        // ===== TAB DÍA =====
        if (tabActual === "dia") {
            const dia   = document.getElementById("v-dia")?.value || hoy;
            resumenEl.innerHTML = "";

            const res   = await fetch(`${API}/mesas-dia?dia=${dia}`);
            const mesas = await res.json();

            if (!mesas.length) {
                contenido.innerHTML = `<p class="no-data">No hay mesas cerradas el ${fmtFecha(dia)}</p>`;
                return;
            }

            const totalRecaudado = mesas.reduce((s, m) => s + Number(m.total), 0);
            const totalServicio  = mesas.reduce((s, m) => s + Number(m.servicio), 0);
            const totalSubtotal  = mesas.reduce((s, m) => s + Number(m.subtotal), 0);

            resumenEl.innerHTML = `
                <div class="resumen-card"><span>🍽️ Mesas atendidas</span><strong>${mesas.length}</strong></div>
                <div class="resumen-card"><span>💰 Total recaudado</span><strong>${fmt(totalRecaudado)}</strong></div>
                <div class="resumen-card"><span>🤝 Servicio</span><strong>${fmt(totalServicio)}</strong></div>
                <div class="resumen-card"><span>📋 Sin servicio</span><strong>${fmt(totalSubtotal)}</strong></div>
            `;

            contenido.innerHTML = mesas.map((mesa, idx) => {
                const label = mesa.tipo === "llevar" ? "🥡 Llevar" : `Mesa ${mesa.mesa_numero}`;
                const hora  = mesa.cerrada_at || "—";
                return `
                <div class="dia-mesa-card">
                    <div class="dia-mesa-header">
                        <span class="dia-mesa-title">${label}</span>
                        <span class="dia-mesa-hora">🕐 ${hora}</span>
                        <div class="dia-mesa-btns">
                            <button class="btn-toggle-dia" data-idx="${idx}">Ver detalle ▼</button>
                            <button class="btn-reimprimir" data-idx="${idx}">🖨️ Reimprimir</button>
                        </div>
                    </div>
                    <div class="dia-mesa-totales">
                        <span>Subtotal: ${fmt(mesa.subtotal)}</span>
                        <span>Servicio: ${fmt(mesa.servicio)}</span>
                        <span class="dia-mesa-total">Total: ${fmt(mesa.total)}</span>
                    </div>
                    <div class="dia-mesa-detalle hidden" id="dia-detalle-${idx}">
                        ${mesa.items.map(item => `
                            <div class="dia-item">
                                <span>${item.nombre}</span>
                                <span>x${item.cantidad}</span>
                                <span>${fmt(item.subtotal)}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>`;
            }).join("");

            // Expandir/colapsar
            contenido.querySelectorAll(".btn-toggle-dia").forEach(btn => {
                btn.addEventListener("click", () => {
                    const idx     = btn.dataset.idx;
                    const detalle = document.getElementById(`dia-detalle-${idx}`);
                    const hidden  = detalle.classList.contains("hidden");
                    detalle.classList.toggle("hidden");
                    btn.textContent = hidden ? "Ocultar ▲" : "Ver detalle ▼";
                });
            });

            // Reimprimir
            contenido.querySelectorAll(".btn-reimprimir").forEach(btn => {
                btn.addEventListener("click", () => {
                    const mesa = mesas[Number(btn.dataset.idx)];
                    mostrarFactura(mesa);
                });
            });

            return;
        }

        // ===== TABS ITEMS y VENTAS =====
        const desde = document.getElementById("v-desde")?.value || hace30;
        const hasta = document.getElementById("v-hasta")?.value || hoy;

        try {
            const res = await fetch(`${API}/resumen?desde=${desde}&hasta=${hasta}`);
            const r   = await res.json();
            resumenEl.innerHTML = `
                <div class="resumen-card"><span>🍽️ Mesas atendidas</span><strong>${r.total_mesas || 0}</strong></div>
                <div class="resumen-card"><span>💰 Total recaudado</span><strong>${fmt(r.total_recaudado)}</strong></div>
                <div class="resumen-card"><span>🤝 Servicio</span><strong>${fmt(r.total_servicio)}</strong></div>
                <div class="resumen-card"><span>📋 Sin servicio</span><strong>${fmt(r.total_subtotal)}</strong></div>
            `;
        } catch { resumenEl.innerHTML = ""; }

        if (tabActual === "items") {
            const res  = await fetch(`${API}/items?desde=${desde}&hasta=${hasta}`);
            datosItems = await res.json();
            renderCatTabs(catTabsEl);
            renderItems(contenido);

        } else if (tabActual === "ventas") {
            const res  = await fetch(`${API}/dia?desde=${desde}&hasta=${hasta}`);
            const rows = await res.json();
            catTabsEl.innerHTML = "";
            if (!rows.length) { contenido.innerHTML = `<p class="no-data">Sin datos en ese rango</p>`; return; }
            contenido.innerHTML = `
                <table class="ventas-tabla">
                    <thead><tr>
                        <th>#</th><th>Fecha</th><th>Mesas</th>
                        <th>Total recaudado</th><th>Servicio</th><th>Sin servicio</th>
                    </tr></thead>
                    <tbody>
                        ${rows.map((r, i) => `
                        <tr>
                            <td class="rank">${i + 1}</td>
                            <td>${fmtFecha(r.dia)}</td>
                            <td>${r.total_mesas}</td>
                            <td>${fmt(r.total_recaudado)}</td>
                            <td>${fmt(r.total_servicio)}</td>
                            <td>${fmt(r.sin_servicio)}</td>
                        </tr>`).join("")}
                    </tbody>
                </table>
            `;
        }
    }

    function renderCatTabs(el) {
        el.innerHTML = `
            <button class="ventas-cat-tab ${catActual==="all"     ? "active":""}" data-cat="all">Todos</button>
            <button class="ventas-cat-tab ${catActual==="dishes"  ? "active":""}" data-cat="dishes">🍽️ Platos</button>
            <button class="ventas-cat-tab ${catActual==="drinks"  ? "active":""}" data-cat="drinks">🍺 Bebidas</button>
            <button class="ventas-cat-tab ${catActual==="tickets" ? "active":""}" data-cat="tickets">🧺 Entradas</button>
            <button class="ventas-cat-tab ${catActual==="other"   ? "active":""}" data-cat="other">➕ Adiciones</button>
        `;
        el.querySelectorAll(".ventas-cat-tab").forEach(btn => {
            btn.addEventListener("click", () => {
                catActual = btn.dataset.cat;
                renderCatTabs(el);
                renderItems(document.getElementById("ventas-contenido"));
            });
        });
    }

    function renderItems(el) {
        const datos = catActual === "all" ? datosItems : datosItems.filter(r => r.categoria === catActual);
        if (!datos.length) { el.innerHTML = `<p class="no-data">Sin datos</p>`; return; }
        el.innerHTML = `
            <table class="ventas-tabla">
                <thead><tr>
                    <th>#</th><th>Nombre</th><th>Categoría</th>
                    <th>Cantidad vendida</th><th>Total ingresos</th>
                </tr></thead>
                <tbody>
                    ${datos.map((r, i) => `
                    <tr>
                        <td class="rank">${i + 1}</td>
                        <td>${r.nombre}</td>
                        <td><span class="cat-badge cat-${r.categoria}">${r.categoria}</span></td>
                        <td>${Number(r.total_vendido).toLocaleString("es-CO")}</td>
                        <td>${fmt(r.total_ingresos)}</td>
                    </tr>`).join("")}
                </tbody>
            </table>
        `;
    }

    cargar();
}