const mysql = require("mysql2/promise");
const { execSync } = require("child_process");

// ── Detecta automáticamente la IP de WSL ────────────────────────
function getWSLHost() {
    try {
        const ip = execSync("wsl hostname -I").toString().trim().split(" ")[0];
        console.log("🌐 IP de WSL detectada:", ip);
        return ip;
    } catch (e) {
        console.warn("⚠️  No se pudo detectar IP de WSL, usando localhost");
        return "localhost";
    }
}

const pool = mysql.createPool({
    host:               getWSLHost(),
    user:               "root",
    password:           "ame1234",
    database:           "palo_de_agua",
    waitForConnections: true,
    connectionLimit:    10,
    timezone:           "-05:00", 
});

setTimeout(() => {
    pool.getConnection()
        .then(conn => {
            console.log("✅ MySQL conectado correctamente");
            conn.release();
        })
        .catch(err => {
            console.error("❌ MySQL NO conectado:", err.message);
            console.error("   Verifica usuario, contraseña y que MySQL esté corriendo");
        });
}, 2000);

async function guardarVenta(tableCerrada) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.execute(
            `INSERT INTO ventas
               (tipo, mesa_numero, subtotal, servicio, total, cerrada_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [
                tableCerrada.type,
                tableCerrada.type === "mesa"
                    ? (tableCerrada.tableNumber ?? tableCerrada.id)
                    : null,
                tableCerrada.subtotal,
                tableCerrada.service,
                tableCerrada.total,
            ]
        );
        const ventaId = result.insertId;

        const agrupados = {};
        for (const item of tableCerrada.order) {
            const key = `${item.name}||${item.category}`;
            if (agrupados[key]) {
                agrupados[key].cantidad += item.quantity;
                agrupados[key].subtotal += (item.subtotal || 0);
            } else {
                agrupados[key] = {
                    nombre:      item.name,
                    categoria:   item.category,
                    cantidad:    item.quantity,
                    precio_unit: item.price  || 0,
                    subtotal:    item.subtotal || 0,
                };
            }
        }

        const mesAnio = new Date().toISOString().slice(0, 7); // "2026-05"
        for (const item of Object.values(agrupados)) {
            await conn.execute(
                `INSERT INTO ventas_items
                   (venta_id, nombre, categoria, cantidad, precio_unit, subtotal, mes_anio)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    ventaId,
                    item.nombre,
                    item.categoria,
                    item.cantidad,
                    item.precio_unit,
                    item.subtotal,
                    mesAnio,
                ]
            );
        }

        await conn.commit();
        console.log(`✅ MySQL — Venta #${ventaId} guardada | Total: $${tableCerrada.total.toLocaleString()}`);
        return ventaId;

    } catch (err) {
        await conn.rollback();
        console.error("❌ MySQL — Error guardando venta:", err.message);
    } finally {
        conn.release();
    }
}

async function obtenerEstadisticas(dias = 30, categoria = "all") {
    let catCondicion = "";
    const params = [dias];

    if (categoria === "platos") {
        catCondicion = "AND categoria IN ('dishes', 'tickets', 'other')";
    } else if (categoria === "bebidas") {
        catCondicion = "AND categoria = 'drinks'";
    }

    const [rows] = await pool.execute(
        `SELECT
            nombre,
            categoria,
            SUM(cantidad)           AS total_vendido,
            SUM(subtotal)           AS total_ingresos,
            COUNT(DISTINCT venta_id) AS en_cuantas_ventas
         FROM ventas_items
         WHERE fecha >= DATE_SUB(NOW(), INTERVAL ? DAY)
         ${catCondicion}
         GROUP BY nombre, categoria
         ORDER BY total_vendido DESC
         LIMIT 50`,
        params
    );
    return rows;
}

async function obtenerResumenMes(mesAnio = null) {
    const mes = mesAnio || new Date().toISOString().slice(0, 7);

    const [[totales]] = await pool.execute(
        `SELECT
            COUNT(DISTINCT v.id)    AS total_mesas,
            COALESCE(SUM(v.total), 0)           AS total_recaudado,
            COALESCE(SUM(v.servicio), 0)        AS total_servicio,
            COALESCE(SUM(vi.cantidad), 0)       AS total_items_vendidos
         FROM ventas v
         LEFT JOIN ventas_items vi ON vi.venta_id = v.id
         WHERE DATE_FORMAT(v.cerrada_at, '%Y-%m') = ?`,
        [mes]
    );
    return totales;
}

module.exports = { guardarVenta, obtenerEstadisticas, obtenerResumenMes };