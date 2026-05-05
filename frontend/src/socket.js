import { io } from "socket.io-client";

// ✅ Cambia esta IP por la IP de tu computador
const IP = window.location.hostname;

export const socket = io(`http://${IP}:3000`);