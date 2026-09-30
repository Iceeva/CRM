/**
 * context/AuthContext.js - Contexte d'authentification global
 */
import { createContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Charger l'utilisateur depuis le token stocké
  useEffect(() => {
    const token = localStorage.getItem("crm_token");
    const saved = localStorage.getItem("crm_user");

    if (token && saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem("crm_user");
      }
      // Vérifier le token côté serveur
      api
        .get("/auth/me")
        .then((res) => {
          setUser(res.data);
          localStorage.setItem("crm_user", JSON.stringify(res.data));
        })
        .catch(() => {
          localStorage.removeItem("crm_token");
          localStorage.removeItem("crm_user");
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("crm_token", res.data.token);
    localStorage.setItem("crm_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  }, []);

  const register = useCallback(async (nom, email, password) => {
    const res = await api.post("/auth/register", { nom, email, password });
    localStorage.setItem("crm_token", res.data.token);
    localStorage.setItem("crm_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
