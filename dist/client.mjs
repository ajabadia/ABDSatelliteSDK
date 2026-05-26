"use client";
import {
  FederatedSessionSchema
} from "./chunk-SZEJBU4U.mjs";

// src/client/useSession.tsx
import { createContext, useContext, useState, useEffect } from "react";
import { jsx } from "react/jsx-runtime";
var SessionContext = createContext(void 0);
var SessionProvider = ({
  children,
  initialSession,
  refetchOnWindowFocus = true,
  pollInterval = 0
}) => {
  const [session, setSession] = useState(
    initialSession || { authenticated: false }
  );
  const [status, setStatus] = useState(
    initialSession ? initialSession.authenticated ? "authenticated" : "unauthenticated" : "loading"
  );
  const fetchSession = async (quiet = false) => {
    try {
      if (!quiet) setStatus("loading");
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const rawData = await res.json();
        const data = FederatedSessionSchema.parse(rawData);
        setSession(data);
        setStatus(data.authenticated ? "authenticated" : "unauthenticated");
      } else {
        setSession({ authenticated: false });
        setStatus("unauthenticated");
      }
    } catch (err) {
      console.error("[SDK_CLIENT_SESSION_FETCH_ERROR]", err);
      setSession({ authenticated: false });
      setStatus("unauthenticated");
    }
  };
  useEffect(() => {
    if (!initialSession) {
      fetchSession();
    }
  }, [initialSession]);
  useEffect(() => {
    if (!refetchOnWindowFocus) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchSession(true);
      }
    };
    const handleFocus = () => {
      fetchSession(true);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refetchOnWindowFocus]);
  useEffect(() => {
    if (pollInterval <= 0) return;
    const interval = setInterval(() => {
      fetchSession(true);
    }, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval]);
  return /* @__PURE__ */ jsx(SessionContext.Provider, { value: { session, status, update: fetchSession }, children });
};
function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
export {
  SessionProvider,
  useSession
};
//# sourceMappingURL=client.mjs.map