var DAP = (function (exports) {
  'use strict';

  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/http.ts
  async function http(cfg, path, opts = {}) {
    const method = (opts.method || "GET").toUpperCase();
    const headers = {
      "X-Api-Key": cfg.apikey,
      ...opts.includeHostHeader && opts.hostBase ? { "X-Host-Url": opts.hostBase } : {},
      ...opts.headers || {}
    };
    let bodyInit;
    if (method !== "GET" && opts.body !== void 0) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      bodyInit = JSON.stringify(opts.body);
    }
    const url = isAbsoluteUrl(path) ? path : new URL(path, location.origin).toString();
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), opts.timeoutMs ?? 15e3);
    let res;
    try {
      res = await fetch(url, { method, headers, body: bodyInit, signal: c.signal, credentials: "omit", cache: "no-cache" });
    } catch (err) {
      clearTimeout(t);
      throw err;
    }
    clearTimeout(t);
    if (!res.ok) {
      const e = new Error(`HTTP ${res.status}`);
      e.status = res.status;
      try {
        e.body = await res.text();
      } catch {
      }
      throw e;
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    if (ct.startsWith("text/")) return res.text();
    return res;
  }
  function isAbsoluteUrl(u) {
    return /^https?:\/\//i.test(u) || u.startsWith("blob:") || u.startsWith("data:");
  }
  var init_http = __esm({
    "src/http.ts"() {
    }
  });

  // src/services/userContextService.ts
  var _UserContextService, UserContextService, userContextService;
  var init_userContextService = __esm({
    "src/services/userContextService.ts"() {
      _UserContextService = class _UserContextService {
        constructor() {
          this._user = null;
          this._fallbackUserId = null;
          this._eventListeners = [];
          this.SESSION_STORAGE_KEY = "dap_user_context";
          this.FALLBACK_USER_KEY = "dap_anonymous_user_id";
          this.initializeFromStorage();
          if (!this._user) {
            this.autoDiscoverUser();
          }
          console.debug("[DAP UserContext] Service initialized");
        }
        /**
         * Get singleton instance
         */
        static getInstance() {
          if (!this._instance) {
            this._instance = new _UserContextService();
          }
          return this._instance;
        }
        /**
         * Initialize user context from sessionStorage
         */
        initializeFromStorage() {
          try {
            const storedUser = sessionStorage.getItem(this.SESSION_STORAGE_KEY);
            if (storedUser) {
              this._user = JSON.parse(storedUser);
              console.debug("[DAP UserContext] Restored user from storage:", this._user?.id);
            }
            this._fallbackUserId = sessionStorage.getItem(this.FALLBACK_USER_KEY);
            if (!this._fallbackUserId) {
              this._fallbackUserId = this.generateFallbackUserId();
              sessionStorage.setItem(this.FALLBACK_USER_KEY, this._fallbackUserId);
              console.debug("[DAP UserContext] Generated fallback user ID:", this._fallbackUserId);
            }
          } catch (error) {
            console.error("[DAP UserContext] Error initializing from storage:", error);
            this._fallbackUserId = this.generateFallbackUserId();
          }
        }
        /**
         * Generate a stable unique fallback user ID
         */
        generateFallbackUserId() {
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 15);
          return `dap-anon-${timestamp}-${random}`;
        }
        /**
         * Set user context (replaces existing user)
         */
        setUser(user) {
          const normalizedUser = this.normalizeUser(user);
          if (!normalizedUser || !normalizedUser.id) {
            console.error("[DAP UserContext] Invalid user - id is required");
            return;
          }
          const previousUser = this._user;
          this._user = normalizedUser;
          try {
            sessionStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(this._user));
          } catch (error) {
            console.error("[DAP UserContext] Error persisting user:", error);
          }
          console.debug("[DAP UserContext] User set:", this._user.id);
          this.notifyListeners({ type: "user-changed", user: this._user, previousUser });
        }
        /**
         * Update user context (merge with existing data)
         */
        updateUser(partialUser) {
          if (!this._user) {
            console.warn("[DAP UserContext] Cannot update - no user context available");
            return;
          }
          const previousUser = { ...this._user };
          this._user = {
            ...this._user,
            ...partialUser,
            // Merge attributes specifically
            attributes: {
              ...this._user.attributes,
              ...partialUser.attributes
            }
          };
          try {
            sessionStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(this._user));
          } catch (error) {
            console.error("[DAP UserContext] Error persisting updated user:", error);
          }
          console.debug("[DAP UserContext] User updated:", this._user.id);
          this.notifyListeners({ type: "user-changed", user: this._user, previousUser });
        }
        /**
         * Helper to normalize user data from various possible formats
         */
        normalizeUser(data) {
          if (!data) return null;
          if (typeof data === "string") {
            return { id: data };
          }
          const email = data.usermail || data.email || data.mailid || data.email_address || data.emailAddress || data.upn || data.unique_name;
          const id = email || data.id || data.userId || data.userid || data.sub || data.user_id;
          if (!id) return null;
          const role = data.role || data.userRole || data.user_role;
          const attributes = { ...data.attributes || {} };
          const knownFields = [
            "id",
            "userId",
            "userid",
            "sub",
            "user_id",
            "email",
            "usermail",
            "mailid",
            "emailAddress",
            "email_address",
            "role",
            "userRole",
            "user_role",
            "attributes",
            "username",
            "upn",
            "unique_name"
          ];
          Object.keys(data).forEach((key) => {
            if (!knownFields.includes(key) && (typeof data[key] === "string" || typeof data[key] === "number" || typeof data[key] === "boolean")) {
              attributes[key] = String(data[key]);
            }
          });
          if (data.username && !attributes.username) attributes.username = String(data.username);
          return {
            id: String(id),
            // Now this will be the email address if found
            email: email ? String(email) : void 0,
            role: role ? String(role) : void 0,
            attributes
          };
        }
        /**
         * Attempt to discover user identity from the host environment
         */
        autoDiscoverUser() {
          if (this.hasRealUser() && this._user?.id && !this._user.id.startsWith("dap-anon-")) {
            return false;
          }
          console.debug("[DAP UserContext] Attempting auto-discovery...");
          const windowObj = window;
          const candidates = [
            windowObj.DAP_USER,
            windowObj.appUser,
            windowObj.currentUser,
            {
              id: windowObj.usermail || windowObj.userEmail || windowObj.email || windowObj.userId || windowObj.userid || windowObj.user_id,
              username: windowObj.username || windowObj.userName,
              email: windowObj.usermail || windowObj.userEmail || windowObj.mailid || windowObj.email
            }
          ];
          for (const candidate of candidates) {
            if (!candidate) continue;
            const normalized = this.normalizeUser(candidate);
            if (normalized && normalized.id && typeof normalized.id === "string" && normalized.id.length > 0) {
              console.debug("[DAP UserContext] Auto-discovered user:", normalized.id);
              this.setUser(normalized);
              return true;
            }
          }
          const metaUserId = document.querySelector('meta[name="dap-user-id"]')?.getAttribute("content") || document.querySelector('meta[name="user-id"]')?.getAttribute("content") || document.querySelector('meta[name="userid"]')?.getAttribute("content");
          if (metaUserId) {
            console.debug("[DAP UserContext] Auto-discovered user from meta tag:", metaUserId);
            const user = { id: metaUserId };
            const metaEmail = document.querySelector('meta[name="user-email"]')?.getAttribute("content") || document.querySelector('meta[name="email"]')?.getAttribute("content");
            if (metaEmail) user.email = metaEmail;
            const metaRole = document.querySelector('meta[name="user-role"]')?.getAttribute("content") || document.querySelector('meta[name="role"]')?.getAttribute("content");
            if (metaRole) user.role = metaRole;
            this.setUser(user);
            return true;
          }
          return false;
        }
        /**
         * Get current user context
         */
        getUser() {
          return this._user ? { ...this._user } : null;
        }
        /**
         * Clear user context (reverts to anonymous)
         */
        clearUser() {
          const previousUser = this._user;
          this._user = null;
          try {
            sessionStorage.removeItem(this.SESSION_STORAGE_KEY);
          } catch (error) {
            console.error("[DAP UserContext] Error clearing user storage:", error);
          }
          console.debug("[DAP UserContext] User context cleared");
          this.notifyListeners({ type: "user-cleared", user: null, previousUser });
        }
        /**
         * Check if real user context is available (not anonymous)
         */
        hasRealUser() {
          return this._user !== null;
        }
        /**
         * Get analytics context for tracking
         */
        getAnalyticsContext() {
          if (this._user) {
            return {
              userId: this._user.id,
              // Current ID is the email address (per normalization logic)
              role: this._user.role,
              attributes: this._user.attributes,
              isAnonymous: false
            };
          } else {
            return {
              userId: this._fallbackUserId || "unknown",
              isAnonymous: true
            };
          }
        }
        /**
         * Get user property for rule evaluation
         * Supports: user.id, user.role, user.email, user.attributes.*
         */
        getUserProperty(propertyPath) {
          if (!propertyPath.startsWith("user.")) {
            return null;
          }
          const path = propertyPath.substring(5);
          if (!this._user) {
            if (path === "id" || path === "usermail") {
              return this._fallbackUserId;
            }
            console.debug(`[DAP UserContext] Property ${propertyPath} not available - no user context`);
            return null;
          }
          switch (path) {
            case "id":
            case "usermail":
              return this._user.id;
            case "role":
              return this._user.role || null;
            case "email":
              return this._user.email || null;
            default:
              if (path.startsWith("attributes.")) {
                const attributeKey = path.substring(11);
                return this._user.attributes?.[attributeKey] || null;
              }
              console.warn(`[DAP UserContext] Unknown property path: ${propertyPath}`);
              return null;
          }
        }
        /**
         * Subscribe to user context changes
         */
        onUserChange(callback) {
          this._eventListeners.push(callback);
          return () => {
            const index = this._eventListeners.indexOf(callback);
            if (index > -1) {
              this._eventListeners.splice(index, 1);
            }
          };
        }
        /**
         * Notify all listeners of user context changes
         */
        notifyListeners(event) {
          this._eventListeners.forEach((callback) => {
            try {
              callback(event);
            } catch (error) {
              console.error("[DAP UserContext] Error in change listener:", error);
            }
          });
        }
        /**
         * Debug method to get current state
         */
        getDebugState() {
          return {
            hasUser: this.hasRealUser(),
            userId: this._user?.id || this._fallbackUserId,
            userRole: this._user?.role,
            isAnonymous: !this.hasRealUser(),
            attributeCount: Object.keys(this._user?.attributes || {}).length
          };
        }
      };
      _UserContextService._instance = null;
      UserContextService = _UserContextService;
      userContextService = UserContextService.getInstance();
    }
  });

  // src/flows.ts
  var flows_exports = {};
  __export(flows_exports, {
    fetchFlowById: () => fetchFlowById,
    fetchVisibleFlowIds: () => fetchVisibleFlowIds
  });
  async function fetchVisibleFlowIds(cfg, hostBase, page) {
    const base = joinUrl(cfg.apiurl, `/iap-experience/${cfg.organizationid}/${cfg.siteid}/visible-flows`);
    try {
      const res = await http(cfg, base, {
        method: "POST",
        hostBase,
        includeHostHeader: true,
        body: {
          hostname: hostBase,
          page: page ?? null,
          userId: userContextService.getAnalyticsContext().userId
        }
      });
      return Array.isArray(res) ? res : [];
    } catch (e) {
      if (e && e.status === 405) {
        const url = `${base}?hostname=${encodeURIComponent(hostBase)}`;
        const res = await http(cfg, url, {
          method: "GET",
          hostBase,
          includeHostHeader: true
        });
        return Array.isArray(res?.flowIds) ? res.flowIds : [];
      }
      throw e;
    }
  }
  async function fetchFlowById(cfg, hostBase, flowId, previewSessionId) {
    const baseUrl = joinUrl(cfg.apiurl, `/iap-experience/${cfg.organizationid}/${cfg.siteid}/flows/${flowId}`);
    const url = previewSessionId ? `${baseUrl}?previewSessionId=${encodeURIComponent(previewSessionId)}` : baseUrl;
    return http(cfg, url, { method: "GET", hostBase, includeHostHeader: true });
  }
  function joinUrl(base, tail) {
    const b = (base || "").replace(/\/+$/, "");
    const t = (tail || "").replace(/^\/+/, "");
    return `${b}/${t}`;
  }
  var init_flows = __esm({
    "src/flows.ts"() {
      init_http();
      init_userContextService();
    }
  });

  // src/experiences/registry.ts
  var registry_exports = {};
  __export(registry_exports, {
    getRenderer: () => getRenderer,
    register: () => register,
    resetRegistry: () => resetRegistry
  });
  function register(type, renderer) {
    REGISTRY.set(type, renderer);
  }
  function getRenderer(type) {
    return REGISTRY.get(type);
  }
  function resetRegistry() {
    REGISTRY.clear();
  }
  var REGISTRY;
  var init_registry = __esm({
    "src/experiences/registry.ts"() {
      REGISTRY = /* @__PURE__ */ new Map();
    }
  });

  // src/utils/immediateValidationPrevention.ts
  var DAP_FORM_CLASSES = [
    "dap-survey-form",
    "dap-modal-form",
    "dap-popover-form",
    "dap-sequence-form"
  ];
  function isDapManagedElement(el) {
    if (!el) return false;
    const form = el.closest("form");
    if (!form) return false;
    return DAP_FORM_CLASSES.some((cls) => form.classList.contains(cls));
  }
  document.addEventListener(
    "invalid",
    (event) => {
      if (isDapManagedElement(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = event.target;
        if (typeof target.setCustomValidity === "function") {
          target.setCustomValidity("");
        }
        console.debug("[DAP] Validation suppressed for DAP-managed input:", event.target);
      }
    },
    { capture: true, passive: false }
  );
  function injectDapValidationStyles() {
    if (document.getElementById("dap-validation-override")) return;
    const style = document.createElement("style");
    style.id = "dap-validation-override";
    style.textContent = `
    /* Suppress native validation ring only for DAP-managed inputs */
    ${DAP_FORM_CLASSES.map((cls) => `.${cls} input:invalid`).join(",\n    ")} {
      box-shadow: none !important;
    }

    /* Hide webkit validation bubble inside DAP forms */
    ${DAP_FORM_CLASSES.map(
    (cls) => `.${cls} input::-webkit-validation-bubble,
    .${cls} input::-webkit-validation-bubble-message,
    .${cls} input::-webkit-validation-bubble-arrow`
  ).join(",\n    ")} {
      display: none !important;
    }
  `;
    if (document.head) {
      document.head.appendChild(style);
    } else {
      const obs = new MutationObserver(() => {
        if (document.head) {
          document.head.appendChild(style);
          obs.disconnect();
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    }
  }
  injectDapValidationStyles();
  function suppressValidationFor(form) {
    form.setAttribute("novalidate", "");
    form.noValidate = true;
    console.debug("[DAP] Validation suppressed for form:", form.className);
  }
  function restoreValidationFor(form) {
    form.removeAttribute("novalidate");
    form.noValidate = false;
    console.debug("[DAP] Validation restored for form:", form.className);
  }

  // src/config.ts
  function normalizeConfig(j) {
    if (!j) return {};
    return {
      organizationid: j.organizationid || j.organizationId || "",
      siteid: j.siteid || j.siteId || j.siteCollectionId || "",
      apikey: j.apikey || j.apiKey || "",
      apiurl: j.apiurl || j.apiUrl || "",
      enableDraggableModals: j.enableDraggableModals !== void 0 ? j.enableDraggableModals : j.enable_draggable_modals
    };
  }
  function validateConfig(j) {
    const normalized = normalizeConfig(j);
    const fields = ["organizationid", "siteid", "apikey", "apiurl"];
    for (const f of fields) {
      const val = normalized[f];
      if (typeof val !== "string" || val.trim() === "") {
        throw new Error(`Config missing/invalid "${f}" (checked both lowercase and camelCase formats)`);
      }
    }
  }
  async function loadConfig(url, { debug = false } = {}) {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error("Config load failed: " + res.status);
    const json = await res.json();
    validateConfig(json);
    const normalized = normalizeConfig(json);
    if (debug) console.log("[DAP] config", { ...normalized, apikey: "\u2022\u2022\u2022redacted\u2022\u2022\u2022" });
    return normalized;
  }

  // src/index.ts
  init_flows();

  // src/utils/sanitize.ts
  function sanitizeHtml(unsafe) {
    const tmp = document.createElement("div");
    tmp.innerHTML = unsafe || "";
    const elements = tmp.querySelectorAll("*");
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const name = el.nodeName.toLowerCase();
      if (!ALLOW.has(name)) {
        const text = document.createTextNode(el.textContent || "");
        const parent = el.parentNode;
        if (parent) parent.replaceChild(text, el);
        continue;
      }
      const attrs = el.attributes;
      for (let j = attrs.length - 1; j >= 0; j--) {
        const attr = attrs[j];
        const an = attr.name.toLowerCase();
        const av = attr.value;
        if (!ATTR_ALLOW.has(an)) {
          el.removeAttribute(attr.name);
          continue;
        }
        if (an === "href" || an === "src") {
          if (!isSafeHttpUrl(av)) {
            el.removeAttribute(attr.name);
            continue;
          }
          if (an === "href" && isHttpUrl(av)) {
            if (!el.getAttribute("rel")) el.setAttribute("rel", "noopener noreferrer");
            if (!el.getAttribute("target")) el.setAttribute("target", "_blank");
          }
        }
      }
    }
    return tmp.innerHTML;
  }
  var ALLOW = /* @__PURE__ */ new Set([
    "b",
    "strong",
    "i",
    "em",
    "u",
    "span",
    "p",
    "br",
    "ul",
    "ol",
    "li",
    "a",
    "code",
    "pre",
    "small",
    "div",
    // for DOCX previews (Mammoth)
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
    "img",
    "video",
    "audio",
    "source",
    "iframe",
    "figure",
    "figcaption"
  ]);
  var ATTR_ALLOW = /* @__PURE__ */ new Set([
    "href",
    "target",
    "rel",
    "class",
    "style",
    "src",
    "alt",
    "title",
    "aria-label",
    "colspan",
    "rowspan",
    "scope",
    "controls",
    "autoplay",
    "loop",
    "muted",
    "width",
    "height",
    "frameborder",
    "allowfullscreen",
    "allow"
  ]);
  function isSafeHttpUrl(u) {
    if (!u || !u.trim()) return false;
    const lower = u.trim().toLowerCase();
    if (lower.startsWith("javascript:") || lower.startsWith("data:")) return false;
    try {
      const url = new URL(u, location.origin);
      return ["http:", "https:", "mailto:", "tel:", "file:"].includes(url.protocol) || url.protocol === location.protocol;
    } catch {
      return !lower.startsWith("javascript:");
    }
  }
  function isHttpUrl(u) {
    try {
      const url = new URL(u, location.origin);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  // src/experiences/modalSequence.ts
  init_registry();

  // src/utils/selectors.ts
  function resolveSelectorAll(selector, root = document) {
    if (!selector || typeof selector !== "string") return [];
    try {
      const cssElements = root.querySelectorAll(selector);
      if (cssElements.length > 0) return Array.from(cssElements);
    } catch {
    }
    try {
      const doc = root instanceof Document ? root : root.ownerDocument ?? document;
      const result = doc.evaluate(
        selector,
        root,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      const elements = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const el = result.snapshotItem(i);
        if (el) elements.push(el);
      }
      return elements;
    } catch {
      return [];
    }
  }
  function resolveSelector(sel, root = document) {
    if (!sel || typeof sel !== "string") return null;
    try {
      const cssEl = root.querySelector(sel);
      if (cssEl) return cssEl;
    } catch {
    }
    try {
      const doc = root instanceof Document ? root : root.ownerDocument ?? document;
      const result = doc.evaluate(
        sel,
        root,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue ?? null;
    } catch {
      return null;
    }
  }
  function waitForElement(selector, options = {}) {
    const { timeout = 5e3, root = document } = options;
    return new Promise((resolve, reject) => {
      const existingElement = resolveSelector(selector, root);
      if (existingElement) {
        resolve(existingElement);
        return;
      }
      let timeoutId;
      let observer;
      timeoutId = window.setTimeout(() => {
        observer?.disconnect();
        reject(new Error(`Element not found within timeout: ${selector}`));
      }, timeout);
      observer = new MutationObserver(() => {
        const element = resolveSelector(selector, root);
        if (element) {
          clearTimeout(timeoutId);
          observer.disconnect();
          resolve(element);
        }
      });
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: false
      });
    });
  }

  // src/styles/modal.css.ts
  var modalCssText = `
/* ===================== Modal Styles ===================== */
.dap-modal-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background: rgba(0, 0, 0, 0.4) !important;
  backdrop-filter: blur(4px) !important;
  z-index: 2147483640 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 20px !important;
  animation: dap-modal-fade-in 0.3s ease-out !important;
}

.dap-modal {
  background: white !important;
  border-radius: 12px !important;
  box-shadow: 
    0 25px 50px rgba(0, 0, 0, 0.15),
    0 10px 25px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset !important;
  width: 680px !important;
  max-width: 90vw !important;
  max-height: 80vh !important;
  min-height: 400px !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  animation: dap-modal-slide-up 0.3s ease-out !important;
  transform-origin: center bottom !important;
}

.dap-modal-header {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
  border-bottom: 1px solid #e2e8f0 !important;
  padding: 20px 24px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  cursor: move !important;
  user-select: none !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
  position: relative !important;
  flex-shrink: 0 !important;
  border-radius: 12px 12px 0 0 !important;
  transition: background 0.2s ease !important;
}

.dap-modal-header:hover {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
}

.dap-modal-header.dragging {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important;
  cursor: grabbing !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

.dap-modal-overlay.dragging {
  cursor: grabbing !important;
}

.dap-modal-header::before {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  height: 3px !important;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4) !important;
  border-radius: 12px 12px 0 0 !important;
}

.dap-modal-title {
  margin: 0 !important;
  font-size: 20px !important;
  font-weight: 700 !important;
  color: #1e293b !important;
  flex: 1 !important;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
  letter-spacing: -0.025em !important;
}

.dap-modal-close {
  background: transparent !important;
  border: 2px solid transparent !important;
  cursor: pointer !important;
  padding: 8px !important;
  color: #64748b !important;
  font-size: 20px !important;
  width: 36px !important;
  height: 36px !important;
  border-radius: 8px !important;
  transition: all 0.2s ease !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.dap-modal-close:hover {
  color: #dc2626 !important;
  background: #fef2f2 !important;
  border-color: #fecaca !important;
  transform: scale(1.05) !important;
}

.dap-modal-body {
  flex: 1 !important;
  padding: 24px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
  line-height: 1.6 !important;
  color: #374151 !important;
  min-height: 0 !important;
}

.dap-modal-body::-webkit-scrollbar {
  width: 6px !important;
}

.dap-modal-body::-webkit-scrollbar-track {
  background: transparent !important;
}

.dap-modal-body::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2) !important;
  border-radius: 3px !important;
}

.dap-modal-body::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3) !important;
}

.dap-modal-body h1,
.dap-modal-body h2,
.dap-modal-body h3,
.dap-modal-body h4,
.dap-modal-body h5,
.dap-modal-body h6 {
  margin: 0 0 16px 0 !important;
  color: #1f2937 !important;
  font-weight: 700 !important;
}

.dap-modal-body h1 { font-size: 24px !important; }
.dap-modal-body h2 { font-size: 20px !important; }
.dap-modal-body h3 { font-size: 18px !important; }
.dap-modal-body h4 { font-size: 16px !important; }

.dap-modal-body p {
  margin: 0 0 16px 0 !important;
  line-height: 1.7 !important;
}

.dap-modal-body ul,
.dap-modal-body ol {
  margin: 0 0 16px 0 !important;
  padding-left: 24px !important;
}

.dap-modal-body li {
  margin-bottom: 8px !important;
}

.dap-modal-footer {
  border-top: 1px solid #e5e7eb !important;
  padding: 20px 24px !important;
  background: linear-gradient(135deg, #fafbfc 0%, #f3f4f6 100%) !important;
  min-height: 60px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 16px !important;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04) !important;
  flex-shrink: 0 !important;
  border-radius: 0 0 12px 12px !important;
}

.dap-modal-footer .dap-modal-buttons {
  margin-top: 0 !important;
  margin-left: auto !important;
}

.dap-modal-footer-content {
  flex: 1 !important;
  color: #6b7280 !important;
  font-size: 13px !important;
  line-height: 1.5 !important;
}

.dap-content-text {
  color: #1e293b !important;
  line-height: 1.6 !important;
}

.dap-content-video video {
  width: 100% !important;
  height: auto !important;
}

.dap-content-image img {
  max-width: 100% !important;
  height: auto !important;
}

.dap-content-link,
.dap-modal-body a {
  color: #3b82f6 !important;
  text-decoration: underline !important;
  font-weight: 500 !important;
  transition: color 0.2s ease !important;
}

.dap-content-link:hover,
.dap-modal-body a:hover {
  color: #1e40af !important;
  text-decoration: none !important;
}

.dap-content-link {
  display: inline-block !important;
  margin: 8px 0 !important;
}

/* Modal Button Styles with DAP Design Tokens */
.dap-modal-button {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  padding: 12px 24px !important;
  border-radius: 8px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  text-decoration: none !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  border: 2px solid transparent !important;
  min-width: 120px !important;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
}

.dap-modal-button.primary {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%) !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3) !important;
}

.dap-modal-button.primary:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%) !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4) !important;
}

.dap-modal-button.secondary {
  background: white !important;
  color: #374151 !important;
  border-color: #d1d5db !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
}

.dap-modal-button.secondary:hover {
  background: #f9fafb !important;
  border-color: #9ca3af !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1) !important;
}

.dap-modal-button.outline {
  background: transparent !important;
  color: #3b82f6 !important;
  border-color: #3b82f6 !important;
}

.dap-modal-button.outline:hover {
  background: #eff6ff !important;
  border-color: #2563eb !important;
  color: #2563eb !important;
}

.dap-modal-buttons {
  display: flex !important;
  gap: 12px !important;
  margin-top: 20px !important;
  flex-wrap: wrap !important;
  justify-content: flex-start !important;
}

/* Knowledge Base specific styling */
.dap-kb-item-button {
  width: 100% !important;
  text-align: left !important;
  justify-content: flex-start !important;
  margin-bottom: 12px !important;
  position: relative !important;
}

.dap-kb-icon {
  margin-right: 12px !important;
  font-size: 16px !important;
  opacity: 0.8 !important;
}

.dap-document-actions {
  margin-top: 24px !important;
  padding-top: 20px !important;
  border-top: 1px solid #e5e7eb !important;
}

/* Article Content Styling */
.dap-kb-article-viewer {
  max-width: 100% !important;
}

.dap-article-title {
  margin: 0 0 12px 0 !important;
  font-size: 20px !important;
  font-weight: 700 !important;
  color: #1f2937 !important;
  border-bottom: 2px solid #3b82f6 !important;
  padding-bottom: 8px !important;
}

.dap-article-description {
  margin: 0 0 20px 0 !important;
  color: #6b7280 !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
}

.dap-article-loading {
  text-align: center !important;
  padding: 40px 20px !important;
  color: #6b7280 !important;
}

.dap-loading-spinner {
  width: 32px !important;
  height: 32px !important;
  border: 3px solid #e5e7eb !important;
  border-top: 3px solid #3b82f6 !important;
  border-radius: 50% !important;
  margin: 0 auto 16px !important;
  animation: spin 1s linear infinite !important;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* PDF and Document Viewers */
.dap-pdf-viewer-container,
.dap-document-viewer-container,
.dap-presentation-viewer-container {
  margin-top: 20px !important;
}

.dap-pdf-iframe,
.dap-web-iframe {
  width: 100% !important;
  height: 500px !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 8px !important;
}

.dap-kb-pdf-fallback {
  text-align: center !important;
  padding: 40px 20px !important;
  background: #f9fafb !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 8px !important;
  margin-top: 16px !important;
}

/* Enhanced Fallback Viewer */
.dap-enhanced-fallback-viewer {
  text-align: center !important;
  padding: 40px 20px !important;
  background: #f9fafb !important;
  border: 1px solid #e5e7eb !important;
  border-radius: 12px !important;
  margin-top: 20px !important;
}

.dap-fallback-icon {
  font-size: 48px !important;
  margin-bottom: 16px !important;
}

.dap-enhanced-fallback-message h4 {
  margin: 0 0 12px 0 !important;
  font-size: 18px !important;
  font-weight: 700 !important;
  color: #1f2937 !important;
}

.dap-fallback-primary {
  margin: 0 0 8px 0 !important;
  font-size: 16px !important;
  color: #374151 !important;
}

.dap-fallback-filename,
.dap-fallback-type {
  margin: 4px 0 !important;
  font-size: 14px !important;
  color: #6b7280 !important;
}

.dap-fallback-no-url {
  margin: 16px 0 0 0 !important;
  font-size: 14px !important;
  color: #9ca3af !important;
  font-style: italic !important;
}

/* Enhanced Document Actions */
.dap-enhanced-document-actions {
  margin-top: 24px !important;
  display: flex !important;
  gap: 12px !important;
  justify-content: center !important;
  flex-wrap: wrap !important;
}

.dap-primary-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%) !important;
  color: white !important;
}

.dap-secondary-btn {
  background: white !important;
  color: #374151 !important;
  border: 2px solid #d1d5db !important;
}

.dap-btn-icon {
  margin-right: 8px !important;
}

.dap-btn-text {
  font-weight: 600 !important;
}

/* KB Item Detail Viewer */
.dap-kb-viewer-header {
  margin-bottom: 20px !important;
  padding-bottom: 16px !important;
  border-bottom: 1px solid #e5e7eb !important;
}

.dap-kb-item-title {
  margin: 12px 0 0 0 !important;
  font-size: 18px !important;
  font-weight: 600 !important;
  color: #1f2937 !important;
}

.dap-file-metadata {
  margin: 8px 0 0 0 !important;
  font-size: 14px !important;
  color: #6b7280 !important;
}

/* File Type Badges */
.dap-file-type-badge {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 4px 12px !important;
  background: #eff6ff !important;
  color: #2563eb !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  border-radius: 20px !important;
  margin-bottom: 12px !important;
}

.dap-file-type-badge.video {
  background: #fef3c7 !important;
  color: #92400e !important;
}

.dap-file-type-badge.image {
  background: #d1fae5 !important;
  color: #065f46 !important;
}

.dap-file-type-badge.article {
  background: #e0e7ff !important;
  color: #3730a3 !important;
}

@media (max-width: 768px) {
  .dap-modal {
    width: 95vw !important;
    max-width: 95vw !important;
    margin: 10px !important;
    max-height: 85vh !important;
  }
  
  .dap-modal-header {
    padding: 16px 20px !important;
  }
  
  .dap-modal-title {
    font-size: 18px !important;
  }
  
  .dap-modal-body {
    padding: 20px !important;
  }
  
  .dap-modal-footer {
    padding: 16px 20px !important;
    flex-direction: column !important;
    align-items: stretch !important;
  }
  
  .dap-modal-footer .dap-modal-buttons {
    margin-left: 0 !important;
    justify-content: stretch !important;
    flex-direction: column !important;
  }
  
  .dap-modal-button {
    width: 100% !important;
    min-width: auto !important;
  }
}

/* Modal Animations */
@keyframes dap-modal-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes dap-modal-slide-up {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Accessibility and reduced motion */
@media (prefers-reduced-motion: reduce) {
  .dap-modal-overlay,
  .dap-modal {
    animation: none !important;
  }
  
  .dap-modal-button,
  .dap-modal-close {
    transition: none !important;
    transform: none !important;
  }
}

/* Focus styles for accessibility */
.dap-modal:focus-visible {
  outline: 3px solid #3b82f6 !important;
  outline-offset: -3px !important;
}

.dap-modal-button:focus-visible {
  outline: 2px solid #3b82f6 !important;
  outline-offset: 2px !important;
}
`;

  // src/utils/ruleEvaluator.ts
  function evaluateCondition(condition, inputValue) {
    try {
      let targetValue = inputValue;
      let conditionValue = condition.value;
      if (condition.valueType === "Number") {
        targetValue = typeof inputValue === "string" ? parseFloat(inputValue) : Number(inputValue);
        conditionValue = Number(condition.value);
        if (isNaN(targetValue) || isNaN(conditionValue)) {
          console.warn(`[DAP] Invalid number comparison: ${inputValue} vs ${condition.value}`);
          return false;
        }
      } else if (condition.valueType === "Boolean") {
        targetValue = typeof inputValue === "string" ? inputValue.toLowerCase() === "true" : Boolean(inputValue);
        conditionValue = typeof condition.value === "string" ? condition.value.toLowerCase() === "true" : Boolean(condition.value);
      } else {
        targetValue = String(inputValue);
        conditionValue = String(condition.value);
      }
      switch (condition.operator) {
        case "Equals":
          return targetValue === conditionValue;
        case "NotEquals":
          return targetValue !== conditionValue;
        case "Contains":
          return String(targetValue).toLowerCase().includes(String(conditionValue).toLowerCase());
        case "NotContains":
          return !String(targetValue).toLowerCase().includes(String(conditionValue).toLowerCase());
        case "GreaterThan":
          if (condition.valueType === "Number") {
            return targetValue > conditionValue;
          }
          return String(targetValue) > String(conditionValue);
        case "LessThan":
          if (condition.valueType === "Number") {
            return targetValue < conditionValue;
          }
          return String(targetValue) < String(conditionValue);
        case "StartsWith":
          return String(targetValue).toLowerCase().startsWith(String(conditionValue).toLowerCase());
        case "EndsWith":
          return String(targetValue).toLowerCase().endsWith(String(conditionValue).toLowerCase());
        case "In": {
          let list;
          if (Array.isArray(condition.value)) {
            list = condition.value.map(String);
          } else {
            try {
              const parsed = JSON.parse(String(condition.value));
              list = Array.isArray(parsed) ? parsed.map(String) : [String(condition.value)];
            } catch {
              list = String(condition.value).split(",").map((s) => s.trim());
            }
          }
          return list.map((v) => v.toLowerCase()).includes(String(targetValue).toLowerCase());
        }
        case "NotIn": {
          let list;
          if (Array.isArray(condition.value)) {
            list = condition.value.map(String);
          } else {
            try {
              const parsed = JSON.parse(String(condition.value));
              list = Array.isArray(parsed) ? parsed.map(String) : [String(condition.value)];
            } catch {
              list = String(condition.value).split(",").map((s) => s.trim());
            }
          }
          return !list.map((v) => v.toLowerCase()).includes(String(targetValue).toLowerCase());
        }
        case "Regex": {
          try {
            const rx = new RegExp(String(conditionValue));
            return rx.test(String(targetValue));
          } catch (rxErr) {
            console.error(`[DAP] Invalid regex pattern "${conditionValue}":`, rxErr);
            return false;
          }
        }
        case "Empty":
          return targetValue === "" || targetValue === null || targetValue === void 0 || String(targetValue).trim() === "";
        default:
          console.error(`[DAP] Unknown condition operator: ${condition.operator}`);
          return false;
      }
    } catch (error) {
      console.error(`[DAP] Error evaluating condition:`, error, condition);
      return false;
    }
  }
  function evaluateRuleBlock(ruleBlock, inputValue) {
    try {
      if (!ruleBlock.conditions || ruleBlock.conditions.length === 0) {
        console.warn(`[DAP] Rule block ${ruleBlock.ruleBlockId} has no conditions`);
        return false;
      }
      const results = ruleBlock.conditions.map((condition) => evaluateCondition(condition, inputValue));
      if (ruleBlock.logicalOperator === "And") {
        return results.every((result) => result === true);
      } else if (ruleBlock.logicalOperator === "Or") {
        return results.some((result) => result === true);
      } else {
        console.warn(`[DAP] Unknown logical operator: ${ruleBlock.logicalOperator}`);
        return false;
      }
    } catch (error) {
      console.error(`[DAP] Error evaluating rule block:`, error, ruleBlock);
      return false;
    }
  }
  function evaluateRules(ruleBlocks, inputValue) {
    try {
      for (const ruleBlock of ruleBlocks) {
        if (evaluateRuleBlock(ruleBlock, inputValue)) {
          console.debug(`[DAP] Rule block ${ruleBlock.ruleBlockId} matched, nextFlowId: ${ruleBlock.nextFlowId}`);
          return ruleBlock.nextFlowId;
        }
      }
      console.debug(`[DAP] No rule blocks matched for value: ${inputValue}`);
      return null;
    } catch (error) {
      console.error(`[DAP] Error evaluating rules:`, error);
      return null;
    }
  }
  function getElementValue(element) {
    try {
      if (element instanceof HTMLInputElement) {
        switch (element.type) {
          case "checkbox":
          case "radio":
            return element.checked;
          case "number":
            return element.valueAsNumber || 0;
          default:
            return element.value;
        }
      } else if (element instanceof HTMLSelectElement) {
        return element.value;
      } else if (element instanceof HTMLTextAreaElement) {
        return element.value;
      } else {
        return element.textContent || element.innerText || "";
      }
    } catch (error) {
      console.error(`[DAP] Error getting element value:`, error);
      return "";
    }
  }
  function createRuleEvaluationListener(ruleBlocks, onRuleMatch) {
    return (event) => {
      try {
        const target = event.target;
        if (!target) {
          console.warn("[DAP] Rule evaluation: No target element");
          return;
        }
        if (!Array.isArray(ruleBlocks) || ruleBlocks.length === 0) {
          console.warn("[DAP] Rule evaluation: No valid rule blocks");
          return;
        }
        if (typeof onRuleMatch !== "function") {
          console.error("[DAP] Rule evaluation: Invalid callback function");
          return;
        }
        const inputValue = getElementValue(target);
        console.debug(`[DAP] Evaluating rules for value:`, inputValue);
        const nextFlowId = evaluateRules(ruleBlocks, inputValue);
        if (nextFlowId) {
          console.debug(`[DAP] Rule evaluation triggered flow transition to: ${nextFlowId}`);
          try {
            onRuleMatch(nextFlowId);
          } catch (callbackError) {
            console.error(`[DAP] Error in rule match callback:`, callbackError);
          }
        } else {
          console.debug(`[DAP] No rules matched for value:`, inputValue);
        }
      } catch (error) {
        console.error(`[DAP] Error in rule evaluation listener:`, error);
      }
    };
  }

  // src/experiences/modalSequence.ts
  function registerModalSequence() {
    register("modalSequence", renderModalSequence);
  }
  async function renderModalSequence(flow) {
    console.debug("[DAP] renderModalSequence called with flow:", flow);
    console.debug("[DAP] ModalSequence payload:", flow.payload);
    const { payload, id } = flow;
    if (!payload || !Array.isArray(payload.steps) || payload.steps.length === 0) {
      console.warn("[DAP] Modal sequence has no steps");
      return;
    }
    const completionTracker = payload._completionTracker;
    const isMultiStep = payload.steps.length > 1;
    ensureStyles();
    let currentStepIndex = payload.startAt || 0;
    let currentTriggerListeners = [];
    let activeStepTriggered = false;
    let modalShell = null;
    let tooltipCleanup = null;
    let popoverCleanup = null;
    const prevActive = document.activeElement;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeAll();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    await evaluateAndRenderStep(currentStepIndex);
    async function evaluateAndRenderStep(stepIndex) {
      const step = payload.steps[stepIndex];
      if (!step) return;
      const stepId = step.stepId || `step-${stepIndex + 1}`;
      console.debug(`[DAP] Evaluating step ${stepIndex}:`, {
        stepId,
        elementSelector: step.elementSelector,
        elementTrigger: step.elementTrigger,
        kind: step.kind
      });
      const isTriggerBasedStep = Boolean(step.elementSelector && step.elementTrigger);
      if (isTriggerBasedStep) {
        await setupStepTrigger(stepIndex, step, stepId);
        console.debug(`[DAP] Step ${stepIndex} waiting for trigger`);
      } else {
        await renderStepExperience(stepIndex, step, stepId, true);
        console.debug(`[DAP] Step ${stepIndex} rendered immediately`);
      }
    }
    async function setupStepTrigger(stepIndex, step, stepId) {
      if (!step.elementSelector || !step.elementTrigger) return;
      try {
        const targetElement = await waitForElement2(step.elementSelector);
        if (!targetElement) {
          console.warn(`[DAP] Target element not found: ${step.elementSelector}`);
          return;
        }
        const triggerEvent = normalizeTrigger(step.elementTrigger);
        const triggerHandler = () => {
          if (activeStepTriggered) return;
          activeStepTriggered = true;
          console.debug(`[DAP] Step ${stepIndex} triggered by ${triggerEvent}`);
          renderStepExperience(stepIndex, step, stepId, false);
        };
        targetElement.addEventListener(triggerEvent, triggerHandler);
        const cleanup = () => {
          targetElement.removeEventListener(triggerEvent, triggerHandler);
        };
        currentTriggerListeners.push(cleanup);
      } catch (error) {
        console.error(`[DAP] Error setting up trigger for step ${stepIndex}:`, error);
        if (stepIndex < payload.steps.length - 1) {
          setTimeout(() => transitionToStep(stepIndex + 1), 100);
        } else {
          closeAll();
        }
      }
    }
    async function renderStepExperience(stepIndex, step, stepId, showNavigation) {
      cleanupCurrentStep();
      console.debug(`[DAP] Rendering step ${stepIndex} (${step.kind})`);
      switch (step.kind) {
        case "modal":
          await renderModalStep(step, showNavigation);
          break;
        case "tooltip":
          if (step.tooltip) {
            await renderTooltipStep(step.tooltip, stepIndex);
          }
          break;
        case "popover":
          if (step.popover) {
            await renderPopoverStep(step.popover, stepIndex);
          }
          break;
        case "survey":
          if (step.survey) {
            await renderSurveyStep(step.survey, stepIndex);
          } else {
            console.warn("[DAP] Survey step has no survey data \u2014 skipping");
            if (stepIndex < payload.steps.length - 1) {
              setTimeout(() => transitionToStep(stepIndex + 1), 100);
            } else {
              closeAll();
            }
          }
          break;
        case "rule":
          if (step.rule) {
            await renderRuleStep(step.rule, stepIndex);
          } else {
            console.warn("[DAP] Rule step has no rule data");
          }
          break;
        default:
          console.warn(`[DAP] Unknown step kind: ${step.kind}`);
      }
    }
    async function renderModalStep(step, showNavigation) {
      modalShell = createModalShell(step.size);
      const header = modalShell.modal.querySelector(".dap-header-bar");
      if (step.title) {
        const title = document.createElement("h2");
        title.className = "dap-header-text";
        title.textContent = step.title;
        header.insertBefore(title, header.firstChild);
      } else {
        const title = document.createElement("h2");
        title.className = "dap-header-text";
        title.style.visibility = "hidden";
        title.innerHTML = "&nbsp;";
        header.insertBefore(title, header.firstChild);
      }
      const body = modalShell.modal.querySelector(".dap-modal-body");
      if (step.body && Array.isArray(step.body)) {
        step.body.forEach((content) => {
          const contentEl = renderModalContent(content, step);
          if (contentEl) body.appendChild(contentEl);
        });
      }
      const footer = modalShell.modal.querySelector(".dap-modal-footer");
      if (step.footerText) {
        const footerText = document.createElement("p");
        footerText.className = "dap-footer-text";
        footerText.innerHTML = sanitizeHtml(step.footerText);
        footer.appendChild(footerText);
      }
      if (showNavigation && isMultiStep) {
        const nav = createNavigationButtons();
        footer.appendChild(nav);
      }
      document.documentElement.appendChild(modalShell.overlay);
      modalShell.overlay.addEventListener("click", (e) => {
        if (e.target === modalShell.overlay) {
          closeAll();
        }
      });
      const closeBtn = modalShell.modal.querySelector(".dap-modal-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", closeAll);
      }
    }
    async function renderSurveyStep(surveyPayload, stepIndex) {
      try {
        const surveyWithTracker = {
          ...surveyPayload,
          flowId: flow.id,
          organizationId: flow.config?.organizationid || flow.config?.organizationId,
          siteId: flow.config?.siteid || flow.config?.siteId || flow.config?.siteCollectionId,
          stepId: payload.steps[stepIndex].stepId || `step-${stepIndex}`,
          _completionTracker: {
            onComplete: () => {
              if (stepIndex < payload.steps.length - 1) {
                transitionToStep(stepIndex + 1);
              } else {
                closeAll();
              }
            }
          }
        };
        const surveyRenderer = getRenderer("survey");
        if (surveyRenderer) {
          await surveyRenderer({
            id: `${id}-survey-${stepIndex}`,
            type: "survey",
            payload: surveyWithTracker,
            config: flow.config
          });
        } else {
          console.warn("[DAP] Survey renderer not registered \u2014 skipping survey step");
          if (stepIndex < payload.steps.length - 1) {
            setTimeout(() => transitionToStep(stepIndex + 1), 100);
          } else {
            closeAll();
          }
        }
      } catch (error) {
        console.error("[DAP] Error rendering survey step:", error);
        if (stepIndex < payload.steps.length - 1) {
          setTimeout(() => transitionToStep(stepIndex + 1), 100);
        }
      }
    }
    async function renderTooltipStep(tooltipPayload, stepIndex) {
      try {
        const tooltipRenderer = getRenderer("tooltip");
        if (tooltipRenderer) {
          const tooltipWithTracker = {
            ...tooltipPayload,
            _completionTracker: {
              onComplete: () => {
                if (stepIndex < payload.steps.length - 1) {
                  transitionToStep(stepIndex + 1);
                } else {
                  closeAll();
                }
              }
            }
          };
          await tooltipRenderer({
            id: `${id}-tooltip-${stepIndex}`,
            type: "tooltip",
            payload: tooltipWithTracker
          });
        }
      } catch (error) {
        console.error("[DAP] Error rendering tooltip step:", error);
        if (stepIndex < payload.steps.length - 1) {
          setTimeout(() => transitionToStep(stepIndex + 1), 100);
        } else {
          closeAll();
        }
      }
    }
    async function renderPopoverStep(popoverPayload, stepIndex) {
      try {
        const popoverRenderer = getRenderer("popover");
        if (popoverRenderer) {
          const popoverWithTracker = {
            ...popoverPayload,
            _completionTracker: {
              onComplete: () => {
                if (stepIndex < payload.steps.length - 1) {
                  transitionToStep(stepIndex + 1);
                } else {
                  closeAll();
                }
              }
            }
          };
          await popoverRenderer({
            id: `${id}-popover-${stepIndex}`,
            type: "popover",
            payload: popoverWithTracker
          });
        }
      } catch (error) {
        console.error("[DAP] Error rendering popover step:", error);
        if (stepIndex < payload.steps.length - 1) {
          setTimeout(() => transitionToStep(stepIndex + 1), 100);
        } else {
          closeAll();
        }
      }
    }
    async function renderRuleStep(rulePayload, stepIndex) {
      console.debug("[DAP] === RULE STEP PROCESSING START ===");
      console.debug("[DAP] Step Index:", stepIndex);
      console.debug("[DAP] Rule Payload:", rulePayload);
      try {
        const { inputSelector, rules } = rulePayload;
        console.debug("[DAP] Extracted inputSelector:", inputSelector);
        console.debug("[DAP] Extracted rules:", rules);
        if (!inputSelector || !rules || rules.length === 0) {
          console.warn("[DAP] Rule step missing inputSelector or rules");
          console.warn("[DAP] inputSelector:", inputSelector);
          console.warn("[DAP] rules:", rules);
          if (stepIndex < payload.steps.length - 1) {
            setTimeout(() => transitionToStep(stepIndex + 1), 100);
          }
          return;
        }
        console.debug(`[DAP] Setting up rule evaluation listener for selector: ${inputSelector}`);
        console.debug(`[DAP] Number of rules: ${rules.length}`);
        rules.forEach((rule, index) => {
          console.debug(`[DAP] Rule ${index + 1}:`, rule);
        });
        console.debug(`[DAP] Resolving selector: ${inputSelector}`);
        const targetElement = resolveSelector(inputSelector);
        console.debug(`[DAP] Target element found:`, targetElement);
        if (!targetElement) {
          console.warn(`[DAP] Could not find target element for selector: ${inputSelector}`);
          console.warn(`[DAP] Available elements with similar selectors:`);
          try {
            const allInputs = document.querySelectorAll("input, select, textarea");
            console.warn(`[DAP] Found ${allInputs.length} input elements on page`);
            allInputs.forEach((el, i) => {
              console.warn(`[DAP] Input ${i + 1}: ${el.tagName}${el.id ? "#" + el.id : ""}${el.className ? "." + el.className.replace(/\s+/g, ".") : ""}`);
            });
          } catch (e) {
            console.warn(`[DAP] Error listing input elements:`, e);
          }
          if (stepIndex < payload.steps.length - 1) {
            setTimeout(() => transitionToStep(stepIndex + 1), 100);
          }
          return;
        }
        console.debug(`[DAP] Creating rule evaluation listener...`);
        const eventHandler = createRuleEvaluationListener(
          rules,
          (nextFlowId) => {
            console.debug(`[DAP] *** RULE EVALUATION TRIGGERED ***`);
            console.debug(`[DAP] Rule evaluated \u2014 transitioning to flow: ${nextFlowId}`);
            if (payload._onFlowBranch) {
              payload._onFlowBranch(nextFlowId);
            } else {
              const branched = document.dispatchEvent(
                new CustomEvent("dap:flowbranch", {
                  detail: { flowId: nextFlowId },
                  bubbles: false,
                  cancelable: true
                })
              );
              if (branched) {
                console.warn(`[DAP] No dap:flowbranch listener found \u2014 closing sequence instead`);
                closeAll();
              }
            }
          }
        );
        console.debug(`[DAP] Attaching event listeners to target element...`);
        targetElement.addEventListener("input", eventHandler);
        targetElement.addEventListener("change", eventHandler);
        console.debug(`[DAP] Event listeners attached for 'input' and 'change' events`);
        const cleanup = () => {
          console.debug(`[DAP] Cleaning up rule step event listeners`);
          targetElement.removeEventListener("input", eventHandler);
          targetElement.removeEventListener("change", eventHandler);
        };
        currentTriggerListeners.push(cleanup);
        console.debug("[DAP] Rule step listener active - waiting for user input");
        console.debug(`[DAP] Target element type: ${targetElement.tagName}, value: "${targetElement.value || ""}"`);
        console.debug("[DAP] === RULE STEP PROCESSING COMPLETE ===");
        console.debug(`[DAP] Rule Step Setup Complete! Monitoring element: ${inputSelector}, Rules: ${rules.length}, Try interacting with the target element`);
      } catch (error) {
        console.error("[DAP] Error setting up rule step:", error);
        if (error instanceof Error) {
          console.error("[DAP] Stack trace:", error.stack);
        }
        if (stepIndex < payload.steps.length - 1) {
          setTimeout(() => transitionToStep(stepIndex + 1), 100);
        }
      }
    }
    function createNavigationButtons() {
      const nav = document.createElement("div");
      nav.className = "dap-modal-nav";
      const prevBtn = document.createElement("button");
      prevBtn.className = "dap-btn dap-btn-secondary";
      prevBtn.textContent = "Previous";
      prevBtn.disabled = currentStepIndex === 0;
      prevBtn.addEventListener("click", goToPrevious);
      const indicator = document.createElement("span");
      indicator.className = "dap-step-indicator";
      indicator.textContent = `${currentStepIndex + 1} of ${payload.steps.length}`;
      const nextBtn = document.createElement("button");
      nextBtn.className = "dap-btn dap-btn-primary";
      nextBtn.textContent = currentStepIndex === payload.steps.length - 1 ? "Complete" : "Next";
      nextBtn.addEventListener("click", goToNext);
      nav.appendChild(prevBtn);
      nav.appendChild(indicator);
      nav.appendChild(nextBtn);
      return nav;
    }
    function goToPrevious() {
      if (currentStepIndex > 0) {
        transitionToStep(currentStepIndex - 1);
      }
    }
    function goToNext() {
      if (currentStepIndex < payload.steps.length - 1) {
        transitionToStep(currentStepIndex + 1);
      } else {
        closeAll();
      }
    }
    function transitionToStep(newStepIndex) {
      console.debug(`[DAP] Transitioning from step ${currentStepIndex} to step ${newStepIndex}`);
      cleanupCurrentStep();
      currentStepIndex = newStepIndex;
      activeStepTriggered = false;
      if (completionTracker?.onStepAdvance) {
        const newStepId = payload.steps[newStepIndex]?.stepId || `step-${newStepIndex + 1}`;
        completionTracker.onStepAdvance(newStepId);
      }
      evaluateAndRenderStep(currentStepIndex);
    }
    function cleanupCurrentStep() {
      console.debug(`[DAP] Cleaning up step ${currentStepIndex}`);
      currentTriggerListeners.forEach((cleanup) => cleanup());
      currentTriggerListeners = [];
      if (modalShell) {
        modalShell.overlay.remove();
        modalShell = null;
      }
      tooltipCleanup?.();
      tooltipCleanup = null;
      popoverCleanup?.();
      popoverCleanup = null;
      activeStepTriggered = false;
    }
    function closeAll() {
      console.debug("[DAP] Closing modal sequence");
      cleanupCurrentStep();
      document.removeEventListener("keydown", onKeyDown, true);
      prevActive?.focus();
      if (completionTracker?.onComplete) {
        console.debug(`[DAP] Completing modal sequence flow: ${id}`);
        completionTracker.onComplete();
      }
    }
  }
  function createModalShell(size) {
    const overlay = document.createElement("div");
    overlay.className = "dap-modal-wrap";
    const modal = document.createElement("div");
    modal.className = "dap-modal";
    if (size) {
      modal.classList.add(`dap-modal-${size}`);
    } else {
      modal.classList.add("dap-modal-medium");
    }
    const header = document.createElement("div");
    header.className = "dap-header-bar";
    const closeBtn = document.createElement("button");
    closeBtn.className = "dap-modal-close";
    closeBtn.setAttribute("aria-label", "Close modal");
    closeBtn.innerHTML = "\xD7";
    header.appendChild(closeBtn);
    const body = document.createElement("div");
    body.className = "dap-modal-body";
    const footer = document.createElement("div");
    footer.className = "dap-modal-footer";
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    return { overlay, modal, header, body, footer };
  }
  function renderModalContent(content, step) {
    switch (content.kind) {
      case "text":
        const textEl = document.createElement("div");
        textEl.className = "dap-content-text";
        textEl.innerHTML = sanitizeHtml(content.html);
        return textEl;
      case "link":
        const linkEl = document.createElement("a");
        linkEl.className = "dap-content-link";
        linkEl.href = content.href;
        linkEl.textContent = content.label || content.href;
        linkEl.target = "_blank";
        linkEl.rel = "noopener noreferrer";
        return linkEl;
      case "image":
        const imgEl = document.createElement("img");
        imgEl.className = "dap-content-image";
        imgEl.src = content.url;
        imgEl.alt = content.alt || "";
        return imgEl;
      case "video":
        if (content.sources && content.sources.length > 0) {
          const videoEl = document.createElement("video");
          videoEl.className = "dap-content-video";
          videoEl.controls = true;
          content.sources.forEach((source) => {
            const sourceEl = document.createElement("source");
            sourceEl.src = source.src;
            if (source.type) sourceEl.type = source.type;
            videoEl.appendChild(sourceEl);
          });
          return videoEl;
        }
        return null;
      case "youtube":
        const iframeEl = document.createElement("iframe");
        iframeEl.className = "dap-content-youtube";
        iframeEl.src = content.href;
        iframeEl.setAttribute("frameborder", "0");
        iframeEl.setAttribute("allowfullscreen", "true");
        return iframeEl;
      case "kb":
        console.debug("[DAP] Rendering KB content:", content);
        currentSequenceStep = step;
        currentSequenceKBData = content;
        return renderKnowledgeBaseInSequence(content);
      case "kb-item-viewer":
        console.debug("[DAP] Rendering KB item viewer:", content);
        return renderKBItemViewerInSequence(content);
      case "article":
        console.debug("[DAP] Rendering Article in sequence");
        return createArticleViewerInSequence(content);
      default:
        return null;
    }
  }
  async function waitForElement2(selector, timeout = 5e3) {
    const existingElement = resolveSelector(selector);
    if (existingElement) return existingElement;
    return new Promise((resolve) => {
      let timeoutId;
      let observer;
      timeoutId = window.setTimeout(() => {
        observer?.disconnect();
        resolve(null);
      }, timeout);
      observer = new MutationObserver(() => {
        const element = resolveSelector(selector);
        if (element) {
          clearTimeout(timeoutId);
          observer.disconnect();
          resolve(element);
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }
  function normalizeTrigger(trigger) {
    switch (trigger?.toLowerCase()) {
      case "hover":
        return "mouseenter";
      case "focus":
        return "focus";
      case "click":
      default:
        return "click";
    }
  }
  function ensureStyles() {
    if (!document.getElementById("dap-modal-sequence-style")) {
      const style = document.createElement("style");
      style.id = "dap-modal-sequence-style";
      style.textContent = modalCssText + `
      .dap-modal-nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-top: 16px;
      }
      
      .dap-step-indicator {
        font-size: 14px;
        color: var(--dap-text-muted);
      }
      
      .dap-btn {
        padding: 8px 16px;
        border: 1px solid var(--dap-border);
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      
      .dap-btn-primary {
        background: var(--dap-primary);
        color: white;
        border-color: var(--dap-primary);
      }
      
      .dap-btn-secondary {
        background: transparent;
        color: var(--dap-text);
      }
      
      .dap-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .dap-content-kb {
        margin: 16px 0;
      }
      
      .dap-kb-item {
        margin: 8px 0;
        padding: 8px;
        border: 1px solid var(--dap-border);
        border-radius: 4px;
      }
      
      .dap-kb-item a {
        font-weight: 500;
        color: var(--dap-primary);
        text-decoration: none;
      }
      
      .dap-kb-item p {
        margin: 4px 0 0;
        font-size: 14px;
        color: var(--dap-text-muted);
      }
    `;
      document.head.appendChild(style);
    }
  }
  function renderKnowledgeBaseInSequence(content) {
    const container = document.createElement("div");
    container.className = "dap-content-kb";
    console.debug("[DAP] Rendering KB sequence with content:", content);
    console.debug("[DAP] KB items count:", content?.items?.length || 0);
    if (!content.items || !Array.isArray(content.items)) {
      console.warn("[DAP] No KB items available for rendering");
      container.innerHTML = "<p>No knowledge base items available.</p>";
      return container;
    }
    if (content.title) {
      const title = document.createElement("h3");
      title.textContent = content.title;
      title.className = "dap-kb-title";
      container.appendChild(title);
    }
    if (content.description) {
      const desc = document.createElement("p");
      desc.textContent = content.description;
      desc.className = "dap-kb-description";
      container.appendChild(desc);
    }
    const itemsList = document.createElement("div");
    itemsList.className = "dap-kb-items-list";
    content.items.forEach((item) => {
      const itemElement = document.createElement("button");
      itemElement.className = "dap-kb-item-button";
      itemElement.type = "button";
      const icon = document.createElement("span");
      icon.className = "dap-kb-item-icon";
      const type = item.type?.toLowerCase() || "";
      if (type === "video" || item.url?.includes("youtube") || item.url?.includes("vimeo")) {
        icon.textContent = "\u25B6";
      } else if (type === "image" || /\.(jpg|jpeg|png|gif|webp)$/i.test(item.url || "")) {
        icon.textContent = "\u{1F5BC}";
      } else if (type === "pdf" || /\.pdf$/i.test(item.url || "")) {
        icon.textContent = "\u{1F4C4}";
      } else if (type === "doc" || type === "docx" || /\.(doc|docx)$/i.test(item.url || "")) {
        icon.textContent = "\u{1F4DD}";
      } else {
        icon.textContent = "\u{1F4F0}";
      }
      const title = document.createElement("span");
      title.className = "dap-kb-item-title";
      title.textContent = item.title || "Untitled Item";
      const description = document.createElement("span");
      description.className = "dap-kb-item-description";
      description.textContent = item.description || "";
      itemElement.appendChild(icon);
      itemElement.appendChild(title);
      if (item.description) {
        itemElement.appendChild(description);
      }
      itemElement.addEventListener("click", () => {
        openKBItemInSequence(item);
      });
      itemsList.appendChild(itemElement);
    });
    container.appendChild(itemsList);
    return container;
  }
  function renderKBItemViewerInSequence(content) {
    const container = document.createElement("div");
    container.className = "dap-kb-item-viewer";
    const backButton = document.createElement("button");
    backButton.className = "dap-kb-back-button";
    backButton.innerHTML = "\u2190 Back to Knowledge Base";
    backButton.addEventListener("click", goBackToKBListInSequence);
    container.appendChild(backButton);
    const title = document.createElement("h3");
    title.className = "dap-kb-item-title";
    title.textContent = content.title || "Knowledge Base Item";
    container.appendChild(title);
    const type = content.type?.toLowerCase() || "";
    const url = content.url || "";
    if (type === "video" || url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com")) {
      const videoContainer = document.createElement("div");
      videoContainer.className = "dap-kb-video-container";
      if (url.includes("youtube.com") || url.includes("youtu.be")) {
        let videoId = "";
        if (url.includes("youtube.com/watch?v=")) {
          videoId = url.split("watch?v=")[1]?.split("&")[0];
        } else if (url.includes("youtu.be/")) {
          videoId = url.split("youtu.be/")[1]?.split("?")[0];
        }
        if (videoId) {
          const iframe = document.createElement("iframe");
          iframe.className = "dap-kb-video";
          iframe.src = `https://www.youtube.com/embed/${videoId}`;
          iframe.setAttribute("frameborder", "0");
          iframe.setAttribute("allowfullscreen", "");
          videoContainer.appendChild(iframe);
        }
      } else if (url.includes("vimeo.com")) {
        const videoId = url.split("vimeo.com/")[1]?.split("?")[0];
        if (videoId) {
          const iframe = document.createElement("iframe");
          iframe.className = "dap-kb-video";
          iframe.src = `https://player.vimeo.com/video/${videoId}`;
          iframe.setAttribute("frameborder", "0");
          iframe.setAttribute("allowfullscreen", "");
          videoContainer.appendChild(iframe);
        }
      } else {
        const video = document.createElement("video");
        video.className = "dap-kb-video";
        video.src = url;
        video.controls = true;
        videoContainer.appendChild(video);
      }
      container.appendChild(videoContainer);
    } else if (type === "image" || /\.(jpg|jpeg|png|gif|webp)$/i.test(url)) {
      const img = document.createElement("img");
      img.className = "dap-kb-image";
      img.src = url;
      img.alt = content.title || "Knowledge Base Image";
      container.appendChild(img);
    } else if (type === "pdf" || /\.pdf$/i.test(url)) {
      const pdfContainer = document.createElement("div");
      pdfContainer.className = "dap-kb-pdf-container";
      const iframe = document.createElement("iframe");
      iframe.className = "dap-kb-pdf-iframe";
      iframe.src = url;
      iframe.setAttribute("frameborder", "0");
      pdfContainer.appendChild(iframe);
      container.appendChild(pdfContainer);
    } else if (type === "doc" || type === "docx" || /\.(doc|docx)$/i.test(url)) {
      const docContainer = document.createElement("div");
      docContainer.className = "dap-kb-document-container";
      const iframe = document.createElement("iframe");
      iframe.className = "dap-kb-document-iframe";
      iframe.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
      iframe.setAttribute("frameborder", "0");
      docContainer.appendChild(iframe);
      container.appendChild(docContainer);
    } else {
      const mimeType = content.mime || content.mimeType || null;
      const isDocumentArticle = mimeType && (mimeType === "application/pdf" || mimeType.includes("word") || mimeType.includes("msword") || mimeType.includes("presentation") || mimeType.includes("powerpoint") || /\.(pdf|doc|docx|ppt|pptx)$/i.test(url));
      if (isDocumentArticle) {
        console.debug("[DAP] Rendering document-based article with enhanced viewer");
        const articleViewer = createArticleViewerInSequence(content);
        container.appendChild(articleViewer);
      } else {
        const articleContainer = document.createElement("div");
        articleContainer.className = "dap-kb-article-container";
        if (content.content) {
          articleContainer.innerHTML = sanitizeHtml(content.content);
        } else if (url) {
          const fallback = createSequenceFallbackViewer(
            url,
            content.fileName || "External Article",
            "This content is available at an external link."
          );
          articleContainer.appendChild(fallback);
        }
        container.appendChild(articleContainer);
      }
    }
    if (content.description) {
      const desc = document.createElement("p");
      desc.className = "dap-kb-item-description";
      desc.textContent = content.description;
      container.appendChild(desc);
    }
    return container;
  }
  var currentSequenceKBData = null;
  var currentSequenceStep = null;
  function openKBItemInSequence(item) {
    console.debug("[DAP] Opening KB item in sequence:", item);
    console.debug("[DAP] KB view changed to item");
    const modal = document.querySelector(".dap-modal-content");
    if (modal && currentSequenceStep) {
      console.debug("[DAP] KB items count:", currentSequenceKBData?.items?.length || 0);
      ({
        ...currentSequenceStep,
        content: {
          ...item
        }
      });
      const contentElement = modal.querySelector(".dap-content");
      if (contentElement) {
        const newContent = renderKBItemViewerInSequence(item);
        contentElement.innerHTML = "";
        contentElement.appendChild(newContent);
      }
    }
  }
  function goBackToKBListInSequence() {
    console.debug("[DAP] Going back to KB list in sequence");
    console.debug("[DAP] KB view changed to list");
    const modal = document.querySelector(".dap-modal-content");
    if (modal && currentSequenceKBData && currentSequenceStep) {
      console.debug("[DAP] KB items count:", currentSequenceKBData?.items?.length || 0);
      ({
        ...currentSequenceStep,
        content: {
          ...currentSequenceKBData
        }
      });
      const contentElement = modal.querySelector(".dap-content");
      if (contentElement) {
        const newContent = renderKnowledgeBaseInSequence(currentSequenceKBData);
        contentElement.innerHTML = "";
        contentElement.appendChild(newContent);
      }
    } else {
      console.error("[DAP] Cannot go back: missing modal, KB data, or step");
    }
  }
  function createArticleViewerInSequence(content) {
    console.debug("[DAP] Creating Article viewer in sequence");
    const container = document.createElement("div");
    container.className = "dap-content-article";
    const url = content.url || content.presignedUrl || "";
    const fileName = content.fileName || "Document";
    const title = content.title || fileName;
    const mimeType = content.mime || content.mimeType || null;
    console.debug("[DAP] Article URL:", url);
    console.debug("[DAP] Article MIME:", mimeType);
    if (!url) {
      console.error("[DAP] No URL provided for Article content");
      container.innerHTML = `
      <div class="dap-fallback-viewer">
        <p><strong>No document URL provided</strong></p>
        <p>Unable to display article content.</p>
      </div>
    `;
      return container;
    }
    const viewerType = resolveArticleViewerType(url, mimeType, fileName);
    console.debug("[DAP] Selected viewer type:", viewerType);
    const titleEl = document.createElement("h4");
    titleEl.className = "dap-article-title";
    titleEl.textContent = title;
    container.appendChild(titleEl);
    switch (viewerType) {
      case "pdf":
        const pdfViewer = createSequencePDFViewer(url, fileName);
        container.appendChild(pdfViewer);
        break;
      case "document":
        const docViewer = createSequenceDocumentViewer(url, fileName, mimeType);
        container.appendChild(docViewer);
        break;
      case "presentation":
        const pptViewer = createSequencePresentationViewer(url, fileName, mimeType);
        container.appendChild(pptViewer);
        break;
      case "fallback":
      default:
        console.debug("[DAP] Fallback activated for sequence");
        const fallbackViewer = createSequenceFallbackViewer(url, fileName, "This document cannot be previewed inline.");
        container.appendChild(fallbackViewer);
        break;
    }
    return container;
  }
  function resolveArticleViewerType(url, mimeType, fileName) {
    console.debug("[DAP] Resolving Article viewer type");
    console.debug("[DAP] MIME type:", mimeType || "none");
    if (mimeType) {
      if (mimeType === "application/pdf") {
        return "pdf";
      }
      if (mimeType.includes("word") || mimeType.includes("msword") || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        return "document";
      }
      if (mimeType.includes("presentation") || mimeType.includes("powerpoint") || mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
        return "presentation";
      }
    }
    const urlLower = url.toLowerCase();
    const fileNameLower = fileName.toLowerCase();
    if (urlLower.includes(".pdf") || fileNameLower.endsWith(".pdf")) {
      return "pdf";
    }
    if (urlLower.match(/\.(doc|docx)/) || fileNameLower.match(/\.(doc|docx)$/)) {
      return "document";
    }
    if (urlLower.match(/\.(ppt|pptx)/) || fileNameLower.match(/\.(ppt|pptx)$/)) {
      return "presentation";
    }
    return "fallback";
  }
  function createSequencePDFViewer(url, fileName) {
    const container = document.createElement("div");
    container.className = "dap-pdf-viewer-container";
    const iframe = document.createElement("iframe");
    iframe.className = "dap-pdf-iframe";
    iframe.src = url;
    iframe.style.width = "100%";
    iframe.style.height = "400px";
    iframe.style.border = "1px solid #ddd";
    iframe.setAttribute("frameborder", "0");
    container.appendChild(iframe);
    const actions = createSequenceDocumentActions(url, fileName);
    container.appendChild(actions);
    return container;
  }
  function createSequenceDocumentViewer(url, fileName, mimeType) {
    const container = document.createElement("div");
    container.className = "dap-document-viewer-container";
    if (mimeType && (mimeType.includes("word") || mimeType.includes("msword"))) {
      const iframe = document.createElement("iframe");
      iframe.className = "dap-document-iframe";
      iframe.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
      iframe.style.width = "100%";
      iframe.style.height = "400px";
      iframe.style.border = "1px solid #ddd";
      iframe.setAttribute("frameborder", "0");
      container.appendChild(iframe);
    } else {
      const fallback = createSequenceFallbackViewer(url, fileName, "Document preview is not supported for this file type.");
      container.appendChild(fallback);
    }
    const actions = createSequenceDocumentActions(url, fileName);
    container.appendChild(actions);
    return container;
  }
  function createSequencePresentationViewer(url, fileName, mimeType) {
    const container = document.createElement("div");
    container.className = "dap-presentation-viewer-container";
    if (mimeType && mimeType.includes("presentation")) {
      const iframe = document.createElement("iframe");
      iframe.className = "dap-presentation-iframe";
      iframe.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
      iframe.style.width = "100%";
      iframe.style.height = "400px";
      iframe.style.border = "1px solid #ddd";
      iframe.setAttribute("frameborder", "0");
      container.appendChild(iframe);
    } else {
      const fallback = createSequenceFallbackViewer(url, fileName, "Presentation preview is not supported for this file type.");
      container.appendChild(fallback);
    }
    const actions = createSequenceDocumentActions(url, fileName);
    container.appendChild(actions);
    return container;
  }
  function createSequenceFallbackViewer(url, fileName, message) {
    const container = document.createElement("div");
    container.className = "dap-fallback-viewer";
    container.innerHTML = `
    <div class="dap-fallback-message">
      <p><strong>${message}</strong></p>
      <p>File: ${fileName}</p>
    </div>
  `;
    const actions = createSequenceDocumentActions(url, fileName);
    container.appendChild(actions);
    return container;
  }
  function createSequenceDocumentActions(url, fileName) {
    const actions = document.createElement("div");
    actions.className = "dap-document-actions";
    const downloadBtn = document.createElement("button");
    downloadBtn.className = "dap-action-btn dap-download-btn";
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.downloadFile) {
        window.downloadFile(url, fileName);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName || "download";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
    const openBtn = document.createElement("button");
    openBtn.className = "dap-action-btn dap-open-btn";
    openBtn.textContent = "Open in New Tab";
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(url, "_blank", "noopener,noreferrer");
    });
    actions.appendChild(downloadBtn);
    actions.appendChild(openBtn);
    return actions;
  }

  // src/experiences/modal.ts
  init_registry();
  var modalCssText2 = `
/* Font stack: system fonts are used; no external font requests are made. */

:root {
  --dap-bg-glass:        rgba(10, 10, 18, 0.72);
  --dap-bg-surface:      rgba(18, 18, 30, 0.95);
  --dap-bg-elevated:     rgba(30, 30, 48, 0.9);
  --dap-bg-hover:        rgba(50, 50, 78, 0.6);
  --dap-border:          rgba(255, 255, 255, 0.08);
  --dap-border-glow:     rgba(120, 100, 255, 0.35);
  --dap-accent:          #7c6aff;
  --dap-accent-soft:     rgba(124, 106, 255, 0.15);
  --dap-accent-glow:     rgba(124, 106, 255, 0.4);
  --dap-text-primary:    #f0eeff;
  --dap-text-secondary:  rgba(200, 195, 230, 0.65);
  --dap-text-muted:      rgba(160, 155, 200, 0.4);
  --dap-success:         #34d399;
  --dap-warning:         #fbbf24;
  --dap-danger:          #f87171;
  --dap-radius-sm:       8px;
  --dap-radius-md:       14px;
  --dap-radius-lg:       20px;
  --dap-radius-xl:       28px;
  --dap-shadow-deep:     0 32px 80px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.5);
  --dap-shadow-glow:     0 0 40px rgba(124, 106, 255, 0.12);
  --dap-transition:      cubic-bezier(0.34, 1.56, 0.64, 1);
  --dap-ease:            cubic-bezier(0.22, 1, 0.36, 1);
}

/* \u2500\u2500 Overlay \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 4, 12, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  animation: dapOverlayIn 0.35s var(--dap-ease) both;
  padding: 20px;
}

.dap-modal-overlay.dragging {
  cursor: grabbing;
  user-select: none;
}

@keyframes dapOverlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes dapOverlayOut {
  from { opacity: 1; backdrop-filter: blur(20px); }
  to   { opacity: 0; backdrop-filter: blur(0px); }
}

/* Subtle noise grain overlay */
.dap-modal-overlay::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 200px 200px;
  z-index: -1;
}

/* \u2500\u2500 Modal Shell \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal {
  position: relative;
  background: var(--dap-bg-surface);
  border: 1px solid var(--dap-border);
  border-radius: var(--dap-radius-xl);
  box-shadow: var(--dap-shadow-deep), var(--dap-shadow-glow), inset 0 1px 0 rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  width: 100%;
  overflow: hidden;
  animation: dapModalIn 0.45s var(--dap-transition) both;
  font-family: 'Sora', sans-serif;
  color: var(--dap-text-primary);
  will-change: transform;
}

/* Accent line at top */
.dap-modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--dap-accent), transparent);
  opacity: 0.6;
  z-index: 1;
}

@keyframes dapModalIn {
  from {
    opacity: 0;
    transform: scale(0.88) translateY(24px);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: blur(0);
  }
}

@keyframes dapModalOut {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
    filter: blur(0);
  }
  to {
    opacity: 0;
    transform: scale(0.92) translateY(-16px);
    filter: blur(4px);
  }
}

/* Size Variants */
.dap-modal-small  { max-width: 420px; }
.dap-modal-medium { max-width: 640px; }
.dap-modal-large  { max-width: 900px; }
.dap-modal-xl     { max-width: 1100px; }
.dap-modal-full   { max-width: calc(100vw - 40px); max-height: calc(100vh - 40px); }

/* \u2500\u2500 Header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--dap-border);
  background: linear-gradient(180deg, rgba(30,28,56,0.6) 0%, transparent 100%);
  flex-shrink: 0;
  position: relative;
  cursor: default;
  gap: 12px;
  transition: background 0.2s;
}

.dap-modal-header:hover {
  background: linear-gradient(180deg, rgba(40,38,70,0.7) 0%, transparent 100%);
}

.dap-modal-header.dragging {
  cursor: grabbing;
  background: linear-gradient(180deg, rgba(50,48,88,0.8) 0%, transparent 100%);
}

/* Drag indicator dots */
.dap-modal-header::after {
  content: '\u283F';
  font-size: 14px;
  color: var(--dap-text-muted);
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 50%;
  margin-top: -7px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}

.dap-modal-header:hover::after {
  opacity: 1;
}

/* \u2500\u2500 Title \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--dap-text-primary);
  margin: 0;
  flex: 1;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* \u2500\u2500 Close Button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-close {
  width: 32px;
  height: 32px;
  border: 1px solid var(--dap-border);
  border-radius: 50%;
  background: rgba(255,255,255,0.04);
  color: var(--dap-text-secondary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s var(--dap-ease);
  position: relative;
  overflow: hidden;
}

.dap-modal-close::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at center, rgba(248, 113, 113, 0.2), transparent);
  opacity: 0;
  transition: opacity 0.2s;
}

.dap-modal-close:hover {
  border-color: rgba(248, 113, 113, 0.4);
  color: var(--dap-danger);
  transform: rotate(90deg) scale(1.1);
}

.dap-modal-close:hover::before { opacity: 1; }

.dap-modal-close:active {
  transform: rotate(90deg) scale(0.95);
}

/* \u2500\u2500 Body \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Custom scrollbar */
.dap-modal-body::-webkit-scrollbar {
  width: 4px;
}
.dap-modal-body::-webkit-scrollbar-track {
  background: transparent;
}
.dap-modal-body::-webkit-scrollbar-thumb {
  background: rgba(124, 106, 255, 0.3);
  border-radius: 2px;
}
.dap-modal-body::-webkit-scrollbar-thumb:hover {
  background: rgba(124, 106, 255, 0.5);
}

/* \u2500\u2500 Footer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--dap-border);
  background: linear-gradient(0deg, rgba(10,10,18,0.4) 0%, transparent 100%);
  flex-shrink: 0;
}

.dap-modal-footer:empty {
  padding: 0;
  border: none;
}

.dap-footer-text {
  margin: 0;
  font-size: 12px;
  color: var(--dap-text-muted);
  line-height: 1.5;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 400;
}

/* \u2500\u2500 Text Content \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-text {
  font-size: 14.5px;
  line-height: 1.75;
  color: var(--dap-text-secondary);
  animation: dapFadeUp 0.4s var(--dap-ease) both;
}

.dap-content-text p { margin: 0 0 12px; }
.dap-content-text p:last-child { margin: 0; }

.dap-content-text h1, .dap-content-text h2, .dap-content-text h3 {
  color: var(--dap-text-primary);
  font-weight: 600;
  margin: 0 0 8px;
}

.dap-content-text a {
  color: var(--dap-accent);
  text-decoration: none;
  border-bottom: 1px solid rgba(124,106,255,0.3);
  transition: border-color 0.2s;
}
.dap-content-text a:hover {
  border-color: var(--dap-accent);
}

.dap-content-text code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  background: rgba(124,106,255,0.1);
  border: 1px solid rgba(124,106,255,0.2);
  padding: 2px 6px;
  border-radius: 4px;
  color: #c4b8ff;
}

@keyframes dapFadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* \u2500\u2500 Image \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-image {
  width: 100%;
  border-radius: var(--dap-radius-lg);
  display: block;
  object-fit: cover;
  border: 1px solid var(--dap-border);
  animation: dapFadeIn 0.5s var(--dap-ease) both;
  transition: transform 0.4s var(--dap-ease), box-shadow 0.4s;
}

.dap-content-image:hover {
  transform: scale(1.01);
  box-shadow: 0 16px 48px rgba(0,0,0,0.4);
}

/* \u2500\u2500 Video \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-video {
  width: 100%;
  border-radius: var(--dap-radius-lg);
  border: 1px solid var(--dap-border);
  background: #000;
  display: block;
  animation: dapFadeIn 0.5s var(--dap-ease) both;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

/* \u2500\u2500 YouTube \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-youtube {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: var(--dap-radius-lg);
  border: 1px solid var(--dap-border);
  display: block;
  animation: dapFadeIn 0.5s var(--dap-ease) both;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

/* \u2500\u2500 Link \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--dap-accent-soft);
  border: 1px solid var(--dap-border-glow);
  border-radius: var(--dap-radius-sm);
  color: var(--dap-accent);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
}

.dap-content-link:hover {
  background: rgba(124,106,255,0.22);
  transform: translateX(3px);
  box-shadow: 0 4px 16px rgba(124,106,255,0.2);
}

.dap-content-link::after {
  content: '\u2197';
  font-size: 12px;
  opacity: 0.7;
}

/* \u2500\u2500 Buttons \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.dap-modal-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--dap-radius-sm);
  font-family: 'Sora', sans-serif;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.22s var(--dap-ease);
  border: 1px solid transparent;
  letter-spacing: 0.01em;
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}

.dap-modal-button::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(255,255,255,0.08), transparent);
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
}

.dap-modal-button:hover::after { opacity: 1; }

.dap-modal-button.primary {
  background: linear-gradient(135deg, #7c6aff, #9f54f7);
  color: #fff;
  border-color: rgba(255,255,255,0.15);
  box-shadow: 0 4px 16px rgba(124,106,255,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
}

.dap-modal-button.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(124,106,255,0.45), inset 0 1px 0 rgba(255,255,255,0.2);
}

.dap-modal-button.primary:active {
  transform: translateY(0);
}

.dap-modal-button.secondary {
  background: rgba(255,255,255,0.05);
  color: var(--dap-text-primary);
  border-color: var(--dap-border);
}

.dap-modal-button.secondary:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.15);
  transform: translateY(-1px);
}

.dap-modal-button.outline {
  background: transparent;
  color: var(--dap-accent);
  border-color: var(--dap-border-glow);
}

.dap-modal-button.outline:hover {
  background: var(--dap-accent-soft);
  transform: translateY(-1px);
}

/* \u2500\u2500 Knowledge Base \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-kb {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dap-content-kb > h3 {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dap-accent);
  margin: 0 0 12px;
  font-family: 'JetBrains Mono', monospace;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dap-content-kb > h3::before {
  content: '';
  display: block;
  width: 16px;
  height: 2px;
  background: var(--dap-accent);
  border-radius: 1px;
}

.dap-kb-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  animation: dapFadeUp 0.3s var(--dap-ease) both;
}

.dap-kb-item-button {
  width: 100%;
  text-align: left;
  padding: 12px 16px;
  background: var(--dap-bg-elevated);
  border: 1px solid var(--dap-border);
  border-radius: var(--dap-radius-md);
  color: var(--dap-text-primary);
  font-family: 'Sora', sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.22s var(--dap-ease);
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  overflow: hidden;
}

.dap-kb-item-button::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--dap-accent);
  transform: scaleY(0);
  transition: transform 0.2s var(--dap-ease);
  border-radius: 1px;
}

.dap-kb-item-button:hover {
  background: var(--dap-bg-hover);
  border-color: var(--dap-border-glow);
  transform: translateX(4px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
}

.dap-kb-item-button:hover::before {
  transform: scaleY(1);
}

.dap-kb-description {
  font-size: 12.5px;
  color: var(--dap-text-muted);
  margin: 2px 0 0 42px;
  line-height: 1.4;
}

.dap-kb-no-items {
  font-size: 14px;
  color: var(--dap-text-muted);
  text-align: center;
  padding: 32px;
  border: 1px dashed var(--dap-border);
  border-radius: var(--dap-radius-md);
  margin: 0;
}

/* KB Icons */
.dap-kb-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  background: rgba(124,106,255,0.1);
}

/* \u2500\u2500 File Type Badge \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-file-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--dap-accent-soft);
  border: 1px solid var(--dap-border-glow);
  border-radius: 100px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--dap-accent);
  font-family: 'JetBrains Mono', monospace;
  text-transform: uppercase;
  flex-shrink: 0;
}

/* \u2500\u2500 KB Item Viewer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-item-viewer {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dap-kb-viewer-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--dap-border);
}

.dap-kb-back-button {
  align-self: flex-start;
  font-size: 13px;
  padding: 7px 14px;
}

.dap-kb-item-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--dap-text-primary);
  margin: 0;
  line-height: 1.3;
}

.dap-file-metadata {
  font-size: 12px;
  color: var(--dap-text-muted);
  font-family: 'JetBrains Mono', monospace;
  margin: 0;
}

/* \u2500\u2500 Media Viewers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-image,
.dap-kb-video {
  width: 100%;
  border-radius: var(--dap-radius-lg);
  border: 1px solid var(--dap-border);
  display: block;
  background: #000;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

.dap-kb-pdf-container,
.dap-kb-document-container,
.dap-pdf-viewer-container,
.dap-document-viewer-container,
.dap-presentation-viewer-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dap-kb-pdf-iframe,
.dap-pdf-iframe,
.dap-document-iframe,
.dap-presentation-iframe {
  width: 100%;
  height: 520px;
  border: 1px solid var(--dap-border);
  border-radius: var(--dap-radius-md);
  background: rgba(255,255,255,0.02);
}

.dap-kb-youtube {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: var(--dap-radius-lg);
  border: 1px solid var(--dap-border);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

/* \u2500\u2500 Article Viewer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-article-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dap-article-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--dap-text-primary);
  margin: 0;
  line-height: 1.4;
}

.dap-article-description {
  font-size: 13.5px;
  color: var(--dap-text-secondary);
  line-height: 1.65;
  margin: 0;
}

.dap-article-content {
  font-size: 14px;
  line-height: 1.8;
  color: var(--dap-text-secondary);
  padding: 20px;
  background: var(--dap-bg-elevated);
  border: 1px solid var(--dap-border);
  border-radius: var(--dap-radius-md);
}

/* \u2500\u2500 Loading \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-article-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 48px 24px;
  color: var(--dap-text-muted);
  font-size: 13px;
}

.dap-loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--dap-border);
  border-top-color: var(--dap-accent);
  border-radius: 50%;
  animation: dapSpin 0.8s linear infinite;
}

@keyframes dapSpin {
  to { transform: rotate(360deg); }
}

/* \u2500\u2500 Action Buttons \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-document-actions,
.dap-enhanced-document-actions,
.dap-web-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.dap-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: var(--dap-radius-sm);
  font-family: 'Sora', sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s var(--dap-ease);
  border: 1px solid var(--dap-border);
  letter-spacing: 0.01em;
}

.dap-primary-btn, .dap-download-btn.dap-primary-btn {
  background: linear-gradient(135deg, #7c6aff, #9f54f7);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4px 14px rgba(124,106,255,0.3);
}

.dap-primary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(124,106,255,0.45);
}

.dap-secondary-btn, .dap-open-btn {
  background: rgba(255,255,255,0.05);
  color: var(--dap-text-primary);
}

.dap-secondary-btn:hover, .dap-open-btn:hover {
  background: rgba(255,255,255,0.1);
  transform: translateY(-1px);
}

.dap-btn-icon { font-size: 15px; }

/* \u2500\u2500 Fallback Viewers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-fallback-viewer,
.dap-enhanced-fallback-viewer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 24px;
  text-align: center;
  background: var(--dap-bg-elevated);
  border: 1px dashed var(--dap-border);
  border-radius: var(--dap-radius-lg);
}

.dap-fallback-icon {
  font-size: 48px;
  line-height: 1;
  animation: dapFadeIn 0.5s var(--dap-ease);
}

.dap-enhanced-fallback-message h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--dap-text-primary);
  margin: 0 0 8px;
}

.dap-fallback-primary {
  font-size: 13.5px;
  color: var(--dap-text-secondary);
  margin: 0 0 6px;
}

.dap-fallback-filename,
.dap-fallback-type {
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--dap-text-muted);
  margin: 2px 0 0;
}

.dap-kb-link-container {
  padding: 20px;
  background: var(--dap-bg-elevated);
  border: 1px solid var(--dap-border);
  border-radius: var(--dap-radius-md);
}

.dap-kb-link-info h4 {
  margin: 0 0 8px;
  color: var(--dap-text-primary);
  font-size: 15px;
}

.dap-kb-link-info p {
  margin: 0 0 4px;
  font-size: 13px;
  color: var(--dap-text-muted);
}

.dap-kb-document-info {
  padding: 20px;
  background: var(--dap-bg-elevated);
  border: 1px solid var(--dap-border);
  border-radius: var(--dap-radius-md);
}

.dap-kb-document-info h4 {
  margin: 0 0 8px;
  color: var(--dap-text-primary);
}

.dap-kb-external-btn,
.dap-kb-download-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  background: var(--dap-accent-soft);
  border: 1px solid var(--dap-border-glow);
  border-radius: var(--dap-radius-sm);
  color: var(--dap-accent);
  font-size: 13px;
  font-weight: 500;
  font-family: 'Sora', sans-serif;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 12px;
}

.dap-kb-external-btn:hover, .dap-kb-download-btn:hover {
  background: rgba(124,106,255,0.22);
  transform: translateY(-1px);
}

/* \u2500\u2500 Web Content Viewer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-web-viewer-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dap-web-iframe {
  border-radius: var(--dap-radius-md) !important;
}

/* \u2500\u2500 Misc Animations \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@keyframes dapFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* \u2500\u2500 Responsive \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@media (max-width: 600px) {
  .dap-modal-overlay { padding: 12px; }
  .dap-modal { border-radius: var(--dap-radius-lg); }
  .dap-modal-body { padding: 16px; }
  .dap-modal-header { padding: 14px 16px 12px; }
  .dap-modal-footer { padding: 12px 16px; }
  .dap-modal-title { font-size: 14px; }
  .dap-kb-item-button { padding: 10px 12px; }
  .dap-modal-button { padding: 9px 16px; font-size: 13px; }
}

/* \u2500\u2500 Focus Visible \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal *:focus-visible {
  outline: 2px solid var(--dap-accent);
  outline-offset: 3px;
  border-radius: 4px;
}
`;
  function registerModal() {
    register("modal", renderModal);
  }
  async function renderModal(flow) {
    const { payload, id } = flow;
    console.debug("[DAP] renderModal called with payload:", payload);
    console.debug("[DAP] Modal flow ID:", id);
    const completionTracker = payload._completionTracker;
    ensureStyles2();
    const { overlay, modal, header} = createModalElements(payload);
    document.documentElement.appendChild(overlay);
    const prevActive = document.activeElement;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "modal-title");
    setupModalAccessibility(modal);
    let _modalClosed = false;
    function closeModal() {
      if (_modalClosed) return;
      _modalClosed = true;
      document.removeEventListener("keydown", handleKeyboard);
      if (modal._accessibilityCleanup) {
        modal._accessibilityCleanup();
      }
      overlay.style.animation = "dapOverlayOut 0.28s var(--dap-ease) both";
      modal.style.animation = "dapModalOut 0.28s var(--dap-ease) both";
      setTimeout(() => {
        overlay.remove();
        prevActive?.focus();
        if (completionTracker?.onComplete) {
          console.debug(`[DAP] Completing modal flow: ${id}`);
          completionTracker.onComplete();
        }
      }, 280);
    }
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    const closeBtn = modal.querySelector(".dap-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    function handleKeyboard(e) {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", handleKeyboard);
      }
    }
    document.addEventListener("keydown", handleKeyboard);
    setupModalDragging(modal, header, overlay);
    setupMediaHandling(modal, overlay);
  }
  function setupModalDragging(modal, header, overlay) {
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let modalStartX = 0, modalStartY = 0;
    const startDrag = (e) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = modal.getBoundingClientRect();
      modalStartX = rect.left;
      modalStartY = rect.top;
      header.classList.add("dragging");
      overlay.classList.add("dragging");
      modal.style.transition = "none";
      document.addEventListener("mousemove", drag);
      document.addEventListener("mouseup", endDrag);
      e.preventDefault();
    };
    const drag = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;
      let newX = modalStartX + deltaX;
      let newY = modalStartY + deltaY;
      const modalRect = modal.getBoundingClientRect();
      newX = Math.max(10, Math.min(newX, window.innerWidth - modalRect.width - 10));
      newY = Math.max(10, Math.min(newY, window.innerHeight - modalRect.height - 10));
      modal.style.position = "fixed";
      modal.style.left = `${newX}px`;
      modal.style.top = `${newY}px`;
      modal.style.transform = "none";
    };
    const endDrag = () => {
      isDragging = false;
      header.classList.remove("dragging");
      overlay.classList.remove("dragging");
      modal.style.transition = "";
      document.removeEventListener("mousemove", drag);
      document.removeEventListener("mouseup", endDrag);
    };
    header.addEventListener("mousedown", startDrag);
  }
  function setupModalAccessibility(modal, overlay) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    if (firstFocusable) firstFocusable.focus();
    const handleTabKey = (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };
    modal.addEventListener("keydown", handleTabKey);
    modal._accessibilityCleanup = () => modal.removeEventListener("keydown", handleTabKey);
  }
  function setupMediaHandling(modal, overlay) {
    const videos = modal.querySelectorAll("video");
    const pausedVideos = [];
    const originalRemove = overlay.remove.bind(overlay);
    overlay.remove = () => {
      videos.forEach((video) => {
        if (!video.paused) {
          video.pause();
          pausedVideos.push(video);
        }
      });
      originalRemove();
      setTimeout(() => {
        pausedVideos.forEach((video) => {
          if (document.contains(video)) video.play().catch(() => {
          });
        });
      }, 100);
    };
  }
  function createModalElements(payload) {
    const overlay = document.createElement("div");
    overlay.className = "dap-modal-overlay";
    const modal = document.createElement("div");
    modal.className = `dap-modal dap-modal-${payload.size || "medium"}`;
    const header = document.createElement("div");
    header.className = "dap-modal-header";
    const title = document.createElement("h2");
    title.className = "dap-modal-title";
    title.id = "modal-title";
    if (payload.title) {
      title.textContent = payload.title;
    } else {
      title.style.visibility = "hidden";
      title.innerHTML = "&nbsp;";
    }
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.className = "dap-modal-close";
    closeBtn.setAttribute("aria-label", "Close modal");
    closeBtn.innerHTML = "\xD7";
    header.appendChild(closeBtn);
    const body = document.createElement("div");
    body.className = "dap-modal-body";
    if (Array.isArray(payload.body)) {
      payload.body.forEach((content, index) => {
        const el = renderModalContent2(content);
        if (el) {
          el.style.animationDelay = `${index * 60}ms`;
          body.appendChild(el);
        }
      });
    } else if (payload.body) {
      const textEl = document.createElement("div");
      textEl.className = "dap-content-text";
      textEl.textContent = String(payload.body);
      body.appendChild(textEl);
    }
    const footer = document.createElement("div");
    footer.className = "dap-modal-footer";
    if (payload.footerText) {
      const footerText = document.createElement("p");
      footerText.className = "dap-footer-text";
      footerText.innerHTML = sanitizeHtml(payload.footerText);
      footer.appendChild(footerText);
    }
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    return { overlay, modal, header, body, footer };
  }
  function renderModalContent2(content) {
    switch (content.kind) {
      case "text": {
        const el = document.createElement("div");
        el.className = "dap-content-text";
        el.innerHTML = sanitizeHtml(content.html);
        return el;
      }
      case "link": {
        const el = document.createElement("a");
        el.className = "dap-content-link";
        el.href = content.href;
        el.textContent = content.label || content.href;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
        return el;
      }
      case "image": {
        const wrap = document.createElement("div");
        wrap.style.cssText = "overflow:hidden;border-radius:var(--dap-radius-lg);";
        const img = document.createElement("img");
        img.className = "dap-content-image";
        img.src = content.url;
        img.alt = content.alt || "";
        wrap.appendChild(img);
        return wrap;
      }
      case "video": {
        if (content.sources && content.sources.length > 0) {
          const video = document.createElement("video");
          video.className = "dap-content-video";
          video.controls = true;
          content.sources.forEach((source) => {
            const s = document.createElement("source");
            s.src = source.src;
            if (source.type) s.type = source.type;
            video.appendChild(s);
          });
          return video;
        }
        return null;
      }
      case "youtube": {
        const iframe = document.createElement("iframe");
        iframe.className = "dap-content-youtube";
        iframe.src = content.href;
        iframe.setAttribute("frameborder", "0");
        iframe.setAttribute("allowfullscreen", "true");
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        return iframe;
      }
      case "kb":
        return renderKnowledgeBase(content);
      case "kb-item-viewer":
        return renderKBItemViewer(content);
      case "article":
        return createArticleViewer(content);
      default:
        console.warn("[DAP] Unknown content kind:", content?.kind);
        return null;
    }
  }
  var kbState = null;
  function renderKnowledgeBase(content) {
    const kbEl = document.createElement("div");
    kbEl.className = "dap-content-kb";
    if (!kbState || kbState.view === "item") {
      kbState = {
        view: "list",
        items: content.items || [],
        selectedItem: null,
        title: content.title || "Knowledge Base",
        modalBodyRef: null
      };
    }
    if (content.title) {
      const title = document.createElement("h3");
      title.textContent = content.title;
      kbEl.appendChild(title);
    }
    if (content.items && Array.isArray(content.items)) {
      content.items.forEach((item, index) => {
        const itemEl = document.createElement("div");
        itemEl.className = "dap-kb-item";
        itemEl.style.animationDelay = `${index * 50}ms`;
        let itemUrl = "", itemTitle = "", itemDescription = "", itemType = "";
        if (typeof item === "string") {
          itemUrl = itemTitle = item;
          itemType = "link";
        } else if (item && typeof item === "object") {
          const ki = item;
          itemUrl = ki.url || "";
          itemTitle = ki.title || "";
          itemDescription = ki.description || "";
          itemType = ki.itemType || detectContentType(itemUrl, ki.fileName);
        } else {
          return;
        }
        if (!itemUrl || !itemTitle) return;
        const button = document.createElement("button");
        button.className = "dap-kb-item-button";
        button.title = itemDescription || itemTitle;
        const icon = document.createElement("span");
        icon.className = `dap-kb-icon dap-kb-icon-${itemType}`;
        icon.textContent = getTypeEmoji(itemType);
        button.appendChild(icon);
        const label = document.createElement("span");
        label.textContent = itemTitle;
        button.appendChild(label);
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openKBItemInModal(item, content.title || "Knowledge Base");
        });
        itemEl.appendChild(button);
        if (itemDescription) {
          const desc = document.createElement("p");
          desc.className = "dap-kb-description";
          desc.textContent = itemDescription;
          itemEl.appendChild(desc);
        }
        kbEl.appendChild(itemEl);
      });
    } else {
      const noItems = document.createElement("p");
      noItems.className = "dap-kb-no-items";
      noItems.textContent = "No knowledge base items available.";
      kbEl.appendChild(noItems);
    }
    return kbEl;
  }
  function getTypeEmoji(type) {
    const map = {
      video: "\u{1F3A5}",
      image: "\u{1F5BC}\uFE0F",
      pdf: "\u{1F4C4}",
      docx: "\u{1F4DD}",
      doc: "\u{1F4DD}",
      pptx: "\u{1F4CA}",
      ppt: "\u{1F4CA}",
      xlsx: "\u{1F4C8}",
      xls: "\u{1F4C8}",
      youtube: "\u25B6\uFE0F",
      link: "\u{1F517}",
      article: "\u{1F4F0}"
    };
    return map[type] || "\u{1F4C4}";
  }
  function renderKBItemViewer(content) {
    const viewerEl = document.createElement("div");
    viewerEl.className = "dap-kb-item-viewer";
    const headerEl = document.createElement("div");
    headerEl.className = "dap-kb-viewer-header";
    const backBtn = document.createElement("button");
    backBtn.className = "dap-kb-back-button dap-modal-button outline";
    backBtn.textContent = "\u2190 Back to " + (content.kbTitle || "Knowledge Base");
    backBtn.addEventListener("click", goBackToKBList);
    headerEl.appendChild(backBtn);
    const itemType = content.item.itemType || detectContentType(content.item.url, content.item.fileName);
    headerEl.appendChild(createFileTypeBadge(itemType, content.item.fileName));
    const title = document.createElement("h3");
    title.className = "dap-kb-item-title";
    title.textContent = content.item.title || "Content";
    headerEl.appendChild(title);
    if (content.item.fileName) {
      const fileInfo = document.createElement("p");
      fileInfo.className = "dap-file-metadata";
      fileInfo.textContent = `\u{1F4C1} ${content.item.fileName}`;
      headerEl.appendChild(fileInfo);
    }
    viewerEl.appendChild(headerEl);
    const contentEl = renderKBItemContent(content.item);
    if (contentEl) viewerEl.appendChild(contentEl);
    return viewerEl;
  }
  function renderKBItemContent(item) {
    const itemType = item.itemType || detectContentType(item.url, item.fileName);
    switch (itemType) {
      case "video":
        return createVideoViewer(item.url);
      case "image":
        return createImageViewer(item.url, item.title);
      case "pdf":
        return createPDFViewer(item.url, item.fileName);
      case "article":
        return createArticleViewer(item);
      case "doc":
      case "docx":
        return createDocumentViewer(item.url, item.fileName, itemType);
      case "youtube":
        return createYouTubeViewer(item.url);
      case "link":
      default:
        return createLinkViewer(item.url, item.title, item.description);
    }
  }
  function createVideoViewer(url) {
    const video = document.createElement("video");
    video.className = "dap-kb-video";
    video.controls = true;
    video.preload = "metadata";
    const src = document.createElement("source");
    src.src = url;
    video.appendChild(src);
    return video;
  }
  function createImageViewer(url, alt) {
    const img = document.createElement("img");
    img.className = "dap-kb-image";
    img.src = url;
    img.alt = alt || "";
    return img;
  }
  function createPDFViewer(url, fileName) {
    const container = document.createElement("div");
    container.className = "dap-kb-pdf-container";
    const iframe = document.createElement("iframe");
    iframe.className = "dap-kb-pdf-iframe";
    iframe.src = url;
    iframe.setAttribute("frameborder", "0");
    const fallback = document.createElement("div");
    fallback.className = "dap-enhanced-fallback-viewer";
    fallback.style.display = "none";
    fallback.innerHTML = `<div class="dap-fallback-icon">\u{1F4C4}</div>
    <div><p class="dap-fallback-primary">PDF preview not available.</p></div>`;
    const openBtn = document.createElement("button");
    openBtn.className = "dap-action-btn dap-secondary-btn";
    openBtn.textContent = "Open PDF \u2197";
    openBtn.addEventListener("click", () => window.open(url, "_blank"));
    fallback.appendChild(openBtn);
    iframe.addEventListener("error", () => {
      iframe.style.display = "none";
      fallback.style.display = "flex";
    });
    container.appendChild(iframe);
    container.appendChild(fallback);
    return container;
  }
  function createYouTubeViewer(url) {
    const iframe = document.createElement("iframe");
    iframe.className = "dap-kb-youtube";
    iframe.src = url;
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    return iframe;
  }
  function createLinkViewer(url, title, description) {
    const container = document.createElement("div");
    container.className = "dap-kb-link-container";
    const info = document.createElement("div");
    info.className = "dap-kb-link-info";
    const h = document.createElement("h4");
    h.textContent = title || "External Link";
    info.appendChild(h);
    if (description) {
      const p = document.createElement("p");
      p.textContent = description;
      info.appendChild(p);
    }
    const urlP = document.createElement("p");
    urlP.style.fontFamily = "'JetBrains Mono', monospace";
    urlP.style.fontSize = "12px";
    urlP.textContent = url;
    info.appendChild(urlP);
    const btn = document.createElement("button");
    btn.className = "dap-kb-external-btn";
    btn.textContent = "Open Link \u2197";
    btn.addEventListener("click", () => window.open(url, "_blank", "noopener,noreferrer"));
    info.appendChild(btn);
    container.appendChild(info);
    return container;
  }
  function createDocumentViewer(url, fileName, type) {
    const container = document.createElement("div");
    container.className = "dap-kb-document-container";
    const info = document.createElement("div");
    info.className = "dap-kb-document-info";
    const h = document.createElement("h4");
    h.textContent = fileName || "Document";
    info.appendChild(h);
    if (type) {
      const typeP = document.createElement("p");
      typeP.style.fontSize = "12px";
      typeP.style.color = "var(--dap-text-muted)";
      typeP.style.fontFamily = "'JetBrains Mono', monospace";
      typeP.textContent = type.toUpperCase() + " Document";
      info.appendChild(typeP);
    }
    const actions = document.createElement("div");
    actions.className = "dap-document-actions";
    actions.style.marginTop = "14px";
    const openBtn = document.createElement("button");
    openBtn.className = "dap-action-btn dap-secondary-btn";
    openBtn.textContent = "Open in New Tab \u2197";
    openBtn.addEventListener("click", () => window.open(url, "_blank"));
    const dlBtn = document.createElement("button");
    dlBtn.className = "dap-action-btn dap-primary-btn";
    dlBtn.textContent = "\u2B07 Download";
    dlBtn.addEventListener("click", () => window.downloadFile(url, fileName));
    actions.appendChild(dlBtn);
    actions.appendChild(openBtn);
    info.appendChild(actions);
    container.appendChild(info);
    return container;
  }
  function resolveArticleViewer(articleContent) {
    const url = articleContent.url || articleContent.presignedUrl || "";
    const mimeType = articleContent.mime || articleContent.mimeType || null;
    const fileName = articleContent.fileName || "";
    if (mimeType) {
      if (mimeType === "application/pdf") return { viewer: "pdf", mimeType };
      if (mimeType.includes("word") || mimeType.includes("msword") || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        return { viewer: "document", mimeType };
      if (mimeType.includes("presentation") || mimeType.includes("powerpoint") || mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation")
        return { viewer: "presentation", mimeType };
      if (mimeType === "text/html" || mimeType.includes("text/"))
        return { viewer: "web", mimeType };
    }
    const ul = url.toLowerCase(), fl = fileName.toLowerCase();
    if (ul.includes(".pdf") || fl.endsWith(".pdf")) return { viewer: "pdf", mimeType: "application/pdf" };
    if (ul.match(/\.(doc|docx)/) || fl.match(/\.(doc|docx)$/))
      return { viewer: "document", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    if (ul.match(/\.(ppt|pptx)/) || fl.match(/\.(ppt|pptx)$/))
      return { viewer: "presentation", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
    if (ul.match(/\.(html?|htm)/) || fl.match(/\.(html?|htm)$/))
      return { viewer: "web", mimeType: "text/html" };
    if (url && (url.startsWith("http://") || url.startsWith("https://")) && !ul.match(/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|rar)$/))
      return { viewer: "web", mimeType: "text/html" };
    return { viewer: "fallback", mimeType };
  }
  function createArticleViewer(articleContent) {
    const container = document.createElement("div");
    container.className = "dap-kb-article-viewer";
    const url = articleContent.url || articleContent.presignedUrl || "";
    const fileName = articleContent.fileName || "Document";
    const title = articleContent.title || fileName;
    const description = articleContent.description || "";
    const content = articleContent.content || "";
    const titleEl = document.createElement("h4");
    titleEl.className = "dap-article-title";
    titleEl.textContent = title;
    container.appendChild(titleEl);
    if (description) {
      const descEl = document.createElement("p");
      descEl.className = "dap-article-description";
      descEl.textContent = description;
      container.appendChild(descEl);
    }
    if (content && content.trim()) {
      const contentEl = document.createElement("div");
      contentEl.className = "dap-article-content";
      contentEl.innerHTML = sanitizeHtml(content);
      container.appendChild(contentEl);
      if (url) container.appendChild(createDocumentActions(url, fileName));
    } else if (url) {
      const loadingEl = document.createElement("div");
      loadingEl.className = "dap-article-loading";
      loadingEl.innerHTML = `<div class="dap-loading-spinner"></div><p>Loading content\u2026</p>`;
      container.appendChild(loadingEl);
      const { viewer, mimeType } = resolveArticleViewer(articleContent);
      setTimeout(() => {
        loadingEl.remove();
        switch (viewer) {
          case "pdf":
            container.appendChild(createInlinePDFViewer(url, fileName));
            break;
          case "document":
            container.appendChild(createInlineDocumentViewer(url, fileName, mimeType));
            break;
          case "presentation":
            container.appendChild(createInlinePresentationViewer(url, fileName, mimeType));
            break;
          case "web":
            container.appendChild(createWebContentViewer(url, title));
            break;
          default:
            container.appendChild(createEnhancedFallbackViewer(articleContent, "This document cannot be previewed inline."));
            break;
        }
      }, 300);
    } else {
      container.appendChild(createEnhancedFallbackViewer(articleContent, "No article content available to display."));
    }
    return container;
  }
  function createInlinePDFViewer(url, fileName) {
    const container = document.createElement("div");
    container.className = "dap-pdf-viewer-container";
    const iframe = document.createElement("iframe");
    iframe.className = "dap-pdf-iframe";
    iframe.src = url.replace(/ /g, "%20");
    iframe.setAttribute("frameborder", "0");
    iframe.onerror = () => {
      container.innerHTML = "";
      container.appendChild(createFallbackViewer({ url, fileName, title: fileName }, "PDF preview failed."));
    };
    container.appendChild(iframe);
    container.appendChild(createDocumentActions(url, fileName));
    return container;
  }
  function createInlineDocumentViewer(url, fileName, mimeType) {
    const container = document.createElement("div");
    container.className = "dap-document-viewer-container";
    if (mimeType && (mimeType.includes("word") || mimeType.includes("msword"))) {
      const iframe = document.createElement("iframe");
      iframe.className = "dap-document-iframe";
      iframe.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
      iframe.setAttribute("frameborder", "0");
      iframe.onerror = () => {
        container.innerHTML = "";
        container.appendChild(createFallbackViewer({ url, fileName, title: fileName }, "Document preview not available."));
      };
      container.appendChild(iframe);
    } else {
      container.appendChild(createFallbackViewer({ url, fileName, title: fileName }, "Preview not supported for this file type."));
    }
    container.appendChild(createDocumentActions(url, fileName));
    return container;
  }
  function createInlinePresentationViewer(url, fileName, mimeType) {
    const container = document.createElement("div");
    container.className = "dap-presentation-viewer-container";
    if (mimeType && mimeType.includes("presentation")) {
      const iframe = document.createElement("iframe");
      iframe.className = "dap-presentation-iframe";
      iframe.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
      iframe.setAttribute("frameborder", "0");
      iframe.onerror = () => {
        container.innerHTML = "";
        container.appendChild(createFallbackViewer({ url, fileName, title: fileName }, "Presentation preview not available."));
      };
      container.appendChild(iframe);
    } else {
      container.appendChild(createFallbackViewer({ url, fileName, title: fileName }, "Preview not supported for this file type."));
    }
    container.appendChild(createDocumentActions(url, fileName));
    return container;
  }
  function createWebContentViewer(url, title) {
    const container = document.createElement("div");
    container.className = "dap-web-viewer-container";
    const iframe = document.createElement("iframe");
    iframe.className = "dap-web-iframe";
    iframe.src = url;
    iframe.style.width = "100%";
    iframe.style.height = "600px";
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("loading", "lazy");
    iframe.onerror = () => {
      container.innerHTML = "";
      container.appendChild(createEnhancedFallbackViewer({ url, title, fileName: title }, "Web content could not be loaded."));
    };
    container.appendChild(iframe);
    const actions = document.createElement("div");
    actions.className = "dap-web-actions";
    const btn = document.createElement("button");
    btn.className = "dap-action-btn dap-secondary-btn";
    btn.textContent = "Open in New Tab \u2197";
    btn.addEventListener("click", () => window.open(url, "_blank", "noopener,noreferrer"));
    actions.appendChild(btn);
    container.appendChild(actions);
    return container;
  }
  function createFallbackViewer(articleContent, message) {
    return createEnhancedFallbackViewer(articleContent, message);
  }
  function createEnhancedFallbackViewer(articleContent, message) {
    const container = document.createElement("div");
    container.className = "dap-enhanced-fallback-viewer";
    const url = articleContent.url || articleContent.presignedUrl || "";
    const fileName = articleContent.fileName || "Document";
    const title = articleContent.title || fileName;
    const ext = fileName.split(".").pop()?.toUpperCase() || "";
    const iconMap = {
      PDF: "\u{1F4C4}",
      DOC: "\u{1F4DD}",
      DOCX: "\u{1F4DD}",
      PPT: "\u{1F4CA}",
      PPTX: "\u{1F4CA}",
      XLS: "\u{1F4C8}",
      XLSX: "\u{1F4C8}"
    };
    const icon = document.createElement("div");
    icon.className = "dap-fallback-icon";
    icon.textContent = iconMap[ext] || "\u{1F4F0}";
    container.appendChild(icon);
    const msg = document.createElement("div");
    msg.className = "dap-enhanced-fallback-message";
    msg.innerHTML = sanitizeHtml(`<h4>${title}</h4><p class="dap-fallback-primary">${message}</p>${fileName !== title ? `<p class="dap-fallback-filename">\u{1F4C1} ${fileName}</p>` : ""}${ext ? `<p class="dap-fallback-type">${ext} Document</p>` : ""}`);
    container.appendChild(msg);
    if (url) container.appendChild(createEnhancedDocumentActions(url, fileName));
    return container;
  }
  function createDocumentActions(url, fileName) {
    const actions = document.createElement("div");
    actions.className = "dap-document-actions";
    const dlBtn = document.createElement("button");
    dlBtn.className = "dap-action-btn dap-primary-btn";
    dlBtn.innerHTML = `<span class="dap-btn-icon">\u2B07</span> Download`;
    dlBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.downloadFile(url, fileName);
    });
    const openBtn = document.createElement("button");
    openBtn.className = "dap-action-btn dap-secondary-btn";
    openBtn.innerHTML = `<span class="dap-btn-icon">\u2197</span> Open in New Tab`;
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(url, "_blank", "noopener,noreferrer");
    });
    actions.appendChild(dlBtn);
    actions.appendChild(openBtn);
    return actions;
  }
  function createEnhancedDocumentActions(url, fileName) {
    const actions = document.createElement("div");
    actions.className = "dap-enhanced-document-actions";
    const dlBtn = document.createElement("button");
    dlBtn.className = "dap-action-btn dap-primary-btn";
    dlBtn.innerHTML = `<span class="dap-btn-icon">\u2B07\uFE0F</span><span class="dap-btn-text">Download</span>`;
    dlBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const orig = dlBtn.innerHTML;
      dlBtn.innerHTML = `<span class="dap-btn-icon">\u23F3</span><span class="dap-btn-text">Downloading\u2026</span>`;
      try {
        await window.downloadFile(url, fileName);
        dlBtn.innerHTML = `<span class="dap-btn-icon">\u2705</span><span class="dap-btn-text">Downloaded!</span>`;
      } catch {
        dlBtn.innerHTML = orig;
      }
      setTimeout(() => {
        dlBtn.innerHTML = orig;
      }, 2200);
    });
    const openBtn = document.createElement("button");
    openBtn.className = "dap-action-btn dap-secondary-btn";
    openBtn.innerHTML = `<span class="dap-btn-icon">\u{1F517}</span><span class="dap-btn-text">Open in New Tab</span>`;
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(url, "_blank", "noopener,noreferrer");
    });
    actions.appendChild(dlBtn);
    actions.appendChild(openBtn);
    return actions;
  }
  function createFileTypeBadge(itemType, fileName) {
    const badge = document.createElement("div");
    badge.className = `dap-file-type-badge ${itemType}`;
    badge.textContent = `${getTypeEmoji(itemType)} ${itemType.toUpperCase()}`;
    return badge;
  }
  function openKBItemInModal(item, kbTitle) {
    const modalBody = document.querySelector(".dap-modal-body");
    if (!modalBody) return;
    if (kbState) {
      kbState.view = "item";
      kbState.selectedItem = item;
      kbState.modalBodyRef = modalBody;
    } else {
      return;
    }
    modalBody.innerHTML = "";
    modalBody.appendChild(renderKBItemViewer({ item, kbTitle }));
  }
  function goBackToKBList() {
    if (!kbState || !kbState.modalBodyRef) return;
    kbState.view = "list";
    kbState.selectedItem = null;
    kbState.modalBodyRef.innerHTML = "";
    kbState.modalBodyRef.appendChild(renderKnowledgeBase({ title: kbState.title, items: kbState.items }));
  }
  function detectContentType(url, fileName) {
    const path = fileName || url;
    const ext = path.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "pdf";
    if (["doc", "docx"].includes(ext || "")) return ext || "doc";
    if (["mp4", "webm", "ogg", "avi", "mov"].includes(ext || "")) return "video";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) return "image";
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
    return "link";
  }
  async function downloadFile(url, fileName) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || "download";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      return true;
    } catch {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "download";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 100);
      return false;
    }
  }
  if (typeof window !== "undefined") {
    window.downloadFile = downloadFile;
  }
  function ensureStyles2() {
    if (!document.getElementById("dap-modal-style")) {
      const style = document.createElement("style");
      style.id = "dap-modal-style";
      style.textContent = modalCssText2;
      document.head.appendChild(style);
    }
  }

  // src/experiences/tooltip.ts
  init_registry();

  // src/utils/selectorResolver.ts
  var STRATEGY_PRIORITY = {
    data: 0,
    // Highest priority — most specific, set intentionally by the product team
    id: 1,
    // Fast O(1) native lookup, typically unique per page
    css: 2,
    // Flexible but can be fragile with deep or generated selectors
    xpath: 3
    // Most powerful but slowest; used only as last resort
  };
  function parseSelectors(selectorString) {
    if (typeof selectorString !== "string" || selectorString.trim() === "") {
      return [];
    }
    return selectorString.split("|").map((token) => token.trim()).filter((token) => token.length > 0);
  }
  function classifySelectorToken(token) {
    const lower = token.toLowerCase();
    if (lower.startsWith("data-")) {
      const equalsIndex = token.indexOf("=");
      if (equalsIndex !== -1) {
        const attrName = token.slice(0, equalsIndex);
        const attrValue = token.slice(equalsIndex + 1);
        return {
          raw: token,
          strategy: "data",
          // Build a CSS attribute-equals selector so querySelector can handle it.
          expression: `[${attrName}="${attrValue}"]`
        };
      }
      return {
        raw: token,
        strategy: "data",
        expression: `[${token}]`
      };
    }
    if (lower.startsWith("id=")) {
      return {
        raw: token,
        strategy: "id",
        expression: token.slice("id=".length)
      };
    }
    if (lower.startsWith("css=")) {
      return {
        raw: token,
        strategy: "css",
        expression: token.slice("css=".length)
      };
    }
    if (lower.startsWith("xpath=")) {
      return {
        raw: token,
        strategy: "xpath",
        expression: token.slice("xpath=".length)
      };
    }
    return { raw: token, strategy: "unknown", expression: token };
  }
  function resolveSingleSelector(selector) {
    if (typeof selector !== "string" || selector.trim() === "") return null;
    const parsed = classifySelectorToken(selector.trim());
    switch (parsed.strategy) {
      // ── data attribute ─────────────────────────────────────────────────────
      // Priority 1 — most specific; the attribute was intentionally placed on
      // the element by the product team, making it highly stable across releases.
      // Format:  "data-iap=search-directory"
      // Query:   querySelector('[data-iap="search-directory"]')
      case "data": {
        try {
          return document.querySelector(parsed.expression);
        } catch (e) {
          console.debug(`[DAP] Selector error (data): "${parsed.expression}" \u2014 invalid attribute expression`, e);
          return null;
        }
      }
      // ── id ─────────────────────────────────────────────────────────────────
      // Priority 2 — fast O(1) native lookup; getElementById is the most
      // efficient DOM query available and is always tried before CSS/XPath.
      // Format:  "id=searchInput"
      // Query:   document.getElementById("searchInput")
      case "id": {
        try {
          return document.getElementById(parsed.expression);
        } catch (e) {
          console.debug(`[DAP] Selector error (id): "${parsed.expression}" \u2014 invalid id value`, e);
          return null;
        }
      }
      // ── css ────────────────────────────────────────────────────────────────
      // Priority 3 — flexible; accepts any valid CSS selector expression.
      // Format:  "css=#searchInput"  /  "css=.my-class > input[type='text']"
      // Query:   document.querySelector(<expression after "css=">)
      case "css": {
        try {
          return document.querySelector(parsed.expression);
        } catch (e) {
          console.debug(`[DAP] Selector error (css): "${parsed.expression}" \u2014 invalid CSS expression`, e);
          return null;
        }
      }
      // ── xpath ──────────────────────────────────────────────────────────────
      // Priority 4 (lowest prefixed) — most powerful but slowest; supports
      // structural queries and text-content matching that CSS cannot express.
      // Format:  "xpath=//input[@placeholder='Search']"
      // Query:   document.evaluate(<expression after "xpath=">, …, FIRST_ORDERED_NODE_TYPE)
      case "xpath": {
        try {
          const result = document.evaluate(
            parsed.expression,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          return result.singleNodeValue ?? null;
        } catch (e) {
          console.debug(`[DAP] Selector error (xpath): "${parsed.expression}" \u2014 invalid XPath expression`, e);
          return null;
        }
      }
      // ── unknown / legacy ──────────────────────────────────────────────────
      // Backward-compatibility path for bare selectors that carry no strategy
      // prefix.  These were authored before the prefixed format was introduced
      // and must continue to work without any server-side data changes.
      //
      // Examples:  "#searchInput"  →  CSS succeeds immediately
      //            ".my-class"     →  CSS succeeds immediately
      //            "//input[@id]"  →  CSS fails (invalid), XPath succeeds
      //
      // Resolution order for bare selectors:
      //   1. Try as CSS  — covers most common legacy cases (#id, .class, tag)
      //   2. Try as XPath — covers legacy XPath strings that begin with "//"
      default: {
        try {
          const cssEl = document.querySelector(parsed.expression);
          if (cssEl) return cssEl;
        } catch (e) {
          console.debug(`[DAP] Selector bare CSS attempt failed: "${parsed.expression}" \u2014 trying XPath fallback`, e);
        }
        try {
          const result = document.evaluate(
            parsed.expression,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          return result.singleNodeValue ?? null;
        } catch (e) {
          console.debug(`[DAP] Selector bare XPath attempt failed: "${parsed.expression}" \u2014 no match for bare selector`, e);
          return null;
        }
      }
    }
  }
  var selectorCache = {};
  function evictSelectorCacheEntry(stepId) {
    delete selectorCache[stepId];
  }
  var evictCacheEntry = evictSelectorCacheEntry;
  function clearSelectorCache() {
    const keys = Object.keys(selectorCache);
    for (const key of keys) {
      delete selectorCache[key];
    }
  }
  function resolveSelectorWithCache(stepId, selectorString) {
    if (typeof stepId !== "string" || stepId.trim() === "") return null;
    if (typeof selectorString !== "string" || selectorString.trim() === "") return null;
    const cachedToken = selectorCache[stepId];
    if (cachedToken !== void 0) {
      const el = resolveSingleSelector(cachedToken);
      if (el && el.isConnected) {
        console.debug(`[DAP] Selector resolved: "${cachedToken}" (cache hit, step "${stepId}")`, el);
        return el;
      }
      console.debug(`[DAP] Selector cache evicted: step "${stepId}", token "${cachedToken}" \u2014 element detached or removed from DOM`);
      evictCacheEntry(stepId);
    } else {
      console.debug(`[DAP] Selector cache miss: step "${stepId}" \u2014 running full priority resolution on "${selectorString}"`);
    }
    const tokens = parseSelectors(selectorString);
    if (tokens.length === 0) return null;
    const parsed = tokens.map((t) => {
      const lower = t.toLowerCase();
      if (lower.startsWith("data-")) {
        const eq = t.indexOf("=");
        const expression = eq !== -1 ? `[${t.slice(0, eq)}="${t.slice(eq + 1)}"]` : `[${t}]`;
        return { raw: t, strategy: "data", expression };
      }
      if (lower.startsWith("id=")) return { raw: t, strategy: "id", expression: t.slice(3) };
      if (lower.startsWith("css=")) return { raw: t, strategy: "css", expression: t.slice(4) };
      if (lower.startsWith("xpath=")) return { raw: t, strategy: "xpath", expression: t.slice(6) };
      return { raw: t, strategy: "unknown", expression: t };
    });
    const buckets = [[], [], [], [], []];
    for (const p of parsed) {
      const idx = p.strategy === "unknown" ? 4 : STRATEGY_PRIORITY[p.strategy];
      buckets[idx].push(p);
    }
    for (const bucket of buckets) {
      for (const p of bucket) {
        const el = resolveSingleSelector(p.raw);
        if (el && el.isConnected) {
          selectorCache[stepId] = p.raw;
          console.debug(`[DAP] Selector resolved: "${p.raw}" (strategy: ${p.strategy}, step "${stepId}") \u2014 cached for future lookups`, el);
          return el;
        }
      }
    }
    console.debug(`[DAP] Selector not found: step "${stepId}" \u2014 no element matched "${selectorString}"`);
    return null;
  }
  function resolveSelectorWithPriority(selectorString) {
    if (typeof selectorString !== "string" || selectorString.trim() === "") return null;
    const tokens = parseSelectors(selectorString);
    if (tokens.length === 0) return null;
    const parsed = tokens.map(classifySelectorToken);
    const buckets = [[], [], [], [], []];
    for (const p of parsed) {
      if (p.strategy === "unknown") {
        buckets[4].push(p);
      } else {
        buckets[STRATEGY_PRIORITY[p.strategy]].push(p);
      }
    }
    for (const bucket of buckets) {
      for (const p of bucket) {
        const el = resolveSingleSelector(p.raw);
        if (el) {
          console.debug(`[DAP] Selector resolved: "${p.raw}" (strategy: ${p.strategy})`, el);
          return el;
        }
      }
    }
    console.debug(`[DAP] Selector not found: no element matched "${selectorString}"`);
    return null;
  }

  // src/experiences/tooltip.ts
  function registerTooltip() {
    register("tooltip", renderTooltip);
  }
  async function renderTooltip(flow) {
    const { payload, id } = flow;
    console.debug("[DAP] Tooltip initialized", { id, selector: payload.targetSelector });
    if (!payload.targetSelector || !payload.text) {
      console.error("[DAP] Tooltip missing required fields", {
        targetSelector: payload.targetSelector,
        hasText: !!payload.text
      });
      payload._completionTracker?.onComplete?.();
      return;
    }
    const target = await waitForTarget(payload.targetSelector, 5e3);
    if (!target) {
      console.warn("[DAP] Tooltip target not found", { selector: payload.targetSelector });
      payload._completionTracker?.onComplete?.();
      return;
    }
    console.debug("[DAP] Tooltip target resolved", { selector: payload.targetSelector });
    const tooltip = new DAPTooltip(id, target, payload);
    tooltip.initialize();
  }
  var DAPTooltip = class {
    constructor(id, target, payload) {
      this.container = null;
      this.overlay = null;
      this.isVisible = false;
      this._completed = false;
      this.listeners = [];
      this.targetObserver = null;
      this.id = id;
      this.target = target;
      this.payload = payload;
      this.trigger = this.normalizeTrigger(payload.trigger);
    }
    initialize() {
      this.setupTrigger();
      this.setupGlobalListeners();
      this.setupTargetObserver();
    }
    normalizeTrigger(trigger) {
      if (typeof trigger === "string" && ["hover", "click", "focus", "pageload"].includes(trigger)) {
        return trigger;
      }
      return "hover";
    }
    setupTrigger() {
      switch (this.trigger) {
        case "hover":
          this.setupHoverTrigger();
          break;
        case "click":
          this.setupClickTrigger();
          break;
        case "focus":
          this.setupFocusTrigger();
          break;
        case "pageload":
          this.show();
          break;
      }
    }
    setupHoverTrigger() {
      this.show();
      const onMouseEnter = () => this.show();
      const onMouseLeave = (e) => {
        const related = e.relatedTarget;
        if (related && this.container?.contains(related)) return;
        this.hide();
      };
      this.target.addEventListener("mouseenter", onMouseEnter);
      this.target.addEventListener("mouseleave", onMouseLeave);
      this.listeners.push(
        () => this.target.removeEventListener("mouseenter", onMouseEnter),
        () => this.target.removeEventListener("mouseleave", onMouseLeave)
      );
    }
    setupClickTrigger() {
      this.show();
      const onDocumentClick = (e) => {
        const target = e.target;
        if (!this.container?.contains(target) && !this.target.contains(target)) {
          this.hide();
        }
      };
      document.addEventListener("click", onDocumentClick, true);
      this.listeners.push(
        () => document.removeEventListener("click", onDocumentClick, true)
      );
    }
    setupFocusTrigger() {
      this.show();
      const onFocus = () => this.show();
      const onBlur = () => this.hide();
      this.target.addEventListener("focus", onFocus);
      this.target.addEventListener("blur", onBlur);
      this.listeners.push(
        () => this.target.removeEventListener("focus", onFocus),
        () => this.target.removeEventListener("blur", onBlur)
      );
    }
    setupGlobalListeners() {
      const onKeyDown = (e) => {
        if (e.key === "Escape" && this.isVisible) {
          this.hide();
        }
      };
      const onScroll = () => {
        if (this.isVisible) {
          if (!this.isTargetInViewport()) {
            this.hide();
          } else {
            this.position();
          }
        }
      };
      const onResize = () => {
        if (this.isVisible) {
          this.position();
        }
      };
      const onVisibilityChange = () => {
        if (document.hidden && this.isVisible) {
          this.hide();
        }
      };
      document.addEventListener("keydown", onKeyDown);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onResize);
      document.addEventListener("visibilitychange", onVisibilityChange);
      this.listeners.push(
        () => document.removeEventListener("keydown", onKeyDown),
        () => window.removeEventListener("scroll", onScroll, true),
        () => window.removeEventListener("resize", onResize),
        () => document.removeEventListener("visibilitychange", onVisibilityChange)
      );
    }
    setupTargetObserver() {
      this.targetObserver = new MutationObserver(() => {
        if (!document.contains(this.target)) {
          this.destroy();
        }
      });
      this.targetObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }
    show() {
      if (this._completed || this.isVisible) return;
      console.debug("[DAP] Tooltip shown", { id: this.id });
      this.createTooltip();
      this.position();
      this.isVisible = true;
      requestAnimationFrame(() => {
        if (this.container) {
          this.container.classList.add("dap-tooltip-visible");
        }
      });
    }
    hide() {
      if (!this.isVisible) return;
      console.debug("[DAP] Tooltip dismissed", { id: this.id });
      if (this.payload._completionTracker?.onComplete) {
        console.debug("[DAP] Completing tooltip flow", { id: this.id });
        this.payload._completionTracker.onComplete();
      }
      this._completed = true;
      this.listeners.forEach((cleanup) => cleanup());
      this.listeners = [];
      if (this.targetObserver) {
        this.targetObserver.disconnect();
        this.targetObserver = null;
      }
      if (this.container) {
        this.container.style.animation = "dap-tooltip-exit 0.2s cubic-bezier(0.4, 0.0, 0.2, 1) forwards";
        setTimeout(() => {
          this.removeTooltip();
        }, 200);
      } else {
        this.removeTooltip();
      }
      this.isVisible = false;
    }
    createTooltip() {
      this.overlay = this.getOrCreateOverlay();
      this.container = document.createElement("div");
      this.container.className = "dap-tooltip";
      this.container.id = `dap-tooltip-${this.id}`;
      this.container.setAttribute("role", "tooltip");
      this.container.setAttribute("aria-live", "polite");
      const content = document.createElement("div");
      content.className = "dap-tooltip-content";
      content.textContent = this.payload.text || "";
      const arrow = document.createElement("div");
      arrow.className = "dap-tooltip-arrow";
      this.container.appendChild(content);
      this.container.appendChild(arrow);
      if (this.trigger === "hover") {
        const onTooltipMouseLeave = () => this.hide();
        this.container.addEventListener("mouseleave", onTooltipMouseLeave);
        this.listeners.push(
          () => this.container?.removeEventListener("mouseleave", onTooltipMouseLeave)
        );
      }
      this.overlay.appendChild(this.container);
      const tooltipId = this.container.id;
      const prevDesc = this.target.getAttribute("aria-describedby") || "";
      this.target.setAttribute("aria-describedby", [prevDesc, tooltipId].filter(Boolean).join(" ").trim());
    }
    removeTooltip() {
      if (this.container) {
        const tooltipId = this.container.id;
        const currentDesc = this.target.getAttribute("aria-describedby") || "";
        const newDesc = currentDesc.split(/\s+/).filter(Boolean).filter((id) => id !== tooltipId).join(" ");
        if (newDesc) {
          this.target.setAttribute("aria-describedby", newDesc);
        } else {
          this.target.removeAttribute("aria-describedby");
        }
        this.container.remove();
        this.container = null;
      }
    }
    position() {
      if (!this.container) return;
      const targetRect = this.target.getBoundingClientRect();
      const placement = this.normalizePlacement(this.payload.placement);
      this.container.style.position = "fixed";
      this.container.style.visibility = "hidden";
      this.container.style.top = "0px";
      this.container.style.left = "0px";
      this.container.style.display = "block";
      const tooltipRect = this.container.getBoundingClientRect();
      const gap = 8;
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      const position = this.calculatePosition(targetRect, tooltipRect, placement, gap, viewport);
      this.container.style.top = `${position.top}px`;
      this.container.style.left = `${position.left}px`;
      this.container.setAttribute("data-placement", position.placement);
      this.container.style.visibility = "visible";
    }
    normalizePlacement(placement) {
      if (typeof placement === "string" && ["top", "right", "bottom", "left"].includes(placement)) {
        return placement;
      }
      return "top";
    }
    calculatePosition(targetRect, tooltipRect, preferredPlacement, gap, viewport) {
      const positions = {
        top: {
          top: targetRect.top - tooltipRect.height - gap,
          left: targetRect.left + (targetRect.width - tooltipRect.width) / 2
        },
        right: {
          top: targetRect.top + (targetRect.height - tooltipRect.height) / 2,
          left: targetRect.right + gap
        },
        bottom: {
          top: targetRect.bottom + gap,
          left: targetRect.left + (targetRect.width - tooltipRect.width) / 2
        },
        left: {
          top: targetRect.top + (targetRect.height - tooltipRect.height) / 2,
          left: targetRect.left - tooltipRect.width - gap
        }
      };
      const fits = (pos) => {
        return pos.top >= 0 && pos.left >= 0 && pos.top + tooltipRect.height <= viewport.height && pos.left + tooltipRect.width <= viewport.width;
      };
      let finalPosition = positions[preferredPlacement];
      let finalPlacement = preferredPlacement;
      if (!fits(finalPosition)) {
        const alternatives = ["top", "right", "bottom", "left"];
        for (const alt of alternatives) {
          if (alt !== preferredPlacement) {
            const altPos = positions[alt];
            if (fits(altPos)) {
              finalPosition = altPos;
              finalPlacement = alt;
              break;
            }
          }
        }
      }
      const margin = 4;
      finalPosition.top = Math.max(margin, Math.min(finalPosition.top, viewport.height - tooltipRect.height - margin));
      finalPosition.left = Math.max(margin, Math.min(finalPosition.left, viewport.width - tooltipRect.width - margin));
      return { ...finalPosition, placement: finalPlacement };
    }
    isTargetInViewport() {
      const rect = this.target.getBoundingClientRect();
      return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
    }
    getOrCreateOverlay() {
      let overlay = document.getElementById("dap-tooltip-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "dap-tooltip-overlay";
        overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 2147483640;
      `;
        this.injectCSS();
        document.body.appendChild(overlay);
      }
      return overlay;
    }
    injectCSS() {
      if (document.getElementById("dap-tooltip-styles")) return;
      const style = document.createElement("style");
      style.id = "dap-tooltip-styles";
      style.textContent = `
      /* Font stack: system fonts are used; no external font requests are made. */

      :root {
        --dap-tooltip-bg: rgba(18, 18, 30, 0.95);
        --dap-tooltip-border: rgba(255, 255, 255, 0.08);
        --dap-tooltip-accent: #7c6aff;
        --dap-tooltip-text: #f0eeff;
        --dap-tooltip-text-muted: rgba(200, 195, 230, 0.65);
        --dap-tooltip-radius: 14px;
        --dap-tooltip-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), 0 0 20px rgba(124, 106, 255, 0.15);
        --dap-tooltip-transition: cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .dap-tooltip {
        position: fixed;
        background: var(--dap-tooltip-bg);
        color: var(--dap-tooltip-text);
        padding: 14px 18px;
        border-radius: var(--dap-tooltip-radius);
        font-family: 'Sora', sans-serif;
        font-size: 14px;
        font-weight: 400;
        line-height: 1.6;
        max-width: 320px;
        min-width: 180px;
        word-wrap: break-word;
        z-index: 2147483641;
        pointer-events: auto;
        box-shadow: var(--dap-tooltip-shadow);
        border: 1px solid var(--dap-tooltip-border);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        opacity: 0;
        transform: scale(0.9) translateY(8px);
        transition: opacity 0.3s var(--dap-tooltip-transition), transform 0.4s var(--dap-tooltip-transition);
        animation: dap-tooltip-enter 0.4s var(--dap-tooltip-transition) forwards;
      }

      /* Accent glow line */
      .dap-tooltip::before {
        content: '';
        position: absolute;
        top: 0;
        left: 15%;
        right: 15%;
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--dap-tooltip-accent), transparent);
        opacity: 0.6;
      }

      .dap-tooltip.dap-tooltip-visible {
        opacity: 1;
        transform: scale(1) translateY(0);
      }

      .dap-tooltip-content {
        margin: 0;
        color: var(--dap-tooltip-text);
        letter-spacing: 0.01em;
      }

      .dap-tooltip-content strong {
        font-weight: 600;
        color: var(--dap-tooltip-accent);
      }

      .dap-tooltip-content p {
        margin: 0;
      }

      .dap-tooltip-arrow {
        position: absolute;
        width: 0;
        height: 0;
        z-index: -1;
      }

      /* Arrow positioning and styling using border-trick */
      .dap-tooltip[data-placement="top"] .dap-tooltip-arrow {
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid var(--dap-tooltip-bg);
      }

      .dap-tooltip[data-placement="right"] .dap-tooltip-arrow {
        left: -6px;
        top: 50%;
        transform: translateY(-50%);
        border-top: 8px solid transparent;
        border-bottom: 8px solid transparent;
        border-right: 8px solid var(--dap-tooltip-bg);
      }

      .dap-tooltip[data-placement="bottom"] .dap-tooltip-arrow {
        top: -6px;
        left: 50%;
        transform: translateX(-50%);
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-bottom: 8px solid var(--dap-tooltip-bg);
      }

      .dap-tooltip[data-placement="left"] .dap-tooltip-arrow {
        right: -6px;
        top: 50%;
        transform: translateY(-50%);
        border-top: 8px solid transparent;
        border-bottom: 8px solid transparent;
        border-left: 8px solid var(--dap-tooltip-bg);
      }

      @keyframes dap-tooltip-enter {
        from {
          opacity: 0;
          transform: scale(0.85) translateY(12px);
          filter: blur(4px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
          filter: blur(0);
        }
      }

      @keyframes dap-tooltip-exit {
        from {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
        to {
          opacity: 0;
          transform: scale(0.92) translateY(-8px);
          filter: blur(3px);
        }
      }

      /* Noise texture overlay */
      .dap-tooltip::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
        opacity: 0.4;
        border-radius: var(--dap-tooltip-radius);
      }

      /* Mobile adjustment */
      @media (max-width: 480px) {
        .dap-tooltip {
          max-width: 280px;
          padding: 12px 16px;
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .dap-tooltip {
          animation: none;
          transition: opacity 0.2s ease;
        }
      }
    `;
      document.head.appendChild(style);
    }
    destroy() {
      console.debug("[DAP] Tooltip destroyed", { id: this.id });
      this.hide();
      this.listeners.forEach((cleanup) => cleanup());
      this.listeners = [];
      if (this.targetObserver) {
        this.targetObserver.disconnect();
        this.targetObserver = null;
      }
    }
  };
  async function waitForTarget(selector, timeout) {
    const startTime = Date.now();
    let element = resolveSelectorWithPriority(selector);
    if (element) return element;
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        element = resolveSelectorWithPriority(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
          return;
        }
        if (Date.now() - startTime > timeout) {
          observer.disconnect();
          resolve(null);
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true
      });
      setTimeout(() => {
        observer.disconnect();
        resolve(resolveSelectorWithPriority(selector));
      }, timeout);
    });
  }

  // src/experiences/survey.ts
  init_registry();

  // src/styles/survey.css.ts
  var surveyCssText = `
/* Font stack: system fonts are used; no external font requests are made. */

/* --- Overlay --- */
.dap-modal-wrap {
  position: fixed;
  inset: 0;
  background: rgba(4, 4, 12, 0.65);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  animation: dapFadeIn 0.3s ease both;
}

@keyframes dapFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* --- Container --- */
.dap-survey-modal {
  background: rgba(18, 18, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 40px rgba(124, 106, 255, 0.12);
  width: 100%;
  max-width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Sora', sans-serif;
  color: #f0eeff;
  animation: dapModalIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes dapModalIn {
  from { opacity: 0; transform: scale(0.95) translateY(20px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* --- Body --- */
.dap-survey-body {
  padding: 32px;
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.dap-survey-body::-webkit-scrollbar {
  width: 5px;
}
.dap-survey-body::-webkit-scrollbar-thumb {
  background: rgba(124, 106, 255, 0.3);
  border-radius: 3px;
}

/* --- Questions --- */
.dap-survey-question {
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  margin-bottom: 24px;
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.3s ease;
}

.dap-survey-question:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(124, 106, 255, 0.2);
}

.dap-question-label {
  display: block;
  font-weight: 600;
  margin-bottom: 20px;
  color: #f0eeff;
  font-size: 16px;
}

/* --- Inputs --- */
.dap-radio-wrapper, .dap-checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dap-radio-wrapper:hover, .dap-checkbox-wrapper:hover {
  background: rgba(124, 106, 255, 0.1);
  border-color: rgba(124, 106, 255, 0.3);
}

.dap-radio-wrapper input, .dap-checkbox-wrapper input {
  accent-color: #7c6aff;
  width: 18px;
  height: 18px;
}

.dap-radio-wrapper label, .dap-checkbox-wrapper label {
  color: rgba(200, 195, 230, 0.82);
  cursor: pointer;
  flex: 1;
  font-size: 14px;
}

.dap-question-input input[type="text"],
.dap-question-input textarea,
.dap-question-input select {
  width: 100%;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #f0eeff;
  font-family: inherit;
  font-size: 14px;
  transition: all 0.2s ease;
}

.dap-question-input input:focus,
.dap-question-input textarea:focus,
.dap-question-input select:focus {
  outline: none;
  border-color: #7c6aff;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 0 0 4px rgba(124, 106, 255, 0.15);
}

/* --- Scale / NPS --- */
.dap-scale-options, .dap-nps-scale {
  display: flex;
  gap: 8px;
}

.dap-scale-option, .dap-nps-option {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.dap-scale-option label, .dap-nps-option label {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.dap-scale-option input:checked + label,
.dap-nps-option input:checked + label {
  background: #7c6aff;
  border-color: #8c7eff;
  color: #fff;
  box-shadow: 0 4px 15px rgba(124, 106, 255, 0.3);
}

.dap-scale-option input, .dap-nps-option input { display: none; }

.dap-scale-label, .dap-nps-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 12px;
  color: rgba(200, 195, 230, 0.5);
}

/* --- Star Rating --- */
.dap-star-rating {
  display: flex;
  flex-direction: row-reverse;
  gap: 6px;
  justify-content: flex-end;
}

.dap-star-label {
  font-size: 36px;
  color: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dap-star-label:hover,
.dap-star-label:hover ~ .dap-star-label {
  color: #ffb800;
  transform: scale(1.2);
}

.dap-star-input:checked ~ .dap-star-label {
  color: #ff9d00;
  text-shadow: 0 0 15px rgba(255, 157, 0, 0.4);
}

.dap-star-input { display: none; }

/* --- Star Choice --- */
.dap-star-choice-container {
  width: 100%;
}

.dap-star-choice-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dap-star-choice-option {
  position: relative;
}

.dap-star-choice-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.dap-star-choice-label {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dap-star-choice-option:hover .dap-star-choice-label {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(124, 106, 255, 0.3);
}

.dap-star-choice-input:checked + .dap-star-choice-label {
  background: rgba(124, 106, 255, 0.1);
  border-color: #7c6aff;
  box-shadow: 0 0 0 1px #7c6aff;
}

.dap-star-choice-stars {
  display: flex;
  gap: 4px;
}

.dap-star-choice-star {
  font-size: 20px;
  color: rgba(255, 255, 255, 0.1);
}

.dap-star-choice-star.filled {
  color: #ffb800;
}

.dap-star-choice-input:checked + .dap-star-choice-label .dap-star-choice-star.filled {
  color: #ff9d00;
  text-shadow: 0 0 8px rgba(255, 157, 0, 0.5);
}

.dap-star-choice-text {
  font-size: 14px;
  color: rgba(200, 195, 230, 0.85);
  font-weight: 500;
}

.dap-star-choice-input:checked + .dap-star-choice-label .dap-star-choice-text {
  color: #fff;
}

/* --- Footer --- */
.dap-footer {
  padding: 24px 32px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  background: rgba(14, 14, 24, 0.5);
}

.dap-footer button {
  padding: 12px 28px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dap-cta {
  background: linear-gradient(135deg, #7c6aff, #9f54f7);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 15px rgba(124, 106, 255, 0.3);
}

.dap-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(124, 106, 255, 0.45);
}

.dap-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: #f0eeff;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.dap-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* --- Opinion Choice (Good to Bad) --- */
.dap-opinion-choice-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 12px 0;
  width: 100%;
}

.dap-opinion-label {
  font-size: 14px;
  color: rgba(200, 195, 230, 0.85);
  font-weight: 500;
  white-space: nowrap;
}

.dap-opinion-options {
  display: flex;
  gap: 16px;
  align-items: center;
}

.dap-opinion-radio {
  appearance: none;
  -webkit-appearance: none;
  width: 22px;
  height: 22px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(255, 255, 255, 0.03);
  position: relative;
  margin: 0;
}

.dap-opinion-radio:hover {
  border-color: rgba(124, 106, 255, 0.5);
  background: rgba(124, 106, 255, 0.08);
  transform: scale(1.1);
}

.dap-opinion-radio:checked {
  border-color: #7c6aff;
  background: #7c6aff;
  box-shadow: 0 0 15px rgba(124, 106, 255, 0.4);
}

.dap-opinion-radio:checked::after {
  content: '';
  position: absolute;
  inset: 5px;
  background: white;
  border-radius: 50%;
  animation: dapRadioCheck 0.2s ease-out;
}

@keyframes dapRadioCheck {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* --- Micro Survey --- */
.dap-microsurvey {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 380px;
  background: rgba(18, 18, 30, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(124, 106, 255, 0.15);
  backdrop-filter: blur(20px);
  padding: 24px;
  animation: microsurveyIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes microsurveyIn {
  from { transform: translateY(100px) scale(0.9); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
}

@media (max-width: 480px) {
  .dap-survey-modal {
    width: 100%;
    height: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
  .dap-microsurvey {
    width: calc(100% - 48px);
    left: 24px;
    bottom: 24px;
  }
}
`;

  // src/experiences/survey.ts
  init_http();
  init_userContextService();
  var modalCssText3 = `
/* Font stack: system fonts are used; no external font requests are made. */

:root {
  --dap-z: 2147483640;
  --dap-bg-glass: rgba(10, 10, 18, 0.72);
  --dap-bg-surface: rgba(18, 18, 30, 0.95);
  --dap-bg-elevated: rgba(30, 30, 48, 0.9);
  --dap-border: rgba(255, 255, 255, 0.08);
  --dap-accent: #7c6aff;
  --dap-accent-soft: rgba(124, 106, 255, 0.15);
  --dap-text-primary: #f0eeff;
  --dap-text-secondary: rgba(200, 195, 230, 0.65);
  --dap-text-muted: rgba(160, 155, 200, 0.4);
  --dap-radius-xl: 20px;
  --dap-radius-lg: 14px;
  --dap-radius-sm: 8px;
  --dap-shadow-deep: 0 32px 80px rgba(0,0,0,0.7);
  --dap-transition: cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dap-modal-wrap {
  position: fixed;
  inset: 0;
  z-index: var(--dap-z);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(4, 4, 12, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  animation: dapOverlayIn 0.35s ease both;
}

@keyframes dapOverlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.dap-modal {
  background: var(--dap-bg-surface);
  border: 1px solid var(--dap-border);
  border-radius: var(--dap-radius-xl);
  box-shadow: var(--dap-shadow-deep), 0 0 40px rgba(124, 106, 255, 0.12);
  width: 100%;
  max-width: min(90vw, 540px);
  max-height: min(90vh, 700px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Sora', sans-serif;
  color: var(--dap-text-primary);
  animation: dapModalIn 0.45s var(--dap-transition) both;
}

@keyframes dapModalIn {
  from { opacity: 0; transform: scale(0.9) translateY(20px); filter: blur(6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
}

.dap-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px 16px;
  border-bottom: 1px solid var(--dap-border);
  background: linear-gradient(180deg, rgba(30,28,56,0.5) 0%, transparent 100%);
}

.dap-modal-header {
  font-size: 20px;
  font-weight: 600;
  color: var(--dap-text-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.dap-close {
  width: 32px;
  height: 32px;
  border: 1px solid var(--dap-border);
  border-radius: 50%;
  background: rgba(255,255,255,0.04);
  color: var(--dap-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-size: 18px;
}

.dap-close:hover {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.4);
  color: #f87171;
  transform: rotate(90deg) scale(1.1);
}

.dap-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 28px 28px 32px;
  scroll-behavior: smooth;
}

.dap-modal-body::-webkit-scrollbar {
  width: 4px;
}
.dap-modal-body::-webkit-scrollbar-thumb {
  background: rgba(124, 106, 255, 0.25);
  border-radius: 2px;
}

.dap-footer {
  padding: 20px 28px;
  border-top: 1px solid var(--dap-border);
  background: linear-gradient(0deg, rgba(10,10,18,0.4) 0%, transparent 100%);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.dap-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 28px;
  border-radius: var(--dap-radius-sm);
  background: linear-gradient(135deg, #7c6aff, #9f54f7);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.1);
  font-family: 'Sora', sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.22s var(--dap-transition);
  box-shadow: 0 4px 14px rgba(124,106,255,0.3);
}

.dap-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(124,106,255,0.45);
}

.dap-cta:active { transform: translateY(0); }

.dap-survey-intro {
  font-size: 15px;
  line-height: 1.65;
  color: var(--dap-text-secondary);
  margin-bottom: 24px;
}
`;
  function registerSurvey() {
    register("survey", renderSurvey);
    register("microsurvey", renderSurvey);
  }
  async function renderSurvey(flow) {
    const { payload } = flow;
    console.debug("[DAP] renderSurvey called with payload:", {
      hasHeader: !!payload.header,
      hasBody: !!payload.body,
      hasQuestion: !!payload.question,
      questionsCount: payload.questions?.length || 0,
      targetSelector: payload.targetSelector,
      mode: payload.mode,
      type: payload.type
    });
    const surveyMode = determineSurveyMode(payload);
    console.debug("[DAP] Survey mode determined:", surveyMode);
    if (surveyMode === "inline") {
      return renderMicroSurvey(flow);
    } else {
      return renderModalSurvey(flow);
    }
  }
  function determineSurveyMode(payload) {
    console.debug("[DAP] Survey mode detection:", {
      mode: payload.mode,
      question: payload.question,
      questionsArray: payload.questions?.length || 0,
      targetSelector: payload.targetSelector,
      type: payload.type
    });
    if (payload.mode) {
      console.debug("[DAP] Using explicit mode:", payload.mode);
      return payload.mode;
    }
    if (payload.questions && payload.questions.length > 1) {
      console.debug("[DAP] Multiple questions - using modal mode");
      return "modal";
    }
    if (payload.question && !payload.questions?.length) {
      console.debug("[DAP] Single question micro survey - using inline mode");
      return "inline";
    }
    if (payload.targetSelector) {
      console.debug("[DAP] Has targetSelector - using inline mode");
      return "inline";
    }
    if (payload.type && ["rating", "choice", "text"].includes(payload.type)) {
      console.debug("[DAP] Simple survey type - using inline mode");
      return "inline";
    }
    console.debug("[DAP] Defaulting to modal mode");
    return "modal";
  }
  async function renderModalSurvey(flow) {
    const { payload } = flow;
    if (!payload.questions || payload.questions.length === 0) {
      console.error("[DAP] Modal survey requires questions array");
      payload._completionTracker?.onComplete?.();
      return;
    }
    console.debug("[DAP] === SURVEY DEBUG: Rendering modal survey ===");
    console.debug("[DAP] Survey payload:", payload);
    console.debug("[DAP] Has completion tracker:", !!payload._completionTracker);
    console.debug("[DAP] Has onComplete callback:", !!payload._completionTracker?.onComplete);
    const prevActive = document.activeElement;
    const shell = createShell(payload.theme);
    const onKey = (e) => {
      if (e.key === "Escape") closeAll();
      else if (e.key === "Tab") trapTab(e, shell.dlg);
    };
    document.addEventListener("keydown", onKey, true);
    shell.titleEl.textContent = payload.header ?? "Survey";
    shell.body.replaceChildren();
    if (payload.body) {
      const bodyText = document.createElement("div");
      bodyText.className = "dap-survey-intro";
      bodyText.innerHTML = sanitizeHtml(payload.body);
      shell.body.appendChild(bodyText);
    }
    const form = document.createElement("form");
    form.className = "dap-survey-form";
    suppressValidationFor(form);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const responses = [];
        for (const q of payload.questions) {
          const questionData = {
            questionId: q.questionId,
            stepId: payload.stepId || "",
            question: q.question,
            type: q.type,
            answer: null
          };
          switch (q.type) {
            case "SingleChoice":
            case "Dropdown": {
              const radio = form.querySelector(`input[name="${q.questionId}"]:checked`);
              const select = form.querySelector(`select[name="${q.questionId}"]`);
              questionData.answer = radio?.value || select?.value || null;
              break;
            }
            case "MultipleChoice": {
              const checkboxes = Array.from(form.querySelectorAll(`input[name="${q.questionId}[]"]:checked`));
              questionData.answer = checkboxes.map((cb) => cb.value);
              break;
            }
            case "TextSingle": {
              const input = form.querySelector(`input[name="${q.questionId}"]`);
              questionData.answer = input?.value || "";
              break;
            }
            case "TextMulti": {
              const textarea = form.querySelector(`textarea[name="${q.questionId}"]`);
              questionData.answer = textarea?.value || "";
              break;
            }
            case "OpinionScale":
            case "OpinionScaleChoice":
            case "StarRating":
            case "NpsScale": {
              const radio = form.querySelector(`input[name="${q.questionId}"]:checked`);
              questionData.answer = radio?.value ? parseInt(radio.value) : null;
              break;
            }
            case "StarChoice": {
              const radio = form.querySelector(`input[name="${q.questionId}"]:checked`);
              const defaultLabels = ["Poor", "Fair", "Good", "Very Good", "Excellent"];
              const max = q.scaleMax || 5;
              const starLabels = q.options && q.options.length > 0 ? q.options : defaultLabels.slice(0, max);
              if (radio?.value) {
                const ratingValue = parseInt(radio.value);
                const labelIndex = Math.min(starLabels.length, ratingValue) - 1;
                const label = starLabels[labelIndex];
                questionData.answer = {
                  value: ratingValue,
                  label
                };
              } else {
                questionData.answer = null;
              }
              break;
            }
            case "NpsOptions": {
              const category = form.querySelector(`input[name="${q.questionId}"]:checked`);
              questionData.answer = category?.value || null;
              break;
            }
          }
          if (questionData.answer !== null) {
            responses.push(questionData);
          }
        }
        const submissionData = {
          stepId: payload.stepId,
          sessionId: `user-session-${Date.now()}`,
          submittedAt: (/* @__PURE__ */ new Date()).toISOString(),
          responses,
          client: await getClientInfo()
        };
        console.debug("[DAP] Survey submission payload:", submissionData);
        if (flow.config && payload.flowId && payload.organizationId && payload.siteId) {
          const baseUrl = flow.config.apiurl.replace(/\/$/, "");
          const url = `${baseUrl}/iap-experience/${payload.organizationId}/${payload.siteId}/survey-responses/${payload.flowId}`;
          const hostBase = location.origin;
          console.debug("[DAP] Submitting survey to API:", url);
          console.debug("[DAP] Request will include X-Host-Url header:", hostBase);
          try {
            await http(flow.config, url, {
              method: "POST",
              body: submissionData,
              hostBase,
              includeHostHeader: true
            });
            console.debug("[DAP] Survey successfully submitted to API");
            try {
              console.debug("[DAP Survey] Survey submission - tracking handled by step view system");
            } catch (trackingError) {
              console.error("[DAP] Survey submission tracking error:", trackingError);
            }
          } catch (error) {
            console.error("[DAP] Survey submission API error:", error);
            throw error;
          }
        } else {
          console.warn("[DAP] Survey API submission skipped - missing configuration");
        }
        closeAll();
      } catch (err) {
        console.error("[DAP] Survey submission error:", err);
        const errorMsg = document.createElement("div");
        errorMsg.className = "dap-survey-error";
        errorMsg.textContent = "An error occurred while submitting your responses. Please try again.";
        form.prepend(errorMsg);
        setTimeout(() => {
          errorMsg.remove();
        }, 5e3);
      }
    });
    payload.questions.forEach((q, index) => {
      const questionEl = renderQuestion(q, index);
      form.appendChild(questionEl);
    });
    shell.body.appendChild(form);
    setTimeout(() => {
      adjustSurveyModalSize(shell.dlg, shell.body);
    }, 0);
    shell.prevBtn.textContent = "Cancel";
    shell.nextBtn.textContent = "Submit";
    shell.prevBtn.style.display = "inline-block";
    let _surveyDone = false;
    const closeAll = () => {
      if (_surveyDone) return;
      _surveyDone = true;
      document.removeEventListener("keydown", onKey, true);
      restoreValidationFor(form);
      shell.wrap.remove();
      if (prevActive?.focus) prevActive.focus();
      payload._completionTracker?.onComplete?.();
    };
    shell.wrap.addEventListener("click", (e) => {
      if (e.target === shell.wrap) closeAll();
    });
    shell.closeBtn.addEventListener("click", closeAll);
    shell.prevBtn.addEventListener("click", closeAll);
    shell.nextBtn.addEventListener("click", () => {
      form.requestSubmit();
    });
    setTimeout(() => shell.dlg.focus(), 0);
  }
  var activeMicroSurveys = /* @__PURE__ */ new Map();
  async function renderMicroSurvey(flow) {
    const { payload, id } = flow;
    console.debug("[DAP] MicroSurvey initialized", { id, payload });
    if (!payload.question) {
      console.error("[DAP] MicroSurvey missing required question");
      payload._completionTracker?.onComplete?.();
      return;
    }
    if (activeMicroSurveys.has(id)) {
      cleanupMicroSurvey(id);
    }
    let targetElement;
    if (payload.targetSelector) {
      const element = resolveSelectorWithPriority(payload.targetSelector);
      if (element instanceof HTMLElement) {
        targetElement = element;
      } else {
        console.warn(`[DAP] MicroSurvey: Target element not found for selector: ${payload.targetSelector}`);
      }
    }
    const microSurveyElement = createMicroSurveyElement(payload, id, flow);
    const microSurveyState = {
      id,
      element: microSurveyElement,
      targetElement,
      cleanup: [],
      isActive: false
    };
    activeMicroSurveys.set(id, microSurveyState);
    showMicroSurvey(microSurveyState, payload);
    console.debug("[DAP] MicroSurvey setup complete", { id });
  }
  function createMicroSurveyElement(payload, id, flow) {
    const microSurvey = document.createElement("div");
    microSurvey.className = "dap-microsurvey";
    microSurvey.id = `dap-microsurvey-${id}`;
    microSurvey.setAttribute("role", "dialog");
    microSurvey.setAttribute("aria-label", "Quick Survey");
    Object.assign(microSurvey.style, {
      position: "fixed",
      zIndex: "10000",
      backgroundColor: "#ffffff",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.05)",
      padding: "20px",
      maxWidth: "320px",
      minWidth: "280px",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: "14px",
      lineHeight: "1.5",
      color: "#1e293b",
      opacity: "0",
      transform: "scale(0.95) translateY(10px)",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      backdropFilter: "blur(8px)"
    });
    const questionEl = document.createElement("div");
    questionEl.style.cssText = `
    font-weight: 600;
    margin-bottom: 16px;
    color: #1e293b;
    line-height: 1.4;
  `;
    questionEl.innerHTML = sanitizeHtml(payload.question || "");
    microSurvey.appendChild(questionEl);
    const contentEl = document.createElement("div");
    contentEl.style.marginBottom = "16px";
    const surveyType = payload.type || "choice";
    if (surveyType === "rating") {
      createRatingContent(contentEl, payload);
    } else if (surveyType === "choice") {
      createChoiceContent(contentEl, payload);
    } else if (surveyType === "text") {
      createTextContent(contentEl, payload);
    }
    microSurvey.appendChild(contentEl);
    const buttonsEl = document.createElement("div");
    buttonsEl.className = "dap-footer";
    buttonsEl.style.cssText = `
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    margin-top: 20px;
    padding: 0;
    border: none;
    background: transparent;
  `;
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "dap-secondary";
    cancelBtn.textContent = payload.cancelText || "Cancel";
    cancelBtn.addEventListener("click", () => {
      cleanupMicroSurvey(id);
      payload._completionTracker?.onComplete?.();
    });
    const submitBtn = document.createElement("button");
    submitBtn.className = "dap-cta submit-btn";
    submitBtn.textContent = payload.submitText || "Submit";
    submitBtn.addEventListener("click", async () => {
      const formData = extractMicroSurveyData(microSurvey, payload);
      if (formData) {
        try {
          await submitMicroSurveyData(formData, payload, flow);
          cleanupMicroSurvey(id);
          payload._completionTracker?.onComplete?.();
        } catch (error) {
          console.error("[DAP] Micro survey submission failed:", error);
        }
      }
    });
    buttonsEl.appendChild(cancelBtn);
    buttonsEl.appendChild(submitBtn);
    microSurvey.appendChild(buttonsEl);
    return microSurvey;
  }
  function showMicroSurvey(state, payload) {
    document.body.appendChild(state.element);
    positionMicroSurvey(state.element, state.targetElement, payload.position || "center");
    requestAnimationFrame(() => {
      state.element.style.opacity = "1";
      state.element.style.transform = "scale(1) translateY(0)";
    });
    state.isActive = true;
    const cleanup = () => cleanupMicroSurvey(state.id);
    state.cleanup.push(cleanup);
  }
  function positionMicroSurvey(element, targetElement, position = "center") {
    if (targetElement) {
      const targetRect = targetElement.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      switch (position) {
        case "top":
          element.style.left = `${targetRect.left + (targetRect.width - elementRect.width) / 2}px`;
          element.style.top = `${targetRect.top - elementRect.height - 10}px`;
          break;
        case "bottom":
          element.style.left = `${targetRect.left + (targetRect.width - elementRect.width) / 2}px`;
          element.style.top = `${targetRect.bottom + 10}px`;
          break;
        case "left":
          element.style.left = `${targetRect.left - elementRect.width - 10}px`;
          element.style.top = `${targetRect.top + (targetRect.height - elementRect.height) / 2}px`;
          break;
        case "right":
          element.style.left = `${targetRect.right + 10}px`;
          element.style.top = `${targetRect.top + (targetRect.height - elementRect.height) / 2}px`;
          break;
        default:
          element.style.left = `${(viewport.width - elementRect.width) / 2}px`;
          element.style.top = `${(viewport.height - elementRect.height) / 2}px`;
      }
      const rect = element.getBoundingClientRect();
      if (rect.right > viewport.width) {
        element.style.left = `${viewport.width - elementRect.width - 10}px`;
      }
      if (rect.bottom > viewport.height) {
        element.style.top = `${viewport.height - elementRect.height - 10}px`;
      }
      if (rect.left < 0) {
        element.style.left = "10px";
      }
      if (rect.top < 0) {
        element.style.top = "10px";
      }
    } else {
      element.style.left = "50%";
      element.style.top = "50%";
      element.style.transform = "translate(-50%, -50%) scale(0.95)";
    }
  }
  function createRatingContent(container, payload, id) {
    const min = payload.rating?.min || 1;
    const max = payload.rating?.max || 5;
    const ratingContainer = document.createElement("div");
    ratingContainer.style.cssText = `
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
  `;
    for (let i = min; i <= max; i++) {
      const star = document.createElement("button");
      star.type = "button";
      star.innerHTML = "\u2605";
      star.dataset.value = i.toString();
      star.style.cssText = `
      background: none;
      border: none;
      font-size: 28px;
      color: rgba(255, 255, 255, 0.1);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
      star.addEventListener("click", () => {
        ratingContainer.querySelectorAll("button").forEach((btn, idx) => {
          const isFilled = idx < i;
          btn.style.color = isFilled ? "#ff9d00" : "rgba(255, 255, 255, 0.1)";
          btn.style.textShadow = isFilled ? "0 0 10px rgba(255, 157, 0, 0.3)" : "none";
          btn.style.transform = isFilled ? "scale(1.1)" : "scale(1)";
        });
        ratingContainer.dataset.value = i.toString();
      });
      ratingContainer.appendChild(star);
    }
    container.appendChild(ratingContainer);
  }
  function createChoiceContent(container, payload, id) {
    if (!payload.options?.length) return;
    const choiceContainer = document.createElement("div");
    choiceContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;
    payload.options.forEach((option, index) => {
      const optionEl = document.createElement("button");
      optionEl.type = "button";
      optionEl.textContent = option.label;
      optionEl.dataset.value = option.value;
      optionEl.style.cssText = `
      padding: 12px 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      color: rgba(200, 195, 230, 0.85);
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
      font-family: inherit;
      font-size: 14px;
    `;
      optionEl.addEventListener("click", () => {
        choiceContainer.querySelectorAll("button").forEach((btn) => {
          btn.style.background = "rgba(255, 255, 255, 0.03)";
          btn.style.borderColor = "rgba(255, 255, 255, 0.08)";
          btn.style.color = "rgba(200, 195, 230, 0.85)";
        });
        optionEl.style.background = "rgba(124, 106, 255, 0.15)";
        optionEl.style.borderColor = "#7c6aff";
        optionEl.style.color = "#fff";
        choiceContainer.dataset.value = option.value;
      });
      choiceContainer.appendChild(optionEl);
    });
    container.appendChild(choiceContainer);
  }
  function createTextContent(container, payload, id) {
    const textarea = document.createElement("textarea");
    textarea.placeholder = payload.placeholder || "Your feedback...";
    textarea.style.cssText = `
    width: 100%;
    min-height: 100px;
    padding: 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    color: #f0eeff;
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
    transition: all 0.2s ease;
  `;
    container.appendChild(textarea);
  }
  function extractMicroSurveyData(element, payload) {
    const surveyType = payload.type || "choice";
    switch (surveyType) {
      case "rating": {
        const ratingContainer = element.querySelector("[data-value]");
        return ratingContainer?.dataset.value ? parseInt(ratingContainer.dataset.value) : null;
      }
      case "choice": {
        const choiceContainer = element.querySelector("[data-value]");
        return choiceContainer?.dataset.value || null;
      }
      case "text": {
        const textarea = element.querySelector("textarea");
        return textarea?.value || "";
      }
      default:
        return null;
    }
  }
  async function submitMicroSurveyData(data, payload, flow) {
    const responses = [{
      questionId: payload.questionId || "00000000-0000-0000-0000-000000000000",
      stepId: payload.stepId || "",
      question: payload.question || "Quick Survey",
      type: payload.type === "rating" ? "StarRating" : payload.type === "choice" ? "SingleChoice" : "TextMulti",
      answer: data
    }];
    const submissionData = {
      stepId: payload.stepId,
      sessionId: `user-session-${Date.now()}`,
      submittedAt: (/* @__PURE__ */ new Date()).toISOString(),
      responses,
      client: await getClientInfo()
    };
    console.debug("[DAP] MicroSurvey submission payload:", submissionData);
    if (flow.config && payload.flowId && payload.organizationId && payload.siteId) {
      const baseUrl = flow.config.apiurl.replace(/\/$/, "");
      const url = `${baseUrl}/iap-experience/${payload.organizationId}/${payload.siteId}/survey-responses/${payload.flowId}`;
      const hostBase = location.origin;
      console.debug("[DAP] Submitting micro survey to API:", url);
      await http(flow.config, url, {
        method: "POST",
        body: submissionData,
        hostBase,
        includeHostHeader: true
      });
      console.debug("[DAP] MicroSurvey successfully submitted to API");
    } else {
      console.warn("[DAP] MicroSurvey API submission skipped - missing configuration");
    }
  }
  function cleanupMicroSurvey(id) {
    const state = activeMicroSurveys.get(id);
    if (!state) return;
    activeMicroSurveys.delete(id);
    state.cleanup.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.error("[DAP] Cleanup error:", error);
      }
    });
    if (state.element.parentElement) {
      state.element.style.opacity = "0";
      state.element.style.transform = "scale(0.95) translateY(10px)";
      setTimeout(() => {
        if (state.element.parentElement) {
          state.element.parentElement.removeChild(state.element);
        }
      }, 300);
    }
  }
  function renderQuestion(question, index) {
    const wrapper = document.createElement("div");
    wrapper.className = "dap-survey-question";
    wrapper.dataset.type = question.type;
    if (["TextMulti", "NpsScale", "NpsOptions", "OpinionScaleChoice", "StarChoice"].includes(question.type)) {
      wrapper.classList.add("dap-full-width");
    }
    const label = document.createElement("label");
    label.className = "dap-question-label";
    label.textContent = `${index + 1}. ${question.question}`;
    wrapper.appendChild(label);
    const inputContainer = document.createElement("div");
    inputContainer.className = "dap-question-input";
    switch (question.type) {
      case "SingleChoice":
        renderSingleChoice(inputContainer, question);
        break;
      case "MultipleChoice":
        renderMultipleChoice(inputContainer, question);
        break;
      case "Dropdown":
        renderDropdown(inputContainer, question);
        break;
      case "TextSingle":
        renderTextSingle(inputContainer, question);
        break;
      case "TextMulti":
        renderTextMulti(inputContainer, question);
        break;
      case "OpinionScale":
        renderOpinionScale(inputContainer, question);
        break;
      case "OpinionScaleChoice":
        renderOpinionScaleChoice(inputContainer, question);
        break;
      case "NpsScale":
        renderNpsScale(inputContainer, question);
        break;
      case "NpsOptions":
        renderNpsOptions(inputContainer, question);
        break;
      case "StarRating":
        renderStarRating(inputContainer, question);
        break;
      case "StarChoice":
        renderStarChoice(inputContainer, question);
        break;
    }
    wrapper.appendChild(inputContainer);
    return wrapper;
  }
  function renderSingleChoice(container, question) {
    if (!question.options?.length) return;
    question.options.forEach((option, i) => {
      const wrapper = document.createElement("div");
      wrapper.className = "dap-radio-wrapper";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = question.questionId;
      input.id = `${question.questionId}_${i}`;
      input.value = option;
      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = option;
      wrapper.appendChild(input);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    });
  }
  function renderMultipleChoice(container, question) {
    if (!question.options?.length) return;
    question.options.forEach((option, i) => {
      const wrapper = document.createElement("div");
      wrapper.className = "dap-checkbox-wrapper";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = `${question.questionId}[]`;
      input.id = `${question.questionId}_${i}`;
      input.value = option;
      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = option;
      wrapper.appendChild(input);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    });
  }
  function renderDropdown(container, question) {
    if (!question.options?.length) return;
    const select = document.createElement("select");
    select.name = question.questionId;
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "-- Select an option --";
    defaultOption.selected = true;
    defaultOption.disabled = true;
    select.appendChild(defaultOption);
    question.options.forEach((option, i) => {
      const optionEl = document.createElement("option");
      optionEl.value = option;
      optionEl.textContent = option;
      select.appendChild(optionEl);
    });
    container.appendChild(select);
  }
  function renderTextSingle(container, question) {
    const input = document.createElement("input");
    input.type = "text";
    input.name = question.questionId;
    input.placeholder = "Your answer...";
    container.appendChild(input);
  }
  function renderTextMulti(container, question) {
    const textarea = document.createElement("textarea");
    textarea.name = question.questionId;
    textarea.placeholder = "Your answer...";
    textarea.rows = 4;
    container.appendChild(textarea);
  }
  function renderOpinionScale(container, question) {
    const min = question.scaleMin || 1;
    const max = question.scaleMax || 5;
    const scaleContainer = document.createElement("div");
    scaleContainer.className = "dap-scale-container";
    if (question.labelMin) {
      const minLabel = document.createElement("div");
      minLabel.className = "dap-scale-label";
      minLabel.textContent = question.labelMin;
      scaleContainer.appendChild(minLabel);
    }
    const scaleOptions = document.createElement("div");
    scaleOptions.className = "dap-scale-options";
    for (let i = min; i <= max; i++) {
      const option = document.createElement("div");
      option.className = "dap-scale-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = question.questionId;
      input.id = `${question.questionId}_${i}`;
      input.value = i.toString();
      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = i.toString();
      option.appendChild(input);
      option.appendChild(label);
      scaleOptions.appendChild(option);
    }
    scaleContainer.appendChild(scaleOptions);
    if (question.labelMax) {
      const maxLabel = document.createElement("div");
      maxLabel.className = "dap-scale-label";
      maxLabel.textContent = question.labelMax;
      scaleContainer.appendChild(maxLabel);
    }
    container.appendChild(scaleContainer);
  }
  function renderOpinionScaleChoice(container, question) {
    const min = question.scaleMin || 1;
    const max = question.scaleMax || 5;
    const choiceWrapper = document.createElement("div");
    choiceWrapper.className = "dap-opinion-choice-wrapper";
    const minLabel = document.createElement("div");
    minLabel.className = "dap-opinion-label";
    minLabel.textContent = question.labelMin || "Very Good";
    choiceWrapper.appendChild(minLabel);
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "dap-opinion-options";
    for (let i = min; i <= max; i++) {
      const input = document.createElement("input");
      input.type = "radio";
      input.className = "dap-opinion-radio";
      input.name = question.questionId;
      input.id = `${question.questionId}_${i}`;
      input.value = i.toString();
      input.setAttribute("aria-label", `Rating ${i}`);
      optionsContainer.appendChild(input);
    }
    choiceWrapper.appendChild(optionsContainer);
    const maxLabel = document.createElement("div");
    maxLabel.className = "dap-opinion-label";
    maxLabel.textContent = question.labelMax || "Bad";
    choiceWrapper.appendChild(maxLabel);
    container.appendChild(choiceWrapper);
  }
  function renderNpsScale(container, question) {
    const min = question.scaleMin || 0;
    const max = question.scaleMax || 10;
    const npsContainer = document.createElement("div");
    npsContainer.className = "dap-nps-container";
    const scaleOptions = document.createElement("div");
    scaleOptions.className = "dap-nps-scale";
    for (let i = min; i <= max; i++) {
      const option = document.createElement("div");
      option.className = "dap-nps-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = question.questionId;
      input.id = `${question.questionId}_${i}`;
      input.value = i.toString();
      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = i.toString();
      option.appendChild(input);
      option.appendChild(label);
      scaleOptions.appendChild(option);
    }
    npsContainer.appendChild(scaleOptions);
    const labelContainer = document.createElement("div");
    labelContainer.className = "dap-nps-labels";
    if (question.labelMin) {
      const minLabel = document.createElement("div");
      minLabel.className = "dap-nps-label-min";
      minLabel.textContent = question.labelMin;
      labelContainer.appendChild(minLabel);
    }
    if (question.labelMax) {
      const maxLabel = document.createElement("div");
      maxLabel.className = "dap-nps-label-max";
      maxLabel.textContent = question.labelMax;
      labelContainer.appendChild(maxLabel);
    }
    npsContainer.appendChild(labelContainer);
    container.appendChild(npsContainer);
  }
  function renderNpsOptions(container, question) {
    const npsCategories = [
      { key: "not_likely", label: "Not Likely (0-2)" },
      { key: "somewhat_likely", label: "Somewhat Likely (3-8)" },
      { key: "very_likely", label: "Very Likely (9-10)" }
    ];
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "dap-nps-options";
    npsCategories.forEach((category) => {
      const wrapper = document.createElement("div");
      wrapper.className = "dap-nps-category";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = question.questionId;
      input.id = `${question.questionId}_${category.key}`;
      input.value = category.key;
      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = category.label;
      wrapper.appendChild(input);
      wrapper.appendChild(label);
      optionsContainer.appendChild(wrapper);
    });
    container.appendChild(optionsContainer);
  }
  function renderStarRating(container, question) {
    const max = question.scaleMax || 5;
    const defaultStarLabels = {
      5: "Excellent",
      4: "Very Good",
      3: "Good",
      2: "Fair",
      1: "Poor"
    };
    const ratingWrapper = document.createElement("div");
    ratingWrapper.className = "dap-rating-wrapper";
    const starContainer = document.createElement("div");
    starContainer.className = "dap-star-rating";
    const hiddenStatusInput = document.createElement("input");
    hiddenStatusInput.type = "hidden";
    hiddenStatusInput.className = "dap-star-status";
    hiddenStatusInput.value = "0";
    starContainer.appendChild(hiddenStatusInput);
    for (let i = 1; i <= max; i++) {
      const input = document.createElement("input");
      input.type = "radio";
      input.name = question.questionId;
      input.id = `${question.questionId}_${i}`;
      const actualRating = max - i + 1;
      input.value = actualRating.toString();
      input.className = "dap-star-input";
      input.addEventListener("change", () => {
        if (input.checked) {
          hiddenStatusInput.value = "1";
          clearButton.style.display = "inline-flex";
        }
      });
      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.className = "dap-star-label";
      label.innerHTML = "\u2605";
      const starLabel = question.options && question.options.length === max ? question.options[actualRating - 1] : defaultStarLabels[actualRating];
      label.setAttribute("aria-label", `${actualRating} star${actualRating > 1 ? "s" : ""}`);
      label.setAttribute("title", `${actualRating} star${actualRating > 1 ? "s" : ""}: ${starLabel}`);
      starContainer.appendChild(input);
      starContainer.appendChild(label);
    }
    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "dap-clear-rating";
    clearButton.textContent = "Clear";
    clearButton.title = "Clear rating";
    clearButton.style.display = "none";
    clearButton.addEventListener("click", () => {
      starContainer.querySelectorAll("input[type='radio']").forEach((input) => {
        input.checked = false;
      });
      hiddenStatusInput.value = "0";
      clearButton.style.display = "none";
    });
    ratingWrapper.appendChild(starContainer);
    ratingWrapper.appendChild(clearButton);
    container.appendChild(ratingWrapper);
  }
  function renderStarChoice(container, question) {
    question.scaleMin || 1;
    const max = question.scaleMax || 5;
    const defaultLabels = ["Poor", "Fair", "Good", "Very Good", "Excellent"];
    const starLabels = question.options && question.options.length > 0 ? question.options : defaultLabels.slice(0, max);
    const choiceContainer = document.createElement("div");
    choiceContainer.className = "dap-star-choice-container";
    choiceContainer.setAttribute("role", "radiogroup");
    choiceContainer.setAttribute("aria-labelledby", `${question.questionId}-heading`);
    const optionsList = document.createElement("div");
    optionsList.className = "dap-star-choice-options";
    for (let i = 1; i <= max; i++) {
      const optionItem = document.createElement("div");
      optionItem.className = "dap-star-choice-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.className = "dap-star-choice-input";
      input.name = question.questionId;
      input.id = `${question.questionId}_${i}`;
      input.value = i.toString();
      const label = document.createElement("label");
      label.className = "dap-star-choice-label";
      label.htmlFor = input.id;
      const starsDisplay = document.createElement("div");
      starsDisplay.className = "dap-star-choice-stars";
      for (let j = 1; j <= max; j++) {
        const starSpan = document.createElement("span");
        starSpan.className = j <= i ? "dap-star-choice-star filled" : "dap-star-choice-star";
        starSpan.innerHTML = "\u2605";
        starsDisplay.appendChild(starSpan);
      }
      const textLabel = document.createElement("span");
      textLabel.className = "dap-star-choice-text";
      textLabel.textContent = starLabels[i - 1];
      label.appendChild(starsDisplay);
      label.appendChild(textLabel);
      optionItem.appendChild(input);
      optionItem.appendChild(label);
      optionsList.appendChild(optionItem);
    }
    choiceContainer.appendChild(optionsList);
    container.appendChild(choiceContainer);
  }
  function adjustSurveyModalSize(modal, body) {
    console.debug("[DAP] Adjusting survey modal size based on content");
    try {
      const bodyRect = body.getBoundingClientRect();
      const modalRect = modal.getBoundingClientRect();
      console.debug("[DAP] Content dimensions:", {
        bodyWidth: bodyRect.width,
        bodyHeight: bodyRect.height,
        modalWidth: modalRect.width,
        modalHeight: modalRect.height
      });
      modal.classList.remove("dap-size-small", "dap-size-medium", "dap-size-large", "dap-scrollable");
      let sizeClass = "dap-size-medium";
      if (bodyRect.width <= 480) {
        sizeClass = "dap-size-small";
      } else if (bodyRect.width <= 700) {
        sizeClass = "dap-size-medium";
      } else if (bodyRect.width <= 1e3) {
        sizeClass = "dap-size-large";
      } else {
        sizeClass = "dap-size-large";
      }
      modal.classList.add(sizeClass);
      requestAnimationFrame(() => {
        const updatedBodyRect = body.getBoundingClientRect();
        const updatedModalRect = modal.getBoundingClientRect();
        const needsHorizontalScroll = body.scrollWidth > updatedBodyRect.width;
        const needsVerticalScroll = body.scrollHeight > updatedBodyRect.height;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const wouldOverflowViewport = updatedModalRect.width > viewportWidth * 0.9 || updatedModalRect.height > viewportHeight * 0.9;
        if (needsHorizontalScroll || needsVerticalScroll || wouldOverflowViewport) {
          modal.classList.add("dap-scrollable");
          console.debug("[DAP] Added scrollable class due to overflow:", {
            needsHorizontalScroll,
            needsVerticalScroll,
            wouldOverflowViewport
          });
        }
        console.debug("[DAP] Final survey modal size class:", sizeClass, {
          hasScrollable: modal.classList.contains("dap-scrollable"),
          finalWidth: updatedModalRect.width,
          finalHeight: updatedModalRect.height
        });
      });
    } catch (error) {
      console.warn("[DAP] Error adjusting survey modal size:", error);
    }
  }
  function createShell(theme) {
    const root = ensureRoot();
    const wrap = document.createElement("div");
    wrap.className = "dap-modal-wrap";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.style.pointerEvents = "auto";
    wrap.style.zIndex = "2147483647";
    const dlg = document.createElement("div");
    dlg.className = "dap-modal dap-survey-modal";
    dlg.tabIndex = -1;
    if (theme) for (const [k, v] of Object.entries(theme)) dlg.style.setProperty(k, v);
    const headerBar = document.createElement("div");
    headerBar.className = "dap-header-bar";
    const titleEl = document.createElement("div");
    titleEl.className = "dap-modal-header";
    const closeBtn = document.createElement("button");
    closeBtn.className = "dap-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = "\xD7";
    headerBar.appendChild(titleEl);
    headerBar.appendChild(closeBtn);
    const body = document.createElement("div");
    body.className = "dap-modal-body dap-survey-body";
    const footer = document.createElement("div");
    footer.className = "dap-footer dap-nav";
    const prevBtn = document.createElement("button");
    prevBtn.className = "dap-secondary";
    prevBtn.type = "button";
    prevBtn.textContent = "Cancel";
    const nextBtn = document.createElement("button");
    nextBtn.className = "dap-cta";
    nextBtn.type = "button";
    nextBtn.textContent = "Submit";
    footer.appendChild(prevBtn);
    footer.appendChild(nextBtn);
    dlg.appendChild(headerBar);
    dlg.appendChild(body);
    dlg.appendChild(footer);
    root.appendChild(wrap);
    wrap.appendChild(dlg);
    return { wrap, dlg, headerBar, titleEl, body, footer, prevBtn, nextBtn, closeBtn };
  }
  function ensureRoot() {
    let host = document.querySelector("dap-root");
    if (!host) {
      host = document.createElement("dap-root");
      host.style.position = "fixed";
      host.style.zIndex = "2147483647";
      host.style.inset = "0";
      host.style.pointerEvents = "none";
      host.style.width = "100vw";
      host.style.height = "100vh";
      host.style.display = "flex";
      host.style.alignItems = "center";
      host.style.justifyContent = "center";
      document.documentElement.appendChild(host);
    }
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    if (!shadow.getElementById("dap-modal-style")) {
      const style = document.createElement("style");
      style.id = "dap-modal-style";
      style.textContent = modalCssText3;
      shadow.appendChild(style);
    }
    if (!shadow.getElementById("dap-survey-style")) {
      const style = document.createElement("style");
      style.id = "dap-survey-style";
      style.textContent = surveyCssText;
      shadow.appendChild(style);
    }
    return shadow;
  }
  function trapTab(e, root) {
    const focusables = Array.from(root.querySelectorAll('a,button,input,textarea,select,details,[tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled"));
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  }
  async function getClientInfo() {
    const userContext = userContextService.getAnalyticsContext();
    let clientIP = window.clientIP || window.clientIp || window.ipAddress || document.querySelector('meta[name="client-ip"]')?.getAttribute("content");
    if (!clientIP) {
      try {
        const cachedIP = sessionStorage.getItem("dap_client_ip");
        if (cachedIP) {
          clientIP = cachedIP;
        } else {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2e3);
          const response = await fetch("https://api.ipify.org?format=json", {
            signal: controller.signal,
            credentials: "omit"
          });
          const data = await response.json();
          clientIP = data.ip || "";
          if (clientIP) sessionStorage.setItem("dap_client_ip", clientIP);
          clearTimeout(timeout);
        }
      } catch (e) {
        console.debug("[DAP] Could not retrieve original IP:", e);
      }
    }
    return {
      userId: userContext.userId || "",
      clientIP: clientIP || "",
      userAgent: navigator.userAgent,
      locale: navigator.language
    };
  }

  // src/experiences/popover.ts
  init_registry();
  var activePopovers = /* @__PURE__ */ new Map();
  var POPOVER_CSS = `
/* Font stack: system fonts are used; no external font requests are made. */

:root {
  --pop-font:    system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --pop-bg:      rgba(255, 255, 255, 0.94);
  --pop-border:  rgba(99, 102, 241, 0.18);
  --pop-radius:  18px;
  --pop-shadow:
    0 0 0 1px rgba(99,102,241,0.10),
    0 8px 24px rgba(0, 0, 0, 0.08),
    0 20px 60px rgba(0, 0, 0, 0.10);
  --pop-text:    #0F172A;
  --pop-muted:   #64748B;
  --pop-accent:  #6366F1;
  --pop-accent2: #818CF8;
}

/* \u2500\u2500 Card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-popover-v2 {
  position: absolute;
  z-index: 9999;
  font-family: var(--pop-font);
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--pop-text);
  max-width: 320px;
  min-width: 220px;

  background: var(--pop-bg);
  border: 1.5px solid var(--pop-border);
  border-radius: var(--pop-radius);
  box-shadow: var(--pop-shadow);

  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);

  padding: 20px 22px 18px;
  opacity: 0;
  transform: scale(0.94) translateY(6px);
  transition:
    opacity   0.24s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

/* Top gradient sheen */
.dap-popover-v2::after {
  content: '';
  position: absolute; inset: 0;
  border-radius: var(--pop-radius);
  background: linear-gradient(148deg, rgba(255,255,255,0.62) 0%, transparent 52%);
  pointer-events: none;
}

.dap-popover-v2.visible {
  opacity: 1;
  transform: scale(1) translateY(0);
  pointer-events: auto;
}

/* Accent top bar */
.dap-popover-v2::before {
  content: '';
  position: absolute;
  top: 0; left: 20px; right: 20px;
  height: 2px;
  background: linear-gradient(90deg, var(--pop-accent), var(--pop-accent2), transparent);
  border-radius: 0 0 2px 2px;
}

/* \u2500\u2500 Title \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-popover-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--pop-text);
  margin: 0 0 8px;
  letter-spacing: -0.02em;
  line-height: 1.3;
  position: relative; z-index: 1;
}

/* \u2500\u2500 Body \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-popover-body {
  color: var(--pop-muted);
  line-height: 1.6;
  font-size: 13px;
  margin: 0;
  position: relative; z-index: 1;
}
.dap-popover-body a {
  color: var(--pop-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* \u2500\u2500 CTA row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-popover-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
  position: relative; z-index: 1;
}

.dap-popover-btn {
  padding: 7px 16px;
  border-radius: 11px;
  font-family: var(--pop-font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: -0.01em;
  transition: all 0.17s ease;
}

.dap-popover-btn.primary {
  background: linear-gradient(135deg, var(--pop-accent), var(--pop-accent2));
  color: #fff;
  border: none;
  box-shadow: 0 3px 12px rgba(99,102,241,0.32);
}
.dap-popover-btn.primary:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 5px 16px rgba(99,102,241,0.42);
}

.dap-popover-btn.secondary {
  background: rgba(0,0,0,0.04);
  color: var(--pop-text);
  border: 1.5px solid rgba(0,0,0,0.10);
}
.dap-popover-btn.secondary:hover {
  background: rgba(0,0,0,0.08);
  transform: translateY(-1px);
}

/* \u2500\u2500 Arrow \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-popover-arrow-v2 {
  position: absolute;
  width: 13px; height: 13px;
  background: var(--pop-bg);
  border: 1.5px solid var(--pop-border);
  transform: rotate(45deg);
  z-index: 0;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

/* \u2500\u2500 Dismiss animation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@keyframes popover-out {
  from { opacity:1; transform:scale(1) translateY(0); }
  to   { opacity:0; transform:scale(0.94) translateY(6px); }
}
.dap-popover-v2.dismissing {
  animation: popover-out 0.18s cubic-bezier(0.4,0,1,1) both;
}
`;
  function registerPopover() {
    register("popover", renderPopover);
  }
  async function renderPopover(flow) {
    const { payload, id } = flow;
    console.debug("[DAP] Popover initialized", { id, payload });
    if (!payload.targetSelector) {
      console.error("[DAP] Popover missing required targetSelector");
      payload._completionTracker?.onComplete?.();
      return;
    }
    if (!payload.body && !payload.bodyBlocks) {
      console.error("[DAP] Popover missing required content");
      payload._completionTracker?.onComplete?.();
      return;
    }
    if (activePopovers.has(id)) cleanupPopover(id);
    ensureStyles3();
    const targetElement = await waitForTargetElement(payload.targetSelector);
    if (!targetElement) {
      console.warn("[DAP] Popover target not found:", payload.targetSelector);
      payload._completionTracker?.onComplete?.();
      return;
    }
    const popoverElement = createPopoverElement(payload, id);
    const state = {
      id,
      element: popoverElement,
      targetElement,
      observer: null,
      cleanup: [],
      isActive: false,
      payload
    };
    activePopovers.set(id, state);
    setupTriggerHandling(state, payload.trigger || "click", payload);
    setupTargetObservation(state);
    console.debug("[DAP] Popover setup complete", { id });
  }
  function createPopoverElement(payload, id) {
    const popover = document.createElement("div");
    popover.className = "dap-popover-v2";
    popover.id = `dap-popover-${id}`;
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-live", "polite");
    if (payload.title) {
      const title = document.createElement("h4");
      title.className = "dap-popover-title";
      title.textContent = payload.title;
      popover.appendChild(title);
    }
    if (payload.body) {
      const body = document.createElement("div");
      body.className = "dap-popover-body";
      body.innerHTML = sanitizeHtml(payload.body);
      popover.appendChild(body);
    }
    const ctaEl = createCTAButtons(payload, id);
    if (ctaEl) popover.appendChild(ctaEl);
    if (payload.showArrow !== false) {
      const arrow = document.createElement("div");
      arrow.className = "dap-popover-arrow-v2";
      popover.appendChild(arrow);
    }
    return popover;
  }
  function createCTAButtons(payload, id) {
    const btnBlocks = payload.bodyBlocks?.filter((b) => b.kind === "button") ?? [];
    if (!btnBlocks.length) return null;
    const row = document.createElement("div");
    row.className = "dap-popover-actions";
    btnBlocks.forEach((block) => {
      const b = block;
      const btn = document.createElement("button");
      btn.className = `dap-popover-btn ${b.variant === "primary" ? "primary" : "secondary"}`;
      btn.textContent = b.label;
      btn.addEventListener("click", () => {
        if (b.action === "advance") {
          payload._completionTracker?.onStepAdvance?.(payload.stepId || id);
        } else if (b.action === "dismiss") {
          dismissPopover(id);
        }
        payload._completionTracker?.onComplete?.();
      });
      row.appendChild(btn);
    });
    return row.children.length ? row : null;
  }
  function setupTriggerHandling(state, trigger, payload) {
    const { targetElement, element } = state;
    const norm = trigger === "on click" ? "click" : trigger === "on hover" ? "hover" : trigger === "on focus" ? "focus" : trigger === "on page load" ? "pageload" : trigger;
    switch (norm) {
      case "click": {
        showPopover(state, payload);
        break;
      }
      case "hover": {
        showPopover(state, payload);
        let leaveTimer;
        const show = () => {
          clearTimeout(leaveTimer);
          showPopover(state, payload);
        };
        const hide = () => {
          leaveTimer = window.setTimeout(() => hidePopover(state, payload), 120);
        };
        targetElement.addEventListener("mouseenter", show);
        targetElement.addEventListener("mouseleave", hide);
        element.addEventListener("mouseenter", () => clearTimeout(leaveTimer));
        element.addEventListener("mouseleave", hide);
        state.cleanup.push(() => {
          targetElement.removeEventListener("mouseenter", show);
          targetElement.removeEventListener("mouseleave", hide);
        });
        break;
      }
      case "focus": {
        showPopover(state, payload);
        const show = () => showPopover(state, payload);
        const hide = () => hidePopover(state, payload);
        targetElement.addEventListener("focus", show);
        targetElement.addEventListener("blur", hide);
        state.cleanup.push(() => {
          targetElement.removeEventListener("focus", show);
          targetElement.removeEventListener("blur", hide);
        });
        break;
      }
      default:
        setTimeout(() => showPopover(state, payload), 120);
    }
  }
  function setupTargetObservation(state) {
    const obs = new MutationObserver(() => {
      if (!state.targetElement.isConnected) hidePopover(state, state.payload);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    state.observer = obs;
    state.cleanup.push(() => obs.disconnect());
  }
  function showPopover(state, payload) {
    if (state.isActive) return;
    state.isActive = true;
    document.body.appendChild(state.element);
    positionPopover(state, payload.placement || "bottom", payload.showArrow !== false);
    requestAnimationFrame(() => {
      state.element.classList.add("visible");
    });
    setupGlobalEventHandlers(state, payload);
    if (hasButtons(payload)) {
      state.element.setAttribute("tabindex", "-1");
      state.element.focus();
      trapFocus(state.element);
    }
  }
  function hidePopover(state, payload) {
    if (!state.isActive) return;
    state.isActive = false;
    state.element.classList.remove("visible");
    state.element.classList.add("dismissing");
    setTimeout(() => {
      state.element.classList.remove("dismissing");
      state.element.parentNode?.removeChild(state.element);
    }, 200);
    state.cleanup.forEach((fn) => {
      try {
        fn();
      } catch {
      }
    });
    state.cleanup = [];
    activePopovers.delete(state.id);
    payload._completionTracker?.onComplete?.();
  }
  function dismissPopover(id) {
    const state = activePopovers.get(id);
    if (state) hidePopover(state, {});
  }
  function positionPopover(state, placement, showArrow) {
    const { element, targetElement } = state;
    const tRect = targetElement.getBoundingClientRect();
    const pRect = element.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const sx = window.scrollX, sy = window.scrollY;
    const GAP = 10, PAD = 16;
    const positions = {
      top: { top: tRect.top + sy - pRect.height - GAP, left: tRect.left + sx + (tRect.width - pRect.width) / 2 },
      bottom: { top: tRect.bottom + sy + GAP, left: tRect.left + sx + (tRect.width - pRect.width) / 2 },
      left: { top: tRect.top + sy + (tRect.height - pRect.height) / 2, left: tRect.left + sx - pRect.width - GAP },
      right: { top: tRect.top + sy + (tRect.height - pRect.height) / 2, left: tRect.right + sx + GAP }
    };
    const fits = (p) => {
      if (!p) return false;
      return p.top >= PAD && p.left >= PAD && p.top + pRect.height <= vh - PAD && p.left + pRect.width <= vw - PAD;
    };
    const VALID_PLACEMENTS = /* @__PURE__ */ new Set(["top", "bottom", "left", "right"]);
    const normalisedPlacement = placement.toLowerCase();
    let best = VALID_PLACEMENTS.has(normalisedPlacement) ? normalisedPlacement : "bottom";
    if (!fits(positions[best])) {
      const order = ["bottom", "top", "right", "left"];
      for (const k of order) {
        if (fits(positions[k])) {
          best = k;
          break;
        }
      }
    }
    const pos = positions[best] ?? positions["bottom"];
    const top = Math.max(PAD, Math.min(pos.top, vh - pRect.height - PAD));
    const left = Math.max(PAD, Math.min(pos.left, vw - pRect.width - PAD));
    element.style.top = `${top}px`;
    element.style.left = `${left}px`;
    if (showArrow) positionArrow(element, tRect, best, { top, left }, sx, sy);
  }
  function positionArrow(popover, tRect, placement, popPos, sx, sy) {
    const arrow = popover.querySelector(".dap-popover-arrow-v2");
    if (!arrow) return;
    const cx = tRect.left + sx + tRect.width / 2;
    const cy = tRect.top + sy + tRect.height / 2;
    const S = 7;
    arrow.style.top = "";
    arrow.style.bottom = "";
    arrow.style.left = "";
    arrow.style.right = "";
    switch (placement) {
      case "top":
        arrow.style.bottom = `-${S}px`;
        arrow.style.left = `${Math.max(14, Math.min(cx - popPos.left - S, popover.offsetWidth - 28))}px`;
        arrow.style.borderTopColor = "transparent";
        arrow.style.borderLeftColor = "transparent";
        break;
      case "bottom":
        arrow.style.top = `-${S}px`;
        arrow.style.left = `${Math.max(14, Math.min(cx - popPos.left - S, popover.offsetWidth - 28))}px`;
        arrow.style.borderBottomColor = "transparent";
        arrow.style.borderRightColor = "transparent";
        break;
      case "left":
        arrow.style.right = `-${S}px`;
        arrow.style.top = `${Math.max(14, Math.min(cy - popPos.top - S, popover.offsetHeight - 28))}px`;
        arrow.style.borderLeftColor = "transparent";
        arrow.style.borderBottomColor = "transparent";
        break;
      case "right":
        arrow.style.left = `-${S}px`;
        arrow.style.top = `${Math.max(14, Math.min(cy - popPos.top - S, popover.offsetHeight - 28))}px`;
        arrow.style.borderRightColor = "transparent";
        arrow.style.borderTopColor = "transparent";
        break;
    }
  }
  function setupGlobalEventHandlers(state, payload) {
    const clickOutside = (e) => {
      const t = e.target;
      if (!state.element.contains(t) && !state.targetElement.contains(t)) {
        hidePopover(state, payload);
      }
    };
    const esc = (e) => {
      if (e.key === "Escape") hidePopover(state, payload);
    };
    const nav = () => hidePopover(state, payload);
    setTimeout(() => {
      document.addEventListener("click", clickOutside);
      document.addEventListener("keydown", esc);
      window.addEventListener("beforeunload", nav);
      window.addEventListener("popstate", nav);
    }, 100);
    state.cleanup.push(() => {
      document.removeEventListener("click", clickOutside);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("beforeunload", nav);
      window.removeEventListener("popstate", nav);
    });
  }
  function hasButtons(payload) {
    return payload.bodyBlocks?.some((b) => b.kind === "button") ?? false;
  }
  function trapFocus(el) {
    const focusable = el.querySelectorAll(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }
  async function waitForTargetElement(selector, timeout = 5e3) {
    const existing = resolveSelectorWithPriority(selector);
    if (existing) return existing;
    return new Promise((resolve) => {
      let tid;
      const obs = new MutationObserver(() => {
        const el = resolveSelectorWithPriority(selector);
        if (el) {
          clearTimeout(tid);
          obs.disconnect();
          resolve(el);
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      tid = window.setTimeout(() => {
        obs.disconnect();
        resolve(null);
      }, timeout);
    });
  }
  function ensureStyles3() {
    if (!document.getElementById("dap-popover-style-v2")) {
      const s = document.createElement("style");
      s.id = "dap-popover-style-v2";
      s.textContent = POPOVER_CSS;
      document.head.appendChild(s);
    }
  }
  function cleanupPopover(id) {
    const state = activePopovers.get(id);
    if (!state) return;
    state.cleanup.forEach((fn) => {
      try {
        fn();
      } catch {
      }
    });
    state.element.parentNode?.removeChild(state.element);
    activePopovers.delete(id);
  }

  // src/experiences/beacon.ts
  init_registry();
  var activeBeacons = /* @__PURE__ */ new Map();
  var BEACON_STYLES = `
/* Font stack: system fonts are used; no external font requests are made. */

/* \u2500\u2500 Keyframes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@keyframes dap-beacon-pulse {
  0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(124, 106, 255, 0.4); }
  70%  { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(124, 106, 255, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(124, 106, 255, 0); }
}

@keyframes dap-beacon-ring {
  0%   { transform: scale(0.6); opacity: 1; }
  100% { transform: scale(2.2); opacity: 0; }
}

@keyframes dap-beacon-in {
  from { opacity: 0; transform: scale(0.9) translateY(12px); filter: blur(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
}

@keyframes dap-beacon-out {
  from { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
  to   { opacity: 0; transform: scale(0.95) translateY(-8px); filter: blur(4px); }
}

/* \u2500\u2500 Container \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-beacon-v2 {
  --beacon-accent: #7c6aff;
  --beacon-bg: rgba(18, 18, 30, 0.95);
  --beacon-border: rgba(255, 255, 255, 0.08);
  --beacon-text: #f0eeff;
  --beacon-muted: rgba(200, 195, 230, 0.6);
  --beacon-radius: 20px;
  
  position: fixed;
  z-index: 2147483640;
  font-family: 'Sora', sans-serif;
  pointer-events: auto;
  user-select: none;
  
  background: var(--beacon-bg);
  border: 1px solid var(--beacon-border);
  border-radius: var(--beacon-radius);
  padding: 24px;
  width: 320px;
  
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  box-shadow: 
    0 32px 64px rgba(0, 0, 0, 0.6),
    0 0 40px rgba(124, 106, 255, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
    
  animation: dap-beacon-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  cursor: default;
  overflow: hidden;
}

.dap-beacon-v2.exiting {
  animation: dap-beacon-out 0.3s cubic-bezier(0.4, 0, 1, 1) both !important;
}

/* Noise texture */
.dap-beacon-v2::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
  opacity: 0.3;
  z-index: -1;
}

/* \u2500\u2500 Header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-beacon-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}

.dap-beacon-icon-badge {
  width: 44px; height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--beacon-accent), #9f54f7);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 8px 16px rgba(124, 106, 255, 0.3);
  position: relative;
}

.dap-beacon-icon-badge::after {
  content: '';
  position: absolute;
  inset: -6px;
  border: 2px solid var(--beacon-accent);
  border-radius: 18px;
  animation: dap-beacon-ring 2s infinite;
}

.dap-beacon-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--beacon-text);
  line-height: 1.3;
}

/* \u2500\u2500 Content \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-beacon-body {
  font-size: 14px;
  color: var(--beacon-muted);
  line-height: 1.6;
}

/* \u2500\u2500 Actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-beacon-actions {
  margin-top: 20px;
  display: flex;
}

.dap-beacon-btn {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  background: linear-gradient(135deg, var(--beacon-accent), #9f54f7);
  color: white;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 6px 16px rgba(124, 106, 255, 0.25);
}

.dap-beacon-btn:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 10px 24px rgba(124, 106, 255, 0.4);
}

/* \u2500\u2500 Close \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-beacon-close {
  position: absolute;
  top: 12px; right: 12px;
  width: 30px; height: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--beacon-border);
  color: var(--beacon-muted);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s ease;
}

.dap-beacon-close:hover {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.4);
  color: #f87171;
  transform: rotate(90deg);
}
`;
  function registerBeacon() {
    register("beacon", renderBeacon);
  }
  async function renderBeacon(flow) {
    const { payload, id } = flow;
    if (activeBeacons.has(id)) cleanupBeacon(id);
    ensureBeaconStyles();
    let targetElement;
    if (payload.targetSelector) {
      const el = resolveSelectorWithPriority(payload.targetSelector);
      if (el instanceof HTMLElement) targetElement = el;
    }
    const beaconElement = createBeaconElement(payload, id);
    const state = {
      id,
      element: beaconElement,
      targetElement,
      cleanup: [],
      isActive: false
    };
    activeBeacons.set(id, state);
    showBeacon(state, payload);
  }
  function createBeaconElement(payload, id) {
    const beacon = document.createElement("div");
    beacon.className = "dap-beacon-v2";
    beacon.id = `dap-beacon-${id}`;
    beacon.setAttribute("role", "alert");
    const header = document.createElement("div");
    header.className = "dap-beacon-header";
    if (payload.icon) {
      const badge = document.createElement("div");
      badge.className = "dap-beacon-icon-badge";
      badge.textContent = payload.icon;
      header.appendChild(badge);
    }
    if (payload.title) {
      const title = document.createElement("div");
      title.className = "dap-beacon-title";
      title.textContent = payload.title;
      header.appendChild(title);
    }
    if (header.childNodes.length > 0) beacon.appendChild(header);
    if (payload.body) {
      const body = document.createElement("div");
      body.className = "dap-beacon-body";
      body.innerHTML = sanitizeHtml(payload.body);
      beacon.appendChild(body);
    }
    if (payload.action) {
      const actions = document.createElement("div");
      actions.className = "dap-beacon-actions";
      const btn = document.createElement("button");
      btn.className = "dap-beacon-btn";
      btn.textContent = payload.action;
      btn.addEventListener("click", () => {
        dismissBeacon(id);
        window.dispatchEvent(new CustomEvent("dap-beacon-action", {
          detail: { action: payload.action, beaconId: id }
        }));
      });
      actions.appendChild(btn);
      beacon.appendChild(actions);
    }
    const close = document.createElement("button");
    close.className = "dap-beacon-close";
    close.innerHTML = "\xD7";
    close.title = "Dismiss";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissBeacon(id);
    });
    beacon.appendChild(close);
    beacon.__beaconPayload = payload;
    return beacon;
  }
  function showBeacon(state, payload) {
    if (state.isActive) return;
    state.isActive = true;
    document.body.appendChild(state.element);
    const reposition = () => {
      if (state.targetElement) positionNearElement(state.element, state.targetElement);
      else applyFixedPosition(state.element, payload.position || "bottom-right");
    };
    requestAnimationFrame(() => {
      reposition();
      if (state.targetElement) {
        window.addEventListener("scroll", reposition, { passive: true });
        window.addEventListener("resize", reposition, { passive: true });
        state.cleanup.push(() => {
          window.removeEventListener("scroll", reposition);
          window.removeEventListener("resize", reposition);
        });
      }
    });
    const onKey = (e) => {
      if (e.key === "Escape") dismissBeacon(state.id);
    };
    document.addEventListener("keydown", onKey);
    state.cleanup.push(() => document.removeEventListener("keydown", onKey));
    if (payload.autoDismiss) {
      const timer = setTimeout(() => dismissBeacon(state.id), payload.autoDismiss * 1e3);
      state.cleanup.push(() => clearTimeout(timer));
    }
  }
  function applyFixedPosition(el, pos) {
    const M = "24px";
    const styles = {
      "top-left": { top: M, left: M, bottom: "auto", right: "auto" },
      "top-right": { top: M, right: M, bottom: "auto", left: "auto" },
      "bottom-left": { bottom: M, left: M, top: "auto", right: "auto" },
      "bottom-right": { bottom: M, right: M, top: "auto", left: "auto" },
      "center": { top: "50%", left: "50%", transform: "translate(-50%,-50%)" }
    };
    Object.assign(el.style, styles[pos] || styles["bottom-right"]);
  }
  function positionNearElement(beacon, target) {
    const tRect = target.getBoundingClientRect();
    const bRect = beacon.getBoundingClientRect();
    const GAP = 12;
    const VW = window.innerWidth;
    const VH = window.innerHeight;
    let left = tRect.right + GAP;
    let top = tRect.top + (tRect.height - bRect.height) / 2;
    if (left + bRect.width > VW - 20) {
      left = tRect.left - bRect.width - GAP;
      if (left < 20) {
        left = tRect.left;
        top = tRect.bottom + GAP;
      }
    }
    beacon.style.left = `${Math.max(20, Math.min(left, VW - bRect.width - 20))}px`;
    beacon.style.top = `${Math.max(20, Math.min(top, VH - bRect.height - 20))}px`;
  }
  function dismissBeacon(id) {
    const state = activeBeacons.get(id);
    if (!state?.isActive) return;
    state.isActive = false;
    state.element.classList.add("exiting");
    const payload = state.element.__beaconPayload;
    payload?._completionTracker?.onComplete?.();
    setTimeout(() => cleanupBeacon(id), 250);
  }
  function cleanupBeacon(id) {
    const state = activeBeacons.get(id);
    if (!state) return;
    state.cleanup.forEach((fn) => fn());
    state.element.remove();
    activeBeacons.delete(id);
  }
  function ensureBeaconStyles() {
    if (!document.getElementById("dap-beacon-style-v2")) {
      const s = document.createElement("style");
      s.id = "dap-beacon-style-v2";
      s.textContent = BEACON_STYLES;
      document.head.appendChild(s);
    }
  }

  // src/experiences/banner.ts
  init_registry();
  var bannerCssText = `
/* Font stack: system fonts are used; no external font requests are made. */

:root {
  --dap-z-banner: 2147483620;

  /* Glassmorphism palette */
  --dap-glass-blur: blur(20px) saturate(180%);
  --dap-glass-bg: rgba(255, 255, 255, 0.72);
  --dap-glass-border: rgba(255, 255, 255, 0.55);
  --dap-glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);

  /* Semantic tokens */
  --dap-banner-info-accent:    #2563EB;
  --dap-banner-info-tint:      rgba(37, 99, 235, 0.08);
  --dap-banner-info-glow:      rgba(37, 99, 235, 0.18);

  --dap-banner-warning-accent: #D97706;
  --dap-banner-warning-tint:   rgba(217, 119, 6, 0.08);
  --dap-banner-warning-glow:   rgba(217, 119, 6, 0.18);

  --dap-banner-error-accent:   #DC2626;
  --dap-banner-error-tint:     rgba(220, 38, 38, 0.08);
  --dap-banner-error-glow:     rgba(220, 38, 38, 0.18);

  --dap-banner-success-accent: #059669;
  --dap-banner-success-tint:   rgba(5, 150, 105, 0.08);
  --dap-banner-success-glow:   rgba(5, 150, 105, 0.18);

  --dap-banner-text-primary:   #0F172A;
  --dap-banner-text-secondary: #475569;
  --dap-banner-radius: 16px;
  --dap-banner-font: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

/* \u2500\u2500 Wrapper \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner-wrap {
  position: fixed;
  left: 0; right: 0;
  z-index: var(--dap-z-banner);
  padding: 0 20px;
  pointer-events: none;
  display: flex;
  justify-content: center;
}
.dap-banner-wrap.top    { top: 20px; }
.dap-banner-wrap.bottom { bottom: 20px; }

/* \u2500\u2500 Banner card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner {
  position: relative;
  width: auto;
  min-width: 320px;
  max-width: 480px;
  padding: 10px 14px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: var(--dap-banner-font);
  pointer-events: auto;
  overflow: hidden;

  /* Premium Dark Theme / Glassmorphism */
  background: rgba(18, 18, 30, 0.9);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* Coloured left accent bar */
.dap-banner::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
  background: var(--_accent);
  opacity: 0.8;
  z-index: 2;
}

/* Per-variant accent colours */
.dap-banner.info    { --_accent: #3b82f6; --_tint: rgba(59, 130, 246, 0.1); }
.dap-banner.warning { --_accent: #f59e0b; --_tint: rgba(245, 158, 11, 0.1); }
.dap-banner.error   { --_accent: #ef4444; --_tint: rgba(239, 68, 68, 0.1); }
.dap-banner.success { --_accent: #10b981; --_tint: rgba(16, 185, 129, 0.1); }

/* \u2500\u2500 Content Row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  z-index: 1;
}

.dap-banner-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dap-banner-type {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--_accent);
  padding: 2px 6px;
  background: var(--_tint);
  border-radius: 4px;
}

/* \u2500\u2500 Icon pill \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner-icon {
  flex-shrink: 0;
  width: 30px; height: 30px;
  border-radius: 8px;
  background: var(--_accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
  color: #fff;
  position: relative; z-index: 1;
  box-shadow: 0 4px 12px var(--_glow, rgba(0,0,0,0.12));
}

/* \u2500\u2500 Message \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner-message {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: #f0eeff;
}

/* \u2500\u2500 Actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
  position: relative; z-index: 1;
}

.dap-banner-btn {
  padding: 4px 10px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  background: var(--_accent);
  color: #fff;
  border: none;
  transition: all 0.2s ease;
}

.dap-banner-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.dap-banner-btn.secondary {
  background: rgba(255,255,255,0.05);
  color: #ccc;
  border: 1px solid rgba(255,255,255,0.1);
}

/* \u2500\u2500 Close button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner-close {
  flex-shrink: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  color: rgba(255,255,255,0.4);
  transition: all 0.2s ease;
  z-index: 1;
}
.dap-banner-close:hover {
  color: #fff;
  transform: scale(1.1);
}

/* \u2500\u2500 Mobile \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@media (max-width: 480px) {
  .dap-banner {
    min-width: calc(100vw - 40px);
    margin: 0 10px;
  }
}

/* \u2500\u2500 Animations \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner-wrap.top .dap-banner {
  animation: bannerSlideDown 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.dap-banner-wrap.bottom .dap-banner {
  animation: bannerSlideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes bannerSlideDown {
  from { opacity: 0; transform: translateY(-20px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes bannerSlideUp {
  from { opacity: 0; transform: translateY(20px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes bannerSlideOutTop {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(-12px) scale(0.98); }
}
@keyframes bannerSlideOutBottom {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(12px) scale(0.98); }
}
`;
  var VARIANT_ICONS = {
    info: "\u2139\uFE0F",
    warning: "\u26A0\uFE0F",
    error: "\u2715",
    success: "\u2713"
  };
  function registerBanner() {
    register("banner", renderBanner);
    register("alert", renderBanner);
  }
  async function renderBanner(flow) {
    const { payload, id } = flow;
    ensureStyles4();
    const root = ensureRoot2();
    const completionTracker = payload._completionTracker;
    const wrap = document.createElement("div");
    wrap.className = `dap-banner-wrap ${payload.position || "top"}`;
    const banner = document.createElement("div");
    const variant = payload.variant || "info";
    banner.className = `dap-banner ${variant}`;
    banner.setAttribute("role", "alert");
    banner.setAttribute("aria-live", "polite");
    if (payload.theme) {
      for (const [k, v] of Object.entries(payload.theme)) {
        banner.style.setProperty(k, v);
      }
    }
    const iconEl = document.createElement("div");
    iconEl.className = "dap-banner-icon";
    iconEl.textContent = VARIANT_ICONS[variant] ?? "\u2139\uFE0F";
    const contentEl = document.createElement("div");
    contentEl.className = "dap-banner-content";
    const metaEl = document.createElement("div");
    metaEl.className = "dap-banner-meta";
    const typeEl = document.createElement("div");
    typeEl.className = "dap-banner-type";
    typeEl.textContent = variant.charAt(0).toUpperCase() + variant.slice(1);
    metaEl.appendChild(typeEl);
    contentEl.appendChild(metaEl);
    const messageEl = document.createElement("div");
    messageEl.className = "dap-banner-message";
    messageEl.innerHTML = sanitizeHtml(payload.message);
    contentEl.appendChild(messageEl);
    const actionsEl = document.createElement("div");
    actionsEl.className = "dap-banner-actions";
    if (payload.actions?.length) {
      payload.actions.forEach((action, idx) => {
        const tag = action.action === "navigate" ? "a" : "button";
        const btn = document.createElement(tag);
        btn.className = `dap-banner-btn${idx > 0 ? " secondary" : ""}`;
        btn.textContent = action.label;
        if (action.action === "navigate" && action.href) {
          btn.href = action.href;
          btn.target = "_blank";
          btn.rel = "noopener noreferrer";
        } else {
          btn.addEventListener("click", () => {
            if (action.action === "dismiss") {
              dismiss();
            } else if (action.action === "custom" && action.customAction) {
              window.dispatchEvent(new CustomEvent("dap-banner-action", {
                detail: { action: action.customAction, bannerId: id }
              }));
              dismiss();
            }
          });
        }
        actionsEl.appendChild(btn);
      });
    }
    const closeBtn = document.createElement("button");
    closeBtn.className = "dap-banner-close";
    closeBtn.innerHTML = "\xD7";
    closeBtn.setAttribute("aria-label", "Close banner");
    if (payload.dismissible === false) {
      closeBtn.style.display = "none";
    }
    banner.appendChild(iconEl);
    banner.appendChild(contentEl);
    banner.appendChild(actionsEl);
    banner.appendChild(closeBtn);
    wrap.appendChild(banner);
    let timer;
    if (payload.autoHide && payload.autoHide > 0) {
      timer = window.setTimeout(dismiss, payload.autoHide * 1e3);
    }
    let _bannerDone = false;
    function dismiss() {
      if (_bannerDone) return;
      _bannerDone = true;
      if (timer) clearTimeout(timer);
      const isBottom = payload.position === "bottom";
      wrap.style.animation = isBottom ? "bannerSlideOutBottom 0.22s cubic-bezier(0.4,0,1,1) both" : "bannerSlideOutTop 0.22s cubic-bezier(0.4,0,1,1) both";
      setTimeout(() => {
        wrap.remove();
        completionTracker?.onComplete?.();
      }, 240);
    }
    closeBtn.addEventListener("click", dismiss);
    root.appendChild(wrap);
  }
  function ensureStyles4() {
    if (!document.getElementById("dap-banner-style-v2")) {
      const s = document.createElement("style");
      s.id = "dap-banner-style-v2";
      s.textContent = bannerCssText;
      document.head.appendChild(s);
    }
  }
  function ensureRoot2() {
    let host = document.querySelector("dap-banner-root");
    if (!host) {
      host = document.createElement("dap-banner-root");
      Object.assign(host.style, {
        position: "fixed",
        zIndex: "2147483620",
        inset: "0",
        pointerEvents: "none"
      });
      document.documentElement.appendChild(host);
    }
    return host;
  }

  // src/experiences/hotspots.ts
  init_registry();
  var hotspotsCssText = `
/* Font stack: system fonts are used; no external font requests are made. */

:root {
  --dap-z-hotspots: 2147483630;
  --hs-primary:   #6366F1;
  --hs-success:   #10B981;
  --hs-required:  #F59E0B;
  --hs-bg:        rgba(255,255,255,0.95);
  --hs-border:    rgba(99,102,241,0.22);
  --hs-text:      #0F172A;
  --hs-muted:     #64748B;
  --hs-shadow:    0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06);
  --hs-font:      system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --hs-radius:    16px;
}

/* \u2500\u2500 Overlay \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-hotspots-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: var(--dap-z-hotspots);
  pointer-events: none;
  opacity: 0;
  animation: hs-fade-in 0.35s ease forwards;
}
@keyframes hs-fade-in  { to { opacity: 1; } }
@keyframes hs-fade-out { from { opacity: 1; } to { opacity: 0; } }

/* \u2500\u2500 Marker (pulsing dot) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-hotspot-marker {
  position: absolute;
  width: 28px; height: 28px;
  background: var(--hs-primary);
  border: 2.5px solid #fff;
  border-radius: 50%;
  cursor: pointer;
  z-index: calc(var(--dap-z-hotspots) + 1);
  box-shadow: 0 4px 14px rgba(99,102,241,0.40);
  transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1),
              background 0.2s ease,
              box-shadow 0.2s ease;
}
/* Animated ring */
.dap-hotspot-marker::before {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 2px solid var(--hs-primary);
  animation: hs-ring 2.4s cubic-bezier(0.4,0,0.6,1) infinite;
  opacity: 0;
}
@keyframes hs-ring {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(2.1); opacity: 0; }
}

.dap-hotspot-marker:hover {
  transform: scale(1.18);
  box-shadow: 0 6px 20px rgba(99,102,241,0.55);
}
.dap-hotspot-marker.completed {
  background: var(--hs-success);
  box-shadow: 0 4px 14px rgba(16,185,129,0.35);
  animation: none;
}
.dap-hotspot-marker.completed::before { display: none; }
.dap-hotspot-marker.required {
  background: var(--hs-required);
  box-shadow: 0 4px 14px rgba(245,158,11,0.35);
}
/* Checkmark inside completed marker */
.dap-hotspot-marker.completed::after {
  content: '\u2713';
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; color: #fff; font-weight: 700;
}

/* \u2500\u2500 Tooltip \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-hotspot-tooltip {
  position: absolute;
  background: var(--hs-bg);
  border: 1.5px solid var(--hs-border);
  border-radius: var(--hs-radius);
  box-shadow: var(--hs-shadow);
  padding: 20px 22px 16px;
  max-width: 320px;
  min-width: 240px;
  z-index: calc(var(--dap-z-hotspots) + 2);
  font-family: var(--hs-font);
  opacity: 0;
  transform: scale(0.92) translateY(6px);
  animation: hs-tooltip-in 0.25s cubic-bezier(0.22,1,0.36,1) forwards;
  pointer-events: auto;
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
}
@keyframes hs-tooltip-in {
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* Arrow */
.dap-hotspot-tooltip::before {
  content: '';
  position: absolute;
  width: 12px; height: 12px;
  background: var(--hs-bg);
  border: 1.5px solid var(--hs-border);
  transform: rotate(45deg);
}
.dap-hotspot-tooltip.top::before    { bottom:-7px; left:50%; margin-left:-6px; border-top:none; border-left:none; }
.dap-hotspot-tooltip.bottom::before { top:-7px;   left:50%; margin-left:-6px; border-bottom:none; border-right:none; }
.dap-hotspot-tooltip.left::before   { right:-7px; top:50%;  margin-top:-6px;  border-left:none; border-bottom:none; }
.dap-hotspot-tooltip.right::before  { left:-7px;  top:50%;  margin-top:-6px;  border-right:none; border-top:none; }

/* Tooltip title */
.dap-hotspot-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--hs-text);
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}

/* Tooltip description */
.dap-hotspot-description {
  font-size: 13px;
  color: var(--hs-muted);
  line-height: 1.55;
  margin: 0 0 16px;
}

/* Tooltip actions */
.dap-hotspot-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.dap-hotspot-btn {
  padding: 7px 16px;
  border-radius: 10px;
  font-family: var(--hs-font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.16s ease;
  letter-spacing: -0.01em;
  border: none;
  background: var(--hs-primary);
  color: #fff;
  box-shadow: 0 2px 8px rgba(99,102,241,0.30);
}
.dap-hotspot-btn:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(99,102,241,0.40);
}

/* \u2500\u2500 Progress pill \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-hotspots-progress {
  position: fixed;
  top: 20px; right: 20px;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border: 1.5px solid rgba(99,102,241,0.18);
  border-radius: 14px;
  padding: 12px 18px;
  z-index: calc(var(--dap-z-hotspots) + 1);
  font-family: var(--hs-font);
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  opacity: 0;
  animation: hs-fade-in 0.35s 0.1s ease forwards;
  min-width: 170px;
}
.dap-hotspots-progress-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--hs-primary);
  margin-bottom: 6px;
}
.dap-hotspots-progress-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--hs-text);
  margin-bottom: 8px;
}
.dap-hotspots-progress-bar {
  width: 100%;
  height: 5px;
  background: rgba(99,102,241,0.12);
  border-radius: 99px;
  overflow: hidden;
}
.dap-hotspots-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--hs-primary), #818CF8);
  border-radius: 99px;
  transition: width 0.4s cubic-bezier(0.22,1,0.36,1);
  width: 0%;
}

/* \u2500\u2500 Skip button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-hotspots-controls {
  position: fixed;
  bottom: 24px; right: 24px;
  z-index: calc(var(--dap-z-hotspots) + 1);
  opacity: 0;
  animation: hs-fade-in 0.35s 0.2s ease forwards;
}
.dap-hotspots-skip {
  padding: 10px 20px;
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1.5px solid rgba(0,0,0,0.10);
  border-radius: 12px;
  color: var(--hs-muted);
  font-family: var(--hs-font);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  transition: all 0.18s ease;
}
.dap-hotspots-skip:hover {
  background: #fff;
  color: var(--hs-text);
  box-shadow: 0 6px 24px rgba(0,0,0,0.12);
  transform: translateY(-1px);
}

/* \u2500\u2500 Mobile \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@media (max-width: 640px) {
  .dap-hotspots-progress { top: 12px; right: 12px; padding: 10px 14px; }
  .dap-hotspots-controls { bottom: 14px; right: 14px; }
  .dap-hotspot-tooltip   { max-width: 280px; padding: 16px 18px 14px; }
}
`;
  function registerHotspots() {
    register("hotspots", renderHotspots);
  }
  async function renderHotspots(flow) {
    const { payload, id } = flow;
    const completionTracker = payload._completionTracker;
    ensureStyles5();
    const completedHotspots = /* @__PURE__ */ new Set();
    let currentTooltip = null;
    const overlay = document.createElement("div");
    overlay.className = "dap-hotspots-overlay";
    document.documentElement.appendChild(overlay);
    let progressEl = null;
    if (payload.showProgress) {
      progressEl = buildProgressEl(payload);
      document.documentElement.appendChild(progressEl);
    }
    let skipEl = null;
    if (payload.allowSkip) {
      skipEl = buildSkipEl();
      document.documentElement.appendChild(skipEl);
      skipEl.querySelector("button").addEventListener("click", completeHotspots);
    }
    const markers = [];
    const tasks = payload.hotspots.map(async (hotspot) => {
      try {
        const el = await waitForElement(hotspot.selector, { timeout: 2500 });
        if (el instanceof HTMLElement) placeMarker(hotspot, el);
      } catch {
        console.warn(`[DAP] Hotspot target not found: ${hotspot.selector}`);
      }
    });
    await Promise.allSettled(tasks);
    if (progressEl) updateProgress();
    function placeMarker(hotspot, el) {
      const rect = el.getBoundingClientRect();
      const marker = document.createElement("div");
      marker.className = "dap-hotspot-marker";
      marker.dataset.hotspotId = hotspot.id;
      if (hotspot.required) marker.classList.add("required");
      if (hotspot.pulseColor) marker.style.background = hotspot.pulseColor;
      marker.style.left = `${rect.left + window.scrollX + rect.width / 2 - 14}px`;
      marker.style.top = `${rect.top + window.scrollY + rect.height / 2 - 14}px`;
      marker.addEventListener("click", () => showTooltip(hotspot, marker));
      document.documentElement.appendChild(marker);
      markers.push(marker);
    }
    function showTooltip(hotspot, marker, el) {
      currentTooltip?.remove();
      const tooltip = document.createElement("div");
      tooltip.className = "dap-hotspot-tooltip";
      const title = document.createElement("h3");
      title.className = "dap-hotspot-title";
      title.textContent = hotspot.title;
      const desc = document.createElement("div");
      desc.className = "dap-hotspot-description";
      desc.innerHTML = sanitizeHtml(hotspot.description);
      const actions = document.createElement("div");
      actions.className = "dap-hotspot-actions";
      const gotIt = document.createElement("button");
      gotIt.className = "dap-hotspot-btn";
      gotIt.textContent = "Got it \u2713";
      gotIt.addEventListener("click", () => {
        markDone(hotspot, marker);
        tooltip.remove();
        currentTooltip = null;
      });
      actions.append(gotIt);
      tooltip.append(title, desc, actions);
      positionTooltip(tooltip, marker, hotspot.placement || "top");
      document.documentElement.appendChild(tooltip);
      currentTooltip = tooltip;
      setTimeout(() => {
        const outside = (e) => {
          if (!tooltip.contains(e.target) && !marker.contains(e.target)) {
            tooltip.remove();
            currentTooltip = null;
            document.removeEventListener("click", outside);
          }
        };
        document.addEventListener("click", outside);
      }, 120);
    }
    function positionTooltip(tooltip, marker, placement) {
      const mRect = marker.getBoundingClientRect();
      tooltip.classList.add(placement);
      const W = 320;
      const H = 140;
      let left = 0, top = 0;
      const GAP = 18;
      switch (placement) {
        case "top":
          left = mRect.left - W / 2 + 14;
          top = mRect.top - GAP - H;
          break;
        case "bottom":
          left = mRect.left - W / 2 + 14;
          top = mRect.bottom + GAP;
          break;
        case "left":
          left = mRect.left - W - GAP;
          top = mRect.top - H / 2 + 14;
          break;
        case "right":
          left = mRect.right + GAP;
          top = mRect.top - H / 2 + 14;
          break;
        default:
          left = mRect.left - W / 2 + 14;
          top = mRect.top - GAP - H;
      }
      const VW = window.innerWidth, VH = window.innerHeight;
      left = Math.max(10, Math.min(left, VW - W - 10));
      top = Math.max(10, Math.min(top, VH - H - 10));
      tooltip.style.left = `${left + window.scrollX}px`;
      tooltip.style.top = `${top + window.scrollY}px`;
    }
    function markDone(hotspot, marker) {
      completedHotspots.add(hotspot.id);
      marker.classList.add("completed");
      if (progressEl) updateProgress();
      const required = payload.hotspots.filter((h) => h.required);
      const doneReq = required.filter((h) => completedHotspots.has(h.id));
      if (doneReq.length === required.length) {
        setTimeout(() => {
          if (canComplete()) completeHotspots();
        }, 800);
      }
    }
    function updateProgress() {
      if (!progressEl) return;
      const total = payload.hotspots.length;
      const done = completedHotspots.size;
      const pct = Math.round(done / total * 100);
      const text = progressEl.querySelector(".dap-hotspots-progress-text");
      const fill = progressEl.querySelector(".dap-hotspots-progress-fill");
      if (text) text.textContent = `${done} of ${total} explored`;
      if (fill) fill.style.width = `${pct}%`;
    }
    function canComplete() {
      return payload.hotspots.filter((h) => h.required).every((h) => completedHotspots.has(h.id));
    }
    let _hotspotsDone = false;
    function completeHotspots() {
      if (_hotspotsDone) return;
      _hotspotsDone = true;
      document.removeEventListener("keydown", onHotspotsKey);
      overlay.remove();
      markers.forEach((m) => m.remove());
      currentTooltip?.remove();
      progressEl?.remove();
      skipEl?.remove();
      completionTracker?.onComplete?.();
    }
    function onHotspotsKey(e) {
      if (e.key === "Escape") {
        if (currentTooltip) {
          currentTooltip.remove();
          currentTooltip = null;
        } else if (payload.allowSkip) completeHotspots();
      }
    }
    document.addEventListener("keydown", onHotspotsKey);
  }
  function buildProgressEl(payload) {
    const el = document.createElement("div");
    el.className = "dap-hotspots-progress";
    el.innerHTML = `
    <div class="dap-hotspots-progress-label">Progress</div>
    <div class="dap-hotspots-progress-text">0 of ${payload.hotspots.length} explored</div>
    <div class="dap-hotspots-progress-bar">
      <div class="dap-hotspots-progress-fill"></div>
    </div>`;
    return el;
  }
  function buildSkipEl() {
    const el = document.createElement("div");
    el.className = "dap-hotspots-controls";
    const btn = document.createElement("button");
    btn.className = "dap-hotspots-skip";
    btn.textContent = "Skip tour";
    el.appendChild(btn);
    return el;
  }
  function ensureStyles5() {
    if (!document.getElementById("dap-hotspots-style-v2")) {
      const s = document.createElement("style");
      s.id = "dap-hotspots-style-v2";
      s.textContent = hotspotsCssText;
      document.head.appendChild(s);
    }
  }

  // src/experiences/hotspotTour.ts
  init_registry();
  var hotspotTourCssText = `
/* Font stack: system fonts are used; no external font requests are made. */

:root {
  --dap-z-tour: 2147483635;
  --tour-primary:  #6366F1;
  --tour-primary2: #818CF8;
  --tour-bg:       rgba(255,255,255,0.96);
  --tour-overlay:  rgba(2, 6, 23, 0.62);
  --tour-border:   rgba(99,102,241,0.20);
  --tour-text:     #0F172A;
  --tour-muted:    #64748B;
  --tour-shadow:   0 20px 60px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.07);
  --tour-font:     system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --tour-radius:   18px;
}

/* \u2500\u2500 Overlay \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-tour-overlay {
  position: fixed; inset: 0;
  background: var(--tour-overlay);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: var(--dap-z-tour);
  pointer-events: none;
  opacity: 0;
  animation: tour-fade-in 0.3s ease forwards;
}
@keyframes tour-fade-in  { to { opacity: 1; } }

/* \u2500\u2500 Spotlight \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-tour-spotlight {
  position: absolute;
  border: 2.5px solid var(--tour-primary);
  border-radius: 12px;
  pointer-events: none;
  z-index: calc(var(--dap-z-tour) + 1);
  box-shadow:
    0 0 0 9999px rgba(2,6,23,0.62),
    0 0 0 6px rgba(99,102,241,0.15),
    0 0 30px rgba(99,102,241,0.35);
  transition: all 0.42s cubic-bezier(0.22, 1, 0.36, 1);
  animation: tour-spotlight-pulse 2.5s ease-in-out infinite;
}
@keyframes tour-spotlight-pulse {
  0%,100% {
    border-color: var(--tour-primary);
    box-shadow: 0 0 0 9999px rgba(2,6,23,0.62), 0 0 0 6px rgba(99,102,241,0.15), 0 0 30px rgba(99,102,241,0.35);
  }
  50% {
    border-color: var(--tour-primary2);
    box-shadow: 0 0 0 9999px rgba(2,6,23,0.55), 0 0 0 8px rgba(129,140,248,0.20), 0 0 40px rgba(129,140,248,0.50);
  }
}

/* \u2500\u2500 Tooltip card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-tour-tooltip {
  position: absolute;
  background: var(--tour-bg);
  border: 1.5px solid var(--tour-border);
  border-radius: var(--tour-radius);
  box-shadow: var(--tour-shadow);
  padding: 24px 24px 20px;
  max-width: 380px;
  min-width: 280px;
  z-index: calc(var(--dap-z-tour) + 2);
  font-family: var(--tour-font);
  opacity: 0;
  transform: scale(0.92) translateY(8px);
  animation: tour-tooltip-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) 0.15s forwards;
  pointer-events: auto;
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
}
/* Top gradient sheen */
.dap-tour-tooltip::after {
  content: '';
  position: absolute; inset: 0;
  border-radius: var(--tour-radius);
  background: linear-gradient(150deg, rgba(255,255,255,0.60) 0%, transparent 50%);
  pointer-events: none;
}
@keyframes tour-tooltip-in {
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* Arrow */
.dap-tour-tooltip::before {
  content: '';
  position: absolute;
  width: 13px; height: 13px;
  background: var(--tour-bg);
  border: 1.5px solid var(--tour-border);
  transform: rotate(45deg);
  z-index: 1;
}
.dap-tour-tooltip.top::before    { bottom: -8px; left: 50%; margin-left: -7px; border-top: none; border-left: none; }
.dap-tour-tooltip.bottom::before { top: -8px;    left: 50%; margin-left: -7px; border-bottom: none; border-right: none; }
.dap-tour-tooltip.left::before   { right: -8px;  top: 50%;  margin-top: -7px;  border-left: none; border-bottom: none; }
.dap-tour-tooltip.right::before  { left: -8px;   top: 50%;  margin-top: -7px;  border-right: none; border-top: none; }

/* \u2500\u2500 Tooltip header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-tour-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  position: relative; z-index: 2;
}
.dap-tour-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--tour-text);
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.3;
}
.dap-tour-step-badge {
  flex-shrink: 0;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--tour-primary);
  background: rgba(99,102,241,0.10);
  padding: 3px 10px;
  border-radius: 99px;
  white-space: nowrap;
  margin-top: 2px;
  letter-spacing: 0.01em;
}

/* \u2500\u2500 Description \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-tour-description {
  font-size: 13.5px;
  color: var(--tour-muted);
  line-height: 1.6;
  margin: 0 0 20px;
  position: relative; z-index: 2;
}

/* \u2500\u2500 Actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-tour-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  position: relative; z-index: 2;
}
.dap-tour-nav {
  display: flex;
  gap: 8px;
}

.dap-tour-btn {
  padding: 8px 18px;
  border-radius: 11px;
  font-family: var(--tour-font);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  letter-spacing: -0.01em;
  transition: all 0.18s ease;
  border: 1.5px solid rgba(0,0,0,0.10);
  background: rgba(0,0,0,0.04);
  color: var(--tour-text);
}
.dap-tour-btn:hover {
  background: rgba(0,0,0,0.08);
  transform: translateY(-1px);
}
.dap-tour-btn.primary {
  background: linear-gradient(135deg, var(--tour-primary) 0%, var(--tour-primary2) 100%);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 4px 14px rgba(99,102,241,0.35);
}
.dap-tour-btn.primary:hover {
  filter: brightness(1.08);
  box-shadow: 0 6px 20px rgba(99,102,241,0.45);
}

.dap-tour-skip {
  font-size: 12px;
  color: var(--tour-muted);
  cursor: pointer;
  border: none;
  background: none;
  font-family: var(--tour-font);
  padding: 4px;
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 0.15s ease;
}
.dap-tour-skip:hover { color: var(--tour-text); }

/* \u2500\u2500 Progress bar (top center) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-tour-progress {
  position: fixed;
  top: 20px; left: 50%;
  transform: translateX(-50%);
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  border: 1.5px solid rgba(99,102,241,0.15);
  border-radius: 20px;
  padding: 10px 20px;
  z-index: calc(var(--dap-z-tour) + 1);
  font-family: var(--tour-font);
  box-shadow: 0 8px 24px rgba(0,0,0,0.09);
  min-width: 220px;
  opacity: 0;
  animation: tour-fade-in 0.3s 0.1s ease forwards;
}
.dap-tour-progress-text {
  font-size: 12px;
  font-weight: 500;
  color: var(--tour-muted);
  text-align: center;
  margin-bottom: 6px;
}
.dap-tour-progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(99,102,241,0.12);
  border-radius: 99px;
  overflow: hidden;
}
.dap-tour-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--tour-primary), var(--tour-primary2));
  border-radius: 99px;
  transition: width 0.42s cubic-bezier(0.22, 1, 0.36, 1);
  width: 0%;
}

/* \u2500\u2500 Close button (fixed top-right) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-tour-close {
  position: fixed;
  top: 20px; right: 20px;
  background: rgba(255,255,255,0.90);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1.5px solid rgba(0,0,0,0.10);
  border-radius: 50%;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  z-index: calc(var(--dap-z-tour) + 1);
  box-shadow: 0 4px 16px rgba(0,0,0,0.09);
  color: var(--tour-muted);
  font-size: 18px;
  transition: all 0.18s ease;
}
.dap-tour-close:hover {
  background: #fff;
  color: var(--tour-text);
  transform: scale(1.06);
  box-shadow: 0 6px 20px rgba(0,0,0,0.14);
}

/* \u2500\u2500 Dot nav strip \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-tour-dots {
  display: flex;
  gap: 5px;
  align-items: center;
}
.dap-tour-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: rgba(99,102,241,0.20);
  transition: all 0.22s ease;
}
.dap-tour-dot.active {
  background: var(--tour-primary);
  transform: scale(1.25);
}
.dap-tour-dot.visited {
  background: rgba(99,102,241,0.50);
}

/* \u2500\u2500 Mobile \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@media (max-width: 640px) {
  .dap-tour-tooltip  { max-width: 310px; padding: 18px 18px 16px; }
  .dap-tour-progress { top: 12px; padding: 8px 14px; }
  .dap-tour-close    { top: 12px; right: 12px; width: 36px; height: 36px; font-size: 16px; }
  .dap-tour-actions  { flex-direction: column; gap: 8px; }
  .dap-tour-nav      { width: 100%; justify-content: space-between; }
}
`;
  function registerHotspotTour() {
    register("hotspotTour", renderHotspotTour);
  }
  async function renderHotspotTour(flow) {
    const { payload, id } = flow;
    const completionTracker = payload._completionTracker;
    ensureStyles6();
    let currentStepIndex = 0;
    let currentSpotlight = null;
    let currentTooltip = null;
    let autoAdvanceTimer;
    const overlay = buildOverlay();
    const progressEl = payload.showProgress ? buildProgressEl2(payload) : null;
    const closeEl = buildCloseBtn();
    document.documentElement.appendChild(overlay);
    if (progressEl) document.documentElement.appendChild(progressEl);
    document.documentElement.appendChild(closeEl);
    closeEl.addEventListener("click", completeTour);
    document.addEventListener("keydown", onKeyboard);
    await showStep(0);
    async function showStep(idx) {
      if (idx >= payload.steps.length) {
        completeTour();
        return;
      }
      const step = payload.steps[idx];
      currentStepIndex = idx;
      if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer);
        autoAdvanceTimer = void 0;
      }
      try {
        const el = await waitForElement(step.selector, { timeout: 3e3 });
        if (!(el instanceof HTMLElement)) {
          nextStep();
          return;
        }
        setSpotlight(el);
        setTooltip(step, el);
        if (progressEl) updateProgress();
        if (payload.autoAdvance && payload.autoAdvance > 0) {
          autoAdvanceTimer = window.setTimeout(nextStep, payload.autoAdvance * 1e3);
        }
      } catch {
        console.warn(`[DAP] Step ${idx} element not found`);
        nextStep();
      }
    }
    function setSpotlight(el) {
      currentSpotlight?.remove();
      const rect = el.getBoundingClientRect();
      const PAD = 10;
      const spot = document.createElement("div");
      spot.className = "dap-tour-spotlight";
      spot.style.left = `${rect.left + window.scrollX - PAD}px`;
      spot.style.top = `${rect.top + window.scrollY - PAD}px`;
      spot.style.width = `${rect.width + PAD * 2}px`;
      spot.style.height = `${rect.height + PAD * 2}px`;
      document.documentElement.appendChild(spot);
      currentSpotlight = spot;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    function setTooltip(step, el) {
      currentTooltip?.remove();
      const tooltip = document.createElement("div");
      tooltip.className = "dap-tour-tooltip";
      const header = document.createElement("div");
      header.className = "dap-tour-header";
      const title = document.createElement("h3");
      title.className = "dap-tour-title";
      title.textContent = step.title;
      const badge = document.createElement("span");
      badge.className = "dap-tour-step-badge";
      badge.textContent = `${currentStepIndex + 1} / ${payload.steps.length}`;
      header.append(title, badge);
      const desc = document.createElement("div");
      desc.className = "dap-tour-description";
      desc.innerHTML = sanitizeHtml(step.description);
      const dots = buildDots(payload.steps.length, currentStepIndex);
      const actions = document.createElement("div");
      actions.className = "dap-tour-actions";
      if (payload.allowSkip) {
        const skip = document.createElement("button");
        skip.className = "dap-tour-skip";
        skip.textContent = "Skip tour";
        skip.addEventListener("click", completeTour);
        actions.appendChild(skip);
      } else {
        actions.appendChild(dots);
      }
      const nav = document.createElement("div");
      nav.className = "dap-tour-nav";
      if (currentStepIndex > 0) {
        const prev = document.createElement("button");
        prev.className = "dap-tour-btn";
        prev.textContent = "\u2190 Back";
        prev.addEventListener("click", previousStep);
        nav.appendChild(prev);
      }
      const nextBtn = document.createElement("button");
      nextBtn.className = "dap-tour-btn primary";
      const isLast = currentStepIndex === payload.steps.length - 1;
      nextBtn.textContent = isLast ? step.action === "close" ? "Close" : "Finish \u2713" : "Next \u2192";
      nextBtn.addEventListener("click", () => {
        if (isLast) {
          if (step.action === "custom" && step.customAction) {
            window.dispatchEvent(new CustomEvent("dap-tour-action", {
              detail: { action: step.customAction, tourId: id, stepId: step.id }
            }));
          }
          completeTour();
        } else {
          nextStep();
        }
      });
      nav.appendChild(nextBtn);
      actions.appendChild(nav);
      tooltip.append(header, desc, actions);
      placeTooltip(tooltip, el, step.placement || "bottom");
      document.documentElement.appendChild(tooltip);
      currentTooltip = tooltip;
    }
    function buildDots(total, current) {
      const wrap = document.createElement("div");
      wrap.className = "dap-tour-dots";
      for (let i = 0; i < total; i++) {
        const d = document.createElement("div");
        d.className = `dap-tour-dot${i === current ? " active" : i < current ? " visited" : ""}`;
        wrap.appendChild(d);
      }
      return wrap;
    }
    function placeTooltip(tooltip, el, placement) {
      const rect = el.getBoundingClientRect();
      tooltip.classList.add(placement);
      const TW = 380;
      const TH = 160;
      const GAP = 20;
      let left = 0, top = 0;
      switch (placement) {
        case "top":
          left = rect.left + window.scrollX + rect.width / 2 - TW / 2;
          top = rect.top + window.scrollY - TH - GAP;
          break;
        case "bottom":
          left = rect.left + window.scrollX + rect.width / 2 - TW / 2;
          top = rect.bottom + window.scrollY + GAP;
          break;
        case "left":
          left = rect.left + window.scrollX - TW - GAP;
          top = rect.top + window.scrollY + rect.height / 2 - TH / 2;
          break;
        case "right":
          left = rect.right + window.scrollX + GAP;
          top = rect.top + window.scrollY + rect.height / 2 - TH / 2;
          break;
        default:
          left = rect.left + window.scrollX + rect.width / 2 - TW / 2;
          top = rect.bottom + window.scrollY + GAP;
      }
      const VW = window.innerWidth, VH = window.innerHeight;
      left = Math.max(10, Math.min(left, VW - TW - 10));
      top = Math.max(10, Math.min(top, VH - TH - 10));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }
    function nextStep() {
      showStep(currentStepIndex + 1);
    }
    function previousStep() {
      if (currentStepIndex > 0) showStep(currentStepIndex - 1);
    }
    function updateProgress() {
      if (!progressEl) return;
      const pct = (currentStepIndex + 1) / payload.steps.length * 100;
      const text = progressEl.querySelector(".dap-tour-progress-text");
      const fill = progressEl.querySelector(".dap-tour-progress-fill");
      if (text) text.textContent = `Step ${currentStepIndex + 1} of ${payload.steps.length}`;
      if (fill) fill.style.width = `${pct}%`;
    }
    function onKeyboard(e) {
      switch (e.key) {
        case "Escape":
          if (payload.allowSkip) completeTour();
          break;
        case "ArrowRight":
          e.preventDefault();
          nextStep();
          break;
        case "ArrowLeft":
          e.preventDefault();
          previousStep();
          break;
      }
    }
    let _tourDone = false;
    function completeTour() {
      if (_tourDone) return;
      _tourDone = true;
      if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
      document.removeEventListener("keydown", onKeyboard);
      overlay.remove();
      currentSpotlight?.remove();
      currentTooltip?.remove();
      progressEl?.remove();
      closeEl.remove();
      completionTracker?.onComplete?.();
    }
  }
  function buildOverlay() {
    const el = document.createElement("div");
    el.className = "dap-tour-overlay";
    return el;
  }
  function buildProgressEl2(payload) {
    const el = document.createElement("div");
    el.className = "dap-tour-progress";
    el.innerHTML = `
    <div class="dap-tour-progress-text">Step 1 of ${payload.steps.length}</div>
    <div class="dap-tour-progress-bar">
      <div class="dap-tour-progress-fill"></div>
    </div>`;
    return el;
  }
  function buildCloseBtn() {
    const btn = document.createElement("button");
    btn.className = "dap-tour-close";
    btn.innerHTML = "\xD7";
    btn.setAttribute("aria-label", "Close tour");
    return btn;
  }
  function ensureStyles6() {
    if (!document.getElementById("dap-tour-style-v2")) {
      const s = document.createElement("style");
      s.id = "dap-tour-style-v2";
      s.textContent = hotspotTourCssText;
      document.head.appendChild(s);
    }
  }

  // src/experiences/taskList.ts
  init_registry();
  var taskListCssText = `
:root {
  --dap-z-tasklist: 2147483625;
  --dap-tasklist-bg: #ffffff;
  --dap-tasklist-border: #e2e8f0;
  --dap-tasklist-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  --dap-tasklist-text: #1e293b;
  --dap-tasklist-text-muted: #64748b;
  --dap-tasklist-primary: #3b82f6;
  --dap-tasklist-success: #10b981;
  --dap-tasklist-overlay: rgba(15, 23, 42, 0.3);
}

.dap-tasklist-overlay {
  position: fixed;
  inset: 0;
  background: var(--dap-tasklist-overlay);
  z-index: var(--dap-z-tasklist);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  opacity: 0;
  animation: tasklistOverlayFadeIn 0.3s ease-out forwards;
}

@keyframes tasklistOverlayFadeIn {
  to { opacity: 1; }
}

.dap-tasklist-modal {
  background: var(--dap-tasklist-bg);
  border: 1px solid var(--dap-tasklist-border);
  border-radius: 12px;
  box-shadow: var(--dap-tasklist-shadow);
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  opacity: 0;
  transform: scale(0.95);
  animation: tasklistModalIn 0.3s ease-out 0.1s forwards;
}

@keyframes tasklistModalIn {
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dap-tasklist-header {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--dap-tasklist-border);
}

.dap-tasklist-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--dap-tasklist-text);
  margin: 0 0 8px 0;
}

.dap-tasklist-description {
  font-size: 14px;
  color: var(--dap-tasklist-text-muted);
  line-height: 1.5;
  margin: 0;
}

.dap-tasklist-progress {
  padding: 16px 20px;
  border-bottom: 1px solid var(--dap-tasklist-border);
  background: #f8fafc;
}

.dap-tasklist-progress-text {
  font-size: 14px;
  color: var(--dap-tasklist-text);
  margin-bottom: 8px;
  font-weight: 500;
}

.dap-tasklist-progress-bar {
  width: 100%;
  height: 6px;
  background: var(--dap-tasklist-border);
  border-radius: 3px;
  overflow: hidden;
}

.dap-tasklist-progress-fill {
  height: 100%;
  background: var(--dap-tasklist-success);
  border-radius: 3px;
  transition: width 0.4s ease;
  width: 0%;
}

.dap-tasklist-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.dap-tasklist-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
  transition: background-color 0.15s ease;
}

.dap-tasklist-item:last-child {
  border-bottom: none;
}

.dap-tasklist-item:hover {
  background: #f8fafc;
  margin: 0 -20px;
  padding: 12px 20px;
  border-radius: 6px;
  border-bottom: none;
}

.dap-tasklist-item.completed {
  opacity: 0.7;
}

.dap-tasklist-checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid var(--dap-tasklist-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
  margin-top: 2px;
}

.dap-tasklist-checkbox:hover {
  border-color: var(--dap-tasklist-primary);
}

.dap-tasklist-checkbox.checked {
  background: var(--dap-tasklist-success);
  border-color: var(--dap-tasklist-success);
  color: white;
}

.dap-tasklist-checkbox.required {
  border-color: #f59e0b;
}

.dap-tasklist-checkbox.required.checked {
  background: var(--dap-tasklist-success);
  border-color: var(--dap-tasklist-success);
}

.dap-tasklist-content {
  flex: 1;
  min-width: 0;
}

.dap-tasklist-item-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--dap-tasklist-text);
  margin: 0 0 4px 0;
  line-height: 1.4;
}

.dap-tasklist-item.completed .dap-tasklist-item-title {
  text-decoration: line-through;
  color: var(--dap-tasklist-text-muted);
}

.dap-tasklist-item-description {
  font-size: 13px;
  color: var(--dap-tasklist-text-muted);
  line-height: 1.4;
  margin: 0;
}

.dap-tasklist-required-badge {
  display: inline-block;
  background: #fef3c7;
  color: #92400e;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dap-tasklist-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--dap-tasklist-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.dap-tasklist-actions {
  display: flex;
  gap: 8px;
}

.dap-tasklist-btn {
  padding: 8px 16px;
  border: 1px solid var(--dap-tasklist-border);
  border-radius: 6px;
  background: transparent;
  color: var(--dap-tasklist-text);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dap-tasklist-btn:hover {
  background: var(--dap-tasklist-border);
}

.dap-tasklist-btn.primary {
  background: var(--dap-tasklist-primary);
  border-color: var(--dap-tasklist-primary);
  color: white;
}

.dap-tasklist-btn.primary:hover {
  background: #2563eb;
  border-color: #2563eb;
}

.dap-tasklist-btn.success {
  background: var(--dap-tasklist-success);
  border-color: var(--dap-tasklist-success);
  color: white;
}

.dap-tasklist-btn.success:hover {
  background: #059669;
  border-color: #059669;
}

.dap-tasklist-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dap-tasklist-completion-text {
  font-size: 12px;
  color: var(--dap-tasklist-text-muted);
}

@media (max-width: 640px) {
  .dap-tasklist-overlay {
    padding: 12px;
  }
  
  .dap-tasklist-modal {
    max-width: 100%;
  }
  
  .dap-tasklist-header {
    padding: 16px;
  }
  
  .dap-tasklist-body {
    padding: 12px 16px;
  }
  
  .dap-tasklist-footer {
    padding: 12px 16px;
    flex-direction: column;
    gap: 8px;
  }
  
  .dap-tasklist-actions {
    width: 100%;
    justify-content: space-between;
  }
}
`;
  function registerTaskList() {
    register("taskList", renderTaskList);
  }
  async function renderTaskList(flow) {
    const { payload, id } = flow;
    const completionTracker = payload._completionTracker;
    ensureStyles7();
    const completedTasks = /* @__PURE__ */ new Set();
    payload.tasks.forEach((task) => {
      if (task.completed) {
        completedTasks.add(task.id);
      }
    });
    const { overlay, modal, progressEl, bodyEl, footerEl } = createTaskListModal(payload);
    renderTasks();
    updateProgress();
    document.documentElement.appendChild(overlay);
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "tasklist-title");
    function renderTasks() {
      bodyEl.innerHTML = "";
      payload.tasks.forEach((task) => {
        const taskEl = createTaskElement(task);
        bodyEl.appendChild(taskEl);
      });
    }
    function createTaskElement(task) {
      const taskEl = document.createElement("div");
      taskEl.className = `dap-tasklist-item${completedTasks.has(task.id) ? " completed" : ""}`;
      const checkbox = document.createElement("div");
      checkbox.className = `dap-tasklist-checkbox${completedTasks.has(task.id) ? " checked" : ""}${task.required ? " required" : ""}`;
      checkbox.innerHTML = completedTasks.has(task.id) ? "\u2713" : "";
      checkbox.setAttribute("role", "checkbox");
      checkbox.setAttribute("aria-checked", completedTasks.has(task.id) ? "true" : "false");
      checkbox.addEventListener("click", () => {
        toggleTask(task.id);
      });
      const content = document.createElement("div");
      content.className = "dap-tasklist-content";
      const title = document.createElement("h4");
      title.className = "dap-tasklist-item-title";
      title.textContent = task.title;
      if (task.required) {
        const badge = document.createElement("span");
        badge.className = "dap-tasklist-required-badge";
        badge.textContent = "Required";
        title.appendChild(badge);
      }
      content.appendChild(title);
      if (task.description) {
        const description = document.createElement("p");
        description.className = "dap-tasklist-item-description";
        description.innerHTML = sanitizeHtml(task.description);
        content.appendChild(description);
      }
      taskEl.appendChild(checkbox);
      taskEl.appendChild(content);
      return taskEl;
    }
    function toggleTask(taskId) {
      if (completedTasks.has(taskId)) {
        completedTasks.delete(taskId);
      } else {
        completedTasks.add(taskId);
        const task = payload.tasks.find((t) => t.id === taskId);
        if (task?.action) {
          window.dispatchEvent(new CustomEvent("dap-task-completed", {
            detail: { action: task.action, taskId, taskListId: id }
          }));
        }
      }
      renderTasks();
      updateProgress();
      updateFooter();
    }
    function updateProgress() {
      if (!progressEl) return;
      const total = payload.tasks.length;
      const completed = completedTasks.size;
      const percentage = total > 0 ? completed / total * 100 : 0;
      const progressText = progressEl.querySelector(".dap-tasklist-progress-text");
      const progressFill = progressEl.querySelector(".dap-tasklist-progress-fill");
      if (progressText) {
        progressText.textContent = `${completed} of ${total} tasks completed`;
      }
      if (progressFill) {
        progressFill.style.width = `${percentage}%`;
      }
    }
    function updateFooter() {
      const requiredTasks = payload.tasks.filter((t) => t.required);
      const completedRequired = requiredTasks.filter((t) => completedTasks.has(t.id));
      const allRequiredCompleted = completedRequired.length === requiredTasks.length;
      const allTasksCompleted = completedTasks.size === payload.tasks.length;
      const completeBtn2 = footerEl.querySelector(".dap-tasklist-complete");
      footerEl.querySelector(".dap-tasklist-skip");
      const completionText = footerEl.querySelector(".dap-tasklist-completion-text");
      if (allTasksCompleted) {
        completeBtn2.textContent = "All Done!";
        completeBtn2.className = "dap-tasklist-btn success";
        completeBtn2.disabled = false;
      } else if (allRequiredCompleted || payload.allowPartialCompletion) {
        completeBtn2.textContent = "Complete";
        completeBtn2.className = "dap-tasklist-btn primary";
        completeBtn2.disabled = false;
      } else {
        completeBtn2.textContent = "Complete";
        completeBtn2.className = "dap-tasklist-btn primary";
        completeBtn2.disabled = true;
      }
      if (requiredTasks.length > 0 && !allRequiredCompleted) {
        const remaining = requiredTasks.length - completedRequired.length;
        completionText.textContent = `${remaining} required task${remaining === 1 ? "" : "s"} remaining`;
      } else {
        completionText.textContent = "";
      }
    }
    let _taskListDone = false;
    function completeTaskList() {
      if (_taskListDone) return;
      _taskListDone = true;
      document.removeEventListener("keydown", handleKeyboard);
      overlay.style.animation = "tasklistOverlayFadeOut 0.2s ease-in";
      modal.style.animation = "tasklistModalOut 0.2s ease-in";
      setTimeout(() => {
        overlay.remove();
        if (completionTracker?.onComplete) {
          console.debug(`[DAP] Completing task list flow: ${id}`);
          completionTracker.onComplete();
        }
      }, 200);
    }
    const completeBtn = footerEl.querySelector(".dap-tasklist-complete");
    const skipBtn = footerEl.querySelector(".dap-tasklist-skip");
    completeBtn.addEventListener("click", completeTaskList);
    if (skipBtn) {
      skipBtn.addEventListener("click", completeTaskList);
    }
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        completeTaskList();
      }
    });
    document.addEventListener("keydown", handleKeyboard);
    function handleKeyboard(e) {
      if (e.key === "Escape") {
        completeTaskList();
        document.removeEventListener("keydown", handleKeyboard);
      }
    }
    if (!document.getElementById("dap-tasklist-exit-styles")) {
      const style = document.createElement("style");
      style.id = "dap-tasklist-exit-styles";
      style.textContent = `
      @keyframes tasklistOverlayFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes tasklistModalOut {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.95); }
      }
    `;
      document.head.appendChild(style);
    }
    updateFooter();
  }
  function createTaskListModal(payload) {
    const overlay = document.createElement("div");
    overlay.className = "dap-tasklist-overlay";
    const modal = document.createElement("div");
    modal.className = "dap-tasklist-modal";
    const header = document.createElement("div");
    header.className = "dap-tasklist-header";
    const title = document.createElement("h2");
    title.className = "dap-tasklist-title";
    title.id = "tasklist-title";
    title.textContent = payload.title || "Tasks";
    header.appendChild(title);
    if (payload.description) {
      const description = document.createElement("p");
      description.className = "dap-tasklist-description";
      description.innerHTML = sanitizeHtml(payload.description);
      header.appendChild(description);
    }
    let progressEl = null;
    if (payload.showProgress) {
      progressEl = document.createElement("div");
      progressEl.className = "dap-tasklist-progress";
      const progressText = document.createElement("div");
      progressText.className = "dap-tasklist-progress-text";
      progressText.textContent = "0 of 0 tasks completed";
      const progressBar = document.createElement("div");
      progressBar.className = "dap-tasklist-progress-bar";
      const progressFill = document.createElement("div");
      progressFill.className = "dap-tasklist-progress-fill";
      progressBar.appendChild(progressFill);
      progressEl.appendChild(progressText);
      progressEl.appendChild(progressBar);
    }
    const bodyEl = document.createElement("div");
    bodyEl.className = "dap-tasklist-body";
    const footerEl = document.createElement("div");
    footerEl.className = "dap-tasklist-footer";
    const completionText = document.createElement("div");
    completionText.className = "dap-tasklist-completion-text";
    const actions = document.createElement("div");
    actions.className = "dap-tasklist-actions";
    if (payload.allowPartialCompletion) {
      const skipBtn = document.createElement("button");
      skipBtn.className = "dap-tasklist-btn dap-tasklist-skip";
      skipBtn.textContent = "Skip";
      actions.appendChild(skipBtn);
    }
    const completeBtn = document.createElement("button");
    completeBtn.className = "dap-tasklist-btn primary dap-tasklist-complete";
    completeBtn.textContent = "Complete";
    actions.appendChild(completeBtn);
    footerEl.appendChild(completionText);
    footerEl.appendChild(actions);
    modal.appendChild(header);
    if (progressEl) modal.appendChild(progressEl);
    modal.appendChild(bodyEl);
    modal.appendChild(footerEl);
    overlay.appendChild(modal);
    return { overlay, modal, progressEl, bodyEl, footerEl };
  }
  function ensureStyles7() {
    if (!document.getElementById("dap-tasklist-style")) {
      const style = document.createElement("style");
      style.id = "dap-tasklist-style";
      style.textContent = taskListCssText;
      document.head.appendChild(style);
    }
  }

  // src/experiences/walkthrough.ts
  init_registry();
  var walkthroughCssText = `
:root {
  --dap-z-walkthrough: 2147483630;
  --dap-walkthrough-overlay: rgba(15, 23, 42, 0.75);
  --dap-walkthrough-bg: #ffffff;
  --dap-walkthrough-border: #e2e8f0;
  --dap-walkthrough-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  --dap-walkthrough-text: #1e293b;
  --dap-walkthrough-text-muted: #64748b;
  --dap-walkthrough-primary: #3b82f6;
  --dap-walkthrough-success: #10b981;
  --dap-walkthrough-highlight: #fef3c7;
}

.dap-walkthrough-overlay {
  position: fixed;
  inset: 0;
  background: var(--dap-walkthrough-overlay);
  z-index: var(--dap-z-walkthrough);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.dap-walkthrough-overlay.active {
  opacity: 1;
  pointer-events: auto;
}

.dap-walkthrough-spotlight {
  position: absolute;
  border: 2px solid var(--dap-walkthrough-primary);
  border-radius: 8px;
  box-shadow: 0 0 0 9999px var(--dap-walkthrough-overlay);
  pointer-events: none;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: calc(var(--dap-z-walkthrough) + 1);
}

.dap-walkthrough-tooltip {
  position: absolute;
  background: var(--dap-walkthrough-bg);
  border: 1px solid var(--dap-walkthrough-border);
  border-radius: 12px;
  box-shadow: var(--dap-walkthrough-shadow);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  width: 320px;
  max-width: 90vw;
  z-index: calc(var(--dap-z-walkthrough) + 2);
  opacity: 0;
  transform: scale(0.95);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: auto;
}

.dap-walkthrough-tooltip.visible {
  opacity: 1;
  transform: scale(1);
}

.dap-walkthrough-tooltip::before {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  background: var(--dap-walkthrough-bg);
  border: 1px solid var(--dap-walkthrough-border);
  border-bottom: none;
  border-right: none;
  transform: rotate(45deg);
}

.dap-walkthrough-tooltip.position-top {
  transform-origin: bottom center;
}

.dap-walkthrough-tooltip.position-top::before {
  bottom: -7px;
  left: 50%;
  margin-left: -6px;
  border-top: none;
  border-left: none;
  border-bottom: 1px solid var(--dap-walkthrough-border);
  border-right: 1px solid var(--dap-walkthrough-border);
  transform: rotate(-135deg);
}

.dap-walkthrough-tooltip.position-bottom {
  transform-origin: top center;
}

.dap-walkthrough-tooltip.position-bottom::before {
  top: -7px;
  left: 50%;
  margin-left: -6px;
}

.dap-walkthrough-tooltip.position-left {
  transform-origin: right center;
}

.dap-walkthrough-tooltip.position-left::before {
  right: -7px;
  top: 50%;
  margin-top: -6px;
  border-top: none;
  border-left: none;
  border-bottom: 1px solid var(--dap-walkthrough-border);
  border-right: 1px solid var(--dap-walkthrough-border);
  transform: rotate(-45deg);
}

.dap-walkthrough-tooltip.position-right {
  transform-origin: left center;
}

.dap-walkthrough-tooltip.position-right::before {
  left: -7px;
  top: 50%;
  margin-top: -6px;
  border-bottom: none;
  border-right: none;
  border-top: 1px solid var(--dap-walkthrough-border);
  border-left: 1px solid var(--dap-walkthrough-border);
  transform: rotate(135deg);
}

.dap-walkthrough-header {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--dap-walkthrough-border);
  position: relative;
}

.dap-walkthrough-step-indicator {
  font-size: 12px;
  font-weight: 600;
  color: var(--dap-walkthrough-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.dap-walkthrough-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--dap-walkthrough-text);
  margin: 0;
  line-height: 1.3;
}

.dap-walkthrough-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  font-size: 18px;
  color: var(--dap-walkthrough-text-muted);
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.dap-walkthrough-close:hover {
  background: var(--dap-walkthrough-border);
}

.dap-walkthrough-body {
  padding: 16px 20px;
}

.dap-walkthrough-content {
  font-size: 14px;
  color: var(--dap-walkthrough-text);
  line-height: 1.6;
  margin: 0;
}

.dap-walkthrough-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--dap-walkthrough-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dap-walkthrough-progress {
  display: flex;
  gap: 6px;
  align-items: center;
}

.dap-walkthrough-progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dap-walkthrough-border);
  transition: all 0.2s ease;
}

.dap-walkthrough-progress-dot.active {
  background: var(--dap-walkthrough-primary);
  transform: scale(1.25);
}

.dap-walkthrough-progress-dot.completed {
  background: var(--dap-walkthrough-success);
}

.dap-walkthrough-nav {
  display: flex;
  gap: 8px;
  align-items: center;
}

.dap-walkthrough-btn {
  padding: 8px 16px;
  border: 1px solid var(--dap-walkthrough-border);
  border-radius: 6px;
  background: transparent;
  color: var(--dap-walkthrough-text);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dap-walkthrough-btn:hover {
  background: var(--dap-walkthrough-border);
}

.dap-walkthrough-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dap-walkthrough-btn.primary {
  background: var(--dap-walkthrough-primary);
  border-color: var(--dap-walkthrough-primary);
  color: white;
}

.dap-walkthrough-btn.primary:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
}

.dap-walkthrough-btn.success {
  background: var(--dap-walkthrough-success);
  border-color: var(--dap-walkthrough-success);
  color: white;
}

.dap-walkthrough-btn.success:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
}

.dap-walkthrough-step-count {
  font-size: 12px;
  color: var(--dap-walkthrough-text-muted);
  margin-right: 12px;
}

.dap-walkthrough-highlight {
  position: relative;
  z-index: calc(var(--dap-z-walkthrough) + 1);
}

.dap-walkthrough-highlight::after {
  content: '';
  position: absolute;
  inset: -4px;
  background: var(--dap-walkthrough-highlight);
  border-radius: 6px;
  opacity: 0.6;
  z-index: -1;
  animation: walkthroughPulse 2s infinite;
}

@keyframes walkthroughPulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.02); }
}

@media (max-width: 640px) {
  .dap-walkthrough-tooltip {
    width: 280px;
    max-width: calc(100vw - 32px);
  }
  
  .dap-walkthrough-header {
    padding: 16px;
  }
  
  .dap-walkthrough-body {
    padding: 12px 16px;
  }
  
  .dap-walkthrough-footer {
    padding: 12px 16px;
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .dap-walkthrough-nav {
    justify-content: space-between;
    width: 100%;
  }
  
  .dap-walkthrough-step-count {
    margin-right: 0;
    text-align: center;
  }
}
`;
  function registerWalkthrough() {
    register("walkthrough", renderWalkthrough);
  }
  async function renderWalkthrough(flow) {
    const { payload, id } = flow;
    const completionTracker = payload._completionTracker;
    ensureStyles8();
    let currentStepIndex = 0;
    let isActive = false;
    const overlay = createWalkthroughOverlay();
    const spotlight = createSpotlight();
    const tooltip = createTooltip();
    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(spotlight);
    document.documentElement.appendChild(tooltip);
    await showStep(currentStepIndex);
    async function showStep(stepIndex) {
      if (stepIndex < 0 || stepIndex >= payload.steps.length) return;
      const step = payload.steps[stepIndex];
      currentStepIndex = stepIndex;
      let targetElement = null;
      if (step.target) {
        try {
          targetElement = await waitForElement(step.target, { timeout: step.waitTimeout || 5e3 });
        } catch (error) {
          console.warn(`[DAP] Walkthrough target not found: ${step.target}`, error);
        }
      }
      if (targetElement) {
        positionSpotlight(targetElement);
        targetElement.classList.add("dap-walkthrough-highlight");
        if (step.autoScroll !== false) {
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center"
          });
        }
      } else {
        hideSpotlight();
      }
      updateTooltipContent(step, stepIndex);
      if (targetElement) {
        positionTooltip(tooltip, targetElement, step.position || "bottom");
      } else {
        positionTooltipCenter(tooltip);
      }
      overlay.classList.add("active");
      spotlight.style.opacity = targetElement ? "1" : "0";
      tooltip.classList.add("visible");
      isActive = true;
      if (step.autoAdvance && step.autoAdvanceDelay) {
        setTimeout(() => {
          if (isActive && currentStepIndex === stepIndex) {
            nextStep();
          }
        }, step.autoAdvanceDelay);
      }
      document.querySelectorAll(".dap-walkthrough-highlight").forEach((el) => {
        if (el !== targetElement) {
          el.classList.remove("dap-walkthrough-highlight");
        }
      });
    }
    function positionSpotlight(element) {
      const rect = element.getBoundingClientRect();
      const padding = 8;
      spotlight.style.left = `${rect.left - padding}px`;
      spotlight.style.top = `${rect.top - padding}px`;
      spotlight.style.width = `${rect.width + padding * 2}px`;
      spotlight.style.height = `${rect.height + padding * 2}px`;
    }
    function hideSpotlight() {
      spotlight.style.opacity = "0";
    }
    function updateTooltipContent(step, stepIndex) {
      const stepIndicator = tooltip.querySelector(".dap-walkthrough-step-indicator");
      const title = tooltip.querySelector(".dap-walkthrough-title");
      stepIndicator.textContent = `Step ${stepIndex + 1} of ${payload.steps.length}`;
      title.textContent = step.title;
      const content = tooltip.querySelector(".dap-walkthrough-content");
      content.innerHTML = sanitizeHtml(step.content);
      const progressContainer = tooltip.querySelector(".dap-walkthrough-progress");
      progressContainer.innerHTML = "";
      payload.steps.forEach((_, index) => {
        const dot = document.createElement("div");
        dot.className = "dap-walkthrough-progress-dot";
        if (index < stepIndex) {
          dot.classList.add("completed");
        } else if (index === stepIndex) {
          dot.classList.add("active");
        }
        progressContainer.appendChild(dot);
      });
      const prevBtn2 = tooltip.querySelector(".dap-walkthrough-prev");
      const nextBtn2 = tooltip.querySelector(".dap-walkthrough-next");
      const stepCount = tooltip.querySelector(".dap-walkthrough-step-count");
      prevBtn2.disabled = stepIndex === 0;
      if (stepIndex === payload.steps.length - 1) {
        nextBtn2.textContent = "Complete";
        nextBtn2.className = "dap-walkthrough-btn success dap-walkthrough-next";
      } else {
        nextBtn2.textContent = "Next";
        nextBtn2.className = "dap-walkthrough-btn primary dap-walkthrough-next";
      }
      stepCount.textContent = `${stepIndex + 1} / ${payload.steps.length}`;
    }
    function positionTooltip(tooltip2, target, position = "bottom") {
      const targetRect = target.getBoundingClientRect();
      const tooltipRect = tooltip2.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gap = 16;
      tooltip2.className = "dap-walkthrough-tooltip visible";
      let left = 0;
      let top = 0;
      switch (position) {
        case "top":
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          top = targetRect.top - tooltipRect.height - gap;
          tooltip2.classList.add("position-top");
          break;
        case "bottom":
          left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
          top = targetRect.bottom + gap;
          tooltip2.classList.add("position-bottom");
          break;
        case "left":
          left = targetRect.left - tooltipRect.width - gap;
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
          tooltip2.classList.add("position-left");
          break;
        case "right":
          left = targetRect.right + gap;
          top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
          tooltip2.classList.add("position-right");
          break;
      }
      left = Math.max(16, Math.min(left, viewportWidth - tooltipRect.width - 16));
      top = Math.max(16, Math.min(top, viewportHeight - tooltipRect.height - 16));
      tooltip2.style.left = `${left}px`;
      tooltip2.style.top = `${top}px`;
    }
    function positionTooltipCenter(tooltip2) {
      tooltip2.className = "dap-walkthrough-tooltip visible";
      tooltip2.style.left = "50%";
      tooltip2.style.top = "50%";
      tooltip2.style.transform = "translate(-50%, -50%)";
    }
    function nextStep() {
      if (currentStepIndex < payload.steps.length - 1) {
        showStep(currentStepIndex + 1);
      } else {
        completeWalkthrough();
      }
    }
    function prevStep() {
      if (currentStepIndex > 0) {
        showStep(currentStepIndex - 1);
      }
    }
    let _walkthroughDone = false;
    function completeWalkthrough() {
      if (_walkthroughDone) return;
      _walkthroughDone = true;
      isActive = false;
      document.querySelectorAll(".dap-walkthrough-highlight").forEach((el) => {
        el.classList.remove("dap-walkthrough-highlight");
      });
      overlay.style.opacity = "0";
      tooltip.style.opacity = "0";
      spotlight.style.opacity = "0";
      setTimeout(() => {
        overlay.remove();
        tooltip.remove();
        spotlight.remove();
        if (completionTracker?.onComplete) {
          console.debug(`[DAP] Completing walkthrough flow: ${id}`);
          completionTracker.onComplete();
        }
      }, 300);
      document.removeEventListener("keydown", handleKeyboard);
    }
    const closeBtn = tooltip.querySelector(".dap-walkthrough-close");
    const prevBtn = tooltip.querySelector(".dap-walkthrough-prev");
    const nextBtn = tooltip.querySelector(".dap-walkthrough-next");
    closeBtn.addEventListener("click", completeWalkthrough);
    prevBtn.addEventListener("click", prevStep);
    nextBtn.addEventListener("click", nextStep);
    document.addEventListener("keydown", handleKeyboard);
    function handleKeyboard(e) {
      if (!isActive) return;
      switch (e.key) {
        case "Escape":
          completeWalkthrough();
          break;
        case "ArrowRight":
        case " ":
          e.preventDefault();
          nextStep();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prevStep();
          break;
      }
    }
    overlay.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
  function createWalkthroughOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "dap-walkthrough-overlay";
    return overlay;
  }
  function createSpotlight() {
    const spotlight = document.createElement("div");
    spotlight.className = "dap-walkthrough-spotlight";
    return spotlight;
  }
  function createTooltip() {
    const tooltip = document.createElement("div");
    tooltip.className = "dap-walkthrough-tooltip";
    tooltip.setAttribute("role", "dialog");
    tooltip.setAttribute("aria-modal", "true");
    tooltip.innerHTML = `
    <div class="dap-walkthrough-header">
      <div class="dap-walkthrough-step-indicator">Step 1 of 1</div>
      <h3 class="dap-walkthrough-title">Step Title</h3>
      <button class="dap-walkthrough-close" aria-label="Close walkthrough">\xD7</button>
    </div>
    <div class="dap-walkthrough-body">
      <div class="dap-walkthrough-content">Step content goes here</div>
    </div>
    <div class="dap-walkthrough-footer">
      <div class="dap-walkthrough-progress"></div>
      <div class="dap-walkthrough-nav">
        <span class="dap-walkthrough-step-count">1 / 1</span>
        <button class="dap-walkthrough-btn dap-walkthrough-prev">Previous</button>
        <button class="dap-walkthrough-btn primary dap-walkthrough-next">Next</button>
      </div>
    </div>
  `;
    return tooltip;
  }
  function ensureStyles8() {
    if (!document.getElementById("dap-walkthrough-style")) {
      const style = document.createElement("style");
      style.id = "dap-walkthrough-style";
      style.textContent = walkthroughCssText;
      document.head.appendChild(style);
    }
  }

  // src/services/pageContextService.ts
  var _PageContextService = class _PageContextService {
    constructor() {
      this.handlers = /* @__PURE__ */ new Set();
      this.currentContext = null;
      this.initialized = false;
      this.originalPushState = history.pushState;
      this.originalReplaceState = history.replaceState;
      // Store bound handler reference so the same reference is used for add/remove
      this._boundHandlePopState = this.handlePopState.bind(this);
    }
    static getInstance() {
      if (!_PageContextService.instance) {
        _PageContextService.instance = new _PageContextService();
      }
      return _PageContextService.instance;
    }
    /**
     * Initialize page context tracking
     */
    initialize() {
      if (this.initialized) return;
      console.debug("[DAP] PageContextService: Initializing...");
      this.currentContext = this.captureCurrentContext();
      window.addEventListener("popstate", this._boundHandlePopState);
      this.interceptHistoryMethods();
      this.initialized = true;
      console.debug("[DAP] PageContextService: Initialized with context:", this.currentContext);
      this.notifyHandlers({
        previous: null,
        current: this.currentContext,
        type: "initial"
      });
    }
    /**
     * Get current page context
     */
    getCurrentContext() {
      if (!this.currentContext) {
        this.currentContext = this.captureCurrentContext();
      }
      return this.currentContext;
    }
    /**
     * Subscribe to page change events
     */
    subscribe(handler) {
      this.handlers.add(handler);
      return () => {
        this.handlers.delete(handler);
      };
    }
    /**
     * Manually trigger page context update (for framework integration)
     */
    updateContext(type = "navigation") {
      const previous = this.currentContext;
      const current = this.captureCurrentContext();
      if (!this.hasContextChanged(previous, current)) {
        return;
      }
      console.debug("[DAP] PageContextService: Context changed:", {
        from: previous?.pathname,
        to: current.pathname
      });
      this.currentContext = current;
      this.notifyHandlers({
        previous,
        current,
        type
      });
    }
    /**
     * Check if selector is relevant for current page
     */
    isSelectorRelevant(selector) {
      if (!selector) return false;
      return true;
    }
    /**
     * Get page identifier for debugging/logging
     */
    getPageId() {
      const context = this.getCurrentContext();
      return `${context.pathname}${context.hash}${context.search}`;
    }
    /**
     * Clean up resources
     */
    destroy() {
      if (!this.initialized) return;
      console.debug("[DAP] PageContextService: Destroying...");
      window.removeEventListener("popstate", this._boundHandlePopState);
      this.restoreHistoryMethods();
      this.handlers.clear();
      this.currentContext = null;
      this.initialized = false;
    }
    // Private methods
    captureCurrentContext() {
      return {
        href: window.location.href,
        pathname: window.location.pathname,
        hash: window.location.hash,
        search: window.location.search,
        timestamp: Date.now()
      };
    }
    hasContextChanged(previous, current) {
      if (!previous) return true;
      return previous.href !== current.href || previous.pathname !== current.pathname || previous.hash !== current.hash || previous.search !== current.search;
    }
    handlePopState(event) {
      console.debug("[DAP] PageContextService: Popstate event detected");
      this.updateContext("navigation");
    }
    interceptHistoryMethods() {
      const self = this;
      history.pushState = function(state, title, url) {
        self.originalPushState.apply(history, arguments);
        console.debug("[DAP] PageContextService: PushState detected:", url);
        setTimeout(() => {
          self.updateContext("navigation");
        }, 0);
      };
      history.replaceState = function(state, title, url) {
        self.originalReplaceState.apply(history, arguments);
        console.debug("[DAP] PageContextService: ReplaceState detected:", url);
        setTimeout(() => {
          self.updateContext("navigation");
        }, 0);
      };
    }
    restoreHistoryMethods() {
      history.pushState = this.originalPushState;
      history.replaceState = this.originalReplaceState;
    }
    notifyHandlers(event) {
      console.debug("[DAP] PageContextService: Notifying handlers:", event.type, {
        from: event.previous?.pathname,
        to: event.current.pathname
      });
      this.handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error("[DAP] PageContextService: Handler error:", error);
        }
      });
    }
  };
  _PageContextService.instance = null;
  var PageContextService = _PageContextService;
  var pageContextService = PageContextService.getInstance();

  // src/services/locationContextService.ts
  var LocationContextService = class _LocationContextService {
    constructor() {
      this._listeners = /* @__PURE__ */ new Set();
      this._currentContext = {
        currentPath: window.location.pathname.replace(/^\/+/, "")
      };
      pageContextService.subscribe((_event) => {
        this.updateContext();
      });
      window.addEventListener("hashchange", this.updateContext.bind(this));
    }
    /**
     * Get the singleton instance of the LocationContextService
     */
    static getInstance() {
      if (!this._instance) {
        this._instance = new _LocationContextService();
      }
      return this._instance;
    }
    /**
     * Set the current screen ID
     * @param screenId The ID of the current screen/view
     */
    setScreenId(screenId) {
      const normalizedScreenId = screenId.replace(/^\/+/, "");
      this._currentContext = {
        ...this._currentContext,
        screenId: normalizedScreenId
      };
      this.notifyListeners();
    }
    /**
     * Set the current location context
     * @param context New context values
     */
    setContext(context) {
      const normalizedContext = { ...context };
      if (normalizedContext.currentPath) {
        normalizedContext.currentPath = normalizedContext.currentPath.replace(/^\/+/, "");
      }
      if (normalizedContext.screenId) {
        normalizedContext.screenId = normalizedContext.screenId.replace(/^\/+/, "");
      }
      this._currentContext = {
        ...this._currentContext,
        ...normalizedContext
      };
      this.notifyListeners();
    }
    /**
     * Get the current location context
     * @returns The current location context
     */
    getContext() {
      return { ...this._currentContext };
    }
    /**
     * Subscribe to location context changes
     * @param listener Function to call when the context changes
     * @returns Function to unsubscribe
     */
    subscribe(listener) {
      this._listeners.add(listener);
      return () => this._listeners.delete(listener);
    }
    /**
     * Update the current context based on window location
     */
    updateContext() {
      const normalizedPath = window.location.pathname.replace(/^\/+/, "");
      this._currentContext = {
        ...this._currentContext,
        currentPath: normalizedPath
      };
      this.notifyListeners();
    }
    /**
     * Check if the current location matches a specific location requirement
     * @param elementLocation The required location/route from the flow
     * @returns True if the current location matches the requirement
     */
    matchesLocation(elementLocation) {
      if (!elementLocation) return true;
      const currentPath = this._currentContext.currentPath || "";
      const currentScreenId = this._currentContext.screenId || "";
      const normalizedRequired = elementLocation.replace(/^\/+/, "").toLowerCase();
      if (currentPath.toLowerCase() === normalizedRequired || currentScreenId.toLowerCase() === normalizedRequired) {
        return true;
      }
      if (currentPath.toLowerCase().includes(normalizedRequired)) {
        return true;
      }
      if (currentPath.toLowerCase().startsWith(normalizedRequired + "/")) {
        return true;
      }
      const hash = window.location.hash.replace(/^#+/, "").toLowerCase();
      if (hash === normalizedRequired || hash.includes(normalizedRequired)) {
        return true;
      }
      const urlParams = new URLSearchParams(window.location.search);
      const routeParam = urlParams.get("route") || urlParams.get("page") || urlParams.get("view");
      if (routeParam && routeParam.toLowerCase() === normalizedRequired) {
        return true;
      }
      return false;
    }
    /**
     * Notify all listeners of context change
     */
    notifyListeners() {
      this._listeners.forEach((listener) => listener(this.getContext()));
    }
  };
  LocationContextService.getInstance();

  // src/index.ts
  init_userContextService();

  // src/core/flowEngine.ts
  init_userContextService();

  // src/tracking.ts
  init_userContextService();

  // src/utils/privacyManager.ts
  var PRIVACY_PREFS_KEY = "dap_privacy_preferences";
  var DEFAULT_PREFERENCES = {
    consentLevel: "essential" /* ESSENTIAL */,
    allowedDataCategories: [
      "device_info" /* DEVICE_INFO */,
      "user_id" /* USER_ID */
    ],
    lastUpdated: Date.now(),
    expiresAt: Date.now() + 180 * 24 * 60 * 60 * 1e3,
    // 180 days
    hasExplicitConsent: false
  };
  function getPrivacyPreferences() {
    try {
      const storedPrefs = localStorage.getItem(PRIVACY_PREFS_KEY);
      if (!storedPrefs) {
        return DEFAULT_PREFERENCES;
      }
      const parsedPrefs = JSON.parse(storedPrefs);
      if (parsedPrefs.expiresAt < Date.now()) {
        return DEFAULT_PREFERENCES;
      }
      return parsedPrefs;
    } catch (error) {
      console.error("[DAP] Error reading privacy preferences:", error);
      return DEFAULT_PREFERENCES;
    }
  }
  function hasConsentLevel(level) {
    const prefs = getPrivacyPreferences();
    const levels = [
      "none" /* NONE */,
      "essential" /* ESSENTIAL */,
      "functional" /* FUNCTIONAL */,
      "analytics" /* ANALYTICS */,
      "all" /* ALL */
    ];
    const currentLevelIndex = levels.indexOf(prefs.consentLevel);
    const requestedLevelIndex = levels.indexOf(level);
    return currentLevelIndex >= requestedLevelIndex;
  }

  // src/tracking.ts
  var StepTrackingState = class {
    constructor() {
      /** Map of flowId → Set of "flowId:stepId" keys that have been tracked. */
      this.trackedStepsByFlow = /* @__PURE__ */ new Map();
    }
    /**
     * Check if a step has already been tracked for a given flow
     */
    isStepTracked(flowId, stepId) {
      const flowSet = this.trackedStepsByFlow.get(flowId);
      if (!flowSet) return false;
      return flowSet.has(`${flowId}:${stepId}`);
    }
    /**
     * Mark a step as tracked
     */
    markStepTracked(flowId, stepId) {
      if (!this.trackedStepsByFlow.has(flowId)) {
        this.trackedStepsByFlow.set(flowId, /* @__PURE__ */ new Set());
      }
      const key = `${flowId}:${stepId}`;
      this.trackedStepsByFlow.get(flowId).add(key);
      console.debug(`[DAP Tracking] Step marked as tracked: ${key}`);
    }
    /**
     * Reset tracking state for a specific flow only.
     * Other flows' tracked-step history is preserved so re-entering a prior
     * flow in the same session will not re-fire its step-view events.
     */
    reset(flowId) {
      this.trackedStepsByFlow.delete(flowId);
      console.debug(`[DAP Tracking] Tracking state reset for flow: ${flowId}`);
    }
    /**
     * Get current tracking state (for debugging)
     */
    getState() {
      const allSteps = [];
      this.trackedStepsByFlow.forEach((set) => set.forEach((k) => allSteps.push(k)));
      return {
        flowId: null,
        trackedCount: allSteps.length,
        trackedSteps: allSteps
      };
    }
  };
  var trackingState = new StepTrackingState();
  async function trackStepView(flowId, stepId, config) {
    if (!flowId || !stepId) {
      console.warn("[DAP Tracking] Cannot track step: flowId and stepId are required");
      return;
    }
    if (trackingState.isStepTracked(flowId, stepId)) {
      console.debug(`[DAP Tracking] Step already tracked, skipping: ${flowId}:${stepId}`);
      return;
    }
    if (!hasConsentLevel("essential" /* ESSENTIAL */)) {
      console.debug("[DAP Tracking] Step view tracking blocked: insufficient consent level");
      return;
    }
    const dapConfig = window.__DAP_CONFIG__;
    if (!dapConfig) {
      console.error("[DAP Tracking] No configuration available for tracking");
      return;
    }
    const userAnalyticsContext = userContextService.getAnalyticsContext();
    const userId = userAnalyticsContext.userId;
    if (!userId) {
      console.warn("[DAP Tracking] No user identity available for tracking");
      return;
    }
    trackingState.markStepTracked(flowId, stepId);
    const payload = {
      flowId,
      stepId,
      userId
    };
    const apiUrl = buildTrackingApiUrl(dapConfig);
    if (!apiUrl) {
      console.error("[DAP Tracking] Could not build API URL");
      return;
    }
    try {
      console.debug("[DAP Tracking] Sending step view:", payload);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Host-Url": window.location.origin,
          "X-Api-Key": dapConfig.apikey || ""
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        console.warn(`[DAP Tracking] API call failed with status ${response.status}`);
      } else {
        console.debug(`[DAP Tracking] Step view tracked successfully: ${flowId}:${stepId}`);
      }
    } catch (error) {
      console.warn("[DAP Tracking] Failed to send tracking call:", error);
    }
  }
  function buildTrackingApiUrl(config) {
    const { organizationid, siteid, apiurl } = config;
    if (!organizationid || !siteid || !apiurl) {
      console.error("[DAP Tracking] Missing required config fields for API URL:", {
        hasOrganizationId: !!organizationid,
        hasSiteId: !!siteid,
        hasApiUrl: !!apiurl
      });
      return null;
    }
    const baseUrl = apiurl.replace(/\/$/, "");
    return `${baseUrl}/analytics/organizationId/${organizationid}/siteCollectionId/${siteid}`;
  }
  function resetFlowTracking(flowId) {
    trackingState.reset(flowId);
  }

  // src/utils/previewMode.ts
  var PREVIEW_SESSION_STORAGE_KEY = "dap_preview_session_id";
  var PREVIEW_FLOW_ID_STORAGE_KEY = "dap_preview_flow_id";
  function detectPreviewMode() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const previewSessionIdParam = urlParams.get("previewSessionId");
      const flowIdParam = urlParams.get("flowId");
      if (!previewSessionIdParam?.trim() || !flowIdParam?.trim()) {
        const hadSession = sessionStorage.getItem(PREVIEW_SESSION_STORAGE_KEY);
        if (hadSession) {
          sessionStorage.removeItem(PREVIEW_SESSION_STORAGE_KEY);
          sessionStorage.removeItem(PREVIEW_FLOW_ID_STORAGE_KEY);
          console.debug("[DAP] Stale preview session evicted (missing previewSessionId or flowId in URL)");
        }
        return { isPreviewMode: false, previewSessionId: null, flowId: null };
      }
      const previewSessionId = previewSessionIdParam.trim();
      const flowId = flowIdParam.trim();
      sessionStorage.setItem(PREVIEW_SESSION_STORAGE_KEY, previewSessionId);
      sessionStorage.setItem(PREVIEW_FLOW_ID_STORAGE_KEY, flowId);
      return { isPreviewMode: true, previewSessionId, flowId };
    } catch (error) {
      console.error("[DAP] Error detecting preview mode:", error);
      return { isPreviewMode: false, previewSessionId: null, flowId: null };
    }
  }

  // src/core/triggerManager.ts
  var TriggerManager = class _TriggerManager {
    constructor() {
      this._activeListeners = /* @__PURE__ */ new Map();
      this._triggeredOnceSet = /* @__PURE__ */ new Set();
      this._pageContextUnsubscribe = null;
      this._initialized = false;
      this._registeredTriggers = {};
      this._waitTimeouts = /* @__PURE__ */ new Map();
      this._selectorWaitTimeout = 3e4;
      // 30 seconds default
      this._conditionStates = /* @__PURE__ */ new Map();
      // Helper methods for debouncing
      this._debounceTimestamps = /* @__PURE__ */ new Map();
    }
    static getInstance() {
      if (!this._instance) {
        this._instance = new _TriggerManager();
      }
      return this._instance;
    }
    /**
     * Initialize trigger manager with page context tracking
     */
    initialize() {
      if (this._initialized) return;
      pageContextService.initialize();
      this._pageContextUnsubscribe = pageContextService.subscribe(this.handlePageChange.bind(this));
      this._initialized = true;
    }
    /**
     * Handle page change events - re-evaluate all registered triggers
     */
    handlePageChange(event) {
      console.debug(`[DAP] \u{1F4C4} Page changed from ${event.previous?.pathname} to ${event.current.pathname}`);
      console.debug("[DAP] Re-evaluating all registered triggers for new page context");
      this.clearAllTimeouts();
      if (event.type !== "initial") {
        this.clearLifecycleTriggers();
      }
      for (const [stepId, registration] of Object.entries(this._registeredTriggers)) {
        console.debug(`[DAP] Re-registering triggers for step ${stepId} on new page`);
        this.removeTriggerListeners(stepId);
        this.registerTriggerListeners(
          stepId,
          registration.trigger,
          registration.onTrigger,
          registration.flowContext,
          registration.stepType
        );
      }
    }
    /**
     * Clear triggered-once set for lifecycle triggers on page change
     */
    clearLifecycleTriggers() {
      const lifecycleKeys = Array.from(this._triggeredOnceSet).filter(
        (key) => key.includes(":Lifecycle:")
      );
      lifecycleKeys.forEach((key) => {
        this._triggeredOnceSet.delete(key);
      });
    }
    /**
     * Re-register all triggers for page context changes
     */
    reRegisterAllTriggers() {
      Object.entries(this._registeredTriggers).forEach(([stepId, { trigger, onTrigger, flowContext }]) => {
        this.registerTriggerListeners(stepId, trigger, onTrigger, flowContext);
      });
    }
    /**
     * Clean up resources
     */
    destroy() {
      if (!this._initialized) return;
      for (const stepId of this._activeListeners.keys()) {
        this.removeTriggerListeners(stepId);
      }
      if (this._pageContextUnsubscribe) {
        this._pageContextUnsubscribe();
        this._pageContextUnsubscribe = null;
      }
      this._activeListeners.clear();
      this._triggeredOnceSet.clear();
      this._registeredTriggers = {};
      clearSelectorCache();
      this._initialized = false;
    }
    /**
     * Resolve trigger for a step:
     * 1. Use step.trigger if it exists and has valid conditions
     * 2. Return null if no trigger is resolvable
     */
    resolveTrigger(step) {
      console.debug(`[DAP] Resolving trigger for step: ${step.stepId}`);
      if (step.trigger && step.trigger.conditions && step.trigger.conditions.length > 0) {
        console.debug(`\u2705 [DAP] Step ${step.stepId}: Using STEP-LEVEL trigger with ${step.trigger.conditions.length} conditions`);
        console.debug(`   \u2514\u2500\u2500 Trigger type: ${step.trigger.type}, Event: ${step.trigger.conditions[0]?.event}, Kind: ${step.trigger.conditions[0]?.kind}`);
        return step.trigger;
      }
      console.error(`\u274C [DAP] Step ${step.stepId}: NO TRIGGER FOUND! Step will execute immediately.`);
      return null;
    }
    /**
     * Register trigger listeners for a step (page-aware)
     */
    registerTriggerListeners(stepId, trigger, onTrigger, flowContext, stepType) {
      pageContextService.getPageId();
      this._registeredTriggers[stepId] = { trigger, onTrigger, flowContext, stepType };
      this.removeTriggerListeners(stepId);
      this._conditionStates.set(stepId, new Array(trigger.conditions.length).fill(false));
      const listeners = [];
      trigger.conditions.forEach((condition, index) => {
        const listener = this.createConditionListener(stepId, condition, trigger, onTrigger, index, flowContext);
        if (listener) {
          listeners.push(listener);
        }
      });
      if (listeners.length > 0) {
        this._activeListeners.set(stepId, listeners);
      }
    }
    /**
     * Create listener for individual trigger condition
     */
    createConditionListener(stepId, condition, trigger, onTrigger, conditionIndex, flowContext) {
      switch (condition.kind) {
        case "Dom":
          return this.createDomListener(stepId, condition, trigger, onTrigger, conditionIndex);
        case "Lifecycle":
          return this.createLifecycleListener(stepId, condition, trigger, onTrigger, conditionIndex, flowContext);
        case "Input":
          return this.createInputListener(stepId, condition, trigger, onTrigger, conditionIndex);
        case "Time":
          return this.createTimeListener(stepId, condition, trigger, onTrigger, conditionIndex);
        default:
          console.warn(`[DAP] Unsupported condition kind: ${condition.kind}`);
          return null;
      }
    }
    /**
     * Map trigger events to actual DOM events
     */
    mapTriggerEventToDOMEvents(triggerEvent) {
      const normalized = (triggerEvent || "").toLowerCase().trim();
      switch (normalized) {
        case "hover":
        case "mouseenter":
        case "mouse enter":
          return ["mouseenter"];
        case "mouseleave":
        case "mouse leave":
          return ["mouseleave"];
        case "mouseover":
        case "mouse over":
          return ["mouseover"];
        case "mouseout":
        case "mouse out":
          return ["mouseout"];
        case "click":
          return ["click"];
        case "dblclick":
        case "doubleclick":
        case "double click":
          return ["dblclick"];
        case "rightclick":
        case "right click":
        case "contextmenu":
          return ["contextmenu"];
        case "scroll":
          return ["scroll"];
        case "focus":
          return ["focus"];
        case "blur":
          return ["blur"];
        case "change":
          return ["change"];
        case "input":
          return ["input"];
        case "submit":
          return ["submit"];
        default:
          return [normalized || triggerEvent];
      }
    }
    /**
     * Create DOM event listener
     */
    createDomListener(stepId, condition, trigger, onTrigger, conditionIndex) {
      if (!condition.selector) {
        console.warn(`[DAP] DOM condition missing selector for step: ${stepId}`);
        return null;
      }
      const validation = this.validateSelectorOnCurrentPage(condition.selector);
      console.debug(`[DAP] \u{1F4C4} Page context validation for ${stepId}: selector exists=${validation.exists}, count=${validation.elementCount}`);
      let targetElement = null;
      let observer = null;
      let timeoutCleanup = null;
      const attachListener = (element) => {
        if (timeoutCleanup) {
          timeoutCleanup();
          timeoutCleanup = null;
        }
        const attachedPageId = pageContextService.getPageId();
        const eventNames = this.mapTriggerEventToDOMEvents(condition.event);
        const cleanupFunctions = [];
        console.debug(`[DAP] Mapping trigger event "${condition.event}" to DOM events:`, eventNames);
        for (const eventName of eventNames) {
          const eventHandler = (event) => {
            const currentPageId = pageContextService.getPageId();
            if (currentPageId !== attachedPageId) {
              console.debug(`[DAP] Page changed since listener attached (${attachedPageId} \u2192 ${currentPageId}), ignoring event for step: ${stepId}`);
              return;
            }
            if (eventName === "scroll" && event.target) {
              const target = event.target;
              const isGlobalTarget = target === window || target === document;
              if (isGlobalTarget) {
                const isGlobalElement = element === document.documentElement || element === document.body || element === window || element === document;
                if (!isGlobalElement) return;
              } else {
                if (target !== element && !element.contains(target) && !target.contains(element)) {
                  return;
                }
              }
            }
            console.debug(`[DAP] DOM event triggered:`, event.type, condition.selector);
            const onceKey = `${stepId}:${condition.kind}:${condition.event}:${conditionIndex}`;
            if (trigger.once && this._triggeredOnceSet.has(onceKey)) {
              console.debug(`[DAP] Trigger already fired once for: ${onceKey}`);
              return;
            }
            if (condition.debounceMs) {
              const debounceKey = `debounce:${stepId}:${condition.event}`;
              const lastFired = this.getLastFiredTime(debounceKey);
              const now = Date.now();
              if (lastFired && now - lastFired < condition.debounceMs) {
                console.debug(`[DAP] Event debounced for step: ${stepId}`);
                return;
              }
              this.setLastFiredTime(debounceKey, now);
            }
            const context = {
              stepId,
              flowId: "",
              // Will be set by caller
              element,
              event,
              conditionIndex
            };
            if (element && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
              const normalizedEvt = (condition.event || "").toLowerCase().trim();
              if (normalizedEvt === "input" || normalizedEvt === "change" || normalizedEvt === "keyup") {
                context.userInput = element.value;
                console.debug(`[DAP] Captured input value: "${context.userInput}" for step: ${stepId}`);
              }
            }
            if (trigger.once) {
              this._triggeredOnceSet.add(onceKey);
            }
            const result = this.evaluateTrigger(trigger, context);
            if (result.triggered) {
              onTrigger(context);
            } else if (trigger.once) {
              this._triggeredOnceSet.delete(onceKey);
            }
          };
          const isScrollEvent = eventName === "scroll";
          const eventTarget = isScrollEvent ? window : element;
          const options = isScrollEvent ? { capture: true, passive: true } : false;
          eventTarget.addEventListener(eventName, eventHandler, options);
          if ((eventName === "mouseover" || eventName === "mouseenter") && element.matches(":hover")) {
            console.debug(`[DAP] Mouse already hovering over element, auto-firing ${eventName} for step: ${stepId}`);
            setTimeout(() => {
              eventHandler(new MouseEvent(eventName, { bubbles: true, cancelable: true, view: window }));
            }, 0);
          }
          cleanupFunctions.push(() => {
            eventTarget.removeEventListener(eventName, eventHandler, options);
          });
        }
        return () => {
          cleanupFunctions.forEach((cleanup) => cleanup());
        };
      };
      targetElement = resolveSelectorWithCache(stepId, condition.selector);
      if (targetElement) {
        console.debug(`[DAP] Element found immediately for selector: ${condition.selector}`);
        return attachListener(targetElement);
      }
      console.debug(`[DAP] Element not found, waiting for: ${condition.selector}`);
      let listenerCleanup = null;
      this.setupSelectorTimeout(stepId, condition.selector, () => {
        console.warn(`[DAP] \u26A0\uFE0F Selector timeout for step ${stepId}: ${condition.selector}`);
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        console.warn(`[DAP] \u26A0\uFE0F Selector timeout for step ${stepId}: ${condition.selector}`);
        const stepType = this._registeredTriggers[stepId]?.stepType || "Optional";
        if (stepType === "Mandatory") {
          console.error(`[DAP] \u{1F6AB} Mandatory step "${stepId}" selector "${condition.selector}" not found after timeout \u2014 flow is now blocked`);
          window.dispatchEvent(new CustomEvent("dap:stepSelectorTimeout", { detail: { stepId, selector: condition.selector, stepType: "Mandatory", blocked: true } }));
        } else {
          console.warn(`[DAP] \u23E9 Optional step "${stepId}" selector "${condition.selector}" not found \u2014 advancing past step`);
          window.dispatchEvent(new CustomEvent("dap:stepSelectorTimeout", { detail: { stepId, selector: condition.selector, stepType: "Optional", blocked: false } }));
          const reg = this._registeredTriggers[stepId];
          if (reg) {
            reg.onTrigger({ stepId, flowId: "", element: null, event: null });
          }
        }
      });
      timeoutCleanup = () => this.clearTimeoutForStep(stepId);
      observer = new MutationObserver(() => {
        try {
          const element = resolveSelectorWithCache(stepId, condition.selector);
          if (element && element !== targetElement) {
            targetElement = element;
            console.debug(`[DAP] Element appeared: ${condition.selector}`);
            if (observer) {
              observer.disconnect();
            }
            listenerCleanup = attachListener(element);
          }
        } catch (error) {
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      return () => {
        if (observer) {
          observer.disconnect();
        }
        if (listenerCleanup) {
          listenerCleanup();
        }
      };
    }
    /**
     * Create lifecycle event listener (page-aware)
     */
    createLifecycleListener(stepId, condition, trigger, onTrigger, conditionIndex, flowContext) {
      const normalizedEvent = (condition.event || "").toLowerCase().trim();
      switch (normalizedEvent) {
        case "load":
        // alias sent by server
        case "page-load":
          const onceKey = `${stepId}:${condition.kind}:${condition.event}:${conditionIndex}`;
          const shouldFireImmediately = !trigger.once || !this._triggeredOnceSet.has(onceKey);
          if (shouldFireImmediately) {
            const staggerMs = 100 + conditionIndex * 150;
            setTimeout(() => {
              const context = {
                stepId,
                flowId: "",
                // Will be set by caller
                pageState: {
                  loaded: true,
                  pageId: pageContextService.getPageId()
                },
                conditionIndex
              };
              const result = this.evaluateTrigger(trigger, context);
              if (result.triggered) {
                if (trigger.once) {
                  this._triggeredOnceSet.add(onceKey);
                }
                onTrigger(context);
              }
            }, staggerMs);
          }
          const pageChangeUnsubscribe = pageContextService.subscribe((event) => {
            if (event.type === "navigation" || event.type === "reload") {
              console.debug(`[DAP] Page change detected for page-load trigger, step: ${stepId}`);
              const pageLoadOnceKey = `${stepId}:${condition.kind}:${condition.event}:${conditionIndex}`;
              if (trigger.once && event.type === "navigation") {
                this._triggeredOnceSet.delete(pageLoadOnceKey);
              }
              const shouldFire = !trigger.once || !this._triggeredOnceSet.has(pageLoadOnceKey);
              if (shouldFire) {
                const context = {
                  stepId,
                  flowId: "",
                  pageState: {
                    loaded: true,
                    pageId: pageContextService.getPageId(),
                    navigationEvent: event
                  },
                  conditionIndex
                };
                const result = this.evaluateTrigger(trigger, context);
                if (result.triggered) {
                  if (trigger.once) {
                    this._triggeredOnceSet.add(pageLoadOnceKey);
                  }
                  onTrigger(context);
                }
              }
            }
          });
          return () => {
            pageChangeUnsubscribe();
          };
        case "dom-ready":
        case "domready":
        case "dom ready":
        case "domcontentloaded":
          const domReadyOnceKey = `${stepId}:${condition.kind}:${condition.event}:${conditionIndex}`;
          const shouldFireDomReady = !trigger.once || !this._triggeredOnceSet.has(domReadyOnceKey);
          if (shouldFireDomReady) {
            if (trigger.once) this._triggeredOnceSet.add(domReadyOnceKey);
            const domReadyHandler = () => {
              const context = {
                stepId,
                flowId: "",
                pageState: { loaded: true, pageId: pageContextService.getPageId() },
                conditionIndex
              };
              const result = this.evaluateTrigger(trigger, context);
              if (result.triggered) {
                onTrigger(context);
              } else if (trigger.once) {
                this._triggeredOnceSet.delete(domReadyOnceKey);
              }
            };
            const staggerMs = 50 + conditionIndex * 150;
            if (document.readyState === "complete" || document.readyState === "interactive") {
              setTimeout(domReadyHandler, staggerMs);
            } else {
              document.addEventListener("DOMContentLoaded", () => setTimeout(domReadyHandler, staggerMs), { once: true });
            }
          }
          return () => {
          };
        case "before-unload":
        case "beforeunload":
        case "before unload":
          const beforeOnceKey = `${stepId}:${condition.kind}:${condition.event}:${conditionIndex}`;
          const beforeHandler = (event) => {
            if (trigger.once && this._triggeredOnceSet.has(beforeOnceKey)) return;
            if (trigger.once) this._triggeredOnceSet.add(beforeOnceKey);
            const context = {
              stepId,
              flowId: "",
              event,
              conditionIndex
            };
            const result = this.evaluateTrigger(trigger, context);
            if (result.triggered) {
              onTrigger(context);
            } else if (trigger.once) {
              this._triggeredOnceSet.delete(beforeOnceKey);
            }
          };
          window.addEventListener("beforeunload", beforeHandler);
          return () => window.removeEventListener("beforeunload", beforeHandler);
        case "page-unload":
        case "unload":
        case "page unload":
          const unloadOnceKey = `${stepId}:${condition.kind}:${condition.event}:${conditionIndex}`;
          const unloadHandler = (event) => {
            if (trigger.once && this._triggeredOnceSet.has(unloadOnceKey)) return;
            if (trigger.once) this._triggeredOnceSet.add(unloadOnceKey);
            const context = {
              stepId,
              flowId: "",
              event,
              conditionIndex
            };
            const result = this.evaluateTrigger(trigger, context);
            if (result.triggered) {
              onTrigger(context);
            } else if (trigger.once) {
              this._triggeredOnceSet.delete(unloadOnceKey);
            }
          };
          window.addEventListener("unload", unloadHandler);
          return () => window.removeEventListener("unload", unloadHandler);
        case "window-resize":
        case "resize":
        case "window resize":
          const resizeOnceKey = `${stepId}:${condition.kind}:${condition.event}:${conditionIndex}`;
          const resizeHandler = (event) => {
            if (trigger.once && this._triggeredOnceSet.has(resizeOnceKey)) return;
            if (trigger.once) this._triggeredOnceSet.add(resizeOnceKey);
            const context = {
              stepId,
              flowId: "",
              event,
              conditionIndex
            };
            const result = this.evaluateTrigger(trigger, context);
            if (result.triggered) {
              onTrigger(context);
            } else if (trigger.once) {
              this._triggeredOnceSet.delete(resizeOnceKey);
            }
          };
          window.addEventListener("resize", resizeHandler);
          return () => window.removeEventListener("resize", resizeHandler);
        case "orientation-change":
        case "orientationchange":
        case "orientation change":
          const orientOnceKey = `${stepId}:${condition.kind}:${condition.event}:${conditionIndex}`;
          const orientHandler = (event) => {
            if (trigger.once && this._triggeredOnceSet.has(orientOnceKey)) return;
            if (trigger.once) this._triggeredOnceSet.add(orientOnceKey);
            const context = {
              stepId,
              flowId: "",
              event,
              conditionIndex
            };
            const result = this.evaluateTrigger(trigger, context);
            if (result.triggered) {
              onTrigger(context);
            } else if (trigger.once) {
              this._triggeredOnceSet.delete(orientOnceKey);
            }
          };
          window.addEventListener("orientationchange", orientHandler);
          return () => window.removeEventListener("orientationchange", orientHandler);
        default:
          console.warn(`[DAP] Unsupported lifecycle event: ${condition.event}`);
          return null;
      }
    }
    /**
     * Create input event listener
     */
    createInputListener(stepId, condition, trigger, onTrigger, conditionIndex) {
      if (!condition.selector) {
        console.warn(`[DAP] Input condition missing selector for step: ${stepId}`);
        return null;
      }
      const validation = this.validateSelectorOnCurrentPage(condition.selector);
      console.debug(`[DAP] \u{1F4C4} Input page context validation for ${stepId}: selector exists=${validation.exists}, count=${validation.elementCount}`);
      const inputHandler = (event) => {
        const target = event.target;
        const value = target.value;
        let conditionMet = false;
        if (condition.operator && condition.value !== void 0) {
          conditionMet = this.evaluateCondition(value, condition.operator, condition.value);
        } else {
          conditionMet = true;
        }
        if (conditionMet) {
          const context = {
            stepId,
            flowId: "",
            element: target,
            event,
            userInput: value,
            conditionIndex
          };
          const result = this.evaluateTrigger(trigger, context);
          if (result.triggered) {
            onTrigger(context);
          }
        }
      };
      const element = resolveSelectorWithCache(stepId, condition.selector);
      if (!element) {
        console.debug(`[DAP] Input element not found, waiting: ${condition.selector}`);
        this.setupSelectorTimeout(stepId, condition.selector, () => {
          console.warn(`[DAP] \u26A0\uFE0F Input selector timeout for step ${stepId}: ${condition.selector}`);
          console.warn(`[DAP] \u{1F4CA} Telemetry: input-selector-not-found - Step: ${stepId}, Selector: ${condition.selector}`);
          if (stepId.includes("rule") || stepId.includes("condition")) {
            console.error(`[DAP] \u{1F6A8} Rule-based step ${stepId} cannot find input selector - possible cross-page navigation issue`);
          }
        });
        const observer = new MutationObserver(() => {
          const foundElement = resolveSelectorWithCache(stepId, condition.selector);
          if (foundElement) {
            console.debug(`[DAP] Input element appeared: ${condition.selector}`);
            this.clearTimeoutForStep(stepId);
            foundElement.addEventListener("input", inputHandler);
            foundElement.addEventListener("change", inputHandler);
            observer.disconnect();
          }
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        return () => {
          this.clearTimeoutForStep(stepId);
          observer.disconnect();
          const attachedElement = resolveSelectorWithCache(stepId, condition.selector);
          if (attachedElement) {
            attachedElement.removeEventListener("input", inputHandler);
            attachedElement.removeEventListener("change", inputHandler);
          }
        };
      }
      console.debug(`[DAP] \u2705 Input element found immediately for selector: ${condition.selector}`);
      element.addEventListener("input", inputHandler);
      element.addEventListener("change", inputHandler);
      return () => {
        element.removeEventListener("input", inputHandler);
        element.removeEventListener("change", inputHandler);
      };
    }
    /**
     * Create time-based listener
     */
    createTimeListener(stepId, condition, trigger, onTrigger, conditionIndex) {
      const delay = typeof condition.value === "number" ? condition.value : 1e3;
      const timeoutId = setTimeout(() => {
        const context = {
          stepId,
          flowId: "",
          pageState: { timeElapsed: delay },
          conditionIndex
        };
        const result = this.evaluateTrigger(trigger, context);
        if (result.triggered) {
          onTrigger(context);
        }
      }, delay);
      return () => {
        clearTimeout(timeoutId);
      };
    }
    /**
     * Evaluate complete trigger (all conditions with logical operator)
     */
    evaluateTrigger(trigger, context) {
      const startTime = Date.now();
      let matchedConditions = 0;
      const totalConditions = trigger.conditions.length;
      const cIndex = context.conditionIndex;
      if (trigger.type === "Composite" || totalConditions > 1) {
        if (!this._conditionStates.has(context.stepId)) {
          this._conditionStates.set(context.stepId, new Array(totalConditions).fill(false));
        }
        const states = this._conditionStates.get(context.stepId);
        if (typeof cIndex === "number" && cIndex < states.length) {
          states[cIndex] = true;
          console.debug(`[DAP] Composite condition ${cIndex} met for step ${context.stepId}`);
        }
        matchedConditions = states.filter((s) => s).length;
      } else {
        matchedConditions = 1;
      }
      let triggered = false;
      if (trigger.operator === "And") {
        triggered = matchedConditions === totalConditions;
      } else if (trigger.operator === "Or") {
        triggered = matchedConditions > 0;
      }
      if (triggered && !trigger.once) {
        const states = this._conditionStates.get(context.stepId);
        if (states) {
          trigger.conditions.forEach((c, idx) => {
            if (c.kind === "Dom" || c.kind === "Input") {
              states[idx] = false;
            }
          });
        }
      }
      const result = {
        triggered,
        matchedConditions,
        totalConditions,
        evaluationTime: Date.now() - startTime,
        debugInfo: {
          triggerType: trigger.type,
          operator: trigger.operator,
          once: trigger.once
        }
      };
      console.debug(`[DAP] Trigger evaluation result:`, result);
      return result;
    }
    /**
     * Evaluate individual condition value
     */
    evaluateCondition(actualValue, operator, expectedValue) {
      switch (operator) {
        case "Equals":
          return actualValue === expectedValue;
        case "NotEquals":
          return actualValue !== expectedValue;
        case "Contains":
          return String(actualValue).includes(String(expectedValue));
        case "NotContains":
          return !String(actualValue).includes(String(expectedValue));
        case "StartsWith":
          return String(actualValue).startsWith(String(expectedValue));
        case "EndsWith":
          return String(actualValue).endsWith(String(expectedValue));
        case "GreaterThan":
          return Number(actualValue) > Number(expectedValue);
        case "LessThan":
          return Number(actualValue) < Number(expectedValue);
        case "GreaterThanOrEqual":
          return Number(actualValue) >= Number(expectedValue);
        case "LessThanOrEqual":
          return Number(actualValue) <= Number(expectedValue);
        case "Empty":
          return !actualValue || String(actualValue).trim() === "";
        case "In":
          if (Array.isArray(expectedValue)) {
            return expectedValue.includes(actualValue);
          }
          return false;
        case "NotIn":
          if (Array.isArray(expectedValue)) {
            return !expectedValue.includes(actualValue);
          }
          return true;
        case "Regex":
          try {
            const regex = new RegExp(String(expectedValue));
            return regex.test(String(actualValue));
          } catch {
            return false;
          }
        default:
          console.warn(`[DAP] Unsupported operator: ${operator}`);
          return false;
      }
    }
    /**
     * Remove all listeners for a step
     */
    removeTriggerListeners(stepId) {
      const listeners = this._activeListeners.get(stepId);
      if (listeners) {
        listeners.forEach((cleanup) => cleanup());
        this._activeListeners.delete(stepId);
      }
    }
    /**
     * ✅ Fix #2: Fully unregister a trigger — removes active listeners AND the stored registration.
     * Call this when a step completes so that page-change re-registration cannot re-trigger it.
     */
    unregisterTrigger(stepId) {
      this.removeTriggerListeners(stepId);
      delete this._registeredTriggers[stepId];
      this._conditionStates.delete(stepId);
      evictSelectorCacheEntry(stepId);
      console.debug(`[DAP] Fully unregistered trigger for completed step: ${stepId}`);
    }
    /**
     * Clear all listeners
     */
    clearAllListeners() {
      for (const [stepId, listeners] of this._activeListeners) {
        listeners.forEach((cleanup) => cleanup());
      }
      this._activeListeners.clear();
      this._triggeredOnceSet.clear();
      this._registeredTriggers = {};
      this.clearAllTimeouts();
      clearSelectorCache();
    }
    /**
     * Clear all active timeouts
     */
    clearAllTimeouts() {
      for (const timeoutId of this._waitTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      this._waitTimeouts.clear();
    }
    /**
     * Clear specific timeout for a step
     */
    clearTimeoutForStep(stepId) {
      const timeoutId = this._waitTimeouts.get(stepId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this._waitTimeouts.delete(stepId);
      }
    }
    /**
     * Validate if selector exists on current page
     */
    validateSelectorOnCurrentPage(selector) {
      const elements = resolveSelectorAll(selector);
      return {
        exists: elements.length > 0,
        elementCount: elements.length,
        validationTimestamp: Date.now()
      };
    }
    /**
     * Set up timeout for selector waiting with proper cleanup
     */
    setupSelectorTimeout(stepId, selector, onTimeout, timeoutMs = this._selectorWaitTimeout) {
      this.clearTimeoutForStep(stepId);
      const timeoutId = setTimeout(() => {
        console.warn(`[DAP] \u23F0 Timeout: Selector not found within ${timeoutMs}ms for step ${stepId}: ${selector}`);
        console.warn(`[DAP] Triggering timeout handler and cleaning up for step: ${stepId}`);
        this._waitTimeouts.delete(stepId);
        onTimeout();
      }, timeoutMs);
      this._waitTimeouts.set(stepId, timeoutId);
      console.debug(`[DAP] \u23F1\uFE0F  Set ${timeoutMs}ms timeout for selector waiting: ${stepId}`);
    }
    /**
     * Reset once-fired triggers for a new flow
     */
    resetOnceTriggersForFlow(flowId) {
      this._triggeredOnceSet.clear();
      this._conditionStates.clear();
      this._registeredTriggers = {};
      clearSelectorCache();
    }
    getLastFiredTime(key) {
      return this._debounceTimestamps.get(key);
    }
    setLastFiredTime(key, timestamp) {
      this._debounceTimestamps.set(key, timestamp);
    }
  };
  var triggerManager = TriggerManager.getInstance();

  // src/core/flowEngine.ts
  var FlowEngine = class _FlowEngine {
    constructor() {
      this._state = {
        activeFlowId: null,
        flowInProgress: false,
        activeStep: 0,
        activeStepTriggered: false,
        executionState: "TERMINATED",
        executionMode: "Linear",
        triggeredSteps: /* @__PURE__ */ new Set(),
        runCounted: false,
        anyOrderStepInProgress: false,
        inProgressSteps: /* @__PURE__ */ new Set()
      };
      this._currentFlow = null;
      this._stepTriggerListeners = /* @__PURE__ */ new Map();
      this._domObservers = /* @__PURE__ */ new Map();
      this._onFlowEnd = null;
      // CRITICAL FIX 2: Debounced Rule Evaluation System
      this._ruleEvaluationTimers = /* @__PURE__ */ new Map();
      this._inputStabilityMinLength = 2;
      // Minimum chars before rule evaluation fires (single chars are not meaningful)
      // CRITICAL FIX 3: Input Stability Tracking
      this._lastInputValues = /* @__PURE__ */ new Map();
      this._inputStabilityChecks = /* @__PURE__ */ new Map();
      // Mandatory-step completion tracking (cleared on each flow reset)
      this._completedMandatorySteps = /* @__PURE__ */ new Set();
      // ✅ Fix #3: Queue for one-shot triggers that fired while the concurrency lock was held
      this._pendingAnyOrderSteps = [];
      pageContextService.initialize();
      triggerManager.initialize();
      pageContextService.subscribe(this.handlePageChange.bind(this));
    }
    /**
     * Register a callback that fires whenever a flow ends (completed or aborted).
     * Used by index.ts to advance the sequential flow queue (Bug B fix).
     */
    setOnFlowEndCallback(cb) {
      this._onFlowEnd = cb;
    }
    /**
     * Handle page changes and re-evaluate active flows
     */
    handlePageChange(event) {
      console.debug("[DAP] FlowEngine: Handling page change:", event.type, {
        from: event.previous?.pathname,
        to: event.current.pathname,
        activeFlow: this._state.activeFlowId
      });
      if (this._state.flowInProgress && this._currentFlow) {
        this.reRegisterActiveStepTriggers();
      }
    }
    /**
     * Re-register triggers for the currently active step(s) after page change
     */
    reRegisterActiveStepTriggers() {
      if (!this._currentFlow || !this._state.flowInProgress) {
        return;
      }
      console.debug("[DAP] FlowEngine: Re-registering triggers after page change");
      if (this._state.executionMode === "Linear") {
        if (this._state.activeStep < this._currentFlow.steps.length && !this._state.activeStepTriggered) {
          const currentStep = this._currentFlow.steps[this._state.activeStep];
          this.executeStepWithTrigger(currentStep, this._state.activeStep);
        }
      } else {
        this._currentFlow.steps.forEach((step, index) => {
          if (this._state.triggeredSteps.has(index)) {
            triggerManager.unregisterTrigger(step.stepId);
          } else if (this._state.inProgressSteps.has(index)) {
            if (!this.isStepContextActive(step)) {
              console.debug(
                `[DAP] AnyOrder: page changed away from in-progress step ${step.stepId} \u2014 resetting in-progress state`
              );
              this._state.inProgressSteps.delete(index);
              this._state.anyOrderStepInProgress = false;
              this.setupStepTrigger(step, index);
            }
          } else {
            this.setupStepTrigger(step, index);
          }
        });
      }
    }
    static getInstance() {
      if (!this._instance) {
        this._instance = new _FlowEngine();
      }
      return this._instance;
    }
    /**
     * 🚨 CRITICAL FIX: Validate flow frequency and execution limits
     * Implements the OneTime + maxRuns = 1 validation as required
     */
    validateFlowFrequency(flowData) {
      const previewMode = detectPreviewMode();
      if (previewMode.isPreviewMode) {
        console.debug(`[DAP] \u{1F7E2} PREVIEW MODE: Bypassing frequency validation for flow ${flowData.flowId}`);
        return true;
      }
      console.debug(`[DAP] \u{1F50D} Validating frequency for flow ${flowData.flowId}`);
      if (!flowData.execution) {
        console.warn(`[DAP] No execution config found for flow ${flowData.flowId}, allowing by default`);
        return true;
      }
      const frequency = flowData.execution.frequency;
      if (!frequency) {
        console.warn(`[DAP] No frequency config found for flow ${flowData.flowId}, allowing by default`);
        return true;
      }
      if (frequency.type === "Always") {
        console.debug(`[DAP] \u2705 FLOW ELIGIBLE: ${flowData.flowId} (Always frequency \u2014 no throttle)`);
        return true;
      }
      console.debug(`[DAP] Flow frequency config:`, {
        type: frequency.type,
        maxRuns: frequency.maxRuns,
        flowId: flowData.flowId
      });
      if (frequency.type === "OneTime" || frequency.type === "Recurring") {
        const maxRuns = frequency.maxRuns || 1;
        const flowRunKey = `dap_flow_runs_${flowData.flowId}`;
        const flowCompletedKey = `dap_flow_completed_${flowData.flowId}`;
        try {
          if (frequency.type === "OneTime") {
            const completionData = localStorage.getItem(flowCompletedKey);
            if (completionData) {
              try {
                const completion = JSON.parse(completionData);
                console.debug(`[DAP] \u{1F6D1} FLOW BLOCKED: OneTime flow ${flowData.flowId} was completed via ${completion.reason} at ${new Date(completion.timestamp).toISOString()}`);
                return false;
              } catch {
                console.debug(`[DAP] \u{1F6D1} FLOW BLOCKED: OneTime flow ${flowData.flowId} was previously completed`);
                return false;
              }
            }
          }
          const storedRuns = localStorage.getItem(flowRunKey);
          const currentRuns = storedRuns ? parseInt(storedRuns, 10) : 0;
          console.debug(`[DAP] ${frequency.type} flow ${flowData.flowId}: ${currentRuns}/${maxRuns} eligible runs`);
          if (currentRuns >= maxRuns) {
            console.debug(`[DAP] \u{1F6D1} FLOW BLOCKED: ${flowData.flowId} has reached maxRuns limit (${currentRuns}/${maxRuns})`);
            return false;
          }
          console.debug(`[DAP] \u2705 FLOW ELIGIBLE: ${flowData.flowId} (${currentRuns}/${maxRuns} runs)`);
          return true;
        } catch (error) {
          console.error(`[DAP] Error checking flow frequency for ${flowData.flowId}:`, error);
          return true;
        }
      }
      if (frequency.type === "Daily" || frequency.type === "Weekly" || frequency.type === "Monthly") {
        const windowMs = frequency.type === "Daily" ? 864e5 : (
          // 24 h
          frequency.type === "Weekly" ? 6048e5 : (
            // 7 days
            2592e6
          )
        );
        const lastRunKey = `dap_flow_last_run_${flowData.flowId}`;
        try {
          const lastRun = localStorage.getItem(lastRunKey);
          if (lastRun) {
            const elapsed = Date.now() - parseInt(lastRun, 10);
            if (elapsed < windowMs) {
              const remaining = Math.ceil((windowMs - elapsed) / 6e4);
              console.debug(`[DAP] \u{1F6D1} FLOW BLOCKED: ${flowData.flowId} (${frequency.type} \u2014 ${remaining} min remaining in window)`);
              return false;
            }
          }
          console.debug(`[DAP] \u2705 FLOW ELIGIBLE: ${flowData.flowId} (${frequency.type} frequency)`);
          return true;
        } catch (error) {
          console.error(`[DAP] Error checking ${frequency.type} frequency for ${flowData.flowId}:`, error);
          return true;
        }
      }
      console.debug(`[DAP] \u2705 FLOW ELIGIBLE: ${flowData.flowId} (unknown frequency type: ${frequency.type})`);
      return true;
    }
    /**
     * 🚨 CRITICAL FIX: Increment flow run count in localStorage
     * Only called when the flow actually starts (first trigger fires)
     */
    incrementFlowRunCount(flowData) {
      const frequency = flowData.execution?.frequency;
      if (!frequency) return;
      if (frequency.type === "OneTime" || frequency.type === "Recurring") {
        const flowRunKey = `dap_flow_runs_${flowData.flowId}`;
        try {
          const storedRuns = localStorage.getItem(flowRunKey);
          const currentRuns = storedRuns ? parseInt(storedRuns, 10) : 0;
          const newRunCount = currentRuns + 1;
          localStorage.setItem(flowRunKey, newRunCount.toString());
          console.debug(`[DAP] \u{1F4C8} FLOW RUN COUNTED: ${flowData.flowId} now at ${newRunCount}/${frequency.maxRuns || 1}`);
        } catch (error) {
          console.error(`[DAP] Error incrementing run count for ${flowData.flowId}:`, error);
        }
      } else if (frequency.type === "Daily" || frequency.type === "Weekly" || frequency.type === "Monthly") {
        const lastRunKey = `dap_flow_last_run_${flowData.flowId}`;
        try {
          localStorage.setItem(lastRunKey, Date.now().toString());
          console.debug(`[DAP] \u{1F4C8} FLOW RUN RECORDED: ${flowData.flowId} (${frequency.type} window started at ${(/* @__PURE__ */ new Date()).toISOString()})`);
        } catch (error) {
          console.error(`[DAP] Error recording last-run timestamp for ${flowData.flowId}:`, error);
        }
      }
    }
    /**
     * Check if flow requires user context
     * For now, allow anonymous flows unless rules specifically reference user properties
     */
    flowRequiresUserContext(flowData) {
      for (const step of flowData.steps) {
        if (step.conditionRuleBlocks) {
          for (const ruleBlock of step.conditionRuleBlocks) {
            if (ruleBlock.conditions) {
              for (const condition of ruleBlock.conditions) {
                if (condition.propertyName?.startsWith("user.")) {
                  console.debug(`[DAP] Flow ${flowData.flowId} requires user context due to rule: ${condition.propertyName}`);
                  return true;
                }
              }
            }
          }
        }
      }
      return false;
    }
    /**
     * Start a new flow
     */
    async startFlow(flowData) {
      console.debug(`[DAP] \u{1F680} Starting flow: ${flowData.flowId}`);
      if (!this.validateFlowFrequency(flowData)) {
        console.debug(`[DAP] \u{1F6D1} Flow ${flowData.flowId} blocked by frequency validation`);
        this._onFlowEnd?.(flowData.flowId, "blocked");
        return;
      }
      this.analyzeTriggerUsage(flowData);
      this.analyzeFlowPageContext(flowData);
      if (this.flowRequiresUserContext(flowData) && !userContextService.hasRealUser()) {
        console.warn(`[DAP] Flow ${flowData.flowId} requires user context but none available - flow execution blocked`);
        this._onFlowEnd?.(flowData.flowId, "blocked");
        return;
      }
      const ruleSteps = flowData.steps.filter(
        (step) => step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0
      );
      console.debug(`[DAP] Flow has ${ruleSteps.length} rule steps:`, ruleSteps);
      if (ruleSteps.length > 0) {
        this.analyzeRuleStepsPageContext(ruleSteps);
      }
      if (this._state.flowInProgress) {
        const savedCallback = this._onFlowEnd;
        this._onFlowEnd = null;
        this.abortFlow();
        this._onFlowEnd = savedCallback;
      }
      resetFlowTracking(flowData.flowId);
      this._state = {
        activeFlowId: flowData.flowId,
        flowInProgress: true,
        activeStep: 0,
        activeStepTriggered: false,
        executionState: "ACTIVE",
        executionMode: flowData.execution?.mode?.toLowerCase() === "anyorder" ? "AnyOrder" : "Linear",
        triggeredSteps: /* @__PURE__ */ new Set(),
        runCounted: false,
        anyOrderStepInProgress: false,
        inProgressSteps: /* @__PURE__ */ new Set()
      };
      this._currentFlow = flowData;
      this.executeStep();
    }
    /**
     * Abort current flow
     * Enhanced with CRITICAL FIXES cleanup
     */
    abortFlow() {
      if (!this._state.flowInProgress) return;
      console.debug(`[DAP] Aborting flow: ${this._state.activeFlowId}`);
      this.cleanupCurrentStep();
      this.cleanupAllTimers();
      if (this._state.activeFlowId) {
        triggerManager.resetOnceTriggersForFlow(this._state.activeFlowId);
      }
      this._pendingAnyOrderSteps = [];
      this._state = {
        activeFlowId: null,
        flowInProgress: false,
        activeStep: 0,
        activeStepTriggered: false,
        executionState: "TERMINATED",
        executionMode: "Linear",
        triggeredSteps: /* @__PURE__ */ new Set(),
        anyOrderStepInProgress: false,
        inProgressSteps: /* @__PURE__ */ new Set()
      };
      this._currentFlow = null;
      this._completedMandatorySteps.clear();
    }
    /**
     * CRITICAL FIX 2 & 3: Clean up all timers and tracking state
     */
    cleanupAllTimers() {
      for (const [stepId, timerId] of this._ruleEvaluationTimers) {
        clearTimeout(timerId);
      }
      this._ruleEvaluationTimers.clear();
      this._lastInputValues.clear();
      this._inputStabilityChecks.clear();
      console.debug(`[DAP] All debounce and input stability timers cleaned up`);
    }
    /**
     * Execute current step in the flow with enhanced trigger support
     */
    executeStep() {
      if (!this._currentFlow || !this._state.flowInProgress) return;
      if (this._state.executionMode === "Linear") {
        this.executeLinearStep();
      } else if (this._state.executionMode === "AnyOrder") {
        this.executeAnyOrderSteps();
      }
    }
    /**
     * Execute steps in linear order (traditional flow)
     * Enhanced with Linear Execution Gate enforcement
     */
    executeLinearStep() {
      if (!this._currentFlow) return;
      const step = this._currentFlow.steps[this._state.activeStep];
      if (!step) {
        console.debug(`[DAP] Flow completed`);
        this.completeFlow();
        return;
      }
      console.debug(`[DAP] Linear Execution Gate: Enforcing step-by-step execution for step ${step.stepId} (${this._state.activeStep})`);
      this.cleanupPreviousStepTriggers();
      this.executeStepWithTrigger(step);
    }
    /**
     * Execute steps in any order (all steps listen simultaneously)
     */
    executeAnyOrderSteps() {
      if (!this._currentFlow) return;
      for (let i = 0; i < this._currentFlow.steps.length; i++) {
        if (!this._state.triggeredSteps.has(i) && !this._state.inProgressSteps.has(i)) {
          const step = this._currentFlow.steps[i];
          this.setupStepTrigger(step, i);
        }
      }
    }
    /**
     * Execute a step with enhanced trigger support
     */
    executeStepWithTrigger(step, stepIndex) {
      console.debug(`[DAP] ========== EXECUTING STEP ${step.stepId} ==========`);
      const trigger = triggerManager.resolveTrigger(step);
      if (!trigger) {
        console.debug(`[DAP] Step ${step.stepId}: NO TRIGGER - executing immediately`);
        if (!this._state.runCounted && this._currentFlow) {
          this.incrementFlowRunCount(this._currentFlow);
          this._state.runCounted = true;
        }
        this.executeStepContent(step);
        this.postStepTransition(step);
        return;
      }
      console.debug(`[DAP] Step ${step.stepId}: TRIGGER RESOLVED - setting up listeners`);
      const actualStepIndex = stepIndex !== void 0 ? stepIndex : this._state.activeStep;
      const isCurrentActiveStep = actualStepIndex === this._state.activeStep;
      const flowContext = {
        mode: this._state.executionMode,
        currentStepActive: isCurrentActiveStep
      };
      if (!this.isStepContextActive(step)) {
        const pageSelector = this.resolveStepPageSelector(step);
        console.debug(
          `[DAP] Linear: Step ${step.stepId} deferred \u2014 page selector "${pageSelector}" not found in current DOM`
        );
        this.deferStepUntilSelectorPresent(
          step,
          actualStepIndex,
          pageSelector,
          () => this.executeStepWithTrigger(step, actualStepIndex)
        );
        return;
      }
      if (!step.uxExperience && step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0 && step.userInputSelector) {
        this.setupInputSelectorMutationObserver(step);
        this.setupBlurEventHandler(step);
      }
      triggerManager.registerTriggerListeners(step.stepId, trigger, (context) => {
        if (this._state.executionMode === "Linear") {
          const currentStepIndex = this._state.activeStep;
          const actualStepIndex2 = stepIndex !== void 0 ? stepIndex : currentStepIndex;
          if (actualStepIndex2 !== currentStepIndex) {
            console.debug(`[DAP] Linear Execution Gate: Rejecting trigger for non-current step ${step.stepId} (index ${actualStepIndex2}, current ${currentStepIndex})`);
            return;
          }
          if (step.uxExperience && this._state.activeStepTriggered) {
            console.debug(`[DAP] Linear Execution Gate: UX step ${step.stepId} already triggered, ignoring duplicate trigger`);
            return;
          }
          if (!step.uxExperience && step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0) {
            const hasActiveDebouncedEvaluation = this._ruleEvaluationTimers.has(step.stepId);
            if (hasActiveDebouncedEvaluation) {
              console.debug(`[DAP] Rule-based step ${step.stepId} already has pending debounced evaluation, clearing previous timer`);
              this.clearRuleEvaluationTimers(step.stepId);
            }
            console.debug(`[DAP] Rule-based step ${step.stepId} re-trigger allowed with new input: "${context.userInput}"`);
          } else {
            this._state.activeStepTriggered = true;
          }
        }
        console.debug(`[DAP] TRIGGER ACTIVATED for step ${step.stepId}`);
        if (!this._state.runCounted && this._currentFlow) {
          this.incrementFlowRunCount(this._currentFlow);
          this._state.runCounted = true;
        }
        this.executeStepContent(step);
        if (!step.uxExperience && step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0) {
          console.debug(`[DAP] Step ${step.stepId} is rule-based - applying smart evaluation logic`);
          if (step.userInputSelector) {
            const inputEl = resolveSelectorWithPriority(step.userInputSelector);
            if (!inputEl) {
              console.error(`[DAP] \u{1F6A8} CRITICAL: Rule-based step ${step.stepId} input selector not found: ${step.userInputSelector}`);
              console.error(`[DAP] This indicates a cross-page navigation issue. Skipping rule evaluation.`);
              this.advanceToNextStep();
              return;
            }
          }
          const inputElement = step.userInputSelector ? resolveSelectorWithPriority(step.userInputSelector) : null;
          const inputType = inputElement ? this.getInputElementType(inputElement) : "unknown";
          console.debug(`[DAP] \u{1F50D} DETECTED INPUT TYPE: "${inputType}" for step ${step.stepId}`);
          if (["text", "email", "password", "textarea", "number", "search", "url", "tel"].includes(inputType)) {
            console.debug(`[DAP] \u{1F4DD} Text-based input detected - rules will evaluate ONLY on blur/focus-out events`);
            console.debug(`[DAP] \u{1F3AF} Input/change events are for trigger activation only`);
          } else {
            console.debug(`[DAP] \u{1F3AF} Non-text input detected (${inputType}) - rules evaluate on change events`);
            console.debug(`[DAP] \u{1F4CB} Input type supports immediate evaluation after user interaction`);
            console.debug(`[DAP] \u{1F504} Non-text input triggered - evaluating rules immediately`);
            this.evaluateStepRulesWithValue(step, context.userInput || "", "change");
            return;
          }
          console.debug(`[DAP] \u26A0\uFE0F Text input: Waiting for blur event for rule evaluation`);
        } else {
          this.postStepTransition(step);
        }
      }, flowContext, step.stepType);
    }
    /**
     * Set up trigger for a specific step (used in AnyOrder mode)
     */
    setupStepTrigger(step, stepIndex) {
      if (this._state.triggeredSteps.has(stepIndex)) {
        console.debug(`[DAP] setupStepTrigger: Step ${step.stepId} already completed \u2014 skipping`);
        return;
      }
      if (this._state.inProgressSteps.has(stepIndex)) {
        console.debug(`[DAP] setupStepTrigger: Step ${step.stepId} is already in-progress \u2014 skipping`);
        return;
      }
      const trigger = triggerManager.resolveTrigger(step);
      if (!trigger) {
        if (step.stepType === "Optional") {
          this._state.triggeredSteps.add(stepIndex);
        }
        return;
      }
      if (!this.isStepContextActive(step)) {
        const pageSelector = this.resolveStepPageSelector(step);
        console.debug(
          `[DAP] AnyOrder: Step ${step.stepId} deferred \u2014 page selector "${pageSelector}" not found in current DOM`
        );
        this.deferStepUntilSelectorPresent(
          step,
          stepIndex,
          pageSelector,
          () => this.setupStepTrigger(step, stepIndex)
        );
        return;
      }
      console.debug(
        `[DAP] AnyOrder: Step ${step.stepId} page context active \u2014 registering trigger`
      );
      const isRuleBasedStep = !step.uxExperience && step.conditionRuleBlocks != null && step.conditionRuleBlocks.length > 0;
      if (isRuleBasedStep) {
        if (step.userInputSelector) {
          this.setupInputSelectorMutationObserver(step);
        }
        this.setupBlurEventHandler(step);
      }
      const flowContext = {
        mode: this._state.executionMode,
        currentStepActive: true
        // In AnyOrder mode, all steps are considered "active"
      };
      triggerManager.registerTriggerListeners(step.stepId, trigger, (context) => {
        if (isRuleBasedStep) {
          if (!this._state.runCounted && this._currentFlow) {
            this.incrementFlowRunCount(this._currentFlow);
            this._state.runCounted = true;
          }
          const inputEl = step.userInputSelector ? resolveSelectorWithPriority(step.userInputSelector) : null;
          const inputType = inputEl ? this.getInputElementType(inputEl) : "unknown";
          console.debug(`[DAP] AnyOrder rule step ${step.stepId}: trigger fired, input type = "${inputType}"`);
          if (["text", "email", "password", "textarea", "number", "search", "url", "tel"].includes(inputType)) {
            console.debug(`[DAP] AnyOrder rule step ${step.stepId}: text input \u2014 waiting for blur to evaluate rules`);
          } else {
            console.debug(`[DAP] AnyOrder rule step ${step.stepId}: non-text input \u2014 evaluating rules on trigger`);
            this.evaluateStepRulesWithValue(step, context.userInput || "", "change");
          }
          return;
        }
        if (this._state.anyOrderStepInProgress) {
          const isOneShotTrigger = trigger.once || trigger.conditions.some((c) => c.kind === "Time" || c.kind === "Lifecycle");
          if (isOneShotTrigger) {
            this._pendingAnyOrderSteps.push({ step, stepIndex });
            console.debug(`[DAP] AnyOrder: queued one-shot step ${step.stepId} for replay after current step completes`);
          } else {
            console.debug(`[DAP] AnyOrder: trigger for step ${step.stepId} dropped \u2014 retriggerable on next interaction`);
          }
          return;
        }
        this._state.inProgressSteps.add(stepIndex);
        if (!this._state.runCounted && this._currentFlow) {
          this.incrementFlowRunCount(this._currentFlow);
          this._state.runCounted = true;
        }
        this._state.anyOrderStepInProgress = true;
        this.executeStepContent(step);
        this.postStepTransition(step);
      }, flowContext, step.stepType);
    }
    /**
     * Resolve the page-identity selector for a step — the single, most specific
     * token that uniquely identifies which SPA screen the step belongs to.
     *
     * Source priority:
     *   1. uxExperience.elementSelector  (the experience anchor element)
     *   2. trigger.conditions[].selector (the interaction trigger element)
     *
     * ⚠️  IMPORTANT — first token only
     * ────────────────────────────────
     * The server sends compound, pipe-separated selector strings that contain
     * both specific and generic fallback tokens, e.g.:
     *
     *   "xpath=//input[@placeholder='Search directory...']   ← specific (Screen A only)
     *    |xpath=//*[@id='root']//input                       ← generic  (matches ANY page!)
     *    |css=#root > div.dashboard-layout > ... > input     ← specific (Screen A only)
     *    |xpath=//*[@id='root']/div[1]/main[1]/..."          ← specific (Screen A only)
     *
     * If we pass the full compound string to the priority resolver it will try
     * all fallbacks, and the generic token "xpath=//*[@id='root']//input" will
     * match on EVERY page that contains an input — causing isStepContextActive()
     * to return true even when the user is on the wrong SPA screen.
     *
     * Using ONLY the first token (always the most specific: placeholder-based
     * XPath, unique CSS path, or data-attribute) gives us an accurate "am I on
     * Screen A?" signal without any false positives.
     *
     * Returns null for pure Lifecycle/Time steps that carry no DOM anchor at all.
     */
    resolveStepPageSelector(step) {
      const raw = step.uxExperience?.elementSelector?.trim() && step.uxExperience.elementSelector.trim() !== "NA" ? step.uxExperience.elementSelector.trim() : step.trigger?.conditions?.find(
        (c) => c.selector && c.selector.trim() !== "" && c.selector.trim() !== "NA"
      )?.selector?.trim() ?? null;
      if (!raw) return null;
      const firstToken = raw.split("|")[0].trim();
      return firstToken.length > 0 ? firstToken : null;
    }
    /**
     * Determines whether the correct SPA screen is currently visible for this step.
     *
     * SPA frameworks (React Router, Angular Router, Vue Router, …) swap content
     * in-place without a full-page reload.  A step that belongs to Screen B must
     * not activate while the user is still on Screen A.
     *
     * This method answers that question by verifying that the step's most
     * specific anchor element (the FIRST token from resolveStepPageSelector) is
     * actually present in the live DOM right now.
     *
     * Only the first, most specific selector token is checked — see
     * resolveStepPageSelector for why generic fallback tokens must be excluded.
     *
     * @returns true  — element found, or the step has no DOM anchor at all
     *                  (pure Lifecycle / Time triggers are always considered active).
     * @returns false — element absent; the user is on the wrong SPA screen and
     *                  trigger registration should be deferred.
     */
    isStepContextActive(step) {
      const pageSelector = this.resolveStepPageSelector(step);
      if (!pageSelector) return true;
      const el = resolveSelectorWithCache(step.stepId, pageSelector);
      if (el) {
        console.debug(`[DAP] Page context active for step "${step.stepId}" \u2014 element found via "${pageSelector}"`);
      }
      return el !== null;
    }
    /**
     * ✅ Fix #11 — Defer trigger registration until the step's page identity selector appears in
     * the DOM. Uses two complementary detection signals:
     *   1. MutationObserver  — covers same-URL SPA tab/panel swaps, MFE slot changes
     *   2. pageContextService.subscribe()  — covers URL-based SPA navigation and setScreen() calls
     */
    deferStepUntilSelectorPresent(step, stepIndex, pageSelector, onResolved) {
      let observer = null;
      let pageUnsub = null;
      let settled = false;
      const cleanup = () => {
        observer?.disconnect();
        observer = null;
        pageUnsub?.();
        pageUnsub = null;
      };
      const tryRegister = () => {
        if (settled) return;
        if (!this._state.flowInProgress || !this._currentFlow || this._state.triggeredSteps.has(stepIndex) || this._state.inProgressSteps.has(stepIndex)) {
          settled = true;
          cleanup();
          return;
        }
        const el = resolveSelectorWithCache(step.stepId, pageSelector);
        if (!el) return;
        settled = true;
        cleanup();
        console.debug(
          `[DAP] Deferred step ${step.stepId} \u2014 selector "${pageSelector}" now present, registering trigger`
        );
        if (onResolved) {
          onResolved();
        } else {
          this.setupStepTrigger(step, stepIndex);
        }
      };
      observer = new MutationObserver(() => tryRegister());
      observer.observe(document.body, { childList: true, subtree: true });
      pageUnsub = pageContextService.subscribe(() => {
        setTimeout(() => tryRegister(), 0);
      });
      const existingCleanup = this._stepTriggerListeners.get(`${step.stepId}_defer`);
      if (existingCleanup) existingCleanup();
      this._stepTriggerListeners.set(`${step.stepId}_defer`, () => {
        settled = true;
        cleanup();
      });
    }
    /**
     * Execute the actual step content (UX experience)
     */
    executeStepContent(step) {
      if (this._state.activeFlowId && !step.uxExperience) {
        trackStepView(this._state.activeFlowId, step.stepId);
      }
      if (step.uxExperience) {
        this.triggerUXExperience(step);
      } else {
        console.debug(`[DAP] Step ${step.stepId} is rule-based, waiting for conditions`);
      }
    }
    /**
     * Handle post-step transition (rules evaluation and flow control)
     */
    postStepTransition(step) {
      if (step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0 && !step.uxExperience) {
        console.debug(`[DAP] Step ${step.stepId} has rules but no UX - waiting for input trigger`);
        return;
      }
      if (step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0 && step.uxExperience) {
        const inputValue = this.getCurrentInputValue(step);
        this.evaluateStepRulesWithValue(step, inputValue, "change");
        return;
      }
      if (step.uxExperience && (!step.conditionRuleBlocks || step.conditionRuleBlocks.length === 0)) {
        return;
      }
      if (!step.uxExperience && (!step.conditionRuleBlocks || step.conditionRuleBlocks.length === 0)) {
        if (this._state.executionMode === "Linear") {
          this.advanceToNextStep();
        }
      }
    }
    /**
     * 🚨 SMART RULE EVALUATION: Determine if rules should evaluate based on input type and trigger source
     * Different input types have different optimal evaluation patterns
     */
    shouldEvaluateRulesForTriggerSource(step, triggerSource) {
      if (!step.userInputSelector) {
        console.debug(`[DAP] No input selector, allowing rule evaluation`);
        return true;
      }
      const inputElement = resolveSelectorWithPriority(step.userInputSelector);
      if (!inputElement) {
        console.warn(`[DAP] Input element not found for rule evaluation check: ${step.userInputSelector}`);
        return true;
      }
      const inputType = this.getInputElementType(inputElement);
      console.debug(`[DAP] \u{1F50D} SMART EVALUATION CHECK: Input type "${inputType}" with trigger "${triggerSource}"`);
      switch (inputType) {
        case "text":
        case "email":
        case "password":
        case "textarea":
        case "number":
        case "search":
        case "url":
        case "tel":
          console.debug(`[DAP] \u{1F4DD} Text-based input: Rules evaluate on blur/focus-out OR deliberate click`);
          return triggerSource === "blur" || triggerSource === "click" || triggerSource === "manual";
        case "select":
        case "select-one":
        case "select-multiple":
          console.debug(`[DAP] \u{1F4CB} Dropdown/Select input: Rules evaluate on change/blur events`);
          return triggerSource === "change" || triggerSource === "blur";
        case "checkbox":
        case "radio":
          console.debug(`[DAP] \u2611\uFE0F Checkbox/Radio input: Rules evaluate on change events`);
          return triggerSource === "change" || triggerSource === "blur";
        case "date":
        case "time":
        case "datetime-local":
        case "month":
        case "week":
          console.debug(`[DAP] \u{1F4C5} Date/Time input: Rules evaluate on change/blur events`);
          return triggerSource === "change" || triggerSource === "blur";
        case "range":
        case "color":
          console.debug(`[DAP] \u{1F3A8} Range/Color input: Rules evaluate on change events`);
          return triggerSource === "change" || triggerSource === "blur";
        default:
          console.warn(`[DAP] \u2753 Unknown input type "${inputType}": Defaulting to blur evaluation`);
          return triggerSource === "blur";
      }
    }
    /**
     * 🚨 HELPER: Determine the input element type for smart rule evaluation
     */
    getInputElementType(element) {
      const tagName = element.tagName.toLowerCase();
      if (tagName === "select") {
        const selectElement = element;
        return selectElement.multiple ? "select-multiple" : "select-one";
      }
      if (tagName === "textarea") {
        return "textarea";
      }
      if (tagName === "input") {
        const inputElement = element;
        return inputElement.type || "text";
      }
      console.warn(`[DAP] Unknown element type for rule evaluation: ${tagName}`);
      return "text";
    }
    /**
     * CRITICAL FIX 3: Input Stability Guard - Check if input value meets stability requirements
     * 🚨 ENHANCED: Prevents premature rule evaluation on single characters
     */
    isInputValueStable(stepId, inputValue) {
      console.debug(`[DAP] \u{1F50D} Input stability check for step ${stepId}: "${inputValue}" (length: ${inputValue.length})`);
      if (inputValue.length < this._inputStabilityMinLength) {
        console.debug(`[DAP] \u274C Input stability: Value too short (${inputValue.length} < ${this._inputStabilityMinLength}) - BLOCKING rule evaluation`);
        console.debug(`[DAP] \u{1F3AF} This prevents premature evaluation on single characters like "${inputValue}"`);
        return false;
      }
      if (inputValue.trim().length === 0) {
        console.debug(`[DAP] \u274C Input stability: Empty or whitespace-only value - BLOCKING rule evaluation`);
        return false;
      }
      const lastCheck = this._inputStabilityChecks.get(stepId);
      const now = Date.now();
      if (lastCheck) {
        const timeSinceLastChange = now - lastCheck.timestamp;
        const minStabilityTime = 200;
        if (timeSinceLastChange < minStabilityTime) {
          console.debug(`[DAP] \u274C Input stability: Too rapid changes (${timeSinceLastChange}ms < ${minStabilityTime}ms) - user still typing`);
          this._inputStabilityChecks.set(stepId, { value: inputValue, timestamp: now });
          return false;
        }
      }
      this._inputStabilityChecks.set(stepId, { value: inputValue, timestamp: now });
      this._lastInputValues.set(stepId, inputValue);
      console.debug(`[DAP] \u2705 Input stability: Value "${inputValue}" is stable and meaningful - ALLOWING rule evaluation`);
      return true;
    }
    /**
     * CRITICAL FIX: Setup DOM mutation observer to detect input selector changes
     * This handles cases where the DOM structure changes after initial trigger registration
     */
    setupInputSelectorMutationObserver(step) {
      if (!step.userInputSelector) return;
      console.debug(`[DAP] \u{1F50D} Setting up mutation observer for rule-based step ${step.stepId}, selector: ${step.userInputSelector}`);
      const existingObserver = this._domObservers.get(step.stepId);
      if (existingObserver) {
        existingObserver.disconnect();
      }
      const observer = new MutationObserver((mutations) => {
        let shouldReRegister = false;
        for (const mutation of mutations) {
          if (mutation.type === "childList") {
            const addedInputs = Array.from(mutation.addedNodes).filter((node) => node.nodeType === Node.ELEMENT_NODE).some((element) => {
              const el = element;
              return el.matches && el.matches("input") || el.querySelector && el.querySelector("input");
            });
            const removedInputs = Array.from(mutation.removedNodes).filter((node) => node.nodeType === Node.ELEMENT_NODE).some((element) => {
              const el = element;
              return el.matches && el.matches("input") || el.querySelector && el.querySelector("input");
            });
            if (addedInputs || removedInputs) {
              console.debug(`[DAP] \u{1F504} DOM mutation detected for step ${step.stepId}, input elements added/removed`);
              shouldReRegister = true;
              break;
            }
          }
        }
        if (shouldReRegister) {
          const foundEl = resolveSelectorWithPriority(step.userInputSelector);
          if (foundEl) {
            console.debug(`[DAP] \u2705 Input selector now available for step ${step.stepId}, re-registering triggers`);
            setTimeout(() => {
              this.reRegisterStepTriggers(step);
            }, 100);
          }
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false
        // We don't need attribute changes for this use case
      });
      this._domObservers.set(step.stepId, observer);
    }
    /**
     * CRITICAL FIX: Re-register triggers for a specific step when DOM changes
     */
    reRegisterStepTriggers(step) {
      console.debug(`[DAP] \u{1F504} Re-registering triggers for step ${step.stepId} due to DOM changes`);
      if (!this._currentFlow || this._state.activeStep >= this._currentFlow.steps.length) {
        return;
      }
      const currentStep = this._currentFlow.steps[this._state.activeStep];
      if (currentStep.stepId !== step.stepId) {
        console.debug(`[DAP] Step ${step.stepId} is no longer the active step, skipping re-registration`);
        return;
      }
      this._state.activeStepTriggered = false;
      this.clearRuleEvaluationTimers(step.stepId);
      this.clearInputStabilityTimers(step.stepId);
      this.executeStepWithTrigger(step, this._state.activeStep);
    }
    /**
     * CRITICAL FIX: Setup blur event handler for rule evaluation on focus out
     * 🚨 ENHANCED: This is the PRIMARY method for rule evaluation in rule-based steps
     * Rules evaluate ONLY when user finishes input and moves focus away
     */
    setupBlurEventHandler(step) {
      if (!step.userInputSelector) return;
      console.debug(`[DAP] \u{1F3AF} Setting up PRIMARY blur event handler for rule-based step ${step.stepId}`);
      console.debug(`[DAP] \u{1F4CB} Rules will evaluate ONLY on blur/focus-out events, not during typing`);
      const cancelWait = this.waitForInputElement(step.userInputSelector, (inputElement) => {
        console.debug(`[DAP] \u2705 Input element found for blur handler, setting up listener`);
        const blurHandler = () => {
          console.debug(`[DAP] \uFFFD PRIMARY BLUR EVENT - User finished input and moved focus away from step ${step.stepId}`);
          const currentValue = inputElement.value;
          console.debug(`[DAP] \u{1F3AF} BLUR EVALUATION: Input value for rule evaluation: "${currentValue}"`);
          console.debug(`[DAP] \u{1F50D} BLUR EVENT STATE CHECK:`);
          console.debug(`[DAP] - Current flow exists: ${!!this._currentFlow}`);
          console.debug(`[DAP] - Active step index: ${this._state.activeStep}`);
          console.debug(`[DAP] - Total steps: ${this._currentFlow?.steps?.length || 0}`);
          console.debug(`[DAP] - Step being checked: ${step.stepId}`);
          if (!this._currentFlow) {
            console.debug(`[DAP] \u274C No active flow, ignoring blur event`);
            return;
          }
          const stepExists = this._currentFlow.steps.some((s) => s.stepId === step.stepId);
          if (!stepExists) {
            console.debug(`[DAP] \u274C Step ${step.stepId} not found in current flow, ignoring blur event`);
            return;
          }
          const stepIndex = this._currentFlow.steps.findIndex((s) => s.stepId === step.stepId);
          if (stepIndex === -1) {
            console.debug(`[DAP] \u274C Could not find step index for ${step.stepId}, ignoring blur event`);
            return;
          }
          if (this._state.executionMode === "Linear") {
            const isCurrentOrRecentStep = stepIndex === this._state.activeStep;
            if (!isCurrentOrRecentStep) {
              console.debug(`[DAP] \u274C Step ${step.stepId} is no longer the active step (${stepIndex} vs ${this._state.activeStep}), ignoring blur event`);
              return;
            }
          } else {
            if (this._state.triggeredSteps.has(stepIndex)) {
              console.debug(`[DAP] \u274C AnyOrder step ${step.stepId} already triggered, ignoring blur event`);
              return;
            }
          }
          console.debug(`[DAP] \u2705 Step validation passed - proceeding with rule evaluation`);
          this._currentFlow.steps[stepIndex];
          this.clearRuleEvaluationTimers(step.stepId);
          console.debug(`[DAP] \u{1F3AF} EXECUTING PRIMARY RULE EVALUATION on blur for step ${step.stepId}`);
          console.debug(`[DAP] \u{1F4A1} User has finished typing and moved focus - perfect time for rule evaluation`);
          this.evaluateStepRulesWithValue(step, currentValue, "blur");
        };
        inputElement.addEventListener("blur", blurHandler);
        const existingCleanup = this._stepTriggerListeners.get(`${step.stepId}_blur`);
        if (existingCleanup) {
          existingCleanup();
        }
        this._stepTriggerListeners.set(`${step.stepId}_blur`, () => {
          inputElement.removeEventListener("blur", blurHandler);
          console.debug(`[DAP] Cleaned up blur event listener for step ${step.stepId}`);
        });
        console.debug(`[DAP] \u2705 Blur event handler registered for step ${step.stepId}`);
      });
      const existingWaitCancel = this._stepTriggerListeners.get(`${step.stepId}_waitCancel`);
      if (existingWaitCancel) existingWaitCancel();
      this._stepTriggerListeners.set(`${step.stepId}_waitCancel`, cancelWait);
    }
    /**
     * CRITICAL FIX: Wait for input element to be available (handles both CSS and XPath).
     * Returns a cancel function — call it to stop retrying (e.g. when the flow is aborted).
     * Retries stop automatically after 30 s (300 × 100 ms) to prevent infinite loops (Bug H fix).
     */
    waitForInputElement(selector, callback) {
      let cancelled = false;
      let attempts = 0;
      const MAX_ATTEMPTS = 300;
      const checkElement = () => {
        if (cancelled) return;
        if (attempts >= MAX_ATTEMPTS) {
          console.warn(`[DAP] waitForInputElement: gave up waiting for "${selector}" after 30 s`);
          return;
        }
        attempts++;
        const el = resolveSelectorWithPriority(selector);
        if (el) {
          console.debug(`[DAP] \u2705 Input element found: ${selector}`);
          callback(el);
        } else {
          setTimeout(checkElement, 100);
        }
      };
      checkElement();
      return () => {
        cancelled = true;
      };
    }
    /**
     * Get current input value for a step using CSS or XPath selector
     */
    getCurrentInputValue(step) {
      if (!step.userInputSelector) return "";
      const inputElement = resolveSelectorWithPriority(step.userInputSelector);
      return inputElement ? inputElement.value : "";
    }
    /**
     * Evaluate step rules with a specific input value (enhanced with better error handling)
     * 🚨 CRITICAL: Smart rule evaluation based on input type and interaction pattern
     * - Text inputs: Rules evaluate ONLY on blur events (when user finishes typing)
     * - Dropdowns/Select: Rules evaluate on change events (immediate after selection)
     * - Checkboxes/Radio: Rules evaluate on change events (immediate after click)
     * Enhanced with CRITICAL FIX 5 & 6: Fallback Logic and Mandatory Step Enforcement
     */
    evaluateStepRulesWithValue(step, inputValue, triggerSource) {
      const source = triggerSource || "unknown";
      const shouldEvaluateRules = this.shouldEvaluateRulesForTriggerSource(step, source);
      if (!shouldEvaluateRules) {
        console.warn(`[DAP] \u{1F6A8} RULE EVALUATION BLOCKED: Input type requires different evaluation trigger`);
        console.warn(`[DAP] \u{1F3AF} Trigger source "${source}" not appropriate for this input type`);
        return;
      }
      if (source === "blur" && !this.isInputValueStable(step.stepId, inputValue)) {
        console.debug(`[DAP] \u23F3 Input not yet stable for step ${step.stepId} \u2014 deferring rule evaluation`);
        return;
      }
      console.debug(`[DAP] ========== RULE EVALUATION START: Step ${step.stepId} (${source.toUpperCase()} TRIGGER) ==========`);
      console.debug(`[DAP] \u2705 SMART EVALUATION: Trigger source "${source}" is appropriate for this input type`);
      let finalInputValue = inputValue;
      if ((!finalInputValue || finalInputValue === "") && step.userInputSelector) {
        const primaryInput = resolveSelectorWithPriority(step.userInputSelector);
        if (primaryInput) {
          finalInputValue = primaryInput.value !== void 0 ? primaryInput.value : primaryInput.textContent || "";
          console.debug(`[DAP] \u{1F4A1} Trigger provided no value, resolved from primary input "${step.userInputSelector}": "${finalInputValue}"`);
        } else {
          console.warn(`[DAP] \u26A0\uFE0F Primary input selector not found for rule evaluation: ${step.userInputSelector}`);
        }
      }
      console.debug(`[DAP] Input value for evaluation: "${finalInputValue}"`);
      console.debug(`[DAP] Rule blocks: ${step.conditionRuleBlocks?.length || 0}`);
      if (!step.conditionRuleBlocks || step.conditionRuleBlocks.length === 0) {
        console.debug(`[DAP] No rule blocks found, advancing to next step`);
        this.advanceToNextStep();
        return;
      }
      console.debug(`[DAP] \u{1F4C4} Rule evaluation page context check for step: ${step.stepId}`);
      for (let i = 0; i < step.conditionRuleBlocks.length; i++) {
        const ruleBlock = step.conditionRuleBlocks[i];
        if (ruleBlock.selector) {
          const rbEl = resolveSelectorWithPriority(ruleBlock.selector);
          if (!rbEl) {
            console.warn(`[DAP] \u26A0\uFE0F Rule block ${i} selector not yet in DOM: ${ruleBlock.selector}`);
          }
        }
      }
      try {
        let ruleMatched = false;
        let matchedRuleBlock = null;
        for (const ruleBlock of step.conditionRuleBlocks) {
          console.debug(`[DAP] Evaluating rule block with input: "${finalInputValue}"`);
          let evaluationValue = finalInputValue;
          if (ruleBlock.selector) {
            const element = resolveSelectorWithPriority(ruleBlock.selector);
            if (element) {
              evaluationValue = element.value !== void 0 ? element.value : element.textContent || "";
              console.debug(`[DAP] Rule block uses selector ${ruleBlock.selector}, resolved value: "${evaluationValue}"`);
            } else {
              console.warn(`[DAP] Rule block selector ${ruleBlock.selector} not found, falling back to input value: "${finalInputValue}"`);
            }
          }
          const ruleResult = evaluateRuleBlock(ruleBlock, evaluationValue);
          console.debug(`[DAP] Rule block result for "${evaluationValue}": ${ruleResult}`);
          if (ruleResult) {
            console.debug(`[DAP] \u2705 Rule matched for step ${step.stepId}, handling branching`);
            ruleMatched = true;
            matchedRuleBlock = ruleBlock;
            break;
          }
        }
        if (ruleMatched && matchedRuleBlock) {
          if (step.stepType === "Mandatory" && this._state.executionMode === "Linear") {
            console.debug(`[DAP] \u2705 MANDATORY STEP COMPLETED: ${step.stepId}`);
            this.trackMandatoryStepCompletion(step);
          }
          console.debug(`[DAP] \u{1F3AF} Rule matched on ${source} trigger - executing branching logic`);
          this.handleRuleBranching(matchedRuleBlock, step);
        } else {
          console.debug(`[DAP] \u274C No rules matched for step ${step.stepId} on ${source} trigger`);
          this.handleNoRuleMatch(step, finalInputValue);
        }
      } catch (error) {
        console.error(`[DAP] Error evaluating rules for step ${step.stepId}:`, error);
        this.handleRuleEvaluationFailure(step, "evaluation_error", error);
      }
      console.debug(`[DAP] ========== RULE EVALUATION END: Step ${step.stepId} (${source.toUpperCase()} TRIGGER) ==========`);
    }
    /**
     * CRITICAL FIX 5: Handle rule evaluation failures with proper fallback logic
     * Updated to advance by default unless explicitly configured otherwise
     */
    handleRuleEvaluationFailure(step, reason, error) {
      console.warn(`[DAP] \u{1F6A8} FALLBACK LOGIC: Rule evaluation failed for step ${step.stepId}, reason: ${reason}`);
      console.debug(`[DAP] Step type: ${step.stepType || "Not specified"}`);
      const shouldBlockOnFailure = step.blockOnRuleFailure === true;
      if (shouldBlockOnFailure) {
        console.warn(`[DAP] \u26A0\uFE0F BLOCKING STEP: ${step.stepId} configured to block on rule failures`);
        console.warn(`[DAP] Staying on current step and waiting for valid input`);
        this._state.activeStepTriggered = false;
        this.clearRuleEvaluationTimers(step.stepId);
        this.clearInputStabilityTimers(step.stepId);
        return;
      } else {
        if (this._state.executionMode === "AnyOrder") {
          console.debug(`[DAP] AnyOrder: rule evaluation failure for step ${step.stepId} (${reason}) \u2014 keeping step active for retry`);
          return;
        }
        console.warn(`[DAP] \u2705 ADVANCING: Step ${step.stepId} (type: ${step.stepType || "default"}) failed ${reason}, moving to next step`);
        console.debug(`[DAP] \u{1F3AF} This is the default behavior as requested: "move to next step in the current flow"`);
        this.advanceToNextStepWithRuleCheck();
      }
    }
    /**
     * CRITICAL FIX 5: Handle case where no rules match the input
     * Updated to advance by default unless explicitly configured otherwise
     */
    handleNoRuleMatch(step, inputValue) {
      console.debug(`[DAP] \u{1F504} FALLBACK LOGIC: No rule matched for input "${inputValue}" in step ${step.stepId}`);
      console.debug(`[DAP] Step type: ${step.stepType || "Not specified"}`);
      const shouldBlockOnNoMatch = step.blockOnNoRuleMatch === true;
      if (shouldBlockOnNoMatch) {
        console.debug(`[DAP] \u26A0\uFE0F BLOCKING STEP: ${step.stepId} configured to block when no rules match, staying on current step`);
        this._state.activeStepTriggered = false;
        console.debug(`[DAP] User must provide input that matches one of the defined rules`);
        return;
      } else {
        if (this._state.executionMode === "AnyOrder") {
          console.debug(`[DAP] AnyOrder: no rule matched for step ${step.stepId} with input "${inputValue}" \u2014 step stays active for re-evaluation`);
          return;
        }
        console.debug(`[DAP] \u2705 ADVANCING: Step ${step.stepId} (type: ${step.stepType || "default"}) - moving to next step when no rules match`);
        console.debug(`[DAP] \u{1F3AF} This is the default behavior as requested: "move to next step in the current flow"`);
        this.advanceToNextStepWithRuleCheck();
      }
    }
    /**
     * CRITICAL FIX 6: Track mandatory step completion for flow validation
     */
    trackMandatoryStepCompletion(step) {
      this._completedMandatorySteps.add(step.stepId);
      console.debug(`[DAP] \u{1F4CB} Mandatory step completed: ${step.stepId} (${this._completedMandatorySteps.size} mandatory step(s) done this flow)`);
    }
    /**
     * Handle rule-based branching based on BranchType
     * 🚨 CRITICAL FIX: Proper completion tracking for rule-based branching
     */
    handleRuleBranching(ruleBlock, step) {
      console.debug(`[DAP] Handling rule-based branching for block:`, ruleBlock);
      const branchType = ruleBlock.branchType;
      switch (branchType) {
        case "Flow": {
          const nextFlowId = ruleBlock.nextFlowId;
          if (nextFlowId) {
            console.debug(`[DAP] \u{1F3AF} RULE MATCHED - Branching to new flow: ${nextFlowId}`);
            if (this._currentFlow && this._state.activeStep < this._currentFlow.steps.length) {
              const currentStep = this._currentFlow.steps[this._state.activeStep];
              console.debug(`[DAP] \u2705 STEP COMPLETED: ${currentStep.stepId} (Mandatory step completed via rule branching)`);
              if (this._state.activeFlowId) {
                console.debug(`[DAP] \u{1F4CB} Tracking completion for mandatory rule-based step ${currentStep.stepId}`);
              }
            }
            console.debug(`[DAP] \u2705 FLOW COMPLETED: ${this._currentFlow?.flowId} (Terminated by rule branching)`);
            this.markFlowAsCompletedByBranching(this._currentFlow);
            this.terminateCurrentFlowAfterCompletion();
            this.startNewFlow(nextFlowId);
          } else {
            console.warn(`[DAP] Flow branch type specified but no nextFlowId found`);
            this.continueToNextStep();
          }
          break;
        }
        case "Step": {
          const targetStepId = ruleBlock.stepId;
          if (this._state.executionMode === "AnyOrder") {
            console.debug(`[DAP] AnyOrder: rule Step-branch \u2014 marking rule step complete`);
            if (step) this.onStepComplete(step);
          } else if (targetStepId) {
            console.debug(`[DAP] Jumping to step: ${targetStepId}`);
            this.jumpToStep(targetStepId);
          } else {
            console.warn(`[DAP] Step branch type specified but no stepId found`);
            this.continueToNextStep();
          }
          break;
        }
        case "Continue":
        default:
          if (this._state.executionMode === "AnyOrder") {
            console.debug(`[DAP] AnyOrder: rule Continue-branch \u2014 marking rule step complete`);
            if (step) this.onStepComplete(step);
          } else {
            console.debug(`[DAP] Continuing to next step`);
            this.continueToNextStep();
          }
          break;
      }
    }
    /**
     * 🚨 CRITICAL FIX: Mark flow as completed specifically when branching occurs
     * This ensures proper tracking for rule-based flow transitions
     */
    markFlowAsCompletedByBranching(flowData) {
      const flowId = flowData.flowId;
      console.debug(`[DAP] \u{1F3AF} RULE BRANCHING: Marking flow ${flowId} as completed via rule branching`);
      const previewMode = detectPreviewMode();
      if (previewMode.isPreviewMode) {
        console.debug(`[DAP] \u{1F7E2} PREVIEW MODE: Bypassing branching completion tracking for flow ${flowId}`);
        return;
      }
      const flowCompletedKey = `dap_flow_completed_${flowId}`;
      const completionTimestamp = Date.now();
      const completionReason = "rule_branching";
      try {
        const completionData = JSON.stringify({
          timestamp: completionTimestamp,
          reason: completionReason,
          flowType: flowData.execution?.frequency?.type || "unknown"
        });
        localStorage.setItem(flowCompletedKey, completionData);
        console.debug(`[DAP] \u2705 RULE BRANCHING: Flow ${flowId} completed via rule branching at ${new Date(completionTimestamp).toISOString()}`);
        console.debug(`[DAP] \u{1F3AF} Flow completion tracked - this satisfies the requirement: "OR a rule-based step branches to a new flow"`);
      } catch (error) {
        console.error(`[DAP] Failed to mark branching completion for flow ${flowId}:`, error);
      }
    }
    /**
     * 🚨 CRITICAL FIX: Terminate flow after proper completion tracking
     * This ensures flow state is cleaned up AFTER completion is recorded
     */
    terminateCurrentFlowAfterCompletion() {
      console.debug(`[DAP] \u{1F3AF} TERMINATING FLOW: Current flow completion tracking finished, now cleaning up state`);
      const flowId = this._state.activeFlowId;
      const endCb = this._onFlowEnd;
      this._onFlowEnd = null;
      endCb?.(flowId, "branched");
      if (this._currentFlow) {
        console.debug(`[DAP] \u{1F4E2} Broadcasting flow completion event for tracking system`);
        resetFlowTracking(this._currentFlow.flowId);
      }
      this.resetFlowState();
    }
    /**
     * Reset flow state to initial values
     */
    resetFlowState() {
      this.cleanupCurrentStep();
      if (this._state.activeFlowId) {
        triggerManager.resetOnceTriggersForFlow(this._state.activeFlowId);
      }
      this._state = {
        activeFlowId: null,
        flowInProgress: false,
        activeStep: 0,
        activeStepTriggered: false,
        executionState: "TERMINATED",
        executionMode: "Linear",
        triggeredSteps: /* @__PURE__ */ new Set(),
        anyOrderStepInProgress: false,
        inProgressSteps: /* @__PURE__ */ new Set()
      };
      this._currentFlow = null;
      this._completedMandatorySteps.clear();
    }
    /**
     * Normalize raw server flow JSON to the internal FlowData format.
     * Mirrors the normalizeRawFlowData helper in index.ts so that rule-branched
     * flows and transitioned flows receive the same normalization as queued flows.
     */
    _normalizeRawFlowData(rawFlowData, flowId) {
      const steps = (Array.isArray(rawFlowData.steps) ? rawFlowData.steps : null) || (Array.isArray(rawFlowData.actions) ? rawFlowData.actions : null) || (Array.isArray(rawFlowData.actionGroups) ? rawFlowData.actionGroups : null) || [];
      const frequency = rawFlowData.execution?.frequency || rawFlowData.frequency || {
        type: rawFlowData.frequencyType || "Always",
        maxRuns: rawFlowData.maxRuns || 0
      };
      return {
        flowId: rawFlowData.flowId || rawFlowData.id || flowId,
        flowName: rawFlowData.flowName || rawFlowData.name || flowId,
        steps,
        execution: {
          mode: rawFlowData.execution?.mode || rawFlowData.executionMode || "Linear",
          multiPage: rawFlowData.execution?.multiPage !== void 0 ? rawFlowData.execution.multiPage : !!rawFlowData.isMultiPage,
          frequency
        }
      };
    }
    /**
     * Start a new flow by ID
     */
    startNewFlow(flowId) {
      console.debug(`[DAP] Starting new flow: ${flowId}`);
      (async () => {
        try {
          const { fetchFlowById: fetchFlowById2 } = await Promise.resolve().then(() => (init_flows(), flows_exports));
          const config = window.__DAP_CONFIG__;
          if (!config) {
            console.error(`[DAP] No config available to start flow: ${flowId}`);
            window.dispatchEvent(new CustomEvent("dap:startFlow", { detail: { flowId } }));
            return;
          }
          const previewMode = detectPreviewMode();
          const previewSessionId = previewMode.isPreviewMode ? previewMode.previewSessionId : void 0;
          const rawData = await fetchFlowById2(config, location.origin, flowId, previewSessionId);
          const flowData = this._normalizeRawFlowData(rawData, flowId);
          await this.startFlow(flowData);
        } catch (error) {
          console.error(`[DAP] Error starting flow ${flowId}:`, error);
          window.dispatchEvent(new CustomEvent("dap:startFlow", { detail: { flowId } }));
        }
      })();
    }
    /**
     * Jump to a specific step within current flow
     */
    jumpToStep(stepId) {
      console.debug(`[DAP] Jumping to step: ${stepId}`);
      if (!this._currentFlow) {
        console.error(`[DAP] Cannot jump to step: no active flow`);
        return;
      }
      const targetStepIndex = this._currentFlow.steps.findIndex((step) => step.stepId === stepId);
      if (targetStepIndex === -1) {
        console.error(`[DAP] Step not found: ${stepId}`);
        this.continueToNextStep();
        return;
      }
      this.cleanupCurrentStep();
      this._state.activeStep = targetStepIndex;
      this._state.activeStepTriggered = false;
      const targetStep = this._currentFlow.steps[targetStepIndex];
      this.executeStepWithTrigger(targetStep, targetStepIndex);
    }
    /**
     * Continue to next step in sequence
     */
    continueToNextStep() {
      this.advanceToNextStep();
    }
    /**
     * Check if AnyOrder flow is complete
     */
    checkFlowCompletion() {
      if (!this._currentFlow || this._state.executionMode !== "AnyOrder") return;
      const totalSteps = this._currentFlow.steps.length;
      const mandatorySteps = this._currentFlow.steps.filter(
        (step) => step.stepType === "Mandatory"
      );
      if (mandatorySteps.length === 0) {
        console.debug(`[DAP] Flow completion check: no mandatory steps \u2014 requiring all ${totalSteps} steps to complete`);
        if (this._state.triggeredSteps.size === totalSteps) {
          console.debug(`[DAP] All optional steps completed, flow complete`);
          this.completeFlow();
        }
        return;
      }
      const triggeredMandatory = this._currentFlow.steps.filter(
        (step, index) => step.stepType === "Mandatory" && this._state.triggeredSteps.has(index)
      );
      console.debug(`[DAP] Flow completion check: ${triggeredMandatory.length}/${mandatorySteps.length} mandatory steps completed`);
      if (triggeredMandatory.length === mandatorySteps.length) {
        console.debug(`[DAP] All mandatory steps completed, flow complete`);
        this.completeFlow();
      }
    }
    /**
     * Trigger UX experience rendering
     */
    triggerUXExperience(step) {
      if (this._currentFlow) {
        trackStepView(this._currentFlow.flowId, step.stepId).catch((error) => {
          console.debug(`[DAP] Step tracking failed: ${error.message}`);
        });
      }
      const ux = step.uxExperience;
      const rawTargetSelector = ux.elementSelector && ux.elementSelector !== "NA" ? ux.elementSelector : step.trigger?.conditions?.find((c) => c.selector)?.selector;
      let resolvedTargetSelector = rawTargetSelector;
      if (rawTargetSelector) {
        const targetEl = resolveSelectorWithCache(step.stepId, rawTargetSelector);
        if (targetEl) {
          resolvedTargetSelector = rawTargetSelector;
          console.debug(`[DAP] Target element resolved for step ${step.stepId}: "${rawTargetSelector}"`);
        } else {
          console.debug(`[DAP] Target element not found for step ${step.stepId} (selector: "${rawTargetSelector}") \u2014 renderer will attempt its own lookup`);
        }
      } else {
        console.debug(`[DAP] No target selector for step ${step.stepId} \u2014 experience will render without a DOM anchor`);
      }
      Promise.resolve().then(() => (init_registry(), registry_exports)).then(({ getRenderer: getRenderer2 }) => {
        const experienceType = ux.uxExperienceType.toLowerCase();
        const rendererType = experienceType === "microsurvey" ? "survey" : experienceType;
        const renderer = getRenderer2(rendererType);
        if (!renderer) {
          console.error(`[DAP] No renderer found for: ${ux.uxExperienceType}`);
          this.advanceToNextStep();
          return;
        }
        let payload;
        if (experienceType === "modal") {
          let bodyContent = [];
          if (ux.modalContent) {
            const modalContent = ux.modalContent;
            const contentType = modalContent.contentType?.toLowerCase();
            switch (contentType) {
              case "text":
                bodyContent.push({
                  kind: "text",
                  html: modalContent.contentData || modalContent.presignedUrl || ""
                });
                break;
              case "link":
                bodyContent.push({
                  kind: "link",
                  href: modalContent.contentData || modalContent.presignedUrl || "",
                  label: modalContent.contentName || "Link"
                });
                break;
              case "image":
                bodyContent.push({
                  kind: "image",
                  url: modalContent.presignedUrl || modalContent.contentData || "",
                  alt: modalContent.contentDescription || modalContent.contentName || "Image"
                });
                break;
              case "video":
                bodyContent.push({
                  kind: "video",
                  sources: [{ src: modalContent.presignedUrl || modalContent.contentData || "" }]
                });
                break;
              case "youtube":
                bodyContent.push({
                  kind: "youtube",
                  href: modalContent.contentData || modalContent.presignedUrl || "",
                  title: modalContent.contentName,
                  thumbnail: modalContent.contentDescription
                });
                break;
              case "article":
                bodyContent.push({
                  kind: "article",
                  url: modalContent.presignedUrl || "",
                  fileName: modalContent.contentData || modalContent.contentName || "document",
                  title: modalContent.contentDescription || modalContent.contentName,
                  mime: modalContent.mime || "application/pdf"
                });
                break;
              case "knowledgebase":
                try {
                  const raw = Array.isArray(modalContent.contentData) ? modalContent.contentData : [];
                  const items = raw.map((it) => ({
                    url: it?.presignedUrl || it?.contentData || "",
                    title: it?.contentName || it?.contentTitle || "",
                    description: it?.contentDescription || it?.description || "",
                    fileName: it?.contentData || void 0
                  })).filter((i) => i.url && i.title);
                  bodyContent.push({
                    kind: "kb",
                    title: modalContent.contentName || ux.content?.header || "Knowledge Base",
                    items
                  });
                } catch (e) {
                  console.warn("[DAP] Failed to normalize KnowledgeBase modalContent:", e, modalContent);
                  bodyContent.push({
                    kind: "text",
                    html: modalContent.contentData || modalContent.contentDescription || ux.content?.body || ""
                  });
                }
                break;
              default:
                bodyContent.push({
                  kind: "text",
                  html: modalContent.contentData || modalContent.contentDescription || ux.content?.body || ""
                });
            }
          } else if (ux.content?.body) {
            bodyContent.push({
              kind: "text",
              html: ux.content.body
            });
          }
          payload = {
            title: ux.content?.header,
            body: bodyContent,
            footerText: ux.content?.footer,
            theme: {},
            _completionTracker: {
              onComplete: () => {
                this.onStepComplete(step);
              }
            }
          };
        } else if (experienceType === "tooltip") {
          const tooltipConditionEvent = step.trigger?.conditions?.[0]?.event;
          const tooltipTrigger = tooltipConditionEvent === "mouseover" || tooltipConditionEvent === "mouseenter" ? "hover" : tooltipConditionEvent === "load" ? "pageload" : tooltipConditionEvent || "hover";
          payload = {
            targetSelector: resolvedTargetSelector,
            text: ux.content?.text || ux.content?.body || "Tooltip",
            placement: (ux.content?.placement || "auto").toLowerCase(),
            trigger: tooltipTrigger,
            stepId: step.stepId,
            _completionTracker: {
              onComplete: () => {
                this.onStepComplete(step);
              }
            }
          };
        } else if (experienceType === "popover") {
          const popoverConditionEvent = step.trigger?.conditions?.[0]?.event;
          const popoverTrigger = ux.content?.trigger || (popoverConditionEvent === "mouseover" || popoverConditionEvent === "mouseenter" ? "hover" : popoverConditionEvent === "load" ? "pageload" : popoverConditionEvent || "click");
          payload = {
            targetSelector: resolvedTargetSelector,
            title: ux.content?.title || ux.content?.header,
            body: ux.content?.body,
            placement: ux.content?.placement || "auto",
            trigger: popoverTrigger,
            showArrow: ux.content?.showArrow !== false,
            stepId: step.stepId,
            _completionTracker: {
              onComplete: () => {
                this.onStepComplete(step);
              }
            }
          };
        } else if (experienceType === "survey") {
          const config = window.__DAP_CONFIG__;
          payload = {
            targetSelector: resolvedTargetSelector,
            questions: ux.content?.questions || [],
            header: ux.content?.header,
            body: ux.content?.body,
            questionId: ux.content?.questionId,
            flowId: this._state.activeFlowId,
            organizationId: config?.organizationid || config?.organizationId,
            siteId: config?.siteid || config?.siteId || config?.siteCollectionId,
            stepId: step.stepId,
            _completionTracker: {
              onComplete: () => {
                this.onStepComplete(step);
              }
            }
          };
        } else if (experienceType === "beacon") {
          let positionString = "top-right";
          if (ux.position) {
            const { x, y } = ux.position;
            if (x === "center" && y === "center") {
              positionString = "center";
            } else if (y === "top" && x === "left") {
              positionString = "top-left";
            } else if (y === "top" && x === "right") {
              positionString = "top-right";
            } else if (y === "bottom" && x === "left") {
              positionString = "bottom-left";
            } else if (y === "bottom" && x === "right") {
              positionString = "bottom-right";
            }
          }
          payload = {
            title: ux.content?.title || ux.content?.header,
            body: ux.content?.body || ux.content?.tooltipText,
            icon: ux.content?.icon,
            position: positionString,
            autoDismiss: ux.content?.autoDismiss,
            action: ux.content?.action,
            // targetSelector is resolved via resolvedTargetSelector above:
            // ux.elementSelector (if valid) → trigger.conditions[].selector → undefined
            targetSelector: resolvedTargetSelector,
            trigger: (() => {
              const e = step.trigger?.conditions?.[0]?.event;
              return e === "mouseover" || e === "mouseenter" ? "hover" : e === "load" ? "pageload" : e || "click";
            })(),
            beaconStyles: {
              enabled: true,
              color1: ux.content?.color || "#f59e0b",
              color2: ux.content?.color2 || ux.content?.color || "#eab308",
              duration: ux.content?.blinkRateMs ? `${ux.content.blinkRateMs / 1e3}s` : "2s",
              ...ux.content?.beaconStyles
            },
            stepId: step.stepId,
            _completionTracker: {
              onComplete: () => {
                this.onStepComplete(step);
              }
            }
          };
        } else if (experienceType === "microsurvey") {
          const hasMultipleQuestions = ux.content?.questions && ux.content.questions.length > 1;
          const hasComplexQuestions = ux.content?.questions?.some(
            (q) => ["OpinionScaleChoice", "NpsScale", "NpsOptions", "StarChoice"].includes(q.type)
          );
          const shouldUseModal = hasMultipleQuestions || hasComplexQuestions;
          console.debug(`[DAP] MicroSurvey mode detection:`, {
            questionsCount: ux.content?.questions?.length || 0,
            hasMultipleQuestions,
            hasComplexQuestions,
            shouldUseModal,
            finalMode: shouldUseModal ? "modal" : "inline"
          });
          payload = {
            // Include both single question fields (for simple micro surveys)
            question: ux.content?.question || ux.content?.title || ux.content?.header,
            type: ux.content?.type || "choice",
            options: ux.content?.options,
            placeholder: ux.content?.placeholder,
            submitText: ux.content?.submitText,
            cancelText: ux.content?.cancelText,
            rating: ux.content?.rating,
            questionId: ux.content?.questionId,
            // Include full survey fields (for complex surveys)
            header: ux.content?.header,
            body: ux.content?.body,
            questions: ux.content?.questions,
            // Positioning and behavior
            targetSelector: resolvedTargetSelector,
            position: ux.content?.position || "center",
            mode: shouldUseModal ? "modal" : "inline",
            // Smart mode detection
            // Survey submission fields
            flowId: this._state.activeFlowId,
            organizationId: window.__DAP_CONFIG__?.organizationid || window.__DAP_CONFIG__?.organizationId,
            siteId: window.__DAP_CONFIG__?.siteid || window.__DAP_CONFIG__?.siteId || window.__DAP_CONFIG__?.siteCollectionId,
            stepId: step.stepId,
            _completionTracker: {
              onComplete: () => {
                this.onStepComplete(step);
              }
            }
          };
        } else if (experienceType === "alert" || experienceType === "banner") {
          payload = {
            message: ux.content?.body || ux.content?.message || ux.content?.text || ux.content?.header || "Alert",
            variant: ux.content?.variant || ux.content?.type || ux.content?.level?.toLowerCase() || "info",
            position: ux.content?.position || "top",
            dismissible: ux.content?.dismissible !== false,
            autoHide: ux.content?.autoDismiss || ux.content?.autoHide,
            actions: ux.content?.actions || [],
            theme: ux.content?.theme || {},
            stepId: step.stepId,
            _completionTracker: {
              onComplete: () => {
                this.onStepComplete(step);
              }
            }
          };
        } else {
          payload = {
            steps: [{
              stepId: step.stepId,
              kind: experienceType,
              [experienceType]: {
                ...ux.content,
                stepId: step.stepId
              },
              title: ux.content?.header || ux.content?.title || "Info",
              elementSelector: ux.elementSelector
            }],
            _completionTracker: {
              onComplete: () => {
                this.onStepComplete(step);
              }
            }
          };
        }
        const flowForRenderer = {
          id: `step-${step.stepId}`,
          type: experienceType,
          payload,
          config: window.__DAP_CONFIG__
        };
        console.debug(`[DAP] Rendering ${experienceType} experience:`, flowForRenderer);
        console.debug(`[DAP] Payload structure:`, {
          type: experienceType,
          targetSelector: payload.targetSelector,
          trigger: payload.trigger,
          elementSelector: ux.elementSelector
        });
        if (experienceType === "tooltip") {
          flowForRenderer.payload.trigger = payload.trigger || "hover";
          flowForRenderer.payload.targetSelector = payload.targetSelector;
        } else if (experienceType === "popover") {
          flowForRenderer.payload.trigger = payload.trigger || "click";
          flowForRenderer.payload.targetSelector = payload.targetSelector;
        } else if (experienceType === "modal") {
          console.debug(`[DAP] Modal content transformation:`, {
            originalModalContent: ux.modalContent,
            transformedBody: payload.body || payload.bodyBlocks,
            contentType: ux.modalContent?.contentType
          });
        }
        renderer(flowForRenderer);
      }).catch((err) => {
        console.error("[DAP] Error loading experience renderer:", err);
        if (this._currentFlow && this._currentFlow.steps[this._state.activeStep]?.stepId === step.stepId) {
          this.advanceToNextStep();
        }
      });
    }
    /**
     * Unified UX experience completion handler for both Linear and AnyOrder modes.
     * - AnyOrder: clears concurrency guard, marks step complete, checks flow completion.
     * - Linear: advances to the next step (existing behaviour).
     */
    onStepComplete(step) {
      console.debug(`[DAP] UX experience completed for step: ${step.stepId}`);
      if (this._state.executionMode === "AnyOrder") {
        this._state.anyOrderStepInProgress = false;
        const stepIndex = this._currentFlow?.steps.findIndex((s) => s.stepId === step.stepId) ?? -1;
        if (stepIndex >= 0) {
          this._state.triggeredSteps.add(stepIndex);
          this._state.inProgressSteps.delete(stepIndex);
          console.debug(`[DAP] AnyOrder: step ${stepIndex} (${step.stepId}) marked complete`);
          triggerManager.unregisterTrigger(step.stepId);
        }
        if (this._pendingAnyOrderSteps.length > 0 && this._state.flowInProgress) {
          const pending = this._pendingAnyOrderSteps.shift();
          setTimeout(() => {
            if (!this._state.flowInProgress || this._state.triggeredSteps.has(pending.stepIndex)) {
              return;
            }
            if (this._state.anyOrderStepInProgress) {
              this._pendingAnyOrderSteps.unshift(pending);
              console.debug(`[DAP] AnyOrder: pending step ${pending.step.stepId} re-queued \u2014 another step is now in-progress`);
              return;
            }
            this._state.inProgressSteps.add(pending.stepIndex);
            if (!this._state.runCounted && this._currentFlow) {
              this.incrementFlowRunCount(this._currentFlow);
              this._state.runCounted = true;
            }
            const pendingIsRuleBased = !pending.step.uxExperience && pending.step.conditionRuleBlocks != null && pending.step.conditionRuleBlocks.length > 0;
            if (pendingIsRuleBased) {
              this._state.inProgressSteps.delete(pending.stepIndex);
              const inputEl = pending.step.userInputSelector ? resolveSelectorWithPriority(pending.step.userInputSelector) : null;
              const inputType = inputEl ? this.getInputElementType(inputEl) : "unknown";
              if (!["text", "email", "password", "textarea", "number", "search", "url", "tel"].includes(inputType)) {
                this.evaluateStepRulesWithValue(pending.step, "", "change");
              }
            } else {
              this._state.anyOrderStepInProgress = true;
              this.executeStepContent(pending.step);
              this.postStepTransition(pending.step);
            }
          }, 0);
        }
        this.checkFlowCompletion();
      } else {
        this._state.anyOrderStepInProgress = false;
        if (this._currentFlow && this._state.activeStep < this._currentFlow.steps.length && this._currentFlow.steps[this._state.activeStep].stepId === step.stepId) {
          this.advanceToNextStep();
        } else {
          console.debug(`[DAP] Step ${step.stepId} is no longer active, skipping advancement`);
        }
      }
    }
    /**
     * Advance to next step intelligently (respects triggers)
     * Enhanced with CRITICAL FIXES 1-6 integration
     */
    advanceToNextStep() {
      if (!this._currentFlow || !this._state.activeFlowId) {
        console.debug(`[DAP] advanceToNextStep: no active flow \u2014 ignoring stale callback`);
        return;
      }
      if (this._state.stepAdvancing) {
        console.debug(`[DAP] Step advancement already in progress, skipping duplicate request`);
        return;
      }
      this._state.stepAdvancing = true;
      console.debug(`[DAP] ========== ADVANCING FROM STEP ${this._state.activeStep} ==========`);
      this.cleanupCurrentStep();
      if (this._state.executionMode === "Linear") {
        this.cleanupPreviousStepTriggers();
      }
      this._state.activeStep++;
      this._state.activeStepTriggered = false;
      console.debug(`[DAP] Advanced to step ${this._state.activeStep}`);
      if (this._currentFlow && this._state.activeStep < this._currentFlow.steps.length) {
        const nextStep = this._currentFlow.steps[this._state.activeStep];
        console.debug(`[DAP] Next step: ${nextStep.stepId} (type: ${nextStep.stepType})`);
        if (nextStep.stepType === "Mandatory") {
          console.debug(`[DAP] \u{1F4CB} MANDATORY STEP: Starting mandatory step ${nextStep.stepId}`);
        }
        const nextStepTrigger = triggerManager.resolveTrigger(nextStep);
        if (nextStepTrigger) {
          console.debug(`[DAP] Next step ${nextStep.stepId} has trigger, setting up listener`);
          this.executeStepWithTrigger(nextStep, this._state.activeStep);
          this._state.stepAdvancing = false;
          return;
        } else {
          console.debug(`[DAP] Next step ${nextStep.stepId} has no trigger - executing immediately`);
        }
      } else {
        console.debug(`[DAP] No more steps, flow completed`);
        this._state.stepAdvancing = false;
        this.completeFlow();
        return;
      }
      this._state.stepAdvancing = false;
      this.executeStep();
    }
    /**
     * CRITICAL FIX: Enhanced advance to next step that checks for existing input values and evaluates rules
     * This fixes the issue where Step 10 doesn't evaluate its rules when advanced from Step 9
     */
    advanceToNextStepWithRuleCheck() {
      if (this._state.stepAdvancing) {
        console.debug(`[DAP] Step advancement already in progress, skipping duplicate request`);
        return;
      }
      this._state.stepAdvancing = true;
      console.debug(`[DAP] ========== ADVANCING FROM STEP ${this._state.activeStep} WITH RULE CHECK ==========`);
      this.cleanupCurrentStep();
      if (this._state.executionMode === "Linear") {
        this.cleanupPreviousStepTriggers();
      }
      this._state.activeStep++;
      this._state.activeStepTriggered = false;
      console.debug(`[DAP] Advanced to step ${this._state.activeStep}`);
      if (this._currentFlow && this._state.activeStep < this._currentFlow.steps.length) {
        const nextStep = this._currentFlow.steps[this._state.activeStep];
        console.debug(`[DAP] Next step: ${nextStep.stepId} (type: ${nextStep.stepType})`);
        if (nextStep.stepType === "Mandatory") {
          console.debug(`[DAP] \u{1F4CB} MANDATORY STEP: Starting mandatory step ${nextStep.stepId}`);
        }
        const nextStepTrigger = triggerManager.resolveTrigger(nextStep);
        if (nextStepTrigger) {
          console.debug(`[DAP] Next step ${nextStep.stepId} has trigger, setting up listener`);
          if (!nextStep.uxExperience && nextStep.conditionRuleBlocks && nextStep.conditionRuleBlocks.length > 0 && nextStep.userInputSelector) {
            console.debug(`[DAP] \u{1F50D} RULE CHECK: Step ${nextStep.stepId} is rule-based, checking for existing input value`);
            const cancelRuleCheck = this.waitForInputElement(nextStep.userInputSelector, (inputElement) => {
              if (!this._currentFlow || !this._currentFlow.steps.some((s) => s.stepId === nextStep.stepId)) {
                console.debug(`[DAP] \u{1F50D} RULE CHECK: Flow changed while waiting for input element, aborting`);
                return;
              }
              const existingValue = inputElement.value;
              console.debug(`[DAP] \u{1F50D} RULE CHECK: Found existing input value: "${existingValue}"`);
              if (existingValue && existingValue.trim() !== "") {
                console.debug(`[DAP] \u{1F50D} RULE CHECK: Existing value found but NOT evaluating rules immediately`);
                console.debug(`[DAP] \u{1F3AF} Rules will evaluate ONLY when user focuses out (blur event)`);
                this.executeStepWithTrigger(nextStep, this._state.activeStep);
              } else {
                console.debug(`[DAP] \u{1F50D} RULE CHECK: No existing value, setting up trigger normally`);
                this.executeStepWithTrigger(nextStep, this._state.activeStep);
              }
            });
            this._stepTriggerListeners.set(`${nextStep.stepId}_waitCancel`, cancelRuleCheck);
          } else {
            this.executeStepWithTrigger(nextStep, this._state.activeStep);
          }
          this._state.stepAdvancing = false;
          return;
        } else {
          console.debug(`[DAP] Next step ${nextStep.stepId} has no trigger - executing immediately`);
        }
      } else {
        console.debug(`[DAP] No more steps, flow completed`);
        this._state.stepAdvancing = false;
        this.completeFlow();
        return;
      }
      this._state.stepAdvancing = false;
      this.executeStep();
    }
    /**
     * Complete current flow
     * Enhanced with flow completion tracking for frequency validation
     */
    completeFlow() {
      const flowData = this._currentFlow;
      const flowId = this._state.activeFlowId;
      console.debug(`[DAP] Flow completed: ${flowId}`);
      if (flowData && flowId) {
        this.markFlowCompleted(flowData);
      }
      const endCb = this._onFlowEnd;
      this._onFlowEnd = null;
      endCb?.(flowId, "completed");
      this.abortFlow();
      if (flowData && flowData.execution?.frequency?.type === "Recurring") {
        console.debug(`[DAP] \u{1F504} Flow ${flowId} completed but is RECURRING - re-registering triggers`);
        setTimeout(() => {
          this.startFlow(flowData);
        }, 100);
      }
    }
    /**
     * 🚨 CRITICAL FIX: Mark flow as completed in tracking system
     * This ensures OneTime flows are properly tracked and blocked on subsequent runs
     */
    markFlowCompleted(flowData) {
      const flowId = flowData.flowId;
      console.debug(`[DAP] \u{1F3AF} Marking flow ${flowId} as completed`);
      if (flowData.execution?.frequency?.type === "OneTime") {
        const flowCompletedKey = `dap_flow_completed_${flowId}`;
        const completionTimestamp = Date.now();
        try {
          const completionData = JSON.stringify({
            timestamp: completionTimestamp,
            reason: "completed",
            flowType: flowData.execution?.frequency?.type || "unknown"
          });
          localStorage.setItem(flowCompletedKey, completionData);
          console.debug(`[DAP] \u2705 OneTime flow ${flowId} marked as completed at ${new Date(completionTimestamp).toISOString()}`);
          console.debug(`[DAP] \u{1F3AF} This flow will be blocked on future attempts due to OneTime + maxRuns limit`);
        } catch (error) {
          console.error(`[DAP] Failed to mark flow ${flowId} as completed:`, error);
        }
      }
    }
    /**
     * Clean up current step listeners and state
     */
    cleanupCurrentStep() {
      if (this._state.executionMode === "AnyOrder" && this._currentFlow) {
        this._currentFlow.steps.forEach((step, index) => {
          if (!this._state.triggeredSteps.has(index)) {
            triggerManager.removeTriggerListeners(step.stepId);
            ["", "_blur", "_waitCancel", "_locationRetry", "_defer"].forEach((suffix) => {
              const cleanup = this._stepTriggerListeners.get(`${step.stepId}${suffix}`);
              if (cleanup) {
                cleanup();
                this._stepTriggerListeners.delete(`${step.stepId}${suffix}`);
              }
            });
            this.clearRuleEvaluationTimers(step.stepId);
            this.clearInputStabilityTimers(step.stepId);
            const obs = this._domObservers.get(step.stepId);
            if (obs) {
              obs.disconnect();
              this._domObservers.delete(step.stepId);
            }
          }
        });
        return;
      }
      if (this._currentFlow && this._state.activeStep < this._currentFlow.steps.length) {
        const currentStep = this._currentFlow.steps[this._state.activeStep];
        if (currentStep) {
          triggerManager.unregisterTrigger(currentStep.stepId);
          const cleanup = this._stepTriggerListeners.get(currentStep.stepId);
          if (cleanup) {
            cleanup();
            this._stepTriggerListeners.delete(currentStep.stepId);
          }
          const blurCleanup = this._stepTriggerListeners.get(`${currentStep.stepId}_blur`);
          if (blurCleanup) {
            blurCleanup();
            this._stepTriggerListeners.delete(`${currentStep.stepId}_blur`);
          }
          const waitCancel = this._stepTriggerListeners.get(`${currentStep.stepId}_waitCancel`);
          if (waitCancel) {
            waitCancel();
            this._stepTriggerListeners.delete(`${currentStep.stepId}_waitCancel`);
          }
          const locationRetryCleanup = this._stepTriggerListeners.get(`${currentStep.stepId}_locationRetry`);
          if (locationRetryCleanup) {
            locationRetryCleanup();
            this._stepTriggerListeners.delete(`${currentStep.stepId}_locationRetry`);
          }
          this.clearRuleEvaluationTimers(currentStep.stepId);
          this.clearInputStabilityTimers(currentStep.stepId);
        }
      }
      if (this._currentFlow && this._state.activeStep < this._currentFlow.steps.length) {
        const currentStep = this._currentFlow.steps[this._state.activeStep];
        if (currentStep) {
          const observer = this._domObservers.get(currentStep.stepId);
          if (observer) {
            observer.disconnect();
            this._domObservers.delete(currentStep.stepId);
          }
        }
      }
    }
    /**
     * CRITICAL FIX 1: Clean up triggers from previous steps in linear mode
     * This enforces the Linear Execution Gate by ensuring only current step has active triggers
     */
    cleanupPreviousStepTriggers() {
      if (!this._currentFlow || this._state.executionMode !== "Linear") return;
      for (let i = 0; i < this._state.activeStep; i++) {
        if (i < this._currentFlow.steps.length) {
          const previousStep = this._currentFlow.steps[i];
          console.debug(`[DAP] Linear Execution Gate: Cleaning up triggers for previous step ${previousStep.stepId} (${i})`);
          triggerManager.unregisterTrigger(previousStep.stepId);
          const cleanup = this._stepTriggerListeners.get(previousStep.stepId);
          if (cleanup) {
            cleanup();
            this._stepTriggerListeners.delete(previousStep.stepId);
          }
          const blurCleanup = this._stepTriggerListeners.get(`${previousStep.stepId}_blur`);
          if (blurCleanup) {
            blurCleanup();
            this._stepTriggerListeners.delete(`${previousStep.stepId}_blur`);
          }
          const waitCancel = this._stepTriggerListeners.get(`${previousStep.stepId}_waitCancel`);
          if (waitCancel) {
            waitCancel();
            this._stepTriggerListeners.delete(`${previousStep.stepId}_waitCancel`);
          }
          const locationRetryCleanup = this._stepTriggerListeners.get(`${previousStep.stepId}_locationRetry`);
          if (locationRetryCleanup) {
            locationRetryCleanup();
            this._stepTriggerListeners.delete(`${previousStep.stepId}_locationRetry`);
          }
          this.clearRuleEvaluationTimers(previousStep.stepId);
          this.clearInputStabilityTimers(previousStep.stepId);
        }
      }
    }
    /**
     * CRITICAL FIX 2: Clear rule evaluation debounce timers for a specific step
     */
    clearRuleEvaluationTimers(stepId) {
      const timerId = this._ruleEvaluationTimers.get(stepId);
      if (timerId) {
        clearTimeout(timerId);
        this._ruleEvaluationTimers.delete(stepId);
      }
    }
    /**
     * CRITICAL FIX 3: Clear input stability timers for a specific step
     */
    clearInputStabilityTimers(stepId) {
      this._lastInputValues.delete(stepId);
      this._inputStabilityChecks.delete(stepId);
    }
    /**
     * Wait for element to exist in DOM.
     * Returns a cancel function — call it to stop retrying (e.g. when the flow is aborted).
     * Capped at MAX_ATTEMPTS to prevent infinite loops.
     */
    waitForElement(selector, callback) {
      let cancelled = false;
      let attempts = 0;
      const MAX_ATTEMPTS = 300;
      const check = () => {
        if (cancelled) return;
        if (attempts >= MAX_ATTEMPTS) {
          console.warn(`[DAP] waitForElement: gave up waiting for "${selector}" after 30 s`);
          return;
        }
        attempts++;
        const element = resolveSelectorWithPriority(selector);
        if (element) {
          if (!cancelled) callback(element);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
      return () => {
        cancelled = true;
      };
    }
    /**
     * Get current flow state for debugging
     */
    getState() {
      return {
        ...this._state,
        currentFlow: this._currentFlow?.flowId,
        currentStepId: this._currentFlow?.steps[this._state.activeStep]?.stepId
      };
    }
    /**
     * Clean up resources and page context subscriptions
     * Enhanced with CRITICAL FIXES cleanup
     */
    destroy() {
      console.debug("[DAP] FlowEngine: Destroying...");
      this.cleanupCurrentStep();
      this.cleanupAllTimers();
      this._state = {
        activeFlowId: null,
        flowInProgress: false,
        activeStep: 0,
        activeStepTriggered: false,
        executionState: "TERMINATED",
        executionMode: "Linear",
        triggeredSteps: /* @__PURE__ */ new Set(),
        anyOrderStepInProgress: false,
        inProgressSteps: /* @__PURE__ */ new Set()
      };
      this._currentFlow = null;
      this._completedMandatorySteps.clear();
      triggerManager.destroy();
      pageContextService.destroy();
      console.debug("[DAP] FlowEngine: Destroyed");
    }
    /**
     * Analyze flow page context to detect multi-page flows
     */
    analyzeFlowPageContext(flowData) {
      console.debug(`[DAP] \u{1F4C4} FLOW PAGE CONTEXT ANALYSIS: ${flowData.flowId}`);
      console.debug(`[DAP] ================================================================`);
      const currentPage = pageContextService.getCurrentContext();
      const selectors = /* @__PURE__ */ new Set();
      let selectorMismatches = 0;
      let possibleMultiPage = false;
      for (const step of flowData.steps) {
        if (step.trigger?.conditions) {
          step.trigger.conditions.forEach((condition) => {
            if (condition.selector) {
              selectors.add(condition.selector);
            }
          });
        }
        if (step.uxExperience?.elementSelector && step.uxExperience.elementSelector !== "NA") {
          selectors.add(step.uxExperience.elementSelector);
        }
        if (step.userInputSelector) {
          selectors.add(step.userInputSelector);
        }
      }
      console.debug(`[DAP] Total unique selectors in flow: ${selectors.size}`);
      for (const selector of selectors) {
        try {
          const el = resolveSelectorWithPriority(selector);
          if (!el) {
            selectorMismatches++;
            console.warn(`[DAP] \u26A0\uFE0F Selector not found on current page: ${selector}`);
          } else {
            console.debug(`[DAP] \u2705 Selector found: ${selector}`);
          }
        } catch (error) {
          selectorMismatches++;
          console.warn(`[DAP] \u26A0\uFE0F Invalid selector: ${selector}`, error);
        }
      }
      if (selectorMismatches > 0) {
        possibleMultiPage = true;
        const missPercentage = Math.round(selectorMismatches / selectors.size * 100);
        console.warn(`[DAP] \u{1F6A8} ${selectorMismatches}/${selectors.size} (${missPercentage}%) selectors not found on current page`);
        console.warn(`[DAP] This suggests a multi-page flow or cross-page navigation issue`);
      }
      const executionMode = flowData.execution?.mode || "Linear";
      console.debug(`[DAP] Flow execution mode: ${executionMode}`);
      if (possibleMultiPage && executionMode === "Linear") {
        console.warn(`[DAP] \u{1F4A1} Recommendation: Consider enabling multiPage support for this flow`);
        console.warn(`[DAP] Some steps may wait indefinitely for elements on other pages`);
      }
      console.debug(`[DAP] Current page: ${currentPage?.pathname || "unknown"}`);
      console.debug(`[DAP] ================================================================`);
    }
    /**
     * Analyze rule-based steps for page context issues
     */
    analyzeRuleStepsPageContext(ruleSteps) {
      console.debug(`[DAP] \u{1F916} RULE STEPS PAGE CONTEXT ANALYSIS`);
      console.debug(`[DAP] ================================================================`);
      pageContextService.getCurrentContext();
      for (const step of ruleSteps) {
        console.debug(`[DAP] Rule step ${step.stepId}:`);
        const triggerSelectors = step.trigger?.conditions?.map((c) => c.selector).filter(Boolean) || [];
        console.debug(`[DAP]   Trigger selectors: ${triggerSelectors.length}`);
        for (const selector of triggerSelectors) {
          if (selector) {
            const el = resolveSelectorWithPriority(selector);
            if (!el) {
              console.warn(`[DAP]   \u26A0\uFE0F Rule trigger selector not yet in DOM: ${selector} (may appear after navigation)`);
            } else {
              console.debug(`[DAP]   \u2705 Trigger selector found: ${selector}`);
            }
          }
        }
        if (step.userInputSelector) {
          const inputEl = resolveSelectorWithPriority(step.userInputSelector);
          if (!inputEl) {
            console.warn(`[DAP]   \u26A0\uFE0F Rule input selector not yet in DOM: ${step.userInputSelector} (may appear after navigation)`);
          } else {
            console.debug(`[DAP]   \u2705 Input selector found: ${step.userInputSelector}`);
          }
        }
        if (step.conditionRuleBlocks) {
          for (let i = 0; i < step.conditionRuleBlocks.length; i++) {
            const ruleBlock = step.conditionRuleBlocks[i];
            if (ruleBlock.selector) {
              const rbEl = resolveSelectorWithPriority(ruleBlock.selector);
              if (!rbEl) {
                console.warn(`[DAP]   \u26A0\uFE0F Rule block ${i} selector not yet in DOM: ${ruleBlock.selector}`);
              }
            }
          }
        }
      }
      console.debug(`[DAP] ================================================================`);
    }
    /**
     * Analyze and log trigger usage for the entire flow
     * This helps identify which steps use step-level vs element-level triggers
     */
    analyzeTriggerUsage(flowData) {
      console.debug(`[DAP] \u{1F4CA} TRIGGER USAGE ANALYSIS FOR FLOW: ${flowData.flowId}`);
      console.debug(`[DAP] ================================================================`);
      let stepLevelCount = 0;
      let noTriggerCount = 0;
      let ruleBasedCount = 0;
      for (const step of flowData.steps) {
        const hasStepTrigger = step.trigger && step.trigger.conditions && step.trigger.conditions.length > 0;
        const hasRuleBlocks = step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0 || step.rules?.length > 0;
        if (hasRuleBlocks) {
          ruleBasedCount++;
        }
        if (hasStepTrigger) {
          stepLevelCount++;
          const triggerType = `${step.trigger?.conditions?.[0]?.kind}-${step.trigger?.conditions?.[0]?.event}`;
          if (hasRuleBlocks) {
            console.debug(`[DAP] \u{1F916} Step ${step.stepId}: STEP-LEVEL trigger (${triggerType}) + RULE-BASED decision`);
          } else {
            console.debug(`[DAP] \u2705 Step ${step.stepId}: STEP-LEVEL trigger (${triggerType}) + UX experience`);
          }
        } else if (hasRuleBlocks && step.userInputSelector) {
          stepLevelCount++;
          console.debug(`[DAP] \u{1F916} Step ${step.stepId}: INPUT-BASED trigger (via ${step.userInputSelector}) + RULE-BASED decision`);
        } else {
          noTriggerCount++;
          console.error(`[DAP] \u274C Step ${step.stepId}: NO TRIGGER - will execute immediately`);
        }
      }
      console.debug(`[DAP] ================================================================`);
      console.debug(`[DAP] \u{1F4CA} SUMMARY:`);
      console.debug(`[DAP]    \u2705 Step-level triggers: ${stepLevelCount}`);
      console.debug(`[DAP]    \u274C No triggers: ${noTriggerCount}`);
      console.debug(`[DAP]    \u{1F916} Rule-based decision steps: ${ruleBasedCount}`);
      console.debug(`[DAP] ================================================================`);
      if (noTriggerCount > 0) {
        console.error(`[DAP] \u{1F6A8} ERROR: ${noTriggerCount} steps have no triggers!`);
        console.error(`[DAP]    These steps will execute immediately without user interaction.`);
      }
      if (stepLevelCount === flowData.steps.length) {
        console.debug(`[DAP] \u{1F389} PERFECT! All steps use step-level triggers.`);
      }
    }
  };
  var flowEngine = FlowEngine.getInstance();

  // src/index.ts
  registerModalSequence();
  registerModal();
  registerTooltip();
  registerSurvey();
  registerPopover();
  registerBeacon();
  registerBanner();
  registerHotspots();
  registerHotspotTour();
  registerTaskList();
  registerWalkthrough();
  var log = (...args) => window.__DAP_DEBUG__ ? console.log("[DAP]", ...args) : void 0;
  var _dapConfig = null;
  var _flowInitializationPending = false;
  var _pendingFlowIds = [];
  var _registeredFlows = /* @__PURE__ */ new Map();
  var _previewSessionId = null;
  async function init(opts) {
    const { configUrl, debug, screenId, user } = opts || {};
    window.__DAP_DEBUG__ = !!debug;
    if (debug && typeof window !== "undefined") {
      Object.assign(window.DAP, {
        getFlowState: () => flowEngine.getState(),
        getUserState: () => userContextService.getDebugState(),
        testFlow: async (flowId) => {
          if (!_dapConfig) throw new Error("SDK not initialized");
          const previewMode2 = detectPreviewMode();
          const previewSessionId = previewMode2.isPreviewMode ? previewMode2.previewSessionId : null;
          const rawFlowData = await fetchFlowById(_dapConfig, location.origin, flowId, previewSessionId);
          const flowData = normalizeRawFlowData(rawFlowData, flowId);
          return flowEngine.startFlow(flowData);
        },
        renderModal,
        resolveSelector,
        locationContext: LocationContextService.getInstance(),
        userContext: userContextService,
        flowEngine
      });
    }
    if (!configUrl) throw new Error("DAP.init: configUrl is required");
    const pathname = location.pathname.replace(/^\/+/, "");
    const cfg = await loadConfig(configUrl);
    const hostBase = location.origin;
    window.__DAP_CONFIG__ = cfg;
    _dapConfig = cfg;
    if (user) {
      userContextService.setUser(user);
      const resolvedUser = userContextService.getUser();
      log("User context set during init:", resolvedUser?.id || "unknown");
    }
    log("Loaded config", { cfg, hostBase });
    const locationService = LocationContextService.getInstance();
    locationService.setContext({
      currentPath: pathname,
      screenId: screenId || pathname
    });
    log("Location context set", locationService.getContext());
    const previewMode = detectPreviewMode();
    if (previewMode.isPreviewMode && previewMode.previewSessionId && previewMode.flowId) {
      log("Preview mode detected, flowId:", previewMode.flowId, "sessionId:", previewMode.previewSessionId);
      _previewSessionId = previewMode.previewSessionId;
      _pendingFlowIds = [previewMode.flowId];
      await initializeFlowsWhenReady();
      return;
    }
    _previewSessionId = null;
    const ids = await fetchVisibleFlowIds(cfg, hostBase, pathname);
    log("Visible flow IDs", ids);
    if (ids.length === 0) {
      log("No flows available");
      return;
    }
    _pendingFlowIds = ids;
    await initializeFlowsWhenReady();
  }
  async function initializeFlowsWhenReady() {
    if (_flowInitializationPending) {
      log("Flow initialization already pending");
      return;
    }
    _flowInitializationPending = true;
    await waitForDOMReady();
    if (!shouldInitializeFlows()) {
      log("Flow initialization deferred - waiting for user context");
      _flowInitializationPending = false;
      return;
    }
    await startPendingFlows();
  }
  async function waitForDOMReady() {
    return new Promise((resolve) => {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
      } else {
        resolve();
      }
    });
  }
  function shouldInitializeFlows() {
    if (userContextService.hasRealUser()) {
      log("Flow initialization allowed - real user context available");
      return true;
    }
    log("Flow initialization allowed - proceeding with anonymous context");
    return true;
  }
  async function startPendingFlows() {
    if (!_dapConfig || _pendingFlowIds.length === 0) {
      log("No pending flows to start");
      _flowInitializationPending = false;
      return;
    }
    const queue = [..._pendingFlowIds];
    log(`Processing flow queue: [${queue.join(", ")}]`);
    let resolveCurrentFlow = null;
    flowEngine.setOnFlowEndCallback((_flowId, _reason) => {
      log(`Flow ended (${_reason}): ${_flowId}`);
      if (resolveCurrentFlow) {
        const cb = resolveCurrentFlow;
        resolveCurrentFlow = null;
        cb();
      }
    });
    for (const flowId of queue) {
      if (!_dapConfig) break;
      let rawFlowData;
      try {
        rawFlowData = await fetchFlowById(_dapConfig, location.origin, flowId, _previewSessionId ?? void 0);
      } catch (err) {
        console.error(`[DAP] Failed to fetch flow ${flowId}:`, err);
        continue;
      }
      if (!rawFlowData) {
        console.error("[DAP] Failed to resolve flow data for flow ID:", flowId);
        continue;
      }
      const flowData = normalizeRawFlowData(rawFlowData, flowId);
      log(`Starting flow ${flowId} (${queue.indexOf(flowId) + 1}/${queue.length})`);
      await new Promise((resolve) => {
        resolveCurrentFlow = resolve;
        flowEngine.startFlow(flowData).catch((err) => {
          console.error(`[DAP] Error starting flow ${flowId}:`, err);
          resolve();
        });
      });
    }
    flowEngine.setOnFlowEndCallback(() => {
    });
    _flowInitializationPending = false;
  }
  function normalizeRawFlowData(rawFlowData, flowId) {
    const steps = (Array.isArray(rawFlowData.steps) ? rawFlowData.steps : null) || (Array.isArray(rawFlowData.actions) ? rawFlowData.actions : null) || (Array.isArray(rawFlowData.actionGroups) ? rawFlowData.actionGroups : null) || [];
    const frequency = rawFlowData.execution?.frequency || rawFlowData.frequency || {
      // Default to 'Always' (no throttling) so flows without explicit frequency config
      // run on every page visit as intended. Using 'Daily' here was silently throttling them.
      type: rawFlowData.frequencyType || "Always",
      maxRuns: rawFlowData.maxRuns || 0
    };
    return {
      flowId: rawFlowData.flowId || rawFlowData.id || flowId,
      flowName: rawFlowData.flowName || rawFlowData.name || flowId,
      steps,
      execution: {
        mode: rawFlowData.execution?.mode || rawFlowData.executionMode || "Linear",
        multiPage: rawFlowData.execution?.multiPage !== void 0 ? rawFlowData.execution.multiPage : !!rawFlowData.isMultiPage,
        frequency
      }
    };
  }
  async function setUser(user) {
    const previousUserId = userContextService.getAnalyticsContext().userId;
    userContextService.setUser(user);
    const currentUserId = userContextService.getAnalyticsContext().userId;
    log(`[DAP] setUser called. prevId: ${previousUserId}, currId: ${currentUserId}`);
    if (_dapConfig && (previousUserId !== currentUserId || _pendingFlowIds.length === 0)) {
      log("User changed or no flows available - re-fetching visible flows...");
      const pathname = location.pathname.replace(/^\/+/, "");
      const hostBase = location.origin;
      try {
        const ids = await fetchVisibleFlowIds(_dapConfig, hostBase, pathname);
        _pendingFlowIds = ids;
        log("Updated visible flow IDs for user:", ids);
      } catch (err) {
        log("Error re-fetching flows in setUser:", err);
      }
    }
    if (_pendingFlowIds.length > 0 && !_flowInitializationPending) {
      log("Starting flows after user context change");
      initializeFlowsWhenReady();
    }
  }
  function updateUser(partialUser) {
    userContextService.updateUser(partialUser);
  }
  function getUser() {
    return userContextService.getUser();
  }
  function clearUser() {
    userContextService.clearUser();
  }
  function resetFlowRuns(flowId) {
    try {
      if (flowId) {
        localStorage.removeItem(`dap_flow_runs_${flowId}`);
        localStorage.removeItem(`dap_flow_completed_${flowId}`);
        localStorage.removeItem(`dap_flow_last_run_${flowId}`);
        console.debug(`[DAP] Flow run count reset for: ${flowId}`);
      } else {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("dap_flow_runs_") || key.startsWith("dap_flow_completed_") || key.startsWith("dap_flow_last_run_"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        console.debug(`[DAP] All flow run counts reset (${keysToRemove.length} keys cleared)`);
      }
    } catch (error) {
      console.error("[DAP] Error resetting flow run counts:", error);
    }
  }
  async function executeFlow(flow) {
    if (!flow || !flow.id || !flow.steps) {
      throw new Error("Invalid flow object: must have 'id' and 'steps' properties");
    }
    const normalizedFlow = {
      flowId: flow.id,
      flowName: flow.name || flow.id,
      steps: flow.steps.map((step, index) => ({
        stepId: step.id || `step-${index + 1}`,
        stepOrder: index + 1,
        stepType: "Optional",
        // default for ad-hoc flows
        uxExperience: {
          uxExperienceType: step.type,
          elementSelector: step.trigger?.selector,
          content: step.content
        }
      })),
      execution: flow.execution ? {
        mode: flow.execution.mode,
        multiPage: flow.execution.multiPage,
        frequency: flow.execution.frequency ? {
          type: flow.execution.frequency.type ?? "OneTime",
          maxRuns: flow.execution.frequency.maxRuns ?? 1
        } : void 0
      } : flow.executionMode ? {
        mode: flow.executionMode,
        multiPage: flow.isMultiPage
      } : void 0
    };
    log("Executing custom flow:", normalizedFlow);
    return flowEngine.startFlow(normalizedFlow);
  }
  var MAX_REGISTERED_FLOWS = 50;
  function registerFlow(flowData) {
    _registeredFlows.set(flowData.flowId, flowData);
    if (_registeredFlows.size > MAX_REGISTERED_FLOWS) {
      const oldestKey = _registeredFlows.keys().next().value;
      if (oldestKey !== void 0) {
        _registeredFlows.delete(oldestKey);
        log(`_registeredFlows cap reached \u2014 evicted oldest flow: ${oldestKey}`);
      }
    }
    log("Flow registered:", flowData.flowId);
  }
  async function startFlow(flowId) {
    const registeredFlow = _registeredFlows.get(flowId);
    if (registeredFlow) {
      log("Starting registered flow:", flowId);
      return flowEngine.startFlow(registeredFlow);
    }
    if (!_dapConfig) {
      throw new Error("SDK not initialized. Call init() first or register the flow using registerFlow()");
    }
    const previewMode = detectPreviewMode();
    const previewSessionId = previewMode.isPreviewMode ? previewMode.previewSessionId : null;
    try {
      const rawFlowData = await fetchFlowById(_dapConfig, location.origin, flowId, previewSessionId);
      if (!rawFlowData) {
        throw new Error(`Flow data not found for ID: ${flowId}`);
      }
      const flowData = normalizeRawFlowData(rawFlowData, flowId);
      log("Starting flow from backend:", flowId);
      return flowEngine.startFlow(flowData);
    } catch (error) {
      const backendError = error.body ? ` (${error.body})` : error.message ? ` (${error.message})` : "";
      throw new Error(`Flow not found: ${flowId}.${backendError} Make sure to register it first or check if it exists in the backend.`);
    }
  }
  var dap = {
    init,
    setUser,
    updateUser,
    getUser,
    clearUser,
    registerFlow,
    startFlow,
    executeFlow,
    resetFlowRuns
  };
  if (typeof window !== "undefined") {
    window.DAP = dap;
  }

  exports.clearUser = clearUser;
  exports.dap = dap;
  exports.executeFlow = executeFlow;
  exports.getUser = getUser;
  exports.init = init;
  exports.registerFlow = registerFlow;
  exports.resetFlowRuns = resetFlowRuns;
  exports.setUser = setUser;
  exports.startFlow = startFlow;
  exports.updateUser = updateUser;

  return exports;

})({});
//# sourceMappingURL=index.umd.js.map
//# sourceMappingURL=index.umd.js.map