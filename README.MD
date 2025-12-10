# NutriBot 🌱 - Asistente Nutricional Inteligente

NutriBot es una aplicación web interactiva diseñada para asistir en consultas nutricionales con fines educativos. Combina una interfaz moderna con un potente backend de IA capaz de procesar texto en tiempo real (**Streaming**) y analizar documentos PDF (**RAG**).

El sistema permite alternar entre privacidad total (IA Local) y máxima potencia (IA en la Nube).

![Estado](https://img.shields.io/badge/Status-Funcional-green)
![Python](https://img.shields.io/badge/Backend-FastAPI-blue)
![React](https://img.shields.io/badge/Frontend-Next.js-black)

## 🚀 Funcionalidades Clave

- **💬 Streaming Real:** Las respuestas aparecen "letra a letra" para una experiencia fluida.
- **📄 Análisis de Documentos:** Sube un PDF (ej. una dieta o estudio médico) y chatea sobre su contenido.
- **🧠 Doble Motor de IA:**
  - **Local (Ollama):** Usa `llama3.2:1b` para respuestas rápidas y privadas sin internet.
  - **Nube (Groq):** Usa `llama-3.3-70b` para razonamiento complejo y alta velocidad.
- **🎨 UI Moderna:** Diseño oscuro, responsive y con animaciones de carga inteligentes.

## 🛠️ Tecnologías Utilizadas

- **Backend:** Python 3.10+, FastAPI, Uvicorn, PyPDF2.
- **Frontend:** React, Next.js, Tailwind CSS.
- **Librerías UI:** Lucide React (Iconos), React Markdown (Formato de texto).

## 📋 Requisitos Previos

Antes de empezar, asegúrate de tener instalado:

1. **Python** (v3.9 o superior).
2. **Node.js** (v18 o superior).
3. **Ollama**: Necesario para el modo local.
   - Instálalo desde [ollama.com](https://ollama.com).
   - Ejecuta en tu terminal: `ollama pull llama3.2:1b`.

---

## ⚙️ Instalación y Puesta en Marcha

Sigue estos pasos para ejecutar el proyecto en tu ordenador.

### 1. Configuración del Backend (Python)

El backend se encarga de la lógica de IA y el procesamiento de archivos.

```bash
# 1. Entra en la carpeta del backend (asegúrate de estar en la ruta correcta)
cd backend

# 2. Crea un entorno virtual (Recomendado)
python -m venv venv

# 3. Activa el entorno
# En Windows:
.\venv\Scripts\activate
# En Mac/Linux:
source venv/bin/activate

# 4. Instala las dependencias usando requirements.txt
pip install -r requirements.txt

# 5. Configura las variables de entorno
# Crea un archivo .env y añade tu API Key de Groq (si vas a usar la nube)
echo "GROQ_API_KEY=gsk_tu_clave_aqui_..." > .env

# 6. Inicia el servidor
uvicorn main:app --reload

###############   FRONTEND ########################
# 1. Abre una nueva terminal y entra en la carpeta del frontend
cd frontend

# 2. Instala las dependencias del proyecto
# Esto leerá el package.json e instalará Next.js, React, Lucide, etc.
npm install

# (Opcional) Si necesitas instalar las librerías visuales manualmente:
npm install lucide-react react-markdown clsx tailwind-merge

# 3. Inicia la aplicación
npm run dev