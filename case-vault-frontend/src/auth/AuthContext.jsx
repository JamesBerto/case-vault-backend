import { useEffect, useState } from "react";
import { api, clearToken, getToken, setToken } from "../lib/api";
import { AuthContext } from "./context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => getToken() ? api("/users/me/access") : null)
      .then((profile) => {
        if (active) {
          setUser(profile);
          setAccessError("");
        }
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401 || error.status === 403) {
          clearToken();
          setUser(null);
          setAccessError("");
        } else {
          setAccessError(error.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [retryCount]);

  const retryAccess = () => {
    setLoading(true);
    setRetryCount((current) => current + 1);
  };

  useEffect(() => {
    const expired = () => setUser(null);
    window.addEventListener("case-vault-session-expired", expired);
    return () => window.removeEventListener("case-vault-session-expired", expired);
  }, []);

  useEffect(() => {
    if (!user) return;
    const renewSession = () => {
      api("/auth/heartbeat", { method: "POST" }).catch((error) => {
        if (error.status === 403) {
          clearToken();
          setUser(null);
        }
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") renewSession();
    };
    const timer = window.setInterval(renewSession, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user]);

  const finishLogin = async (result) => {
    if (!result.access_token) return result;
    setToken(result.access_token);
    try {
      const profile = await api("/users/me/access");
      setUser(profile);
      return result;
    } catch (error) {
      if (error.status === 401 || error.status === 403) clearToken();
      throw error;
    }
  };

  const login = async (email, password) => finishLogin(
    await api("/auth/login", { method: "POST", body: { email, password } }));
  const verifyTotp = async (challenge, code) => finishLogin(
    await api("/auth/totp/verify", { method: "POST", body: { challenge, code } }));

  const logout = async () => {
    try { await api("/auth/logout", { method: "POST" }); }
    catch (error) {
      if (error.status !== 401 && error.status !== 403) throw error;
    }
    clearToken();
    setUser(null);
  };
  return <AuthContext.Provider value={{ user, loading, accessError, retryAccess, login, verifyTotp, logout }}>{children}</AuthContext.Provider>;
}
