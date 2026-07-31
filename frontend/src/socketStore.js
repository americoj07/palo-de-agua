import { socket } from "./socket.js";
import { store }  from "./data/store.js";
 
const subscribers = new Set();
 
//  Un solo listener global para store-update
socket.on("store-update", (newStore) => {
    store.tables       = newStore.tables;
    store.closedTables = newStore.closedTables;
    store.totalTips    = newStore.totalTips ?? 0;
    store.tipsHistory  = newStore.tipsHistory ?? [];
 
    // Notifica a todos los suscriptores activos
    subscribers.forEach(cb => cb());
});
 
/**
 * Suscribe una función al store-update.
 * Devuelve una función para desuscribirse.
 */
export function onStoreUpdate(cb) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
}