/**
 * hooks/useStorageStatus.js
 * Vérifie périodiquement le mode de stockage (PostgreSQL / JSON)
 * et déclenche des toasts quand il change.
 */
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import api from "../services/api";

export default function useStorageStatus(intervalMs = 30000) {
  const [mode, setMode] = useState(null); // "postgresql" | "json"
  const prevMode = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const res = await api.get("/dashboard/status");
        if (!mounted) return;
        const newMode = res.data.storageMode;
        setMode(newMode);

        // Si le mode a changé, afficher un toast
        if (prevMode.current !== null && prevMode.current !== newMode) {
          if (newMode === "postgresql") {
            toast.success("Connexion rétablie. Utilisation de PostgreSQL.", {
              duration: 5000,
              icon: "🐘",
            });
          } else {
            toast("Connexion à la base de données indisponible. Mode local activé (JSON).", {
              duration: 6000,
              icon: "⚠️",
              style: { background: "#fef3c7", color: "#92400e" },
            });
          }
        } else if (prevMode.current === null && newMode === "json") {
          // Premier chargement en mode JSON
          toast("Connexion à la base de données indisponible. Mode local activé (JSON).", {
            duration: 6000,
            icon: "⚠️",
            style: { background: "#fef3c7", color: "#92400e" },
          });
        }

        prevMode.current = newMode;
      } catch {
        // API inaccessible
      }
    }

    check();
    const timer = setInterval(check, intervalMs);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return mode;
}
