const STORAGE_KEY = "chatbot-chats";
const SALUDO = "Hola, ¿en qué puedo ayudarte?";
const MAX_MENSAJES_ENVIADOS = 40; // el backend tampoco usa más
const TIMEOUT_MS = 90000;

const chatEl = document.getElementById("chat");
const mensajeEl = document.getElementById("mensaje");
const enviarEl = document.getElementById("enviar");
const nuevoChatEl = document.getElementById("nuevo-chat");
const listaEl = document.getElementById("lista-chats");
const sidebarEl = document.getElementById("sidebar");
const overlayEl = document.getElementById("overlay");
const abrirSidebarEl = document.getElementById("abrir-sidebar");

let chats = cargarChats();
let chatActivoId = null;

// Valida lo guardado: datos corruptos o de una versión antigua no deben tumbar la página.
function cargarChats() {
    let datos;
    try {
        datos = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
        return [];
    }
    if (!Array.isArray(datos)) return [];
    return datos
        .filter((c) => c && typeof c === "object" && typeof c.id === "string")
        .map((c) => ({
            id: c.id,
            titulo: typeof c.titulo === "string" && c.titulo ? c.titulo : "Sin título",
            actualizado: Number(c.actualizado) || 0,
            mensajes: Array.isArray(c.mensajes)
                ? c.mensajes
                      .filter((m) => m && typeof m.texto === "string" && (m.rol === "user" || m.rol === "bot"))
                      .map((m) => ({ rol: m.rol, texto: m.texto, ...(m.error ? { error: true } : {}) }))
                : [],
        }));
}

function guardarChats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {}
}

function chatActivo() {
    return chats.find((c) => c.id === chatActivoId) || null;
}

function crearBurbuja(rol, texto, esError = false) {
    const fila = document.createElement("div");
    fila.className = rol === "user" ? "flex justify-end" : "flex";

    const burbuja = document.createElement("div");
    const base = "max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-2xl whitespace-pre-wrap break-words ";
    burbuja.className =
        base +
        (rol === "user"
            ? "bg-white text-black rounded-tr-sm"
            : esError
              ? "bg-red-950 text-red-200 border border-red-900 rounded-tl-sm"
              : "bg-zinc-800 rounded-tl-sm");
    burbuja.textContent = texto;

    fila.appendChild(burbuja);
    return fila;
}

function renderMensajes() {
    chatEl.innerHTML = "";
    chatEl.appendChild(crearBurbuja("bot", SALUDO));

    const chat = chatActivo();
    if (chat) {
        chat.mensajes.forEach((m) => chatEl.appendChild(crearBurbuja(m.rol, m.texto, m.error)));
        if (chat.id === chatEsperandoId) {
            const escribiendo = crearBurbuja("bot", "Escribiendo…");
            escribiendo.classList.add("animate-pulse");
            chatEl.appendChild(escribiendo);
        }
    }

    chatEl.scrollTop = chatEl.scrollHeight;
}

function renderLista() {
    listaEl.innerHTML = "";

    if (chats.length === 0) {
        const vacio = document.createElement("p");
        vacio.className = "px-2 text-sm text-zinc-500";
        vacio.textContent = "Aún no tienes chats.";
        listaEl.appendChild(vacio);
        return;
    }

    [...chats]
        .sort((a, b) => b.actualizado - a.actualizado)
        .forEach((chat) => {
            const activo = chat.id === chatActivoId;
            const item = document.createElement("div");
            item.className =
                "group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition " +
                (activo ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white");

            // Un <button> real: se puede usar con teclado y lectores de pantalla.
            const titulo = document.createElement("button");
            titulo.type = "button";
            titulo.className = "flex-1 min-w-0 truncate text-left outline-none focus-visible:underline";
            titulo.textContent = chat.titulo;
            if (activo) titulo.setAttribute("aria-current", "true");
            titulo.addEventListener("click", () => abrirChat(chat.id));

            const borrar = document.createElement("button");
            borrar.type = "button";
            // Visible siempre en móvil (no hay hover) y al recibir foco con teclado.
            borrar.className =
                "md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 text-zinc-500 hover:text-red-400 transition";
            borrar.textContent = "✕";
            borrar.title = "Eliminar chat";
            borrar.setAttribute("aria-label", `Eliminar chat: ${chat.titulo}`);
            borrar.addEventListener("click", () => {
                if (confirm(`¿Eliminar el chat "${chat.titulo}"?`)) eliminarChat(chat.id);
            });

            item.append(titulo, borrar);
            listaEl.appendChild(item);
        });
}

function abrirChat(id) {
    chatActivoId = id;
    renderLista();
    renderMensajes();
    cerrarSidebar();
}

function nuevoChat() {
    chatActivoId = null;
    renderLista();
    renderMensajes();
    cerrarSidebar();
    mensajeEl.focus();
}

function eliminarChat(id) {
    chats = chats.filter((c) => c.id !== id);
    guardarChats();
    if (chatActivoId === id) chatActivoId = null;
    renderLista();
    renderMensajes();
}

let chatEsperandoId = null; // chat que espera respuesta (solo una petición a la vez)

// Devuelve { ok, texto }. Los errores se muestran, pero NO se reenvían al modelo.
async function responder(mensajes) {
    try {
        const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mensajes }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const datos = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, texto: `⚠️ ${datos.error || "Error del servidor (" + res.status + ")"}` };
        if (typeof datos.respuesta !== "string") return { ok: false, texto: "⚠️ Respuesta inválida del servidor." };
        return { ok: true, texto: datos.respuesta };
    } catch (e) {
        if (e.name === "TimeoutError") return { ok: false, texto: "⚠️ El servidor tardó demasiado en responder." };
        return { ok: false, texto: "⚠️ No se pudo conectar con el servidor. ¿Está corriendo app.py?" };
    }
}

function historialParaEnviar(chat) {
    return chat.mensajes
        .filter((m) => !m.error)
        .slice(-MAX_MENSAJES_ENVIADOS)
        .map(({ rol, texto }) => ({ rol, texto }));
}

function ajustarAltura() {
    mensajeEl.style.height = "auto";
    mensajeEl.style.height = Math.min(mensajeEl.scrollHeight, 160) + "px";
}

async function enviar() {
    const texto = mensajeEl.value.trim();
    if (!texto || chatEsperandoId) return;

    let chat = chatActivo();
    if (!chat) {
        chat = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
            titulo: texto.length > 40 ? texto.slice(0, 40) + "…" : texto,
            mensajes: [],
            actualizado: Date.now(),
        };
        chats.push(chat);
        chatActivoId = chat.id;
    }

    chat.mensajes.push({ rol: "user", texto });
    chat.actualizado = Date.now();
    guardarChats();
    mensajeEl.value = "";
    ajustarAltura();

    chatEsperandoId = chat.id;
    enviarEl.disabled = true;
    renderLista();
    renderMensajes();

    try {
        const { ok, texto: respuesta } = await responder(historialParaEnviar(chat));
        // Buscar por id: otra pestaña pudo recargar `chats` mientras esperábamos.
        // Si el chat se borró, no lo resucitamos.
        const destino = chats.find((c) => c.id === chat.id);
        if (destino) {
            destino.mensajes.push({ rol: "bot", texto: respuesta, ...(ok ? {} : { error: true }) });
            destino.actualizado = Date.now();
            guardarChats();
        }
    } finally {
        chatEsperandoId = null;
        enviarEl.disabled = false;
        renderLista();
        if (chatActivoId === chat.id) renderMensajes();
    }
}

const esMovil = () => window.matchMedia("(max-width: 767px)").matches;

function sincronizarSidebar(abierto) {
    // Cerrado en móvil: fuera de pantalla y fuera del orden de tabulación.
    sidebarEl.inert = !abierto && esMovil();
    abrirSidebarEl.setAttribute("aria-expanded", String(abierto));
}

function abrirSidebar() {
    sidebarEl.classList.remove("-translate-x-full");
    overlayEl.classList.remove("hidden");
    sincronizarSidebar(true);
}

function cerrarSidebar() {
    sidebarEl.classList.add("-translate-x-full");
    overlayEl.classList.add("hidden");
    sincronizarSidebar(false);
}

enviarEl.addEventListener("click", enviar);
mensajeEl.addEventListener("keydown", (e) => {
    // isComposing: no enviar al confirmar una palabra con teclados IME (japonés, chino...).
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        enviar();
    }
});
mensajeEl.addEventListener("input", ajustarAltura);
nuevoChatEl.addEventListener("click", nuevoChat);
abrirSidebarEl.addEventListener("click", abrirSidebar);
overlayEl.addEventListener("click", cerrarSidebar);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlayEl.classList.contains("hidden")) cerrarSidebar();
});
window.matchMedia("(max-width: 767px)").addEventListener("change", () =>
    sincronizarSidebar(!overlayEl.classList.contains("hidden"))
);
// Otra pestaña guardó cambios: recargar para no pisarlos.
window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
    chats = cargarChats();
    if (!chatActivo()) chatActivoId = null;
    renderLista();
    renderMensajes();
});

renderLista();
renderMensajes();
sincronizarSidebar(false);
