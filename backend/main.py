from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests
import json
import os
from typing import Optional
import PyPDF2
import io
from dotenv import load_dotenv
import google.generativeai as genai
from typing import Optional, Dict, List

# Cargar variables de entorno
load_dotenv()

# Obtener API Keys del servidor
SERVER_GROQ_API_KEY = os.getenv("GROQ_API_KEY") 

# Configurar librería oficial de Google
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ModelInfo(BaseModel):
    id: str
    name: str
    type: str
    provider: str

class ChatRequest(BaseModel):
    message: str
    model: ModelInfo
    apiKey: str = ""
    pdfContext: Optional[str] = None
    conversation_id: Optional[str] = "default"

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
SYSTEM_PROMPT = """Eres NutriBot, un asistente nutricional experto, amable y motivador.
Tu función principal es ayudar en un TRABAJO UNIVERSITARIO, generando
ejemplos de menús y planes de alimentación con fines EDUCATIVOS.

REGLAS IMPORTANTES:

1) Siempre que el usuario pida un menú, dieta, plan semanal, ideas de comidas,
lista de la compra o algo parecido, debes responder con un EJEMPLO COMPLETO,
adaptado a lo que haya mencionado (intolerancias, presupuesto, gustos, etc.).

2) Puedes añadir una breve advertencia del tipo:
"Ten en cuenta que esto es solo un ejemplo educativo y no sustituye el consejo
de un profesional sanitario."
PERO:
- No puedes negarte a dar el ejemplo.
- No puedes decir que "no puedes crear una dieta" y quedarte ahí.
Primero das el menú, luego si quieres añades la advertencia.

3) Cuando el usuario mencione intolerancias (como intolerancia al gluten),
alergias, preferencias (vegano, vegetariano, etc.) o presupuesto (por ejemplo
100 euros para la semana), debes adaptar tu propuesta teniendo en cuenta:
- Evitar los alimentos problemáticos.
- Mantener un menú equilibrado.
- Ajustarte al presupuesto de forma razonable.

4) Si la pregunta NO tiene relación con nutrición, alimentación, salud, deporte
o hábitos, respondes igualmente, pero de forma un poco confusa diciendo que
no ves bien la relación con la dieta. Ejemplo:
Usuario: "Ríos de España"
NutriBot: "Mmm… no tengo muy claro qué tiene que ver eso con tu dieta, pero
algunos ríos importantes de España son el Ebro, el Tajo, el Duero y el
Guadalquivir..."

5) Responde de forma breve y clara cuando no haga falta mucho detalle, y de forma
más desarrollada (por ejemplo, menú completo de lunes a domingo con desayunos,
comidas, cenas y snacks) cuando el usuario lo pida explícitamente.

Recuerda: estás ayudando en un trabajo académico. Tus planes son ejemplos
orientativos, no prescripciones médicas reales.

REGLA DE FORMATO:
- Sé conciso. 
- NO dejes líneas en blanco innecesarias entre párrafos. 
- Usa un formato compacto.
"""

# Memoria en RAM por conversación
chat_histories: Dict[str, List[dict]] = {}


def extract_text_from_pdf(pdf_file):
    try:
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        raise Exception(f"Error extrayendo texto del PDF: {str(e)}")

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")
        contents = await file.read()
        pdf_file = io.BytesIO(contents)
        text = extract_text_from_pdf(pdf_file)
        if not text:
            raise HTTPException(status_code=400, detail="No se pudo extraer texto del PDF")
        return {
            "success": True,
            "filename": file.filename,
            "text": text,
            "preview": text[:500] + "..." if len(text) > 500 else text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # 1. Preparar mensaje del usuario
    user_message = request.message
    if request.pdfContext:
        user_message = (
            f"Contexto del documento:\n{request.pdfContext}\n\n"
            f"Pregunta del usuario: {user_message}"
        )

    # 2. Gestionar historial
    conv_id = request.conversation_id or "default"
    history = chat_histories.get(conv_id, [])

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *history,
        {"role": "user", "content": user_message},
    ]

    # Función generadora (Aquí ocurre la magia del streaming)
    async def response_generator():
        full_response = ""
        
        # --- OPCIÓN A: OLLAMA ---
        if request.model.type == "local":
            try:
                payload = {
                    "model": request.model.id,
                    "messages": messages,
                    "stream": True  # <--- IMPORTANTE: Activamos stream
                }
                # Usamos stream=True en requests para no descargar todo de golpe
                with requests.post(OLLAMA_URL, json=payload, stream=True) as response:
                    response.raise_for_status()
                    for line in response.iter_lines():
                        if line:
                            try:
                                body = json.loads(line)
                                if "message" in body and "content" in body["message"]:
                                    chunk = body["message"]["content"]
                                    full_response += chunk
                                    yield chunk
                            except json.JSONDecodeError:
                                continue
            except Exception as e:
                yield f"Error Ollama: {str(e)}"

        # --- OPCIÓN B: GROQ CLOUD ---
        elif request.model.provider == "Groq Cloud":
            final_api_key = request.apiKey if request.apiKey else SERVER_GROQ_API_KEY
            if not final_api_key:
                yield "Error: Falta API Key de Groq."
                return

            headers = {
                "Authorization": f"Bearer {final_api_key}",
                "Content-Type": "application/json",
            }
            
            payload = {
                "model": request.model.id, 
                "messages": messages, 
                "stream": True # <--- IMPORTANTE: Activamos stream
            }

            try:
                with requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    stream=True
                ) as response:
                    if response.status_code != 200:
                        yield f"Error Groq: {response.text}"
                        return
                    
                    # Groq envía formato SSE (Server-Sent Events)
                    for line in response.iter_lines():
                        if line:
                            decoded_line = line.decode('utf-8').strip()
                            if decoded_line.startswith("data: ") and decoded_line != "data: [DONE]":
                                json_str = decoded_line.replace("data: ", "")
                                try:
                                    data = json.loads(json_str)
                                    if "choices" in data and len(data["choices"]) > 0:
                                        delta = data["choices"][0].get("delta", {})
                                        content = delta.get("content", "")
                                        if content:
                                            full_response += content
                                            yield content
                                except json.JSONDecodeError:
                                    continue
            except Exception as e:
                yield f"Error Groq: {str(e)}"
        
        else:
            yield "Proveedor no soportado."

        # 3. Guardar en memoria al terminar de generar
        if full_response:
            history.append({"role": "user", "content": user_message})
            history.append({"role": "assistant", "content": full_response})
            chat_histories[conv_id] = history

    # Devolvemos StreamingResponse
    return StreamingResponse(response_generator(), media_type="text/plain")