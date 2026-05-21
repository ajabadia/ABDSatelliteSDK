"use strict";
"use client";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.ts
var client_exports = {};
__export(client_exports, {
  SessionProvider: () => SessionProvider,
  useSession: () => useSession
});
module.exports = __toCommonJS(client_exports);

// src/client/useSession.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var SessionContext = (0, import_react.createContext)(void 0);
var SessionProvider = ({
  children,
  initialSession
}) => {
  const [session, setSession] = (0, import_react.useState)(
    initialSession || { authenticated: false }
  );
  const [status, setStatus] = (0, import_react.useState)(
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
  (0, import_react.useEffect)(() => {
    if (!initialSession) {
      fetchSession();
    }
  }, [initialSession]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SessionContext.Provider, { value: { session, status, update: fetchSession }, children });
};
function useSession() {
  const context = (0, import_react.useContext)(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SessionProvider,
  useSession
});
//# sourceMappingURL=client.js.map