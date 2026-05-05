const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const cors       = require("cors");

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

const store = { tables: [], closedTables: [], totalTips: 0 };

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
    fontSize:          Buffer.from([GS,  0x21, 0x01]),  // Solo doble alto — letra más alta, ancho completo 80mm
    fontNormal:        Buffer.from([GS,  0x21, 0x00]),  // Tamaño normal (restaurar)
    lineSpacingWide:   Buffer.from([ESC, 0x33, 60]),    // Espaciado amplio entre líneas (pedidos)
    lineSpacingNormal: Buffer.from([ESC, 0x32]),         // Espaciado normal (facturas)
};

function textBuf(str) {
    return Buffer.from(str + "\n", "latin1");
}


// ===== LOGO IMPRESORA (ESC/POS raster, 384px) =====
const LOGO_B64 = "HXYwADAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH////gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf//////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB///////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/+AAAP/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//gAAAB/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/4AB8AAf+AAAABwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/gAP4AAP/AAAAH8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf+AA/wAAH/AAAAf+AAAAAAAAADgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/4AD/gAADfgAAA/+AAAAAAAAAfwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/gAH/AAAD/gAAB/+AAAAAAAAB/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/AAP/AAAB/gAAD/+AAAAAAAAD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAP+AAAB/gAAD98AAAAAAAAD/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf4AAH+AAAB/gAAH78AAAAAAAAH/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAH8AAAB/gAAPz8AAAAAAAAH/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/gAAH8AAAB/gAAfj4AAAAAAAAPfAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/AAAH8AAAB/gAA/H4AAAAAAAAP+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+AAAP4AAAD/AAA+HwAAAAAAAAf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH8AAAP4AAAD/AAB+PwAAAAAAAAf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH8AAAP4AAAH/AAD8PgAAAAAAAA/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP4AAAPwAAAH+AAD4fAAAAAAAAA/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP4AAAfwAAAP8AAH4/AAAAAAAAB/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf4AAAfwAAAf8AAHx+AAAAAAAAB/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfwAAAfgAAA/4AAPh8AAAAAAAAB/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfwAAA/gAAB/wAAfj8AAAAAAAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAA/AAAH/gAAfH4AAAAAAAAD+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/wAAA/AAAP+AAA+PwAA4AAAABD+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA94AAB/AAA/8AHw+fgAD8BwAAP38AAAAAAAAAcAAfAAAAAACAAAAAAAAAAAAAAAAA94AAB+AAB/4APx8/AAH//wAAf/8AD+AAAAAB+AB/gAAAAAPAAAAAAAAAAAAAAAAA94AAB+AAH/gAfz9+AAf//gAA//4AP/gAAAAD+AH/wAAwAAfAAAAAAAAAAAAAAAAA+8AAD+AA/+AA/j78AA//+AAD//4Af/gAAAAH+AP/z4B4AE/AAAAAAAAAAAAAAAAAe+AAD8AD/4A//n38AB//+AAH//wA//gAAAHv8A//n4D4A//AAAAAAAAAAAAAAAAAffAAH8AP/gD//H/4AD//gAAP//wD//gAAAf/8B//v4H4D/+AAAAAAAAAAAAAAAAAffwAH4B/+AP//H/wAH//AAAf//gH+fgAAA//4D///4HwH/+AAAAAAAAAAAAAAAAAfn/4H4P/4Af/+P/gAP9+AAA/4/gP8/AAAD//wH+f/wPwf/8AAAAAAAAAAAAAAAAAP7/4P5//AB//8P+AAPx+AAB/h/APx+AAAH//wP4f/wfg//8AAAAAAAAAAAAAAAAAH//wPz/4AD/P4f8AAfj8AAD/B/Afj+AAAf7/gfw//wfh/f4AAAAAAAAAAAAAAAAAH//wf3/gAH8fwf4AA/D8AAH+D+A/H8AAA/j/A/g+Pg/D8fwAAAAAAAAAAAAAAAAAD//gfn8AAP4fwfwAB+H8AAP8H+B+P4AAB+H+B/B8fg/H4fgAAAAAAAAAAAAAAAAAA/+A/nAAA/g/g/wAB8H4AAf4P+B+fwAAD8H8D+D8fB+Pw/gAAAAAAAAAAAAAAAAAAP8A/AAAB/B/A/gAD8P4AA/wf8D8/gAAP4P4D8H4fD+fg/AAAAAAAAAAAAAAAAAAAAAB/AAAD+B/A/AAH4PwAB/g/8H7/AAAfwf4H4P4+H8fB+AAAAAAAAAAAAAAAAAAAAAB/AAAH8H+B/AAP4fwAB/B/8H/8AAA/g/wPwf4+H8+D+AAAAAAAAAAAAAAAAAAAAAD+AAAH4P+B+AAfw/gAD+D/4P/4AgB/B/gfx/x8P5+H+AAAAAAAAAAAAAAAAAAAAAD+AAAPwf+B+AA/w/gAH+H74P/wDgB+D/g/j/x8f78P+AAAAAAAAAAAAAAAAAAAAAH8AAAfx/+B+AD/x/AAH8fz4P/APAD8P/g/f/j5/74/8AAAAAAAAAAAAAAAAAAAAAP4AAA/n9+B+AP/z+AAP5/j4f+A+AH8//h///j//359+AAAAAAAAAAAAAAAAAAAAAP4AAA//5+B/h///8AAP//D4f4H8AP//fh//Pj/73/5+AAAAAAAAAAAAAAAAAABgAfwAAB//x+B///P/4AAf/+D8f//4AP/8fh/+fH/z3/x/gAAAAAAAAAAAAAAAAADAA/wAAB//h/B//+P/4AAf/8D8P//wAf/4fh/8fH/j//g/+AAAAAAAAAAAAAAAAAHAB/gAAB/+A/8//4P/gAAf/4D/P//gAf/wP5/w+D/D//Af8AAAAAAAAAAAAAAAAAHAD/AAAB/8Af8f/gH/AAAf/gB/3/+AAf/AP//A+D8Bn8H/4AAAAAAAAAAAAAAAAAOAH/AAAA/wAP4P+AH+AAAP+AB/j/4AAP8AH/AB+AAABg//////+AAAAAAAAAAAAAOAP+AAAAAAABABAAAgAAAD4AAeAeAAAAAAD+AB8AAAAD//////+AAAAAAAAAAAAAOAf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8AAAAH8AP///8AAAAAAAAAAAAAeB/4ABwAAAAAAAAAAAAAAAAAAAAAAAAABgAAAD4AAAAfgAAAAAAAAAAAAAAAAAAAfH/4Af////4AAAAAAAAAAAAAAAAAAAAADgAAAH4AAAB/B/////wAAAAAAAAAAAAAf//wB///////////////8AAAAAAAAAAAHf/////////8B/////+AAAAAAAAAAAAAf//gD///////////////////////////u//////////4A/////+AAAAAAAAAAAAAf//AH///////////////////////////9//////////AAAAAAAAAAAAAAAAAAAAAP/8AH////////////9///AAAAAAP////9////v/////gAAAAAAAAAAAAAAAAAAAAP/4AP//////////////////////////9///////////4B/////+AAAAAAAAAAAAAH/wAP///////////////////////////7//////////+A/////+AAAAAAAAAAAAAD/AAP//////////////////////////7////////////AP////8AAAAAAAAAAAAAAAAAP//////////////////////////7////9+AAAAD/wAAAAAAAAAAAAAAAAAAAAAAAP//////////////////+AAAAAAAHwAAAD+AAAAB///////wAAAAAAAAAAAAAAAAAH/////AAAAAAAAAAAAAAAAAAAAAHwAAAH8AAAAA///////+AAAAAAAAAAAAAAAAAD///8AAAAAAAA5wAAAAAAAAAAAAHwAAAH8AAAAAf//////+AAAAAAAAAAAAAAAAAB//+AAAAAAAAD74AAAAAAAAAAAAPwAAAP4AAAAAD//AAAAAAAAAAAAAAAAAAAAAAAf/gAAAAAAAAHGAAAAAAAAAAAAAP4AAAfwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4AAP4AAAAAGMAAAAAAAAAAAAAP4AAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8AAAAGMMAAAAAAAAAAAAAP4AAB/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmOAAAAOMYAAAAAAAAAAADAH8AAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADGGAAAAEcYAAAAAAAAAAAHAHeAAP+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGGGAAAAAY4AAAAAAAAAAAGAHvAAf+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGGO/O5ncYwfgD584zN3OHvwD3wB/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHOd3f7/8Yw7gH7t53//eNvgD7//74AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADP7mXH4s4xzAMzGxny72ZsAB9//vwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPjGHBwYwxjAY2Gxjhzm7MAB+P8fgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMGOOBwYxznAY2EzjBzM+MAA/wD+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMGcuBgbznPQZ2MzrBjM49gAf//8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMG9sBga1vOw72N3bBnNxtAAH//wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/HvMDge97/ge3492BmO/PAAB//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/DGMBAYYxjAczw5iBiMeOAAADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABxwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABhgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADBgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADjAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
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
function imprimirBuffer(data) {
    return new Promise((resolve, reject) => {
        let device, iface;
        try {
            const { findByIds } = require("usb");

            // vendorId: 0x0471 (1137), productId: 0x0055 (85) — Digital POS GA-E200I
            device = findByIds(0x0471, 0x0055);
            if (!device) {
                return reject(new Error("Impresora no encontrada. Verifica que esté enchufada."));
            }

            device.open();

            // Seleccionar configuración 1 explícitamente
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

                // Endpoint OUT tipo bulk (transferType 2)
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
        io.emit("store-update", store);
    });

    // ===== IMPRIMIR TICKET =====
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

            // ===== ENCABEZADO =====
            // Logo centrado
            p.buffers.push(CMD.alignCenter);
            p.buffers.push(logoBuffer());
            p.center().bold()
             .text("PALO DE AGUA")
             .text("RESTAURANTE")
             .boldOff()
             .text("Cra 69 #73-91")
             .text("Tel: 300-4524371")
             .text(linea)
             .text(table.createdAt)
             .text(linea);

            // ===== CABECERA DE TABLA =====
            // Ancho total ~48 chars en 80mm
            // Col: cant(4) | descripcion(22) | p.uni(10) | p.total(10)
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

            // ===== ITEMS (agrupar por nombre + precio) =====
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

                // Nombre puede ocupar varias líneas si es largo
                const nombreLineas = partirTexto(item.name, COL_DESC);

                nombreLineas.forEach((lineaNombre, i) => {
                    if (i === 0) {
                        // Primera línea: cant | nombre | p.uni | p.total
                        const fila =
                            padR(cant, COL_CANT) +
                            padR(lineaNombre, COL_DESC) +
                            padL(pUni, COL_PUNI) +
                            padL(pTot, COL_PTOT);
                        p.left().text(fila);
                    } else {
                        // Líneas de continuación: solo nombre indentado
                        const fila =
                            padR("", COL_CANT) +
                            padR(lineaNombre, COL_DESC) +
                            padL("", COL_PUNI) +
                            padL("", COL_PTOT);
                        p.left().text(fila);
                    }
                });
            });

            // ===== TOTALES =====
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

        // Solo imprimir items que NO han sido impresos antes
        const tableReal  = store.tables.find(t => t.id === table.id && t.status === "open");
        const foodItems  = (tableReal || table).order.filter(i => COCINA_CATS.includes(i.category) && !i.printed);
        const drinkItems = (tableReal || table).order.filter(i => BARRA_CATS.includes(i.category) && !i.printed);
        const notaTexto  = notes && notes.trim() ? notes.trim() : null;

        // Si no hay nada nuevo que imprimir
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
            // Marcar items como impresos
            if (tableReal) {
                tableReal.order.forEach(item => {
                    if (COCINA_CATS.includes(item.category) || BARRA_CATS.includes(item.category)) {
                        item.printed = true;
                    }
                });
                io.emit("store-update", store);
            }

            socket.emit("print-success");
            return;
        }

        // --- Impresora real ---
        try {
            // ---- TICKET COCINA ----
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

            // ---- TICKET BARRA ----
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

            // Marcar items como impresos
            if (tableReal) {
                tableReal.order.forEach(item => {
                    if (COCINA_CATS.includes(item.category) || BARRA_CATS.includes(item.category)) {
                        item.printed = true;
                    }
                });
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
        // Solo bloquear si el número está en uso por una mesa activa ahora mismo
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
        io.emit("store-update", store);
    });

    // ===== REIMPRIMIR PEDIDO (items ya impresos) =====
    socket.on("reprint-order", async ({ table }) => {
        const linea      = "--------------------------------";
        const label      = table.type === "llevar" ? "Para llevar" : "Mesa " + table.id;
        const tableReal  = store.tables.find(t => t.id === table.id && t.status === "open");
        const order      = (tableReal || table).order;

        // Solo los items que YA fueron impresos
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

        // --- Impresora real ---
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
        io.emit("store-update", store);
    });

    // ===== AGREGAR ITEM =====
    socket.on("add-item", ({ tableId, item }) => {
        const table = store.tables.find(t => t.id === tableId && t.status === "open");
        if (!table) return;
        // Solo acumular si hay un item NO impreso del mismo producto+término
        // Si ya existe uno impreso, crear siempre uno nuevo
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
        io.emit("store-update", store);
    });

    // ===== CAMBIAR CANTIDAD =====
    socket.on("change-quantity", ({ tableId, id, category, term, printed, action }) => {
        const table = store.tables.find(t => t.id === tableId && t.status === "open");
        if (!table) return;
        // Buscar el item exacto incluyendo printed para no confundir
        // el item ya enviado con el nuevo del mismo producto
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
        io.emit("store-update", store);
    });

    // ===== CERRAR MESA =====
    socket.on("close-table", ({ tableId, subtotal, service, total }) => {
        const table = store.tables.find(t => t.id === tableId && t.status === "open");
        if (!table) return;
        store.closedTables.push({
            closeId:     `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, // ID único e inmutable
            tableNumber: table.id,  // número al momento del cierre, no cambia nunca
            id: table.id, type: table.type, label: table.label,
            createdAt: table.createdAt, closedAt: new Date().toLocaleString("es-CO"),
            order: [...table.order], subtotal, service, total
        });
        // ✅ Eliminar de store.tables — evita colisión de IDs al renombrar mesas
        store.tables = store.tables.filter(t => t.id !== tableId);
        io.emit("store-update", store);
    });

    // ===== COCINA TERMINA =====
    socket.on("kitchen-done", (tableId) => {
        const table = store.tables.find(t => t.id === tableId && t.status === "open");
        if (!table) return;
        table.order.forEach(item => {
            if (COCINA_CATS.includes(item.category) && !item.servedKitchen) item.servedKitchen = true;
        });
        table.kitchenDone = true;
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
        io.emit("store-update", store);
    });

    // ===== AGREGAR PROPINA =====
    socket.on("add-tip", ({ amount }) => {
        store.totalTips = (store.totalTips || 0) + amount;
        io.emit("store-update", store);
    });

    // ===== LIMPIAR HISTORIAL =====
    socket.on("clear-history", () => {
        store.closedTables = [];
        store.totalTips    = 0;
        io.emit("store-update", store);
    });

    socket.on("disconnect", () => console.log("Dispositivo desconectado:", socket.id));
});

server.listen(3000, "0.0.0.0", () => {
    console.log("Servidor corriendo en puerto 3000");
    console.log(MODO_SIMULACION ? "MODO SIMULACION activo" : "Creo que  terminamos esta monda");
});