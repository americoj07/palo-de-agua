const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const cors       = require("cors");
const fs         = require("fs");
const path       = require("path");

// ================================================================
// ===== BASE DE DATOS MySQL (archivo separado: db.js) =============
// ================================================================
// Si MySQL no está disponible, el sistema sigue funcionando igual.
// Solo se perderá el historial de ventas en la BD.
let db = null;
try {
    db = require("./db");
    console.log("✅ Módulo db.js cargado — MySQL habilitado");
} catch (e) {
    console.warn("⚠️  db.js no encontrado — sistema funciona sin MySQL");
}
// ================================================================

// ================================================================
// ===== SISTEMA DE PERSISTENCIA (proteccion ante apagones) ========
// ================================================================
const STORE_FILE = path.join(__dirname, "store.json");

function saveStore() {
    try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
    } catch (e) {
        console.error("\u274c Error guardando store.json:", e.message);
    }
}

function loadStore() {
    try {
        if (fs.existsSync(STORE_FILE)) {
            const raw  = fs.readFileSync(STORE_FILE, "utf8");
            const data = JSON.parse(raw);
            console.log("\u2705 Store recuperado desde store.json");
            console.log("   \u2514\u2500 Mesas abiertas  :", data.tables?.length ?? 0);
            console.log("   \u2514\u2500 Mesas cerradas  :", data.closedTables?.length ?? 0);
            console.log("   \u2514\u2500 Propinas        : $" + (data.totalTips ?? 0).toLocaleString());
            return data;
        }
    } catch (e) {
        console.error("\u274c Error cargando store.json (se inicia desde cero):", e.message);
    }
    return null;
}
// ================================================================

const MODO_SIMULACION = false;

function simularImpresion(lineas) {
    const borde = "╔════════════════════════════════╗";
    const fin   = "╚════════════════════════════════╝";
    console.log("\n" + borde);
    lineas.forEach(l => console.log("║ " + String(l).substring(0, 30).padEnd(30) + " ║"));
    console.log(fin + "\n");
}

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(cors());
app.use(express.json());

// ✅ Carga el estado guardado o empieza desde cero
const savedStore = loadStore();
const store = savedStore ?? { tables: [], closedTables: [], totalTips: 0 };

// ===== COMANDOS ESC/POS MANUALES =====
const ESC = 0x1B;
const GS  = 0x1D;

const CMD = {
    init:              Buffer.from([ESC, 0x40]),
    alignLeft:         Buffer.from([ESC, 0x61, 0x00]),
    alignCenter:       Buffer.from([ESC, 0x61, 0x01]),
    bold:              Buffer.from([ESC, 0x45, 0x01]),
    boldOff:           Buffer.from([ESC, 0x45, 0x00]),
    cut:               Buffer.from([GS,  0x56, 0x41, 0x03]),
    lf:                Buffer.from([0x0A]),
    fontSize:          Buffer.from([GS,  0x21, 0x01]),
    fontNormal:        Buffer.from([GS,  0x21, 0x00]),
    lineSpacingWide:   Buffer.from([ESC, 0x33, 60]),
    lineSpacingNormal: Buffer.from([ESC, 0x32]),
};

function textBuf(str) {
    return Buffer.from(str + "\n", "latin1");
}

// ===== LOGO IMPRESORA (ESC/POS raster, 384px) =====
const LOGO_B64 = "HXYwADAAiAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///////gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP///////4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///8AD//+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH//4AAAH//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/8AAAAA//gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB//gAAYAAPfwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/8AAPwAADv4AAAAAfwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/wAA/gAAB38AAAAA/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//AAD/AAAA78AAAAD/4AAAAAAAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/8AAP/AAAA7+AAAAH/4AAAAAAAAAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/wAA/+AAAAd+AAAAP/4AAAAAAAAAAH/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/AAB/8AAAAd+AAAAf/4AAAAAAAAAAP/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf+AAD/8AAAAN+AAAA/34AAAAAAAAAAe/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8AAB/4AAAAN+AAAA/v4AAAAAAAAAA/+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/wAAA/4AAAAN+AAAB/PwAAAAAAAAAB9+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/gAAA/4AAAAN+AAAD+PwAAAAAAAAAB/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/AAAA/wAAAAN+AAAH8fwAAAAAAAAAD78AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH+AAAA/wAAAAP+AAAP4fgAAAAAAAAAD/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAB/gAAAAf+AAAPw/gAAAAAAAAAH3wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf8AAAB/gAAAAf8AAAfw/AAAAAAAAAAH/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/4AAAB/gAAAAf8AAA/h/AAAAAAAAAAHvgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAAB/AAAAA/8AAA/D+AAAAAAAAAAP/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/wAAAD/AAAAB/4AAB+D8AAAAAAAAAAPfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/gAAAD/AAAAB/wAAD+H8AAAAAAAAAAf+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB3gAAAD+AAAAD/wAAD8P4AAAAAAAAAAe+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD3gAAAH+AAAAH/gAAH4PwAAAAAAAAAAf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD3gAAAH+AAAAP/AAAH4fwAAAAAAAAAA/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/gAAAH8AAAAf+AAAPw/gAAAAAAAAAA/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/AAAAP8AAAB/8AAAfh/AAAAAAAAAAB/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/gAAAP8AAAD/wAAAfj+AAAAAAAAAAB/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/gAAAP4AAAP/gAHg/H8AAB8ACAAAHx/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH3gAAAf4AAA//AAfg/P8AAH//+AAAP7/gAA8AAAAAAAfAAD/AAAAAAAHgAAAAAAAH3gAAAf4AAB/8AA/x+f4AAf//8AAA///AAH/AAAAAAA/AAP/gAAAAAAPgAAAAAAAH3wAAAfwAAH/4AB/h8/wAA///4AAB//+AAf/gAAAAAD/AAf/gQAGAAAfgAAAAAAAH3wAAA/wAAf/gAD/j9/gAB///gAAD//+AB//gAAAAAH/AB//j8AfAAA/gAAAAAAAH74AAA/gAD/+AD7/D7/AAD///gAAP//8AD//gAAAAHn/AD//n8A/AB9/gAAAAAAAD78AAA/gAP/4AP//H/+AAH//8AAAf//8AH//gAAAAf/+AH//v8A/AH//gAAAAAAAD9/AAB/gB//gA//+H/8AAP//gAAA///4AP+fgAAAB//+AP//f8B+AP//AAAAAAAAD+/wAB/AH/8AD//8P/4AAf9/AAAB/8f4Af4/gAAAD//8Af9//8D+Af//AAAAAAAAB/f/8D/A//wAH//8P/wAA/x/AAAD/4/wA/x/AAAAP//8A/x//4D8B//+AAAAAAAAB/3/8D+H/+AAf//4f/gAA/h+AAAH/g/wB/j+AAAAf//4B/h//4H8D/f8AAAAAAAAA///4D+f/4AA/5/wf/AAB/D+AAAP/B/gD/H+AAAB/z/wD/B/nwH8H8f8AAAAAAAAAf//wH+//AAB/h/g/+AAD+D+AAAf+B/gH+P8AAAD/H/gH+D8PwP4P4f4AAAAAAAAAP//gH8/4AAH+D/A/8AAH8H8AAA/8D/gP8f4AAAH8H/AP8H8fgP4fw/wAAAAAAAAAH//AP8/AAAP8D+A/4AAH4H8AAB/wH/AP4/wAAAP4P+Af4P4fgfw/g/gAAAAAAAAAD/+AP4wAAAf4H+B/wAAP4P4AAD/gP/Afx/gAAA/wP8A/wf4/A/x/B/gAAAAAAAAAAfwAf4AAAA/wP8B/gAAfwP4AAD/Af+A/n/AAAB/gf4B/g/w/B/j+B/AAAAAAAAAAAAAAfwAAAB/gf8B/gAAfwf4AAH+A/+A/v+AAAD/A/4D/B/x+B/j8D+AAAAAAAAAAAAAA/wAAAD/A/4B/AAA/g/wAAP+B/+B/f4AAAH+B/wH+D/h+D/H4H+AAAAAAAAAAAAAA/gAAAH+B/4B/AAB/g/gAAf8D/+B//wAwAP8D/wH8H/h8H/PwP8AAAAAAAAAAAAAB/gAAAP8D/4D+AAH/B/gAAf4H98D//gBgAf4H/gP4f/j8P+fwf8AAAAAAAAAAAAAD/AAAAf4P/4D+AAP/D/AAA/wf78D/+AHgA/wf/gfw//D4f+fg/8AAAAAAAAAAAAAD/AAAAf4//wD+AA//H/AAB/w/z8D/8APAA/g//g/3//H4/+/D/8AAAAAAAAAAAAAH+AAAA/z/vwD/AD//P+AAB/j/j8D/wA+AB/j+fA//++H/99/H78AAAAAAAAAAAAAP+AAAA///P4D/gf//f8AAB///D8D/gH8AD//8/A//9+H/99/fz+AAAAAAAAAAGAAP8AAAB//+P4B///5//4AAD//+D+D/7/4AD//4/B//5+P/59//j/AAAAAAAAAAMAAf8AAAB//4P8B///x//wAAD//8D+D///wAH//w/h//j8P/x///D/+AAAAAAAAAcAA/4AAAB//wH+B///B//gAAD//wD/D///gAH//A/w//D8P/h//8B/+AAAAAAAAAcAB/wAAAB//gH/4//8B//AAAD//gB/5///AAH/+Af8/8H4H/A7/4Af8AAAAAAAAA4AD/wAAAB/+AD/4//wA/+AAAD/+AB/9//8AAH/4Af//wH4D8AB/gHP4AAAAAAAAA4AH/gAAAA/4AB/gP/AAf4AAAB/4AA/4f/wAAD/gAP/gAPwAAAAcB///////8AAAB4AP/AAAAAAAAAeADwAAHgAAAA/gAAfwH8AAAA8AAH/AAPwAAAAAH///////+AAAB4Af+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPwAAAAAf///////8AAAB4A/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAfgAAAAB/AAAAAAAAAAAB4D/8AA//gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOAAAAAfgAAAAD+AAAAAAAAAAAD8P/4AH//////AAAAAAAAAAAAAAAAAAAAAAAAAAcAAAAA/AAAAAf4D//////wAAAD///wAP//////////////////4AAAAAAAAAAAAA9////+///////wD//////+AAAD///gAf///////////////////////////////97/////+//////AB//////8AAAD///AA/////////////////////////////////3////9//////8AAAAAAAAAAAAB//+AB/////////////////////////////////3/////+kAAH+AAAAAAAAAAAAAB//8AD//////////////8AAAAAAAAAAAAAAAAAPv////79/////+AB//AAAAAAAAA//wAD////////////////////////////////f/////3///////gD//////8AAAAf/gAD////////////////////////////////ff////v7//////wD//////+AAAAP+AAD///////////////////////////////+/f////v///////8A//////8AAAAAAAAD///////////////////////////////+//////fwAAAAA/+AAAAAAAAAAAAAAAAD///////////////////////////////9+QAAAA/wAAAAAf/wAAAAAAAAAAAAAAAB////////AAAAAAAAAAAAAAAAAAAAAAAB+AAAAB/gAAAAAP////////8AAAAAAAAB/////4AAAAAAAAAAAAAAAAAAAAAAAAAB+AAAAB/gAAAAAH////////+AAAAAAAAA////4AAAAAAAAADjwAAAAAAAAAAAAAAD+AAAAD/AAAAAAB////////4AAAAAAAAAf//8AAAAAAAAAAPvwAAAAAAAAAAAAAAD+AAAAH+AAAAAAAP/wAAAAAAAAAAAAAAAH//gAAAAAAAAAAYcAAAAAAAAAAAAAAAD+AAAAP+AAAAAAAAAAAAAAAAAAAAAAAAAB/4AAB8AAAAAAAwYAAAAAAAAAAAAAAAD/AAAAf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/AAAAAAgwwAAAAAAAAAAAAAAAD/AAAA/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/jgAAAABxgwAAAAAAAAAAAAAAAD3AAAB/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAABzhwAAAADhhgAAAAAAAAAAAAACAB3gAAD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAADDhwAAAADDhgAAAAAAAAAAAAAGAB7wAAH3gAAAAAAAAAAAAAAAAAAAAAAAAAAAAADDhwAAAAADhgAAAAAAAAAAAAAGAB74AAfPAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADDhj4c5znDDgfgA+Hxhznc5wOf4A9+AB++AAAAAAAAAAAAAAAAAAAAAAAAAAAAAADDjn8973vDDg/gB+Pzhnv97wffwA+/wP98AAAAAAAAAAAAAAAAAAAAAAAAAAAAAADDHMZvW9bDDBjADGY9hl7vewzOAAfP//z4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+YZOE4XHDDDAGGY5hhwOcxiMAAfn//PwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHwY4cBwHHDDDAGOw5jjgccxmMAAP4/4fgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHA44cBwGGDHHAOOwxjjgc4z8MAAH+AD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHAx4cBwGGHGPAMewznDgY5zwcAAD///+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAz2YBgGm3WOQM8wzvbAYxnjdgAA///4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOA+0YBgPnn32wPs5j7zAYx/mdAAAf//gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/w884BgPHnn3gPM/DzjAYx58fAAAD/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/gYwQBAGGDDGAGMcBjCAQgg4MAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
function logoBuffer() {
    return Buffer.from(LOGO_B64, "base64");
}

// ===== CLASE IMPRESORA SIMPLE =====
class PosPrinter {
    constructor() {
        this.buffers = [CMD.init];
    }

    center()             { this.buffers.push(CMD.alignCenter);       return this; }
    left()               { this.buffers.push(CMD.alignLeft);         return this; }
    bold()               { this.buffers.push(CMD.bold);              return this; }
    boldOff()            { this.buffers.push(CMD.boldOff);           return this; }
    text(str)            { this.buffers.push(textBuf(str));          return this; }
    feed(n = 1)          { for (let i = 0; i < n; i++) this.buffers.push(CMD.lf); return this; }
    cut()                { this.buffers.push(CMD.cut);               return this; }
    fontSize()           { this.buffers.push(CMD.fontSize);          return this; }
    fontNormal()         { this.buffers.push(CMD.fontNormal);        return this; }
    lineSpacingWide()    { this.buffers.push(CMD.lineSpacingWide);   return this; }
    lineSpacingNormal()  { this.buffers.push(CMD.lineSpacingNormal); return this; }

    build() {
        return Buffer.concat(this.buffers);
    }
}

// ===== ENVIAR A IMPRESORA USB =====
// ✅ FIX: delay de 120ms para que el driver USB esté estable antes de abrir
//    el dispositivo — evita que la primera impresión salga en blanco / cortada.
function imprimirBuffer(data) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            let device, iface;
            try {
                const { findByIds } = require("usb");

                device = findByIds(0x0471, 0x0055);
                if (!device) {
                    return reject(new Error("Impresora no encontrada. Verifica que esté enchufada."));
                }

                device.open();

                device.setConfiguration(1, (errCfg) => {
                    if (errCfg) {
                        try { device.close(); } catch(e) {}
                        return reject(new Error("Error al configurar dispositivo: " + errCfg.message));
                    }

                    iface = device.interfaces[0];

                    try {
                        iface.claim();
                    } catch(e) {
                        try { device.close(); } catch(e2) {}
                        return reject(new Error("Error al reclamar interfaz: " + e.message));
                    }

                    const endpoint = iface.endpoints.find(e => e.direction === "out" && e.transferType === 2);
                    if (!endpoint) {
                        iface.release(true, () => { try { device.close(); } catch(e) {} });
                        return reject(new Error("No se encontró endpoint bulk OUT en la impresora."));
                    }

                    endpoint.transfer(data, (err) => {
                        iface.release(true, () => {
                            try { device.close(); } catch(e) {}
                        });
                        if (err) return reject(new Error("Error al enviar datos: " + err.message));
                        resolve();
                    });
                });

            } catch (e) {
                try { if (device) device.close(); } catch(e2) {}
                reject(new Error("Error USB: " + e.message));
            }
        }, 120); // ← 120ms de estabilización USB
    });
}

// ===== HELPER NOTAS =====
function partirTexto(texto, max) {
    const palabras = texto.split(" ");
    const lineas   = [];
    let buf = "";
    palabras.forEach(p => {
        if ((buf + " " + p).trim().length <= max) {
            buf = (buf + " " + p).trim();
        } else {
            if (buf) lineas.push(buf);
            buf = p;
        }
    });
    if (buf) lineas.push(buf);
    return lineas;
}

const COCINA_CATS = ["tickets", "dishes", "other"];
const BARRA_CATS  = ["drinks"];

// ================================================================
// ===== RUTAS API — Estadísticas MySQL ============================
// ================================================================
app.get("/api/stats", async (req, res) => {
    if (!db) return res.json({ ok: false, error: "MySQL no configurado" });
    try {
        const dias      = parseInt(req.query.dias) || 30;
        const categoria = req.query.categoria      || "all";
        const datos     = await db.obtenerEstadisticas(dias, categoria);
        res.json({ ok: true, dias, categoria, datos });
    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});

app.get("/api/stats/mes", async (req, res) => {
    if (!db) return res.json({ ok: false, error: "MySQL no configurado" });
    try {
        const mesAnio = req.query.mes || null;
        const resumen = await db.obtenerResumenMes(mesAnio);
        res.json({ ok: true, resumen });
    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});

// ================================================================
// ===== RUTAS API — Vista Ventas (admin) ==========================
// ================================================================
app.get("/api/ventas/items", async (req, res) => {
    if (!db) return res.json({ error: "MySQL no disponible" });
    const { desde, hasta } = req.query;
    try {
        const [rows] = await db.pool.execute(
            `SELECT vi.nombre, vi.categoria,
                SUM(vi.cantidad) AS total_vendido,
                SUM(vi.subtotal) AS total_ingresos
             FROM ventas_items vi
             JOIN ventas v ON v.id = vi.venta_id
             WHERE DATE(v.cerrada_at) BETWEEN ? AND ?
             GROUP BY vi.nombre, vi.categoria
             ORDER BY total_vendido DESC`,
            [desde || "2000-01-01", hasta || "2099-12-31"]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/ventas/resumen", async (req, res) => {
    if (!db) return res.json({ error: "MySQL no disponible" });
    const { desde, hasta } = req.query;
    try {
        const [[r]] = await db.pool.execute(
            `SELECT
                COUNT(DISTINCT id)        AS total_mesas,
                COALESCE(SUM(total),0)    AS total_recaudado,
                COALESCE(SUM(servicio),0) AS total_servicio,
                COALESCE(SUM(subtotal),0) AS total_subtotal
             FROM ventas
             WHERE DATE(cerrada_at) BETWEEN ? AND ?`,
            [desde || "2000-01-01", hasta || "2099-12-31"]
        );
        res.json(r);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/ventas/dia", async (req, res) => {
    if (!db) return res.json({ error: "MySQL no disponible" });
    const { desde, hasta } = req.query;
    try {
        const [rows] = await db.pool.execute(
            `SELECT DATE(cerrada_at) AS dia,
                COUNT(*)         AS total_mesas,
                SUM(total)       AS total_recaudado,
                SUM(servicio)    AS total_servicio,
                SUM(subtotal)    AS sin_servicio
             FROM ventas
             WHERE DATE(cerrada_at) BETWEEN ? AND ?
             GROUP BY DATE(cerrada_at) ORDER BY dia DESC`,
            [desde || "2000-01-01", hasta || "2099-12-31"]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/ventas/mesas-dia", async (req, res) => {
    if (!db) return res.json({ error: "MySQL no disponible" });
    const { dia } = req.query;
    try {
        const [ventas] = await db.pool.execute(
            `SELECT id, tipo, mesa_numero, subtotal, servicio, total, cerrada_at
             FROM ventas
             WHERE DATE(cerrada_at) = ?
             ORDER BY id DESC`,
            [dia || new Date().toISOString().slice(0, 10)]
        );
        if (ventas.length > 0) {
            const ids = ventas.map(v => v.id);
            const placeholders = ids.map(() => "?").join(",");
            const [items] = await db.pool.execute(
                `SELECT venta_id, nombre, categoria, cantidad, precio_unit, subtotal
                 FROM ventas_items
                 WHERE venta_id IN (${placeholders})`,
                ids
            );
            ventas.forEach(v => {
                v.items = items.filter(i => i.venta_id === v.id);
            });
        }
        res.json(ventas);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
// ================================================================

io.on("connection", (socket) => {
    console.log("Dispositivo conectado:", socket.id);
    socket.emit("store-update", store);

    // ===== GUARDAR NOTAS =====
    const notesTimers = {};
    socket.on("save-notes", ({ tableId, notes }) => {
        const table = store.tables.find(t => t.id === tableId && t.status === "open");
        if (!table) return;
        table.notes = notes;
        clearTimeout(notesTimers[tableId]);
        notesTimers[tableId] = setTimeout(() => {
            saveStore();
            io.emit("store-update", store);
        }, 800);
    });

    // ===== NOTA DE ITEM =====
    socket.on("set-item-note", ({ tableId, id, category, term, printed, note }) => {
        const table = store.tables.find(t => t.id === tableId && t.status === "open");
        if (!table) return;
        const item = table.order.find(o =>
            o.id === id && o.category === category &&
            (o.term || "") === (term || "") && o.printed === printed
        );
        if (!item) return;
        item.note = note || null;
        saveStore();
        io.emit("store-update", store);
    });

    // ===== IMPRIMIR TICKET (FACTURA) =====
    socket.on("print-ticket", async ({ table, subtotal, service, total, includeService }) => {
        const linea = "--------------------------------";
        const label = table.type === "llevar" ? "Para llevar" : "Mesa " + table.id;

        if (MODO_SIMULACION) {
            const lineas = ["   PALO DE AGUA RESTAURANTE", table.createdAt, linea, label, linea];
            lineas.push("Cant Descripcion           P.uni    P.total");
            lineas.push(linea);
            const agSim = [];
            table.order.forEach(item => {
                const ex = agSim.find(a => a.name === item.name && a.price === item.price);
                if (ex) { ex.quantity += item.quantity; ex.subtotal += item.subtotal; }
                else agSim.push({ name: item.name, price: item.price, quantity: item.quantity, subtotal: item.subtotal });
            });
            agSim.forEach(item => {
                const pUni = item.price > 0 ? item.price.toLocaleString("es-CO") : "";
                const pTot = item.subtotal.toLocaleString("es-CO");
                lineas.push(("x"+item.quantity).padEnd(5) + item.name.substring(0,18).padEnd(18) + pUni.padStart(8) + pTot.padStart(9));
            });
            lineas.push(linea);
            lineas.push("Subtotal:        $" + subtotal.toLocaleString("es-CO"));
            if (includeService) lineas.push("Servicio (10%):  $" + service.toLocaleString("es-CO"));
            lineas.push(linea);
            lineas.push("TOTAL: $" + total.toLocaleString("es-CO"));
            lineas.push(linea);
            lineas.push("   Gracias por su visita!");
            lineas.push("   Vuelva pronto :)");
            console.log("\n[SIMULACION] IMPRIMIENDO TICKET...");
            simularImpresion(lineas);
            socket.emit("print-success");
            return;
        }

        try {
            const p = new PosPrinter();

            // ✅ FIX LOGO: feed antes del logo para que la impresora esté lista,
            //    y feed después para separarlo del texto. Sin estos feeds el logo
            //    se descarta porque la impresora aún está procesando el init.
            p.feed(1);
            p.buffers.push(CMD.alignCenter);
            p.buffers.push(logoBuffer());
            p.feed(1);

            p.center().bold()
             .text("PALO DE AGUA")
             .text("RESTAURANTE")
             .boldOff()
             .text("Cra 69 #73-91")
             .text("Tel: 300-4524371")
             .text(linea)
             .text(table.createdAt)
             .text(linea);

            const COL_CANT = 4;
            const COL_DESC = 22;
            const COL_PUNI = 10;
            const COL_PTOT = 10;

            function padR(str, n) { return String(str).substring(0, n).padEnd(n); }
            function padL(str, n) { return String(str).substring(0, n).padStart(n); }

            const encabezado =
                padR("Cant", COL_CANT) +
                padR("Descripcion", COL_DESC) +
                padL("P.uni", COL_PUNI) +
                padL("P.total", COL_PTOT);

            p.left().bold().text(encabezado).boldOff().text(linea);

            const agrupados = [];
            table.order.forEach(item => {
                const existing = agrupados.find(a => a.name === item.name && a.price === item.price);
                if (existing) {
                    existing.quantity += item.quantity;
                    existing.subtotal += item.subtotal;
                } else {
                    agrupados.push({
                        name:     item.name,
                        price:    item.price,
                        quantity: item.quantity,
                        subtotal: item.subtotal
                    });
                }
            });

            agrupados.forEach(item => {
                const pUni  = item.price > 0  ? item.price.toLocaleString("es-CO")    : "";
                const pTot  = item.subtotal.toLocaleString("es-CO");
                const cant  = "x" + item.quantity;
                const nombreLineas = partirTexto(item.name, COL_DESC);

                nombreLineas.forEach((lineaNombre, i) => {
                    if (i === 0) {
                        const fila =
                            padR(cant, COL_CANT) +
                            padR(lineaNombre, COL_DESC) +
                            padL(pUni, COL_PUNI) +
                            padL(pTot, COL_PTOT);
                        p.left().text(fila);
                    } else {
                        const fila =
                            padR("", COL_CANT) +
                            padR(lineaNombre, COL_DESC) +
                            padL("", COL_PUNI) +
                            padL("", COL_PTOT);
                        p.left().text(fila);
                    }
                });
            });

            p.text(linea);
            const lblSubtotal = "Subtotal:";
            const valSubtotal = "$" + subtotal.toLocaleString("es-CO");
            p.left().text(lblSubtotal.padEnd(32) + valSubtotal.padStart(16));
            if (includeService) {
                const lblServicio = "Servicio (10%):";
                const valServicio = "$" + service.toLocaleString("es-CO");
                p.left().text(lblServicio.padEnd(32) + valServicio.padStart(16));
            }
            p.text(linea)
             .center().bold()
             .text("TOTAL: $" + total.toLocaleString("es-CO"))
             .boldOff()
             .text(linea)
             .text("Gracias por su visita!")
             .text("Vuelva pronto :)")
             .feed(3).cut();

            await imprimirBuffer(p.build());
            console.log(" Ticket impreso correctamente");
            socket.emit("print-success");
        } catch (e) {
            console.error("Error impresora (ticket):", e.message);
            socket.emit("print-error", e.message);
        }
    });

    // ===== IMPRIMIR PEDIDO =====
    socket.on("print-order", async ({ table, notes }) => {
        const linea      = "--------------------------------";
        const label      = table.type === "llevar" ? "Para llevar" : "Mesa " + table.id;

        const tableReal  = store.tables.find(t => t.id === table.id && t.status === "open");
        const foodItems  = (tableReal || table).order.filter(i => COCINA_CATS.includes(i.category) && !i.printed);
        const drinkItems = (tableReal || table).order.filter(i => BARRA_CATS.includes(i.category) && !i.printed);
        const notaTexto  = notes && notes.trim() ? notes.trim() : null;

        if (foodItems.length === 0 && drinkItems.length === 0) {
            socket.emit("print-error", "No hay items nuevos para imprimir. Todo ya fue enviado.");
            return;
        }

        if (MODO_SIMULACION) {
            if (foodItems.length > 0) {
                const lineas     = ["          COCINA", new Date().toLocaleString("es-CO"), linea, label, linea];
                const tickets = foodItems.filter(i => i.category === "tickets");
                const dishes  = foodItems.filter(i => i.category === "dishes");
                const others  = foodItems.filter(i => i.category === "other");
                if (tickets.length > 0) {
                    lineas.push("ENTRADAS:");
                    tickets.forEach(item => {
                        lineas.push("  x" + item.quantity + " " + item.name);
                        if (item.note) lineas.push("    (" + item.note + ")");
                    });
                    lineas.push(linea);
                }
                if (dishes.length > 0) {
                    lineas.push("PLATOS:");
                    dishes.forEach(item => {
                        const term = item.term ? " [" + item.term + "]" : "";
                        lineas.push("  x" + item.quantity + " " + item.name + term);
                        if (item.note) lineas.push("    (" + item.note + ")");
                    });
                    lineas.push(linea);
                }
                if (others.length > 0) {
                    lineas.push("ADICIONES:");
                    others.forEach(item => {
                        lineas.push("  x" + item.quantity + " " + item.name);
                        if (item.note) lineas.push("    (" + item.note + ")");
                    });
                    lineas.push(linea);
                }
                if (notaTexto) {
                    lineas.push("NOTAS:");
                    partirTexto(notaTexto, 30).forEach(l => lineas.push("  " + l));
                    lineas.push(linea);
                }
                lineas.push("   *** FIN PEDIDO COCINA ***");
                simularImpresion(lineas);
            }
            if (drinkItems.length > 0) {
                const lineas = ["           BARRA", new Date().toLocaleString("es-CO"), linea, label, linea, "BEBIDAS:"];
                drinkItems.forEach(item => {
                    const term = item.term ? " [" + item.term + "]" : "";
                    lineas.push("  x" + item.quantity + " " + item.name + term);
                    if (item.note) lineas.push("    (" + item.note + ")");
                });
                lineas.push(linea);
                if (notaTexto) {
                    lineas.push("NOTAS:");
                    partirTexto(notaTexto, 30).forEach(l => lineas.push("  " + l));
                    lineas.push(linea);
                }
                lineas.push("   *** FIN PEDIDO BARRA ***");
                simularImpresion(lineas);
            }
            if (tableReal) {
                tableReal.order.forEach(item => {
                    if (COCINA_CATS.includes(item.category) || BARRA_CATS.includes(item.category)) {
                        item.printed = true;
                    }
                });
                saveStore();
                io.emit("store-update", store);
            }

            socket.emit("print-success");
            return;
        }

        try {
            if (foodItems.length > 0) {
                const p = new PosPrinter();
                const tickets = foodItems.filter(i => i.category === "tickets");
                const dishes  = foodItems.filter(i => i.category === "dishes");
                const others  = foodItems.filter(i => i.category === "other");

                p.lineSpacingWide()
                 .center().bold().text("COCINA").boldOff()
                 .text(new Date().toLocaleString("es-CO"))
                 .text(linea)
                 .left().bold().text(label).boldOff()
                 .text(linea);

                if (tickets.length > 0) {
                    p.text("ENTRADAS:");
                    tickets.forEach((item, idx) => {
                        const lineas = partirTexto(item.name.toUpperCase(), 42);
                        lineas.forEach((l, i) => {
                            const prefijo = i === 0 ? "x" + item.quantity + " " : "   ";
                            p.fontSize().text(prefijo + l).fontNormal();
                        });
                        if (item.note) { partirTexto("  (" + item.note + ")", 44).forEach(l => p.fontSize().text(l).fontNormal()); }
                        if (idx < tickets.length - 1) p.feed(1);
                    });
                    p.text(linea);
                }
                if (dishes.length > 0) {
                    p.text("PLATOS:");
                    dishes.forEach((item, idx) => {
                        const term = item.term ? " [" + item.term + "]" : "";
                        const lineas = partirTexto((item.name + term).toUpperCase(), 42);
                        lineas.forEach((l, i) => {
                            const prefijo = i === 0 ? "x" + item.quantity + " " : "   ";
                            p.fontSize().text(prefijo + l).fontNormal();
                        });
                        if (item.note) { partirTexto("  (" + item.note + ")", 44).forEach(l => p.fontSize().text(l).fontNormal()); }
                        if (idx < dishes.length - 1) p.feed(1);
                    });
                    p.text(linea);
                }
                if (others.length > 0) {
                    p.text("ADICIONES:");
                    others.forEach((item, idx) => {
                        const lineas = partirTexto(item.name.toUpperCase(), 42);
                        lineas.forEach((l, i) => {
                            const prefijo = i === 0 ? "x" + item.quantity + " " : "   ";
                            p.fontSize().text(prefijo + l).fontNormal();
                        });
                        if (item.note) { partirTexto("  (" + item.note + ")", 44).forEach(l => p.fontSize().text(l).fontNormal()); }
                        if (idx < others.length - 1) p.feed(1);
                    });
                    p.text(linea);
                }
                if (notaTexto) {
                    p.text("NOTAS:");
                    partirTexto(notaTexto, 42).forEach(l => p.fontSize().text(l).fontNormal());
                    p.text(linea);
                }

                p.text(linea)
                 .center().bold().fontSize()
                 .text(label)
                 .fontNormal().boldOff()
                 .feed(3).cut();
                await imprimirBuffer(p.build());
                console.log(" Ticket cocina impreso");
            }

            if (drinkItems.length > 0) {
                const p = new PosPrinter();

                p.lineSpacingWide()
                 .center().bold().text("BARRA").boldOff()
                 .text(new Date().toLocaleString("es-CO"))
                 .text(linea)
                 .left().bold().text(label).boldOff()
                 .text(linea)
                 .text("BEBIDAS:");

                drinkItems.forEach((item, idx) => {
                    const term = item.term ? " [" + item.term + "]" : "";
                    const lineas = partirTexto((item.name + term).toUpperCase(), 42);
                    lineas.forEach((l, i) => {
                        const prefijo = i === 0 ? "x" + item.quantity + " " : "   ";
                        p.fontSize().text(prefijo + l).fontNormal();
                    });
                    if (item.note) { partirTexto("  (" + item.note + ")", 44).forEach(l => p.fontSize().text(l).fontNormal()); }
                    if (idx < drinkItems.length - 1) p.feed(1);
                });
                p.text(linea);

                if (notaTexto) {
                    p.text("NOTAS:");
                    partirTexto(notaTexto, 42).forEach(l => p.fontSize().text(l).fontNormal());
                    p.text(linea);
                }

                p.text(linea)
                 .center().bold().fontSize()
                 .text(label)
                 .fontNormal().boldOff()
                 .feed(3).cut();
                await imprimirBuffer(p.build());
                console.log(" Ticket barra impreso");
            }

            if (tableReal) {
                tableReal.order.forEach(item => {
                    if (COCINA_CATS.includes(item.category) || BARRA_CATS.includes(item.category)) {
                        item.printed = true;
                    }
                });
                saveStore();
                io.emit("store-update", store);
            }

            socket.emit("print-success");
        } catch (e) {
            console.error("Error impresora (pedido):", e.message);
            socket.emit("print-error", e.message);
        }
    });

    // ===== RENOMBRAR MESA =====
    socket.on("rename-table", ({ oldId, newId }) => {
        const conflictActive = store.tables.find(t => t.id === newId && t.status === "open");
        if (conflictActive) {
            socket.emit("rename-error", `La mesa ${newId} ya está ocupada`);
            return;
        }
        const table = store.tables.find(t => t.id === oldId && t.status === "open");
        if (!table) {
            socket.emit("rename-error", `La mesa ${oldId} no existe`);
            return;
        }
        table.id    = newId;
        table.label = `Mesa ${newId}`;
        saveStore();
        io.emit("store-update", store);
    });

    // ===== REIMPRIMIR PEDIDO (items ya impresos) =====
    socket.on("reprint-order", async ({ table }) => {
        const linea      = "--------------------------------";
        const label      = table.type === "llevar" ? "Para llevar" : "Mesa " + table.id;
        const tableReal  = store.tables.find(t => t.id === table.id && t.status === "open");
        const order      = (tableReal || table).order;

        const foodItems  = order.filter(i => COCINA_CATS.includes(i.category) && i.printed);
        const drinkItems = order.filter(i => BARRA_CATS.includes(i.category) && i.printed);

        if (foodItems.length === 0 && drinkItems.length === 0) {
            socket.emit("print-error", "No hay pedidos impresos anteriormente para reimprimir.");
            return;
        }

        if (MODO_SIMULACION) {
            if (foodItems.length > 0) {
                const lineas     = ["     COCINA (REIMPRESION)", new Date().toLocaleString("es-CO"), linea, label, linea];
                const tickets = foodItems.filter(i => i.category === "tickets");
                const dishes  = foodItems.filter(i => i.category === "dishes");
                const others  = foodItems.filter(i => i.category === "other");
                if (tickets.length > 0) {
                    lineas.push("ENTRADAS:");
                    tickets.forEach(item => {
                        lineas.push("  x" + item.quantity + " " + item.name);
                        if (item.note) lineas.push("    (" + item.note + ")");
                    });
                    lineas.push(linea);
                }
                if (dishes.length > 0) {
                    lineas.push("PLATOS:");
                    dishes.forEach(item => {
                        const term = item.term ? " [" + item.term + "]" : "";
                        lineas.push("  x" + item.quantity + " " + item.name + term);
                        if (item.note) lineas.push("    (" + item.note + ")");
                    });
                    lineas.push(linea);
                }
                if (others.length > 0) {
                    lineas.push("ADICIONES:");
                    others.forEach(item => {
                        lineas.push("  x" + item.quantity + " " + item.name);
                        if (item.note) lineas.push("    (" + item.note + ")");
                    });
                    lineas.push(linea);
                }
                lineas.push("   *** REIMPRESION COCINA ***");
                simularImpresion(lineas);
            }
            if (drinkItems.length > 0) {
                const lineas = ["    BARRA (REIMPRESION)", new Date().toLocaleString("es-CO"), linea, label, linea, "BEBIDAS:"];
                drinkItems.forEach(item => {
                    const term = item.term ? " [" + item.term + "]" : "";
                    lineas.push("  x" + item.quantity + " " + item.name + term);
                    if (item.note) lineas.push("    (" + item.note + ")");
                });
                lineas.push(linea);
                lineas.push("   *** REIMPRESION BARRA ***");
                simularImpresion(lineas);
            }
            socket.emit("print-success");
            return;
        }

        try {
            if (foodItems.length > 0) {
                const p       = new PosPrinter();
                const tickets = foodItems.filter(i => i.category === "tickets");
                const dishes  = foodItems.filter(i => i.category === "dishes");
                const others  = foodItems.filter(i => i.category === "other");

                p.lineSpacingWide()
                 .center().bold().text("COCINA (REIMPRESION)").boldOff()
                 .text(new Date().toLocaleString("es-CO"))
                 .text(linea)
                 .left().bold().text(label).boldOff()
                 .text(linea);

                if (tickets.length > 0) {
                    p.text("ENTRADAS:");
                    tickets.forEach((item, idx) => {
                        const ls = partirTexto(item.name.toUpperCase(), 42);
                        ls.forEach((l, i) => { p.fontSize().text((i === 0 ? "x" + item.quantity + " " : "   ") + l).fontNormal(); });
                        if (item.note) p.text("  (" + item.note + ")");
                        if (idx < tickets.length - 1) p.feed(1);
                    });
                    p.text(linea);
                }
                if (dishes.length > 0) {
                    p.text("PLATOS:");
                    dishes.forEach((item, idx) => {
                        const term = item.term ? " [" + item.term + "]" : "";
                        const ls = partirTexto((item.name + term).toUpperCase(), 42);
                        ls.forEach((l, i) => { p.fontSize().text((i === 0 ? "x" + item.quantity + " " : "   ") + l).fontNormal(); });
                        if (item.note) p.text("  (" + item.note + ")");
                        if (idx < dishes.length - 1) p.feed(1);
                    });
                    p.text(linea);
                }
                if (others.length > 0) {
                    p.text("ADICIONES:");
                    others.forEach((item, idx) => {
                        const ls = partirTexto(item.name.toUpperCase(), 42);
                        ls.forEach((l, i) => { p.fontSize().text((i === 0 ? "x" + item.quantity + " " : "   ") + l).fontNormal(); });
                        if (item.note) p.text("  (" + item.note + ")");
                        if (idx < others.length - 1) p.feed(1);
                    });
                    p.text(linea);
                }
                p.text(linea).center().bold().fontSize().text(label).fontNormal().boldOff().feed(3).cut();
                await imprimirBuffer(p.build());
                console.log(" Reimpresion cocina OK");
            }

            if (drinkItems.length > 0) {
                const p = new PosPrinter();
                p.lineSpacingWide()
                 .center().bold().text("BARRA (REIMPRESION)").boldOff()
                 .text(new Date().toLocaleString("es-CO"))
                 .text(linea)
                 .left().bold().text(label).boldOff()
                 .text(linea)
                 .text("BEBIDAS:");
                drinkItems.forEach((item, idx) => {
                    const term = item.term ? " [" + item.term + "]" : "";
                    const ls = partirTexto((item.name + term).toUpperCase(), 42);
                    ls.forEach((l, i) => { p.fontSize().text((i === 0 ? "x" + item.quantity + " " : "   ") + l).fontNormal(); });
                    if (item.note) p.text("  (" + item.note + ")");
                    if (idx < drinkItems.length - 1) p.feed(1);
                });
                p.text(linea).center().bold().fontSize().text(label).fontNormal().boldOff().feed(3).cut();
                await imprimirBuffer(p.build());
                console.log(" Reimpresion barra OK");
            }

            socket.emit("print-success");
        } catch (e) {
            console.error("Error reimpresion:", e.message);
            socket.emit("print-error", e.message);
        }
    });

    // ===== CREAR MESA =====
    socket.on("add-table", (newTable) => {
        const alreadyOpen = store.tables.find(t => t.id === newTable.id && t.status === "open");
        if (alreadyOpen) { socket.emit("error", "La mesa " + newTable.id + " ya esta abierta"); return; }
        store.tables = store.tables.filter(t => t.id !== newTable.id);
        store.tables.push(newTable);
        saveStore();
        io.emit("store-update", store);
    });

    // ===== AGREGAR ITEM =====
    socket.on("add-item", ({ tableId, item }) => {
        const table = store.tables.find(t => t.id === tableId && t.status === "open");
        if (!table) return;
        const existing = table.order.find(
            o => o.id === item.id &&
                 o.category === item.category &&
                 o.term === item.term &&
                 !o.printed
        );
        if (existing) {
            existing.quantity++;
            existing.subtotal = existing.price * existing.quantity;
        } else {
            table.order.push({ ...item, printed: false });
        }
        if (COCINA_CATS.includes(item.category)) table.kitchenDone = false;
        if (BARRA_CATS.includes(item.category))  table.barDone     = false;
        saveStore();
        io.emit("store-update", store);
    });

    // ===== CAMBIAR CANTIDAD =====
    socket.on("change-quantity", ({ tableId, id, category, term, printed, action }) => {
        const table = store.tables.find(t => t.id === tableId && t.status === "open");
        if (!table) return;
        const item = table.order.find(
            o => o.id === id &&
                 o.category === category &&
                 (o.term || '') === (term || '') &&
                 (o.printed === true) === (printed === true)
        );
        if (!item) return;
        if (action === "plus") {
            item.quantity++;
        } else {
            item.quantity--;
            if (item.quantity === 0) {
                table.order = table.order.filter(
                    o => !(o.id === id &&
                           o.category === category &&
                           (o.term || '') === (term || '') &&
                           (o.printed === true) === (printed === true))
                );
            }
        }
        if (item.quantity > 0) item.subtotal = item.price * item.quantity;
        saveStore();
        io.emit("store-update", store);
    });

    // ===== CERRAR MESA =====
    socket.on("close-table", ({ tableId, subtotal, service, total }) => {
        const table = store.tables.find(t => t.id === tableId && t.status === "open");
        if (!table) return;
        store.closedTables.push({
            closeId:     `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            tableNumber: table.id,
            id: table.id, type: table.type, label: table.label,
            createdAt: table.createdAt, closedAt: new Date().toLocaleString("es-CO"),
            order: [...table.order], subtotal, service, total
        });
        store.tables = store.tables.filter(t => t.id !== tableId);
        saveStore();
        io.emit("store-update", store);

        if (db) {
            const tablaCerrada = store.closedTables[store.closedTables.length - 1];
            db.guardarVenta(tablaCerrada).catch(err =>
                console.error("MySQL close-table:", err.message)
            );
        }
    });

    // ===== COCINA TERMINA =====
    socket.on("kitchen-done", (tableId) => {
        const table = store.tables.find(t => t.id === tableId && t.status === "open");
        if (!table) return;
        table.order.forEach(item => {
            if (COCINA_CATS.includes(item.category) && !item.servedKitchen) item.servedKitchen = true;
        });
        table.kitchenDone = true;
        saveStore();
        io.emit("store-update", store);
    });

    // ===== BARRA TERMINA =====
    socket.on("bar-done", (tableId) => {
        const table = store.tables.find(t => t.id === tableId && t.status === "open");
        if (!table) return;
        table.order.forEach(item => {
            if (BARRA_CATS.includes(item.category) && !item.servedBar) item.servedBar = true;
        });
        table.barDone = true;
        saveStore();
        io.emit("store-update", store);
    });

    // ===== AGREGAR PROPINA =====
    socket.on("add-tip", ({ amount }) => {
        store.totalTips = (store.totalTips || 0) + amount;
        saveStore();
        io.emit("store-update", store);
    });

    // ===== LIMPIAR HISTORIAL =====
    socket.on("clear-history", () => {
        store.closedTables = [];
        store.totalTips    = 0;
        saveStore();
        io.emit("store-update", store);
    });

    socket.on("disconnect", () => console.log("Dispositivo desconectado:", socket.id));
});

server.listen(3000, "0.0.0.0", () => {
    console.log("Servidor corriendo en puerto 3000");
    console.log(MODO_SIMULACION ? "MODO SIMULACION activo" : "Creo que  terminamos esta monda");
});
