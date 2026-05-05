import { setLoggedIn } from "../../routes/routes.js";
import "./login.css";

const USUARIOS = [
    { usuario: "admin",    clave: "1234",   rol: "admin"    },
    { usuario: "mesero",   clave: "mesa",   rol: "mesero"   },
    { usuario: "cocina",   clave: "cocina", rol: "cocina"   },
];

export function login(container) {
    if (!document.getElementById("login-styles")) {
        const link = document.createElement("link");
        link.id   = "login-styles";
        link.rel  = "stylesheet";
        link.href = "/page/login/login.css";   // ajusta la ruta si es diferente
        document.head.appendChild(link);
    }

    container.innerHTML = `
    <div class="login-page">

        <!-- ===== PANEL IZQUIERDO ===== -->
        <div class="login-panel-left">
            <div class="login-circles">
                <div class="login-circle"></div>
                <div class="login-circle"></div>
                <div class="login-circle"></div>
            </div>

            <div class="login-brand"
                <span class="login-brand-icon"></span>
                <h1 class="login-brand-name">Palo de Agua</h1>
                <p class="login-brand-sub">Restaurante</p>
                <div class="login-divider"></div>
                <p class="login-quote">
                    "El arte de cocinar es el arte<br>de transformar lo simple<br>en extraordinario."
                </p>
            </div>
        </div>

        <!-- ===== PANEL DERECHO (formulario) ===== -->
        <div class="login-panel-right">
            <div class="login-form-wrap">
                <h2 class="login-form-title">Bienvenido</h2>
                <p class="login-form-subtitle">Ingresa tus credenciales para continuar</p>

                <div class="login-error" id="login-error">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
                        viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span id="login-error-msg">Usuario o contraseña incorrectos</span>
                </div>

                <div class="login-field">
                    <label for="login-usuario">Usuario</label>
                    <div class="login-input-wrap">
                        <input
                            type="text"
                            id="login-usuario"
                            placeholder="Tu usuario"
                            autocomplete="username"
                            spellcheck="false"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                    </div>
                </div>

                <div class="login-field">
                    <label for="login-clave">Contraseña</label>
                    <div class="login-input-wrap">
                        <input
                            type="password"
                            id="login-clave"
                            placeholder="Tu contraseña"
                            autocomplete="current-password"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none"
                            viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path stroke-linecap="round" stroke-linejoin="round"
                                d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                    </div>
                </div>

                <button class="login-btn" id="login-btn">
                    <span class="btn-text">Ingresar</span>
                    <div class="spinner"></div>
                </button>
            </div>
        </div>

    </div>
    `;

    const inputUsuario = container.querySelector("#login-usuario");
    const inputClave   = container.querySelector("#login-clave");
    const btn          = container.querySelector("#login-btn");
    const errorBox     = container.querySelector("#login-error");
    const errorMsg     = container.querySelector("#login-error-msg");


    [inputUsuario, inputClave].forEach(el => {
        el.addEventListener("input", () => errorBox.classList.remove("visible"));
    });


    [inputUsuario, inputClave].forEach(el => {
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter") intentarLogin();
        });
    });

    btn.addEventListener("click", intentarLogin);

    function mostrarError(msg) {
        errorMsg.textContent = msg;
        errorBox.classList.remove("visible");
        // forzar reflow para reiniciar animación shake
        void errorBox.offsetWidth;
        errorBox.classList.add("visible");
    }

    function intentarLogin() {
        const usuario = inputUsuario.value.trim();
        const clave   = inputClave.value.trim();

        if (!usuario || !clave) {
            mostrarError("Por favor completa todos los campos");
            return;
        }

        // Simular pequeño delay de red
        btn.classList.add("loading");
        btn.disabled = true;

        setTimeout(() => {
            const encontrado = USUARIOS.find(
                u => u.usuario === usuario && u.clave === clave
            );

            btn.classList.remove("loading");
            btn.disabled = false;

            if (encontrado) {
                // Guardar sesión
                setLoggedIn(true);
                sessionStorage.setItem("rol", encontrado.rol);
                // Navegar a la vista principal
                window.navigateTo("/tables");
            } else {
                mostrarError("Usuario o contraseña incorrectos");
                inputClave.value = "";
                inputClave.focus();
            }
        }, 600);
    }

    // Foco automático al cargar
    setTimeout(() => inputUsuario.focus(), 100);
}