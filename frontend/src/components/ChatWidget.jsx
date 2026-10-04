/**
 * components/ChatWidget.jsx - Assistant CRM (bouton flottant + fenetre de discussion)
 * ----------------------------------------------------------------------------
 * - dialogue avec le moteur d'intentions du backend (POST /api/chatbot/message)
 * - l'etat de dialogue (`state`) est renvoye par le serveur a chaque reponse et
 *   rappele dans la requete suivante : le serveur reste sans memoire (Vercel)
 * - la conversation est conservee dans sessionStorage le temps de l'onglet
 * - reponses rapides, cartes cliquables, navigation automatique, rafraichissement
 *   des donnees apres une action d'ecriture
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Icon from "./Icon";
import { sendMessage, getChatbotStatus, clearChatHistory } from "../services/chatbot";

const STORAGE_KEY = "crm_chat_v1";

const WELCOME = {
  id: "welcome",
  role: "assistant",
  text: "Bonjour ! Je suis l'assistant de votre CRM. Posez-moi une question ou demandez-moi d'agir sur vos donnees.",
  quickReplies: ["Resume de mon activite", "Combien de clients actifs ?", "Qui dois-je relancer ?", "Que sais-tu faire ?"],
};

/** Rend **gras** sans jamais injecter de HTML. */
function renderInline(line) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  );
}

function MessageText({ text }) {
  const lines = String(text || "").split("\n");
  return (
    <div className="space-y-1 break-words">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-gray-400">&bull;</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function loadSaved() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return Array.isArray(saved.messages) ? saved : null;
  } catch {
    return null;
  }
}

export default function ChatWidget({ onDataChanged }) {
  const navigate = useNavigate();
  const saved = useRef(loadSaved());
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(saved.current?.messages?.length ? saved.current.messages : [WELCOME]);
  const [state, setState] = useState(saved.current?.state || null);
  const [sessionId, setSessionId] = useState(saved.current?.sessionId || null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // Persistance legere (derniers messages seulement)
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-40), state, sessionId }));
    } catch {
      /* stockage plein ou desactive : sans importance */
    }
  }, [messages, state, sessionId]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      if (!status) getChatbotStatus().then(setStatus).catch(() => {});
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const runActions = useCallback(
    (actions = []) => {
      actions.forEach((a) => {
        if (a.type === "refresh" && onDataChanged) onDataChanged();
        if (a.type === "navigate" && a.auto) navigate(a.to);
      });
    },
    [navigate, onDataChanged]
  );

  const send = useCallback(
    async (text) => {
      const message = (text ?? input).trim();
      if (!message || loading) return;
      setInput("");
      setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", text: message }]);
      setLoading(true);
      try {
        const data = await sendMessage({ message, sessionId, state });
        setState(data.state);
        setSessionId(data.sessionId);
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: data.reply,
            items: data.items,
            actions: data.actions,
            quickReplies: data.quickReplies,
            engine: data.engine,
            awaiting: data.awaiting,
          },
        ]);
        runActions(data.actions);
      } catch (err) {
        const msg = err.response?.data?.error || "Le service est momentanement indisponible. Reessayez dans un instant.";
        setMessages((m) => [...m, { id: `e-${Date.now()}`, role: "assistant", text: msg, error: true }]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, sessionId, state, runActions]
  );

  const reset = async () => {
    setMessages([WELCOME]);
    setState(null);
    setSessionId(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      await clearChatHistory();
      toast.success("Conversation effacee");
    } catch {
      /* l'historique serveur sera purge plus tard : sans importance */
    }
  };

  const lastIndex = messages.length - 1;
  const aiLabel = status?.ai?.enabled ? status.ai.active.map((p) => p.label).join(" / ") : null;

  return (
    <>
      {/* Bouton flottant */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg flex items-center justify-center text-2xl transition"
          aria-label="Ouvrir l'assistant"
        >
          <Icon name="chat-dots-fill" />
        </button>
      )}

      {/* Fenetre */}
      {open && (
        <div
          className="fixed z-40 inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[400px] sm:h-[600px] sm:max-h-[calc(100vh-2.5rem)] bg-white sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Assistant CRM"
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-primary-600 text-white">
            <Icon name="robot" className="text-xl" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold leading-tight">Assistant CRM</p>
              <p className="text-xs text-primary-100 truncate">
                {aiLabel ? `Moteur local + ${aiLabel}` : "Moteur local (sans service externe)"}
              </p>
            </div>
            <button onClick={reset} className="p-1.5 rounded hover:bg-white/15" title="Nouvelle conversation" aria-label="Nouvelle conversation">
              <Icon name="arrow-counterclockwise" />
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-white/15" aria-label="Fermer l'assistant">
              <Icon name="x-lg" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50">
            {messages.map((m, idx) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] ${m.role === "user" ? "" : "w-full"}`}>
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary-600 text-white rounded-br-sm"
                        : m.error
                        ? "bg-red-50 text-red-700 border border-red-100 rounded-bl-sm"
                        : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm"
                    }`}
                  >
                    <MessageText text={m.text} />
                  </div>

                  {/* Cartes cliquables */}
                  {m.items?.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {m.items.slice(0, 6).map((it) => (
                        <button
                          key={it.id}
                          onClick={() => navigate(it.to)}
                          className="w-full text-left px-3 py-2 bg-white border border-gray-200 hover:border-primary-300 rounded-lg transition flex items-center gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{it.title}</p>
                            {it.subtitle && <p className="text-xs text-gray-500 truncate">{it.subtitle}</p>}
                          </div>
                          {it.badge && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{it.badge}</span>}
                          <Icon name="chevron-right" className="text-gray-300" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Actions de navigation */}
                  {m.actions?.filter((a) => a.type === "navigate" && !a.auto).map((a, i) => (
                    <button key={i} onClick={() => navigate(a.to)} className="mt-2 text-xs text-primary-700 hover:underline">
                      <Icon name="box-arrow-up-right" /> {a.label || "Ouvrir"}
                    </button>
                  ))}

                  {/* Reponses rapides : uniquement sur le dernier message */}
                  {idx === lastIndex && m.role === "assistant" && m.quickReplies?.length > 0 && !loading && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.quickReplies.map((q) => (
                        <button
                          key={q}
                          onClick={() => send(q)}
                          className="text-xs px-2.5 py-1.5 rounded-full border border-primary-200 text-primary-700 bg-white hover:bg-primary-50 transition"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}

                  {m.engine && m.engine !== "local" && (
                    <p className="mt-1 text-[10px] text-gray-400">
                      <Icon name="stars" /> Reponse generee par {m.engine === "openai" ? "OpenAI" : "Anthropic"}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 bg-white border border-gray-200 rounded-2xl rounded-bl-sm shadow-sm text-gray-400" aria-live="polite">
                  <Icon name="three-dots" className="animate-pulse text-lg" title="L'assistant ecrit" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="p-3 border-t border-gray-200 bg-white flex items-center gap-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder="Ecrivez votre demande..."
              className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-full text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              aria-label="Votre message"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="w-10 h-10 rounded-full bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white flex items-center justify-center transition"
              aria-label="Envoyer"
            >
              <Icon name="send-fill" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
