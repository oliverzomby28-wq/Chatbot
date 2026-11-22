#  Chatbot con Gemini

Chatbot web hecho con **HTML, JavaScript y Tailwind** en el frontend y **Python (Flask)** en el backend, que usa la API de **Google Gemini** para responder.


##  Características

-  Conversaciones con memoria: el bot recuerda lo que hablasteis en el mismo chat.
-  Historial de chats guardado en el navegador, para crear, abrir y borrar conversaciones.
-  Diseño adaptado a móvil y escritorio.
-  Accesible con teclado y lectores de pantalla.
-  Tu API key se queda en el servidor y nunca llega al navegador.
-  Validación de mensajes, límites de tamaño y errores claros (por ejemplo, cuando se agota la cuota de Gemini).

##  Cómo ejecutarlo

### 1. Clona el repositorio

```bash
git clone https://github.com/oliverzomby28-wq/Chatbot.git
cd Chatbot
```

### 2. Crea un entorno virtual e instala las dependencias

```bash
python3 -m venv .venv
source .venv/bin/activate        # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configura tu API key

Consigue una clave gratis en [Google AI Studio](https://aistudio.google.com/apikey) y crea tu archivo `.env`:

```bash
cp .env.example .env
```

Abre `.env` y pega tu clave:

```env
GEMINI_API_KEY=tu_clave_aqui
```

### 4. Arranca el servidor

```bash
python app.py
```

Abre **http://127.0.0.1:8000** en tu navegador. ¡Listo!

##  Configuración opcional

Puedes añadir estas variables a tu `.env`:

| Variable | Qué hace | Valor por defecto |
|---|---|---|
| `GEMINI_MODEL` | Modelo de Gemini que se usa | `gemini-2.5-flash` |
| `SYSTEM_PROMPT` | La personalidad del bot | Asistente sarcástico |
| `PORT` | Puerto del servidor | `8000` |
| `MAX_OUTPUT_TOKENS` | Longitud máxima de las respuestas | Sin límite |
| `FLASK_DEBUG` | Pon `1` para activar el modo desarrollo | Desactivado |

Ejemplo para un bot más amable:

```env
SYSTEM_PROMPT=Eres un asistente amable y útil. Responde de forma clara y concisa.
```

##  Estructura del proyecto

```
Chatbot/
├── index.html        # Estructura de la página
├── app.js            # Lógica del chat e historial
├── app.py            # Servidor Flask y conexión con Gemini
├── requirements.txt  # Dependencias de Python
├── .env.example      # Plantilla de configuración
└── .env              # Tus claves (no se sube a GitHub)
```

##  API

**`POST /api/chat`**

Envía la conversación y recibe la respuesta del bot.

```json
// Petición
{
  "mensajes": [
    { "rol": "user", "texto": "Hola" }
  ]
}

// Respuesta
{ "respuesta": "¡Hola! ¿En qué te ayudo?" }
```

Si algo falla, la respuesta tiene la forma `{ "error": "mensaje del error" }`.

##  Seguridad

- El archivo `.env` está en `.gitignore`: **nunca subas tu API key a GitHub**.
- El servidor solo entrega `index.html`, `app.js` y `styles.css`; cualquier otro archivo devuelve 404.
- Por defecto solo acepta conexiones desde tu propio ordenador (`127.0.0.1`).
