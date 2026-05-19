import "./ventas.css";

const API = "http://localhost:3000/api/ventas";

export function ventas(container) {
    const hoy = new Date().toISOString().slice(0, 10);
    const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

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
    `;

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

    const fmt = (n) => `$${Number(n || 0).toLocaleString("es-CO")}`;

    const fmtFecha = (d) => {
        const fecha = new Date(d);
        const dia  = String(fecha.getUTCDate()).padStart(2, "0");
        const mes  = String(fecha.getUTCMonth() + 1).padStart(2, "0");
        const anio = fecha.getUTCFullYear();
        return `${dia}/${mes}/${anio}`;
    };

    function actualizarFiltros() {
        const filtrosEl = document.getElementById("ventas-filtros");
        const resumenEl = document.getElementById("ventas-resumen");

        if (tabActual === "dia") {
            // Solo un selector de fecha
            filtrosEl.innerHTML = `
                <label>Selecciona el día</label>
                <input type="date" id="v-dia" value="${hoy}" />
                <button class="btn-buscar" id="btn-buscar">Buscar</button>
            `;
            resumenEl.innerHTML = "";
        } else {
            // Rango de fechas normal
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

        // ===== TAB DÍA — selector único =====
        if (tabActual === "dia") {
            const dia = document.getElementById("v-dia")?.value || hoy;
            resumenEl.innerHTML = "";

            const res  = await fetch(`${API}/mesas-dia?dia=${dia}`);
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
                const hora  = new Date(mesa.cerrada_at).toLocaleString("es-CO");
                return `
                <div class="dia-mesa-card">
                    <div class="dia-mesa-header">
                        <span class="dia-mesa-title">${label}</span>
                        <span class="dia-mesa-hora">🕐 ${hora}</span>
                        <button class="btn-toggle-dia" data-idx="${idx}">Ver detalle ▼</button>
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

            // Eventos expandir/colapsar
            contenido.querySelectorAll(".btn-toggle-dia").forEach(btn => {
                btn.addEventListener("click", () => {
                    const idx    = btn.dataset.idx;
                    const detalle = document.getElementById(`dia-detalle-${idx}`);
                    const hidden  = detalle.classList.contains("hidden");
                    detalle.classList.toggle("hidden");
                    btn.textContent = hidden ? "Ocultar ▲" : "Ver detalle ▼";
                });
            });
            return;
        }

        // ===== TABS ITEMS y VENTAS — rango de fechas =====
        const desde = document.getElementById("v-desde")?.value || hace30;
        const hasta = document.getElementById("v-hasta")?.value || hoy;

        // Resumen siempre visible en items y ventas
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
                        <th>#</th>
                        <th>Fecha</th>
                        <th>Mesas</th>
                        <th>Total recaudado</th>
                        <th>Servicio</th>
                        <th>Sin servicio</th>
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
            <button class="ventas-cat-tab ${catActual === "all"     ? "active" : ""}" data-cat="all">Todos</button>
            <button class="ventas-cat-tab ${catActual === "dishes"  ? "active" : ""}" data-cat="dishes">🍽️ Platos</button>
            <button class="ventas-cat-tab ${catActual === "drinks"  ? "active" : ""}" data-cat="drinks">🍺 Bebidas</button>
            <button class="ventas-cat-tab ${catActual === "tickets" ? "active" : ""}" data-cat="tickets">🧺 Entradas</button>
            <button class="ventas-cat-tab ${catActual === "other"   ? "active" : ""}" data-cat="other">➕ Adiciones</button>
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
                    <th>#</th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Cantidad vendida</th>
                    <th>Total ingresos</th>
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