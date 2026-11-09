# Chatbot

Chatbot con frontend en HTML/JS y backend en Python (Flask) que usa la API de Gemini.

## Cómo correrlo

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # y pon tu GEMINI_API_KEY dentro
python app.py
```

Abre http://127.0.0.1:8000

## Archivos

- `index.html`, `styles.css`, `app.js`: la interfaz. El historial de chats se guarda en el navegador.
- `app.py`: servidor Flask. Sirve la página y expone `POST /api/chat`, que recibe `{"mensajes": [{"rol": "user"|"bot", "texto": "..."}]}` y devuelve `{"respuesta": "..."}`.
- `.env`: tus claves. Está en `.gitignore`, **no se sube a GitHub**. Usa `.env.example` como plantilla.
