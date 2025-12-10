"use client";

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Leaf,
  User,
  Menu,
  X,
  Cpu,
  Cloud,
  ChevronDown,
  MessageCircle,
  Zap,
  Sprout,
  Loader2,
  AlertTriangle,
  FileText,
  Upload,
  Trash2,
  Plus
} from 'lucide-react';

const App = () => {
  const [conversations, setConversations] = useState([
    {
      id: 1,
      title: "Bienvenida",
      messages: [
        {
          id: 1,
          text: "¡Hola! Soy NutriBot 🌱. Estoy conectado a tu backend Python (FastAPI). Puedes subirme un PDF para que lo analice.",
          sender: 'bot',
          timestamp: new Date()
        }
      ],
      pdfContext: null,
      createdAt: new Date()
    }
  ]);

  const [currentConversationId, setCurrentConversationId] = useState(1);
  const [inputText, setInputText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const [selectedModel, setSelectedModel] = useState({
    id: 'llama3.2:1b',
    name: 'Llama 3.2 1B',
    type: 'local',
    provider: 'Local (Ollama)'
  });

  const messagesEndRef = useRef(null);
  const modelMenuRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- CONFIGURACIÓN DE MODELOS ---
  const models = [
    { type: 'header', label: 'Local' },
    { id: 'llama3.2:1b', name: 'Llama 3.2 1B', type: 'local', provider: 'Local (Ollama)', icon: Cpu },
    { type: 'header', label: 'Nube' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', type: 'api', provider: 'Groq Cloud', icon: Cloud },
  ];

  // --- PERSISTENCIA DE DATOS (LocalStorage) ---

  // 1. Cargar datos al iniciar
  useEffect(() => {
    const savedConversations = localStorage.getItem('nutribot_conversations');
    // Ya no cargamos apiKey del localStorage
    const savedModel = localStorage.getItem('nutribot_selected_model');

    if (savedConversations) {
      try {
        const parsed = JSON.parse(savedConversations).map(c => ({
          ...c,
          createdAt: new Date(c.createdAt),
          messages: c.messages.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        }));
        setConversations(parsed);
        if (parsed.length > 0) setCurrentConversationId(parsed[parsed.length - 1].id);
      } catch (e) {
        console.error("Error cargando historial:", e);
      }
    }

    if (savedModel) setSelectedModel(JSON.parse(savedModel));
  }, []);

  // 2. Guardar automáticamente cuando cambian los datos
  useEffect(() => {
    localStorage.setItem('nutribot_conversations', JSON.stringify(conversations));
  }, [conversations]);

  // Eliminado useEffect de guardar apiKey
  useEffect(() => {
    localStorage.setItem('nutribot_selected_model', JSON.stringify(selectedModel));
  }, [selectedModel]);

  // ----------------------------------------------------

  // Obtener la conversación actual
  const currentConversation = conversations.find(c => c.id === currentConversationId);
  const messages = currentConversation?.messages || [];
  const pdfContext = currentConversation?.pdfContext || null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Crear nueva conversación
  const handleNewConversation = () => {
    const newId = Date.now();
    const newConversation = {
      id: newId,
      title: `Conversación ${conversations.length + 1}`,
      messages: [
        {
          id: newId + 1,
          text: "¡Hola! Soy NutriBot 🌱. ¿En qué puedo ayudarte hoy?",
          sender: 'bot',
          timestamp: new Date()
        }
      ],
      pdfContext: null,
      createdAt: new Date()
    };

    setConversations(prev => [...prev, newConversation]);
    setCurrentConversationId(newId);
    setIsSidebarOpen(false);
  };

  // Cambiar de conversación
  const handleSelectConversation = (id) => {
    setCurrentConversationId(id);
    setIsSidebarOpen(false);
  };

  // Eliminar conversación
  const handleDeleteConversation = (id, e) => {
    e.stopPropagation();
    if (conversations.length === 1) {
      alert("No puedes eliminar la última conversación");
      return;
    }

    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (currentConversationId === id) {
        setCurrentConversationId(filtered[0].id);
      }
      return filtered;
    });
  };

  // Actualizar título de conversación automáticamente
  const updateConversationTitle = (conversationId, firstUserMessage) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id === conversationId && conv.title.startsWith('Conversación')) {
        const title = firstUserMessage.length > 30
          ? firstUserMessage.substring(0, 30) + '...'
          : firstUserMessage;
        return { ...conv, title };
      }
      return conv;
    }));
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pdf')) {
      const errorMsg = {
        id: Date.now(),
        text: "Por favor, sube solo archivos PDF.",
        sender: 'bot',
        isError: true,
        timestamp: new Date()
      };

      setConversations(prev => prev.map(conv =>
        conv.id === currentConversationId
          ? { ...conv, messages: [...conv.messages, errorMsg] }
          : conv
      ));
      return;
    }

    setIsUploadingPdf(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/upload-pdf', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Error al subir PDF: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        const newPdfContext = {
          filename: data.filename,
          text: data.text,
          preview: data.preview
        };

        const successMsg = {
          id: Date.now(),
          text: `✅ PDF "${data.filename}" cargado correctamente. Ahora puedes hacerme preguntas sobre su contenido.\n\nVista previa: ${data.preview}`,
          sender: 'bot',
          timestamp: new Date()
        };

        setConversations(prev => prev.map(conv =>
          conv.id === currentConversationId
            ? { ...conv, messages: [...conv.messages, successMsg], pdfContext: newPdfContext }
            : conv
        ));
      }

    } catch (err) {
      console.error(err);
      const errorMsg = {
        id: Date.now(),
        text: `Error al procesar el PDF: ${err.message}`,
        sender: 'bot',
        isError: true,
        timestamp: new Date()
      };

      setConversations(prev => prev.map(conv =>
        conv.id === currentConversationId
          ? { ...conv, messages: [...conv.messages, errorMsg] }
          : conv
      ));
    } finally {
      setIsUploadingPdf(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePdf = () => {
    const removeMsg = {
      id: Date.now(),
      text: "PDF eliminado. Puedes subir otro o continuar la conversación normal.",
      sender: 'bot',
      timestamp: new Date()
    };

    setConversations(prev => prev.map(conv =>
      conv.id === currentConversationId
        ? { ...conv, messages: [...conv.messages, removeMsg], pdfContext: null }
        : conv
    ));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userText = inputText;
    setInputText("");

    // 1. Añadimos SOLO el mensaje del usuario
    const newUserMsg = {
      id: Date.now(),
      text: userText,
      sender: 'user',
      timestamp: new Date()
    };

    // ID anticipado para el mensaje del bot
    const botMsgId = Date.now() + 1;

    // Actualizamos conversación solo con el mensaje del usuario
    setConversations(prev => prev.map(conv =>
      conv.id === currentConversationId
        ? { ...conv, messages: [...conv.messages, newUserMsg] }
        : conv
    ));

    const userMessagesCount = messages.filter(m => m.sender === 'user').length;
    if (userMessagesCount === 0) updateConversationTitle(currentConversationId, userText);

    // ACTIVAMOS "PENSANDO" (Pero no creamos burbuja del bot aún)
    setIsLoading(true);
    setIsThinking(true);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          model: selectedModel,
          apiKey: "",
          pdfContext: pdfContext?.text || null
        })
      });

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let fullText = "";
      
      const typingDelay = 10; 
      let isFirstChunk = true; // Bandera de control

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          
          for (let i = 0; i < chunk.length; i++) {
            fullText += chunk[i];

            // SI ES LA PRIMERA LETRA:
            // 1. Quitamos "Pensando"
            // 2. Creamos la burbuja del bot por primera vez
            if (isFirstChunk) {
                setIsThinking(false);
                
                const newBotMsg = {
                    id: botMsgId,
                    text: fullText,
                    sender: 'bot',
                    timestamp: new Date()
                };

                setConversations(prev => prev.map(conv => 
                    conv.id === currentConversationId 
                    ? { ...conv, messages: [...conv.messages, newBotMsg] } 
                    : conv
                ));
                
                isFirstChunk = false; // Ya no es el primer chunk
            } else {
                // SI YA EXISTE LA BURBUJA: Solo actualizamos el texto
                setConversations(prev => prev.map(conv => {
                    if (conv.id !== currentConversationId) return conv;
                    
                    const updatedMessages = conv.messages.map(msg => {
                        if (msg.id === botMsgId) {
                            return { ...msg, text: fullText };
                        }
                        return msg;
                    });
                    return { ...conv, messages: updatedMessages };
                }));
            }

            if (typingDelay > 0) {
              await new Promise(resolve => setTimeout(resolve, typingDelay));
            }
          }
        }
      }

    } catch (err) {
      console.error(err);
      const errorMsg = {
        id: Date.now() + 2,
        text: `⚠️ Error: ${err.message}`,
        sender: 'bot',
        isError: true,
        timestamp: new Date()
      };

      // Si falló antes de crear la burbuja, la añadimos ahora.
      // Si falló después, reemplazamos.
      setConversations(prev => prev.map(conv => {
        if (conv.id !== currentConversationId) return conv;
        
        // Comprobamos si el mensaje del bot llegó a crearse
        const botMsgExists = conv.messages.some(m => m.id === botMsgId);
        
        if (botMsgExists) {
             // Si existe, lo borramos para poner el error (opcional, o añadimos el error debajo)
             const cleanMsgs = conv.messages.filter(m => m.id !== botMsgId);
             return { ...conv, messages: [...cleanMsgs, errorMsg] };
        } else {
             // Si no existía, simplemente añadimos el error
             return { ...conv, messages: [...conv.messages, errorMsg] };
        }
      }));

    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  const handleModelSelect = (model) => {
    setSelectedModel(model);
    setIsModelMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-stone-900 text-stone-100 font-sans overflow-hidden selection:bg-emerald-500 selection:text-white">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-emerald-950 border-r border-emerald-900 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static flex flex-col shadow-2xl`}>
        <div className="p-4 border-b border-emerald-900 flex items-center justify-between bg-emerald-950/50">
          <h2 className="text-xl font-bold text-emerald-100 flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <Leaf size={20} className="text-white" />
            </div>
            NutriBot
          </h2>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-emerald-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Botón Nueva Conversación */}
        <div className="p-4 border-b border-emerald-900/30">
          <button
            onClick={handleNewConversation}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-95"
          >
            <Plus size={20} />
            <span>Nueva Conversación</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
            Historial <Sprout size={12} />
          </div>

          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group relative w-full text-left p-3 rounded-xl transition-all border text-sm ${conv.id === currentConversationId
                ? 'bg-emerald-900/50 border-emerald-700 text-emerald-100'
                : 'bg-emerald-900/20 hover:bg-emerald-900/40 border-emerald-800/30 hover:border-emerald-700 text-emerald-200'
                }`}
            >
              <button
                onClick={() => handleSelectConversation(conv.id)}
                className="w-full flex items-start gap-3"
              >
                <MessageCircle
                  size={16}
                  className={`mt-0.5 flex-shrink-0 ${conv.id === currentConversationId
                    ? 'text-emerald-400'
                    : 'text-emerald-500 group-hover:text-emerald-400'
                    }`}
                />
                <div className="flex-1 min-w-0">
                  <span className="line-clamp-2 break-words">{conv.title}</span>
                  {conv.pdfContext && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-400/70">
                      <FileText size={10} />
                      <span className="truncate">{conv.pdfContext.filename}</span>
                    </div>
                  )}
                </div>
              </button>

              {conversations.length > 1 && (
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-900/30 rounded-lg transition-all text-red-400 hover:text-red-300"
                  title="Eliminar conversación"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-emerald-900 bg-emerald-950/80">

          {selectedModel.type === 'local' && (
            <div className="mb-4 text-[10px] text-emerald-400/70 p-2 bg-emerald-900/20 rounded border border-emerald-900/50">
              Python contactará a Ollama (Local)
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-emerald-400/60 font-medium">
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-bounce' : 'bg-emerald-500 animate-pulse'} shadow-[0_0_8px_rgba(16,185,129,0.5)]`}></div>
            {isLoading ? 'Conectando a Python...' : 'Backend Online'}
          </div>
        </div>
      </div>

      {/* Overlay Móvil */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm z-20 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col h-full relative bg-stone-900">

        {/* Header */}
        <header className="h-16 border-b border-emerald-900/30 bg-stone-900/95 backdrop-blur flex items-center justify-between px-4 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-emerald-400 hover:bg-emerald-900/20 rounded-lg transition-colors">
              <Menu size={20} />
            </button>
            <div className="md:hidden font-bold text-emerald-100 flex items-center gap-2">
              <Leaf size={18} className="text-emerald-500" /> NutriBot
            </div>
          </div>

          <div className="relative" ref={modelMenuRef}>
            <button
              onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
              className="flex items-center gap-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 px-3 py-1.5 rounded-full transition-all text-sm font-medium min-w-[200px] justify-between group shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                {selectedModel.type === 'local'
                  ? <Cpu size={16} className="text-emerald-400" />
                  : <Cloud size={16} className="text-sky-400" />
                }
                <span className="truncate max-w-[130px] group-hover:text-white transition-colors">{selectedModel.name}</span>
              </div>
              <ChevronDown size={14} className={`text-stone-500 group-hover:text-stone-300 transition-transform duration-200 ${isModelMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isModelMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-stone-800 border border-stone-700 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/5">
                <div className="max-h-[350px] overflow-y-auto py-2">
                  {models.map((item, index) => {
                    if (item.type === 'header') {
                      return (
                        <div key={index} className="px-4 py-2 text-[10px] font-bold text-stone-500 uppercase tracking-wider bg-stone-800 sticky top-0">
                          {item.label}
                        </div>
                      );
                    }
                    const Icon = item.icon;
                    const isSelected = selectedModel.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleModelSelect(item)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-stone-700/50 transition-all ${isSelected ? 'bg-emerald-500/10' : ''}`}
                      >
                        <div className={`p-2 rounded-lg transition-colors ${isSelected
                          ? (item.type === 'local' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400')
                          : 'bg-stone-700/50 text-stone-400'
                          }`}>
                          <Icon size={16} />
                        </div>
                        <div className="flex-1">
                          <div className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-stone-300'}`}>{item.name}</div>
                          <div className="text-[10px] text-stone-500">{item.provider}</div>
                        </div>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* PDF Info Banner */}
        {pdfContext && (
          <div className="bg-emerald-900/20 border-b border-emerald-800/30 p-3">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText size={20} className="text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-100 truncate">{pdfContext.filename}</p>
                  <p className="text-xs text-emerald-400/70">PDF cargado - Puedes hacer preguntas sobre su contenido</p>
                </div>
              </div>
              <button
                onClick={handleRemovePdf}
                className="p-2 hover:bg-red-900/30 rounded-lg transition-colors text-red-400 hover:text-red-300 flex-shrink-0"
                title="Eliminar PDF"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-stone-800/30 via-stone-900 to-stone-900">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-4 max-w-3xl mx-auto ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${msg.sender === 'user'
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                : (msg.isError ? 'bg-red-900/50 border border-red-700' : 'bg-gradient-to-br from-stone-700 to-stone-800 border border-stone-600')
                }`}>
                {msg.sender === 'user' ? <User size={20} className="text-white" /> : (msg.isError ? <AlertTriangle size={20} className="text-red-400" /> : <Leaf size={20} className="text-emerald-400" />)}
              </div>

              <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <span className="text-xs text-stone-400 font-medium">
                    {msg.sender === 'user' ? 'Tú' : 'NutriBot'}
                  </span>
                  <span className="text-[10px] text-stone-600">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-md max-w-[90%] sm:max-w-lg transition-all ${msg.sender === 'user'
                  ? 'bg-emerald-600 text-white rounded-tr-sm'
                  : (msg.isError ? 'bg-red-900/30 text-red-200 border border-red-800/50' : 'bg-stone-800 text-stone-200 border border-stone-700/50 rounded-tl-sm')
                  }`}>
                  <div className="whitespace-pre-wrap">
                    <ReactMarkdown>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>

              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex items-start gap-4 max-w-3xl mx-auto">
              <div className="w-10 h-10 rounded-2xl bg-stone-800 border border-stone-700 flex items-center justify-center">
                <Loader2 size={20} className="text-emerald-500 animate-spin" />
              </div>
              <div className="bg-stone-800/50 text-stone-400 px-4 py-3 rounded-2xl rounded-tl-sm text-sm border border-stone-700/30">
                {isUploadingPdf ? 'Procesando PDF...' : 'Pensando...'}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-stone-900 border-t border-stone-800">
          <div className="max-w-3xl mx-auto relative">
            <form onSubmit={handleSendMessage} className="relative flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPdf || isLoading}
                className="p-3 bg-stone-800 hover:bg-stone-700 text-emerald-400 hover:text-emerald-300 rounded-xl border border-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg flex-shrink-0"
                title="Subir PDF"
              >
                {isUploadingPdf ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
              </button>
              <div className="absolute left-16 top-1/2 -translate-y-1/2 text-stone-500">
                <Zap size={18} className={selectedModel.type === 'local' ? 'text-emerald-500' : 'text-sky-500'} />
              </div>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={pdfContext ? `Pregunta sobre "${pdfContext.filename}"...` : `Pregunta a ${selectedModel.name} sobre salud...`}
                disabled={isLoading || isUploadingPdf}
                className="w-full bg-stone-800/80 text-stone-100 placeholder-stone-500 rounded-2xl py-4 pl-12 pr-14 border border-stone-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading || isUploadingPdf}
                className="absolute right-2 p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95"
              >
                <Send size={18} />
              </button>
            </form>
            <div className="text-center mt-3 flex justify-center items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-yellow-400' : 'bg-emerald-500'}`}></span>
              <p className="text-[10px] text-stone-500 font-medium tracking-wide uppercase">
                {selectedModel.type === 'local' ? 'Modo Privado' : 'Modo Nube'} • {selectedModel.name} {pdfContext && '• PDF Activo'}
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;