const STORAGE_KEY = "chatbot-chats";
const SALUDO = "Hola, ¿en qué puedo ayudarte?";

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

function cargarChats() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function guardarChats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {}
}

function chatActivo() {
    return chats.find((c) => c.id === chatActivoId) || null;
}

function crearBurbuja(rol, texto) {
    const fila = document.createElement("div");
    fila.className = rol === "user" ? "flex justify-end" : "flex";

    const burbuja = document.createElement("div");
    burbuja.className =
        rol === "user"
            ? "max-w-[75%] bg-white text-black px-4 py-3 rounded-2xl rounded-tr-sm whitespace-pre-wrap break-words"
            : "max-w-[75%] bg-zinc-800 px-4 py-3 rounded-2xl rounded-tl-sm whitespace-pre-wrap break-words";
    burbuja.textContent = texto;

    fila.appendChild(burbuja);
    return fila;
}

function renderMensajes() {
    chatEl.innerHTML = "";
    chatEl.appendChild(crearBurbuja("bot", SALUDO));

    const chat = chatActivo();
    if (chat) {
        chat.mensajes.forEach((m) => chatEl.appendChild(crearBurbuja(m.rol, m.texto)));
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
            const item = document.createElement("div");
            item.className =
                "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition " +
                (chat.id === chatActivoId ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white");

            const titulo = document.createElement("span");
            titulo.className = "flex-1 truncate";
            titulo.textContent = chat.titulo;

            const borrar = document.createElement("button");
            borrar.className = "opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition";
            borrar.textContent = "✕";
            borrar.title = "Eliminar chat";
            borrar.addEventListener("click", (e) => {
                e.stopPropagation();
                eliminarChat(chat.id);
            });

            item.addEventListener("click", () => abrirChat(chat.id));
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

function responder(texto) {
    return `Recibí tu mensaje: "${texto}"`;
}

function enviar() {
    const texto = mensajeEl.value.trim();
    if (!texto) return;

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
    chat.mensajes.push({ rol: "bot", texto: responder(texto) });
    chat.actualizado = Date.now();

    guardarChats();
    mensajeEl.value = "";
    renderLista();
    renderMensajes();
}

function abrirSidebar() {
    sidebarEl.classList.remove("-translate-x-full");
    overlayEl.classList.remove("hidden");
}

function cerrarSidebar() {
    sidebarEl.classList.add("-translate-x-full");
    overlayEl.classList.add("hidden");
}

enviarEl.addEventListener("click", enviar);
mensajeEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        enviar();
    }
});
nuevoChatEl.addEventListener("click", nuevoChat);
abrirSidebarEl.addEventListener("click", abrirSidebar);
overlayEl.addEventListener("click", cerrarSidebar);

renderLista();
renderMensajes();
