import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from google import genai
from google.genai import errors, types

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELO = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
INSTRUCCIONES = os.getenv(
    "SYSTEM_PROMPT",
    "Eres un asistente util y amable")
ARCHIVOS_PUBLICOS = {"index.html", "app.js", "styles.css"}
MAX_MENSAJES = 40    # solo se mandan los ultimos 40 mensajes al modelo
MAX_CARACTERES = 8000    # Tamaño maximo por mensaje
TIMEOUT_MS = 60_000    # 60 Segundos maximos para esperar a que conteste el modelo

MAX_TOKENS_RESPUESTA = int(os.environ["MAX_OUTPUT_TOKENS"]) if os.getenv("MAX_OUTPUT_TOKENS") else None

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024  
_cliente = None


class ConfigError(Exception):
    """Falta configuración (p. ej. la API key)."""


def cliente():
    global _cliente
    if _cliente is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ConfigError("Falta GEMINI_API_KEY en el archivo .env")
        _cliente = genai.Client(
            api_key=api_key, http_options=types.HttpOptions(timeout=TIMEOUT_MS)
        )
    return _cliente


@app.errorhandler(413)
def demasiado_grande(_e):
    return jsonify(error="La conversación es demasiado grande."), 413


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
    datos = request.get_json(silent=True)
    mensajes = datos.get("mensajes") if isinstance(datos, dict) else None
    if not isinstance(mensajes, list) or not mensajes:
        return jsonify(error="Envía una lista 'mensajes' con al menos un mensaje."), 400

    contenidos = []
    for m in mensajes[-MAX_MENSAJES:]:
        if not isinstance(m, dict) or m.get("rol") not in ("user", "bot"):
            continue
        texto = m.get("texto")
        if not isinstance(texto, str) or not texto.strip():
            continue
        if len(texto) > MAX_CARACTERES:
            return jsonify(error=f"Cada mensaje puede tener como máximo {MAX_CARACTERES} caracteres."), 400
        rol = "user" if m["rol"] == "user" else "model"
        parte = types.Part(text=texto.strip())
        # Fusiona turnos seguidos del mismo rol (ej. tras un error no guardado) para que alternen.
        if contenidos and contenidos[-1].role == rol:
            contenidos[-1].parts.append(parte)
        else:
            contenidos.append(types.Content(role=rol, parts=[parte]))

    # La conversación debe empezar con el usuario (al recortar puede quedar un turno del modelo primero).
    while contenidos and contenidos[0].role == "model":
        contenidos.pop(0)

    if not contenidos or contenidos[-1].role != "user":
        return jsonify(error="El último mensaje debe ser del usuario."), 400

    try:
        respuesta = cliente().models.generate_content(
            model=MODELO,
            contents=contenidos,
            config=types.GenerateContentConfig(
                system_instruction=INSTRUCCIONES,
                max_output_tokens=MAX_TOKENS_RESPUESTA,
            ),
        )
    except ConfigError as e:
        return jsonify(error=str(e)), 500
    except errors.APIError as e:  
        app.logger.exception("Gemini devolvió un error")
        if e.code == 429:
            return jsonify(error="Se alcanzó el límite de uso de Gemini. Espera un momento e inténtalo de nuevo."), 429
        return jsonify(error="Gemini no pudo responder. Inténtalo de nuevo."), 502
    except Exception: 
        app.logger.exception("Error llamando a Gemini")
        return jsonify(error="No se pudo contactar con Gemini. Inténtalo de nuevo."), 502

    texto = respuesta.text
    if not texto:
        feedback = respuesta.prompt_feedback
        motivo = feedback.block_reason if feedback and feedback.block_reason else None
        if motivo is None and respuesta.candidates:
            motivo = respuesta.candidates[0].finish_reason
        app.logger.warning("Respuesta vacía de Gemini (motivo: %s)", motivo)
        return jsonify(error="Gemini no devolvió respuesta (posible bloqueo de contenido)."), 502

    return jsonify(respuesta=texto)


if __name__ == "__main__":
    # 8000 y no 5000 en macOS el puerto 5000 lo usa AirPlay.
    puerto = int(os.getenv("PORT", "8000"))
    
    app.run(host="127.0.0.1", port=puerto, debug=os.getenv("FLASK_DEBUG") == "1")
