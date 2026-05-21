"use client";

// src/client/useSession.tsx
import { createContext, useContext, useState, useEffect } from "react";
import { jsx } from "react/jsx-runtime";
var SessionContext = createContext(void 0);
var SessionProvider = ({
  children,
  initialSession
}) => {
  const [session, setSession] = useState(
    initialSession || { authenticated: false }
  );
  const [status, setStatus] = useState(
    initialSession ? initialSession.authenticated ? "authenticated" : "unauthenticated" : "loading"
  );
  const fetchSession = async () => {
    try {
      setStatus("loading");
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
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