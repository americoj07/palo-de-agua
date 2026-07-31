// ================================================================
// db.js — Conexión MySQL con pool robusto y reconexión automática
// Compatible con server.js de Palo de Agua
// ================================================================
const mysql = require("mysql2/promise");

// ── Configura aquí tus credenciales ─────────────────────────────
const pool = mysql.createPool({
    host:               "127.0.0.1",
    port:               3306,
    user:               "root",          // ← cambia si tu usuario es diferente
    password:           "ame1234",
    database:           "palo_de_agua",  // ← nombre de tu base de datos
    waitForConnections: true,            // espera si no hay conexiones libres (NO falla de inmediato)
    connectionLimit:    10,              // máximo 10 conexiones simultáneas
    queueLimit:         0,               // sin límite de cola
    enableKeepAlive:    true,            // mantiene las conexiones vivas
    keepAliveInitialDelay: 10000,        // ping cada 10 segundos para que no se duerman
    connectTimeout:     10000,           // 10 segundos para conectar
    // Reconexión automática ante caídas de MySQL
    namedPlaceholders:  false,
});

// ── Ping periódico para evitar que MySQL cierre conexiones ───────
// Esto es lo que soluciona el problema de "deja de funcionar después de un rato"
setInterval(async () => {
    try {
        await pool.execute("SELECT 1");
    } catch (e) {
        console.warn("⚠️  MySQL keep-alive falló, reintentando automáticamente:", e.message);
    }
}, 30000); // cada 30 segundos

// ── Verificar conexión al arrancar ──────────────────────────────
pool.execute("SELECT 1")
    .then(() => console.log("✅ MySQL conectado correctamente"))
    .catch(e  => console.error("❌ MySQL no disponible al arrancar:", e.message));

// ================================================================
// ===== GUARDAR VENTA ============================================
// ================================================================
async function guardarVenta(tablaCerrada) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // fecha_cierre en formato YYYY-MM-DD (hora Bogotá, NO UTC).
        // toISOString() convierte a UTC y desfasa el día después de las 7pm hora Colombia.
        // "en-CA" da formato YYYY-MM-DD directamente.
        const fechaCierre = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

        const [result] = await conn.execute(
            `INSERT INTO ventas
                (close_id, tipo, mesa_numero, mesa_label, subtotal, servicio, total, creada_at, cerrada_at, fecha_cierre)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                tablaCerrada.closeId,
                tablaCerrada.type        || "mesa",
                tablaCerrada.tableNumber || tablaCerrada.id,
                tablaCerrada.label       || "",
                tablaCerrada.subtotal    || 0,
                tablaCerrada.service     || 0,
                tablaCerrada.total       || 0,
                tablaCerrada.createdAt   || null,
                tablaCerrada.closedAt    || null,
                fechaCierre,
            ]
        );

        const ventaId = result.insertId;

        for (const item of (tablaCerrada.order || [])) {
            await conn.execute(
                `INSERT INTO ventas_items
                    (venta_id, nombre, categoria, cantidad, precio_unit, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    ventaId,
                    item.name      || "",
                    item.category  || "",
                    item.quantity  || 1,
                    item.price     || 0,
                    item.subtotal  || 0,
                ]
            );
        }

        await conn.commit();
        console.log(`✅ Venta guardada en MySQL (id=${ventaId}, mesa=${tablaCerrada.tableNumber})`);
        return ventaId;

    } catch (err) {
        await conn.rollback();
        console.error("❌ Error guardando venta en MySQL:", err.message);
        throw err;
    } finally {
        conn.release();
    }
}

// ================================================================
// ===== ESTADÍSTICAS =============================================
// ================================================================
async function obtenerEstadisticas(dias = 30, categoria = "all") {
    const base = `
        SELECT vi.nombre, vi.categoria,
               SUM(vi.cantidad)  AS total_vendido,
               SUM(vi.subtotal)  AS total_ingresos
        FROM ventas_items vi
        JOIN ventas v ON v.id = vi.venta_id
        WHERE v.cerrada_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    const params = [dias];

    let query = base;
    if (categoria !== "all") {
        query += " AND vi.categoria = ?";
        params.push(categoria);
    }
    query += " GROUP BY vi.nombre, vi.categoria ORDER BY total_vendido DESC";

    const [rows] = await pool.execute(query, params);
    return rows;
}

async function obtenerResumenMes(mesAnio = null) {
    let query, params;
    if (mesAnio) {
        // mesAnio formato "YYYY-MM"
        query = `
            SELECT
                COUNT(DISTINCT id)        AS total_mesas,
                COALESCE(SUM(total),0)    AS total_recaudado,
                COALESCE(SUM(servicio),0) AS total_servicio,
                COALESCE(SUM(subtotal),0) AS total_subtotal
            FROM ventas
            WHERE DATE_FORMAT(cerrada_at, '%Y-%m') = ?`;
        params = [mesAnio];
    } else {
        query = `
            SELECT
                COUNT(DISTINCT id)        AS total_mesas,
                COALESCE(SUM(total),0)    AS total_recaudado,
                COALESCE(SUM(servicio),0) AS total_servicio,
                COALESCE(SUM(subtotal),0) AS total_subtotal
            FROM ventas
            WHERE MONTH(cerrada_at) = MONTH(NOW())
              AND YEAR(cerrada_at)  = YEAR(NOW())`;
        params = [];
    }
    const [[resumen]] = await pool.execute(query, params);
    return resumen;
}

// ================================================================
module.exports = { pool, guardarVenta, obtenerEstadisticas, obtenerResumenMes };