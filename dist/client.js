"use strict";Object.defineProperty(exports, "__esModule", {value: true});"use client";


var _chunkWCPFHMSBjs = require('./chunk-WCPFHMSB.js');

// src/client/useSession.tsx
var _react = require('react');
var _jsxruntime = require('react/jsx-runtime');
var SessionContext = _react.createContext.call(void 0, void 0);
var SessionProvider = ({
  children,
  initialSession,
  refetchOnWindowFocus = true,
  pollInterval = 0
}) => {
  const [session, setSession] = _react.useState.call(void 0, 
    initialSession || { authenticated: false }
  );
  const [status, setStatus] = _react.useState.call(void 0, 
    initialSession ? initialSession.authenticated ? "authenticated" : "unauthenticated" : "loading"
  );
  const fetchSession = async (quiet = false) => {
    try {
      if (!quiet) setStatus("loading");
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (res.ok) {
        const rawData = await res.json();
        const data = _chunkWCPFHMSBjs.FederatedSessionSchema.parse(rawData);
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
  _react.useEffect.call(void 0, () => {
    if (!initialSession) {
      fetchSession();
    }
  }, [initialSession]);
  _react.useEffect.call(void 0, () => {
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
  _react.useEffect.call(void 0, () => {
    if (pollInterval <= 0) return;
    const interval = setInterval(() => {
      fetchSession(true);
    }, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval]);
  return /* @__PURE__ */ _jsxruntime.jsx.call(void 0, SessionContext.Provider, { value: { session, status, update: fetchSession }, children });
};
function useSession() {
  const context = _react.useContext.call(void 0, SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}



exports.SessionProvider = SessionProvider; exports.useSession = useSession;
//# sourceMappingURL=client.js.map