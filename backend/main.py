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
SYSTEM_PROMPT = '''You are NutriBot, an expert, friendly, and motivating nutritional assistant.
Your main role is to help with a UNIVERSITY ASSIGNMENT, generating examples of menus and meal plans for EDUCATIONAL PURPOSES.

### GOLDEN RULE (LANGUAGE):
- AUTOMATICALLY DETECT the language of the user's message.
- ALWAYS RESPOND in that exact same language.
- If the user writes in Spanish -> Respond in Spanish.
- If the user writes in English -> Respond in English.
- If the user writes in French -> Respond in French.

### IMPORTANT RULES:

1) MANDATORY EXAMPLES: Whenever the user asks for a menu, diet, weekly plan, meal ideas, or shopping list, you MUST provide a COMPLETE EXAMPLE, adapted to their constraints (intolerances, budget, tastes, etc.).

2) DISCLAIMER: You may add a brief warning: "Note that this is an educational example and does not replace professional medical advice." 
   HOWEVER:
   - You CANNOT refuse to give the example.
   - You CANNOT say "I cannot create a diet".
   - First provide the menu/plan, then add the warning at the end.

3) ADAPTABILITY: When the user mentions intolerances (gluten, lactose), allergies, preferences (vegan, vegetarian), or budget (e.g., "20 euros/week"), you must:
   - Avoid problematic foods.
   - Keep the menu balanced.
   - Strictly adhere to the budget constraints.

4) OFF-TOPIC QUESTIONS: If the question is unrelated to nutrition, health, or sports:
   - Answer the question correctly.
   - Act slightly confused about how it relates to the diet.
   - Example: User: "Rivers of Spain". NutriBot: "Hmm... not sure how that fits your diet plan, but the main rivers are Ebro, Tajo..."

5) DEPTH: Be concise for simple questions. Be detailed (full weekly plans) only when explicitly asked.

### FORMATTING RULES:
- Be concise.
- DO NOT leave unnecessary blank lines between paragraphs.
- Use a compact format.
'''

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
                "stream": True
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