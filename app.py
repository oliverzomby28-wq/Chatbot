"""Backend del Chatbot: sirve la página y reenvía los mensajes a Gemini."""

import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from google import genai
from google.genai import types

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELO = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
INSTRUCCIONES = os.getenv(
    "SYSTEM_PROMPT",
    "Eres un asistente amable y útil. Responde en el idioma del usuario, de forma clara y concisa.",
)
# Solo se sirven estos archivos, así nunca se expone el .env ni el código.
ARCHIVOS_PUBLICOS = {"index.html", "app.js", "styles.css"}
MAX_MENSAJES = 40

app = Flask(__name__)
_cliente = None


def cliente():
    global _cliente
    if _cliente is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("Falta GEMINI_API_KEY en el archivo .env")
        _cliente = genai.Client(api_key=api_key)
    return _cliente


@app.get("/")
def inicio():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/<path:archivo>")
def estaticos(archivo):
    if archivo not in ARCHIVOS_PUBLICOS:
        return "No encontrado", 404
    return send_from_directory(BASE_DIR, archivo)


@app.post("/api/chat")
def chat():
    datos = request.get_json(silent=True) or {}
    mensajes = datos.get("mensajes")
    if not isinstance(mensajes, list) or not mensajes:
        return jsonify(error="Envía una lista 'mensajes' con al menos un mensaje."), 400

    contenidos = []
    for m in mensajes[-MAX_MENSAJES:]:
        texto = str(m.get("texto", "")).strip()
        if not texto:
            continue
        rol = "user" if m.get("rol") == "user" else "model"
        contenidos.append(types.Content(role=rol, parts=[types.Part(text=texto)]))

    if not contenidos or contenidos[-1].role != "user":
        return jsonify(error="El último mensaje debe ser del usuario."), 400

    try:
        respuesta = cliente().models.generate_content(
            model=MODELO,
            contents=contenidos,
            config=types.GenerateContentConfig(system_instruction=INSTRUCCIONES),
        )
    except RuntimeError as e:
        return jsonify(error=str(e)), 500
    except Exception as e:  # errores de red, clave inválida, cuota, etc.
        app.logger.exception("Error llamando a Gemini")
        return jsonify(error=f"Error al llamar a Gemini: {e}"), 502

    return jsonify(respuesta=respuesta.text or "(sin respuesta)")


if __name__ == "__main__":
    # 8000 y no 5000: en macOS el puerto 5000 lo usa AirPlay.
    puerto = int(os.getenv("PORT", "8000"))
    app.run(host="127.0.0.1", port=puerto, debug=True)
