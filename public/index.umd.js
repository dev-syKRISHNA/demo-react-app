var DAP = (function (exports) {
  'use strict';

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
      res = await fetch(url, { method, headers, body: bodyInit, signal: c.signal, credentials: "omit", cache: "no-cache", mode: "cors" });
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

  // src/services/userContextService.ts
  var _UserContextService = class _UserContextService {
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
  var UserContextService = _UserContextService;
  var userContextService = UserContextService.getInstance();

  // src/flows.ts
  var FlowCache = class {
    constructor() {
      this.CACHE_PREFIX = "dap_flow_cache_";
      this.CACHE_EXPIRY_MS = 24 * 60 * 60 * 1e3;
    }
    // 24 hours
    get(flowId) {
      try {
        const cacheKey = `${this.CACHE_PREFIX}${flowId}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (!cached) return null;
        const entry = JSON.parse(cached);
        if (Date.now() - entry.timestamp > this.CACHE_EXPIRY_MS) {
          sessionStorage.removeItem(cacheKey);
          return null;
        }
        return entry.flowData;
      } catch (e) {
        return null;
      }
    }
    set(flowId, flowData) {
      try {
        const cacheKey = `${this.CACHE_PREFIX}${flowId}`;
        const entry = {
          flowId,
          flowData,
          timestamp: Date.now(),
          originalSiteId: flowData?.siteId || "unknown"
        };
        sessionStorage.setItem(cacheKey, JSON.stringify(entry));
      } catch (e) {
      }
    }
    clear() {
      try {
        const keys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key?.startsWith(this.CACHE_PREFIX)) {
            keys.push(key);
          }
        }
        keys.forEach((key) => sessionStorage.removeItem(key));
      } catch (e) {
      }
    }
  };
  var flowCache = new FlowCache();
  async function fetchVisibleFlowIds(cfg, hostBase, page) {
    const apiBase = getBaseUrl(cfg.apiurl);
    const base = joinUrl(apiBase, `/iap-experience/organizations/${cfg.organizationid}/site-collections/${cfg.siteid}/visible-userflows`);
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
      if (!Array.isArray(res)) return [];
      return res.map((item) => typeof item === "string" ? item : item.flowId || item.id || String(item));
    } catch (e) {
      if (e && e.status === 405) {
        const url = `${base}?hostname=${encodeURIComponent(hostBase)}`;
        const res = await http(cfg, url, {
          method: "GET",
          hostBase,
          includeHostHeader: true
        });
        if (!Array.isArray(res?.flowIds)) return [];
        return res.flowIds.map((item) => typeof item === "string" ? item : item.flowId || item.id || String(item));
      }
      throw e;
    }
  }
  async function fetchFlowById(cfg, hostBase, flowId, previewSessionId) {
    const cachedFlow = flowCache.get(flowId);
    if (cachedFlow) {
      console.debug(`[DAP] Flow ${flowId} found in cache, using cached version`);
      return cachedFlow;
    }
    const apiBase = getBaseUrl(cfg.apiurl);
    const baseUrl = joinUrl(apiBase, `/iap-experience/organizations/${cfg.organizationid}/site-collections/${cfg.siteid}/userflows/${flowId}`);
    const url = previewSessionId ? `${baseUrl}?previewSessionId=${encodeURIComponent(previewSessionId)}` : baseUrl;
    console.debug(`[DAP] Fetching flow ${flowId} from URL: ${url}`);
    try {
      const flowData = await http(cfg, url, {
        method: "GET",
        hostBase,
        includeHostHeader: true
      });
      console.debug(`[DAP] Successfully fetched flow ${flowId} from current site, caching it`);
      flowCache.set(flowId, flowData);
      return flowData;
    } catch (err) {
      if (err?.status === 404) {
        console.warn(`[DAP] Flow ${flowId} returned 404 from current site, checking cache...`);
        const fallback = flowCache.get(flowId);
        if (fallback) {
          console.warn(
            `[DAP] \u2705 Flow ${flowId} found in cache from previous site \u2014 using cached version. Ensure this flow is configured on all target websites.`
          );
          return fallback;
        }
        console.error(`[DAP] \u274C Flow ${flowId} not found on current site (404) and not in cache either. Cannot load flow.`);
        throw err;
      }
      console.error(`[DAP] Error fetching flow ${flowId}:`, err);
      throw err;
    }
  }
  function clearFlowCache() {
    flowCache.clear();
  }
  function getFlowFromCache(flowId) {
    return flowCache.get(flowId);
  }
  async function checkCorsAccess(cfg, hostBase) {
    const apiBase = getBaseUrl(cfg.apiurl);
    const url = joinUrl(apiBase, "cors-check") + `?organizationId=${encodeURIComponent(cfg.organizationid)}&siteCollectionId=${encodeURIComponent(cfg.siteid)}&origin=${encodeURIComponent(hostBase)}&hostUrl=${encodeURIComponent(hostBase)}`;
    try {
      const res = await http(cfg, url, {
        method: "GET",
        hostBase,
        includeHostHeader: true
      });
      return res?.allowed === true;
    } catch (e) {
      if (e?.status === 403 || e?.status === 401 || e instanceof TypeError || e?.name === "TypeError" || !e?.status) {
        return false;
      }
      throw e;
    }
  }
  function getBaseUrl(apiurl) {
    return (apiurl || "").replace(/\/+$/, "");
  }
  function joinUrl(base, tail) {
    const b = (base || "").replace(/\/+$/, "");
    const t = (tail || "").replace(/^\/+/, "");
    return `${b}/${t}`;
  }

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

  // src/experiences/registry.ts
  var REGISTRY = /* @__PURE__ */ new Map();
  function register(type, renderer) {
    REGISTRY.set(type, renderer);
  }
  function getRenderer(type) {
    return REGISTRY.get(type);
  }

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
/* \u2500\u2500 Component-scoped text vars with visibility-safe fallbacks \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
:root,
.dap-modal,
.dap-modal-overlay {
  --dap-modal-ink:        #000000 !important;
  --dap-modal-ink-muted:  #000000 !important;
  --dap-modal-ink-subtle: #000000 !important;

  --dap-modal-bg:         var(--dap-glass-bg, var(--dap-surface, #ffffff));
  --dap-modal-hover-bg:   var(--dap-surface-hover, #f1f5f9);

  /* KB-specific convenience aliases */
  --dap-kb-primary-soft:  var(--dap-primary-soft, #E0F2FE);
  --dap-kb-primary-light: var(--dap-primary-lighter, #BAE6FD);
  --dap-kb-primary-dark:  var(--dap-primary-dark, #0369A1);
}

/* ===================== Modal Overlay ===================== */
.dap-modal-overlay {
  position: fixed !important;
  inset: 0 !important;
  background: var(--dap-backdrop-bg, rgba(15, 23, 42, 0.12)) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  z-index: 2147483640 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 20px !important;
  animation: dap-modal-fade 200ms ease !important;
}

/* ===================== Modal Shell ===================== */
.dap-modal {
  background: #ffffff !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border: 1.5px solid var(--dap-primary) !important;
  border-radius: 12px !important;
  box-shadow: var(--dap-shadow-soft) !important;
  width: 520px !important;
  max-width: 88vw !important;
  max-height: 88vh !important;
  min-height: 200px !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: visible !important;
  animation: dap-modal-appear 200ms ease !important;
  transform-origin: center bottom !important;
}

/* Size overrides */
.dap-modal-small  { width: 380px !important; max-width: 88vw !important; }
.dap-modal-medium { width: 520px !important; max-width: 88vw !important; }
.dap-modal-large  { width: 720px !important; max-width: 94vw !important; }
.dap-modal-xl     { width: 960px !important; max-width: 96vw !important; }

/* ===================== Modal Header ===================== */
.dap-modal-header,
.dap-header-bar {
  padding: 14px 18px 12px !important;
  border-bottom: 1px solid var(--dap-border-strong) !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  justify-content: flex-start !important;
  gap: 4px !important;
  cursor: move !important;
  user-select: none !important;
  position: relative !important;
  flex-shrink: 0 !important;
  border-left: 3px solid var(--dap-primary) !important;
  background: transparent !important;
  border-radius: 12px 12px 0 0 !important;
  overflow: hidden !important;
}
.dap-modal-header.dragging  { cursor: grabbing !important; }
.dap-modal-overlay.dragging { cursor: grabbing !important; }

.dap-modal-title,
.dap-header-text {
  margin: 0 !important;
  font-size: 17px !important;
  font-weight: 700 !important;
  color: var(--dap-primary) !important;
  flex: 1 !important;
  font-family: inherit !important;
  line-height: 1.25 !important;
}

.dap-modal-description {
  margin: 0 !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  color: var(--dap-modal-ink-muted) !important;
  line-height: 1.5 !important;
  font-family: inherit !important;
}

/* \u2500\u2500 Close Button \u2014 TOP-RIGHT corner \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-close {
  position: absolute !important;
  top:   -13px !important;
  right: -13px !important;
  z-index: 10 !important;
  background: #ffffff !important;
  border: 1.5px solid var(--dap-border-strong, rgba(59,130,246,0.18)) !important;
  cursor: pointer !important;
  color: var(--dap-modal-ink-muted) !important;
  font-size: 18px !important;
  width: 30px !important;
  height: 30px !important;
  border-radius: 50% !important;
  box-shadow:
    0 0 0 1px rgba(15, 23, 42, 0.04),
    0 2px 8px rgba(15, 23, 42, 0.10),
    0 1px 3px rgba(15, 23, 42, 0.06) !important;
  transition: background 150ms ease, color 150ms ease, transform 150ms ease, border-color 150ms ease !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  line-height: 1 !important;
}
.dap-modal-close:hover {
  background: #fef2f2 !important;
  border-color: #fecaca !important;
  color: #dc2626 !important;
  transform: scale(1.10) !important;
}
.dap-modal-close:active { transform: scale(0.93) !important; }

/* ===================== Modal Body ===================== */
.dap-modal-body {
  flex: 1 !important;
  padding: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  font-family: inherit !important;
  font-size: 16px !important;
  font-weight: 700 !important;
  color: var(--dap-modal-ink) !important;
  line-height: 1.6 !important;
  min-height: 0 !important;
  display: flex !important;
  flex-direction: column !important;
}

.dap-modal-body::-webkit-scrollbar { width: 5px !important; }
.dap-modal-body::-webkit-scrollbar-track { background: transparent !important; }
.dap-modal-body::-webkit-scrollbar-thumb {
  background: var(--dap-primary-mid, var(--dap-border-strong)) !important;
  border-radius: 3px !important;
}
.dap-modal-body::-webkit-scrollbar-thumb:hover { background: var(--dap-primary) !important; }

.dap-modal-body h1, .dap-modal-body h2, .dap-modal-body h3,
.dap-modal-body h4, .dap-modal-body h5, .dap-modal-body h6 {
  margin: 0 0 14px 0 !important;
  color: var(--dap-modal-ink) !important;
  font-weight: 500 !important;
}
.dap-modal-body p  { margin: 0 0 14px 0 !important; }
.dap-modal-body ul, .dap-modal-body ol { margin: 0 0 14px 0 !important; padding-left: 22px !important; }
.dap-modal-body li { margin-bottom: 7px !important; }

/* \u2500\u2500 Text/Link content padding \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-text {
  padding: 18px 20px 0 !important;
  color: var(--dap-modal-ink) !important;
  line-height: 1.65 !important;
  font-size: 15px !important;
  font-weight: 700 !important;
}
.dap-content-text:last-child { padding-bottom: 18px !important; }

.dap-content-link {
  display: inline-block !important;
  margin: 8px 20px !important;
  color: var(--dap-primary) !important;
  text-decoration: underline !important;
  font-weight: 500 !important;
}

/* \u2500\u2500 Image \u2014 full width, natural \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-image-wrap {
  overflow: hidden !important;
  border-radius: 10px !important;
  margin: 0 18px !important;
}
.dap-content-image-wrap:first-child { margin-top: 18px !important; }
.dap-content-image-wrap:last-child  { margin-bottom: 18px !important; }

.dap-content-image {
  width: 100% !important;
  border-radius: 10px !important;
  border: 1px solid var(--dap-border-strong) !important;
  display: block !important;
  object-fit: cover !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1) !important;
  transition: transform 0.3s ease, box-shadow 0.3s ease !important;
}
.dap-content-image:hover {
  transform: scale(1.01) !important;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15) !important;
}

/* \u2500\u2500 Video \u2014 full width \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-video-wrap {
  margin: 0 18px !important;
}
.dap-content-video-wrap:first-child { margin-top: 18px !important; }
.dap-content-video-wrap:last-child  { margin-bottom: 18px !important; }

.dap-content-video {
  width: 100% !important;
  border-radius: 10px !important;
  border: 1px solid var(--dap-border-strong) !important;
  background: #000 !important;
  display: block !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.18) !important;
}

/* \u2500\u2500 YouTube \u2014 full width, aspect ratio \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-youtube-wrap {
  margin: 0 18px !important;
}
.dap-content-youtube-wrap:first-child { margin-top: 18px !important; }
.dap-content-youtube-wrap:last-child  { margin-bottom: 18px !important; }

.dap-content-youtube {
  width: 100% !important;
  aspect-ratio: 16/9 !important;
  border-radius: 10px !important;
  border: 1px solid var(--dap-border-strong) !important;
  display: block !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
}

/* ===================== Modal Footer ===================== */
.dap-modal-footer {
  border-top: 1px solid var(--dap-border-strong) !important;
  padding: 8px 16px !important;
  background: transparent !important;
  display: flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 8px !important;
  flex-shrink: 0 !important;
  border-radius: 0 0 12px 12px !important;
  overflow: hidden !important;
}
.dap-modal-footer .dap-modal-buttons {
  margin-top: 0 !important;
  margin-left: auto !important;
  gap: 8px !important;
}

.dap-modal-footer-content {
  flex: 1 !important;
  color: var(--dap-modal-ink-muted) !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
}

.dap-modal-footer.dap-modal-footer-linear {
  padding: 0 !important;
  gap: 0 !important;
  flex-wrap: wrap !important;
  display: flex !important;
  align-items: stretch !important;
  justify-content: space-between !important;
  background: var(--dap-primary-darker, #111827) !important;
  border-top: 1px solid var(--dap-border-strong) !important;
}

.dap-modal-footer-linear .dap-footer-text {
  display: block !important;
  width: 100% !important;
  background-color: #ffffff !important;
  color: var(--dap-modal-ink) !important;
  padding: 8px 16px !important;
  font-size: 14.5px !important;
  font-weight: 700 !important;
  text-align: left !important;
  border-bottom: none !important;
  margin: 0 !important;
  box-sizing: border-box !important;
}

.dap-modal-step-counter {
  flex: 1 !important;
  background: #e0f2fe !important;
  color: #0369a1 !important;
  font-size: 13.5px !important;
  font-weight: 600 !important;
  padding: 8px 16px !important;
  margin: 0 !important;
  display: flex !important;
  align-items: center !important;
}

.dap-modal-nav-btn {
  padding: 8px 24px !important;
  margin: 0 !important;
  background: var(--dap-primary, #0EA5E9) !important;
  color: #ffffff !important;
  border: none !important;
  border-radius: 0 !important;
  font-size: 14px !important;
  font-weight: 700 !important;
  cursor: pointer !important;
  text-transform: uppercase !important;
  transition: background 150ms ease, filter 150ms ease !important;
}
.dap-modal-nav-btn:hover {
  background: var(--dap-primary-dark, #0284C7) !important;
  filter: brightness(1.05) !important;
}
.dap-modal-nav-btn:active {
  background: var(--dap-primary-darker, #0369A1) !important;
  filter: brightness(0.95) !important;
}

/* ===================== Modal Buttons ===================== */
.dap-modal-button {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 7px !important;
  padding: 7px 16px !important;
  border-radius: 8px !important;
  font-size: 15px !important;
  font-weight: 500 !important;
  text-decoration: none !important;
  cursor: pointer !important;
  transition: background 150ms ease, color 150ms ease !important;
  border: 1px solid transparent !important;
  font-family: inherit !important;
  background: transparent !important;
}

.dap-modal-button.primary {
  background: var(--dap-primary, #0EA5E9) !important;
  color: var(--dap-btn-text, #ffffff) !important;
  border-color: var(--dap-primary, #0EA5E9) !important;
}
.dap-modal-button.primary:hover {
  background: var(--dap-primary-dark, #0284C7) !important;
  border-color: var(--dap-primary-dark, #0284C7) !important;
}
.dap-modal-button.secondary,
.dap-modal-button.outline {
  background: transparent !important;
  color: var(--dap-modal-ink) !important;
  border-color: var(--dap-border-strong) !important;
}
.dap-modal-button.secondary:hover,
.dap-modal-button.outline:hover {
  background: var(--dap-modal-hover-bg) !important;
}

.dap-modal-buttons {
  display: flex !important;
  flex-wrap: wrap !important;
  justify-content: flex-start !important;
  gap: 8px !important;
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   KNOWLEDGE BASE \u2014 Professional 2-Column Grid
   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

.dap-content-kb {
  display: flex !important;
  flex-direction: column !important;
  gap: 0 !important;
}

/* \u2500\u2500 KB Header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-head {
  padding: 14px 16px 0 !important;
  background: linear-gradient(180deg, var(--dap-kb-primary-soft) 0%, transparent 100%) !important;
  border-bottom: 1px solid var(--dap-border-strong) !important;
}

.dap-kb-head-top {
  display: flex !important;
  align-items: center !important;
  gap: 9px !important;
  margin-bottom: 11px !important;
}

.dap-kb-icon-wrap {
  width: 28px !important;
  height: 28px !important;
  border-radius: 7px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
}

.dap-kb-section-title {
  font-size: 15px !important;
  font-weight: 700 !important;
  color: #000000 !important;
  flex: 1 !important;
  margin: 0 !important;
}

.dap-kb-section-subtitle {
  font-size: 13px !important;
  color: var(--dap-modal-ink-subtle) !important;
}

.dap-kb-count-badge {
  display: inline-flex !important;
  align-items: center !important;
  padding: 2px 8px !important;
  border-radius: 999px !important;
  background: var(--dap-kb-primary-soft) !important;
  border: 1px solid var(--dap-kb-primary-light) !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  color: var(--dap-kb-primary-dark) !important;
  white-space: nowrap !important;
}

/* \u2500\u2500 KB Search \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-search-wrap {
  position: relative !important;
  margin-bottom: 9px !important;
}
.dap-kb-search-icon {
  position: absolute !important;
  left: 9px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  color: var(--dap-modal-ink-subtle) !important;
  pointer-events: none !important;
  display: flex !important;
}
.dap-kb-search-input {
  width: 100% !important;
  height: 34px !important;
  padding: 0 10px 0 30px !important;
  border-radius: 9px !important;
  border: 1px solid var(--dap-border-strong) !important;
  background: #ffffff !important;
  font-size: 14px !important;
  color: #000000 !important;
  font-family: inherit !important;
  outline: none !important;
  box-sizing: border-box !important;
  transition: border-color 0.15s, box-shadow 0.15s !important;
}
.dap-kb-search-input:focus {
  border-color: var(--dap-primary) !important;
  box-shadow: 0 0 0 3px var(--dap-primary-glow, rgba(14,165,233,0.18)) !important;
}
.dap-kb-search-input::placeholder { color: var(--dap-modal-ink-subtle) !important; }

/* \u2500\u2500 Filter Chips \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-filter-row {
  display: flex !important;
  gap: 5px !important;
  flex-wrap: wrap !important;
  padding-bottom: 11px !important;
}
.dap-kb-filter-chip {
  padding: 3px 10px !important;
  border-radius: 100px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  border: 1px solid var(--dap-border-strong) !important;
  background: #ffffff !important;
  color: var(--dap-modal-ink-muted) !important;
  cursor: pointer !important;
  transition: all 0.14s !important;
  user-select: none !important;
  font-family: inherit !important;
}
.dap-kb-filter-chip:hover {
  border-color: var(--dap-primary) !important;
  color: var(--dap-primary) !important;
  background: var(--dap-kb-primary-soft) !important;
}
.dap-kb-filter-chip.active {
  background: var(--dap-primary) !important;
  border-color: var(--dap-primary) !important;
  color: #ffffff !important;
}

/* \u2500\u2500 Grid Body \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-body {
  padding: 12px 16px 16px !important;
}
.dap-kb-grid {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 7px !important;
}

/* \u2500\u2500 KB Card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-card {
  background: var(--dap-modal-hover-bg, #f8fafc) !important;
  border: 1px solid var(--dap-border-strong) !important;
  border-radius: 11px !important;
  padding: 9px 10px !important;
  cursor: pointer !important;
  transition: border-color 0.18s, background 0.18s, box-shadow 0.18s, transform 0.18s !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 5px !important;
  position: relative !important;
  overflow: hidden !important;
  text-align: left !important;
  width: 100% !important;
  font-family: inherit !important;
}

/* Left accent bar */
.dap-kb-card::before {
  content: '' !important;
  position: absolute !important;
  left: 0 !important; top: 0 !important; bottom: 0 !important;
  width: 3px !important;
  background: var(--dap-primary) !important;
  opacity: 0 !important;
  transition: opacity 0.18s !important;
}
.dap-kb-card:hover {
  border-color: var(--dap-primary) !important;
  background: var(--dap-kb-primary-soft) !important;
  box-shadow: 0 0 0 3px var(--dap-primary-glow, rgba(14,165,233,0.15)) !important;
  transform: translateY(-1px) !important;
}
.dap-kb-card:hover::before { opacity: 1 !important; }
.dap-kb-card:active { transform: translateY(0) !important; }

/* \u2500\u2500 Card Top \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-card-top {
  display: flex !important;
  align-items: flex-start !important;
  gap: 9px !important;
}

.dap-kb-card-type-icon {
  width: 24px !important;
  height: 24px !important;
  border-radius: 6px !important;
  background: var(--dap-kb-primary-soft) !important;
  border: 1px solid var(--dap-kb-primary-light) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 13px !important;
  flex-shrink: 0 !important;
  transition: transform 0.2s !important;
}
.dap-kb-card:hover .dap-kb-card-type-icon { transform: scale(1.07) !important; }

.dap-kb-card-info {
  flex: 1 !important;
  min-width: 0 !important;
}

.dap-kb-card-title {
  font-size: 13.5px !important;
  font-weight: 600 !important;
  color: #000000 !important;
  line-height: 1.3 !important;
  margin: 0 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/* \u2500\u2500 Type Badge \u2014 colored pill on each card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-card-type-badge {
  display: inline-flex !important;
  align-items: center !important;
  gap: 2px !important;
  padding: 1px 6px !important;
  border-radius: 100px !important;
  font-size: 11.5px !important;
  font-weight: 600 !important;
  letter-spacing: 0.05em !important;
  text-transform: uppercase !important;
  margin-top: 2px !important;
  border: 1px solid transparent !important;
  font-family: 'JetBrains Mono', monospace !important;
  line-height: 1.4 !important;
}

.dap-kb-badge-link    { background: #EFF6FF !important; color: #1D4ED8 !important; border-color: #BFDBFE !important; }
.dap-kb-badge-article { background: #F0F9FF !important; color: #0369A1 !important; border-color: #BAE6FD !important; }
.dap-kb-badge-image   { background: #F0FDF4 !important; color: #15803D !important; border-color: #BBF7D0 !important; }
.dap-kb-badge-video   { background: #FFF7ED !important; color: #C2410C !important; border-color: #FED7AA !important; }
.dap-kb-badge-youtube { background: #FEF2F2 !important; color: #B91C1C !important; border-color: #FECACA !important; }
.dap-kb-badge-pdf     { background: #FEF2F2 !important; color: #B91C1C !important; border-color: #FECACA !important; }
.dap-kb-badge-docx,
.dap-kb-badge-doc     { background: #EFF6FF !important; color: #1D4ED8 !important; border-color: #BFDBFE !important; }
.dap-kb-badge-pptx,
.dap-kb-badge-ppt     { background: #FDF4FF !important; color: #7E22CE !important; border-color: #E9D5FF !important; }
.dap-kb-badge-xlsx,
.dap-kb-badge-xls     { background: #F0FDF4 !important; color: #15803D !important; border-color: #BBF7D0 !important; }

.dap-kb-card-desc {
  font-size: 13.5px !important;
  color: var(--dap-modal-ink-muted) !important;
  line-height: 1.5 !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
}

.dap-kb-card-footer {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  padding-top: 8px !important;
  border-top: 1px solid var(--dap-border-strong) !important;
  margin-top: auto !important;
}

/* Arrow fills on hover */
.dap-kb-card-arrow {
  width: 18px !important;
  height: 18px !important;
  border-radius: 4px !important;
  background: transparent !important;
  border: 1px solid var(--dap-border-strong) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: var(--dap-modal-ink-subtle) !important;
  font-size: 13px !important;
  transition: all 0.18s !important;
  flex-shrink: 0 !important;
}
.dap-kb-card:hover .dap-kb-card-arrow {
  background: var(--dap-primary) !important;
  border-color: var(--dap-primary) !important;
  color: #ffffff !important;
}

/* \u2500\u2500 Empty State \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-empty {
  grid-column: 1 / -1 !important;
  text-align: center !important;
  padding: 28px 16px !important;
  color: var(--dap-modal-ink-muted) !important;
  font-size: 14px !important;
  border: 1px dashed var(--dap-border-strong) !important;
  border-radius: 10px !important;
}
.dap-kb-empty-icon { font-size: 26px !important; display: block !important; margin-bottom: 7px !important; }

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   KB ITEM VIEWER
   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

.dap-content-kb-viewer {
  padding: 16px !important;
}

.dap-kb-item-viewer {
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
}

.dap-kb-viewer-header {
  padding-bottom: 14px !important;
  border-bottom: 1px solid var(--dap-border-strong) !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 9px !important;
}

.dap-kb-back-button {
  align-self: flex-start !important;
  font-size: 12px !important;
  padding: 5px 11px !important;
}

.dap-kb-item-title {
  margin: 4px 0 0 0 !important;
  font-size: 17px !important;
  font-weight: 600 !important;
  color: var(--dap-modal-ink) !important;
  line-height: 1.35 !important;
}

.dap-file-metadata {
  margin: 4px 0 0 0 !important;
  font-size: 13px !important;
  color: var(--dap-modal-ink-muted) !important;
  font-family: 'JetBrains Mono', monospace !important;
}

.dap-file-type-badge {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  padding: 3px 9px !important;
  background: var(--dap-kb-primary-soft) !important;
  color: var(--dap-primary) !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
  letter-spacing: 0.05em !important;
  text-transform: uppercase !important;
  border: 1px solid var(--dap-kb-primary-light) !important;
}

/* \u2500\u2500 Media in KB viewer \u2014 full width, natural sizes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-image {
  width: 100% !important;
  border-radius: 10px !important;
  border: 1px solid var(--dap-border-strong) !important;
  display: block !important;
  object-fit: cover !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12) !important;
}

.dap-kb-video {
  width: 100% !important;
  border-radius: 10px !important;
  border: 1px solid var(--dap-border-strong) !important;
  display: block !important;
  background: #000 !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2) !important;
}

.dap-kb-youtube {
  width: 100% !important;
  aspect-ratio: 16/9 !important;
  border-radius: 10px !important;
  border: 1px solid var(--dap-border-strong) !important;
  display: block !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
}

/* PDF iframe \u2014 slightly narrowed with side margin */
.dap-kb-pdf-iframe,
.dap-pdf-iframe {
  width: calc(100% - 32px) !important;
  height: 540px !important;
  border: 1px solid var(--dap-border-strong) !important;
  border-radius: 9px !important;
  display: block !important;
  margin: 0 16px !important;
}

/* Document / presentation iframes */
.dap-document-iframe,
.dap-presentation-iframe {
  width: calc(100% - 32px) !important;
  height: 480px !important;
  border: 1px solid var(--dap-border-strong) !important;
  border-radius: 9px !important;
  display: block !important;
  margin: 0 16px !important;
}

/* Web iframe */
.dap-web-iframe {
  width: calc(100% - 32px) !important;
  height: 500px !important;
  border: 1px solid var(--dap-border-strong) !important;
  border-radius: 9px !important;
  display: block !important;
  margin: 0 16px !important;
}

.dap-kb-pdf-container,
.dap-kb-document-container,
.dap-pdf-viewer-container,
.dap-document-viewer-container,
.dap-presentation-viewer-container,
.dap-web-viewer-container {
  display: flex !important;
  flex-direction: column !important;
  gap: 10px !important;
}

/* \u2500\u2500 Article viewer \u2014 matches original (image 2 style) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-article-viewer {
  display: flex !important;
  flex-direction: column !important;
  gap: 16px !important;
}

.dap-article-title {
  margin: 0 0 4px 0 !important;
  font-size: 16px !important;
  font-weight: 700 !important;
  color: var(--dap-modal-ink) !important;
  line-height: 1.4 !important;
}

.dap-article-description {
  margin: 0 0 8px 0 !important;
  color: var(--dap-modal-ink-muted) !important;
  font-size: 15px !important;
  font-weight: 700 !important;
  line-height: 1.65 !important;
}

.dap-article-content {
  font-size: 16px !important;
  font-weight: 700 !important;
  line-height: 1.8 !important;
  color: var(--dap-modal-ink) !important;
  padding: 16px !important;
  background: var(--dap-modal-hover-bg) !important;
  border: 1px solid var(--dap-border-strong) !important;
  border-radius: 10px !important;
}

/* \u2500\u2500 Loading spinner \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-article-loading {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 11px !important;
  padding: 30px 16px !important;
  color: var(--dap-modal-ink-muted) !important;
  font-size: 12.5px !important;
}
.dap-loading-spinner {
  width: 26px !important;
  height: 26px !important;
  border: 2.5px solid var(--dap-border-strong) !important;
  border-top: 2.5px solid var(--dap-primary) !important;
  border-radius: 50% !important;
  animation: dap-spin 0.8s linear infinite !important;
}
@keyframes dap-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* \u2500\u2500 Document / action buttons \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-document-actions,
.dap-enhanced-document-actions,
.dap-web-actions {
  display: flex !important;
  gap: 8px !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  margin-top: 10px !important;
  padding-top: 10px !important;
  border-top: 1px solid var(--dap-border-strong) !important;
}

.dap-action-btn {
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  padding: 7px 14px !important;
  border-radius: 8px !important;
  font-size: 12.5px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.18s ease !important;
  border: 1px solid transparent !important;
  white-space: nowrap !important;
  font-family: inherit !important;
  text-decoration: none !important;
}

.dap-action-btn.dap-primary-btn,
.dap-primary-btn {
  background: var(--dap-primary) !important;
  color: #ffffff !important;
  border-color: var(--dap-primary) !important;
  box-shadow: 0 2px 8px var(--dap-primary-glow, rgba(14,165,233,0.25)) !important;
}
.dap-action-btn.dap-primary-btn:hover,
.dap-primary-btn:hover {
  background: var(--dap-primary-dark, #0284C7) !important;
  transform: translateY(-1px) !important;
}
.dap-action-btn.dap-secondary-btn,
.dap-secondary-btn,
.dap-open-btn {
  background: #ffffff !important;
  color: var(--dap-modal-ink) !important;
  border-color: var(--dap-border-strong) !important;
}
.dap-action-btn.dap-secondary-btn:hover,
.dap-secondary-btn:hover {
  background: var(--dap-modal-hover-bg) !important;
  border-color: var(--dap-primary) !important;
  transform: translateY(-1px) !important;
}

.dap-btn-icon { font-size: 13px !important; line-height: 1 !important; }
.dap-btn-text { line-height: 1 !important; }

/* \u2500\u2500 Fallback viewer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-fallback-viewer,
.dap-enhanced-fallback-viewer {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 10px !important;
  padding: 24px 16px !important;
  text-align: center !important;
  background: var(--dap-modal-hover-bg) !important;
  border: 1px dashed var(--dap-border-strong) !important;
  border-radius: 10px !important;
}
.dap-fallback-icon { font-size: 36px !important; }
.dap-enhanced-fallback-message h4 {
  font-size: 14px !important;
  font-weight: 600 !important;
  color: var(--dap-modal-ink) !important;
  margin: 0 0 6px !important;
}
.dap-fallback-primary { font-size: 12.5px !important; color: var(--dap-modal-ink-muted) !important; margin: 0 0 4px !important; }
.dap-fallback-filename,
.dap-fallback-type { font-size: 11px !important; color: var(--dap-modal-ink-subtle) !important; font-family: monospace !important; margin: 2px 0 !important; }

/* \u2500\u2500 Link / doc info \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-link-container,
.dap-kb-document-info {
  padding: 14px !important;
  background: var(--dap-modal-hover-bg) !important;
  border: 1px solid var(--dap-border-strong) !important;
  border-radius: 9px !important;
}
.dap-kb-link-info h4,
.dap-kb-document-info h4 {
  margin: 0 0 6px !important;
  color: var(--dap-modal-ink) !important;
  font-size: 13.5px !important;
  font-weight: 600 !important;
}
.dap-kb-link-info p,
.dap-kb-document-info p {
  margin: 0 0 4px !important;
  font-size: 12px !important;
  color: var(--dap-modal-ink-muted) !important;
}

.dap-kb-external-btn,
.dap-kb-download-btn {
  display: inline-flex !important;
  align-items: center !important;
  gap: 5px !important;
  padding: 6px 12px !important;
  background: var(--dap-kb-primary-soft) !important;
  border: 1px solid var(--dap-kb-primary-light) !important;
  border-radius: 7px !important;
  color: #000000 !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  cursor: pointer !important;
  transition: all 0.18s !important;
  margin-top: 9px !important;
  font-family: inherit !important;
}
.dap-kb-external-btn:hover,
.dap-kb-download-btn:hover {
  background: var(--dap-kb-primary-light) !important;
  transform: translateY(-1px) !important;
}

/* ===================== Animations ===================== */
@keyframes dap-modal-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes dap-modal-appear {
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
}

/* ===================== Focus ===================== */
.dap-modal:focus-visible        { outline: 2px solid var(--dap-primary) !important; outline-offset: 2px !important; }
.dap-modal-button:focus-visible { outline: 2px solid var(--dap-primary) !important; outline-offset: 2px !important; }
.dap-kb-card:focus-visible      { outline: 2px solid var(--dap-primary) !important; outline-offset: 2px !important; }

/* ===================== Responsive ===================== */
@media (max-width: 640px) {
  .dap-modal {
    width: 95vw !important;
    max-width: 95vw !important;
    max-height: 88vh !important;
  }
  .dap-modal-close {
    top: -11px !important;
    right: -11px !important;
    width: 28px !important;
    height: 28px !important;
    font-size: 16px !important;
  }
  .dap-kb-grid { grid-template-columns: 1fr !important; }
  .dap-kb-head { padding: 12px 13px 0 !important; }
  .dap-kb-body { padding: 11px 13px 13px !important; }
  .dap-document-actions,
  .dap-enhanced-document-actions,
  .dap-web-actions { flex-direction: column !important; align-items: stretch !important; }
  .dap-action-btn { justify-content: center !important; width: 100% !important; }
  .dap-kb-pdf-iframe, .dap-pdf-iframe { height: 420px !important; }
  .dap-document-iframe, .dap-presentation-iframe { height: 380px !important; }
  .dap-web-iframe { height: 380px !important; }
}
`;

  // src/utils/ruleEvaluator.ts
  function evaluateCondition(condition, inputValue) {
    try {
      let targetValue = inputValue;
      if (condition.propertyName && condition.propertyName.startsWith("user.")) {
        targetValue = userContextService.getUserProperty(condition.propertyName) ?? "";
      }
      let conditionValue = condition.value;
      if (condition.valueType === "Number") {
        targetValue = typeof targetValue === "string" ? parseFloat(targetValue) : Number(targetValue);
        conditionValue = Number(condition.value);
        if (isNaN(targetValue) || isNaN(conditionValue)) {
          console.warn(`[DAP] Invalid number comparison: ${targetValue} vs ${condition.value}`);
          return false;
        }
      } else if (condition.valueType === "Boolean") {
        targetValue = typeof targetValue === "string" ? targetValue.toLowerCase() === "true" : Boolean(targetValue);
        conditionValue = typeof condition.value === "string" ? condition.value.toLowerCase() === "true" : Boolean(condition.value);
      } else {
        targetValue = String(targetValue);
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

  // src/utils/selectorResolver.ts
  var STRATEGY_PRIORITY = {
    url: 0,
    // Highest priority — URL validation gate; gates element selection
    data: 1,
    // Most specific, set intentionally by the product team
    id: 2,
    // Fast O(1) native lookup, typically unique per page
    label: 3,
    // Element label validation; used with other element selectors
    css: 4,
    // Flexible but can be fragile with deep or generated selectors
    xpath: 5
    // Most powerful but slowest; used only as last resort
  };
  function parseSelectors(selectorString) {
    if (typeof selectorString !== "string" || selectorString.trim() === "") {
      return [];
    }
    return selectorString.split("|").map((token) => token.trim()).filter((token) => token.length > 0);
  }
  function stripUrlSelectorTokens(selectorString) {
    if (typeof selectorString !== "string" || selectorString.trim() === "") {
      return selectorString;
    }
    const tokens = parseSelectors(selectorString);
    if (tokens.length === 0) return selectorString;
    const elementTokens = tokens.filter((token) => !token.toLowerCase().startsWith("url="));
    return elementTokens.length > 0 ? elementTokens.join("|") : selectorString;
  }
  function classifySelectorToken(token) {
    const lower = token.toLowerCase();
    if (lower.startsWith("url=")) {
      return {
        raw: token,
        strategy: "url",
        expression: token.slice("url=".length)
      };
    }
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
      // ── URL-based locator ──────────────────────────────────────────────────
      // Priority 0 (highest) — URL validation gate.
      // This is a pre-flight check that gates whether we use other selectors.
      // In normal operation, URL validation happens in resolveSelectorWithPriority
      // or resolveSelectorWithCache before any element selection is attempted.
      // This case should rarely be hit, but we include it for defensive completeness.
      case "url": {
        console.debug(`[DAP] URL selector reached element resolution (unexpected); skipping`);
        return null;
      }
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
  function isElementVisibleInDOM(el) {
    if (!el || !el.isConnected) return false;
    if (el.offsetParent === null) {
      const style = window.getComputedStyle(el);
      if (style.display === "none") return false;
      if (style.position !== "fixed") return false;
    }
    return true;
  }
  function resolveSelectorWithCache(stepId, selectorString) {
    if (typeof stepId !== "string" || stepId.trim() === "") return null;
    if (typeof selectorString !== "string" || selectorString.trim() === "") return null;
    const cachedEntry = selectorCache[stepId];
    if (cachedEntry !== void 0) {
      if (cachedEntry.source !== selectorString) {
        console.debug(
          `[DAP] Selector cache source changed: step "${stepId}" from "${cachedEntry.source}" to "${selectorString}" \u2014 refreshing cache`
        );
        evictCacheEntry(stepId);
      } else {
        const el = resolveSingleSelector(cachedEntry.token);
        if (el && isElementVisibleInDOM(el)) {
          console.debug(
            `[DAP] Selector resolved: "${cachedEntry.token}" (cache hit, step "${stepId}")`,
            el
          );
          return el;
        }
        console.debug(
          `[DAP] Selector cache evicted: step "${stepId}", token "${cachedEntry.token}" \u2014 element detached, removed, or CSS-hidden`
        );
        evictCacheEntry(stepId);
      }
    } else {
      console.debug(`[DAP] Selector cache miss: step "${stepId}" \u2014 running full priority resolution on "${selectorString}"`);
    }
    const tokens = parseSelectors(selectorString);
    if (tokens.length === 0) return null;
    for (const token of tokens) {
      if (token.toLowerCase().startsWith("url=")) {
        const storedPath = token.slice("url=".length);
        try {
          const currentUrl = new URL(window.location.href);
          const currentPathname = currentUrl.pathname || "";
          let storedPathname = storedPath.split(/[?#]/)[0];
          let isAbsolute = /^https?:\/\//i.test(storedPathname);
          let storedOrigin = "";
          if (isAbsolute) {
            try {
              const parsedStored = new URL(storedPathname);
              storedPathname = parsedStored.pathname;
              storedOrigin = parsedStored.origin;
            } catch {
            }
          }
          if (isAbsolute && storedOrigin && currentUrl.origin !== storedOrigin) {
            console.debug(
              `[DAP] Selector URL origin mismatch: stored origin "${storedOrigin}" does not match current page origin "${currentUrl.origin}" \u2014 skipping entire selector string`
            );
            return null;
          }
          const normalizePath = (p) => {
            let str = p.trim();
            if (!str.startsWith("/")) str = "/" + str;
            return str.endsWith("/") && str.length > 1 ? str.slice(0, -1) : str;
          };
          const normalizedCurrent = normalizePath(currentPathname);
          const normalizedStored = normalizePath(storedPathname);
          if (normalizedCurrent !== normalizedStored) {
            console.debug(
              `[DAP] Selector URL mismatch: stored "${storedPathname}" does not match current page "${currentPathname}" \u2014 skipping entire selector string`
            );
            return null;
          }
        } catch (e) {
          console.debug(`[DAP] Selector URL parse error`, e);
          return null;
        }
        break;
      }
    }
    const parsed = tokens.map((t) => {
      const lower = t.toLowerCase();
      if (lower.startsWith("url=")) return { raw: t, strategy: "url", expression: t.slice(4) };
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
    const buckets = [[], [], [], [], [], [], []];
    for (const p of parsed) {
      if (p.strategy === "unknown") {
        buckets[6].push(p);
      } else if (p.strategy === "url") {
        buckets[0].push(p);
      } else {
        buckets[STRATEGY_PRIORITY[p.strategy]].push(p);
      }
    }
    for (let i = 1; i < buckets.length; i++) {
      const bucket = buckets[i];
      for (const p of bucket) {
        const el = resolveSingleSelector(p.raw);
        if (el && isElementVisibleInDOM(el)) {
          selectorCache[stepId] = {
            source: selectorString,
            token: p.raw
          };
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
    for (const token of tokens) {
      if (token.toLowerCase().startsWith("url=")) {
        const storedPath = token.slice("url=".length);
        try {
          const currentUrl = new URL(window.location.href);
          const currentPathname = currentUrl.pathname || "";
          let storedPathname = storedPath.split(/[?#]/)[0];
          let isAbsolute = /^https?:\/\//i.test(storedPathname);
          let storedOrigin = "";
          if (isAbsolute) {
            try {
              const parsedStored = new URL(storedPathname);
              storedPathname = parsedStored.pathname;
              storedOrigin = parsedStored.origin;
            } catch {
            }
          }
          if (isAbsolute && storedOrigin && currentUrl.origin !== storedOrigin) {
            console.debug(
              `[DAP] Selector URL origin mismatch: stored origin "${storedOrigin}" does not match current page origin "${currentUrl.origin}" \u2014 skipping entire selector string`
            );
            return null;
          }
          const normalizePath = (p) => {
            let str = p.trim();
            if (!str.startsWith("/")) str = "/" + str;
            return str.endsWith("/") && str.length > 1 ? str.slice(0, -1) : str;
          };
          const normalizedCurrent = normalizePath(currentPathname);
          const normalizedStored = normalizePath(storedPathname);
          if (normalizedCurrent !== normalizedStored) {
            console.debug(
              `[DAP] Selector URL mismatch: stored "${storedPathname}" does not match current page "${currentPathname}" \u2014 skipping entire selector string`
            );
            return null;
          } else {
            console.debug(
              `[DAP] Selector URL validated: "${storedPathname}" matches current page`
            );
          }
        } catch (e) {
          console.debug(`[DAP] Selector URL parse error`, e);
          return null;
        }
        break;
      }
    }
    const parsed = tokens.map(classifySelectorToken);
    const buckets = [[], [], [], [], [], [], []];
    for (const p of parsed) {
      if (p.strategy === "unknown") {
        buckets[6].push(p);
      } else if (p.strategy === "url") {
        buckets[0].push(p);
      } else {
        buckets[STRATEGY_PRIORITY[p.strategy]].push(p);
      }
    }
    for (let i = 1; i < buckets.length; i++) {
      const bucket = buckets[i];
      for (const p of bucket) {
        const el = resolveSingleSelector(p.raw);
        if (el) return el;
      }
    }
    return null;
  }
  function extractUrlFromSelector(selectorString) {
    if (typeof selectorString !== "string" || !selectorString) return null;
    const tokens = parseSelectors(selectorString);
    for (const token of tokens) {
      if (token.toLowerCase().startsWith("url=")) {
        return token.slice(4).trim();
      }
    }
    return null;
  }

  // src/utils/urlPatternMatcher.ts
  function matchUrlPattern(pattern, pageCtx) {
    let p = pattern.trim();
    if (p.toLowerCase().startsWith("url=") || p.includes("|")) {
      p = extractUrlFromSelector(p) || p;
    }
    let isAbsolute = /^https?:\/\//i.test(p);
    let patternOrigin = "";
    if (isAbsolute) {
      try {
        const parsedUrl = new URL(p);
        p = parsedUrl.pathname;
        patternOrigin = parsedUrl.origin;
      } catch (e) {
      }
    }
    if (isAbsolute && patternOrigin) {
      try {
        const currentOrigin = new URL(pageCtx.href || window.location.href).origin;
        if (currentOrigin !== patternOrigin) {
          return false;
        }
      } catch (e) {
        if (window.location.origin !== patternOrigin) {
          return false;
        }
      }
    }
    const path = pageCtx.pathname;
    const normP = p.startsWith("/") ? p : `/${p}`;
    if (!normP.includes("*")) {
      return path === normP || path === normP.replace(/\/$/, "") || `${normP}/` === path;
    }
    const regexStr = "^" + normP.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + // * → .*
    "$";
    return new RegExp(regexStr, "i").test(path);
  }
  function resolveNavigationUrl(targetUrl) {
    let stepPath = targetUrl;
    if (stepPath.toLowerCase().startsWith("url=") || stepPath.includes("|")) {
      stepPath = extractUrlFromSelector(stepPath) || stepPath;
    }
    if (stepPath.includes("*")) {
      stepPath = stepPath.replace(/\*.*$/, "");
      if (!stepPath || stepPath === "/") {
        stepPath = targetUrl.replace(/\*/g, "");
      }
    }
    let finalUrl = stepPath;
    if (!finalUrl.startsWith("http")) {
      const mainUrl = window.location.origin;
      const normalizedPath = finalUrl.startsWith("/") ? finalUrl : "/" + finalUrl;
      finalUrl = mainUrl + normalizedPath;
    }
    return finalUrl;
  }
  function isNavigationNeeded(targetUrl) {
    if (!targetUrl) {
      return false;
    }
    let cleanedUrl = targetUrl;
    if (cleanedUrl.toLowerCase().startsWith("url=") || cleanedUrl.includes("|")) {
      cleanedUrl = extractUrlFromSelector(cleanedUrl) || cleanedUrl;
    }
    if (cleanedUrl.includes("*")) {
      const pageCtx = {
        href: window.location.href,
        pathname: window.location.pathname,
        hash: window.location.hash,
        search: window.location.search,
        timestamp: Date.now()
      };
      if (matchUrlPattern(cleanedUrl, pageCtx)) {
        return false;
      }
    }
    const currentUrl = window.location.href;
    const targetNavigationUrl = resolveNavigationUrl(cleanedUrl);
    try {
      const current = new URL(currentUrl);
      const target = new URL(targetNavigationUrl);
      if (current.origin !== target.origin) {
        return true;
      }
      const currentPath = current.pathname.replace(/\/$/, "");
      const targetPath = target.pathname.replace(/\/$/, "");
      if (currentPath !== targetPath) {
        return true;
      }
      if (target.search && current.search !== target.search) {
        return true;
      }
      if (target.hash && current.hash !== target.hash) {
        return true;
      }
      return false;
    } catch (e) {
      const currentBase = currentUrl.split("?")[0].split("#")[0].replace(/\/$/, "");
      const targetBase = targetNavigationUrl.split("?")[0].split("#")[0].replace(/\/$/, "");
      return currentBase !== targetBase;
    }
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
      const normalizedKind = step.kind?.toLowerCase() || "";
      switch (normalizedKind) {
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
        case "microsurvey":
        case "survey":
          const surveyData = step.survey || step.microsurvey;
          if (surveyData) {
            await renderSurveyStep(surveyData, stepIndex);
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
      if (step.description) {
        const desc = document.createElement("p");
        desc.className = "dap-modal-description";
        desc.textContent = step.description;
        const titleEl = header.querySelector(".dap-header-text");
        if (titleEl) {
          header.insertBefore(desc, titleEl.nextSibling);
        } else {
          header.appendChild(desc);
        }
      }
      const body = modalShell.modal.querySelector(".dap-modal-body");
      if (step.body && Array.isArray(step.body)) {
        step.body.forEach((content) => {
          const contentEl = renderModalContent(content, step);
          if (contentEl) body.appendChild(contentEl);
        });
      }
      const footer = modalShell.modal.querySelector(".dap-modal-footer");
      footer.classList.add("dap-modal-footer-linear");
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
        const nextStep = payload.steps[currentStepIndex + 1];
        const stepUrl = nextStep?.url || nextStep?.targetUrl;
        const currentUrl = window.location.href;
        if (stepUrl && currentUrl !== stepUrl && isNavigationNeeded(stepUrl)) {
          console.debug(`[DAP] Next step (${nextStep.stepId}) requires page navigation to: ${stepUrl}`);
          cleanupCurrentStep();
          document.removeEventListener("keydown", onKeyDown, true);
          prevActive?.focus();
          if (completionTracker?.onStepAdvance) {
            const nextStepId = nextStep.stepId || `step-${currentStepIndex + 2}`;
            completionTracker.onStepAdvance(nextStepId);
          }
          const navigationUrl = resolveNavigationUrl(stepUrl);
          console.debug(`[DAP] Navigating to: ${navigationUrl}`);
          window.location.assign(navigationUrl);
          return;
        }
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

  // src/utils/confirmClose.ts
  function showConfirmClose({ onConfirm, onCancel, zIndex = 2147483647 }) {
    const overlay = document.createElement("div");
    overlay.className = "dap-confirm-overlay";
    overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: ${zIndex};
    backdrop-filter: blur(2px);
    animation: dapFadeIn 0.2s ease-out;
  `;
    const card = document.createElement("div");
    card.className = "dap-confirm-card";
    card.style.cssText = `
    background: #ffffff;
    padding: 32px;
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    max-width: 400px;
    width: 90%;
    text-align: left;
    animation: dapSlideUp 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  `;
    const title = document.createElement("h3");
    title.textContent = "Sure you want to close this tour?";
    title.style.cssText = `
    margin: 0 0 24px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: #2D3E50;
    line-height: 1.4;
  `;
    const actions = document.createElement("div");
    actions.style.cssText = `
    display: flex;
    gap: 12px;
  `;
    const yesBtn = document.createElement("button");
    yesBtn.textContent = "Yes, close";
    yesBtn.style.cssText = `
    padding: 12px 24px;
    background: #FF7A59;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  `;
    yesBtn.onmouseover = () => yesBtn.style.backgroundColor = "#FF8F73";
    yesBtn.onmouseout = () => yesBtn.style.backgroundColor = "#FF7A59";
    yesBtn.onclick = () => {
      document.body.removeChild(overlay);
      onConfirm();
    };
    const noBtn = document.createElement("button");
    noBtn.textContent = "No";
    noBtn.style.cssText = `
    padding: 12px 32px;
    background: #ffffff;
    color: #FF7A59;
    border: 1px solid #FF7A59;
    border-radius: 6px;
    font-family: inherit;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  `;
    noBtn.onmouseover = () => noBtn.style.backgroundColor = "#FFF1EE";
    noBtn.onmouseout = () => noBtn.style.backgroundColor = "#ffffff";
    noBtn.onclick = () => {
      document.body.removeChild(overlay);
      if (onCancel) onCancel();
    };
    actions.appendChild(yesBtn);
    actions.appendChild(noBtn);
    card.appendChild(title);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    if (!document.getElementById("dap-confirm-styles")) {
      const style = document.createElement("style");
      style.id = "dap-confirm-styles";
      style.textContent = `
      @keyframes dapFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes dapSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    `;
      document.head.appendChild(style);
    }
  }

  // src/experiences/modal.ts
  var modalCssText2 = `
/* Font stack: system fonts are used; no external font requests are made. */

:root {
  --dap-bg-glass:        var(--dap-overlay, rgba(15, 23, 42, 0.18));
  --dap-bg-surface:      var(--dap-surface, #ffffff);
  --dap-bg-elevated:     var(--dap-surface-alt, #F0F9FF);
  --dap-bg-hover:        var(--dap-surface-hover, #E0F2FE);
  --dap-border:          var(--dap-border, #94A3B8);
  --dap-border-glow:     var(--dap-border-fallback, #94A3B8);
  --dap-accent:          var(--dap-primary, #0EA5E9);
  --dap-accent-soft:     var(--dap-primary-light, #F0F9FF);
  --dap-accent-glow:     var(--dap-primary-glow, rgba(219, 234, 254, 0.28));
  --dap-text-primary:    var(--dap-ink, #000000);
  --dap-text-secondary:  var(--dap-ink-muted, #000000);
  --dap-text-muted:      var(--dap-ink-subtle, #000000);
  --dap-success:         #16a34a;
  --dap-warning:         #d97706;
  --dap-danger:          #dc2626;
  --dap-radius-sm:       10px;
  --dap-radius-md:       16px;
  --dap-radius-lg:       20px;
  --dap-radius-xl:       24px;
  --dap-shadow-deep:     var(--dap-shadow-soft, 0 24px 64px rgba(15,23,42,0.12), 0 8px 24px rgba(15,23,42,0.08));
  --dap-shadow-glow:     0 12px 32px var(--dap-primary-glow, rgba(59, 130, 246, 0.16));
  --dap-transition:      cubic-bezier(0.22, 1, 0.36, 1);
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
  background: var(--dap-bg-glass);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
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
  background: var(--dap-glass-bg, var(--dap-bg-surface));
  backdrop-filter: var(--dap-glass-blur, blur(8px));
  -webkit-backdrop-filter: var(--dap-glass-blur, blur(8px));
  border: 1px solid var(--dap-border);
  border-radius: var(--dap-radius-xl);
  box-shadow: var(--dap-shadow-deep), var(--dap-shadow-glow), inset 0 1px 0 rgba(255,255,255,0.7);
  display: flex;
  flex-direction: column;
  max-height: 88vh;
  width: 100%;
  overflow: visible;
  animation: dapModalIn 0.45s var(--dap-transition) both;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: #000000 !important;
  will-change: transform;
}

.dap-modal > .dap-modal-header,
.dap-modal > .dap-modal-footer {
  overflow: hidden;
}

.dap-modal > .dap-modal-body {
  overflow-y: auto;
  overflow-x: hidden;
}

.dap-modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: var(--dap-gradient, linear-gradient(90deg, transparent, var(--dap-accent), transparent));
  opacity: 0.6;
  z-index: 1;
  pointer-events: none;
}

@keyframes dapModalIn {
  from { opacity: 0; transform: scale(0.88) translateY(24px); filter: blur(6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
}

@keyframes dapModalOut {
  from { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
  to   { opacity: 0; transform: scale(0.92) translateY(-16px); filter: blur(4px); }
}

/* Size Variants */
.dap-modal-small  { max-width: 420px; }
.dap-modal-medium { max-width: 600px; }
.dap-modal-large  { max-width: 800px; }
.dap-modal-xl     { max-width: 1000px; }
.dap-modal-full   { max-width: calc(100vw - 40px); max-height: calc(100vh - 40px); }

/* \u2500\u2500 Header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--dap-border);
  background: linear-gradient(180deg, var(--dap-primary-soft, var(--dap-bg-hover)) 0%, var(--dap-bg-surface) 100%);
  flex-shrink: 0;
  position: relative;
  cursor: default;
  gap: 4px;
  transition: background 0.2s;
  border-radius: var(--dap-radius-xl) var(--dap-radius-xl) 0 0;
}

.dap-modal-header:hover {
  background: linear-gradient(180deg, var(--dap-primary-light, #eff6ff) 0%, var(--dap-bg-surface) 100%);
}

.dap-modal-header.dragging {
  cursor: grabbing;
  background: linear-gradient(180deg, var(--dap-primary-light, #dbeafe) 0%, var(--dap-bg-surface) 100%);
}

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

.dap-modal-header:hover::after { opacity: 1; }

/* \u2500\u2500 Title \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--dap-text-primary, #000000);
  margin: 0;
  flex: 1;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dap-modal-description {
  font-size: 14px;
  font-weight: 500;
  color: var(--dap-text-secondary, #475569);
  margin: 0;
  line-height: 1.4;
}

/* \u2500\u2500 Close Button \u2014 top-right corner \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-close {
  position: absolute;
  top:   -13px;
  right: -13px;
  z-index: 10;
  width:  30px;
  height: 28px;
  border-radius: var(--dap-radius-sm, 10px);
  flex-shrink: 0;
  background: var(--dap-bg-surface, #ffffff);
  color: var(--dap-text-secondary, #475569);
  border: 1.5px solid var(--dap-border, rgba(59, 130, 246, 0.18));
  box-shadow: 0 0 0 1px rgba(15,23,42,0.04), 0 2px 8px rgba(15,23,42,0.10), 0 1px 3px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.80);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  transition: background 160ms var(--dap-ease), color 160ms var(--dap-ease), border-color 160ms var(--dap-ease), transform 160ms var(--dap-ease), box-shadow 160ms var(--dap-ease);
  will-change: transform;
  overflow: hidden;
}

.dap-modal-close::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle at center, rgba(248,113,113,0.18), transparent 70%);
  opacity: 0;
  transition: opacity 160ms;
  pointer-events: none;
}

.dap-modal-close:hover {
  background: #fef2f2;
  border-color: #fecaca;
  color: var(--dap-danger, #dc2626);
  transform: scale(1.10);
  box-shadow: 0 0 0 1px rgba(220,38,38,0.10), 0 4px 14px rgba(220,38,38,0.18), 0 1px 4px rgba(15,23,42,0.08);
}
.dap-modal-close:hover::before { opacity: 1; }
.dap-modal-close:active { transform: scale(0.93); transition-duration: 80ms; }
.dap-modal-close:focus-visible { outline: 2px solid var(--dap-accent, #2563eb); outline-offset: 3px; border-radius: var(--dap-radius-sm, 10px); }

/* \u2500\u2500 Body \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 0;
}

.dap-modal-body::-webkit-scrollbar { width: 4px; }
.dap-modal-body::-webkit-scrollbar-track { background: transparent; }
.dap-modal-body::-webkit-scrollbar-thumb {
  background: var(--dap-gradient, var(--dap-primary-mid, rgba(59,130,246,0.3)));
  border-radius: 2px;
}
.dap-modal-body::-webkit-scrollbar-thumb:hover { background: var(--dap-accent, #2563eb); }

/* \u2500\u2500 Footer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 8px 16px;
  border-top: 1px solid var(--dap-border, rgba(59,130,246,0.14));
  background: linear-gradient(180deg, transparent 0%, rgba(10,10,18,0.05) 100%);
  flex-shrink: 0;
  border-radius: 0 0 var(--dap-radius-xl) var(--dap-radius-xl);
}
.dap-modal-footer:empty { display: none; }

.dap-modal-footer.dap-modal-footer-linear {
  padding: 0;
  gap: 0;
  border-top: 1px solid var(--dap-border, #e2e8f0);
  background: var(--dap-primary-darker, #111827);
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  flex-wrap: wrap;
  overflow: hidden;
}

.dap-footer-text {
  margin: 0;
  margin-right: auto;
  font-size: 13px;
  color: var(--dap-text-muted, #64748b);
  line-height: 1.5;
  font-family: system-ui, -apple-system, sans-serif;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.dap-modal-footer-linear .dap-footer-text {
  display: block;
  width: 100%;
  background-color: #ffffff;
  color: var(--dap-text-primary, #000000);
  padding: 8px 16px;
  font-size: 14.5px;
  font-weight: 400;
  text-align: left;
  margin: 0;
  box-sizing: border-box;
}

.dap-modal-step-counter {
  flex: 1;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 13.5px;
  font-weight: 600;
  padding: 8px 16px;
  margin: 0;
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.dap-modal-nav-btn {
  padding: 8px 24px;
  margin: 0;
  background: var(--dap-primary, #0EA5E9);
  color: #ffffff;
  border: none;
  border-radius: 0;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, filter 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
}

.dap-modal-nav-btn:hover {
  background: var(--dap-primary-dark, #0284c7);
  filter: brightness(1.05);
}
.dap-modal-nav-btn:active {
  background: var(--dap-primary-darker, #0369a1);
  filter: brightness(0.95);
}

/* \u2500\u2500 Non-KB body content gets padding \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-text,
.dap-content-link {
  margin: 0 20px;
}
.dap-content-text:first-child,
.dap-content-link:first-child { margin-top: 20px; }
.dap-content-text:last-child,
.dap-content-link:last-child  { margin-bottom: 20px; }

/* Image/video wraps spacing */
.dap-content-image-wrap,
.dap-content-video-wrap,
.dap-content-youtube-wrap {
  margin-top: 0;
  margin-bottom: 0;
}
.dap-content-image-wrap:first-child,
.dap-content-video-wrap:first-child,
.dap-content-youtube-wrap:first-child { margin-top: 20px; }
.dap-content-image-wrap:last-child,
.dap-content-video-wrap:last-child,
.dap-content-youtube-wrap:last-child  { margin-bottom: 20px; }

/* \u2500\u2500 Text Content \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-text {
  font-size: 14px;
  line-height: 1.7;
  color: var(--dap-text-secondary);
  animation: dapFadeUp 0.4s var(--dap-ease) both;
}
.dap-content-text p { margin: 0 0 10px; }
.dap-content-text p:last-child { margin: 0; }
.dap-content-text h1, .dap-content-text h2, .dap-content-text h3 { color: var(--dap-text-primary); font-weight: 600; margin: 0 0 8px; }
.dap-content-text a { color: #000000; text-decoration: none; border-bottom: 1px solid var(--dap-border-glow); transition: border-color 0.2s; }
.dap-content-text a:hover { border-color: var(--dap-accent); }
.dap-content-text code { font-family: 'JetBrains Mono', monospace; font-size: 13px; background: var(--dap-accent-soft); border: 1px solid var(--dap-border-glow); padding: 2px 6px; border-radius: 4px; color: var(--dap-accent); }

@keyframes dapFadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* \u2500\u2500 Image \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-image-wrap {
  overflow: hidden;
  border-radius: var(--dap-radius-lg);
  margin: 0 20px;
}

.dap-content-image {
  width: 100%;
  max-width: 100%;
  max-height: 500px;
  border-radius: var(--dap-radius-lg);
  display: block;
  object-fit: cover;
  border: 1px solid var(--dap-border);
  animation: dapFadeIn 0.5s var(--dap-ease) both;
  transition: transform 0.4s var(--dap-ease), box-shadow 0.4s;
}
.dap-content-image:hover { transform: scale(1.01); box-shadow: 0 16px 48px rgba(0,0,0,0.4); }

/* \u2500\u2500 Video \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-video-wrap {
  margin: 0 20px;
}

.dap-content-video {
  width: 100%;
  max-height: 480px;
  border-radius: var(--dap-radius-lg);
  border: 1px solid var(--dap-border);
  background: #000;
  display: block;
  animation: dapFadeIn 0.5s var(--dap-ease) both;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

/* \u2500\u2500 YouTube \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-youtube-wrap {
  margin: 0 20px;
}

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
  padding: 9px 14px;
  background: var(--dap-accent-soft);
  border: 1px solid var(--dap-border-glow);
  border-radius: var(--dap-radius-sm);
  color: #000000;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
}
.dap-content-link:hover { background: var(--dap-primary-light, #eff6ff); transform: translateX(3px); box-shadow: 0 4px 12px var(--dap-primary-glow, rgba(59,130,246,0.18)); }
.dap-content-link::after { content: '\u2197'; font-size: 12px; opacity: 0.7; }

/* \u2500\u2500 Modal Buttons \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-buttons { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }

.dap-modal-button {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 18px; border-radius: var(--dap-radius-sm);
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.22s var(--dap-ease); border: 1px solid transparent;
  letter-spacing: 0.01em; white-space: nowrap; position: relative; overflow: hidden;
}
.dap-modal-button::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(255,255,255,0.08), transparent); opacity: 0; transition: opacity 0.2s; pointer-events: none; }
.dap-modal-button:hover::after { opacity: 1; }

.dap-modal-button.primary { background: var(--dap-accent); color: var(--dap-button-text, #ffffff); border-color: var(--dap-accent); box-shadow: 0 4px 14px var(--dap-accent-glow), inset 0 1px 0 rgba(255,255,255,0.18); }
.dap-modal-button.primary:hover { background: var(--dap-primary-dark, #1d4ed8); border-color: var(--dap-primary-dark, #1d4ed8); transform: translateY(-2px); box-shadow: 0 8px 20px var(--dap-accent-glow), inset 0 1px 0 rgba(255,255,255,0.22); }
.dap-modal-button.primary:active { transform: translateY(0); }
.dap-modal-button.secondary { background: #ffffff; color: var(--dap-text-primary); border-color: var(--dap-border); }
.dap-modal-button.secondary:hover { background: var(--dap-bg-hover); border-color: var(--dap-border-glow); transform: translateY(-1px); }
.dap-modal-button.outline { background: transparent; color: var(--dap-accent); border-color: var(--dap-border-glow); }
.dap-modal-button.outline:hover { background: var(--dap-accent-soft); transform: translateY(-1px); }

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   KNOWLEDGE BASE \u2014 2-COLUMN GRID LAYOUT
   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

.dap-content-kb {
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* \u2500\u2500 KB Header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-head {
  padding: 12px 14px 0;
  background: linear-gradient(180deg, var(--dap-primary-soft, #F0F9FF) 0%, transparent 100%);
  border-bottom: 1px solid var(--dap-border, rgba(14,165,233,0.18));
}

.dap-kb-head-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
}

.dap-kb-icon-wrap {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--dap-gradient, linear-gradient(135deg, var(--dap-primary, #0EA5E9), #38BDF8));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dap-kb-title-block { flex: 1; min-width: 0; }

.dap-kb-section-title {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--dap-text-primary, #0F172A);
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.dap-kb-section-subtitle {
  font-size: 10.5px;
  color: var(--dap-text-muted, #64748B);
  margin-top: 1px;
}

.dap-kb-count-badge {
  padding: 2px 8px;
  background: var(--dap-primary-soft, #F0F9FF);
  border: 1px solid var(--dap-border-glow, rgba(14,165,233,0.28));
  border-radius: 100px;
  font-size: 10px;
  font-weight: 600;
  color: var(--dap-primary-darker, var(--dap-primary, #0369A1));
  letter-spacing: 0.02em;
  white-space: nowrap;
  flex-shrink: 0;
}

/* \u2500\u2500 Search bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-search-wrap {
  position: relative;
  margin-bottom: 8px;
}

.dap-kb-search-icon {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--dap-text-muted, #64748B);
  display: flex;
  align-items: center;
  pointer-events: none;
  z-index: 1;
}

.dap-kb-search-input {
  width: 100%;
  padding: 6px 10px 6px 29px;
  border: 1px solid var(--dap-border-glow, rgba(14,165,233,0.28));
  border-radius: var(--dap-radius-sm, 10px);
  font-size: 11.5px;
  color: var(--dap-text-primary, #0F172A);
  background: var(--dap-bg-surface, #ffffff);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
  box-sizing: border-box;
}
.dap-kb-search-input:focus {
  border-color: var(--dap-primary, #0EA5E9);
  box-shadow: 0 0 0 2px var(--dap-accent-glow, rgba(14,165,233,0.18));
}
.dap-kb-search-input::placeholder { color: var(--dap-text-muted, #64748B); }

/* \u2500\u2500 Filter chips \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-filter-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding-bottom: 10px;
}

.dap-kb-filter-chip {
  padding: 2px 8px;
  border-radius: 100px;
  font-size: 10.5px;
  font-weight: 500;
  border: 1px solid var(--dap-border, rgba(14,165,233,0.18));
  background: var(--dap-bg-surface, #ffffff);
  color: var(--dap-text-muted, #64748B);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  letter-spacing: 0.01em;
}
.dap-kb-filter-chip:hover {
  border-color: var(--dap-primary, #0EA5E9);
  color: var(--dap-primary, #0EA5E9);
  background: var(--dap-primary-soft, #F0F9FF);
}
.dap-kb-filter-chip.active {
  background: var(--dap-primary, #0EA5E9);
  border-color: var(--dap-primary, #0EA5E9);
  color: #ffffff;
}

/* \u2500\u2500 Grid body \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-body {
  padding: 12px 16px 16px;
}

.dap-kb-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

/* \u2500\u2500 Cards \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-card {
  background: var(--dap-bg-elevated, #F8FAFC);
  border: 1px solid var(--dap-border, rgba(14,165,233,0.18));
  border-radius: var(--dap-radius-md, 14px);
  padding: 9px 10px;
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  display: flex;
  flex-direction: column;
  gap: 5px;
  position: relative;
  overflow: hidden;
  text-align: left;
  width: 100%;
  animation: dapFadeUp 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.dap-kb-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--dap-gradient, linear-gradient(180deg, var(--dap-primary, #0EA5E9), #38BDF8));
  opacity: 0;
  transition: opacity 0.2s;
}
.dap-kb-card:hover {
  background: var(--dap-bg-hover, #EFF6FF);
  border-color: var(--dap-border-glow, rgba(14,165,233,0.28));
  transform: translateY(-2px);
  box-shadow: 0 4px 14px var(--dap-accent-glow, rgba(14,165,233,0.12));
}
.dap-kb-card:hover::before { opacity: 1; }
.dap-kb-card:active { transform: translateY(0); }

.dap-kb-card-top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.dap-kb-card-type-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--dap-primary-soft, #F0F9FF);
  border: 1px solid var(--dap-border, rgba(14,165,233,0.18));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
  line-height: 1;
}

.dap-kb-card-info { flex: 1; min-width: 0; }

.dap-kb-card-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--dap-text-primary, #0F172A);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* \u2500\u2500 Type Badge on KB Card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-card-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 100px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-top: 2px;
  font-family: 'JetBrains Mono', monospace;
}

.dap-kb-badge-link    { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
.dap-kb-badge-article { background: #F0F9FF; color: #0369A1; border: 1px solid #BAE6FD; }
.dap-kb-badge-image   { background: #F0FDF4; color: #15803D; border: 1px solid #BBF7D0; }
.dap-kb-badge-video   { background: #FFF7ED; color: #C2410C; border: 1px solid #FED7AA; }
.dap-kb-badge-youtube { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
.dap-kb-badge-pdf     { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
.dap-kb-badge-docx,
.dap-kb-badge-doc     { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
.dap-kb-badge-pptx,
.dap-kb-badge-ppt     { background: #FDF4FF; color: #7E22CE; border: 1px solid #E9D5FF; }
.dap-kb-badge-xlsx,
.dap-kb-badge-xls     { background: #F0FDF4; color: #15803D; border: 1px solid #BBF7D0; }

.dap-kb-card-desc {
  font-size: 11px;
  color: var(--dap-text-muted, #64748B);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dap-kb-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 2px;
}

.dap-kb-card-arrow {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: var(--dap-primary-soft, #F0F9FF);
  border: 1px solid var(--dap-border, rgba(14,165,233,0.18));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dap-primary, #0EA5E9);
  font-size: 10px;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  line-height: 1;
  flex-shrink: 0;
}
.dap-kb-card:hover .dap-kb-card-arrow {
  background: var(--dap-primary, #0EA5E9);
  color: #ffffff;
  border-color: var(--dap-primary, #0EA5E9);
}

/* \u2500\u2500 Empty state \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-empty {
  grid-column: 1 / -1;
  padding: 32px 16px;
  text-align: center;
  border: 1px dashed var(--dap-border-glow, rgba(14,165,233,0.28));
  border-radius: var(--dap-radius-md, 14px);
}
.dap-kb-empty-icon { font-size: 28px; margin-bottom: 8px; display: block; }
.dap-kb-empty p { font-size: 12.5px; color: var(--dap-text-muted, #64748B); }

/* \u2500\u2500 KB Item Viewer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-content-kb-viewer {
  padding: 16px 18px 20px;
}

.dap-kb-item-viewer {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dap-kb-viewer-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--dap-border);
}

.dap-kb-back-button { align-self: flex-start; font-size: 12px; padding: 6px 12px; }

.dap-kb-item-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--dap-text-primary);
  margin: 0;
  line-height: 1.3;
}

.dap-file-metadata {
  font-size: 11.5px;
  color: var(--dap-text-muted);
  font-family: 'JetBrains Mono', monospace;
  margin: 0;
}

/* \u2500\u2500 File Type Badge \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-file-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  background: var(--dap-primary-soft, var(--dap-accent-soft));
  border: 1px solid var(--dap-border-glow);
  border-radius: 100px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--dap-primary, #0EA5E9);
  font-family: 'JetBrains Mono', monospace;
  text-transform: uppercase;
  flex-shrink: 0;
}

/* \u2500\u2500 Media Viewers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* Image in KB viewer \u2014 full width, natural height */
.dap-kb-image {
  width: 100%;
  border-radius: var(--dap-radius-lg);
  display: block;
  object-fit: cover;
  border: 1px solid var(--dap-border);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

/* Video in KB viewer \u2014 full width */
.dap-kb-video {
  width: 100%;
  border-radius: var(--dap-radius-lg);
  border: 1px solid var(--dap-border);
  display: block;
  background: #000;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

.dap-kb-pdf-container, .dap-kb-document-container,
.dap-pdf-viewer-container, .dap-document-viewer-container,
.dap-presentation-viewer-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* PDF iframe \u2014 space between modal edges and iframe */
.dap-kb-pdf-iframe, .dap-pdf-iframe {
  width: 100%;
  height: 520px;
  border: 1px solid var(--dap-border);
  border-radius: var(--dap-radius-md);
  background: rgba(255,255,255,0.02);
  display: block;
  box-sizing: border-box;
}

.dap-document-iframe, .dap-presentation-iframe {
  width: 100%;
  height: 460px;
  border: 1px solid var(--dap-border);
  border-radius: var(--dap-radius-md);
  background: rgba(255,255,255,0.02);
  display: block;
  box-sizing: border-box;
}

/* Iframe containers get horizontal padding for the gap */
.dap-kb-pdf-container, .dap-kb-document-container,
.dap-pdf-viewer-container, .dap-document-viewer-container,
.dap-presentation-viewer-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 4px;
}

.dap-kb-youtube {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: var(--dap-radius-lg);
  border: 1px solid var(--dap-border);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

/* \u2500\u2500 Article Viewer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-article-viewer { display: flex; flex-direction: column; gap: 10px; overflow: visible; min-height: 0; }
.dap-article-title { font-size: 15px; font-weight: 700; color: var(--dap-text-primary); margin: 0; line-height: 1.35; text-align: center; }
.dap-article-description { font-size: 12.5px; color: var(--dap-text-secondary); line-height: 1.6; margin: 0; text-align: center; }
.dap-article-content { font-size: 13.5px; line-height: 1.75; color: var(--dap-text-secondary); padding: 14px 16px; background: var(--dap-bg-elevated); border: 1px solid var(--dap-border); border-radius: var(--dap-radius-md); text-align: center; }

/* \u2500\u2500 Loading \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-article-loading { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 36px 20px; color: var(--dap-text-muted); font-size: 12.5px; }
.dap-loading-spinner { width: 28px; height: 28px; border: 2px solid var(--dap-border); border-top-color: var(--dap-primary, var(--dap-accent)); border-radius: 50%; animation: dapSpin 0.8s linear infinite; }
@keyframes dapSpin { to { transform: rotate(360deg); } }

/* \u2500\u2500 Action Buttons \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-document-actions,
.dap-enhanced-document-actions,
.dap-web-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--dap-border, rgba(59,130,246,0.14));
  flex-shrink: 0;
}

.dap-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 15px;
  border-radius: var(--dap-radius-sm, 10px);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s var(--dap-ease, cubic-bezier(0.22,1,0.36,1));
  border: 1px solid transparent;
  white-space: nowrap;
  letter-spacing: 0.01em;
  text-decoration: none;
}

.dap-action-btn.dap-primary-btn,
.dap-primary-btn {
  background: var(--dap-primary, #0EA5E9);
  color: #ffffff;
  border-color: var(--dap-primary, #0EA5E9);
  box-shadow: 0 2px 10px var(--dap-accent-glow, rgba(14,165,233,0.28));
}
.dap-action-btn.dap-primary-btn:hover,
.dap-primary-btn:hover {
  background: var(--dap-primary-dark, #0284C7);
  border-color: var(--dap-primary-dark, #0284C7);
  transform: translateY(-1px);
}
.dap-action-btn.dap-primary-btn:active,
.dap-primary-btn:active { transform: translateY(0); }

.dap-action-btn.dap-secondary-btn,
.dap-secondary-btn,
.dap-open-btn {
  background: #ffffff;
  color: var(--dap-text-primary, #000000);
  border-color: var(--dap-border-glow, rgba(14,165,233,0.28));
}
.dap-action-btn.dap-secondary-btn:hover,
.dap-secondary-btn:hover,
.dap-open-btn:hover {
  background: var(--dap-bg-hover, #EFF6FF);
  border-color: var(--dap-primary, #0EA5E9);
  transform: translateY(-1px);
}

.dap-btn-icon { font-size: 14px; line-height: 1; flex-shrink: 0; }
.dap-btn-text { line-height: 1; }

/* \u2500\u2500 Fallback Viewers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-fallback-viewer,
.dap-enhanced-fallback-viewer {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 28px 20px; text-align: center;
  background: var(--dap-bg-elevated); border: 1px dashed var(--dap-border);
  border-radius: var(--dap-radius-lg);
}
.dap-fallback-icon { font-size: 36px; line-height: 1; animation: dapFadeIn 0.5s var(--dap-ease); }
.dap-enhanced-fallback-message h4 { font-size: 14px; font-weight: 600; color: var(--dap-text-primary); margin: 0 0 6px; }
.dap-fallback-primary { font-size: 13px; color: var(--dap-text-secondary); margin: 0 0 4px; }
.dap-fallback-filename, .dap-fallback-type { font-size: 11.5px; font-family: 'JetBrains Mono', monospace; color: var(--dap-text-muted); margin: 2px 0 0; }

/* \u2500\u2500 Link / Doc Info \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-kb-link-container { padding: 16px; background: var(--dap-bg-elevated); border: 1px solid var(--dap-border); border-radius: var(--dap-radius-md); }
.dap-kb-link-info h4 { margin: 0 0 6px; color: var(--dap-text-primary); font-size: 14px; }
.dap-kb-link-info p  { margin: 0 0 4px; font-size: 12.5px; color: var(--dap-text-muted); }
.dap-kb-document-info { padding: 16px; background: var(--dap-bg-elevated); border: 1px solid var(--dap-border); border-radius: var(--dap-radius-md); }
.dap-kb-document-info h4 { margin: 0 0 6px; color: var(--dap-text-primary); font-size: 14px; }
.dap-kb-external-btn, .dap-kb-download-btn { display: inline-flex; align-items: center; gap: 5px; padding: 7px 13px; background: var(--dap-accent-soft); border: 1px solid var(--dap-border-glow); border-radius: var(--dap-radius-sm); color: #000000; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.2s; margin-top: 10px; }
.dap-kb-external-btn:hover, .dap-kb-download-btn:hover { background: var(--dap-primary-light, #eff6ff); transform: translateY(-1px); }

/* \u2500\u2500 Web Content Viewer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-web-viewer-container { display: flex; flex-direction: column; gap: 12px; padding: 0 4px; }
.dap-web-iframe { border-radius: var(--dap-radius-md) !important; width: 100%; height: 480px; border: 1px solid var(--dap-border); display: block; box-sizing: border-box; }

/* \u2500\u2500 Misc Animations \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@keyframes dapFadeIn { from { opacity: 0; } to { opacity: 1; } }

/* \u2500\u2500 Responsive \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@media (max-width: 600px) {
  .dap-modal-overlay { padding: 10px; }
  .dap-modal { border-radius: var(--dap-radius-lg); }
  .dap-modal-header { padding: 12px 14px 10px; }
  .dap-modal-footer { padding: 10px 14px; }
  .dap-modal-title { font-size: 13.5px; }
  .dap-modal-button { padding: 8px 14px; font-size: 12.5px; }
  .dap-modal-close { width: 28px; height: 24px; font-size: 13px; top: -10px; right: -10px; }

  .dap-modal-nav-btn {
    width: 100%;
    padding: 12px 20px;
  }

  .dap-kb-grid { grid-template-columns: 1fr !important; }
  .dap-kb-head { padding: 12px 14px 0; }
  .dap-kb-body { padding: 12px 14px 14px; }
  .dap-kb-filter-row { gap: 4px; }
  .dap-document-actions, .dap-enhanced-document-actions, .dap-web-actions { flex-direction: column; align-items: stretch; }
  .dap-action-btn { justify-content: center; width: 100%; }
  .dap-kb-pdf-iframe, .dap-pdf-iframe { height: 420px; }
  .dap-document-iframe, .dap-presentation-iframe { height: 380px; }
}

/* \u2500\u2500 Focus Visible \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal *:focus-visible { outline: 2px solid var(--dap-accent); outline-offset: 3px; border-radius: 4px; }
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
    overlay.id = `dap-modal-overlay-${id}`;
    document.documentElement.appendChild(overlay);
    const prevActive = document.activeElement;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "modal-title");
    setupModalAccessibility(modal);
    let _modalClosed = false;
    function closeModal() {
      if (_modalClosed) return;
      if (payload.executionMode === "Linear") {
        showConfirmClose({
          onConfirm: () => {
            _modalClosed = true;
            document.removeEventListener("keydown", handleKeyboard);
            if (modal._accessibilityCleanup) {
              modal._accessibilityCleanup();
            }
            overlay.style.animation = "dapOverlayOut 0.28s var(--dap-ease) both";
            modal.style.animation = "dapModalOut 0.28s var(--dap-ease) both";
            overlay.addEventListener("animationend", () => {
              if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
                payload._completionTracker?.onAbort?.();
              }
            }, { once: true });
          }
        });
        return;
      }
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
    function advanceModal() {
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
          console.debug(`[DAP] Advancing modal flow: ${id}`);
          completionTracker.onComplete();
        }
      }, 280);
    }
    const closeBtn = modal.querySelector(".dap-modal-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    const navBtn = modal.querySelector(".dap-modal-nav-btn");
    if (navBtn) navBtn.addEventListener("click", advanceModal);
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
    const closeBtn = document.createElement("button");
    closeBtn.className = "dap-modal-close";
    closeBtn.setAttribute("aria-label", "Close modal");
    closeBtn.innerHTML = "\xD7";
    modal.appendChild(closeBtn);
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
    if (payload.description) {
      const desc = document.createElement("p");
      desc.className = "dap-modal-description";
      desc.textContent = payload.description;
      header.appendChild(desc);
    }
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
      textEl.innerHTML = sanitizeHtml(String(payload.body));
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
    if (payload.executionMode === "Linear" || payload.executionMode === "AnyOrder") {
      footer.classList.add("dap-modal-footer-linear");
      if (payload.stepIndex !== void 0 && payload.totalSteps !== void 0) {
        const stepCounter = document.createElement("div");
        stepCounter.className = "dap-modal-step-counter";
        stepCounter.textContent = `Step ${payload.stepIndex + 1} of ${payload.totalSteps}`;
        footer.appendChild(stepCounter);
      }
      if (payload.executionMode === "Linear") {
        const navBtn = document.createElement("button");
        navBtn.type = "button";
        navBtn.className = "dap-modal-nav-btn";
        navBtn.textContent = payload.isLastStep ? "Done" : "Next";
        footer.appendChild(navBtn);
      }
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
        wrap.className = "dap-content-image-wrap";
        const img = document.createElement("img");
        img.className = "dap-content-image";
        img.src = content.url;
        img.alt = content.alt || "";
        wrap.appendChild(img);
        return wrap;
      }
      case "video": {
        if (content.sources && content.sources.length > 0) {
          const wrap = document.createElement("div");
          wrap.className = "dap-content-video-wrap";
          const video = document.createElement("video");
          video.className = "dap-content-video";
          video.controls = true;
          content.sources.forEach((source) => {
            const s = document.createElement("source");
            s.src = source.src;
            if (source.type) s.type = source.type;
            video.appendChild(s);
          });
          wrap.appendChild(video);
          return wrap;
        }
        return null;
      }
      case "youtube": {
        const wrap = document.createElement("div");
        wrap.className = "dap-content-youtube-wrap";
        const iframe = document.createElement("iframe");
        iframe.className = "dap-content-youtube";
        iframe.src = content.href;
        iframe.setAttribute("frameborder", "0");
        iframe.setAttribute("allowfullscreen", "true");
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        wrap.appendChild(iframe);
        return wrap;
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
  var TYPE_EMOJIS = {
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
  var TYPE_LABELS = {
    pdf: "PDF",
    video: "Video",
    image: "Image",
    article: "Article",
    link: "Link",
    youtube: "YouTube",
    docx: "Word Doc",
    doc: "Word Doc",
    pptx: "Slides",
    ppt: "Slides",
    xlsx: "Spreadsheet",
    xls: "Spreadsheet"
  };
  function renderKnowledgeBase(content) {
    const wrapper = document.createElement("div");
    wrapper.className = "dap-content-kb";
    if (!kbState || kbState.view === "item") {
      kbState = {
        view: "list",
        items: content.items || [],
        selectedItem: null,
        title: content.title || "Knowledge Base",
        modalBodyRef: null
      };
    }
    const items = content.items && Array.isArray(content.items) ? content.items : [];
    const head = document.createElement("div");
    head.className = "dap-kb-head";
    const headTop = document.createElement("div");
    headTop.className = "dap-kb-head-top";
    const iconWrap = document.createElement("div");
    iconWrap.className = "dap-kb-icon-wrap";
    iconWrap.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>`;
    const titleBlock = document.createElement("div");
    titleBlock.className = "dap-kb-title-block";
    const headTitle = document.createElement("div");
    headTitle.className = "dap-kb-section-title";
    headTitle.textContent = content.title || "Knowledge Base";
    const headSub = document.createElement("div");
    headSub.className = "dap-kb-section-subtitle";
    headSub.textContent = "Browse all resources";
    titleBlock.appendChild(headTitle);
    titleBlock.appendChild(headSub);
    const countBadge = document.createElement("div");
    countBadge.className = "dap-kb-count-badge";
    countBadge.textContent = `${items.length} item${items.length !== 1 ? "s" : ""}`;
    headTop.appendChild(iconWrap);
    headTop.appendChild(titleBlock);
    headTop.appendChild(countBadge);
    head.appendChild(headTop);
    const searchWrap = document.createElement("div");
    searchWrap.className = "dap-kb-search-wrap";
    const searchIcon = document.createElement("span");
    searchIcon.className = "dap-kb-search-icon";
    searchIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>`;
    const searchInput = document.createElement("input");
    searchInput.className = "dap-kb-search-input";
    searchInput.type = "text";
    searchInput.placeholder = "Search resources\u2026";
    searchInput.autocomplete = "off";
    searchWrap.appendChild(searchIcon);
    searchWrap.appendChild(searchInput);
    head.appendChild(searchWrap);
    const allTypes = Array.from(new Set(
      items.map((item) => {
        if (typeof item === "object" && item.itemType) return item.itemType;
        return detectContentType(item.url || item, item.fileName);
      })
    ));
    const filterRow = document.createElement("div");
    filterRow.className = "dap-kb-filter-row";
    let activeFilter = "all";
    let searchVal = "";
    filterRow.appendChild(makeFilterChip("All", "all", true));
    allTypes.forEach((type) => {
      const emoji = TYPE_EMOJIS[type] || "\u{1F4C4}";
      filterRow.appendChild(makeFilterChip(`${emoji} ${TYPE_LABELS[type] || type.toUpperCase()}`, type, false));
    });
    head.appendChild(filterRow);
    wrapper.appendChild(head);
    const bodyEl = document.createElement("div");
    bodyEl.className = "dap-kb-body";
    const grid = document.createElement("div");
    grid.className = "dap-kb-grid";
    bodyEl.appendChild(grid);
    wrapper.appendChild(bodyEl);
    function renderGrid() {
      grid.innerHTML = "";
      const filtered = items.filter((item) => {
        let itemType = "", itemTitle = "", itemDesc = "";
        if (typeof item === "string") {
          itemType = "link";
          itemTitle = item;
        } else {
          itemType = item.itemType || detectContentType(item.url || "", item.fileName);
          itemTitle = item.title || "";
          itemDesc = item.description || "";
        }
        const matchType = activeFilter === "all" || itemType === activeFilter;
        const matchSearch = !searchVal || itemTitle.toLowerCase().includes(searchVal) || itemDesc.toLowerCase().includes(searchVal);
        return matchType && matchSearch;
      });
      countBadge.textContent = `${filtered.length} item${filtered.length !== 1 ? "s" : ""}`;
      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "dap-kb-empty";
        empty.innerHTML = `<span class="dap-kb-empty-icon">\u{1F50D}</span><p>No resources match your search.</p>`;
        grid.appendChild(empty);
        return;
      }
      filtered.forEach((item, index) => {
        let itemUrl = "", itemTitle = "", itemDescription = "", itemType = "";
        if (typeof item === "string") {
          itemUrl = itemTitle = item;
          itemType = "link";
        } else {
          itemUrl = item.url || "";
          itemTitle = item.title || "";
          itemDescription = item.description || "";
          itemType = item.itemType || detectContentType(itemUrl, item.fileName);
        }
        if (!itemUrl || !itemTitle) return;
        const card = document.createElement("button");
        card.className = "dap-kb-card";
        card.style.animationDelay = `${index * 40}ms`;
        card.title = itemDescription || itemTitle;
        const badgeClass = `dap-kb-badge-${itemType}`;
        const badgeLabel = TYPE_LABELS[itemType] || itemType.toUpperCase();
        const badgeEmoji = TYPE_EMOJIS[itemType] || "\u{1F4C4}";
        card.innerHTML = `
        <div class="dap-kb-card-top">
          <div class="dap-kb-card-type-icon">${TYPE_EMOJIS[itemType] || "\u{1F4C4}"}</div>
          <div class="dap-kb-card-info">
            <div class="dap-kb-card-title">${itemTitle}</div>
            <div class="dap-kb-card-type-badge ${badgeClass}">${badgeEmoji} ${badgeLabel}</div>
          </div>
        </div>
        ${itemDescription ? `<div class="dap-kb-card-desc">${itemDescription}</div>` : ""}
        <div class="dap-kb-card-footer">
          <div class="dap-kb-card-arrow">\u2192</div>
        </div>`;
        card.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openKBItemInModal(item, content.title || "Knowledge Base");
        });
        grid.appendChild(card);
      });
    }
    searchInput.addEventListener("input", () => {
      searchVal = searchInput.value.toLowerCase().trim();
      renderGrid();
    });
    filterRow.addEventListener("click", (e) => {
      const chip = e.target.closest(".dap-kb-filter-chip");
      if (!chip) return;
      filterRow.querySelectorAll(".dap-kb-filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.dataset.filter || "all";
      renderGrid();
    });
    renderGrid();
    return wrapper;
  }
  function makeFilterChip(label, filter, isActive) {
    const chip = document.createElement("div");
    chip.className = `dap-kb-filter-chip${isActive ? " active" : ""}`;
    chip.dataset.filter = filter;
    chip.textContent = label;
    return chip;
  }
  function getTypeEmoji(type) {
    return TYPE_EMOJIS[type] || "\u{1F4C4}";
  }
  function renderKBItemViewer(content) {
    const outerWrap = document.createElement("div");
    outerWrap.className = "dap-content-kb-viewer";
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
    outerWrap.appendChild(viewerEl);
    return outerWrap;
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
    openBtn.innerHTML = `<span class="dap-btn-icon">\u2197</span><span class="dap-btn-text">Open PDF</span>`;
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
    urlP.style.fontSize = "11.5px";
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
      typeP.style.fontSize = "11.5px";
      typeP.style.color = "var(--dap-text-muted)";
      typeP.style.fontFamily = "'JetBrains Mono', monospace";
      typeP.textContent = type.toUpperCase() + " Document";
      info.appendChild(typeP);
    }
    info.appendChild(createDocumentActions(url, fileName || "document"));
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
        requestAnimationFrame(() => {
          loadingEl.remove();
          let viewerEl;
          switch (viewer) {
            case "pdf":
              viewerEl = createInlinePDFViewer(url, fileName);
              break;
            case "document":
              viewerEl = createInlineDocumentViewer(url, fileName, mimeType);
              break;
            case "presentation":
              viewerEl = createInlinePresentationViewer(url, fileName, mimeType);
              break;
            case "web":
              viewerEl = createWebContentViewer(url, title);
              break;
            default:
              viewerEl = createEnhancedFallbackViewer(articleContent, "This document cannot be previewed inline.");
              break;
          }
          container.appendChild(viewerEl);
          const modalBody = container.closest(".dap-modal-body");
          if (modalBody) {
            requestAnimationFrame(() => {
              modalBody.scrollTo({ top: modalBody.scrollHeight, behavior: "smooth" });
            });
          }
        });
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
      container.appendChild(createDocumentActions(url, fileName));
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
        container.appendChild(createDocumentActions(url, fileName));
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
        container.appendChild(createDocumentActions(url, fileName));
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
    btn.innerHTML = `<span class="dap-btn-icon">\u2197</span><span class="dap-btn-text">Open in New Tab</span>`;
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
    msg.innerHTML = sanitizeHtml(
      `<h4>${title}</h4><p class="dap-fallback-primary">${message}</p>` + (fileName !== title ? `<p class="dap-fallback-filename">\u{1F4C1} ${fileName}</p>` : "") + (ext ? `<p class="dap-fallback-type">${ext} Document</p>` : "")
    );
    container.appendChild(msg);
    if (url) container.appendChild(createEnhancedDocumentActions(url, fileName));
    return container;
  }
  function createDocumentActions(url, fileName) {
    const actions = document.createElement("div");
    actions.className = "dap-document-actions";
    const dlBtn = document.createElement("button");
    dlBtn.className = "dap-action-btn dap-primary-btn";
    dlBtn.innerHTML = `<span class="dap-btn-icon">\u2B07</span><span class="dap-btn-text">Download</span>`;
    dlBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.downloadFile(url, fileName);
    });
    const openBtn = document.createElement("button");
    openBtn.className = "dap-action-btn dap-secondary-btn";
    openBtn.innerHTML = `<span class="dap-btn-icon">\u2197</span><span class="dap-btn-text">Open in New Tab</span>`;
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
    kbState.modalBodyRef.appendChild(
      renderKnowledgeBase({ title: kbState.title, items: kbState.items })
    );
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
      if (this.payload.executionMode === "Linear" || this.payload.executionMode === "AnyOrder") {
        return;
      }
      const onMouseEnter = () => this.show();
      const onMouseLeave = (e) => {
        if (document.querySelector(".dap-confirm-overlay")) return;
        const related = e.relatedTarget;
        if (related && this.container?.contains(related)) return;
        this.hide(false, false);
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
        if (this.payload.executionMode === "Linear" || this.payload.executionMode === "AnyOrder") return;
        const target = e.target;
        if (target && target.closest && target.closest(".dap-confirm-overlay")) return;
        if (!this.container?.contains(target) && !this.target.contains(target)) {
          this.hide(false, false);
        }
      };
      document.addEventListener("click", onDocumentClick, true);
      this.listeners.push(() => document.removeEventListener("click", onDocumentClick, true));
    }
    setupFocusTrigger() {
      this.show();
      if (this.payload.executionMode === "Linear" || this.payload.executionMode === "AnyOrder") {
        return;
      }
      const onFocus = () => this.show();
      const onBlur = () => {
        if (document.querySelector(".dap-confirm-overlay")) return;
        this.hide(false, false);
      };
      this.target.addEventListener("focus", onFocus);
      this.target.addEventListener("blur", onBlur);
      this.listeners.push(
        () => this.target.removeEventListener("focus", onFocus),
        () => this.target.removeEventListener("blur", onBlur)
      );
    }
    setupGlobalListeners() {
      const onKeyDown = (e) => {
        if (document.querySelector(".dap-confirm-overlay")) return;
        if (e.key === "Escape" && this.isVisible) this.hide();
      };
      const onScroll = () => {
        if (this.isVisible) {
          if (!this.isTargetInViewport()) this.hide();
          else this.position();
        }
      };
      const onResize = () => {
        if (this.isVisible) this.position();
      };
      const onVisibilityChange = () => {
        if (document.hidden && this.isVisible) this.hide();
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
        if (!document.contains(this.target)) this.destroy();
      });
      this.targetObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    show() {
      if (this._completed || this.isVisible) return;
      console.debug("[DAP] Tooltip shown", { id: this.id });
      this.createTooltip();
      this.position();
      this.isVisible = true;
      requestAnimationFrame(() => {
        if (this.container) this.container.classList.add("dap-tooltip-visible");
      });
    }
    hide(abort = false, isCompletion = true) {
      if (!this.isVisible) return;
      console.debug("[DAP] Tooltip dismissed", { id: this.id, abort, isCompletion });
      if (abort) {
        this.payload._completionTracker?.onAbort?.();
        this._completed = true;
      } else if (isCompletion) {
        if (this.payload._completionTracker?.onComplete) {
          console.debug("[DAP] Completing tooltip flow", { id: this.id });
          this.payload._completionTracker.onComplete();
        }
        this._completed = true;
      }
      if (this._completed) {
        this.listeners.forEach((cleanup) => cleanup());
        this.listeners = [];
        if (this.targetObserver) {
          this.targetObserver.disconnect();
          this.targetObserver = null;
        }
      }
      if (this.container) {
        this.container.style.animation = "dap-tooltip-exit 0.18s ease forwards";
        setTimeout(() => this.removeTooltip(), 180);
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
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "dap-tooltip-close";
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.textContent = "\xD7";
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.payload.executionMode === "Linear") {
          showConfirmClose({
            onConfirm: () => {
              this.hide(true);
            }
          });
        } else {
          this.hide();
        }
      });
      const content = document.createElement("div");
      content.className = "dap-tooltip-content";
      content.textContent = this.payload.text || "";
      this.container.appendChild(closeBtn);
      this.container.appendChild(content);
      if (this.payload.executionMode === "Linear" || this.payload.executionMode === "AnyOrder") {
        const navRow = document.createElement("div");
        navRow.className = "dap-tooltip-nav-row";
        if (this.payload.stepIndex !== void 0 && this.payload.totalSteps !== void 0) {
          const stepCounter = document.createElement("div");
          stepCounter.className = "dap-tooltip-step-counter";
          stepCounter.textContent = `Step ${this.payload.stepIndex + 1} of ${this.payload.totalSteps}`;
          navRow.appendChild(stepCounter);
        }
        if (this.payload.executionMode === "Linear") {
          const navBtn = document.createElement("button");
          navBtn.type = "button";
          navBtn.className = "dap-tooltip-nav-btn";
          navBtn.textContent = this.payload.isLastStep ? "Done" : "Next";
          navBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.hide();
          });
          navRow.appendChild(navBtn);
        }
        this.container.appendChild(navRow);
      }
      const arrow = document.createElement("div");
      arrow.className = "dap-tooltip-arrow";
      this.container.appendChild(arrow);
      if (this.trigger === "hover") {
        const onTooltipMouseLeave = () => {
          if (document.querySelector(".dap-confirm-overlay")) return;
          this.hide();
        };
        this.container.addEventListener("mouseleave", onTooltipMouseLeave);
        this.listeners.push(() => this.container?.removeEventListener("mouseleave", onTooltipMouseLeave));
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
        if (newDesc) this.target.setAttribute("aria-describedby", newDesc);
        else this.target.removeAttribute("aria-describedby");
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
      const gap = 10;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
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
        top: { top: targetRect.top - tooltipRect.height - gap, left: targetRect.left + (targetRect.width - tooltipRect.width) / 2 },
        right: { top: targetRect.top + (targetRect.height - tooltipRect.height) / 2, left: targetRect.right + gap },
        bottom: { top: targetRect.bottom + gap, left: targetRect.left + (targetRect.width - tooltipRect.width) / 2 },
        left: { top: targetRect.top + (targetRect.height - tooltipRect.height) / 2, left: targetRect.left - tooltipRect.width - gap }
      };
      const fits = (pos) => pos.top >= 0 && pos.left >= 0 && pos.top + tooltipRect.height <= viewport.height && pos.left + tooltipRect.width <= viewport.width;
      let finalPosition = positions[preferredPlacement];
      let finalPlacement = preferredPlacement;
      if (!fits(finalPosition)) {
        for (const alt of ["top", "right", "bottom", "left"]) {
          if (alt !== preferredPlacement && fits(positions[alt])) {
            finalPosition = positions[alt];
            finalPlacement = alt;
            break;
          }
        }
      }
      const margin = 6;
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
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none; z-index: 2147483640;
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
      /* \u2500\u2500 DAP Tooltip \u2014 Image 1 style \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
         White card, brand-colored 1px border (fallback: #000000),
         close \xD7 button top-right also brand-colored, no decorative header. */

      :root {
        /* --dap-tooltip-brand removed: use --dap-primary directly to avoid
           pre-themeDetector resolution failures. Fallback #000000 matches
           spec: 'fall back to grey or black border'.                     */
        --dap-tooltip-radius:  10px;
        --dap-tooltip-shadow:  0 4px 20px rgba(0, 0, 0, 0.10), 0 1px 4px rgba(0, 0, 0, 0.06);
      }

      .dap-tooltip {
        position: fixed;
        background: #ffffff;
        color: #000000; /* forced black \u2014 readability policy */
        padding: 14px 38px 14px 16px; /* right padding reserves space for \xD7 */
        /* Use --dap-primary directly \u2014 no intermediate variable needed */
        border: 2.5px solid var(--dap-primary, #0EA5E9);
        border-radius: var(--dap-tooltip-radius);
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        font-weight: 400;
        line-height: 1.55;
        max-width: 280px;
        min-width: 220px;
        word-wrap: break-word;
        z-index: 2147483641;
        pointer-events: auto;
        box-shadow: 0 8px 28px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.08);
        overflow: visible; /* allow arrow to project outside */
        opacity: 0;
        transform: translateY(6px) scale(0.97);
        transition: opacity 0.2s ease, transform 0.2s ease;
        animation: dap-tooltip-enter 0.22s ease forwards;
      }

      .dap-tooltip.dap-tooltip-visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      /* \u2500\u2500 Close button (\xD7) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .dap-tooltip-close {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        /* Use --dap-primary directly for the \xD7 icon \u2014 matches card border */
        color: var(--dap-primary, #000000);
        padding: 0;
        transition: background 0.15s ease, transform 0.15s ease;
      }
      .dap-tooltip-close:hover {
        background: rgba(0, 0, 0, 0.06);
        transform: scale(1.15);
      }

      /* \u2500\u2500 Text content \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .dap-tooltip-content {
        color: #000000; /* forced black \u2014 readability policy */
        font-size: 14px;
        font-weight: 400;
        line-height: 1.55;
        margin: 0;
      }

      /* \u2500\u2500 Navigation Row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      .dap-tooltip-nav-row {
        margin-top: 16px;
        margin-left: -16px;
        margin-right: -38px;
        margin-bottom: -14px;
        padding: 0;
        border-top: none;
        display: flex;
        align-items: stretch;
        border-radius: 0 0 calc(var(--dap-tooltip-radius) - 2.5px) calc(var(--dap-tooltip-radius) - 2.5px);
        overflow: hidden;
      }
      .dap-tooltip-step-counter {
        flex: 1;
        background: #e0f2fe;
        color: #0369a1;
        font-size: 13px;
        font-weight: 600;
        padding: 8px 12px;
        margin: 0;
        display: flex;
        align-items: center;
        white-space: nowrap;
      }
      .dap-tooltip-nav-btn {
        width: auto;
        padding: 8px 16px;
        background: var(--dap-primary, #5ba3e4);
        color: #ffffff;
        border: none;
        border-radius: 0;
        font-family: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s ease;
        text-align: center;
        white-space: nowrap;
        text-transform: uppercase;
      }
      .dap-tooltip-nav-btn:hover {
        background: var(--dap-primary-dark, #0284c7);
        filter: brightness(1.05);
      }
      .dap-tooltip-nav-btn:active {
        background: var(--dap-primary-darker, #0369a1);
        filter: brightness(0.95);
      }

      /* \u2500\u2500 CSS arrow \u2014 only the two outer sides carry the brand border \u2500\u2500\u2500\u2500\u2500 */
      /* This prevents the inner sides from cutting through the bubble body.   */
      .dap-tooltip-arrow {
        position: absolute;
        width: 14px;
        height: 14px;
        background: #ffffff;
        /* No border here \u2014 applied per-placement below */
        pointer-events: none;
      }

      /* top placement: bubble above target, arrow points DOWN at bubble bottom */
      .dap-tooltip[data-placement="top"] .dap-tooltip-arrow {
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
        border-right:  2.5px solid var(--dap-primary, #0EA5E9);
        border-bottom: 2.5px solid var(--dap-primary, #0EA5E9);
        box-shadow: 3px 3px 4px rgba(0,0,0,0.07);
      }
      /* bottom placement: bubble below target, arrow points UP at bubble top */
      .dap-tooltip[data-placement="bottom"] .dap-tooltip-arrow {
        top: -8px;
        left: 50%;
        transform: translateX(-50%) rotate(45deg);
        border-left: 2.5px solid var(--dap-primary, #0EA5E9);
        border-top:  2.5px solid var(--dap-primary, #0EA5E9);
        box-shadow: -3px -3px 4px rgba(0,0,0,0.07);
      }
      /* right placement: bubble right of target, arrow points LEFT at bubble left */
      .dap-tooltip[data-placement="right"] .dap-tooltip-arrow {
        left: -8px;
        top: 50%;
        transform: translateY(-50%) rotate(45deg);
        border-left:   2.5px solid var(--dap-primary, #0EA5E9);
        border-bottom: 2.5px solid var(--dap-primary, #0EA5E9);
        box-shadow: -3px 3px 4px rgba(0,0,0,0.07);
      }
      /* left placement: bubble left of target, arrow points RIGHT at bubble right */
      .dap-tooltip[data-placement="left"] .dap-tooltip-arrow {
        right: -8px;
        top: 50%;
        transform: translateY(-50%) rotate(45deg);
        border-right: 2.5px solid var(--dap-primary, #0EA5E9);
        border-top:   2.5px solid var(--dap-primary, #0EA5E9);
        box-shadow: 3px -3px 4px rgba(0,0,0,0.07);
      }

      /* \u2500\u2500 Animations \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      @keyframes dap-tooltip-enter {
        from { opacity: 0; transform: translateY(8px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0)  scale(1);     }
      }
      @keyframes dap-tooltip-exit {
        from { opacity: 1; transform: translateY(0)   scale(1);    }
        to   { opacity: 0; transform: translateY(-6px) scale(0.96); }
      }

      @media (max-width: 480px) {
        .dap-tooltip { max-width: 240px; padding: 12px 34px 12px 14px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .dap-tooltip { animation: none; transition: opacity 0.15s ease; }
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
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(resolveSelectorWithPriority(selector));
      }, timeout);
    });
  }

  // src/styles/survey.css.ts
  var surveyCssText = `
/* \u2500\u2500 DAP Survey CSS \u2014 Professional Interactive Redesign \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Design philosophy:
   \u2022 Brand-tinted surfaces throughout \u2014 light wash of primary color on every card
   \u2022 Deep interactive feedback \u2014 hover lifts, selection glows, focus rings
   \u2022 Survey icon + heading in header for instant context
   \u2022 Animated progress indicators and selection states
   \u2022 Smooth entrance animations on every element
   \u2022 Works beautifully with any brand color OR muted slate fallback
   \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/* \u2500\u2500 Token Defaults (overridden by adaptive theming at runtime) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
:root {
  --dap-survey-ink:          #0f172a;
  --dap-survey-ink-muted:    #334155;
  --dap-survey-ink-subtle:   #64748b;
  --dap-survey-surface:      var(--dap-surface, #f0f4ff);
  --dap-survey-surface-alt:  var(--dap-surface-alt, #e8eeff);
  --dap-survey-card-bg:      color-mix(in srgb, var(--dap-primary, #6366f1) 6%, #ffffff);
  --dap-survey-card-border:  color-mix(in srgb, var(--dap-primary, #6366f1) 22%, transparent);
  --dap-survey-selected-bg:  color-mix(in srgb, var(--dap-primary, #6366f1) 14%, #ffffff);
  --dap-survey-radius:       14px;
  --dap-survey-radius-sm:    10px;
  --dap-survey-transition:   all 180ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* \u2500\u2500 Overlay \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-modal-wrap {
  position: fixed;
  inset: 0;
  /* Add blur effect on survey backdrop similar to modals */
  background: var(--dap-backdrop-bg, rgba(15, 23, 42, 0.12)) !important;
  backdrop-filter: blur(20px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
  z-index: 2147483640 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: dapSurveyOverlayIn 200ms ease both;
}

@keyframes dapSurveyOverlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* \u2500\u2500 Survey Modal Container \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-survey-modal {
  /* Make survey modal as visible as normal modals */
  background: #ffffff !important;
  border: 1.5px solid var(--dap-primary, #0EA5E9) !important;
  border-radius: 20px;
  box-shadow: var(--dap-shadow-soft, 0 24px 64px rgba(0,0,0,0.14), 0 8px 24px rgba(0,0,0,0.08));
  width: 100%;
  max-width: 600px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'DM Sans', 'Outfit', system-ui, -apple-system, sans-serif;
  color: #0f172a !important;
  animation: dapSurveyModalIn 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
  position: relative;
}

/* Decorative top accent bar */
.dap-survey-modal::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    var(--dap-primary, #6366f1) 0%,
    color-mix(in srgb, var(--dap-primary, #6366f1) 60%, #a78bfa) 50%,
    var(--dap-primary, #6366f1) 100%
  );
  border-radius: 20px 20px 0 0;
  z-index: 1;
}

@keyframes dapSurveyModalIn {
  from { opacity: 0; transform: scale(0.94) translateY(20px); filter: blur(4px); }
  to   { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
}

/* \u2500\u2500 Header Bar with Survey Icon \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px 28px 18px;
  border-bottom: 1px solid rgba(var(--dap-primary-rgb, 14, 165, 233), 0.22);
  background: rgba(var(--dap-primary-rgb, 14, 165, 233), 0.06) !important;
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.dap-header-identity {
  display: flex;
  align-items: center;
  gap: 14px;
}

/* Survey icon badge */
.dap-survey-icon-badge {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(
    135deg,
    var(--dap-primary, #6366f1) 0%,
    color-mix(in srgb, var(--dap-primary, #6366f1) 70%, #a78bfa) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--dap-primary, #6366f1) 35%, transparent);
}

.dap-survey-icon-badge svg {
  width: 22px;
  height: 22px;
  fill: #ffffff;
}

.dap-modal-header {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a !important;
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.dap-header-subtitle {
  font-size: 12px;
  color: var(--dap-survey-ink-muted, #475569) !important;
  margin: 2px 0 0 0;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.dap-close {
  width: 34px;
  height: 34px;
  border: 1px solid color-mix(in srgb, var(--dap-primary, #6366f1) 20%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 8%, #ffffff);
  color: #475569;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--dap-survey-transition);
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
}

.dap-close:hover {
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 16%, #ffffff);
  color: #0f172a;
  border-color: color-mix(in srgb, var(--dap-primary, #6366f1) 40%, transparent);
  transform: scale(1.05);
}

/* \u2500\u2500 Survey Body \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-survey-body {
  padding: 24px 28px 28px;
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
  background: #ffffff !important;
}

.dap-survey-body::-webkit-scrollbar { width: 5px; }
.dap-survey-body::-webkit-scrollbar-track { background: transparent; }
.dap-survey-body::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 35%, transparent);
  border-radius: 3px;
}

/* Intro text */
.dap-survey-intro {
  font-size: 14px;
  line-height: 1.65;
  color: #475569 !important;
  margin-bottom: 22px;
  padding: 14px 18px;
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 8%, #ffffff);
  border-radius: 10px;
  border-left: 3px solid var(--dap-primary, #6366f1);
}

/* \u2500\u2500 Question Cards \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-survey-question {
  padding: 20px 22px;
  /* Solid card so it never \u201Cdisappears\u201D on light overlays */
  background: #ffffff !important;
  border: 1.5px solid rgba(var(--dap-primary-rgb, 14, 165, 233), 0.28) !important;
  border-radius: var(--dap-survey-radius);
  margin-bottom: 16px;
  box-shadow: 0 10px 26px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
  transition: var(--dap-survey-transition);
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: dapQuestionFadeIn 300ms ease both;
  position: relative;
  overflow: hidden;
}

/* Subtle inner glow on hover */
.dap-survey-question:hover {
  border-color: rgba(var(--dap-primary-rgb, 14, 165, 233), 0.55) !important;
  box-shadow:
    0 14px 34px rgba(0,0,0,0.12),
    0 4px 12px rgba(0,0,0,0.08);
  transform: translateY(-1px);
}

@keyframes dapQuestionFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Stagger each question */
.dap-survey-question:nth-child(1) { animation-delay: 40ms; }
.dap-survey-question:nth-child(2) { animation-delay: 80ms; }
.dap-survey-question:nth-child(3) { animation-delay: 120ms; }
.dap-survey-question:nth-child(4) { animation-delay: 160ms; }
.dap-survey-question:nth-child(5) { animation-delay: 200ms; }
.dap-survey-question:nth-child(n+6) { animation-delay: 240ms; }

/* Question number accent dot */
.dap-survey-question::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: linear-gradient(180deg,
    var(--dap-primary, #6366f1) 0%,
    color-mix(in srgb, var(--dap-primary, #6366f1) 40%, transparent) 100%
  );
  border-radius: 14px 0 0 14px;
  opacity: 0.7;
  transition: opacity 180ms ease;
}

.dap-survey-question:hover::before,
.dap-survey-question:focus-within::before {
  opacity: 1;
}

/* \u2500\u2500 Question Label \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-question-label {
  display: block;
  font-weight: 700;
  color: #0f172a !important;
  font-size: 14.5px;
  line-height: 1.45;
  letter-spacing: -0.01em;
  padding-left: 6px;
}

/* \u2500\u2500 Question Input wrapper \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-question-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding-left: 6px;
}

/* \u2500\u2500 Radio / Checkbox rows \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-radio-wrapper,
.dap-checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  border-radius: var(--dap-survey-radius-sm);
  border: 1.5px solid color-mix(in srgb, var(--dap-primary, #6366f1) 16%, transparent) !important;
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 4%, #ffffff);
  cursor: pointer;
  transition: var(--dap-survey-transition);
  position: relative;
  overflow: hidden;
}

.dap-radio-wrapper::after,
.dap-checkbox-wrapper::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg,
    color-mix(in srgb, var(--dap-primary, #6366f1) 10%, transparent),
    transparent
  );
  opacity: 0;
  transition: opacity 180ms ease;
  pointer-events: none;
}

.dap-radio-wrapper:hover,
.dap-checkbox-wrapper:hover {
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 10%, #ffffff);
  border-color: color-mix(in srgb, var(--dap-primary, #6366f1) 38%, transparent) !important;
  transform: translateX(3px);
  box-shadow: 0 3px 10px color-mix(in srgb, var(--dap-primary, #6366f1) 12%, transparent);
}

.dap-radio-wrapper:hover::after,
.dap-checkbox-wrapper:hover::after {
  opacity: 1;
}

/* Selected state */
.dap-radio-wrapper:has(input:checked),
.dap-checkbox-wrapper:has(input:checked) {
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 13%, #ffffff) !important;
  border-color: var(--dap-primary, #6366f1) !important;
  transform: translateX(4px);
  box-shadow:
    0 4px 14px color-mix(in srgb, var(--dap-primary, #6366f1) 18%, transparent),
    inset 0 1px 0 rgba(255,255,255,0.6);
}

.dap-radio-wrapper input,
.dap-checkbox-wrapper input {
  accent-color: var(--dap-primary, #6366f1);
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
}

.dap-radio-wrapper label,
.dap-checkbox-wrapper label {
  color: #0f172a !important;
  cursor: pointer;
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  transition: font-weight 120ms ease;
}

.dap-radio-wrapper:has(input:checked) label,
.dap-checkbox-wrapper:has(input:checked) label {
  font-weight: 600;
  color: #0f172a !important;
}

/* Selected checkmark visual */
.dap-radio-wrapper:has(input:checked)::before,
.dap-checkbox-wrapper:has(input:checked)::before {
  content: '\u2713';
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: var(--dap-primary, #6366f1);
  font-weight: 700;
  animation: dapCheckIn 150ms ease both;
}

@keyframes dapCheckIn {
  from { opacity: 0; transform: translateY(-50%) scale(0.5); }
  to   { opacity: 1; transform: translateY(-50%) scale(1); }
}

/* \u2500\u2500 Text / Textarea / Select inputs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-question-input input[type="text"],
.dap-question-input textarea,
.dap-question-input select {
  width: 100%;
  padding: 12px 16px;
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 4%, #ffffff) !important;
  border: 1.5px solid color-mix(in srgb, var(--dap-primary, #6366f1) 22%, transparent) !important;
  border-radius: var(--dap-survey-radius-sm);
  color: #0f172a !important;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  transition: var(--dap-survey-transition);
  box-sizing: border-box;
}

.dap-question-input input[type="text"]:focus,
.dap-question-input textarea:focus,
.dap-question-input select:focus {
  outline: none;
  border-color: var(--dap-primary, #6366f1) !important;
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 7%, #ffffff) !important;
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--dap-primary, #6366f1) 18%, transparent),
    0 4px 12px color-mix(in srgb, var(--dap-primary, #6366f1) 10%, transparent) !important;
}

.dap-question-input textarea {
  min-height: 110px;
  resize: vertical;
}

.dap-question-input input[type="text"]::placeholder,
.dap-question-input textarea::placeholder {
  color: #94a3b8 !important;
}

/* \u2500\u2500 Scale / NPS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-scale-container,
.dap-nps-container {
  width: 100%;
}

.dap-scale-options,
.dap-nps-scale {
  display: flex;
  gap: 5px;
}

.dap-scale-option,
.dap-nps-option {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.dap-scale-option label,
.dap-nps-option label {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 6%, #ffffff);
  border: 1.5px solid color-mix(in srgb, var(--dap-primary, #6366f1) 22%, transparent);
  border-radius: 9px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a !important;
  transition: var(--dap-survey-transition);
  user-select: none;
}

.dap-scale-option label:hover,
.dap-nps-option label:hover {
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 14%, #ffffff);
  border-color: color-mix(in srgb, var(--dap-primary, #6366f1) 50%, transparent);
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--dap-primary, #6366f1) 18%, transparent);
}

.dap-scale-option input:checked + label,
.dap-nps-option input:checked + label {
  background: var(--dap-primary, #6366f1) !important;
  color: #000000 !important;
  border-color: var(--dap-primary, #6366f1) !important;
  font-weight: 700;
  transform: translateY(-3px) scale(1.06);
  box-shadow:
    0 6px 18px color-mix(in srgb, var(--dap-primary, #6366f1) 38%, transparent),
    0 2px 6px rgba(0,0,0,0.1);
}

.dap-scale-option input,
.dap-nps-option input { display: none; }

.dap-scale-label {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 11.5px;
  color: #64748b !important;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.dap-nps-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 11.5px;
  color: #64748b !important;
  font-weight: 600;
}

/* \u2500\u2500 Star Rating \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-rating-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
}

.dap-star-rating {
  display: flex;
  flex-direction: row-reverse;
  gap: 3px;
  justify-content: flex-end;
}

.dap-star-label {
  font-size: 36px;
  color: #e2e8f0;
  cursor: pointer;
  transition: color 100ms ease, transform 120ms ease, filter 120ms ease;
  line-height: 1;
  display: inline-block;
}

.dap-star-label:hover,
.dap-star-label:hover ~ .dap-star-label {
  color: var(--dap-primary, #6366f1);
  transform: scale(1.18) rotate(-3deg);
  filter: drop-shadow(0 2px 8px color-mix(in srgb, var(--dap-primary, #6366f1) 45%, transparent));
}

.dap-star-input:checked ~ .dap-star-label {
  color: var(--dap-primary, #6366f1);
  filter: drop-shadow(0 1px 4px color-mix(in srgb, var(--dap-primary, #6366f1) 35%, transparent));
}

.dap-star-input { display: none; }

.dap-clear-rating {
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--dap-primary, #6366f1) 22%, transparent);
  background: transparent;
  color: #64748b !important;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--dap-survey-transition);
  font-family: inherit;
}

.dap-clear-rating:hover {
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 8%, #ffffff);
  color: #0f172a !important;
}

/* \u2500\u2500 Star Choice \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-star-choice-container { width: 100%; }

.dap-star-choice-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dap-star-choice-option { position: relative; }

.dap-star-choice-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.dap-star-choice-label {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 5%, #ffffff);
  border: 1.5px solid color-mix(in srgb, var(--dap-primary, #6366f1) 18%, transparent);
  border-radius: var(--dap-survey-radius-sm);
  cursor: pointer;
  transition: var(--dap-survey-transition);
}

.dap-star-choice-option:hover .dap-star-choice-label {
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 10%, #ffffff);
  border-color: color-mix(in srgb, var(--dap-primary, #6366f1) 40%, transparent);
  transform: translateX(4px);
  box-shadow: 0 3px 12px color-mix(in srgb, var(--dap-primary, #6366f1) 14%, transparent);
}

.dap-star-choice-input:checked + .dap-star-choice-label {
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 14%, #ffffff) !important;
  border-color: var(--dap-primary, #6366f1) !important;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--dap-primary, #6366f1) 20%, transparent),
    0 4px 14px color-mix(in srgb, var(--dap-primary, #6366f1) 16%, transparent);
  transform: translateX(5px);
}

.dap-star-choice-stars {
  display: flex;
  gap: 3px;
}

.dap-star-choice-star {
  font-size: 17px;
  color: #e2e8f0;
  transition: color 100ms ease;
}

.dap-star-choice-star.filled {
  color: var(--dap-primary, #6366f1);
  filter: drop-shadow(0 1px 3px color-mix(in srgb, var(--dap-primary, #6366f1) 40%, transparent));
}

.dap-star-choice-text {
  font-size: 14px;
  color: #0f172a !important;
  font-weight: 600;
  line-height: 1.3;
}

/* \u2500\u2500 Opinion Scale (Emoji/Good-to-Bad) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-opinion-choice-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 10px 0;
  width: 100%;
}

.dap-opinion-label {
  font-size: 12.5px;
  color: #475569 !important;
  font-weight: 700;
  white-space: nowrap;
  letter-spacing: 0.01em;
}

.dap-opinion-options {
  display: flex;
  gap: 12px;
  align-items: center;
}

.dap-opinion-radio {
  appearance: none;
  -webkit-appearance: none;
  width: 24px;
  height: 24px;
  border: 2px solid color-mix(in srgb, var(--dap-primary, #6366f1) 35%, transparent);
  border-radius: 50%;
  cursor: pointer;
  transition: var(--dap-survey-transition);
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 6%, #ffffff);
  position: relative;
  margin: 0;
}

.dap-opinion-radio:hover {
  border-color: var(--dap-primary, #6366f1);
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 14%, #ffffff);
  transform: scale(1.2);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--dap-primary, #6366f1) 14%, transparent);
}

.dap-opinion-radio:checked {
  border-color: var(--dap-primary, #6366f1);
  background: var(--dap-primary, #6366f1);
  transform: scale(1.2);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--dap-primary, #6366f1) 20%, transparent);
}

.dap-opinion-radio:checked::after {
  content: '';
  position: absolute;
  inset: 5px;
  background: #ffffff;
  border-radius: 50%;
  animation: dapRadioCheck 150ms ease-out;
}

@keyframes dapRadioCheck {
  from { transform: scale(0); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

/* \u2500\u2500 NPS Options \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-nps-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dap-nps-category {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--dap-survey-radius-sm);
  border: 1.5px solid color-mix(in srgb, var(--dap-primary, #6366f1) 16%, transparent);
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 4%, #ffffff);
  cursor: pointer;
  transition: var(--dap-survey-transition);
}

.dap-nps-category:hover {
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 10%, #ffffff);
  border-color: color-mix(in srgb, var(--dap-primary, #6366f1) 38%, transparent);
  transform: translateX(3px);
}

.dap-nps-category:has(input:checked) {
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 14%, #ffffff) !important;
  border-color: var(--dap-primary, #6366f1) !important;
}

.dap-nps-category input {
  accent-color: var(--dap-primary, #6366f1);
  width: 16px;
  height: 16px;
  cursor: pointer;
  flex-shrink: 0;
}

.dap-nps-category label {
  color: #0f172a !important;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

/* \u2500\u2500 Dropdown \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-question-input select {
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 14px center !important;
  padding-right: 38px !important;
  cursor: pointer;
}

/* \u2500\u2500 Footer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(var(--dap-primary-rgb, 14, 165, 233), 0.18);
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  align-items: center;
  background: #ffffff !important;
  flex-shrink: 0;
}

.dap-footer button {
  padding: 8px 16px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--dap-survey-transition);
  letter-spacing: 0.01em;
  position: relative;
  overflow: hidden;
}

/* Button ripple */
.dap-footer button::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.18);
  opacity: 0;
  transition: opacity 150ms ease;
}

.dap-footer button:active::after {
  opacity: 1;
}

/* \u2500\u2500 Submit / CTA button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-cta {
  background: var(--dap-primary, #6366f1) !important;
  color: #000000 !important;
  border: 1.5px solid var(--dap-primary, #6366f1) !important;
  font-weight: 700 !important;
  box-shadow:
    0 4px 14px color-mix(in srgb, var(--dap-primary, #6366f1) 35%, transparent),
    inset 0 1px 0 rgba(255,255,255,0.15);
}

.dap-cta:hover {
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 85%, #000000) !important;
  border-color: color-mix(in srgb, var(--dap-primary, #6366f1) 85%, #000000) !important;
  box-shadow:
    0 8px 22px color-mix(in srgb, var(--dap-primary, #6366f1) 45%, transparent),
    inset 0 1px 0 rgba(255,255,255,0.20) !important;
  transform: translateY(-1px);
}

.dap-cta:active { transform: translateY(0); }

.dap-cta:focus-visible {
  outline: 2px solid var(--dap-primary, #6366f1);
  outline-offset: 3px;
}

/* \u2500\u2500 Cancel / Secondary button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-secondary {
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 6%, #ffffff) !important;
  color: #475569 !important;
  border: 1.5px solid color-mix(in srgb, var(--dap-primary, #6366f1) 20%, transparent) !important;
}

.dap-secondary:hover {
  background: color-mix(in srgb, var(--dap-primary, #6366f1) 12%, #ffffff) !important;
  color: #0f172a !important;
  border-color: color-mix(in srgb, var(--dap-primary, #6366f1) 35%, transparent) !important;
  box-shadow: 0 3px 10px color-mix(in srgb, var(--dap-primary, #6366f1) 12%, transparent) !important;
}

.dap-secondary:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--dap-primary, #6366f1) 55%, transparent);
  outline-offset: 3px;
}

/* \u2500\u2500 Error state \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-survey-error {
  padding: 12px 16px;
  background: #fef2f2;
  border: 1.5px solid #fca5a5;
  border-radius: var(--dap-survey-radius-sm);
  color: #dc2626 !important;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  animation: dapQuestionFadeIn 200ms ease both;
}

.dap-survey-error::before {
  content: '\u26A0';
  font-size: 16px;
  flex-shrink: 0;
}

/* \u2500\u2500 Micro Survey (inline widget) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-microsurvey {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 380px;
  background: var(--dap-primary-light, #f8fafc) !important;
  border: 1.5px solid color-mix(in srgb, var(--dap-primary, #6366f1) 28%, transparent) !important;
  border-radius: 18px;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--dap-primary, #6366f1) 10%, transparent),
    0 20px 50px color-mix(in srgb, var(--dap-primary, #6366f1) 16%, rgba(0,0,0,0.12)),
    0 6px 16px rgba(0, 0, 0, 0.08);
  padding: 22px;
  animation: microsurveyIn 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
  z-index: 2147483640;
  color: #0f172a !important;
  font-family: 'DM Sans', 'Outfit', system-ui, -apple-system, sans-serif;
  overflow: hidden;
}

/* Top accent */
.dap-microsurvey::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(
    90deg,
    var(--dap-primary, #6366f1) 0%,
    color-mix(in srgb, var(--dap-primary, #6366f1) 55%, #a78bfa) 100%
  );
}

@keyframes microsurveyIn {
  from { transform: translateY(50px) scale(0.94); opacity: 0; filter: blur(4px); }
  to   { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
}

/* \u2500\u2500 Responsive \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@media (max-width: 600px) {
  .dap-survey-modal {
    width: 100%;
    max-height: 96vh;
    border-radius: 16px 16px 0 0;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    animation: dapSurveySlideUp 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes dapSurveySlideUp {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }

  .dap-survey-body { padding: 18px 20px 22px; }
  .dap-header-bar { padding: 18px 20px 14px; }
  .dap-footer { padding: 8px 16px; }
  .dap-scale-options, .dap-nps-scale { gap: 3px; }
  .dap-scale-option label, .dap-nps-option label { font-size: 12px; height: 40px; }

  .dap-microsurvey {
    width: calc(100% - 32px);
    left: 16px;
    right: 16px;
    bottom: 16px;
  }
}

@media (max-width: 380px) {
  .dap-opinion-options { gap: 8px; }
  .dap-opinion-radio { width: 20px; height: 20px; }
}
`;

  // src/experiences/survey.ts
  var modalCssText3 = `
:root {
  --dap-z: 2147483640;
}

.dap-modal-wrap {
  position: fixed;
  inset: 0;
  z-index: var(--dap-z);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--dap-backdrop-bg, rgba(15, 23, 42, 0.12));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  animation: dapOverlayIn 150ms ease both;
}

@keyframes dapOverlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.dap-modal {
  background: var(--sdk-background, var(--dap-surface, #faf9f7)) !important;
  border: 1px solid var(--dap-border-strong);
  border-radius: 16px;
  box-shadow: var(--dap-shadow-soft);
  width: 100%;
  max-width: min(90vw, 540px);
  max-height: min(90vh, 700px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: inherit;
  color: #000000 !important;
  animation: dapModalIn 200ms ease both;
}

@keyframes dapModalIn {
  from { opacity: 0; transform: scale(0.97) translateY(12px); filter: blur(6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
}

.dap-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px 16px;
  border-bottom: 1px solid var(--dap-border-strong);
  background: var(--sdk-background, var(--dap-surface, #faf9f7)) !important;
}

.dap-modal-header {
  font-size: 20px;
  font-weight: 700;
  color: #000000 !important;
  margin: 0;
}

.dap-close {
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--dap-ink-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
  font-size: 18px;
}

.dap-close:hover {
  background: var(--sdk-background-hover);
  color: var(--dap-ink);
}

.dap-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 28px 28px 32px;
  scroll-behavior: smooth;
}

.dap-modal-body::-webkit-scrollbar {
  width: 6px;
}
.dap-modal-body::-webkit-scrollbar-thumb {
  background: var(--dap-border-strong);
  border-radius: 3px;
}

.dap-footer {
  padding: 20px 28px;
  border-top: 1px solid var(--dap-border-strong);
  background: var(--sdk-background, var(--dap-surface, #faf9f7)) !important;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.dap-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  border-radius: 8px;
  background: var(--dap-primary) !important;
  color: #000000 !important;
  border: 1px solid var(--dap-primary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}

.dap-cta:hover {
  background: var(--dap-primary-dark, var(--dap-primary)) !important;
  opacity: 0.9;
}

.dap-survey-intro {
  font-size: 14px;
  line-height: 1.6;
  color: var(--dap-ink-muted);
  margin-bottom: 24px;
}
`;
  var SURVEY_ICON_SVG_V2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
  <rect x="9" y="3" width="6" height="4" rx="1" ry="1"/>
  <path d="m9 12 2 2 4-4"/>
</svg>`;
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
    const { payload, id } = flow;
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
    shell.wrap.id = `dap-survey-overlay-${id}`;
    const onKey = (e) => {
      if (e.key === "Escape") closeAll();
      else if (e.key === "Tab") trapTab(e, shell.dlg);
    };
    document.addEventListener("keydown", onKey, true);
    shell.headerBar.replaceChildren();
    const headerIdentity = document.createElement("div");
    headerIdentity.className = "dap-header-identity";
    headerIdentity.style.cssText = "display:flex;align-items:center;gap:14px;";
    const iconBadge = document.createElement("div");
    iconBadge.className = "dap-survey-icon-badge";
    iconBadge.innerHTML = SURVEY_ICON_SVG_V2;
    headerIdentity.appendChild(iconBadge);
    const titleCol = document.createElement("div");
    titleCol.style.cssText = "display:flex;flex-direction:column;gap:2px;";
    const titleEl = document.createElement("div");
    titleEl.className = "dap-modal-header";
    titleEl.textContent = payload.header ?? "Survey";
    titleCol.appendChild(titleEl);
    const questionCount = payload.questions?.length ?? 0;
    const subtitle = document.createElement("div");
    subtitle.className = "dap-header-subtitle";
    subtitle.textContent = `${questionCount} question${questionCount !== 1 ? "s" : ""} \xB7 Takes less than a minute`;
    titleCol.appendChild(subtitle);
    headerIdentity.appendChild(titleCol);
    shell.headerBar.appendChild(headerIdentity);
    const closeBtn = document.createElement("button");
    closeBtn.className = "dap-close";
    closeBtn.setAttribute("aria-label", "Close survey");
    closeBtn.innerHTML = "\xD7";
    shell.headerBar.appendChild(closeBtn);
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
      const submitBtnEl = shell.footerEl.querySelector(".dap-cta");
      if (submitBtnEl) {
        submitBtnEl.disabled = true;
        submitBtnEl.style.opacity = "0.7";
        submitBtnEl.textContent = "Submitting\u2026";
      }
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
                questionData.answer = { value: ratingValue, label };
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
          const baseUrl = getBaseUrl2(flow.config.apiurl);
          const url = `${baseUrl}/iap-experience/organizations/${payload.organizationId}/site-collections/${payload.siteId}/userflows/${payload.flowId}/survey-responses`;
          const hostBase = location.origin;
          console.debug("[DAP] Submitting survey to API:", url);
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
        if (submitBtnEl) {
          submitBtnEl.textContent = "\u2713 Submitted!";
          submitBtnEl.style.opacity = "1";
          submitBtnEl.style.removeProperty("background");
          submitBtnEl.style.removeProperty("border-color");
          submitBtnEl.classList.add("dap-cta--success");
        }
        setTimeout(() => advanceSurvey(), 600);
      } catch (err) {
        console.error("[DAP] Survey submission error:", err);
        if (submitBtnEl) {
          submitBtnEl.disabled = false;
          submitBtnEl.style.opacity = "1";
          submitBtnEl.textContent = "Submit";
        }
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
    shell.prevBtn.style.display = "inline-flex";
    let _surveyDone = false;
    const advanceSurvey = () => {
      if (_surveyDone) return;
      _surveyDone = true;
      document.removeEventListener("keydown", onKey, true);
      restoreValidationFor(form);
      shell.wrap.remove();
      if (prevActive?.focus) prevActive.focus();
      payload._completionTracker?.onComplete?.();
    };
    const closeAll = () => {
      if (_surveyDone) return;
      const performClose = () => {
        _surveyDone = true;
        document.removeEventListener("keydown", onKey, true);
        restoreValidationFor(form);
        shell.wrap.remove();
        if (prevActive?.focus) prevActive.focus();
        payload._completionTracker?.onAbort?.();
      };
      if (payload.executionMode === "Linear") {
        showConfirmClose({
          onConfirm: performClose
        });
      } else {
        performClose();
      }
    };
    closeBtn.addEventListener("click", closeAll);
    shell.prevBtn.addEventListener("click", advanceSurvey);
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
    const microHeader = document.createElement("div");
    microHeader.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  `;
    const microIconBadge = document.createElement("div");
    microIconBadge.style.cssText = `
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--dap-primary, #0EA5E9);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 3px 8px rgba(var(--dap-primary-rgb, 14,165,233), 0.3);
  `;
    microIconBadge.innerHTML = SURVEY_ICON_SVG_V2.replace('width="22" height="22"', 'width="18" height="18"');
    microHeader.appendChild(microIconBadge);
    const microTitle = document.createElement("div");
    microTitle.style.cssText = `
    font-size: 11px;
    font-weight: 700;
    color: var(--dap-primary, #0EA5E9);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  `;
    microTitle.textContent = "Quick Survey";
    microHeader.appendChild(microTitle);
    microSurvey.appendChild(microHeader);
    const questionEl = document.createElement("div");
    questionEl.style.cssText = `
    font-weight: 600;
    margin-bottom: 16px;
    color: #0f172a;
    line-height: 1.45;
    font-size: 15px;
    letter-spacing: -0.01em;
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
    buttonsEl.style.cssText = `
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 20px;
  `;
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "dap-secondary";
    cancelBtn.style.cssText = `
    padding: 9px 20px;
    border-radius: 9px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 160ms ease;
  `;
    cancelBtn.textContent = payload.cancelText || "Dismiss";
    cancelBtn.addEventListener("click", () => {
      cleanupMicroSurvey(id);
      payload._completionTracker?.onComplete?.();
    });
    const submitBtn = document.createElement("button");
    submitBtn.className = "dap-cta";
    submitBtn.style.cssText = `
    padding: 9px 20px;
    border-radius: 9px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 160ms ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `;
    submitBtn.textContent = payload.submitText || "Submit";
    submitBtn.addEventListener("click", async () => {
      const formData = extractMicroSurveyData(microSurvey, payload);
      if (formData !== null && formData !== void 0) {
        try {
          submitBtn.textContent = "Submitting\u2026";
          submitBtn.style.opacity = "0.7";
          submitBtn.disabled = true;
          await submitMicroSurveyData(formData, payload, flow);
          submitBtn.textContent = "\u2713 Thanks!";
          submitBtn.style.opacity = "1";
          submitBtn.classList.add("dap-cta--success");
          setTimeout(() => {
            cleanupMicroSurvey(id);
            payload._completionTracker?.onComplete?.();
          }, 700);
        } catch (error) {
          console.error("[DAP] Micro survey submission failed:", error);
          submitBtn.textContent = payload.submitText || "Submit";
          submitBtn.style.opacity = "1";
          submitBtn.disabled = false;
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
      if (rect.right > viewport.width) element.style.left = `${viewport.width - elementRect.width - 10}px`;
      if (rect.bottom > viewport.height) element.style.top = `${viewport.height - elementRect.height - 10}px`;
      if (rect.left < 0) element.style.left = "10px";
      if (rect.top < 0) element.style.top = "10px";
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
    gap: 6px;
    align-items: center;
    justify-content: center;
    padding: 8px 0;
  `;
    for (let i = min; i <= max; i++) {
      const star = document.createElement("button");
      star.type = "button";
      star.innerHTML = "\u2605";
      star.dataset.value = i.toString();
      star.style.cssText = `
      background: none;
      border: none;
      font-size: 32px;
      color: #e2e8f0;
      cursor: pointer;
      transition: all 120ms ease;
      line-height: 1;
      padding: 2px;
    `;
      star.addEventListener("mouseenter", () => {
        ratingContainer.querySelectorAll("button").forEach((btn, idx) => {
          const isFilled = idx < i;
          btn.style.color = isFilled ? "var(--dap-primary, #0EA5E9)" : "#e2e8f0";
          btn.style.transform = isFilled ? "scale(1.15)" : "scale(1)";
        });
      });
      star.addEventListener("mouseleave", () => {
        const selectedVal = ratingContainer.dataset.value ? parseInt(ratingContainer.dataset.value) : 0;
        ratingContainer.querySelectorAll("button").forEach((btn, idx) => {
          const isFilled = idx < selectedVal;
          btn.style.color = isFilled ? "var(--dap-primary, #0EA5E9)" : "#e2e8f0";
          btn.style.transform = "scale(1)";
        });
      });
      star.addEventListener("click", () => {
        ratingContainer.querySelectorAll("button").forEach((btn, idx) => {
          const isFilled = idx < i;
          btn.style.color = isFilled ? "var(--dap-primary, #0EA5E9)" : "#e2e8f0";
          btn.style.filter = isFilled ? "drop-shadow(0 2px 6px rgba(var(--dap-primary-rgb, 14,165,233), 0.4))" : "none";
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
    gap: 7px;
  `;
    payload.options.forEach((option) => {
      const optionEl = document.createElement("button");
      optionEl.type = "button";
      optionEl.textContent = option.label;
      optionEl.dataset.value = option.value;
      optionEl.style.cssText = `
      padding: 11px 16px;
      border: 1.5px solid rgba(var(--dap-primary-rgb, 14,165,233), 0.18);
      border-radius: 10px;
      background: rgba(var(--dap-primary-rgb, 14,165,233), 0.04);
      color: #0f172a;
      cursor: pointer;
      text-align: left;
      transition: all 160ms ease;
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
    `;
      optionEl.addEventListener("mouseover", () => {
        if (choiceContainer.dataset.value !== option.value) {
          optionEl.style.background = "rgba(var(--dap-primary-rgb, 14,165,233), 0.10)";
          optionEl.style.transform = "translateX(3px)";
        }
      });
      optionEl.addEventListener("mouseout", () => {
        if (choiceContainer.dataset.value !== option.value) {
          optionEl.style.background = "rgba(var(--dap-primary-rgb, 14,165,233), 0.04)";
          optionEl.style.transform = "translateX(0)";
        }
      });
      optionEl.addEventListener("click", () => {
        choiceContainer.querySelectorAll("button").forEach((btn) => {
          btn.style.background = "rgba(var(--dap-primary-rgb, 14,165,233), 0.04)";
          btn.style.borderColor = "rgba(var(--dap-primary-rgb, 14,165,233), 0.18)";
          btn.style.fontWeight = "500";
          btn.style.transform = "translateX(0)";
          btn.style.boxShadow = "none";
        });
        optionEl.style.background = "rgba(var(--dap-primary-rgb, 14,165,233), 0.14)";
        optionEl.style.borderColor = "var(--dap-primary, #0EA5E9)";
        optionEl.style.fontWeight = "700";
        optionEl.style.transform = "translateX(4px)";
        optionEl.style.boxShadow = "0 4px 14px rgba(var(--dap-primary-rgb, 14,165,233), 0.18)";
        choiceContainer.dataset.value = option.value;
      });
      choiceContainer.appendChild(optionEl);
    });
    container.appendChild(choiceContainer);
  }
  function createTextContent(container, payload, id) {
    const textarea = document.createElement("textarea");
    textarea.placeholder = payload.placeholder || "Share your thoughts\u2026";
    textarea.style.cssText = `
    width: 100%;
    min-height: 100px;
    padding: 13px 16px;
    border: 1.5px solid rgba(var(--dap-primary-rgb, 14,165,233), 0.22);
    border-radius: 11px;
    background: rgba(var(--dap-primary-rgb, 14,165,233), 0.04);
    color: #0f172a;
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
    transition: all 160ms ease;
    box-sizing: border-box;
    outline: none;
  `;
    textarea.addEventListener("focus", () => {
      textarea.style.borderColor = "var(--dap-primary, #0EA5E9)";
      textarea.style.background = "rgba(var(--dap-primary-rgb, 14,165,233), 0.07)";
      textarea.style.boxShadow = "0 0 0 3px rgba(var(--dap-primary-rgb, 14,165,233), 0.16)";
    });
    textarea.addEventListener("blur", () => {
      textarea.style.borderColor = "rgba(var(--dap-primary-rgb, 14,165,233), 0.22)";
      textarea.style.background = "rgba(var(--dap-primary-rgb, 14,165,233), 0.04)";
      textarea.style.boxShadow = "none";
    });
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
      const baseUrl = getBaseUrl2(flow.config.apiurl);
      const url = `${baseUrl}/iap-experience/organizations/${payload.organizationId}/site-collections/${payload.siteId}/userflows/${payload.flowId}/survey-responses`;
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
      state.element.style.transition = "all 250ms ease";
      setTimeout(() => {
        if (state.element.parentElement) {
          state.element.parentElement.removeChild(state.element);
        }
      }, 260);
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
    defaultOption.textContent = "\u2014 Select an option \u2014";
    defaultOption.selected = true;
    defaultOption.disabled = true;
    select.appendChild(defaultOption);
    question.options.forEach((option) => {
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
    input.placeholder = "Your answer\u2026";
    container.appendChild(input);
  }
  function renderTextMulti(container, question) {
    const textarea = document.createElement("textarea");
    textarea.name = question.questionId;
    textarea.placeholder = "Your answer\u2026";
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
      { key: "not_likely", label: "Not Likely (0\u20132)" },
      { key: "somewhat_likely", label: "Somewhat Likely (3\u20138)" },
      { key: "very_likely", label: "Very Likely (9\u201310)" }
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
    const defaultStarLabels = { 5: "Excellent", 4: "Very Good", 3: "Good", 2: "Fair", 1: "Poor" };
    const ratingWrapper = document.createElement("div");
    ratingWrapper.className = "dap-rating-wrapper";
    const starContainer = document.createElement("div");
    starContainer.className = "dap-star-rating";
    const hiddenStatusInput = document.createElement("input");
    hiddenStatusInput.type = "hidden";
    hiddenStatusInput.className = "dap-star-status";
    hiddenStatusInput.value = "0";
    starContainer.appendChild(hiddenStatusInput);
    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "dap-clear-rating";
    clearButton.textContent = "Clear";
    clearButton.title = "Clear rating";
    clearButton.style.display = "none";
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
      modal.classList.remove("dap-size-small", "dap-size-medium", "dap-size-large", "dap-scrollable");
      let sizeClass = "dap-size-medium";
      if (bodyRect.width <= 480) sizeClass = "dap-size-small";
      else if (bodyRect.width <= 700) sizeClass = "dap-size-medium";
      else sizeClass = "dap-size-large";
      modal.classList.add(sizeClass);
      requestAnimationFrame(() => {
        const updatedBodyRect = body.getBoundingClientRect();
        const updatedModalRect = modal.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        if (body.scrollWidth > updatedBodyRect.width || body.scrollHeight > updatedBodyRect.height || updatedModalRect.width > viewportWidth * 0.9 || updatedModalRect.height > viewportHeight * 0.9) {
          modal.classList.add("dap-scrollable");
        }
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
    wrap.style.zIndex = "2147483640";
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
    return { wrap, dlg, headerBar, titleEl, body, footer, footerEl: footer, prevBtn, nextBtn, closeBtn };
  }
  function ensureRoot() {
    let host = document.querySelector("dap-root");
    if (!host) {
      host = document.createElement("dap-root");
      host.style.position = "fixed";
      host.style.zIndex = "2147483640";
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
  function getBaseUrl2(apiurl) {
    return (apiurl || "").replace(/\/+$/, "");
  }

  // src/experiences/popover.ts
  var activePopovers = /* @__PURE__ */ new Map();
  var POPOVER_CSS = `
  /* \u2500\u2500 DAP Popover \u2014 Image 2 style \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
     White card, bold title, readable body text, brand-colored 1px border.
     Close \xD7 icon uses brand color; fallback to #000000 when no brand found.
     No avatar, no image, no gradient header. */

  :root {
    /* --dap-popover-brand removed: use --dap-primary directly to avoid
       pre-themeDetector resolution failures. Fallback #000000 (black border)
       matches spec: 'fall back to grey or black border'. */
    --dap-popover-radius:       10px;
    --dap-popover-shadow:       0 8px 28px rgba(0, 0, 0, 0.13), 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  /* \u2500\u2500 Card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .dap-popover-v2 {
    position: absolute;
    z-index: 9999;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #000000; /* forced black \u2014 readability policy */
    min-width: 260px;
    max-width: 320px;
    background: #ffffff;
    /* Use --dap-primary directly \u2014 no intermediate variable needed */
    border: 2.5px solid var(--dap-primary, #0EA5E9);
    border-radius: var(--dap-popover-radius);
    box-shadow: var(--dap-popover-shadow);
    opacity: 0;
    transform: translateY(6px) scale(0.97);
    transition: opacity 0.18s ease, transform 0.18s ease;
    pointer-events: none;
    overflow: visible; /* allow arrow to project outside */
  }
  .dap-popover-v2.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }

  /* \u2500\u2500 Header row: title + close button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .dap-popover-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 14px 8px 16px;
  }

  .dap-popover-title {
    font-size: 16.5px;
    font-weight: 700;
    color: #000000; /* forced black \u2014 readability policy */
    flex: 1;
    line-height: 1.35;
    margin: 0;
    padding-top: 1px;
  }

  /* \u2500\u2500 Close button (\xD7) \u2014 brand colored \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .dap-popover-close {
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    font-size: 19px;
    line-height: 1;
    /* Use --dap-primary directly for close icon \u2014 same as border color */
    color: var(--dap-primary, #000000);
    padding: 0;
    margin-top: 1px;
    transition: background 0.15s ease, transform 0.15s ease;
  }
  .dap-popover-close:hover {
    background: rgba(0, 0, 0, 0.06);
    transform: scale(1.15);
  }

  /* \u2500\u2500 Body text \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .dap-popover-body {
    color: #000000; /* forced black \u2014 readability policy */
    font-size: 14.5px;
    font-weight: 400;
    line-height: 1.55;
    margin: 0;
    padding: 0 16px 14px;
  }
  .dap-popover-body p { margin: 0 0 6px; }
  .dap-popover-body p:last-child { margin-bottom: 0; }
  .dap-popover-body a {
    color: #000000; /* forced black \u2014 accessibility */
    text-decoration: underline;
    font-weight: 500;
  }

  /* \u2500\u2500 CTA row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .dap-popover-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 8px 14px 14px;
    border-top: 1px solid #f0f0f0;
  }
  .dap-popover-btn {
    padding: 7px 16px;
    border-radius: 7px;
    font-family: inherit;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .dap-popover-btn.primary {
    background: var(--dap-primary, #0EA5E9);
    color: #000000;
    border: 1px solid var(--dap-primary, #0EA5E9);
    font-weight: 600;
  }
  .dap-popover-btn.primary:hover {
    background: var(--dap-popover-brand-hover);
    border-color: var(--dap-popover-brand-hover);
  }
  .dap-popover-btn.secondary {
    background: transparent;
    color: #000000; /* forced black */
    border: 1px solid #d1d5db;
  }
  .dap-popover-btn.secondary:hover {
    border-color: var(--dap-primary, #000000);
    color: var(--dap-primary, #000000);
  }

  /* \u2500\u2500 Navigation Row (Linear mode) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  .dap-popover-nav-row {
    padding: 0;
    margin: 0;
    border-top: none;
    display: flex;
    align-items: stretch;
    border-radius: 0 0 calc(var(--dap-popover-radius) - 2.5px) calc(var(--dap-popover-radius) - 2.5px);
    overflow: hidden;
  }
  .dap-popover-step-counter {
    flex: 1;
    background: #e0f2fe;
    color: #0369a1;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 12px;
    margin: 0;
    display: flex;
    align-items: center;
    white-space: nowrap;
  }
  .dap-popover-nav-btn {
    width: auto;
    padding: 8px 16px;
    background: var(--dap-primary, #5ba3e4);
    color: #ffffff;
    border: none;
    border-radius: 0;
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease;
    text-align: center;
    white-space: nowrap;
    text-transform: uppercase;
  }
  .dap-popover-nav-btn:hover {
    background: var(--dap-primary-dark, #0284c7);
    filter: brightness(1.05);
  }
  .dap-popover-nav-btn:active {
    background: var(--dap-primary-darker, #0369a1);
    filter: brightness(0.95);
  }

  /* \u2500\u2500 Arrow \u2014 only the two outer sides carry the brand border \u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  /* Inner sides are borderless to prevent diagonal lines through the card */
  .dap-popover-arrow-v2 {
    position: absolute;
    width: 14px;
    height: 14px;
    background: #ffffff;
    /* No border here \u2014 applied per data-placement below via JS class */
    z-index: 0;
    pointer-events: none;
  }
  /* top placement: arrow points DOWN \u2014 right+bottom sides border */
  .dap-popover-v2[data-placement="top"] .dap-popover-arrow-v2 {
    border-right:  2.5px solid var(--dap-primary, #0EA5E9);
    border-bottom: 2.5px solid var(--dap-primary, #0EA5E9);
    box-shadow: 3px 3px 4px rgba(0,0,0,0.07);
  }
  /* bottom placement: arrow points UP \u2014 left+top sides border */
  .dap-popover-v2[data-placement="bottom"] .dap-popover-arrow-v2 {
    border-left: 2.5px solid var(--dap-primary, #0EA5E9);
    border-top:  2.5px solid var(--dap-primary, #0EA5E9);
    box-shadow: -3px -3px 4px rgba(0,0,0,0.07);
  }
  /* right placement: arrow points LEFT \u2014 left+bottom sides border */
  .dap-popover-v2[data-placement="right"] .dap-popover-arrow-v2 {
    border-left:   2.5px solid var(--dap-primary, #0EA5E9);
    border-bottom: 2.5px solid var(--dap-primary, #0EA5E9);
    box-shadow: -3px 3px 4px rgba(0,0,0,0.07);
  }
  /* left placement: arrow points RIGHT \u2014 right+top sides border */
  .dap-popover-v2[data-placement="left"] .dap-popover-arrow-v2 {
    border-right: 2.5px solid var(--dap-primary, #0EA5E9);
    border-top:   2.5px solid var(--dap-primary, #0EA5E9);
    box-shadow: 3px -3px 4px rgba(0,0,0,0.07);
  }

  /* \u2500\u2500 Dismiss animations \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  @keyframes popover-out-top    { from { opacity:1; transform:translateY(0) scale(1);     } to { opacity:0; transform:translateY(-8px)  scale(0.97); } }
  @keyframes popover-out-bottom { from { opacity:1; transform:translateY(0) scale(1);     } to { opacity:0; transform:translateY(8px)   scale(0.97); } }
  @keyframes popover-out-left   { from { opacity:1; transform:translateX(0) scale(1);     } to { opacity:0; transform:translateX(-8px)  scale(0.97); } }
  @keyframes popover-out-right  { from { opacity:1; transform:translateX(0) scale(1);     } to { opacity:0; transform:translateX(8px)   scale(0.97); } }
  @keyframes popover-out        { from { opacity:1; transform:scale(1);  }                  to { opacity:0; transform:scale(0.97);         } }

  .dap-popover-v2.dismissing-top    { animation: popover-out-top    170ms ease both; }
  .dap-popover-v2.dismissing-bottom { animation: popover-out-bottom  170ms ease both; }
  .dap-popover-v2.dismissing-left   { animation: popover-out-left    170ms ease both; }
  .dap-popover-v2.dismissing-right  { animation: popover-out-right   170ms ease both; }
  .dap-popover-v2.dismissing        { animation: popover-out         170ms ease both; }

  @media (max-width: 480px) {
    .dap-popover-v2 { min-width: 220px; max-width: 280px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .dap-popover-v2 { transition: opacity 0.15s ease; }
    .dap-popover-v2.dismissing,
    .dap-popover-v2.dismissing-top,
    .dap-popover-v2.dismissing-bottom,
    .dap-popover-v2.dismissing-left,
    .dap-popover-v2.dismissing-right { animation: none; opacity: 0; }
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
      payload,
      _done: false
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
    if (payload.showArrow !== false) {
      const arrow = document.createElement("div");
      arrow.className = "dap-popover-arrow-v2";
      popover.appendChild(arrow);
    }
    const header = document.createElement("div");
    header.className = "dap-popover-header";
    if (payload.title) {
      const title = document.createElement("h4");
      title.className = "dap-popover-title";
      title.textContent = payload.title;
      header.appendChild(title);
    }
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "dap-popover-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "\xD7";
    const initialClickHandler = (e) => {
      e.stopPropagation();
      if (payload.executionMode === "Linear") {
        showConfirmClose({
          onConfirm: () => {
            dismissPopover(id, true);
          }
        });
      } else {
        dismissPopover(id);
      }
    };
    closeBtn.addEventListener("click", initialClickHandler);
    closeBtn._dapInitialHandler = initialClickHandler;
    header.appendChild(closeBtn);
    popover.appendChild(header);
    if (payload.body) {
      const body = document.createElement("div");
      body.className = "dap-popover-body";
      body.innerHTML = sanitizeHtml(payload.body);
      popover.appendChild(body);
    }
    const ctaEl = createCTAButtons(payload, id);
    if (ctaEl) popover.appendChild(ctaEl);
    if (payload.executionMode === "Linear" || payload.executionMode === "AnyOrder") {
      const navRow = document.createElement("div");
      navRow.className = "dap-popover-nav-row";
      if (payload.stepIndex !== void 0 && payload.totalSteps !== void 0) {
        const stepCounter = document.createElement("div");
        stepCounter.className = "dap-popover-step-counter";
        stepCounter.textContent = `Step ${payload.stepIndex + 1} of ${payload.totalSteps}`;
        navRow.appendChild(stepCounter);
      }
      if (payload.executionMode === "Linear") {
        const navBtn = document.createElement("button");
        navBtn.type = "button";
        navBtn.className = "dap-popover-nav-btn";
        navBtn.textContent = payload.isLastStep ? "Done" : "Next";
        navBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          dismissPopover(id);
        });
        navRow.appendChild(navBtn);
      }
      popover.appendChild(navRow);
    }
    return popover;
  }
  function rewireCloseButton(state) {
    const closeBtn = state.element.querySelector(".dap-popover-close");
    if (!closeBtn) return;
    const initial = closeBtn._dapInitialHandler;
    if (initial) {
      closeBtn.removeEventListener("click", initial);
      delete closeBtn._dapInitialHandler;
    }
    const enrichedHandler = (e) => {
      e.stopPropagation();
      if (state._done) return;
      if (state.payload.executionMode === "Linear") {
        showConfirmClose({
          onConfirm: () => {
            fullDismiss(state, true);
          }
        });
      } else {
        fullDismiss(state);
      }
    };
    closeBtn.addEventListener("click", enrichedHandler);
    closeBtn._dapEnrichedHandler = enrichedHandler;
  }
  function fullDismiss(state, abort = false, isCompletion = true) {
    if (state._done) return;
    if (abort) {
      state._done = true;
      state.isActive = false;
      state.payload._completionTracker?.onAbort?.();
    } else if (isCompletion) {
      state._done = true;
      state.isActive = false;
      state.payload._completionTracker?.onComplete?.();
    } else {
      state.isActive = false;
    }
    if (state._done) {
      state.cleanup.forEach((fn) => {
        try {
          fn();
        } catch {
        }
      });
      state.cleanup = [];
    }
    const placement = state.payload.placement || "bottom";
    const knownPlacements = /* @__PURE__ */ new Set(["top", "bottom", "left", "right"]);
    state.element.classList.remove("visible");
    state.element.classList.add(knownPlacements.has(placement) ? `dismissing-${placement}` : "dismissing");
    setTimeout(() => {
      state.element.parentNode?.removeChild(state.element);
      if (state._done) {
        activePopovers.delete(state.id);
      }
    }, 200);
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
        if (b.action === "advance") payload._completionTracker?.onStepAdvance?.(payload.stepId || id);
        else if (b.action === "dismiss") dismissPopover(id);
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
        if (payload.executionMode === "Linear" || payload.executionMode === "AnyOrder") {
          break;
        }
        let t;
        const show = () => {
          clearTimeout(t);
          showPopover(state, payload);
        };
        const hide = () => {
          if (document.querySelector(".dap-confirm-overlay")) return;
          t = window.setTimeout(() => hidePopover(state, payload, false), 120);
        };
        targetElement.addEventListener("mouseenter", show);
        targetElement.addEventListener("mouseleave", hide);
        element.addEventListener("mouseenter", () => clearTimeout(t));
        element.addEventListener("mouseleave", hide);
        state.cleanup.push(
          () => targetElement.removeEventListener("mouseenter", show),
          () => targetElement.removeEventListener("mouseleave", hide)
        );
        break;
      }
      case "focus": {
        showPopover(state, payload);
        if (payload.executionMode === "Linear" || payload.executionMode === "AnyOrder") {
          break;
        }
        const show = () => showPopover(state, payload);
        const hide = () => {
          if (document.querySelector(".dap-confirm-overlay")) return;
          hidePopover(state, payload, false);
        };
        targetElement.addEventListener("focus", show);
        targetElement.addEventListener("blur", hide);
        state.cleanup.push(
          () => targetElement.removeEventListener("focus", show),
          () => targetElement.removeEventListener("blur", hide)
        );
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
    requestAnimationFrame(() => state.element.classList.add("visible"));
    setupGlobalEventHandlers(state, payload);
    rewireCloseButton(state);
    if (hasButtons(payload)) {
      state.element.setAttribute("tabindex", "-1");
      state.element.focus();
      trapFocus(state.element);
    }
  }
  function hidePopover(state, payload, isCompletion = true) {
    if (!state.isActive || state._done) return;
    fullDismiss(state, false, isCompletion);
  }
  function dismissPopover(id, abort = false) {
    const state = activePopovers.get(id);
    if (state) fullDismiss(state, abort);
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
    const fits = (p) => !!p && p.top >= PAD && p.left >= PAD && p.top + pRect.height <= vh - PAD && p.left + pRect.width <= vw - PAD;
    const VALID = /* @__PURE__ */ new Set(["top", "bottom", "left", "right"]);
    let best = VALID.has(placement.toLowerCase()) ? placement.toLowerCase() : "bottom";
    if (!fits(positions[best])) {
      for (const k of ["bottom", "top", "right", "left"]) {
        if (fits(positions[k])) {
          best = k;
          break;
        }
      }
    }
    const pos = positions[best] ?? positions.bottom;
    const top = Math.max(PAD, Math.min(pos.top, vh - pRect.height - PAD));
    const left = Math.max(PAD, Math.min(pos.left, vw - pRect.width - PAD));
    element.style.top = `${top}px`;
    element.style.left = `${left}px`;
    state.payload.placement = best;
    if (showArrow) positionArrow(element, tRect, best, { top, left }, sx, sy);
  }
  function positionArrow(popover, tRect, placement, popPos, sx, sy) {
    const arrow = popover.querySelector(".dap-popover-arrow-v2");
    if (!arrow) return;
    const cx = tRect.left + sx + tRect.width / 2;
    const cy = tRect.top + sy + tRect.height / 2;
    const S = 8;
    arrow.style.transform = "rotate(45deg)";
    arrow.style.top = "";
    arrow.style.bottom = "";
    arrow.style.left = "";
    arrow.style.right = "";
    popover.setAttribute("data-placement", placement);
    switch (placement) {
      case "top":
        arrow.style.bottom = `-${S}px`;
        arrow.style.left = `${Math.max(14, Math.min(cx - popPos.left - S, popover.offsetWidth - 28))}px`;
        break;
      case "bottom":
        arrow.style.top = `-${S}px`;
        arrow.style.left = `${Math.max(14, Math.min(cx - popPos.left - S, popover.offsetWidth - 28))}px`;
        break;
      case "left":
        arrow.style.right = `-${S}px`;
        arrow.style.top = `${Math.max(14, Math.min(cy - popPos.top - S, popover.offsetHeight - 28))}px`;
        break;
      case "right":
        arrow.style.left = `-${S}px`;
        arrow.style.top = `${Math.max(14, Math.min(cy - popPos.top - S, popover.offsetHeight - 28))}px`;
        break;
    }
  }
  function setupGlobalEventHandlers(state, payload) {
    const clickOutside = (e) => {
      if (payload.executionMode === "Linear" || payload.executionMode === "AnyOrder") return;
      const t = e.target;
      if (t instanceof Element && t.closest && t.closest(".dap-confirm-overlay")) return;
      if (!state.element.contains(t) && !state.targetElement.contains(t)) hidePopover(state, payload, false);
    };
    const esc = (e) => {
      if (document.querySelector(".dap-confirm-overlay")) return;
      if (e.key === "Escape") hidePopover(state);
    };
    const nav = () => hidePopover(state);
    setTimeout(() => {
      document.addEventListener("click", clickOutside);
      document.addEventListener("keydown", esc);
      window.addEventListener("beforeunload", nav);
      window.addEventListener("popstate", nav);
    }, 100);
    state.cleanup.push(
      () => document.removeEventListener("click", clickOutside),
      () => document.removeEventListener("keydown", esc),
      () => window.removeEventListener("beforeunload", nav),
      () => window.removeEventListener("popstate", nav)
    );
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
  var activeBeacons = /* @__PURE__ */ new Map();
  var BEACON_STYLES = `

/* \u2500\u2500 Entry / exit animations \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@keyframes dap-beacon-in {
  from { opacity: 0; transform: translateY(12px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}

@keyframes dap-beacon-out {
  from { opacity: 1; transform: translateY(0)   scale(1);    }
  to   { opacity: 0; transform: translateY(8px) scale(0.95); }
}

@keyframes dap-beacon-pulse-anim {
  0%, 100% { box-shadow: var(--beacon-shadow-base); }
  50%      { box-shadow: var(--beacon-shadow-base), 
                         0 0 0 6px var(--beacon-pulse-color); }
}

@keyframes dap-dot-ring {
  0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.8; }
  80%  { opacity: 0.15; }
  100% { transform: translate(-50%, -50%) scale(3.8); opacity: 0;   }
}

.dap-beacon-v2 {
  /* \u2500\u2500 Internal design tokens \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
  --beacon-radius:        16px;
  --beacon-gap:           12px;
  --beacon-padding-x:     18px;
  --beacon-padding-y:     16px;
  --beacon-title-size:    15px;
  --beacon-body-size:     14px;
  --beacon-btn-height:    30px;
  --beacon-blink-speed:   2.2s;

  /* Pulse shadow base */
  --beacon-shadow-base:
    0 12px 32px var(--dap-primary-glow, rgba(71, 85, 105, 0.20)),
    0 4px 12px rgba(15, 23, 42, 0.06);

  /* Pulse ring color */
  --beacon-pulse-color: var(--dap-primary-glow, rgba(71, 85, 105, 0.35));

  position: fixed;
  z-index: 2147483640;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  pointer-events: auto;
  user-select: none;
  overflow: hidden;

  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: auto;
  max-width: 320px;
  min-width: 140px;

  background: var(--dap-surface, #ffffff);
  border: 1px solid var(--dap-primary, rgba(100, 116, 139, 0.3));
  box-shadow: var(--beacon-shadow-base);
  border-radius: var(--beacon-radius);
  animation: dap-beacon-in 0.4s cubic-bezier(0.2, 1, 0.3, 1) both;

  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  cursor: default;
}

.dap-beacon-main {
  padding: var(--beacon-padding-y) var(--beacon-padding-x);
  display: flex;
  flex-direction: column;
  gap: var(--beacon-gap);
  position: relative;
}

/* Header row (dot + title) */
.dap-beacon-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dap-beacon-v2.dap-beacon-ready {
  animation: dap-beacon-pulse-anim var(--beacon-blink-speed) ease-in-out infinite;
}

.dap-beacon-v2.exiting {
  animation: dap-beacon-out 0.22s cubic-bezier(0.4, 0, 1, 1) both !important;
}

.dap-beacon-dot-wrap {
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dap-beacon-dot-core {
  position: relative;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--dap-primary, #475569);
  z-index: 2;
  box-shadow: 0 0 0 2px var(--dap-primary-soft, rgba(100,116,139,0.20));
}

.dap-beacon-dot-core.has-icon {
  width: 28px;
  height: 28px;
  background: var(--dap-primary-soft, rgba(100,116,139,0.16));
  border: 1.5px solid var(--dap-border-strong, rgba(100,116,139,0.28));
  color: var(--dap-primary, #475569);
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dap-beacon-dot-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid var(--dap-primary, #475569);
  animation: dap-dot-ring var(--beacon-blink-speed, 2s) ease-out infinite;
  pointer-events: none;
}
.dap-beacon-dot-ring.ring-2 {
  animation-delay: calc(var(--beacon-blink-speed, 2s) * -0.5);
}

.dap-beacon-title {
  font-size: var(--beacon-title-size);
  font-weight: 700;
  color: #000000;
  line-height: 1.35;
  margin: 0;
}

.dap-beacon-body {
  display: block;
  font-size: var(--beacon-body-size);
  font-weight: 400;
  color: #1f2937;
  line-height: 1.55;
}

.dap-beacon-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.dap-beacon-btn {
  height: var(--beacon-btn-height);
  padding: 0 16px;
  border-radius: 8px;
  background: var(--dap-primary, #475569);
  border: none;
  color: #ffffff;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px var(--dap-primary-glow, rgba(71, 85, 105, 0.24));
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.dap-beacon-btn:hover {
  background: var(--dap-primary-dark, #334155);
  transform: translateY(-1.5px);
  box-shadow: 0 6px 16px var(--dap-primary-glow, rgba(71, 85, 105, 0.30));
}

.dap-beacon-close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--dap-ink-muted, #64748B);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  transition: all 0.2s ease;
  opacity: 0.5;
  z-index: 10;
}
.dap-beacon-close:hover {
  opacity: 1;
  background: rgba(0,0,0,0.05);
  transform: rotate(90deg);
}

/* \u2500\u2500 Navigation Row (Linear mode) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-beacon-nav-row {
  display: flex;
  align-items: stretch;
  border-top: 1px solid rgba(0,0,0,0.06);
  margin-top: 0;
}
.dap-beacon-step-counter {
  flex: 1;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 12.5px;
  font-weight: 600;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  letter-spacing: 0.01em;
}
.dap-beacon-nav-btn {
  padding: 8px 16px;
  background: var(--dap-primary, #3b82f6);
  color: #ffffff;
  border: none;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.2s ease;
}
.dap-beacon-nav-btn:hover {
  filter: brightness(1.1);
}
.dap-beacon-nav-btn:active {
  filter: brightness(0.9);
}
`;
  function registerBeacon() {
    register("beacon", renderBeacon);
  }
  async function renderBeacon(flow) {
    const { payload, id } = flow;
    ensureBeaconStyles();
    let targetElement;
    if (payload.targetSelector) {
      const el = resolveSelectorWithPriority(payload.targetSelector);
      if (el instanceof HTMLElement) targetElement = el;
    }
    const existingState = activeBeacons.get(id);
    if (existingState) {
      const existingPayload = existingState.element.__beaconPayload;
      if (existingState.isActive && document.body.contains(existingState.element)) {
        existingState.targetElement = targetElement;
        if (targetElement) positionNearElement(existingState.element, targetElement);
        else applyFixedPosition(existingState.element, payload.position || "bottom-right");
        existingState.element.__beaconPayload = {
          ...existingPayload || payload,
          _completionTracker: payload._completionTracker || existingPayload?._completionTracker
        };
        return;
      }
      cleanupBeacon(id);
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
    const bs = payload.beaconStyles;
    if (bs && bs.enabled !== false && bs?.color1) {
      const accent = bs.color1;
      const pulseColor = hexToRgba(accent, 0.35);
      const iconBg = hexToRgba(accent, 0.14);
      const iconBorder = hexToRgba(accent, 0.28);
      const accent2 = bs.color2 || lightenHex(accent);
      beacon.style.setProperty("--dap-primary", accent);
      beacon.style.setProperty("--dap-primary-rgb", hexToRgbTuple(accent));
      beacon.style.setProperty("--dap-primary-dark", bs.color2 || lightenHex(accent));
      beacon.style.setProperty("--dap-primary-soft", iconBg);
      beacon.style.setProperty("--dap-primary-glow", hexToRgba(accent, 0.24));
      beacon.style.setProperty("--dap-border-strong", iconBorder);
      beacon.style.setProperty("--dap-gradient", `linear-gradient(90deg, ${accent} 0%, ${accent2} 100%)`);
      beacon.style.setProperty("--beacon-pulse-color", pulseColor);
    }
    const blinkRateSource = payload.blinkRate ?? bs?.duration;
    if (blinkRateSource != null) {
      beacon.style.setProperty("--beacon-blink-speed", normalizeBeaconBlinkSpeed(blinkRateSource));
    }
    if (bs?.borderRadius) {
      beacon.style.setProperty("--beacon-radius", bs.borderRadius);
    }
    const main = document.createElement("div");
    main.className = "dap-beacon-main";
    const headerRow = document.createElement("div");
    headerRow.className = "dap-beacon-header-row";
    const dotWrap = document.createElement("div");
    dotWrap.className = "dap-beacon-dot-wrap";
    const dotCore = document.createElement("div");
    if (payload.icon) {
      dotCore.className = "dap-beacon-dot-core has-icon";
      dotCore.textContent = payload.icon;
    } else {
      dotCore.className = "dap-beacon-dot-core";
    }
    dotWrap.appendChild(dotCore);
    const ring1 = document.createElement("div");
    ring1.className = "dap-beacon-dot-ring ring-1";
    dotWrap.appendChild(ring1);
    const ring2 = document.createElement("div");
    ring2.className = "dap-beacon-dot-ring ring-2";
    dotWrap.appendChild(ring2);
    headerRow.appendChild(dotWrap);
    if (payload.title) {
      const title = document.createElement("h4");
      title.className = "dap-beacon-title";
      title.textContent = payload.title;
      headerRow.appendChild(title);
    }
    main.appendChild(headerRow);
    if (payload.body) {
      const body = document.createElement("div");
      body.className = "dap-beacon-body";
      body.innerHTML = sanitizeHtml(payload.body);
      main.appendChild(body);
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
      main.appendChild(actions);
    }
    beacon.appendChild(main);
    if (payload.executionMode === "Linear" || payload.executionMode === "AnyOrder") {
      const navRow = document.createElement("div");
      navRow.className = "dap-beacon-nav-row";
      if (payload.stepIndex !== void 0 && payload.totalSteps !== void 0) {
        const stepCounter = document.createElement("div");
        stepCounter.className = "dap-beacon-step-counter";
        stepCounter.textContent = `Step ${payload.stepIndex + 1} of ${payload.totalSteps}`;
        navRow.appendChild(stepCounter);
      }
      if (payload.executionMode === "Linear") {
        const navBtn = document.createElement("button");
        navBtn.type = "button";
        navBtn.className = "dap-beacon-nav-btn";
        navBtn.textContent = payload.isLastStep ? "Done" : "Next";
        navBtn.addEventListener("click", () => dismissBeacon(id));
        navRow.appendChild(navBtn);
      }
      beacon.appendChild(navRow);
    }
    const close = document.createElement("button");
    close.className = "dap-beacon-close";
    close.textContent = "\xD7";
    close.title = "Dismiss";
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      if (payload.executionMode === "Linear") {
        showConfirmClose({
          onConfirm: () => {
            dismissBeacon(id, true);
          }
        });
      } else {
        dismissBeacon(id);
      }
    });
    beacon.appendChild(close);
    beacon.__beaconPayload = payload;
    return beacon;
  }
  function hexToRgba(hex, alpha) {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(71, 85, 105, ${alpha})`;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  function hexToRgbTuple(hex) {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return "71, 85, 105";
    return `${r}, ${g}, ${b}`;
  }
  function lightenHex(hex) {
    const clean = hex.replace("#", "");
    const r = Math.min(255, parseInt(clean.substring(0, 2), 16) + 30);
    const g = Math.min(255, parseInt(clean.substring(2, 4), 16) + 30);
    const b = Math.min(255, parseInt(clean.substring(4, 6), 16) + 30);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return "#64748B";
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }
  function normalizeBeaconBlinkSpeed(raw) {
    if (typeof raw === "number") {
      if (!isFinite(raw) || raw <= 0) return "2s";
      return `${Math.round(Math.max(1400, Math.min(raw, 8e3)))}ms`;
    }
    const text = (raw || "").trim().toLowerCase();
    if (!text) return "2s";
    let ms = null;
    if (text.endsWith("ms")) {
      const p = parseFloat(text.slice(0, -2));
      if (isFinite(p)) ms = p;
    } else if (text.endsWith("s")) {
      const p = parseFloat(text.slice(0, -1));
      if (isFinite(p)) ms = p * 1e3;
    } else {
      const p = parseFloat(text);
      if (isFinite(p)) ms = p;
    }
    if (!ms || ms <= 0) return "2s";
    return `${Math.round(Math.max(1400, Math.min(ms, 8e3)))}ms`;
  }
  function showBeacon(state, payload) {
    if (state.isActive) return;
    state.isActive = true;
    state.element.style.visibility = "hidden";
    document.body.appendChild(state.element);
    const reposition = () => {
      if (state.targetElement) positionNearElement(state.element, state.targetElement);
      else applyFixedPosition(state.element, payload.position || "bottom-right");
    };
    setTimeout(() => {
      if (state.isActive) state.element.classList.add("dap-beacon-ready");
    }, 380);
    requestAnimationFrame(() => {
      reposition();
      state.element.style.visibility = "";
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
  function dismissBeacon(id, abort = false) {
    const state = activeBeacons.get(id);
    if (!state?.isActive) return;
    state.isActive = false;
    state.element.classList.add("exiting");
    const payload = state.element.__beaconPayload;
    if (abort) {
      payload?._completionTracker?.onAbort?.();
    } else {
      payload?._completionTracker?.onComplete?.();
    }
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
    let el = document.getElementById("dap-beacon-style-v2");
    if (!el) {
      el = document.createElement("style");
      el.id = "dap-beacon-style-v2";
      document.head.appendChild(el);
    }
    if (el.textContent !== BEACON_STYLES) {
      el.textContent = BEACON_STYLES;
    }
  }

  // src/experiences/banner.ts
  var bannerCssText = `
/* Font stack: system fonts are used; no external font requests are made. */

:root {
  --dap-z-banner: 2147483620;
  --dap-banner-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --dap-banner-radius: 8px;
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
.dap-banner-wrap.relative {
  position: fixed;
  top: 0; left: 0; right: auto; bottom: auto;
  padding: 0;
  width: auto;
  height: auto;
  justify-content: flex-start;
  transition: opacity 0.24s cubic-bezier(0.22, 1, 0.36, 1),
              transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

/* \u2500\u2500 Banner card \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
 * Base card: white bg, light gray border, left accent bar.
 * Each variant overrides --_accent, --_card-bg, --_card-border.
 * The ::before pseudo is the left accent bar.
 * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner {
  position: relative;
  width: auto;
  min-width: 320px;
  max-width: 440px;
  border-radius: var(--dap-banner-radius);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  font-family: var(--dap-banner-font);
  pointer-events: auto;
  overflow: hidden;
  padding: 0;

  /* Default (fallback) appearance */
  --_accent:       #2563EB;
  --_card-bg:      #ffffff;
  --_card-border:  rgba(203, 213, 225, 0.8);  /* slate-200 */

  background:   var(--_card-bg);
  color:        #000000;
  border:       1px solid var(--_card-border);
  box-shadow:   0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 16px rgba(15, 23, 42, 0.05);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* \u2500\u2500 Left accent bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
  background: var(--_accent);
  z-index: 2;
  border-radius: var(--dap-banner-radius) 0 0 var(--dap-banner-radius);
}

/* \u2500\u2500 Per-variant colours \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner.info    { --_accent: #2563EB; --_card-bg: #e5eefbff; --_card-border: rgba(203, 213, 225, 0.9); }
.dap-banner.success { --_accent: #10B981; --_card-bg: #F0FDF4; --_card-border: #BBF7D0; }
.dap-banner.warning { --_accent: #F59E0B; --_card-bg: #FFFBEB; --_card-border: #FDE68A; }
.dap-banner.error   { --_accent: #EF4444; --_card-bg: #FFF1F2; --_card-border: #FECDD3; }

/* \u2500\u2500 Main Content Area \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner-main {
  display: flex;
  align-items: flex-start;
  padding: 16px 40px 16px 20px; /* Extra right for close btn */
  gap: 12px;
  flex: 1;
}

.dap-banner-icon {
  flex-shrink: 0;
  width:  28px;
  height: 28px;
  border-radius: 50%;
  background: var(--_accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  position: relative;
  z-index: 1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  line-height: 1;
}

.dap-banner-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  z-index: 1;
}

.dap-banner-message {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  color: #000000;
  white-space: normal;
  word-break: break-word;
}

/* \u2500\u2500 Actions Row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner-actions {
  display: flex;
  gap: 8px;
  padding: 0 20px 16px 20px;
  flex-wrap: wrap;
}

.dap-banner-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: var(--_accent);
  color: #ffffff;
  border: none;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.dap-banner-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
.dap-banner-btn.secondary { background: transparent; color: var(--_accent); border: 1px solid var(--_accent); }
.dap-banner-btn.secondary:hover { background: var(--_card-bg, rgba(0,0,0,0.04)); }

/* \u2500\u2500 Footer (Linear Navigation) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner-footer {
  display: flex;
  align-items: stretch;
  background: #e0f2fe; /* Very light blue */
  min-height: 32px;
  border-top: 1px solid rgba(0,0,0,0.05);
  margin-top: auto;
}

.dap-banner-step-counter {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 16px;
  color: #0369a1;
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
}

.dap-banner-nav-btn {
  padding: 0 16px;
  background: var(--dap-primary, #0ea5e9); /* Brand Blue */
  color: #ffffff;
  border: none;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dap-banner-nav-btn:hover { background: var(--dap-primary-dark, #0284c7); }
.dap-banner-nav-btn:active { background: var(--dap-primary-darker, #0369a1); }

/* \u2500\u2500 Close button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  background: transparent;
  border: none;
  cursor: pointer;
  width:  24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 400;
  line-height: 1;
  color: #9CA3AF;
  transition: color 0.15s ease, transform 0.15s ease;
  padding: 0;
}
.dap-banner-close:hover { color: #374151; transform: scale(1.1); }

/* \u2500\u2500 Mobile \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@media (max-width: 480px) {
  .dap-banner-wrap { padding: 0 12px; }
  .dap-banner {
    min-width: calc(100vw - 40px);
    max-width: calc(100vw - 24px);
  }
}

/* \u2500\u2500 Slide-in animations \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-banner-wrap.top .dap-banner    { animation: bannerSlideDown 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
.dap-banner-wrap.bottom .dap-banner { animation: bannerSlideUp 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }

@keyframes bannerSlideDown {
  from { opacity: 0; transform: translateY(-16px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)     scale(1);    }
}
@keyframes bannerSlideUp {
  from { opacity: 0; transform: translateY(16px)  scale(0.98); }
  to   { opacity: 1; transform: translateY(0)     scale(1);    }
}
@keyframes bannerSlideOutTop {
  from { opacity: 1; transform: translateY(0)     scale(1);    }
  to   { opacity: 0; transform: translateY(-12px) scale(0.98); }
}
@keyframes bannerSlideOutBottom {
  from { opacity: 1; transform: translateY(0)     scale(1);    }
  to   { opacity: 0; transform: translateY(12px)  scale(0.98); }
}

`;
  var VARIANT_ICONS = {
    info: "i",
    warning: "!",
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
    payload._completionTracker;
    let target = null;
    if (payload.targetSelector) {
      target = await waitForTarget2(payload.targetSelector, 5e3);
    }
    const wrap = document.createElement("div");
    wrap.id = `dap-banner-wrap-${id}`;
    const isRelative = !!target;
    wrap.className = `dap-banner-wrap ${isRelative ? "relative" : payload.position || "top"}`;
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
    const mainEl = document.createElement("div");
    mainEl.className = "dap-banner-main";
    const iconEl = document.createElement("div");
    iconEl.className = "dap-banner-icon";
    iconEl.textContent = VARIANT_ICONS[variant] ?? "i";
    const contentEl = document.createElement("div");
    contentEl.className = "dap-banner-content";
    const messageEl = document.createElement("div");
    messageEl.className = "dap-banner-message";
    messageEl.innerHTML = sanitizeHtml(payload.message);
    contentEl.appendChild(messageEl);
    mainEl.appendChild(iconEl);
    mainEl.appendChild(contentEl);
    banner.appendChild(mainEl);
    const actionsEl = document.createElement("div");
    actionsEl.className = "dap-banner-actions";
    let _isDismissed = false;
    const position = payload.position || "top";
    const advance = () => {
      if (_isDismissed) return;
      _isDismissed = true;
      const isBottom = position === "bottom";
      wrap.style.animation = isBottom ? "bannerSlideOutBottom 0.22s cubic-bezier(0.4,0,1,1) both" : "bannerSlideOutTop 0.22s cubic-bezier(0.4,0,1,1) both";
      wrap.addEventListener("animationend", () => {
        if (wrap.parentNode) {
          wrap.parentNode.removeChild(wrap);
          payload._completionTracker?.onComplete?.();
        }
      }, { once: true });
    };
    let dismiss = () => {
      if (_isDismissed) return;
      if (payload.executionMode === "Linear") {
        showConfirmClose({
          onConfirm: () => {
            _isDismissed = true;
            const isBottom = position === "bottom";
            wrap.style.animation = isBottom ? "bannerSlideOutBottom 0.22s cubic-bezier(0.4,0,1,1) both" : "bannerSlideOutTop 0.22s cubic-bezier(0.4,0,1,1) both";
            wrap.addEventListener("animationend", () => {
              if (wrap.parentNode) {
                wrap.parentNode.removeChild(wrap);
                payload._completionTracker?.onAbort?.();
              }
            }, { once: true });
          }
        });
        return;
      }
      advance();
    };
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
      banner.appendChild(actionsEl);
    }
    if (payload.executionMode === "Linear" || payload.executionMode === "AnyOrder") {
      const footerEl = document.createElement("div");
      footerEl.className = "dap-banner-footer";
      const stepCounter = document.createElement("div");
      stepCounter.className = "dap-banner-step-counter";
      if (payload.stepIndex !== void 0 && payload.totalSteps !== void 0) {
        stepCounter.textContent = `Step ${payload.stepIndex + 1} of ${payload.totalSteps}`;
      }
      footerEl.appendChild(stepCounter);
      if (payload.executionMode === "Linear") {
        const navBtn = document.createElement("button");
        navBtn.className = "dap-banner-nav-btn";
        navBtn.textContent = payload.isLastStep ? "Done" : "Next";
        navBtn.addEventListener("click", () => advance());
        footerEl.appendChild(navBtn);
      }
      banner.appendChild(footerEl);
    }
    const closeBtn = document.createElement("button");
    closeBtn.className = "dap-banner-close";
    closeBtn.innerHTML = "\xD7";
    closeBtn.setAttribute("aria-label", "Close banner");
    closeBtn.addEventListener("click", dismiss);
    if (payload.dismissible === false && payload.executionMode !== "Linear" && payload.executionMode !== "AnyOrder") {
      closeBtn.style.display = "none";
    }
    banner.appendChild(closeBtn);
    wrap.appendChild(banner);
    root.appendChild(wrap);
    if (isRelative && target) {
      const positionBanner = () => {
        const tRect = target.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        const placement = payload.placement || payload.position || "top";
        const gap = 12;
        let top = 0;
        let left = 0;
        switch (placement) {
          case "top":
            top = tRect.top - wrapRect.height - gap;
            left = tRect.left + (tRect.width - wrapRect.width) / 2;
            break;
          case "bottom":
            top = tRect.bottom + gap;
            left = tRect.left + (tRect.width - wrapRect.width) / 2;
            break;
          case "left":
            top = tRect.top + (tRect.height - wrapRect.height) / 2;
            left = tRect.left - wrapRect.width - gap;
            break;
          case "right":
            top = tRect.top + (tRect.height - wrapRect.height) / 2;
            left = tRect.right + gap;
            break;
          default:
            top = tRect.top - wrapRect.height - gap;
            left = tRect.left + (tRect.width - wrapRect.width) / 2;
        }
        const pad = 16;
        left = Math.max(pad, Math.min(left, window.innerWidth - wrapRect.width - pad));
        top = Math.max(pad, Math.min(top, window.innerHeight - wrapRect.height - pad));
        wrap.style.top = `${top}px`;
        wrap.style.left = `${left}px`;
      };
      requestAnimationFrame(positionBanner);
      const onUpdate = () => {
        if (!_isDismissed) positionBanner();
      };
      window.addEventListener("scroll", onUpdate, true);
      window.addEventListener("resize", onUpdate);
      const originalDismiss = dismiss;
      dismiss = () => {
        window.removeEventListener("scroll", onUpdate, true);
        window.removeEventListener("resize", onUpdate);
        originalDismiss();
      };
      closeBtn.removeEventListener("click", originalDismiss);
      closeBtn.addEventListener("click", dismiss);
    }
  }
  async function waitForTarget2(selector, timeout) {
    const startTime = Date.now();
    let element = resolveSelectorWithPriority(selector);
    if (element) return element;
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        element = resolveSelectorWithPriority(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          observer.disconnect();
          resolve(null);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(resolveSelectorWithPriority(selector));
      }, timeout);
    });
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
  var hotspotsCssText = `
/* Font stack: system fonts are used; no external font requests are made. */

:root {
  --dap-z-hotspots: 2147483630;
  --hs-primary:   var(--dap-primary, #6366F1);
  --hs-success:   var(--dap-primary-light, #10B981);
  --hs-required:  var(--dap-primary-dark, #F59E0B);
  --hs-bg:        var(--dap-surface, #ffffff);
  --hs-border:    var(--dap-border, #94A3B8);
  --hs-text:      #000000 !important;
  --hs-muted:     #64748B;
  --hs-shadow:    0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06);
  --hs-font:      system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --hs-radius:    16px;
}

/* \u2500\u2500 Overlay \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-hotspots-overlay {
  position: fixed;
  inset: 0;
  background: var(--dap-backdrop-bg, var(--tour-overlay));
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
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
  background: var(--dap-glass-bg, #ffffff);
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
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
  var hotspotTourCssText = `
/* Font stack: system fonts are used; no external font requests are made. */

:root {
  --dap-z-tour: 2147483635;
  --tour-primary:  #6366F1;
  --tour-primary2: #818CF8;
  --tour-bg:       var(--dap-surface, #ffffff);
  --tour-overlay:  rgba(2, 6, 23, 0.62);
  --tour-border:   var(--dap-border, #94A3B8);
  --tour-text:     #000000 !important;
  --tour-muted:    #000000 !important;
  --tour-shadow:   0 20px 60px rgba(0,0,0,0.14), 0 6px 18px rgba(0,0,0,0.07);
  --tour-font:     system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --tour-radius:   18px;
}

/* \u2500\u2500 Overlay \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dap-tour-overlay {
  position: fixed; inset: 0;
  background: var(--dap-backdrop-bg, rgba(2, 6, 23, 0.62));
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
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
  background: var(--dap-glass-bg, #ffffff);
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
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
  var taskListCssText = `
:root {
  --dap-z-tasklist: 2147483625;
  --dap-tasklist-bg: #ffffff;
  --dap-tasklist-border: var(--dap-primary, #000000);
  --dap-tasklist-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  --dap-tasklist-text: #000000 !important;
  --dap-tasklist-text-muted: #000000 !important;
  --dap-tasklist-primary: var(--dap-primary, #000000);
  --dap-tasklist-success: var(--dap-primary, #000000);
  --dap-tasklist-overlay: var(--dap-backdrop-bg, rgba(15, 23, 42, 0.3));
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
  background: var(--sdk-background, #ffffff);
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
  border-bottom: 1px solid var(--dap-tasklist-border);
  transition: background-color 0.15s ease;
}

.dap-tasklist-item:last-child {
  border-bottom: none;
}

.dap-tasklist-item:hover {
  background: var(--sdk-background-hover, #ffffff);
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
  border-color: var(--dap-tasklist-primary);
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
  color: #000000 !important;
  margin: 0 0 4px 0;
  line-height: 1.4;
}

.dap-tasklist-item.completed .dap-tasklist-item-title {
  text-decoration: line-through;
  color: var(--dap-tasklist-text-muted);
}

.dap-tasklist-item-description {
  font-size: 13px;
  color: #000000 !important;
  line-height: 1.4;
  margin: 0;
}

.dap-tasklist-required-badge {
  display: inline-block;
  background: var(--dap-primary-soft, #ffffff);
  color: #000000 !important;
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
  background: var(--dap-primary-dark, #000000);
  border-color: var(--dap-primary-dark, #000000);
}

.dap-tasklist-btn.success {
  background: var(--dap-tasklist-success);
  border-color: var(--dap-tasklist-success);
  color: white;
}

.dap-tasklist-btn.success:hover {
  background: var(--dap-primary-dark, #000000);
  border-color: var(--dap-primary-dark, #000000);
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
  var walkthroughCssText = `
:root {
  --dap-z-walkthrough: 2147483630;
  --dap-walkthrough-overlay: var(--dap-backdrop-bg, rgba(15, 23, 42, 0.75));
  --dap-walkthrough-bg: var(--dap-surface, #ffffff);
  --dap-walkthrough-border: var(--dap-primary, #000000);
  --dap-walkthrough-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  --dap-walkthrough-text: #000000 !important;
  --dap-walkthrough-text-muted: #000000 !important;
  --dap-walkthrough-primary: var(--dap-primary, #000000);
  --dap-walkthrough-success: var(--dap-primary, #000000);
  --dap-walkthrough-highlight: var(--dap-primary-light, #ffffff);
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
  background: var(--dap-glass-bg, #ffffff);
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
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
  display: none;
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
  display: flex;
  align-items: stretch;
  padding: 0;
  border-top: none;
  background: transparent;
  border-radius: 0 0 12px 12px;
  overflow: hidden;
}

.dap-walkthrough-progress {
  display: none;
}

.dap-walkthrough-progress-dot {
  display: none;
}

.dap-walkthrough-nav {
  display: flex;
  background: var(--dap-primary, #5ba3e4);
  align-items: stretch;
}

.dap-walkthrough-btn {
  padding: 12px 20px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  text-transform: uppercase;
  transition: background 0.15s ease, filter 0.15s ease;
}

.dap-walkthrough-btn:hover:not(:disabled) {
  background: var(--dap-primary-dark, #0284c7);
  filter: brightness(1.05);
}
.dap-walkthrough-btn:active:not(:disabled) {
  background: var(--dap-primary-darker, #0369a1);
  filter: brightness(0.95);
}

.dap-walkthrough-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dap-walkthrough-btn.primary, .dap-walkthrough-btn.success {
  background: transparent;
  color: white;
  border-color: transparent;
}

.dap-walkthrough-btn.primary:hover:not(:disabled), .dap-walkthrough-btn.success:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.1);
  border-color: transparent;
}

.dap-walkthrough-step-count {
  flex: 1;
  background: var(--dap-primary-darker, #111827);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  margin: 0;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  white-space: nowrap;
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
      stepCount.textContent = `Step ${stepIndex + 1} of ${payload.steps.length}`;
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
        <span class="dap-walkthrough-step-count">Step 1 of 1</span>
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

  // src/services/telemetryService.ts
  function getBaseUrl3(apiurl) {
    return (apiurl || "").replace(/\/+$/, "");
  }
  function generateUlid() {
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    let now = Date.now();
    let timeStr = "";
    for (let i = 0; i < 10; i++) {
      const mod = now % 32;
      timeStr = alphabet[mod] + timeStr;
      now = Math.floor(now / 32);
    }
    let randStr = "";
    for (let i = 0; i < 16; i++) {
      const rand = Math.floor(Math.random() * 32);
      randStr += alphabet[rand];
    }
    return timeStr + randStr;
  }
  function generateUuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  }
  function getBrowserName() {
    if (typeof navigator === "undefined") return "Unknown";
    const ua = navigator.userAgent;
    if (ua.indexOf("Chrome") > -1) {
      if (ua.indexOf("Edg") > -1) return "Edge";
      return "Chrome";
    }
    if (ua.indexOf("Safari") > -1) return "Safari";
    if (ua.indexOf("Firefox") > -1) return "Firefox";
    if (ua.indexOf("MSIE") > -1 || ua.indexOf("Trident") > -1) return "IE";
    return "Unknown";
  }
  var _TelemetryService = class _TelemetryService {
    constructor() {
      this._config = null;
      this._sessionId = null;
      this._isInitialized = false;
      this._inMemoryQueue = [];
      this._intervalId = null;
      this._isFlushing = false;
      this._pendingEvents = [];
      this.STORAGE_KEY = "dap_telemetry_event_queue";
      this.SESSION_ID_KEY = "dap_player_session_id";
      this.BATCH_INTERVAL_MS = 6e4;
      this.initializeSession();
    }
    static getInstance() {
      if (!this._instance) {
        this._instance = new _TelemetryService();
      }
      return this._instance;
    }
    /**
     * Set configuration and initialize background services
     */
    setConfig(config) {
      this._config = config;
      if (!this._isInitialized) {
        this.initializeService();
      }
    }
    /**
     * Initialize or retrieve the session ID
     */
    initializeSession() {
      try {
        if (typeof sessionStorage !== "undefined") {
          let stored = sessionStorage.getItem(this.SESSION_ID_KEY);
          if (!stored) {
            stored = `sess_runtime_${generateUuid().replace(/-/g, "")}`;
            sessionStorage.setItem(this.SESSION_ID_KEY, stored);
          }
          this._sessionId = stored;
        } else {
          this._sessionId = `sess_runtime_${generateUuid().replace(/-/g, "")}`;
        }
      } catch {
        this._sessionId = `sess_runtime_${generateUuid().replace(/-/g, "")}`;
      }
    }
    /**
     * Get the current session ID
     */
    getSessionId() {
      if (!this._sessionId) {
        this.initializeSession();
      }
      return this._sessionId;
    }
    /**
     * Initialize the service, loads storage queue, runs interval flusher
     */
    initializeService() {
      try {
        if (typeof localStorage !== "undefined") {
          const stored = localStorage.getItem(this.STORAGE_KEY);
          if (stored) {
            this._inMemoryQueue = JSON.parse(stored);
            console.debug(`[DAP Telemetry] Loaded ${this._inMemoryQueue.length} events from storage.`);
          }
        }
      } catch (e) {
        console.warn("[DAP Telemetry] Failed to load queue from storage:", e);
        this._inMemoryQueue = [];
      }
      this.initializeSession();
      this.startInterval();
      if (typeof window !== "undefined") {
        const unloadHandler = () => {
          this.flushSync();
        };
        window.addEventListener("beforeunload", unloadHandler);
        window.addEventListener("pagehide", unloadHandler);
      }
      this._isInitialized = true;
      if (this._pendingEvents.length > 0) {
        console.debug(`[DAP Telemetry] Draining ${this._pendingEvents.length} pending events...`);
        this._pendingEvents.forEach((e) => {
          this.track(e.eventName, e.payload);
        });
        this._pendingEvents = [];
      }
      this.flush().catch((err) => console.error("[DAP Telemetry] Failed to flush telemetry on startup:", err));
    }
    /**
     * Tracks a telemetry event with proper metering dimensions.
     * 
     * Event structure follows the v1 telemetry ingestion spec:
     * - moduleKey: "player" (runtime SDK)
     * - eventName: stable event identifier (e.g., 'flow.launched', 'feature.used')
     * - billingDimension: one of EventsIngested, ConsumerSessions, BusinessActiveUsers, etc.
     * - classification: 0=Billable, 1=Informational, 2=Rejected
     * 
     * @param eventName Name of the event (e.g. 'feature.used', 'flow.launched')
     * @param payload Custom properties including dimensions.billingDimension for metering
     */
    track(eventName, payload = {}) {
      if (!this._isInitialized) {
        this._pendingEvents.push({ eventName, payload });
        return;
      }
      const timestamp = Date.now();
      const occurredAtUtc = new Date(timestamp).toISOString();
      const sanitizedEventName = eventName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const ulid = generateUlid();
      const eventId = `evt_player_${sanitizedEventName}_${ulid}`;
      const config = this._config || window.__DAP_CONFIG__;
      const orgId = config?.organizationid || payload.organizationId || null;
      let userId = null;
      try {
        const analyticsContext = userContextService.getAnalyticsContext();
        userId = analyticsContext?.userId || payload.userId || null;
      } catch {
        userId = payload.userId || null;
      }
      if (userId && !userId.startsWith("usr_runtime_")) {
        userId = `usr_runtime_${userId}`;
      }
      const siteCollectionId = config?.siteid || payload.siteCollectionId || null;
      const rawDimensions = {
        billingDimension: payload.dimensions?.billingDimension || payload.billingDimension || "EventsIngested",
        featureKey: payload.dimensions?.featureKey || payload.featureKey || "runtime_guidance",
        pageUrl: payload.dimensions?.pageUrl || (typeof window !== "undefined" ? window.location.href : ""),
        host: payload.dimensions?.host || (typeof window !== "undefined" ? window.location.host : ""),
        browser: getBrowserName(),
        ...payload.dimensions
      };
      const dimensions = {};
      for (const key of Object.keys(rawDimensions)) {
        const val = rawDimensions[key];
        if (val !== null && val !== void 0) {
          if (Array.isArray(val)) {
            dimensions[key] = val.join(", ");
          } else if (typeof val === "object") {
            dimensions[key] = JSON.stringify(val);
          } else {
            dimensions[key] = String(val);
          }
        }
      }
      const event = {
        eventId,
        moduleKey: "player",
        eventName,
        featureKey: payload.featureKey || dimensions.featureKey || "runtime_guidance",
        sessionId: this.getSessionId(),
        userId,
        siteCollectionId,
        quantity: typeof payload.quantity === "number" ? payload.quantity : 1,
        unit: payload.unit || "count",
        occurredAtUtc,
        classification: (() => {
          const rawClass = payload.classification || "Billable";
          if (typeof rawClass === "number") return rawClass;
          const lower = String(rawClass).toLowerCase();
          if (lower === "nonbillable" || lower === "non_billable" || lower === "non-billable") return 1;
          if (lower === "enforcement") return 2;
          return 0;
        })(),
        dimensions
      };
      const queueRecord = {
        id: eventId,
        orgId,
        event,
        retryCount: 0,
        queuedAt: timestamp
      };
      this._inMemoryQueue.push(queueRecord);
      this.saveQueue(this._inMemoryQueue);
      if (config?.debug || window.__DAP_DEBUG__) {
        console.debug(`[DAP Telemetry] Queued event: ${eventName}`, event);
      }
    }
    /**
     * Send a player telemetry event (retains backward compatibility).
     * 
     * Maps runtime events to proper metering billing dimensions per v1 spec:
     * - flow.launched → EventsIngested
     * - flow.step_viewed → EventsIngested
     * - flow.completed → EventsIngested
     * - flow.exited → EventsIngested (informational)
     */
    async trackPlayerEvent(eventName, flowId, options) {
      const featureKey = options?.isSurvey ? "survey_insights" : "runtime_guidance";
      this.track(eventName, {
        featureKey,
        dimensions: {
          billingDimension: "EventsIngested",
          flowId,
          pageUrl: typeof window !== "undefined" ? window.location.href : "",
          referrer: typeof document !== "undefined" ? document.referrer : "",
          host: typeof window !== "undefined" ? window.location.host : "",
          ...options?.stepId ? { stepId: options.stepId } : {}
        },
        // Events during normal flow execution are Billable
        classification: "Billable"
      });
    }
    /**
     * Flush the current queue by sending batches to the server.
     */
    async flush() {
      if (!this._isInitialized) return;
      if (this._isFlushing) {
        return;
      }
      if (this._inMemoryQueue.length === 0) {
        return;
      }
      this._isFlushing = true;
      const config = this._config || window.__DAP_CONFIG__;
      if (config?.debug || window.__DAP_DEBUG__) {
        console.debug(`[DAP Telemetry] Flushing ${this._inMemoryQueue.length} events...`);
      }
      const groups = {};
      const unresolvableRecords = [];
      for (const record of this._inMemoryQueue) {
        let orgId = record.orgId;
        if (!orgId && config?.organizationid) {
          orgId = config.organizationid;
          record.orgId = orgId;
        }
        let siteCollectionId = record.event.siteCollectionId;
        if (!siteCollectionId && config?.siteid) {
          siteCollectionId = config.siteid;
          record.event.siteCollectionId = siteCollectionId;
        }
        if (!orgId || !siteCollectionId) {
          unresolvableRecords.push(record);
          continue;
        }
        if (!record.event.userId) {
          try {
            const analyticsContext = userContextService.getAnalyticsContext();
            let uId = analyticsContext?.userId || null;
            if (uId) {
              if (!uId.startsWith("usr_runtime_")) {
                uId = `usr_runtime_${uId}`;
              }
              record.event.userId = uId;
            }
          } catch {
          }
        }
        const key = `${orgId}:${siteCollectionId}`;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(record);
      }
      const remainingQueue = [...unresolvableRecords];
      const sendPromises = Object.entries(groups).map(async ([compoundKey, records]) => {
        const [orgId, siteCollectionId] = compoundKey.split(":");
        const requestId = `req_player_${generateUlid()}`;
        const payload = {
          requestId,
          events: records.map((r) => r.event)
        };
        const base = getBaseUrl3(config?.apiurl || "");
        const url = `${base}/telemetry/organizations/${encodeURIComponent(orgId)}/site-collections/${encodeURIComponent(siteCollectionId)}/events`;
        try {
          if (config?.debug || window.__DAP_DEBUG__) {
            console.debug(`[DAP Telemetry] POST to ${url} for requestId: ${requestId}`, payload);
          }
          await http(config, url, {
            method: "POST",
            body: payload,
            hostBase: typeof window !== "undefined" ? window.location.origin : "",
            includeHostHeader: true
          });
          if (config?.debug || window.__DAP_DEBUG__) {
            console.debug(`[DAP Telemetry] Batch ${requestId} sent successfully.`);
          }
        } catch (err) {
          console.warn(`[DAP Telemetry] Batch ${requestId} failed:`, err);
          this.requeueRecords(records, remainingQueue);
        }
      });
      await Promise.all(sendPromises);
      remainingQueue.sort((a, b) => a.queuedAt - b.queuedAt);
      this.saveQueue(remainingQueue);
      this._isFlushing = false;
    }
    /**
     * Synchronous-fallback flush for beforeunload / pagehide events
     */
    flushSync() {
      if (this._inMemoryQueue.length === 0 || !this._config) return;
      const config = this._config;
      const groups = {};
      for (const record of this._inMemoryQueue) {
        const orgId = record.orgId || config.organizationid;
        const siteCollectionId = record.event.siteCollectionId || config.siteid;
        if (orgId && siteCollectionId) {
          const key = `${orgId}:${siteCollectionId}`;
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(record);
        }
      }
      for (const [compoundKey, records] of Object.entries(groups)) {
        const [orgId, siteCollectionId] = compoundKey.split(":");
        const requestId = `req_player_${generateUlid()}`;
        const payload = {
          requestId,
          events: records.map((r) => r.event)
        };
        const base = getBaseUrl3(config.apiurl || "");
        const url = `${base}/telemetry/organizations/${encodeURIComponent(orgId)}/site-collections/${encodeURIComponent(siteCollectionId)}/events`;
        try {
          const bodyStr = JSON.stringify(payload);
          if (typeof navigator !== "undefined" && navigator.sendBeacon) {
            const blob = new Blob([bodyStr], { type: "application/json" });
            navigator.sendBeacon(url, blob);
          } else if (typeof fetch !== "undefined") {
            fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Api-Key": config.apikey || ""
              },
              body: bodyStr,
              keepalive: true,
              credentials: "omit",
              cache: "no-cache"
            });
          }
        } catch {
        }
      }
      this._inMemoryQueue = [];
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(this.STORAGE_KEY);
        }
      } catch {
      }
    }
    /**
     * Requeue failed records, dropping after 10 retries
     */
    requeueRecords(records, targetQueue) {
      records.forEach((r) => {
        r.retryCount += 1;
        if (r.retryCount < 10) {
          targetQueue.push(r);
        } else {
          console.warn(`[DAP Telemetry] Dropping event ${r.id} after exceeding max retries.`);
        }
      });
    }
    /**
     * Persist event queue to local storage
     */
    saveQueue(queue) {
      this._inMemoryQueue = queue;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
        }
      } catch {
      }
    }
    startInterval() {
      this.stopInterval();
      this._intervalId = setInterval(() => {
        this.flush().catch((err) => {
          console.warn("[DAP Telemetry] Periodic flush failed:", err);
        });
      }, this.BATCH_INTERVAL_MS);
    }
    stopInterval() {
      if (this._intervalId) {
        clearInterval(this._intervalId);
        this._intervalId = null;
      }
    }
    /**
     * Triggers clean shutdown of the SDK flush timers.
     */
    shutdown() {
      this.stopInterval();
      this.flushSync();
      this._isInitialized = false;
    }
  };
  _TelemetryService._instance = null;
  var TelemetryService = _TelemetryService;
  var telemetryService = TelemetryService.getInstance();

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
    telemetryService.trackPlayerEvent("flow.step_viewed", flowId, {
      stepId,
      isSurvey: stepId.startsWith("s") || stepId.toLowerCase().includes("survey")
    }).catch((err) => {
      console.warn("[DAP] Failed to send flow.step_viewed telemetry:", err);
    });
  }
  function resetFlowTracking(flowId) {
    trackingState.reset(flowId);
  }

  // src/utils/previewMode.ts
  var PREVIEW_SESSION_STORAGE_KEY = "dap_preview_session_id";
  var PREVIEW_FLOW_ID_STORAGE_KEY = "dap_preview_flow_id";
  function clearPreviewSession() {
    try {
      sessionStorage.removeItem(PREVIEW_SESSION_STORAGE_KEY);
      sessionStorage.removeItem(PREVIEW_FLOW_ID_STORAGE_KEY);
      if (typeof window !== "undefined") {
        window.postMessage({ source: "DAP_PAGE", type: "DAP_CLEAR_PREVIEW_SESSION" }, "*");
      }
      const url = new URL(window.location.href);
      let changed = false;
      if (url.searchParams.has("previewSessionId")) {
        url.searchParams.delete("previewSessionId");
        changed = true;
      }
      if (url.searchParams.has("flowId")) {
        url.searchParams.delete("flowId");
        changed = true;
      }
      if (changed) {
        const cleanUrl = url.searchParams.toString() ? `${url.pathname}?${url.searchParams.toString()}${url.hash}` : `${url.pathname}${url.hash}`;
        window.history.replaceState({}, "", cleanUrl);
      }
      console.debug("[DAP] Preview session cleared from storage, URL and extension storage");
    } catch (error) {
      console.error("[DAP] Error clearing preview session:", error);
    }
  }
  function detectPreviewMode() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const previewSessionIdParam = urlParams.get("previewSessionId");
      const flowIdParam = urlParams.get("flowId");
      if (!previewSessionIdParam?.trim() || !flowIdParam?.trim()) {
        const storedSessionId = sessionStorage.getItem(PREVIEW_SESSION_STORAGE_KEY);
        const storedFlowId = sessionStorage.getItem(PREVIEW_FLOW_ID_STORAGE_KEY);
        if (storedSessionId && storedFlowId) {
          return { isPreviewMode: true, previewSessionId: storedSessionId, flowId: storedFlowId };
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

  // src/state/store.ts
  function createStore(initialState) {
    let state = initialState;
    const listeners = /* @__PURE__ */ new Set();
    function notify(s) {
      listeners.forEach((fn) => {
        try {
          fn(s);
        } catch (err) {
          console.error("[DAP Store] Listener error:", err);
        }
      });
    }
    return {
      getState() {
        return state;
      },
      setState(nextState) {
        const next = typeof nextState === "function" ? nextState(state) : nextState;
        if (next === state) return;
        state = next;
        notify(state);
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      reset() {
        state = initialState;
        notify(state);
      }
    };
  }

  // src/state/appState.ts
  var STORAGE_KEY = "dap_app_state";
  var INITIAL_STATE = {
    activeFlowId: null,
    activeStepIndex: 0,
    isFlowRunning: false,
    pendingFlowIds: [],
    user: null
  };
  function loadFromSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  function saveToSession(state) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
    }
  }
  var _persisted = loadFromSession();
  var _initial = { ...INITIAL_STATE, ..._persisted };
  var appStore = createStore(_initial);
  appStore.subscribe(saveToSession);
  function updateAppState(partial) {
    appStore.setState((prev) => ({ ...prev, ...partial }));
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
      this.clearAllTimeouts();
      clearSelectorCache();
      if (event.type !== "initial") {
        this.clearLifecycleTriggers();
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
    reRegisterAllTriggers() {
      Object.entries(this._registeredTriggers).forEach(([stepId, { trigger, onTrigger, flowContext, stepType }]) => {
        this.registerTriggerListeners(stepId, trigger, onTrigger, flowContext, stepType);
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
      this.clearAllTimeouts();
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
      for (const key of this._triggeredOnceSet) {
        if (key.startsWith(`${stepId}:`)) {
          this._triggeredOnceSet.delete(key);
        }
      }
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
          return this.createDomListener(stepId, condition, trigger, onTrigger, conditionIndex, flowContext);
        case "Lifecycle":
          return this.createLifecycleListener(stepId, condition, trigger, onTrigger, conditionIndex, flowContext);
        case "Input":
          return this.createInputListener(stepId, condition, trigger, onTrigger, conditionIndex, flowContext);
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
    createDomListener(stepId, condition, trigger, onTrigger, conditionIndex, flowContext) {
      if (!condition.selector) {
        console.warn(`[DAP] DOM condition missing selector for step: ${stepId}`);
        return null;
      }
      const validation = this.validateSelectorOnCurrentPage(condition.selector);
      console.debug(`[DAP] \u{1F4C4} Page context validation for ${stepId}: selector exists=${validation.exists}, count=${validation.elementCount}`);
      let targetElement = null;
      let observer = null;
      let timeoutCleanup = null;
      let highlightInjected = false;
      const injectHighlightStyle = () => {
        if (typeof document !== "undefined" && !document.getElementById("dap-highlight-style")) {
          const style = document.createElement("style");
          style.id = "dap-highlight-style";
          style.textContent = `
          .dap-step-highlight {
            outline: 3px solid #007bff !important;
            outline-offset: 2px !important;
            animation: dap-pulse-highlight 2s infinite !important;
          }
          @keyframes dap-pulse-highlight {
            0% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(0, 123, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0); }
          }
        `;
          document.head.appendChild(style);
        }
      };
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
        const previewMode = detectPreviewMode();
        let shouldHighlight = false;
        if (previewMode.isPreviewMode) {
          if (flowContext?.mode === "Linear") {
            shouldHighlight = flowContext?.stepIndex === 0 && !!flowContext?.currentStepActive;
          } else if (flowContext?.mode === "AnyOrder") {
            shouldHighlight = true;
          }
        }
        if (shouldHighlight) {
          injectHighlightStyle();
          element.classList.add("dap-step-highlight");
          highlightInjected = true;
          console.debug(`[DAP] \u2728 Highlight ADDED to step ${stepId} (mode: ${flowContext?.mode}, index: ${flowContext?.stepIndex}, isPreview: ${previewMode.isPreviewMode})`);
        } else {
          console.debug(`[DAP] \u26AA Highlight SKIPPED for step ${stepId} (mode: ${flowContext?.mode}, index: ${flowContext?.stepIndex}, isPreview: ${previewMode.isPreviewMode})`);
        }
        return () => {
          cleanupFunctions.forEach((cleanup) => cleanup());
          if (highlightInjected && element) {
            element.classList.remove("dap-step-highlight");
          }
        };
      };
      let listenerCleanup = null;
      observer = new MutationObserver(() => {
        try {
          if (targetElement && !document.body.contains(targetElement)) {
            console.debug(`[DAP] Element removed from DOM (re-render detected): ${condition.selector}`);
            if (listenerCleanup) {
              listenerCleanup();
              listenerCleanup = null;
            }
            targetElement = null;
            evictSelectorCacheEntry(stepId);
          }
          if (!targetElement) {
            const element = resolveSelectorWithCache(stepId, condition.selector);
            if (element) {
              targetElement = element;
              console.debug(`[DAP] Element appeared: ${condition.selector}`);
              if (timeoutCleanup) {
                timeoutCleanup();
                timeoutCleanup = null;
              }
              listenerCleanup = attachListener(element);
            }
          }
        } catch (error) {
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      targetElement = resolveSelectorWithCache(stepId, condition.selector);
      if (targetElement) {
        console.debug(`[DAP] Element found immediately for selector: ${condition.selector}`);
        listenerCleanup = attachListener(targetElement);
      } else {
        console.debug(`[DAP] Element not found, waiting for: ${condition.selector}`);
        this.setupSelectorTimeout(stepId, condition.selector, () => {
          console.warn(`[DAP] \u26A0\uFE0F Selector timeout for step ${stepId}: ${condition.selector}`);
          if (observer) {
            observer.disconnect();
            observer = null;
          }
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
      }
      return () => {
        if (observer) {
          observer.disconnect();
        }
        if (listenerCleanup) {
          listenerCleanup();
        }
        if (timeoutCleanup) {
          timeoutCleanup();
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
          let immediateTimerId = null;
          let immediateTimerCancelled = false;
          if (shouldFireImmediately) {
            const staggerMs = 100 + conditionIndex * 150;
            immediateTimerId = setTimeout(() => {
              if (immediateTimerCancelled) return;
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
            immediateTimerCancelled = true;
            if (immediateTimerId !== null) {
              clearTimeout(immediateTimerId);
              immediateTimerId = null;
            }
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
    createInputListener(stepId, condition, trigger, onTrigger, conditionIndex, flowContext) {
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
      const injectHighlightStyle = () => {
        if (typeof document !== "undefined" && !document.getElementById("dap-highlight-style")) {
          const style = document.createElement("style");
          style.id = "dap-highlight-style";
          style.textContent = `
          .dap-step-highlight {
            outline: 3px solid #007bff !important;
            outline-offset: 2px !important;
            animation: dap-pulse-highlight 2s infinite !important;
          }
          @keyframes dap-pulse-highlight {
            0% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(0, 123, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 123, 255, 0); }
          }
        `;
          document.head.appendChild(style);
        }
      };
      let highlightInjected = false;
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
            const previewMode2 = detectPreviewMode();
            let shouldHighlight2 = false;
            if (previewMode2.isPreviewMode) {
              if (flowContext?.mode === "Linear") {
                shouldHighlight2 = flowContext?.stepIndex === 0 && !!flowContext?.currentStepActive;
              } else if (flowContext?.mode === "AnyOrder") {
                shouldHighlight2 = true;
              }
            }
            if (shouldHighlight2) {
              injectHighlightStyle();
              foundElement.classList.add("dap-step-highlight");
              highlightInjected = true;
            }
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
            if (highlightInjected) {
              attachedElement.classList.remove("dap-step-highlight");
            }
          }
        };
      }
      console.debug(`[DAP] \u2705 Input element found immediately for selector: ${condition.selector}`);
      const previewMode = detectPreviewMode();
      let shouldHighlight = false;
      if (previewMode.isPreviewMode) {
        if (flowContext?.mode === "Linear") {
          shouldHighlight = flowContext?.stepIndex === 0 && !!flowContext?.currentStepActive;
        } else if (flowContext?.mode === "AnyOrder") {
          shouldHighlight = true;
        }
      }
      if (shouldHighlight) {
        injectHighlightStyle();
        element.classList.add("dap-step-highlight");
        highlightInjected = true;
      }
      element.addEventListener("input", inputHandler);
      element.addEventListener("change", inputHandler);
      return () => {
        element.removeEventListener("input", inputHandler);
        element.removeEventListener("change", inputHandler);
        if (highlightInjected) {
          element.classList.remove("dap-step-highlight");
        }
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
      this.clearTimeoutForStep(stepId);
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
  TriggerManager.getInstance();

  // src/core/flowEngine.ts
  var FlowEngine = class _FlowEngine {
    constructor() {
      this._state = {
        activeFlowId: null,
        flowInProgress: false,
        activeStep: 0,
        activeStepTriggered: false,
        activeStepTriggeredPageId: null,
        activeStepPageId: null,
        executionState: "TERMINATED",
        executionMode: "Linear",
        triggeredSteps: /* @__PURE__ */ new Set(),
        runCounted: false,
        anyOrderStepInProgress: false,
        inProgressSteps: /* @__PURE__ */ new Set(),
        pendingUXResume: false,
        pendingUXResumeSteps: void 0,
        completedPageId: null
      };
      this._currentFlow = null;
      this._stepTriggerListeners = /* @__PURE__ */ new Map();
      this._domObservers = /* @__PURE__ */ new Map();
      this._onFlowEnd = null;
      this._onFlowStart = null;
      this._onFlowActive = null;
      // CRITICAL FIX 2: Debounced Rule Evaluation System
      this._ruleEvaluationTimers = /* @__PURE__ */ new Map();
      this._inputStabilityMinLength = 1;
      // Minimum chars before rule evaluation fires
      // CRITICAL FIX 3: Input Stability Tracking
      this._lastInputValues = /* @__PURE__ */ new Map();
      this._inputStabilityChecks = /* @__PURE__ */ new Map();
      // Mandatory-step completion tracking (cleared on each flow reset)
      this._completedMandatorySteps = /* @__PURE__ */ new Set();
      // ✅ Fix #3: Queue for one-shot triggers that fired while the concurrency lock was held
      this._pendingAnyOrderSteps = [];
      // Dedicated TriggerManager instance — one per FlowEngine so concurrent engines
      // (via MultiFlowOrchestrator) never share trigger registrations or page-change
      // re-registration sweeps, which caused double-listener creation and flow stalls.
      this._triggerManager = new TriggerManager();
      // Unsubscribe from page context service on destroy
      this._pageContextUnsubscribe = null;
      // Global click handler to intercept manual step skipping
      this._boundGlobalClickHandler = null;
      pageContextService.initialize();
      this._triggerManager.initialize();
      this._pageContextUnsubscribe = pageContextService.subscribe(this.handlePageChange.bind(this));
      this._boundGlobalClickHandler = this.handleGlobalClick.bind(this);
      document.addEventListener("click", this._boundGlobalClickHandler, true);
    }
    /**
     * Register a callback that fires whenever a flow ends (completed or aborted).
     * Used by index.ts to advance the sequential flow queue (Bug B fix).
     */
    setOnFlowEndCallback(cb) {
      this._onFlowEnd = cb;
    }
    /**
     * Register a callback that fires whenever a flow starts or restarts.
     */
    setOnFlowStartCallback(cb) {
      this._onFlowStart = cb;
    }
    /**
     * Register a callback that fires whenever a flow becomes active (shows UX).
     */
    setOnFlowActiveCallback(cb) {
      this._onFlowActive = cb;
    }
    /**
     * Sync the active step for a Linear flow when the user navigates to a new page,
     * skipping intermediate steps.
     * 
     * CRITICAL FIX: When user manually navigates away, mark all skipped steps as completed
     * and show remaining steps for the new page. Also auto-close any UX experiences from earlier steps.
     */
    _syncLinearActiveStepForNewPage() {
      if (!this._currentFlow || this._state.executionMode !== "Linear") return false;
      if (!this._state.flowInProgress) return false;
      const ctx = pageContextService.getCurrentContext();
      const startIndex = this._state.activeStep;
      if (startIndex >= this._currentFlow.steps.length) return false;
      const currentStep = this._currentFlow.steps[startIndex];
      const currentStepUrl = this.getStepTargetUrl(currentStep);
      if (currentStepUrl && this._matchUrlPattern(currentStepUrl, ctx)) {
        return false;
      }
      for (let i = startIndex + 1; i < this._currentFlow.steps.length; i++) {
        const step = this._currentFlow.steps[i];
        const stepUrl = this.getStepTargetUrl(step);
        if (stepUrl && this._matchUrlPattern(stepUrl, ctx)) {
          console.debug(
            `[DAP] Linear: \u{1F3AF} Manual page navigation detected! User jumped from step ${startIndex} to page matching step ${i}. Marking steps ${startIndex} to ${i - 1} as skipped and closing any open UX.`
          );
          for (let skippedIdx = startIndex; skippedIdx < i; skippedIdx++) {
            this._state.triggeredSteps.add(skippedIdx);
            console.debug(`[DAP] Linear: Marked step ${skippedIdx} as skipped (manual navigation)`);
            const skippedStep = this._currentFlow.steps[skippedIdx];
            if (skippedStep) {
              this._state.inProgressSteps.delete(skippedIdx);
              this.cleanupCurrentStep(skippedIdx);
              this.removeStepVisualUX(skippedStep);
            }
          }
          this._state.activeStep = i;
          this._state.activeStepTriggered = false;
          this._state.activeStepTriggeredPageId = null;
          this._state.activeStepPageId = null;
          this._state.pendingUXResume = false;
          this._state.anyOrderStepInProgress = false;
          console.debug(
            `[DAP] Linear: \u2705 Fast-forwarded from step ${startIndex} to step ${i} (${step.stepId}). Earlier steps closed. Ready to show remaining steps for this page.`
          );
          return true;
        }
      }
      if (!currentStepUrl && this.isStepContextActive(currentStep)) {
        const currentStepUxOpen = this._state.activeStepTriggered || this._state.inProgressSteps.has(startIndex) || this.hasActiveUXExperience();
        if (!currentStepUxOpen) {
          return false;
        }
        console.debug(
          `[DAP] Linear: current step ${currentStep.stepId} is still globally visible, but its UX is open during navigation; checking later steps before preserving it`
        );
      }
      const currentPathHash = this.getPathnameHash();
      const stepStartedPathHash = this._state.activeStepPageId || currentPathHash;
      if (currentPathHash !== stepStartedPathHash) {
        for (let i = startIndex + 1; i < this._currentFlow.steps.length; i++) {
          if (this.isStepContextActive(this._currentFlow.steps[i])) {
            console.debug(
              `[DAP] Linear: \u{1F3AF} Manual page navigation detected (DOM-based)! User jumped from step ${startIndex} to page with step ${i}. Marking steps ${startIndex} to ${i - 1} as skipped and closing any open UX.`
            );
            for (let skippedIdx = startIndex; skippedIdx < i; skippedIdx++) {
              this._state.triggeredSteps.add(skippedIdx);
              console.debug(`[DAP] Linear: Marked step ${skippedIdx} as skipped (manual navigation, DOM-based)`);
              const skippedStep = this._currentFlow.steps[skippedIdx];
              if (skippedStep) {
                this._state.inProgressSteps.delete(skippedIdx);
                this.cleanupCurrentStep(skippedIdx);
                this.removeStepVisualUX(skippedStep);
              }
            }
            this._state.activeStep = i;
            this._state.activeStepTriggered = false;
            this._state.activeStepTriggeredPageId = null;
            this._state.activeStepPageId = null;
            this._state.pendingUXResume = false;
            this._state.anyOrderStepInProgress = false;
            console.debug(
              `[DAP] Linear: \u2705 Fast-forwarded from step ${startIndex} to step ${i} (${this._currentFlow.steps[i].stepId}). Earlier steps closed. Ready to show remaining steps for this page.`
            );
            return true;
          }
        }
      }
      return false;
    }
    getPathnameHash() {
      const ctx = pageContextService.getCurrentContext();
      return `${ctx.pathname}${ctx.hash}`;
    }
    /**
     * Handle page changes and re-evaluate active flows
     */
    handlePageChange(event) {
      console.debug("[DAP] FlowEngine: Handling page change:", event.type, {
        from: event.previous?.pathname,
        to: event.current.pathname,
        activeFlow: this._state.activeFlowId,
        flowInProgress: this._state.flowInProgress
      });
      if (this._state.completedPageId) {
        const currentPageId = pageContextService.getPageId();
        if (currentPageId !== this._state.completedPageId) {
          console.debug(
            `[DAP] Clearing completedPageId because user navigated away from completed page (${this._state.completedPageId} -> ${currentPageId})`
          );
          this._state.completedPageId = null;
        }
      }
      if (!this._state.flowInProgress && this._currentFlow && this._currentFlow.steps.length > 0 && this.validateFlowFrequency(this._currentFlow, true)) {
        const firstStep = this._currentFlow.steps[0];
        let matchesUrl = true;
        if (this._currentFlow.targetUrls && this._currentFlow.targetUrls.length > 0) {
          const ctx = pageContextService.getCurrentContext();
          matchesUrl = this._currentFlow.targetUrls.some((p) => this._matchUrlPattern(p, ctx));
        }
        if (matchesUrl) {
          let stepUrl = firstStep.url || firstStep.targetUrl;
          if (stepUrl && (stepUrl.toLowerCase().startsWith("url=") || stepUrl.includes("|"))) {
            stepUrl = extractUrlFromSelector(stepUrl) || void 0;
          }
          if (stepUrl) {
            const ctx = pageContextService.getCurrentContext();
            matchesUrl = this._matchUrlPattern(stepUrl, ctx);
          }
        }
        if (matchesUrl) {
          console.debug(
            `[DAP] \u{1F504} AUTO-RESTART: Preserved flow "${this._currentFlow.flowId}" is inactive. We are on the matching page for step 0. Registering/deferring trigger.`
          );
          this.executeStepWithTrigger(firstStep, 0);
          return;
        }
      }
      if (!this._state.flowInProgress || !this._currentFlow) return;
      console.debug(
        `[DAP] Flow "${this._currentFlow.flowId}" \u2014 page changed to "${event.current.pathname}". Skipping URL validation (element-based triggering only). Will re-register triggers if elements are visible.`
      );
      let hasPersistedStateChanged = false;
      if (this._state.executionMode === "Linear") {
        const advanced = this._syncLinearActiveStepForNewPage();
        if (advanced) {
          hasPersistedStateChanged = true;
        } else {
          let _syncRafAttempts = 0;
          const _SYNC_RAF_MAX = 10;
          const trySyncRaf = () => {
            if (!this._state.flowInProgress || !this._currentFlow) return;
            if (this._state.executionMode !== "Linear") return;
            const retryAdvanced = this._syncLinearActiveStepForNewPage();
            if (retryAdvanced) {
              console.debug(`[DAP] Linear: SPA manual page navigation sync succeeded after ${_syncRafAttempts + 1} rAF frame(s)`);
              this.reRegisterActiveStepTriggers();
              this.saveFlowProgress();
            } else {
              _syncRafAttempts++;
              if (_syncRafAttempts < _SYNC_RAF_MAX) {
                requestAnimationFrame(trySyncRaf);
              }
            }
          };
          requestAnimationFrame(trySyncRaf);
        }
      }
      if (this._state.executionMode === "AnyOrder") {
        const previousActiveStep = this._state.activeStep;
        this._updateAnyOrderActiveStep();
        hasPersistedStateChanged = hasPersistedStateChanged || this._state.activeStep !== previousActiveStep;
      }
      const reRegisterMutatedState = this.reRegisterActiveStepTriggers();
      hasPersistedStateChanged = hasPersistedStateChanged || reRegisterMutatedState;
      if (hasPersistedStateChanged) {
        this.saveFlowProgress();
      }
    }
    /**
     * Match a URL pathname against a flow targetUrl pattern.
     *
     *   "/products"       — exact match
     *   "/products/*"     — prefix: pathname must start with "/products/"
     *   "*\/admin\/*"     — glob: "*" matches any sequence of characters
     */
    _matchUrlPattern(pattern, pageCtx) {
      let matchPattern = pattern.trim();
      if (matchPattern.toLowerCase().startsWith("url=") || matchPattern.includes("|")) {
        matchPattern = extractUrlFromSelector(matchPattern) || matchPattern;
      }
      let isAbsolute = /^https?:\/\//i.test(matchPattern);
      let patternOrigin = "";
      if (isAbsolute) {
        try {
          const parsedUrl = new URL(matchPattern);
          matchPattern = parsedUrl.pathname;
          patternOrigin = parsedUrl.origin;
        } catch (e) {
        }
      }
      const path = pageCtx.pathname;
      if (isAbsolute && patternOrigin) {
        try {
          const currentOrigin = new URL(pageCtx.href || window.location.href).origin;
          if (currentOrigin !== patternOrigin) {
            return false;
          }
        } catch (e) {
          if (window.location.origin !== patternOrigin) {
            return false;
          }
        }
      }
      const p = matchPattern.startsWith("/") ? matchPattern : `/${matchPattern}`;
      if (!p.includes("*")) {
        return path === p || path === p.replace(/\/$/, "") || `${p}/` === path;
      }
      const regexStr = "^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + // * → .*
      "$";
      return new RegExp(regexStr, "i").test(path);
    }
    getStepTargetUrl(step) {
      let stepUrl = step.url || step.targetUrl;
      if (stepUrl && (stepUrl.toLowerCase().startsWith("url=") || stepUrl.includes("|"))) {
        stepUrl = extractUrlFromSelector(stepUrl) || void 0;
      }
      if (!stepUrl && step.uxExperience?.elementSelector) {
        stepUrl = extractUrlFromSelector(step.uxExperience.elementSelector) || void 0;
      }
      if (!stepUrl && step.trigger?.conditions) {
        for (const condition of step.trigger.conditions) {
          if (!condition.selector) continue;
          stepUrl = extractUrlFromSelector(condition.selector) || void 0;
          if (stepUrl) break;
        }
      }
      return stepUrl;
    }
    /**
     * Pause the flow when the user navigates to a page that does not match
     * this flow's targetUrls.  All active trigger listeners and blue borders
     * are removed, pending defer watchers are cancelled, and in-progress step
     * state is reset.  The flow's activeStep and triggeredSteps are NOT
     * modified, so reRegisterActiveStepTriggers will resume exactly where
     * the flow was paused when the user navigates back to a matching page.
     */
    _pauseForPageChange() {
      if (!this._currentFlow) return;
      if (this._state.executionMode === "Linear") {
        if (this._state.activeStep < this._currentFlow.steps.length) {
          const step = this._currentFlow.steps[this._state.activeStep];
          const deferKey = `${step.stepId}_defer`;
          const deferCancel = this._stepTriggerListeners.get(deferKey);
          if (deferCancel) {
            deferCancel();
            this._stepTriggerListeners.delete(deferKey);
          }
          this._triggerManager.removeTriggerListeners(step.stepId);
          this.removeStepVisualUX(step);
          if (this._state.inProgressSteps.has(this._state.activeStep)) {
            this._state.inProgressSteps.delete(this._state.activeStep);
            this._state.anyOrderStepInProgress = false;
          }
          if (this._state.activeStepTriggered) {
            this._state.pendingUXResume = true;
            console.debug(
              `[DAP] Linear: step ${step.stepId} \u2014 UX was showing when user navigated away; marking pendingUXResume so it auto-resumes on return`
            );
            this._state.activeStepTriggered = false;
            this._state.activeStepTriggeredPageId = null;
          }
        }
      } else {
        this._currentFlow.steps.forEach((step, index) => {
          if (this._state.triggeredSteps.has(index)) return;
          const deferKey = `${step.stepId}_defer`;
          const deferCancel = this._stepTriggerListeners.get(deferKey);
          if (deferCancel) {
            deferCancel();
            this._stepTriggerListeners.delete(deferKey);
          }
          this._triggerManager.removeTriggerListeners(step.stepId);
        });
        if (this._state.inProgressSteps.size > 0) {
          this._state.pendingUXResumeSteps = new Set(this._state.inProgressSteps);
          console.debug(
            `[DAP] AnyOrder: step(s) [${[...this._state.inProgressSteps].join(", ")}] were showing UX when user navigated away; marking pendingUXResumeSteps for auto-resume on return`
          );
          this._state.inProgressSteps.forEach((index) => {
            const step = this._currentFlow.steps[index];
            if (step) {
              this.removeStepVisualUX(step);
            }
          });
        }
        this._state.inProgressSteps.clear();
        this._state.anyOrderStepInProgress = false;
      }
      this.saveFlowProgress();
    }
    /**
     * Re-register triggers for the currently active step(s) after page change
     */
    reRegisterActiveStepTriggers() {
      if (!this._currentFlow || !this._state.flowInProgress) {
        return false;
      }
      console.debug("[DAP] FlowEngine: Re-registering triggers after page change");
      let stateMutated = false;
      if (this._state.executionMode === "Linear") {
        if (this._state.activeStep < this._currentFlow.steps.length) {
          const currentStep = this._currentFlow.steps[this._state.activeStep];
          const deferCancel = this._stepTriggerListeners.get(`${currentStep.stepId}_defer`);
          if (deferCancel) {
            console.debug(`[DAP] Linear: cancelled stale defer watcher for step ${currentStep.stepId} on page change`);
            deferCancel();
            this._stepTriggerListeners.delete(`${currentStep.stepId}_defer`);
          }
          if (this._state.activeStepTriggered) {
            console.debug(
              `[DAP] Linear: step ${currentStep.stepId} \u2014 UX was showing on page change; marking pendingUXResume for auto-resume on return`
            );
            this._state.pendingUXResume = true;
            this._state.activeStepTriggered = false;
            this._state.activeStepTriggeredPageId = null;
            stateMutated = true;
            this.removeStepVisualUX(currentStep);
          }
          if (this._state.inProgressSteps.has(this._state.activeStep)) {
            this._state.inProgressSteps.delete(this._state.activeStep);
            this._state.anyOrderStepInProgress = false;
            stateMutated = true;
            console.debug(
              `[DAP] Linear: cleared stale inProgressSteps flag for step ${currentStep.stepId} on page change`
            );
            this.removeStepVisualUX(currentStep);
          }
          this.executeStepWithTrigger(currentStep, this._state.activeStep);
        }
      } else {
        this._currentFlow.steps.forEach((step, index) => {
          const deferCancel = this._stepTriggerListeners.get(`${step.stepId}_defer`);
          if (deferCancel) {
            console.debug(`[DAP] AnyOrder: cancelled stale defer watcher for step ${step.stepId} on page change`);
            deferCancel();
            this._stepTriggerListeners.delete(`${step.stepId}_defer`);
          }
          if (this._state.triggeredSteps.has(index)) {
            this._triggerManager.unregisterTrigger(step.stepId);
          } else if (this._state.inProgressSteps.has(index)) {
            console.debug(
              `[DAP] AnyOrder: page changed \u2014 resetting in-progress state for step ${step.stepId}`
            );
            this._state.inProgressSteps.delete(index);
            this._state.anyOrderStepInProgress = false;
            stateMutated = true;
            this.removeStepVisualUX(step);
            this.setupStepTrigger(step, index);
          } else {
            this.setupStepTrigger(step, index);
          }
        });
      }
      return stateMutated;
    }
    /**
     * Register step 0's trigger to allow flow restart if we are at a subsequent step in Linear mode.
     */
    registerStep0RestartTrigger(stepIndex) {
      if (!this._currentFlow || this._state.executionMode !== "Linear" || this._state.activeStep === 0) return;
      if (stepIndex === 0) return;
      if (this._currentFlow.steps.length > 0) {
        const firstStep = this._currentFlow.steps[0];
        const firstStepTrigger = this._triggerManager.resolveTrigger(firstStep);
        if (!firstStepTrigger) {
          console.debug(`[DAP] Linear: Step 0 has no trigger; skipping restart trigger registration`);
          return;
        }
        const isLifecycleOrTime = firstStepTrigger.conditions.some((c) => c.kind === "Lifecycle" || c.kind === "Time");
        if (isLifecycleOrTime) {
          console.debug(
            `[DAP] Linear: Step 0 has lifecycle/time trigger; skipping step 0 restart trigger registration while in progress to prevent progress hijacking`
          );
        } else {
          console.debug(`[DAP] Linear: Registering step 0 restart trigger while at activeStep ${this._state.activeStep}`);
          this.executeStepWithTrigger(firstStep, 0);
        }
      }
    }
    static getInstance() {
      if (!this._instance) {
        this._instance = new _FlowEngine();
      }
      return this._instance;
    }
    /**
     * 🚨 CRITICAL FIX: Validate flow frequency and execution limits   * Implements the OneTime + maxRuns = 1 validation as required
     */
    validateFlowFrequency(flowData, silent = false) {
      const logWarn = (...args) => {
        if (!silent) console.warn(...args);
      };
      const logDebug = (...args) => {
        if (!silent) console.debug(...args);
      };
      const previewMode = detectPreviewMode();
      if (previewMode.isPreviewMode) {
        logDebug(`[DAP] \u{1F7E2} PREVIEW MODE: Bypassing frequency validation for flow ${flowData.flowId}`);
        return true;
      }
      if (this._state.activeFlowId === flowData.flowId && this._state.flowInProgress) {
        logDebug(`[DAP] \u2705 FLOW RESUME: Bypassing frequency validation for active flow ${flowData.flowId}`);
        return true;
      }
      try {
        const cached = sessionStorage.getItem(`dap_flow_snapshot_${flowData.flowId}`);
        if (cached) {
          logDebug(`[DAP] \u2705 FLOW RESUME: Found session snapshot for flow ${flowData.flowId}, bypassing frequency validation`);
          return true;
        }
      } catch (e) {
      }
      logDebug(`[DAP] \u{1F50D} Validating frequency for flow ${flowData.flowId}`);
      if (!flowData.execution) {
        logWarn(`[DAP] No execution config found for flow ${flowData.flowId}, allowing by default`);
        return true;
      }
      const frequency = flowData.execution.frequency;
      if (!frequency) {
        logWarn(`[DAP] No frequency config found for flow ${flowData.flowId}, allowing by default`);
        return true;
      }
      if (frequency.type === "Always") {
        logDebug(`[DAP] \u2705 FLOW ELIGIBLE: ${flowData.flowId} (Always frequency \u2014 no throttle)`);
        return true;
      }
      logDebug(`[DAP] Flow frequency config:`, {
        type: frequency.type,
        maxRuns: frequency.maxRuns,
        flowId: flowData.flowId
      });
      if (frequency.type === "OneTime" || frequency.type === "Recurring") {
        let maxRuns = frequency.maxRuns;
        if (frequency.type === "Recurring") {
          if (maxRuns === void 0 || maxRuns === null || maxRuns <= 1) {
            maxRuns = Infinity;
          }
        } else {
          if (maxRuns === void 0 || maxRuns === null || maxRuns < 1) {
            maxRuns = 1;
          }
        }
        const flowRunKey = `dap_flow_runs_${flowData.flowId}`;
        const flowCompletedKey = `dap_flow_completed_${flowData.flowId}`;
        try {
          try {
            const isAlways = flowData.execution?.frequency?.type === "Always";
            const frequency2 = flowData.execution?.frequency;
            let maxRuns2 = frequency2?.maxRuns;
            if (frequency2?.type === "Recurring") {
              if (maxRuns2 === void 0 || maxRuns2 === null || maxRuns2 <= 1) {
                maxRuns2 = Infinity;
              }
            } else {
              if (maxRuns2 === void 0 || maxRuns2 === null || maxRuns2 < 1) {
                maxRuns2 = 1;
              }
            }
            if (frequency2?.type === "OneTime" && !isAlways && maxRuns2 <= 1 && sessionStorage.getItem(`dap_flow_completed_session_${flowData.flowId}`) === "true") {
              logWarn(`[DAP] \u{1F6D1} FLOW BLOCKED: Flow ${flowData.flowId} was already completed in this cycle/session.`);
              return false;
            }
          } catch (e) {
          }
          const storedRuns = localStorage.getItem(flowRunKey);
          const currentRuns = storedRuns ? parseInt(storedRuns, 10) : 0;
          logDebug(`[DAP] ${frequency.type} flow ${flowData.flowId}: ${currentRuns}/${maxRuns} eligible runs`);
          if (currentRuns >= maxRuns) {
            logWarn(`[DAP] \u{1F6D1} FLOW BLOCKED: ${flowData.flowId} has reached maxRuns limit (${currentRuns}/${maxRuns})`);
            return false;
          }
          if (frequency.type === "OneTime") {
            if (maxRuns <= 1) {
              const sessionCompleted = sessionStorage.getItem(`dap_flow_completed_session_${flowData.flowId}`) === "true";
              if (sessionCompleted) {
                logWarn(`[DAP] \u{1F6D1} FLOW BLOCKED: OneTime flow ${flowData.flowId} was already completed in this cycle/session.`);
                return false;
              }
              const completionData = localStorage.getItem(flowCompletedKey);
              if (completionData) {
                try {
                  const completion = JSON.parse(completionData);
                  logWarn(`[DAP] \u{1F6D1} FLOW BLOCKED: OneTime flow ${flowData.flowId} was already completed via ${completion.reason} at ${new Date(completion.timestamp).toISOString()}`);
                  return false;
                } catch (e) {
                  localStorage.removeItem(flowCompletedKey);
                }
              }
            }
          }
          if (frequency.type === "Recurring" || frequency.type === "OneTime" && maxRuns > 1) {
            try {
              sessionStorage.removeItem(`dap_flow_completed_session_${flowData.flowId}`);
              logDebug(`[DAP] \u{1F504} Cleared session flag for ${frequency.type} flow ${flowData.flowId} to allow next cycle`);
            } catch (e) {
            }
          }
          logDebug(`[DAP] \u2705 FLOW ELIGIBLE: ${flowData.flowId} (${currentRuns}/${maxRuns} runs)`);
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
              logDebug(`[DAP] \u{1F6D1} FLOW BLOCKED: ${flowData.flowId} (${frequency.type} \u2014 ${remaining} min remaining in window)`);
              return false;
            }
          }
          logDebug(`[DAP] \u2705 FLOW ELIGIBLE: ${flowData.flowId} (${frequency.type} frequency)`);
          return true;
        } catch (error) {
          console.error(`[DAP] Error checking ${frequency.type} frequency for ${flowData.flowId}:`, error);
          return true;
        }
      }
      logDebug(`[DAP] \u2705 FLOW ELIGIBLE: ${flowData.flowId} (unknown frequency type: ${frequency.type})`);
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
      let resumePoint = null;
      try {
        const snapshotStr = sessionStorage.getItem(`dap_flow_snapshot_${flowData.flowId}`);
        if (snapshotStr) {
          const snapshot = JSON.parse(snapshotStr);
          if (snapshot.flowId === flowData.flowId) {
            const flowCompletedKey = `dap_flow_completed_${flowData.flowId}`;
            const completionData = localStorage.getItem(flowCompletedKey);
            if (completionData) {
              console.debug(
                `[DAP] \u26A0\uFE0F COMPLETION CHECK: Session snapshot exists but flow ${flowData.flowId} is already marked as completed. Clearing stale session snapshot to prevent re-appearing last step.`
              );
              try {
                sessionStorage.removeItem(`dap_flow_snapshot_${flowData.flowId}`);
                console.debug(`[DAP] \u{1F5D1}\uFE0F Stale snapshot cleared for completed flow ${flowData.flowId}`);
              } catch (e) {
              }
              resumePoint = null;
            } else {
              resumePoint = {
                activeStep: snapshot.activeStep,
                triggeredSteps: snapshot.triggeredSteps,
                flowOrigin: snapshot.flowOrigin
              };
              console.debug(`[DAP] \u267B\uFE0F Rehydration: Loaded resume point for flow ${flowData.flowId} at step ${resumePoint.activeStep}`);
            }
          }
        }
      } catch (e) {
        console.error(`[DAP] \u26A0\uFE0F Rehydration: Error loading snapshot for flow ${flowData.flowId}:`, e);
      }
      if (!this.validateFlowFrequency(flowData)) {
        console.debug(`[DAP] \u{1F6D1} Flow ${flowData.flowId} blocked by frequency validation`);
        this._onFlowEnd?.(flowData.flowId, "frequency_blocked");
        return;
      }
      this.analyzeTriggerUsage(flowData);
      this.analyzeFlowPageContext(flowData);
      if (this.flowRequiresUserContext(flowData) && !userContextService.hasRealUser()) {
        console.warn(`[DAP] Flow ${flowData.flowId} requires user context but none available - flow execution blocked`);
        this._onFlowEnd?.(flowData.flowId, "user_context_blocked");
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
        activeStep: resumePoint ? resumePoint.activeStep : 0,
        activeStepTriggered: false,
        activeStepTriggeredPageId: null,
        activeStepPageId: null,
        executionState: "ACTIVE",
        executionMode: flowData.execution?.mode?.toLowerCase() === "anyorder" ? "AnyOrder" : "Linear",
        triggeredSteps: resumePoint ? new Set(resumePoint.triggeredSteps) : /* @__PURE__ */ new Set(),
        // 🚨 FIX: Only mark as run counted if we actually triggered a step or have a UX showing
        runCounted: false,
        anyOrderStepInProgress: false,
        inProgressSteps: /* @__PURE__ */ new Set(),
        pendingUXResume: false,
        pendingUXResumeSteps: void 0,
        flowOrigin: resumePoint?.flowOrigin || void 0,
        completedPageId: null
      };
      if (resumePoint) {
        try {
          const rawSnapshot = sessionStorage.getItem(`dap_flow_snapshot_${flowData.flowId}`);
          if (rawSnapshot) {
            const snapshot = JSON.parse(rawSnapshot);
            this._state.runCounted = snapshot.triggeredSteps && snapshot.triggeredSteps.length > 0;
            this._state.activeStepTriggered = snapshot.activeStepTriggered || false;
            this._state.activeStepTriggeredPageId = snapshot.activeStepTriggeredPageId || null;
            this._state.activeStepPageId = snapshot.activeStepPageId || null;
            this._state.pendingUXResume = snapshot.pendingUXResume || snapshot.activeStepTriggered === true;
            if (snapshot.pendingUXResumeSteps) {
              this._state.pendingUXResumeSteps = new Set(snapshot.pendingUXResumeSteps);
              if (this._state.pendingUXResumeSteps.size > 0) this._state.runCounted = true;
            } else if (snapshot.inProgressSteps && snapshot.inProgressSteps.length > 0) {
              this._state.pendingUXResumeSteps = new Set(snapshot.inProgressSteps);
              this._state.runCounted = true;
            }
            this._state.anyOrderStepInProgress = false;
            this._state.inProgressSteps = /* @__PURE__ */ new Set();
            console.debug(`[DAP] \u267B\uFE0F Rehydrated flow ${flowData.flowId}:`, {
              activeStep: snapshot.activeStep,
              pendingUXResume: this._state.pendingUXResume,
              runCounted: this._state.runCounted
            });
          }
        } catch (e) {
          console.warn(`[DAP] \u26A0\uFE0F Migration: Failed to parse snapshot for ${flowData.flowId}`, e);
        }
      }
      this._currentFlow = flowData;
      this._onFlowStart?.(flowData.flowId);
      updateAppState({
        activeFlowId: flowData.flowId,
        isFlowRunning: true,
        activeStepIndex: this._state.activeStep
      });
      telemetryService.trackPlayerEvent("flow.launched", flowData.flowId).catch((err) => {
        console.warn("[DAP] Failed to send flow.launched telemetry:", err);
      });
      this.executeStep();
    }
    /**
     * Abort current flow
     * Enhanced with CRITICAL FIXES cleanup
     */
    abortFlow() {
      if (!this._state.flowInProgress) return;
      const flowId = this._state.activeFlowId;
      console.debug(`[DAP] Aborting flow: ${flowId}`);
      if (flowId) {
        telemetryService.trackPlayerEvent("flow.exited", flowId).catch((err) => {
          console.warn("[DAP] Failed to send flow.exited telemetry:", err);
        });
      }
      if (this._currentFlow) {
        this._currentFlow.steps.forEach((step) => {
          this.removeStepVisualUX(step);
        });
      }
      if (this._state.activeFlowId) {
        try {
          sessionStorage.removeItem(`dap_flow_snapshot_${this._state.activeFlowId}`);
          console.debug(`[DAP] \u{1F5D1}\uFE0F Session snapshot cleared during abort for flow ${this._state.activeFlowId}`);
        } catch (e) {
          console.error(`[DAP] Error clearing session during abort:`, e);
        }
        try {
          const flowId2 = this._state.activeFlowId;
          const activeStr = sessionStorage.getItem("dap_active_flows");
          if (activeStr) {
            const active = JSON.parse(activeStr);
            if (Array.isArray(active)) {
              const updated = active.filter((id) => id !== flowId2);
              sessionStorage.setItem("dap_active_flows", JSON.stringify(updated));
              console.debug(`[DAP] [Cross-Site] Removed aborted flow ${flowId2} from active flows list`);
            }
          }
        } catch (e) {
        }
      }
      this.cleanupCurrentStep();
      this.cleanupAllTimers();
      if (this._state.activeFlowId) {
        this._triggerManager.resetOnceTriggersForFlow(this._state.activeFlowId);
      }
      this._pendingAnyOrderSteps = [];
      this._state = {
        activeFlowId: null,
        flowInProgress: false,
        activeStep: 0,
        activeStepTriggered: false,
        activeStepTriggeredPageId: null,
        activeStepPageId: null,
        executionState: "TERMINATED",
        executionMode: "Linear",
        triggeredSteps: /* @__PURE__ */ new Set(),
        anyOrderStepInProgress: false,
        inProgressSteps: /* @__PURE__ */ new Set(),
        pendingUXResume: false,
        pendingUXResumeSteps: void 0,
        completedPageId: null
      };
      this._currentFlow = null;
      this._completedMandatorySteps.clear();
      updateAppState({
        activeFlowId: null,
        isFlowRunning: false,
        activeStepIndex: 0
      });
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
      const actualStepIndex = stepIndex !== void 0 ? stepIndex : this._state.activeStep;
      if (actualStepIndex === this._state.activeStep) {
        if (!this._state.activeStepPageId) {
          this._state.activeStepPageId = this.getPathnameHash();
          console.debug(`[DAP] Set activeStepPageId for step ${step.stepId} to ${this._state.activeStepPageId}`);
          this.saveFlowProgress();
        }
      }
      step = this.withFirstStepGlobalSelectors(step, actualStepIndex);
      this.registerStep0RestartTrigger(actualStepIndex);
      if (this._state.executionMode === "Linear" && actualStepIndex > 0 && this._currentFlow) {
        for (let i = 0; i < actualStepIndex; i++) {
          if (this._state.inProgressSteps.has(i)) {
            const earlierStep = this._currentFlow.steps[i];
            console.debug(
              `[DAP] Linear: \u{1F6AA} Auto-closing UX for earlier step ${i} (${earlierStep.stepId}) as newer step ${actualStepIndex} is being executed`
            );
            this._state.inProgressSteps.delete(i);
            this._triggerManager.removeTriggerListeners(earlierStep.stepId);
            this.removeStepVisualUX(earlierStep);
            if (!this._state.triggeredSteps.has(i)) {
              this._state.triggeredSteps.add(i);
              console.debug(`[DAP] Linear: Marked earlier step ${i} as completed during newer step execution`);
            }
          }
        }
        this._state.anyOrderStepInProgress = false;
      }
      this._triggerManager.removeTriggerListeners(step.stepId);
      if (!this.isStepContextActive(step)) {
        const pageSelector = this.resolveStepPageSelector(step);
        console.debug(
          `[DAP] Step ${step.stepId} \u2014 page selector "${pageSelector}" not found yet; trying rapid rAF retries before full defer`
        );
        let _rafAttempts = 0;
        const _RAF_MAX = 5;
        const tryRaf = () => {
          const isRestartWaiting = this._state.executionState === "INACTIVE" && actualStepIndex === 0;
          if (!this._state.flowInProgress && !isRestartWaiting || !this._currentFlow) return;
          if (this._state.triggeredSteps.has(actualStepIndex)) return;
          if (this.isStepContextActive(step)) {
            console.debug(`[DAP] Step ${step.stepId} \u2014 element appeared after ${_rafAttempts} rAF frame(s); registering trigger`);
            this.executeStepWithTrigger(step, actualStepIndex);
            return;
          }
          _rafAttempts++;
          if (_rafAttempts < _RAF_MAX) {
            requestAnimationFrame(tryRaf);
          } else {
            console.debug(
              `[DAP] Step ${step.stepId} deferred (full) \u2014 page selector "${pageSelector}" not found after ${_RAF_MAX} rAF frames`
            );
            this.deferStepUntilSelectorPresent(
              step,
              actualStepIndex,
              pageSelector,
              () => this.executeStepWithTrigger(step, actualStepIndex)
            );
          }
        };
        requestAnimationFrame(tryRaf);
        return;
      }
      const isSubsequentLinearStep = this._state.executionMode === "Linear" && this._state.activeStep > 0 && actualStepIndex > 0;
      const trigger = isSubsequentLinearStep ? null : this._triggerManager.resolveTrigger(step);
      if (!trigger) {
        console.debug(`[DAP] Step ${step.stepId}: NO TRIGGER - executing immediately`);
        if (this._state.executionState === "INACTIVE" && actualStepIndex === 0) {
          const currentPageId = pageContextService.getPageId();
          if (currentPageId === this._state.completedPageId) {
            console.debug(
              `[DAP] Restart ignored: step 0 has no trigger and we are on the same page visit where the flow completed (${currentPageId}).`
            );
            return;
          }
        }
        if (!this._state.runCounted && this._currentFlow) {
          this.incrementFlowRunCount(this._currentFlow);
          this._state.runCounted = true;
        }
        this.executeStepContent(step, actualStepIndex);
        if (step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0 && step.userInputSelector) {
          this.setupInputSelectorMutationObserver(step);
          this.setupInputRuleListeners(step);
        }
        this.postStepTransition(step);
        return;
      }
      console.debug(`[DAP] Step ${step.stepId}: TRIGGER RESOLVED - setting up listeners`);
      const isCurrentActiveStep = actualStepIndex === this._state.activeStep;
      const flowContext = {
        mode: this._state.executionMode,
        currentStepActive: isCurrentActiveStep,
        stepIndex: actualStepIndex
      };
      if (step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0 && step.userInputSelector) {
        this.setupInputSelectorMutationObserver(step);
        this.setupInputRuleListeners(step);
      }
      this._triggerManager.registerTriggerListeners(step.stepId, trigger, (context) => {
        let shouldRenderUX = true;
        const isLifecycleOrTimeTrigger = trigger.conditions.some((c) => c.kind === "Lifecycle" || c.kind === "Time");
        if (this._state.executionState === "INACTIVE" && isLifecycleOrTimeTrigger) {
          const currentPageId = pageContextService.getPageId();
          if (currentPageId === this._state.completedPageId) {
            console.debug(
              `[DAP] Restart trigger ignored: lifecycle/time trigger fired on the same page visit where the flow completed (${currentPageId}).`
            );
            return;
          }
        }
        if (this._state.executionMode === "Linear") {
          if (!this.isStepContextActive(step)) {
            console.debug(
              `[DAP] Linear: trigger fired for step ${step.stepId} but its page element is absent \u2014 ignoring (wrong SPA screen)`
            );
            return;
          }
          const currentStepIndex = this._state.activeStep;
          const actualStepIndex2 = stepIndex !== void 0 ? stepIndex : currentStepIndex;
          if (actualStepIndex2 === 0 && (currentStepIndex > 0 || !this._state.flowInProgress)) {
            console.debug(`[DAP] \u{1F504} First step trigger fired. Restarting flow ${this._currentFlow?.flowId} from step 0.`);
            if (this._currentFlow) {
              this._currentFlow.steps.forEach((s, idx) => {
                this.removeStepVisualUX(s);
                this.cleanupCurrentStep(idx);
              });
            }
            this._state.flowInProgress = true;
            this._state.activeFlowId = this._currentFlow?.flowId || null;
            this._state.activeStep = 0;
            this._state.activeStepTriggered = true;
            this._state.activeStepTriggeredPageId = pageContextService.getPageId();
            this._state.triggeredSteps.clear();
            this._state.executionState = "ACTIVE";
            this._state.runCounted = false;
            if (!this._state.runCounted && this._currentFlow) {
              this.incrementFlowRunCount(this._currentFlow);
              this._state.runCounted = true;
            }
            this.saveFlowProgress();
            if (this._currentFlow) {
              this._onFlowStart?.(this._currentFlow.flowId);
            }
            this.executeStepContent(step, 0);
            this.postStepTransition(step);
            return;
          }
          if (actualStepIndex2 !== currentStepIndex) {
            console.debug(`[DAP] Linear Execution Gate: Rejecting trigger for non-current step ${step.stepId} (index ${actualStepIndex2}, current ${currentStepIndex})`);
            return;
          }
          shouldRenderUX = true;
          if (step.uxExperience && this._state.activeStepTriggered) {
            console.debug(`[DAP] Linear Execution Gate: UX step ${step.stepId} already triggered, ignoring duplicate trigger for UX`);
            shouldRenderUX = false;
          }
          if (step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0) {
            const hasActiveDebouncedEvaluation = this._ruleEvaluationTimers.has(step.stepId);
            if (hasActiveDebouncedEvaluation) {
              console.debug(`[DAP] Rule-based step ${step.stepId} already has pending debounced evaluation, clearing previous timer`);
              this.clearRuleEvaluationTimers(step.stepId);
            }
            console.debug(`[DAP] Rule-based step ${step.stepId} re-trigger allowed with new input: "${context.userInput}"`);
            if (step.uxExperience && !this._state.activeStepTriggered) {
              this._state.activeStepTriggered = true;
              this._state.activeStepTriggeredPageId = pageContextService.getPageId();
              this.saveFlowProgress();
            }
          } else {
            this._state.activeStepTriggered = true;
            this._state.activeStepTriggeredPageId = pageContextService.getPageId();
            this.saveFlowProgress();
          }
        }
        console.debug(`[DAP] TRIGGER ACTIVATED for step ${step.stepId}`);
        if (!this._state.runCounted && this._currentFlow) {
          this.incrementFlowRunCount(this._currentFlow);
          this._state.runCounted = true;
        }
        if (shouldRenderUX) {
          this.executeStepContent(step, actualStepIndex);
        }
        if (step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0) {
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
      if (this._state.pendingUXResume && step.uxExperience && actualStepIndex === this._state.activeStep) {
        this._state.pendingUXResume = false;
        this._state.activeStepTriggered = true;
        this._state.activeStepTriggeredPageId = pageContextService.getPageId();
        console.debug(
          `[DAP] Linear: auto-resuming UX for step ${step.stepId} (user returned to page after navigating away mid-step)`
        );
        if (!this._state.runCounted && this._currentFlow) {
          this.incrementFlowRunCount(this._currentFlow);
          this._state.runCounted = true;
        }
        this.saveFlowProgress();
        this.executeStepContent(step, actualStepIndex);
      }
    }
    /**
     * Set up trigger for a specific step (used in AnyOrder mode)
     */
    setupStepTrigger(step, stepIndex) {
      if (this._state.executionMode === "AnyOrder") {
        this._updateAnyOrderActiveStep();
      }
      step = this.withFirstStepGlobalSelectors(step, stepIndex);
      if (this._state.executionMode !== "AnyOrder" && this._state.triggeredSteps.has(stepIndex)) {
        console.debug(`[DAP] setupStepTrigger: Step ${step.stepId} already completed \u2014 skipping`);
        return;
      }
      if (this._state.inProgressSteps.has(stepIndex)) {
        console.debug(`[DAP] setupStepTrigger: Step ${step.stepId} is already in-progress \u2014 skipping`);
        return;
      }
      const trigger = this._triggerManager.resolveTrigger(step);
      if (trigger && this._state.executionMode === "AnyOrder") {
        trigger.once = false;
      }
      if (!trigger) {
        if (step.stepType === "Optional") {
          this._state.triggeredSteps.add(stepIndex);
        }
        return;
      }
      if (!this.isStepContextActive(step)) {
        const pageSelector = this.resolveStepPageSelector(step);
        console.debug(
          `[DAP] AnyOrder: Step ${step.stepId} \u2014 page selector "${pageSelector}" not found yet; trying rapid rAF retries before full defer`
        );
        let _rafAttempts = 0;
        const _RAF_MAX = 5;
        const tryRaf = () => {
          if (!this._state.flowInProgress || !this._currentFlow) return;
          if (this._state.triggeredSteps.has(stepIndex) || this._state.inProgressSteps.has(stepIndex)) return;
          if (this.isStepContextActive(step)) {
            console.debug(`[DAP] AnyOrder: Step ${step.stepId} \u2014 element appeared after ${_rafAttempts} rAF frame(s); registering trigger`);
            this.setupStepTrigger(step, stepIndex);
            return;
          }
          _rafAttempts++;
          if (_rafAttempts < _RAF_MAX) {
            requestAnimationFrame(tryRaf);
          } else {
            console.debug(
              `[DAP] AnyOrder: Step ${step.stepId} deferred (full) \u2014 page selector "${pageSelector}" not found after ${_RAF_MAX} rAF frames`
            );
            this.deferStepUntilSelectorPresent(
              step,
              stepIndex,
              pageSelector,
              () => this.setupStepTrigger(step, stepIndex)
            );
          }
        };
        requestAnimationFrame(tryRaf);
        return;
      }
      console.debug(
        `[DAP] AnyOrder: Step ${step.stepId} page context active \u2014 registering trigger`
      );
      const hasRuleBlocks = step.conditionRuleBlocks != null && step.conditionRuleBlocks.length > 0;
      const isRuleBasedStep = !step.uxExperience && hasRuleBlocks;
      if (hasRuleBlocks) {
        if (step.userInputSelector) {
          this.setupInputSelectorMutationObserver(step);
        }
        this.setupInputRuleListeners(step);
      }
      const flowContext = {
        mode: this._state.executionMode,
        currentStepActive: stepIndex === this._state.activeStep,
        stepIndex
      };
      this._triggerManager.registerTriggerListeners(step.stepId, trigger, (context) => {
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
        this.saveFlowProgress();
        this.executeStepContent(step, stepIndex);
        this.postStepTransition(step);
      }, flowContext, step.stepType);
      if (step.uxExperience && this._state.pendingUXResumeSteps?.has(stepIndex) && !this._state.anyOrderStepInProgress) {
        this._state.pendingUXResumeSteps.delete(stepIndex);
        if (this._state.pendingUXResumeSteps.size === 0) {
          this._state.pendingUXResumeSteps = void 0;
        }
        this._state.inProgressSteps.add(stepIndex);
        this._state.anyOrderStepInProgress = true;
        if (!this._state.runCounted && this._currentFlow) {
          this.incrementFlowRunCount(this._currentFlow);
          this._state.runCounted = true;
        }
        console.debug(
          `[DAP] AnyOrder: auto-resuming UX for step ${step.stepId} (user returned to page after navigating away mid-step)`
        );
        this.saveFlowProgress();
        this.executeStepContent(step, stepIndex);
        this.postStepTransition(step);
      }
    }
    /**
     * Resolve the page-identity selector for a step — the single, most specific
     * token that uniquely identifies which SPA screen the step belongs to.
     *
     * Source priority:
     *   1. uxExperience.elementSelector  (the experience anchor element)
     *   2. trigger.conditions[].selector (the interaction trigger element)
     *
     *
     * The priority resolver efficiently evaluates `|` delimited compound
     * strings and returns true if AT LEAST ONE token perfectly resolves to the DOM.
     * This guarantees cross-page navigation reliability when elements are asynchronous.
     *
     * Returns null for pure Lifecycle/Time steps that carry no DOM anchor at all.
     */
    resolveStepPageSelector(step) {
      const raw = step.uxExperience?.elementSelector?.trim() && step.uxExperience.elementSelector.trim() !== "NA" ? step.uxExperience.elementSelector.trim() : step.trigger?.conditions?.find(
        (c) => c.selector && c.selector.trim() !== "" && c.selector.trim() !== "NA"
      )?.selector?.trim() ?? null;
      if (!raw) return null;
      const tokens = parseSelectors(raw);
      if (tokens.length <= 1) return raw;
      const preferredTokens = tokens.filter((token) => !this.isLikelyGenericPageSelectorToken(token));
      if (preferredTokens.length > 0) {
        if (preferredTokens.length !== tokens.length) {
          console.debug(
            `[DAP] Step ${step.stepId}: filtered page selector tokens from "${raw}" to "${preferredTokens.join("|")}"`
          );
        }
        return preferredTokens.join("|");
      }
      const fallback = tokens.slice(0, Math.min(2, tokens.length)).join("|");
      if (fallback !== raw) {
        console.debug(
          `[DAP] Step ${step.stepId}: using conservative page selector fallback "${fallback}" instead of full selector chain`
        );
      }
      return fallback;
    }
    getPageSelectorCacheKey(step) {
      return `${step.stepId}::page`;
    }
    hasActiveUXExperience(excludingStepIndex) {
      for (const index of this._state.inProgressSteps) {
        if (index !== excludingStepIndex) return true;
      }
      const excludingStepId = excludingStepIndex !== void 0 ? this._currentFlow?.steps[excludingStepIndex]?.stepId : void 0;
      const activeExperience = Array.from(document.querySelectorAll(
        [
          '[id^="dap-tooltip-"]',
          '[id^="dap-popover-"]',
          '[id^="dap-beacon-"]',
          '[id^="dap-microsurvey-"]',
          '[id^="dap-modal-overlay-"]',
          '[id^="dap-banner-wrap-"]'
        ].join(",")
      )).find((el) => {
        return el.id !== "dap-tooltip-overlay" && el.id !== "dap-tooltip-styles" && el.id !== "dap-modal-styles" && el.id !== "dap-popover-styles" && el.id !== "dap-survey-styles" && el.id !== "dap-beacon-styles";
      });
      if (!activeExperience) return false;
      return !excludingStepId || !activeExperience.id.includes(excludingStepId);
    }
    isFirstFlowStep(step, stepIndex) {
      return stepIndex === 0 || this._currentFlow?.steps[0]?.stepId === step.stepId;
    }
    stripOptionalUrlSelector(selector) {
      return typeof selector === "string" ? stripUrlSelectorTokens(selector) : selector;
    }
    stripNullableUrlSelector(selector) {
      return typeof selector === "string" ? stripUrlSelectorTokens(selector) : selector;
    }
    withFirstStepGlobalSelectors(step, _stepIndex) {
      return step;
    }
    isLikelyGenericPageSelectorToken(token) {
      const trimmed = token.trim();
      const lower = trimmed.toLowerCase();
      if (!trimmed) return true;
      if (lower.startsWith("url=")) return false;
      if (lower.startsWith("data-")) return false;
      if (lower.startsWith("id=")) {
        const value = trimmed.slice(3).trim().toLowerCase();
        return this.isGenericContainerIdentifier(value);
      }
      if (lower.startsWith("css=")) {
        return this.isLikelyGenericCssSelector(trimmed.slice(4));
      }
      if (lower.startsWith("xpath=")) {
        return this.isLikelyGenericXPathSelector(trimmed.slice(6));
      }
      return this.isLikelyGenericCssSelector(trimmed) || this.isLikelyGenericXPathSelector(trimmed);
    }
    isGenericContainerIdentifier(value) {
      return [
        "root",
        "app",
        "__next",
        "main",
        "content",
        "container",
        "wrapper"
      ].includes(value);
    }
    isLikelyGenericCssSelector(selector) {
      const normalized = selector.replace(/\s+/g, " ").trim().toLowerCase();
      if (!normalized) return true;
      const hasDataAttribute = normalized.includes("[data-");
      const hasStableAttribute = /\[(aria-|name=|placeholder=|type=|role=|title=|href=|src=)/.test(normalized);
      const hasSpecificId = /#(?!root\b|app\b|__next\b|main\b|content\b)[\w-]+/.test(normalized);
      const hasClassSelector = /\.[\w-]+/.test(normalized);
      const hasPseudoSelector = /:(nth|first|last|not|has|is|where|only|empty)/.test(normalized);
      const segmentCount = normalized.split(/\s*>\s*|\s+/).map((part) => part.trim()).filter(Boolean).length;
      const rootWrapperDescendant = /^(#root|#app|#__next|main|body|html)(\s*[> ]\s*)+(input|button|a|div|span|textarea|select|label)$/.test(normalized);
      const endsWithBareElement = /(^|[>+~\s])(input|button|a|div|span|textarea|select|label|svg|img|p|h[1-6])$/.test(normalized);
      if (hasDataAttribute || hasStableAttribute || hasSpecificId || hasPseudoSelector) {
        return false;
      }
      if (segmentCount >= 4 && hasClassSelector) {
        return false;
      }
      if (rootWrapperDescendant) {
        return true;
      }
      if (segmentCount <= 2 && !hasClassSelector && !hasSpecificId) {
        return true;
      }
      return endsWithBareElement && !hasClassSelector;
    }
    isLikelyGenericXPathSelector(selector) {
      const normalized = selector.replace(/\s+/g, "").trim().toLowerCase();
      if (!normalized) return true;
      const hasStableAttribute = normalized.includes("@data-") || /@(placeholder|name|title|type|role|aria-[\w-]+)=/.test(normalized) || normalized.includes("contains(") || normalized.includes("text()") || normalized.includes("normalize-space(");
      const hasSpecificId = /@id=['"](?!root['"]|app['"]|__next['"]|main['"]|content['"])[^'"]+['"]/.test(normalized);
      const slashCount = (normalized.match(/\//g) || []).length;
      const rootWrapperDescendant = /^\/?\/?\*\[@id=['"](root|app|__next|main|content)['"]\]\/\/(input|button|a|div|span|textarea|select|label)$/.test(normalized);
      const endsWithGenericDescendant = /\/\/(input|button|a|div|span|textarea|select|label)$/.test(normalized);
      if (hasStableAttribute || hasSpecificId) {
        return false;
      }
      if (slashCount >= 5 && normalized.includes("/")) {
        return false;
      }
      if (rootWrapperDescendant) {
        return true;
      }
      return endsWithGenericDescendant;
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
      if (this._currentFlow?.targetUrls && this._currentFlow.targetUrls.length > 0) {
        const ctx = pageContextService.getCurrentContext();
        const matchesUrl = this._currentFlow.targetUrls.some((p) => this._matchUrlPattern(p, ctx));
        if (!matchesUrl) {
          console.debug(
            `[DAP] isStepContextActive: step "${step.stepId}" inactive \u2014 "${ctx.pathname}" does not match flow targetUrls`
          );
          return false;
        }
      }
      let stepUrl = step.url || step.targetUrl;
      if (stepUrl && (stepUrl.toLowerCase().startsWith("url=") || stepUrl.includes("|"))) {
        stepUrl = extractUrlFromSelector(stepUrl) || void 0;
      }
      if (stepUrl) {
        const ctx = pageContextService.getCurrentContext();
        if (!this._matchUrlPattern(stepUrl, ctx)) {
          console.debug(
            `[DAP] isStepContextActive: step "${step.stepId}" inactive \u2014 "${ctx.pathname}" does not match step targetUrl/url "${stepUrl}"`
          );
          return false;
        }
      }
      if (!pageSelector) return true;
      const el = resolveSelectorWithCache(this.getPageSelectorCacheKey(step), pageSelector);
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
      let pollInterval = null;
      let settled = false;
      const cleanup = () => {
        observer?.disconnect();
        observer = null;
        pageUnsub?.();
        pageUnsub = null;
        if (pollInterval !== null) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      };
      const tryRegister = () => {
        if (settled) return;
        const isRestartWaiting = this._state.executionState === "INACTIVE" && stepIndex === 0;
        if (!this._state.flowInProgress && !isRestartWaiting || !this._currentFlow || this._state.triggeredSteps.has(stepIndex) || this._state.inProgressSteps.has(stepIndex)) {
          settled = true;
          cleanup();
          return;
        }
        const isActive = this.isStepContextActive(step);
        if (!isActive) {
          if (this._state.executionMode === "Linear" && this._syncLinearActiveStepForNewPage()) {
            console.debug(`[DAP] Linear: Skipped step detected during defer. Fast-forwarding to step ${this._state.activeStep}.`);
            settled = true;
            cleanup();
            const oldIndex = stepIndex;
            this.cleanupCurrentStep(oldIndex);
            if (this._state.inProgressSteps.has(oldIndex)) {
              this._state.inProgressSteps.delete(oldIndex);
              this._state.anyOrderStepInProgress = false;
            }
            this._state.activeStepTriggered = false;
            this._state.activeStepTriggeredPageId = null;
            this._state.pendingUXResume = false;
            this.saveFlowProgress();
            const newStep = this._currentFlow.steps[this._state.activeStep];
            this.executeStepWithTrigger(newStep, this._state.activeStep);
          }
          return;
        }
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
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        // catch class / style / hidden attribute changes
        attributeFilter: ["class", "style", "hidden", "aria-hidden", "data-active", "data-visible"]
      });
      pageUnsub = pageContextService.subscribe(() => {
        setTimeout(() => tryRegister(), 0);
      });
      let _pollAttempts = 0;
      const _MAX_POLL_ATTEMPTS = 100;
      pollInterval = setInterval(() => {
        if (settled) {
          clearInterval(pollInterval);
          pollInterval = null;
          return;
        }
        _pollAttempts++;
        if (_pollAttempts >= _MAX_POLL_ATTEMPTS) {
          clearInterval(pollInterval);
          pollInterval = null;
          return;
        }
        tryRegister();
      }, 100);
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
    executeStepContent(step, stepIndex) {
      if (this._state.activeFlowId) {
        this._onFlowActive?.(this._state.activeFlowId);
      }
      if (this._state.activeFlowId && !step.uxExperience) {
        trackStepView(this._state.activeFlowId, step.stepId);
      }
      if (step.uxExperience) {
        let resolvedIndex = stepIndex;
        if (resolvedIndex === void 0 && this._currentFlow) {
          resolvedIndex = this._currentFlow.steps.indexOf(step);
        }
        if (resolvedIndex !== void 0 && resolvedIndex !== -1) {
          this._state.inProgressSteps.add(resolvedIndex);
        }
        this.triggerUXExperience(step, stepIndex);
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
      if (triggerSource === "debounced_input") {
        return true;
      }
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
          console.debug(`[DAP] \u{1F4DD} Text-based input: Rules evaluate on blur, input, change, click`);
          return triggerSource === "blur" || triggerSource === "click" || triggerSource === "manual" || triggerSource === "input" || triggerSource === "change";
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
     * CRITICAL FIX: Setup rule listeners (blur, input, change) for rule evaluation
     * 🚨 ENHANCED: Monitors input in real-time, allowing instant branching on single keypresses (debounced)
     */
    setupInputRuleListeners(step) {
      if (!step.userInputSelector) return;
      console.debug(`[DAP] \u{1F3AF} Setting up input rule listeners for step ${step.stepId}`);
      const cancelWait = this.waitForInputElement(step.userInputSelector, (inputElement) => {
        console.debug(`[DAP] \u2705 Input element found for rule listeners, setting up listeners`);
        const evaluateHandler = (event) => {
          const source = event.type;
          const currentValue = inputElement.value;
          console.debug(`[DAP] \u{1F3AF} INPUT RULE EVENT (${source.toUpperCase()}): Input value for rule evaluation: "${currentValue}"`);
          if (!this._currentFlow) {
            console.debug(`[DAP] \u274C No active flow, ignoring event`);
            return;
          }
          const stepExists = this._currentFlow.steps.some((s) => s.stepId === step.stepId);
          if (!stepExists) {
            console.debug(`[DAP] \u274C Step ${step.stepId} not found in current flow, ignoring event`);
            return;
          }
          const stepIndex = this._currentFlow.steps.findIndex((s) => s.stepId === step.stepId);
          if (stepIndex === -1) {
            console.debug(`[DAP] \u274C Could not find step index for ${step.stepId}, ignoring event`);
            return;
          }
          if (this._state.executionMode === "Linear") {
            const isCurrentOrRecentStep = stepIndex === this._state.activeStep;
            if (!isCurrentOrRecentStep) {
              console.debug(`[DAP] \u274C Step ${step.stepId} is no longer the active step (${stepIndex} vs ${this._state.activeStep}), ignoring event`);
              return;
            }
          } else {
            if (this._state.triggeredSteps.has(stepIndex)) {
              console.debug(`[DAP] \u274C AnyOrder step ${step.stepId} already triggered, ignoring event`);
              return;
            }
          }
          console.debug(`[DAP] \u2705 Step validation passed - proceeding with rule evaluation`);
          this._currentFlow.steps[stepIndex];
          this.clearRuleEvaluationTimers(step.stepId);
          this.evaluateStepRulesWithValue(step, currentValue, source);
        };
        inputElement.addEventListener("blur", evaluateHandler);
        inputElement.addEventListener("input", evaluateHandler);
        inputElement.addEventListener("change", evaluateHandler);
        const existingCleanup = this._stepTriggerListeners.get(`${step.stepId}_blur`);
        if (existingCleanup) {
          existingCleanup();
        }
        this._stepTriggerListeners.set(`${step.stepId}_blur`, () => {
          inputElement.removeEventListener("blur", evaluateHandler);
          inputElement.removeEventListener("input", evaluateHandler);
          inputElement.removeEventListener("change", evaluateHandler);
          console.debug(`[DAP] Cleaned up rule input event listeners for step ${step.stepId}`);
        });
        console.debug(`[DAP] \u2705 Input rule listeners registered for step ${step.stepId}`);
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
      const inputElement = step.userInputSelector ? resolveSelectorWithPriority(step.userInputSelector) : null;
      const inputType = inputElement ? this.getInputElementType(inputElement) : "unknown";
      const isTextInput = ["text", "email", "password", "textarea", "number", "search", "url", "tel"].includes(inputType);
      if (isTextInput && (source === "input" || source === "change")) {
        this.clearRuleEvaluationTimers(step.stepId);
        console.debug(`[DAP] \u23F3 Debouncing rule evaluation for step ${step.stepId} (300ms)`);
        const timerId = window.setTimeout(() => {
          this._ruleEvaluationTimers.delete(step.stepId);
          this.runRuleEvaluationInternal(step, inputValue, "debounced_input");
        }, 300);
        this._ruleEvaluationTimers.set(step.stepId, timerId);
        return;
      }
      this.clearRuleEvaluationTimers(step.stepId);
      this.runRuleEvaluationInternal(step, inputValue, source);
    }
    /**
     * Internal helper to execute the rule blocks evaluation
     */
    runRuleEvaluationInternal(step, inputValue, triggerSource) {
      const source = triggerSource;
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
      if (step.uxExperience) {
        console.debug(`[DAP] Step ${step.stepId} has UX experience, staying on step for user interaction after evaluation failure`);
        return;
      }
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
      if (step.uxExperience) {
        console.debug(`[DAP] Step ${step.stepId} has UX experience, staying on step for user interaction`);
        return;
      }
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
        try {
          sessionStorage.setItem(`dap_flow_completed_session_${flowId}`, "true");
          console.debug(`[DAP] \u2705 Flow ${flowId} marked as completed in session via branching`);
        } catch (e) {
        }
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
      this.resetFlowState();
      this._onFlowEnd = endCb;
      endCb?.(flowId, "branched");
      if (this._currentFlow) {
        console.debug(`[DAP] \u{1F4E2} Broadcasting flow completion event for tracking system`);
        resetFlowTracking(this._currentFlow.flowId);
      }
    }
    /**
     * Reset flow state to initial values
     */
    resetFlowState() {
      this.cleanupCurrentStep();
      if (this._state.activeFlowId) {
        this._triggerManager.resetOnceTriggersForFlow(this._state.activeFlowId);
      }
      this._state = {
        activeFlowId: null,
        flowInProgress: false,
        activeStep: 0,
        activeStepTriggered: false,
        activeStepTriggeredPageId: null,
        activeStepPageId: null,
        executionState: "TERMINATED",
        executionMode: "Linear",
        triggeredSteps: /* @__PURE__ */ new Set(),
        anyOrderStepInProgress: false,
        inProgressSteps: /* @__PURE__ */ new Set(),
        pendingUXResume: false,
        pendingUXResumeSteps: void 0,
        completedPageId: null
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
      const steps = ((Array.isArray(rawFlowData.steps) ? rawFlowData.steps : null) || (Array.isArray(rawFlowData.actions) ? rawFlowData.actions : null) || (Array.isArray(rawFlowData.actionGroups) ? rawFlowData.actionGroups : null) || []).map((step) => ({
        ...step,
        url: step.url || step.targetUrl || step.pageUrl || step.uxExperience?.url || step.uxExperience?.targetUrl || step.uxExperience?.pageUrl || void 0,
        targetUrl: step.targetUrl || step.url || step.pageUrl || step.uxExperience?.targetUrl || step.uxExperience?.url || step.uxExperience?.pageUrl || void 0
      }));
      const rawFreq = rawFlowData.execution?.frequency || rawFlowData.frequency || {
        type: rawFlowData.frequencyType || "Always",
        maxRuns: rawFlowData.maxRuns || 0
      };
      const rawType = String(rawFreq.type || "Always").toLowerCase().trim();
      let normalizedType = "Always";
      if (rawType === "always") normalizedType = "Always";
      else if (rawType === "onetime" || rawType === "one-time" || rawType === "one_time") normalizedType = "OneTime";
      else if (rawType === "recurring") normalizedType = "Recurring";
      else if (rawType === "daily") normalizedType = "Daily";
      else if (rawType === "weekly") normalizedType = "Weekly";
      else if (rawType === "monthly") normalizedType = "Monthly";
      const frequency = {
        type: normalizedType,
        maxRuns: rawFreq.maxRuns !== void 0 ? rawFreq.maxRuns : 0
      };
      return {
        flowId: rawFlowData.flowId || rawFlowData.id || flowId,
        flowName: rawFlowData.flowName || rawFlowData.name || flowId,
        steps,
        // ── Page-URL targeting ───────────────────────────────────────────────────
        // Accept both array (targetUrls) and scalar (targetUrl) from raw data.
        // These patterns are used by FlowEngine to restrict this flow to specific
        // pages, enabling independent pause/resume per page visit.
        targetUrls: rawFlowData.targetUrls ? Array.isArray(rawFlowData.targetUrls) ? rawFlowData.targetUrls : [rawFlowData.targetUrls] : rawFlowData.targetUrl ? [rawFlowData.targetUrl] : void 0,
        // ────────────────────────────────────────────────────────────────────────
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
          const config = window.__DAP_CONFIG__;
          if (!config) {
            console.error(`[DAP] No config available to start flow: ${flowId}`);
            window.dispatchEvent(new CustomEvent("dap:startFlow", { detail: { flowId } }));
            return;
          }
          const previewMode = detectPreviewMode();
          const previewSessionId = previewMode.isPreviewMode ? previewMode.previewSessionId : void 0;
          const rawData = await fetchFlowById(config, location.origin, flowId, previewSessionId);
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
     * ✅ Update activeStep highlight focus for AnyOrder flows based on current page.
     * Finds the first uncompleted step that is active on the current page to
     * drive the visual highlight sequence as per "step-by-step" guidance.
     */
    _updateAnyOrderActiveStep() {
      if (!this._currentFlow || this._state.executionMode !== "AnyOrder") return;
      const firstOnPage = this._currentFlow.steps.findIndex(
        (s, i) => !this._state.triggeredSteps.has(i) && !this._state.inProgressSteps.has(i) && this.isStepContextActive(s)
      );
      if (firstOnPage !== -1) {
        if (this._state.activeStep !== firstOnPage) {
          console.debug(`[DAP] AnyOrder focus Shift: Moved activeStep highlight to step ${this._currentFlow.steps[firstOnPage].stepId} (${firstOnPage}) for current page`);
          this._state.activeStep = firstOnPage;
        }
      } else {
        const firstGlobal = this._currentFlow.steps.findIndex(
          (s, i) => !this._state.triggeredSteps.has(i) && !this._state.inProgressSteps.has(i)
        );
        if (firstGlobal !== -1 && this._state.activeStep !== firstGlobal) {
          console.debug(`[DAP] AnyOrder focus Shift: No steps on current page \u2014 pointing highlight to global next: ${firstGlobal}`);
          this._state.activeStep = firstGlobal;
        }
      }
    }
    /**
     * Trigger UX experience rendering
     */
    triggerUXExperience(step, stepIndexOverride) {
      if (this._currentFlow) {
        trackStepView(this._currentFlow.flowId, step.stepId).catch((error) => {
          console.debug(`[DAP] Step tracking failed: ${error.message}`);
        });
      }
      const ux = step.uxExperience;
      let rawTargetSelector = ux.elementSelector && ux.elementSelector !== "NA" ? ux.elementSelector : step.trigger?.conditions?.find((c) => c.selector)?.selector;
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
      const experienceType = ux.uxExperienceType.toLowerCase();
      const rendererType = experienceType === "microsurvey" ? "survey" : experienceType;
      const renderer = getRenderer(rendererType);
      if (!renderer) {
        console.error(`[DAP] No renderer found for: ${ux.uxExperienceType}`);
        this.advanceToNextStep();
        return;
      }
      const executionMode = this._state.executionMode;
      let stepIndex = stepIndexOverride !== void 0 ? stepIndexOverride : this._state.activeStep;
      if (executionMode === "AnyOrder" && stepIndexOverride === void 0) {
        const foundIndex = this._currentFlow?.steps.indexOf(step);
        if (foundIndex !== void 0 && foundIndex !== -1) {
          stepIndex = foundIndex;
        }
      }
      const totalSteps = this._currentFlow?.steps.length || 1;
      const isLastStep = this._currentFlow && stepIndex === this._currentFlow.steps.length - 1;
      const nextStep = this._currentFlow && !isLastStep ? this._currentFlow.steps[stepIndex + 1] : null;
      const nextStepTitle = nextStep?.uxExperience?.content?.title || nextStep?.uxExperience?.content?.header || "";
      const nextStepTargetUrl = nextStep?.targetUrl;
      let payload;
      if (experienceType === "modal") {
        let bodyContent = [];
        if (ux.content?.body) {
          bodyContent.push({
            kind: "text",
            html: ux.content.body
          });
        }
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
                const kbFallback = modalContent.contentData || modalContent.contentDescription;
                if (kbFallback && kbFallback !== ux.content?.body) {
                  bodyContent.push({
                    kind: "text",
                    html: kbFallback
                  });
                }
              }
              break;
            default:
              const modalText = modalContent.contentData || modalContent.contentDescription;
              if (modalText && modalText !== ux.content?.body) {
                bodyContent.push({
                  kind: "text",
                  html: modalText
                });
              }
              break;
          }
        }
        payload = {
          title: ux.content?.header,
          body: bodyContent,
          footerText: ux.content?.footer,
          size: bodyContent.some((c) => c.kind === "article" || c.kind === "kb") ? "xl" : ux.content?.size || "medium",
          theme: {},
          executionMode,
          stepIndex,
          totalSteps,
          isLastStep,
          nextStepTitle,
          nextStepTargetUrl,
          _completionTracker: {
            onComplete: () => {
              this.onStepComplete(step);
            },
            onAbort: () => {
              this.abortFlow();
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
          executionMode,
          stepIndex,
          totalSteps,
          isLastStep,
          nextStepTitle,
          nextStepTargetUrl,
          _completionTracker: {
            onComplete: () => {
              this.onStepComplete(step);
            },
            onAbort: () => {
              this.abortFlow();
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
          executionMode,
          stepIndex,
          totalSteps,
          isLastStep,
          nextStepTitle,
          nextStepTargetUrl,
          _completionTracker: {
            onComplete: () => {
              this.onStepComplete(step);
            },
            onAbort: () => {
              this.abortFlow();
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
          executionMode,
          stepIndex,
          totalSteps,
          isLastStep,
          nextStepTitle,
          nextStepTargetUrl,
          _completionTracker: {
            onComplete: () => {
              this.onStepComplete(step);
            },
            onAbort: () => {
              this.abortFlow();
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
          executionMode,
          stepIndex,
          totalSteps,
          isLastStep,
          nextStepTitle,
          _completionTracker: {
            onComplete: () => {
              this.onStepComplete(step);
            },
            onAbort: () => {
              this.abortFlow();
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
          executionMode,
          stepIndex,
          totalSteps,
          isLastStep,
          nextStepTitle,
          _completionTracker: {
            onComplete: () => {
              this.onStepComplete(step);
            },
            onAbort: () => {
              this.abortFlow();
            }
          }
        };
      } else if (experienceType === "alert" || experienceType === "banner") {
        payload = {
          message: ux.content?.body || ux.content?.message || ux.content?.text || ux.content?.header || "Alert",
          variant: ux.content?.variant || ux.content?.type || ux.content?.level?.toLowerCase() || "info",
          position: ux.content?.position || "top",
          targetSelector: resolvedTargetSelector,
          placement: ux.content?.placement || ux.content?.position || "top",
          dismissible: ux.content?.dismissible !== false,
          autoHide: ux.content?.autoDismiss || ux.content?.autoHide,
          actions: ux.content?.actions || [],
          theme: ux.content?.theme || {},
          stepId: step.stepId,
          executionMode,
          stepIndex,
          totalSteps,
          isLastStep,
          nextStepTitle,
          _completionTracker: {
            onComplete: () => {
              this.onStepComplete(step);
            },
            onAbort: () => {
              this.abortFlow();
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
            elementSelector: ux.elementSelector,
            targetUrl: step.targetUrl
            // Include target URL for multi-page flow support
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
      try {
        renderer(flowForRenderer);
      } catch (err) {
        console.error("[DAP] Error executing experience renderer:", err);
        if (this._currentFlow && this._currentFlow.steps[this._state.activeStep]?.stepId === step.stepId) {
          this.advanceToNextStep();
        }
      }
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
          this.saveFlowProgress();
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
        const oldActiveStep = this._state.activeStep;
        this._updateAnyOrderActiveStep();
        if (this._state.activeStep !== oldActiveStep) {
          this.executeAnyOrderSteps();
        }
      } else {
        this._state.anyOrderStepInProgress = false;
        if (this._currentFlow && this._state.activeStep < this._currentFlow.steps.length && this._currentFlow.steps[this._state.activeStep].stepId === step.stepId) {
          const isLastStep = this._state.activeStep === this._currentFlow.steps.length - 1;
          if (!isLastStep && !this.isStepContextActive(step)) {
            console.debug(
              `[DAP] Linear onStepComplete: step ${step.stepId} \u2014 page context not active (UX dismissed by navigation, not by genuine completion). Keeping activeStep at ${this._state.activeStep} so the border reappears when the user returns to this step's page.`
            );
            this._state.activeStepTriggered = false;
            this._state.activeStepTriggeredPageId = null;
          } else {
            this.advanceToNextStep();
          }
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
      this._state.triggeredSteps.add(this._state.activeStep);
      this._state.activeStep++;
      this._state.activeStepTriggered = false;
      this._state.activeStepTriggeredPageId = null;
      this._state.activeStepPageId = null;
      this.saveFlowProgress();
      console.debug(`[DAP] Advanced to step ${this._state.activeStep}`);
      if (this._currentFlow && this._state.activeStep < this._currentFlow.steps.length) {
        const nextStep = this._currentFlow.steps[this._state.activeStep];
        console.debug(`[DAP] Next step: ${nextStep.stepId} (type: ${nextStep.stepType})`);
        if (nextStep.stepType === "Mandatory") {
          console.debug(`[DAP] \u{1F4CB} MANDATORY STEP: Starting mandatory step ${nextStep.stepId}`);
        }
        if (this.navigateIfTargetUrlDiffers(nextStep)) {
          return;
        }
        const nextStepTrigger = this._triggerManager.resolveTrigger(nextStep);
        if (nextStepTrigger) {
          console.debug(`[DAP] Next step ${nextStep.stepId} has trigger, setting up listener`);
          this.executeStepWithTrigger(nextStep, this._state.activeStep);
          this._state.stepAdvancing = false;
          return;
        } else {
          console.debug(`[DAP] Next step ${nextStep.stepId} has no trigger - executing immediately`);
        }
      } else {
        console.debug(`[DAP] \u2705 No more steps, flow completed`);
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
      this._state.triggeredSteps.add(this._state.activeStep);
      this._state.activeStep++;
      this._state.activeStepTriggered = false;
      this._state.activeStepTriggeredPageId = null;
      this._state.activeStepPageId = null;
      this.saveFlowProgress();
      console.debug(`[DAP] Advanced to step ${this._state.activeStep}`);
      if (this._currentFlow && this._state.activeStep < this._currentFlow.steps.length) {
        const nextStep = this._currentFlow.steps[this._state.activeStep];
        console.debug(`[DAP] Next step: ${nextStep.stepId} (type: ${nextStep.stepType})`);
        if (nextStep.stepType === "Mandatory") {
          console.debug(`[DAP] \u{1F4CB} MANDATORY STEP: Starting mandatory step ${nextStep.stepId}`);
        }
        if (this.navigateIfTargetUrlDiffers(nextStep)) {
          return;
        }
        const nextStepTrigger = this._triggerManager.resolveTrigger(nextStep);
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
     * Helper to check if the next step has a targetUrl different from the current page.
     * If it does, automatically navigate to that page.
     */
    navigateIfTargetUrlDiffers(nextStep) {
      let stepUrl = nextStep.url || nextStep.targetUrl;
      if (stepUrl && (stepUrl.toLowerCase().startsWith("url=") || stepUrl.includes("|"))) {
        stepUrl = extractUrlFromSelector(stepUrl) || void 0;
      }
      if (!stepUrl) {
        if (nextStep.uxExperience?.elementSelector) {
          const url = extractUrlFromSelector(nextStep.uxExperience.elementSelector);
          if (url) {
            stepUrl = url;
            console.debug(`[DAP] Extracted target URL from elementSelector: ${stepUrl}`);
          }
        }
        if (!stepUrl && nextStep.trigger?.conditions) {
          for (const cond of nextStep.trigger.conditions) {
            if (cond.selector) {
              const url = extractUrlFromSelector(cond.selector);
              if (url) {
                stepUrl = url;
                console.debug(`[DAP] Extracted target URL from trigger condition: ${stepUrl}`);
                break;
              }
            }
          }
        }
      }
      if (this._state.executionMode === "Linear" && stepUrl) {
        const currentUrl = window.location.href;
        if (currentUrl === stepUrl) {
          return false;
        }
        if (!isNavigationNeeded(stepUrl)) {
          return false;
        }
        console.debug(`[DAP] Step ${nextStep.stepId} requires navigation. Target: ${stepUrl}`);
        let finalUrl = resolveNavigationUrl(stepUrl) || stepUrl;
        let isCrossSite = false;
        try {
          const targetOrigin = new URL(finalUrl, window.location.href).origin;
          isCrossSite = targetOrigin !== window.location.origin;
        } catch (e) {
        }
        if (isCrossSite) {
          try {
            const urlObj = new URL(finalUrl, window.location.href);
            urlObj.searchParams.set("dap_flow_id", this._state.activeFlowId || "");
            urlObj.searchParams.set("dap_step_index", String(this._state.activeStep));
            urlObj.searchParams.set("dap_flow_origin", this._state.flowOrigin || window.location.origin);
            const previewMode = detectPreviewMode();
            if (previewMode.isPreviewMode && previewMode.previewSessionId) {
              urlObj.searchParams.set("previewSessionId", previewMode.previewSessionId);
              urlObj.searchParams.set("flowId", this._state.activeFlowId || "");
            }
            finalUrl = urlObj.toString();
          } catch (e) {
            const separator = finalUrl.includes("?") ? "&" : "?";
            const originVal = encodeURIComponent(this._state.flowOrigin || window.location.origin);
            let extra = "";
            const previewMode = detectPreviewMode();
            if (previewMode.isPreviewMode && previewMode.previewSessionId) {
              extra = `&previewSessionId=${encodeURIComponent(previewMode.previewSessionId)}&flowId=${encodeURIComponent(this._state.activeFlowId || "")}`;
            }
            finalUrl = `${finalUrl}${separator}dap_flow_id=${encodeURIComponent(this._state.activeFlowId || "")}&dap_step_index=${this._state.activeStep}&dap_flow_origin=${originVal}${extra}`;
          }
          console.debug(`[DAP] Cross-site navigation detected. Opening in a new tab: ${finalUrl}`);
          this._state.stepAdvancing = false;
          window.open(finalUrl, "_blank");
          return true;
        }
        console.debug(`[DAP] Automatically navigating to combined URL: ${finalUrl}`);
        this._state.stepAdvancing = false;
        window.location.assign(finalUrl);
        return true;
      }
      return false;
    }
    /**
     * Complete current flow
     * Enhanced with flow completion tracking for frequency validation
     */
    /**
     * Part 1: Save flow progress to sessionStorage
     * Takes a snapshot of the current state and the full flow data.
     */
    saveFlowProgress() {
      if (!this._currentFlow || !this._state.activeFlowId) return;
      try {
        const snapshot = {
          flowId: this._state.activeFlowId,
          activeStep: this._state.activeStep,
          triggeredSteps: Array.from(this._state.triggeredSteps),
          flowData: this._currentFlow,
          // Snapshot full structure for Part 3 Fast-Path
          timestamp: Date.now(),
          // Persist all critical state markers for seamless re-entry
          activeStepTriggered: this._state.activeStepTriggered,
          activeStepTriggeredPageId: this._state.activeStepTriggeredPageId,
          activeStepPageId: this._state.activeStepPageId,
          pendingUXResume: this._state.pendingUXResume,
          pendingUXResumeSteps: this._state.pendingUXResumeSteps ? Array.from(this._state.pendingUXResumeSteps) : void 0,
          inProgressSteps: Array.from(this._state.inProgressSteps),
          anyOrderStepInProgress: this._state.anyOrderStepInProgress,
          flowOrigin: this._state.flowOrigin
        };
        sessionStorage.setItem(`dap_flow_snapshot_${this._state.activeFlowId}`, JSON.stringify(snapshot));
        console.debug(`[DAP] \u{1F4BE} Snapshot saved: Flow ${this._state.activeFlowId}, Step ${this._state.activeStep}, pendingUXResume: ${this._state.pendingUXResume}`);
        updateAppState({
          activeFlowId: this._state.activeFlowId,
          isFlowRunning: this._state.flowInProgress,
          activeStepIndex: this._state.activeStep
        });
      } catch (e) {
        console.error(`[DAP] \u26A0\uFE0F Failed to save flow progress to sessionStorage:`, e);
      }
    }
    /**
     * Cleanup flow progress from sessionStorage
     * 🚨 CRITICAL: This must be called synchronously to prevent the last step from re-appearing
     */
    clearFlowProgress(flowId) {
      try {
        sessionStorage.removeItem(`dap_flow_snapshot_${flowId}`);
        console.debug(`[DAP] \u{1F5D1}\uFE0F Session snapshot cleared for flow ${flowId}`);
        const verifyRemoved = sessionStorage.getItem(`dap_flow_snapshot_${flowId}`);
        if (verifyRemoved !== null) {
          console.error(`[DAP] \u26A0\uFE0F CRITICAL: Session snapshot was NOT cleared for flow ${flowId}! Attempting forced removal...`);
          try {
            sessionStorage.clear();
            console.debug(`[DAP] \u{1F525} Forced sessionStorage.clear() executed for flow ${flowId}`);
          } catch (clearError) {
            console.error(`[DAP] ERROR: Failed to force-clear sessionStorage:`, clearError);
          }
        } else {
          console.debug(`[DAP] \u2705 Session snapshot removal VERIFIED for flow ${flowId}`);
        }
      } catch (e) {
        console.error(`[DAP] ERROR: Failed to clear flow progress for ${flowId}:`, e);
      }
    }
    completeFlow() {
      const flowData = this._currentFlow;
      const flowId = this._state.activeFlowId;
      console.debug(`[DAP] \u2705 FLOW COMPLETED: ${flowId}`);
      if (flowId) {
        telemetryService.trackPlayerEvent("flow.completed", flowId).catch((err) => {
          console.warn("[DAP] Failed to send flow.completed telemetry:", err);
        });
      }
      console.debug(`[DAP] \u{1F4CA} Completed ${this._state.triggeredSteps.size} steps out of ${flowData?.steps.length || 0} total steps`);
      if (flowId) {
        this.clearFlowProgress(flowId);
        console.debug(`[DAP] \u{1F5D1}\uFE0F Session storage cleared for flow ${flowId}`);
        try {
          const activeStr = sessionStorage.getItem("dap_active_flows");
          if (activeStr) {
            const active = JSON.parse(activeStr);
            if (Array.isArray(active)) {
              const updated = active.filter((id) => id !== flowId);
              sessionStorage.setItem("dap_active_flows", JSON.stringify(updated));
              console.debug(`[DAP] [Cross-Site] Removed completed flow ${flowId} from active flows list`);
            }
          }
        } catch (e) {
          console.error(`[DAP] Failed to remove completed flow from active flows list:`, e);
        }
      }
      if (flowData && flowId) {
        this.markFlowCompleted(flowData);
        const freqType = flowData.execution?.frequency?.type || "Always";
        if (freqType === "Recurring" || freqType === "Always" || flowData.execution?.frequency && (flowData.execution.frequency.maxRuns || 1) > 1) {
          try {
            sessionStorage.removeItem(`dap_flow_completed_session_${flowId}`);
            console.debug(`[DAP] \u{1F504} completeFlow: Cleared session completed flag for ${freqType} flow ${flowId} to allow restart`);
          } catch (e) {
          }
        }
      }
      const endCb = this._onFlowEnd;
      if (this._currentFlow) {
        this._currentFlow.steps.forEach((step) => {
          this.removeStepVisualUX(step);
        });
      }
      if (this._currentFlow) {
        this._currentFlow.steps.forEach((_, idx) => {
          this.cleanupCurrentStep(idx);
        });
      } else {
        this.cleanupCurrentStep();
      }
      this.cleanupAllTimers();
      if (this._state.activeFlowId) {
        this._triggerManager.resetOnceTriggersForFlow(this._state.activeFlowId);
      }
      this._pendingAnyOrderSteps = [];
      const flowDataForRestart = this._currentFlow;
      this._state = {
        activeFlowId: null,
        flowInProgress: false,
        // Not in progress, but can be restarted
        activeStep: 0,
        activeStepTriggered: false,
        activeStepTriggeredPageId: null,
        activeStepPageId: null,
        executionState: "INACTIVE",
        // 🚨 KEY: Not TERMINATED, so it can be restarted
        executionMode: this._state.executionMode,
        triggeredSteps: /* @__PURE__ */ new Set(),
        anyOrderStepInProgress: false,
        inProgressSteps: /* @__PURE__ */ new Set(),
        pendingUXResume: false,
        pendingUXResumeSteps: void 0,
        completedPageId: pageContextService.getPageId()
      };
      this._currentFlow = flowDataForRestart;
      this._completedMandatorySteps.clear();
      updateAppState({
        activeFlowId: null,
        isFlowRunning: false,
        activeStepIndex: 0
      });
      if (this._currentFlow && this._currentFlow.steps.length > 0 && this.validateFlowFrequency(this._currentFlow, true)) {
        const firstStep = this._currentFlow.steps[0];
        console.debug(`[DAP] completeFlow: Registering step 0 trigger for restart.`);
        setTimeout(() => {
          if (!this._state.flowInProgress && this._currentFlow && this._state.executionState === "INACTIVE") {
            this.executeStepWithTrigger(firstStep, 0);
          }
        }, 0);
      }
      this._onFlowEnd = endCb;
      endCb?.(flowId, "completed");
      console.debug(`[DAP] \u{1F389} Flow completion sequence finished for ${flowId}`);
      console.debug(
        `[DAP] \u{1F504} Flow ${flowId} preserved for element-based restart. Will automatically restart from step 0 when first step element becomes visible on different tab/area.`
      );
    }
    /**
     * 🚨 CRITICAL FIX: Mark flow as completed in tracking system
     * This ensures OneTime flows are properly tracked and blocked on subsequent runs
     */
    markFlowCompleted(flowData) {
      const flowId = flowData.flowId;
      console.debug(`[DAP] \u{1F3AF} Marking flow ${flowId} as completed`);
      const previewMode = detectPreviewMode();
      if (!previewMode.isPreviewMode) {
        try {
          sessionStorage.setItem(`dap_flow_completed_session_${flowId}`, "true");
          console.debug(`[DAP] \u2705 Flow ${flowId} marked as completed in this session cycle`);
        } catch (error) {
          console.error(`[DAP] Failed to set session completion key for flow ${flowId}:`, error);
        }
      }
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
    cleanupCurrentStep(stepIndex) {
      if (this._state.executionMode === "AnyOrder" && this._currentFlow) {
        this._currentFlow.steps.forEach((step, index) => {
          if (!this._state.triggeredSteps.has(index)) {
            this._triggerManager.removeTriggerListeners(step.stepId);
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
      const targetIndex = stepIndex !== void 0 ? stepIndex : this._state.activeStep;
      if (this._currentFlow && targetIndex >= 0 && targetIndex < this._currentFlow.steps.length) {
        const currentStep = this._currentFlow.steps[targetIndex];
        if (currentStep) {
          this._triggerManager.unregisterTrigger(currentStep.stepId);
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
          const deferCleanup = this._stepTriggerListeners.get(`${currentStep.stepId}_defer`);
          if (deferCleanup) {
            deferCleanup();
            this._stepTriggerListeners.delete(`${currentStep.stepId}_defer`);
          }
          this.clearRuleEvaluationTimers(currentStep.stepId);
          this.clearInputStabilityTimers(currentStep.stepId);
          this._state.inProgressSteps.delete(targetIndex);
          this.removeStepVisualUX(currentStep);
        }
      }
      if (this._currentFlow && targetIndex >= 0 && targetIndex < this._currentFlow.steps.length) {
        const currentStep = this._currentFlow.steps[targetIndex];
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
          this._triggerManager.unregisterTrigger(previousStep.stepId);
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
     * Remove any visual UX elements for a specific step from the DOM
     */
    removeStepVisualUX(step) {
      const stepId = step.stepId;
      const targetIds = [
        `dap-tooltip-${stepId}`,
        `dap-tooltip-step-${stepId}`,
        `dap-popover-${stepId}`,
        `dap-popover-step-${stepId}`,
        `dap-beacon-${stepId}`,
        `dap-beacon-step-${stepId}`,
        `dap-microsurvey-${stepId}`,
        `dap-microsurvey-step-${stepId}`,
        `dap-modal-overlay-${stepId}`,
        `dap-modal-overlay-step-${stepId}`,
        `dap-banner-wrap-${stepId}`,
        `dap-banner-wrap-step-${stepId}`
      ];
      targetIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
      const rootHost = document.querySelector("dap-root");
      if (rootHost && rootHost.shadowRoot) {
        const el = rootHost.shadowRoot.getElementById(`dap-survey-overlay-${stepId}`) || rootHost.shadowRoot.getElementById(`dap-survey-overlay-step-${stepId}`);
        if (el) el.remove();
      }
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
      console.debug(`[DAP] Destroying FlowEngine for flow: ${this._state.activeFlowId}`);
      if (this._currentFlow) {
        this._currentFlow.steps.forEach((_, idx) => {
          this.cleanupCurrentStep(idx);
        });
      } else {
        this.cleanupCurrentStep();
      }
      this._domObservers.forEach((observer) => {
        observer.disconnect();
      });
      this._domObservers.clear();
      this._stepTriggerListeners.forEach((cleanup) => {
        if (typeof cleanup === "function") cleanup();
      });
      this._stepTriggerListeners.clear();
      this.cleanupAllTimers();
      if (this._pageContextUnsubscribe) {
        this._pageContextUnsubscribe();
        this._pageContextUnsubscribe = null;
      }
      if (this._boundGlobalClickHandler) {
        document.removeEventListener("click", this._boundGlobalClickHandler, true);
        this._boundGlobalClickHandler = null;
      }
      this._state = {
        activeFlowId: null,
        flowInProgress: false,
        activeStep: 0,
        activeStepTriggered: false,
        activeStepTriggeredPageId: null,
        activeStepPageId: null,
        executionState: "TERMINATED",
        executionMode: "Linear",
        triggeredSteps: /* @__PURE__ */ new Set(),
        runCounted: false,
        anyOrderStepInProgress: false,
        inProgressSteps: /* @__PURE__ */ new Set(),
        pendingUXResume: false,
        pendingUXResumeSteps: void 0,
        completedPageId: null
      };
      this._currentFlow = null;
      this._completedMandatorySteps.clear();
      this._triggerManager.destroy();
      if (_FlowEngine._instance === this) {
        pageContextService.destroy();
      }
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
    /**
     * Global click listener to support manual step skipping/fast-forwarding in Linear flow.
     * If the user clicks on the target element of a subsequent step in the flow,
     * we close the current step and any intermediate steps, and jump immediately to the clicked step.
     */
    handleGlobalClick(event) {
      if (!this._state.flowInProgress || !this._currentFlow) return;
      if (this._state.executionMode !== "Linear") return;
      const clickedEl = event.target;
      if (!clickedEl) return;
      if (clickedEl.closest("dap-root") || clickedEl.closest('[id^="dap-tooltip"]') || clickedEl.closest('[id^="dap-popover"]') || clickedEl.closest('[id^="dap-beacon"]') || clickedEl.closest('[id^="dap-microsurvey"]') || clickedEl.closest('[id^="dap-modal-overlay"]') || clickedEl.closest('[id^="dap-banner-wrap"]')) {
        return;
      }
      const startIndex = this._state.activeStep;
      if (startIndex >= this._currentFlow.steps.length) return;
      for (let i = startIndex + 1; i < this._currentFlow.steps.length; i++) {
        const step = this._currentFlow.steps[i];
        const pageSelector = this.resolveStepPageSelector(step);
        if (!pageSelector) continue;
        const targetEl = resolveSelectorWithCache(this.getPageSelectorCacheKey(step), pageSelector);
        if (targetEl && targetEl.contains(clickedEl)) {
          console.debug(`[DAP] Linear skip: User clicked subsequent step ${i} target element.`);
          this.cleanupCurrentStep();
          for (let skippedIdx = startIndex; skippedIdx < i; skippedIdx++) {
            this._state.triggeredSteps.add(skippedIdx);
            const skippedStep = this._currentFlow.steps[skippedIdx];
            if (skippedStep) {
              this._state.inProgressSteps.delete(skippedIdx);
              this.cleanupCurrentStep(skippedIdx);
              this.removeStepVisualUX(skippedStep);
            }
          }
          this._state.activeStep = i;
          this._state.activeStepTriggered = false;
          this._state.activeStepTriggeredPageId = null;
          this._state.pendingUXResume = false;
          this._state.anyOrderStepInProgress = false;
          this.saveFlowProgress();
          this.executeStep();
          break;
        }
      }
    }
  };
  var flowEngine = FlowEngine.getInstance();

  // src/core/multiFlowOrchestrator.ts
  var MultiFlowOrchestrator = class _MultiFlowOrchestrator {
    constructor() {
      /** One entry per registered flow. */
      this._flows = /* @__PURE__ */ new Map();
      /** Unsubscribe handle for the orchestrator-level page-change listener. */
      this._pageUnsub = null;
      this._pageUnsub = pageContextService.subscribe(
        this._handlePageChange.bind(this)
      );
    }
    static getInstance() {
      if (!this._instance) {
        this._instance = new _MultiFlowOrchestrator();
      }
      return this._instance;
    }
    // ── Public API ─────────────────────────────────────────────────────────────
    /**
     * Start a single flow concurrently alongside all currently running flows.
     *
     * Creates a dedicated FlowEngine instance for this flow so it can manage
     * its own state, page context, and trigger lifecycle without interfering
     * with any other flow.
     *
     * If the flow is already active (status = 'loading' | 'active') this is a
     * no-op to prevent double-registration.
     */
    async startFlow(flowData) {
      const flowId = flowData.flowId;
      const existing = this._flows.get(flowId);
      if (existing && (existing.status === "loading" || existing.status === "active")) {
        console.debug(`[DAP] MultiFlowOrchestrator: Flow ${flowId} already running \u2014 skipping duplicate start`);
        return;
      }
      if (existing) {
        existing.engine.destroy();
      }
      const engine = new FlowEngine();
      const managed = {
        flowId,
        engine,
        status: "loading",
        lastActivePage: null
      };
      this._flows.set(flowId, managed);
      engine.setOnFlowStartCallback((fid) => {
        const m = this._flows.get(fid);
        if (m) {
          m.status = "active";
          console.debug(`[DAP] MultiFlowOrchestrator: Flow ${fid} started/restarted, status \u2192 active`);
        }
      });
      engine.setOnFlowActiveCallback((fid) => {
        if (engine.getState().executionMode === "Linear") {
          for (const [otherId, otherFlow] of this._flows.entries()) {
            if (otherId !== fid && otherFlow.status === "active" && otherFlow.engine.getState().executionMode === "Linear") {
              const otherState = otherFlow.engine.getState();
              if (otherState.flowInProgress && (otherState.triggeredSteps.size > 0 || otherState.activeStepTriggered || otherState.inProgressSteps.size > 0)) {
                console.debug(`[DAP] MultiFlowOrchestrator: Aborting concurrent Linear flow ${otherId} due to activity on ${fid}`);
                otherFlow.engine.abortFlow();
              }
            }
          }
        }
      });
      engine.setOnFlowEndCallback((fid, reason) => {
        const m = this._flows.get(fid);
        if (m) {
          m.status = reason === "frequency_blocked" || reason === "user_context_blocked" ? "blocked" : "completed";
          console.debug(`[DAP] MultiFlowOrchestrator: Flow ${fid} ended (${reason}), status \u2192 ${m.status}`);
        }
      });
      managed.status = "active";
      await engine.startFlow(flowData);
    }
    /**
     * Start multiple flows simultaneously.
     *
     * All flows in the list are started concurrently.  Each flow executes
     * independently on the pages where its steps' elements are present.
     */
    async startFlows(flowDataList) {
      await Promise.all(flowDataList.map((fd) => this.startFlow(fd)));
    }
    // ── Diagnostics ────────────────────────────────────────────────────────────
    /**
     * Return a snapshot of all managed flows (for debugging).
     */
    getManagedFlows() {
      const result = /* @__PURE__ */ new Map();
      for (const [id, m] of this._flows) {
        result.set(id, {
          flowId: m.flowId,
          status: m.status,
          lastActivePage: m.lastActivePage,
          engineState: m.engine.getState()
        });
      }
      return result;
    }
    /**
     * Get IDs of flows that are currently in-progress (flowInProgress = true).
     * Useful for debugging which flows are "active" on the current page.
     */
    getActiveFlowIds() {
      const active = [];
      for (const [id, m] of this._flows) {
        if (m.status === "active" && m.engine.getState().flowInProgress) {
          active.push(id);
        }
      }
      return active;
    }
    /**
     * Abort and remove all managed flows.  Intended for SDK reset / teardown.
     */
    clearAll() {
      for (const m of this._flows.values()) {
        m.engine.destroy();
      }
      this._flows.clear();
      if (this._pageUnsub) {
        this._pageUnsub();
        this._pageUnsub = null;
      }
      console.debug("[DAP] MultiFlowOrchestrator: All flows cleared");
    }
    // ── Private ────────────────────────────────────────────────────────────────
    /**
     * Orchestrator-level page-change handler.
     *
     * This handler exists for diagnostics and tracking only.  The actual
     * pause/resume behaviour is handled by each FlowEngine's own
     * pageContextService subscription (which applies the targetUrls URL gate
     * and calls _pauseForPageChange / reRegisterActiveStepTriggers).
     */
    _handlePageChange(event) {
      const newPage = event.current.pathname;
      for (const m of this._flows.values()) {
        if (m.status !== "active") continue;
        if (m.lastActivePage !== newPage) {
          console.debug(
            `[DAP] MultiFlowOrchestrator: Flow "${m.flowId}" page transition ${m.lastActivePage ?? "(initial)"} \u2192 ${newPage}`
          );
          m.lastActivePage = newPage;
        }
      }
    }
  };
  var multiFlowOrchestrator = MultiFlowOrchestrator.getInstance();

  // src/utils/themedetector.ts
  var DEFAULT_WATCH_DEBOUNCE_MS = 250;
  var DEFAULT_MIN_CONTRAST_TEXT = 4.5;
  var hostThemeObserver = null;
  var hostThemeWatchTimer = null;
  var lastAppliedThemeKey = null;
  var FALLBACK_SKY_FULL = "#0EA5E9";
  var FALLBACK_SKY_DARK = "#0284C7";
  var FALLBACK_SKY_LIGHT = "#E0F7FF";
  var FALLBACK_SKY_MID = "#BAF0FF";
  var FALLBACK_SKY_SOFT = "rgba(14, 165, 233, 0.55)";
  var FALLBACK_SKY_BORDER = "rgba(14, 165, 233, 0.30)";
  function clamp(n, a = 0, b = 255) {
    return Math.max(a, Math.min(b, Math.round(n)));
  }
  function hslToRgb(h, s, l) {
    h = h % 360;
    if (h < 0) h += 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(h / 60 % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      g = 0;
      b = c;
    } else {
      r = c;
      g = 0;
      b = x;
    }
    return [clamp((r + m) * 255), clamp((g + m) * 255), clamp((b + m) * 255)];
  }
  function normalizeColorString(raw) {
    const s = raw.trim();
    if (/^[\d.]+(?:deg|turn|rad|grad)?\s+[\d.]+%\s+[\d.]+%/.test(s)) {
      return `hsl(${s})`;
    }
    return s;
  }
  function parseColorToRgb(colorStr) {
    if (!colorStr) return null;
    const raw = colorStr.trim();
    if (!raw || raw === "transparent" || raw === "none") return null;
    const s = normalizeColorString(raw);
    const hslComma = s.match(/^hsla?\(\s*([\d.]+)(?:deg|turn|rad|grad)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*[\d.]+)?\s*\)$/i);
    if (hslComma) {
      return hslToRgb(parseFloat(hslComma[1]), parseFloat(hslComma[2]) / 100, parseFloat(hslComma[3]) / 100);
    }
    const hslSpace = s.match(/^hsla?\(\s*([\d.]+)(?:deg|turn|rad|grad)?\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*[\d.%]+)?\s*\)$/i);
    if (hslSpace) {
      return hslToRgb(parseFloat(hslSpace[1]), parseFloat(hslSpace[2]) / 100, parseFloat(hslSpace[3]) / 100);
    }
    const rgbComma = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/i);
    if (rgbComma) {
      return [clamp(parseFloat(rgbComma[1])), clamp(parseFloat(rgbComma[2])), clamp(parseFloat(rgbComma[3]))];
    }
    const rgbSpace = s.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.%]+)?\s*\)$/i);
    if (rgbSpace) {
      return [clamp(parseFloat(rgbSpace[1])), clamp(parseFloat(rgbSpace[2])), clamp(parseFloat(rgbSpace[3]))];
    }
    const hex = s.match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
      const h = hex[1];
      if (h.length === 3 || h.length === 4) {
        return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
      }
      if (h.length === 6 || h.length === 8) {
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      }
    }
    if (!document.body) return null;
    try {
      const el = document.createElement("div");
      el.style.color = s;
      el.style.display = "none";
      document.body.appendChild(el);
      const computed = window.getComputedStyle(el).color;
      document.body.removeChild(el);
      if (!computed || computed === "transparent") return null;
      const m = computed.match(/rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/);
      if (m) return [clamp(parseFloat(m[1])), clamp(parseFloat(m[2])), clamp(parseFloat(m[3]))];
    } catch {
    }
    return null;
  }
  function rgbToHex([r, g, b]) {
    const toHex = (v) => clamp(v).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  function detectHostBackground() {
    try {
      const el = document.body || document.documentElement;
      const styles = window.getComputedStyle(el);
      if (styles.backgroundImage && styles.backgroundImage !== "none") return styles.backgroundImage;
      if (styles.background && styles.background !== "none") return styles.background;
      if (styles.backgroundColor && styles.backgroundColor !== "transparent") return styles.backgroundColor;
    } catch {
    }
    return "#F8FAFC";
  }
  function backgroundToRgb(bg) {
    if (!bg || !document.body) return null;
    const direct = parseColorToRgb(bg);
    if (direct) return direct;
    try {
      const el = document.createElement("div");
      el.style.position = "absolute";
      el.style.visibility = "hidden";
      el.style.pointerEvents = "none";
      el.style.zIndex = "-1";
      el.style.background = bg;
      document.body.appendChild(el);
      const computed = window.getComputedStyle(el).backgroundColor;
      document.body.removeChild(el);
      if (!computed || computed === "transparent") return null;
      const nums = computed.match(/[\d.]+/g)?.map(Number);
      if (!nums || nums.length < 3) return null;
      return [clamp(nums[0]), clamp(nums[1]), clamp(nums[2])];
    } catch {
      return null;
    }
  }
  function getBrightness(r, g, b) {
    return (r * 299 + g * 587 + b * 114) / 1e3;
  }
  function getSoftHostBackground(bg) {
    const rgb = backgroundToRgb(bg);
    if (!rgb) return bg;
    const [r, g, b] = rgb;
    const brightness = getBrightness(r, g, b);
    const ratio = brightness > 150 ? 0.75 : 0.28;
    return `rgba(${clamp(r * (1 - ratio) + 255 * ratio)}, ${clamp(g * (1 - ratio) + 255 * ratio)}, ${clamp(b * (1 - ratio) + 255 * ratio)}, 0.9)`;
  }
  function getHostBackgroundMode(bg) {
    const rgb = backgroundToRgb(bg);
    if (!rgb) return "dark";
    return getBrightness(rgb[0], rgb[1], rgb[2]) > 150 ? "light" : "dark";
  }
  function detectHostThemeContext() {
    const background = detectHostBackground();
    return {
      background,
      softBackground: getSoftHostBackground(background),
      mode: getHostBackgroundMode(background)
    };
  }
  function isTooNeutral(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const range = max - min;
    const l = (max + min) / 2 / 255;
    if (l > 0.98 || l < 0.02) return true;
    if (range < 5) return true;
    return false;
  }
  function resolveCssVarToColor(val) {
    if (!val) return null;
    const s = val.trim();
    if (!s) return null;
    if (/^(#|rgb|hsl|hwb|lab|lch|oklch|color\()/i.test(s)) return s;
    if (/^\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*$/.test(s)) {
      return `rgb(${s})`;
    }
    if (/^[\d.]+(?:deg|turn|rad|grad)?\s+[\d.]+%\s+[\d.]+%/.test(s)) {
      return `hsl(${s})`;
    }
    if (/^[a-z]+$/i.test(s)) return s;
    return s;
  }
  function detectHostBrandColor() {
    if (typeof window === "undefined" || !document || !document.body) return null;
    function bgOf(selector) {
      try {
        const el = document.querySelector(selector);
        if (!el) return null;
        let currentEl = el;
        for (let i = 0; i < 3 && currentEl; i++) {
          const bg = window.getComputedStyle(currentEl).backgroundColor;
          const rgb = parseColorToRgb(bg);
          if (rgb && !isTooNeutral(...rgb)) return rgb;
          currentEl = currentEl.parentElement;
        }
        return null;
      } catch {
        return null;
      }
    }
    function colorOf(selector) {
      try {
        const el = document.querySelector(selector);
        if (!el) return null;
        const color = window.getComputedStyle(el).color;
        const rgb = parseColorToRgb(color);
        return rgb && !isTooNeutral(...rgb) ? rgb : null;
      } catch {
        return null;
      }
    }
    function svgFillOf(selector) {
      try {
        const el = document.querySelector(selector);
        if (!el) return null;
        const target = el.tagName.toLowerCase() === "svg" ? el.querySelector("path") || el : el;
        const styles = window.getComputedStyle(target);
        const fill = styles.fill || target.getAttribute("fill") || "";
        const rgb = parseColorToRgb(fill);
        return rgb && !isTooNeutral(...rgb) ? rgb : null;
      } catch {
        return null;
      }
    }
    const svgLogoSelectors = [
      "header svg",
      "nav svg",
      ".logo svg",
      "#logo svg",
      "[class*='logo'] svg",
      "[class*='brand'] svg",
      "header svg path",
      "header svg circle",
      "header svg rect",
      ".logo path",
      ".logo circle"
    ];
    for (const sel of svgLogoSelectors) {
      const result = svgFillOf(sel);
      if (result) return result;
    }
    try {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        const rgb = parseColorToRgb(meta.getAttribute("content"));
        if (rgb && !isTooNeutral(...rgb)) return rgb;
      }
    } catch {
    }
    try {
      const rootStyles = window.getComputedStyle(document.documentElement);
      const cssVars = [
        "--primary",
        "--primary-color",
        "--color-primary",
        "--bs-primary",
        "--bs-primary-rgb",
        "--ion-color-primary",
        "--ion-color-primary-rgb",
        "--md-sys-color-primary",
        "--md-sys-color-primary-container",
        "--chakra-colors-primary",
        "--chakra-colors-blue-500",
        "--mantine-primary-color",
        "--mantine-color-blue-6",
        "--brand-color",
        "--brand",
        "--color-brand",
        "--color-brand-primary",
        "--accent",
        "--accent-color",
        "--color-accent",
        "--accent-primary",
        "--theme-color",
        "--app-color",
        "--app-primary",
        "--main-color",
        "--blue-600",
        "--indigo-600",
        "--purple-600",
        "--pink-600",
        "--red-600",
        "--orange-600",
        "--amber-600",
        "--yellow-600",
        "--lime-600",
        "--green-600",
        "--emerald-600",
        "--teal-600",
        "--cyan-600",
        "--sky-600",
        "--slate-600"
      ];
      for (const v of cssVars) {
        const rawVal = rootStyles.getPropertyValue(v).trim();
        if (!rawVal) continue;
        const resolved = resolveCssVarToColor(rawVal);
        if (!resolved) continue;
        const rgb = parseColorToRgb(resolved);
        if (rgb && !isTooNeutral(...rgb)) return rgb;
      }
      const bodyStyles = window.getComputedStyle(document.body);
      for (const v of cssVars) {
        const rawVal = bodyStyles.getPropertyValue(v).trim();
        if (!rawVal) continue;
        const resolved = resolveCssVarToColor(rawVal);
        if (!resolved) continue;
        const rgb = parseColorToRgb(resolved);
        if (rgb && !isTooNeutral(...rgb)) return rgb;
      }
    } catch {
    }
    const navbarSelectors = [
      "header",
      "nav",
      "[role='banner']",
      "[role='navigation']",
      ".navbar",
      ".nav-bar",
      ".top-nav",
      ".top-bar",
      ".app-header",
      ".site-header",
      ".header",
      ".Header",
      "#header",
      "#navbar",
      "#top-bar",
      "[class*='navbar']",
      "[class*='nav-bar']",
      "[class*='app-header']",
      "[class*='site-header']",
      "[class*='topbar']",
      "[class*='top-nav']"
    ];
    for (const sel of navbarSelectors) {
      const result = bgOf(sel);
      if (result) return result;
    }
    const sidebarActiveSelectors = [
      "[class*='sidebar'] [class*='active']",
      "[class*='sidebar'] [class*='selected']",
      "[class*='sidebar'] [aria-current='page']",
      "[class*='sidenav'] [class*='active']",
      "aside [class*='active']",
      "aside [aria-current='page']",
      ".nav-item.active",
      ".nav-link.active",
      "[class*='nav-item'][class*='active']",
      ".sidebar .active",
      ".menu .active",
      "[role='menu'] [aria-selected='true']",
      "[role='navigation'] [aria-selected='true']",
      "[role='navigation'] [aria-current='page']",
      ".ant-menu-item-selected",
      ".ant-menu-submenu-selected",
      ".Mui-selected",
      ".MuiListItemButton-root.Mui-selected"
    ];
    for (const sel of sidebarActiveSelectors) {
      const result = bgOf(sel);
      if (result) return result;
      try {
        const el = document.querySelector(sel);
        if (el) {
          const cs = window.getComputedStyle(el);
          const candidates = [
            cs.borderLeftColor,
            cs.borderRightColor,
            cs.borderTopColor,
            cs.borderBottomColor,
            cs.outlineColor
          ];
          for (const c of candidates) {
            const rgb = parseColorToRgb(c);
            if (rgb && !isTooNeutral(...rgb)) return rgb;
          }
        }
      } catch {
      }
    }
    const buttonSelectors = [
      "button[name='submit.add-to-cart']",
      "button._2KpZ6l",
      "[class*='btn-cart']",
      "[class*='buy-now']",
      "[class*='checkout']",
      "button[class*='primary']",
      ".btn-primary",
      ".button--primary",
      "[data-variant='primary']",
      "a[class*='btn-primary']",
      "button[class*='btn-primary']",
      "[class*='primary-button']",
      "[class*='cta']",
      "button[type='submit']",
      ".btn.btn-primary",
      ".button.button-primary"
    ];
    for (const sel of buttonSelectors) {
      const result = bgOf(sel);
      if (result) return result;
    }
    const activeNavSelectors = [
      "nav a.active",
      "nav [aria-current='page']",
      "[class*='nav'] a.active",
      "[class*='tab'][class*='active']",
      "[class*='tab'][aria-selected='true']",
      ".nav-item.active a",
      "[class*='menu-item'][class*='active']"
    ];
    for (const sel of activeNavSelectors) {
      const result = colorOf(sel);
      if (result) return result;
    }
    const accentSelectors = [
      "[class*='accent']",
      "[class*='highlight']",
      "[data-theme]",
      "[class*='brand']"
    ];
    for (const sel of accentSelectors) {
      const result = bgOf(sel);
      if (result) return result;
    }
    try {
      const link = document.querySelector("a");
      if (link) {
        const color = window.getComputedStyle(link).color;
        const rgb = parseColorToRgb(color);
        if (rgb && !isTooNeutral(...rgb)) return rgb;
      }
    } catch {
    }
    try {
      const candidates = Array.from(document.querySelectorAll(
        "button, [role='button'], input[type='button'], input[type='submit'], a"
      )).slice(0, 250);
      let best = null;
      for (const el of candidates) {
        const cs = window.getComputedStyle(el);
        const bg = cs.backgroundColor;
        const rgb = parseColorToRgb(bg);
        if (!rgb || isTooNeutral(...rgb)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 44 || rect.height < 24) continue;
        if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) continue;
        const max = Math.max(rgb[0], rgb[1], rgb[2]);
        const min = Math.min(rgb[0], rgb[1], rgb[2]);
        const range = max - min;
        const l = (max + min) / 2 / 255;
        const saturation = max === min ? 0 : range / 255 / (1 - Math.abs(2 * l - 1) || 1);
        const area = Math.min(1, rect.width * rect.height / 12e3);
        const score = saturation * 0.75 + area * 0.25;
        if (!best || score > best.score) best = { rgb, score };
      }
      if (best) return best.rgb;
    } catch {
    }
    return null;
  }
  function lightenRgb([r, g, b], factor) {
    return [clamp(r + (255 - r) * factor), clamp(g + (255 - g) * factor), clamp(b + (255 - b) * factor)];
  }
  function darkenRgb([r, g, b], factor) {
    return [clamp(r * (1 - factor)), clamp(g * (1 - factor)), clamp(b * (1 - factor))];
  }
  function rgbaString(rgb, alpha) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }
  function generatePalette(brandRgb, hostTheme, minContrast = DEFAULT_MIN_CONTRAST_TEXT) {
    const [r, g, b] = brandRgb;
    const primary = `rgb(${r}, ${g}, ${b})`;
    const primaryLightRgb = lightenRgb(brandRgb, 0.85);
    const primaryMidRgb = lightenRgb(brandRgb, 0.65);
    const primaryDarkRgb = darkenRgb(brandRgb, 0.18);
    const primaryDarkerRgb = darkenRgb(brandRgb, 0.32);
    const primaryLight = rgbaString(primaryLightRgb, 0.12);
    const primaryMid = rgbToHex(primaryMidRgb);
    const primarySoft = rgbaString(brandRgb, 0.16);
    const primaryGlow = rgbaString(brandRgb, 0.24);
    const primaryDark = rgbToHex(primaryDarkRgb);
    const primaryDarker = rgbToHex(primaryDarkerRgb);
    const focusRing = rgbaString(brandRgb, 0.26);
    const gradientEnd = rgbToHex(lightenRgb(brandRgb, 0.12));
    const gradient = `linear-gradient(135deg, ${primary} 0%, ${gradientEnd} 100%)`;
    const surface = rgbToHex(lightenRgb(brandRgb, 0.95));
    const surfaceAlt = rgbToHex(lightenRgb(brandRgb, 0.9));
    const surfaceHover = rgbToHex(lightenRgb(brandRgb, 0.84));
    const primaryTintBg = surface;
    const primaryTintBgAlt = surfaceAlt;
    const primaryTintBgBeacon = rgbaString(brandRgb, 0.55);
    const borderStrong = rgbaString(brandRgb, 0.28);
    const shadowBase = hostTheme.mode === "dark" ? rgbaString([0, 0, 0], 0.3) : rgbaString(brandRgb, 0.07);
    const shadowSoft = `0 20px 46px ${rgbaString(brandRgb, 0.14)}, 0 6px 18px ${shadowBase}`;
    const buttonText = "#000000";
    const ink = "#000000";
    const inkMuted = "#555555";
    const inkSubtle = "#777777";
    return {
      primary,
      primaryRgb: brandRgb,
      primaryLight,
      primaryMid,
      primarySoft,
      primaryGlow,
      primaryDark,
      primaryDarker,
      primaryTintBg,
      primaryTintBgAlt,
      primaryTintBgBeacon,
      focusRing,
      gradient,
      surface,
      surfaceAlt,
      surfaceHover,
      borderStrong,
      shadowSoft,
      buttonText,
      ink,
      inkMuted,
      inkSubtle
    };
  }
  function buildCssVariables(p, hostTheme) {
    return `
    :root,
    .dap-modal,
    .dap-modal-overlay,
    .dap-microsurvey,
    .dap-survey-modal,
    .dap-modal-wrap,
    .dap-tip-bubble,
    .dap-tooltip,
    .dap-popover,
    .dap-popover-v2,
    .dap-hotspot-container,
    .dap-hotspot,
    .dap-tasklist-modal,
    .dap-tasklist,
    .dap-walkthrough-tooltip,
    .dap-walkthrough,
    .dap-beacon,
    .dap-beacon-v2,
    .dap-checklist,
    .dap-nps,
    .dap-announcement {

      /* \u2500\u2500 PRIMARY BRAND COLOR \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-primary:          ${p.primary} !important;
      --dap-primary-rgb:      ${p.primaryRgb.join(",")} !important;

      /* \u2500\u2500 PRIMARY SCALE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-primary-light:    ${p.primaryLight} !important;
      --dap-primary-mid:      ${p.primaryMid} !important;
      --dap-primary-soft:     ${p.primarySoft} !important;
      --dap-primary-glow:     ${p.primaryGlow} !important;
      --dap-primary-dark:     ${p.primaryDark} !important;
      --dap-primary-darker:   ${p.primaryDarker} !important;
      --dap-primary-2:        ${p.primaryLight} !important;

      /* \u2500\u2500 TINT BACKGROUND TOKENS (NEW) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
       * Used by tooltip, popover, modal, survey for their card backgrounds.
       * --dap-tint-bg         lighten(brand,95%) solid hex  \u2014 lightest card fill
       * --dap-tint-bg-alt     lighten(brand,90%) solid hex  \u2014 header/footer fill
       * --dap-tint-bg-beacon  rgba(brand,0.55) \u2014 beacon solid fill (NOT transparent)
       *
       * Fallbacks:
       * --dap-tint-bg         #E0F7FF  (sky blue light tint)
       * --dap-tint-bg-alt     #BAF0FF  (sky blue medium tint)
       * --dap-tint-bg-beacon  rgba(14,165,233,0.55) sky blue solid
       * \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-tint-bg:          ${p.primaryTintBg} !important;
      --dap-tint-bg-alt:      ${p.primaryTintBgAlt} !important;
      --dap-tint-bg-beacon:   ${p.primaryTintBgBeacon} !important;

      /* \u2500\u2500 ACCENT \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-accent:           ${p.primary} !important;
      --dap-accent-soft:      ${p.primarySoft} !important;

      /* \u2500\u2500 SURFACES (aliases of tint tokens) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-surface:          ${p.surface} !important;
      --dap-surface-alt:      ${p.surfaceAlt} !important;
      --dap-surface-hover:    ${p.surfaceHover} !important;

      /* \u2500\u2500 SDK BACKGROUND ALIASES \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --sdk-background:       ${p.surface} !important;
      --sdk-background-soft:  ${p.primarySoft} !important;
      --sdk-background-alt:   ${p.surfaceAlt} !important;
      --sdk-background-hover: ${p.surfaceHover} !important;

      /* \u2500\u2500 BORDERS & RINGS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-border:           var(--dap-primary, ${p.primary}) !important;
      --dap-border-fallback:  #334155 !important;
      --dap-border-strong:    ${p.borderStrong} !important;
      --dap-focus-ring:       ${p.focusRing} !important;

      /* \u2500\u2500 GLASS (opaque card tokens) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-glass-blur:       none !important;
      --dap-glass-bg:         ${p.primaryTintBg} !important;
      --dap-glass-border:     1.5px solid var(--dap-primary) !important;
      --dap-glass-shadow:     0 8px 32px ${rgbaString(p.primaryRgb, 0.1)}, 0 2px 8px ${rgbaString(p.primaryRgb, 0.06)} !important;

      /* \u2500\u2500 SHADOWS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-shadow-soft:      ${p.shadowSoft} !important;
      --dap-shadow:           ${p.shadowSoft} !important;

      /* \u2500\u2500 OVERLAYS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-overlay:          rgba(${p.primaryRgb.join(",")}, 0.16) !important;
      --dap-backdrop-bg:      rgba(${p.primaryRgb.join(",")}, 0.14) !important;
      --dap-overlay-blur:     blur(12px) saturate(140%) !important;

      /* \u2500\u2500 GRADIENT \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-gradient:         ${p.gradient} !important;

      /* \u2500\u2500 HOST CONTEXT \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-host-bg:          ${hostTheme.background} !important;
      --dap-host-bg-soft:     ${hostTheme.softBackground} !important;
      --dap-host-mode:        ${hostTheme.mode} !important;

      /* \u2500\u2500 BUTTON TOKENS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-button-text:      #000000 !important;
      --dap-btn-bg:           ${p.primary} !important;
      --dap-btn-bg-mid:       ${p.primaryMid} !important;
      --dap-btn-bg-soft:      ${p.primarySoft} !important;
      --dap-btn-text:         #000000 !important;

      /* \u2500\u2500 TOOLTIP / TIP BUBBLE TOKENS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      /* NEW: bg uses tint token, border uses full primary     */
      --dap-tip-bg:           ${p.primaryTintBg} !important;
      --dap-tip-fg:           #000000 !important;
      --dap-tip-border:       ${p.primary} !important;

      /* \u2500\u2500 MODAL TOKENS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      /* NEW: modal bg uses tint token                         */
      --dap-modal-bg:         ${p.primaryTintBg} !important;
      --dap-modal-fg:         #000000 !important;
      --dap-close-icon-bg:    ${p.primaryLight} !important;
      --dap-close-icon-fg:    #000000 !important;

      /* \u2500\u2500 POPOVER TOKENS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-popover-border:           ${p.primary} !important;
      --dap-popover-border-brand:     ${p.primary} !important;

      /* \u2500\u2500 HIGHLIGHT \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-highlight-color:  ${p.primarySoft} !important;
      --dap-highlight-outline:${p.focusRing} !important;

      /* \u2500\u2500 INK (TEXT \u2014 always black) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
      --dap-ink:              #000000 !important;
      --dap-ink-muted:        #555555 !important;
      --dap-ink-subtle:       #777777 !important;
    }

    /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
       TOOLTIP \u2014 brand border + light tint bg
       Fallback: sky blue border #0EA5E9, light sky tint bg #E0F7FF
       \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
    .dap-tooltip,
    .dap-tip-bubble {
      background: var(--dap-tint-bg, ${FALLBACK_SKY_LIGHT}) !important;
      border: 1px solid var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
    }

    /* Arrow inherits tint bg + brand border */
    .dap-tooltip .dap-tooltip-arrow,
    .dap-tip-bubble .dap-tooltip-arrow {
      background: var(--dap-tint-bg, ${FALLBACK_SKY_LIGHT}) !important;
      border-color: var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
    }

    /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
       POPOVER \u2014 brand border + light tint bg
       Fallback: sky blue border #0EA5E9, light sky tint bg #E0F7FF
       \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
    .dap-popover-v2 {
      background: var(--dap-tint-bg, ${FALLBACK_SKY_LIGHT}) !important;
      border: 1px solid var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
    }

    /* Arrow inherits tint bg + brand border */
    .dap-popover-v2 .dap-popover-arrow-v2 {
      background: var(--dap-tint-bg, ${FALLBACK_SKY_LIGHT}) !important;
      border-color: var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
    }

    /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
       BEACON \u2014 solid brand fill + brand border
       At 0.55 alpha the card reads as a clearly colored surface, not a ghost.
       On very saturated brands this will look bold \u2014 intentional per spec.
       Text color is forced white when bg is dark enough (handled via CSS mix).
       Fallback: rgba(14,165,233,0.55) sky blue solid fill, #0EA5E9 border
       \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
    .dap-beacon-v2 {
      background: var(--dap-tint-bg-beacon, ${FALLBACK_SKY_SOFT}) !important;
      border: 1.5px solid var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
      /* Stronger shadow to match the more opaque fill */
      box-shadow: 0 8px 28px var(--dap-primary-glow, rgba(14, 165, 233, 0.32)),
                  0 2px 8px rgba(0, 0, 0, 0.10) !important;
      /* Text needs to stay readable on the more intense background */
      color: #000000 !important;
    }

    /* Beacon title and body \u2014 black text kept for readability on light tints.
       On very dark brand colors the 0.55 fill may be dark \u2014 still readable
       because the brand's own lightenRgb(95%) tint is always near-white. */
    .dap-beacon-v2 .dap-beacon-title,
    .dap-beacon-v2 .dap-beacon-body {
      color: #000000 !important;
    }

    /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
       MODAL \u2014 light tint bg + brand border + brand buttons
       Fallback: #E0F7FF bg, #0EA5E9 border, #0EA5E9 buttons
       \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
    .dap-modal {
      background: var(--dap-tint-bg, ${FALLBACK_SKY_LIGHT}) !important;
      border: 1px solid var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
    }

    /* Modal header: slightly deeper brand tint gradient */
    .dap-modal > .dap-modal-header {
      background: linear-gradient(
        180deg,
        var(--dap-tint-bg-alt, ${FALLBACK_SKY_MID}) 0%,
        var(--dap-tint-bg, ${FALLBACK_SKY_LIGHT}) 100%
      ) !important;
      border-bottom: 1px solid var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
    }

    /* Modal footer: match alt tint */
    .dap-modal > .dap-modal-footer {
      background: var(--dap-tint-bg-alt, ${FALLBACK_SKY_MID}) !important;
      border-top: 1px solid var(--dap-border-strong, ${FALLBACK_SKY_BORDER}) !important;
    }

    /* Modal overlay backdrop \u2014 frosted glass blur (matches survey backdrop) */
    .dap-modal-overlay {
      background: var(--dap-backdrop-bg, rgba(14, 165, 233, 0.18)) !important;
      backdrop-filter: blur(20px) saturate(160%) !important;
      -webkit-backdrop-filter: blur(20px) saturate(160%) !important;
    }

    /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
       SURVEY (modal + micro) \u2014 light tint bg + brand border + brand buttons
       Fallback: #E0F7FF bg, #BAF0FF header, #0EA5E9 border and buttons
       \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
    .dap-survey-modal {
      background: var(--dap-tint-bg, ${FALLBACK_SKY_LIGHT}) !important;
      border: 1px solid var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
      color: #000000 !important;
    }

    .dap-survey-modal .dap-header-bar {
      background: linear-gradient(
        180deg,
        var(--dap-tint-bg-alt, ${FALLBACK_SKY_MID}) 0%,
        var(--dap-tint-bg, ${FALLBACK_SKY_LIGHT}) 100%
      ) !important;
      border-bottom: 1px solid var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
    }

    .dap-survey-modal .dap-footer {
      background: var(--dap-tint-bg-alt, ${FALLBACK_SKY_MID}) !important;
      border-top: 1px solid var(--dap-border-strong, ${FALLBACK_SKY_BORDER}) !important;
    }

    /* Micro survey card */
    .dap-microsurvey {
      background: var(--dap-tint-bg, ${FALLBACK_SKY_LIGHT}) !important;
      border: 1px solid var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
      color: #000000 !important;
    }

    /* Survey modal overlay \u2014 frosted glass blur matching modal backdrop (image 2 ref)
       Same blur intensity as .dap-modal-overlay for visual consistency */
    .dap-modal-wrap {
      background: rgba(${p.primaryRgb.join(",")}, 0.18) !important;
      backdrop-filter: blur(20px) saturate(160%) !important;
      -webkit-backdrop-filter: blur(20px) saturate(160%) !important;
    }

    /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
       BUTTONS \u2014 full primary color bg, black text
       Fallback: #0EA5E9 bg, #000000 text, #0284C7 hover
       \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
    .dap-cta,
    .dap-action-btn.dap-primary-btn,
    .dap-primary-btn,
    .dap-modal-button.primary,
    .dap-tasklist-btn.primary,
    .dap-walkthrough-btn.primary,
    .dap-beacon-btn {
      background: var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
      border-color: var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
      color: var(--dap-button-text, #000000) !important;
      font-weight: 600 !important;
    }

    .dap-cta:hover,
    .dap-action-btn.dap-primary-btn:hover,
    .dap-primary-btn:hover,
    .dap-modal-button.primary:hover,
    .dap-tasklist-btn.primary:hover,
    .dap-walkthrough-btn.primary:hover,
    .dap-beacon-btn:hover {
      background: var(--dap-primary-dark, ${FALLBACK_SKY_DARK}) !important;
      border-color: var(--dap-primary-dark, ${FALLBACK_SKY_DARK}) !important;
      color: var(--dap-button-text, #000000) !important;
    }

    /* Secondary / outline buttons */
    .dap-action-btn.dap-secondary-btn,
    .dap-secondary-btn,
    .dap-modal-button.secondary,
    .dap-walkthrough-btn:not(.primary):not(.success) {
      background: #ffffff !important;
      border-color: var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
      color: #000000 !important;
    }

    .dap-action-btn.dap-secondary-btn:hover,
    .dap-secondary-btn:hover,
    .dap-modal-button.secondary:hover {
      background: var(--dap-tint-bg, ${FALLBACK_SKY_LIGHT}) !important;
    }

    /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
       TASK LIST \u2014 consistent with modal tint spec
       \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
    .dap-tasklist-modal {
      background: var(--dap-tint-bg, ${FALLBACK_SKY_LIGHT}) !important;
      border: 1px solid var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
      color: #000000 !important;
    }

    /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
       WALKTHROUGH TOOLTIP \u2014 consistent with tooltip tint spec
       \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
    .dap-walkthrough-tooltip {
      background: var(--dap-tint-bg, ${FALLBACK_SKY_LIGHT}) !important;
      border: 1px solid var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
    }

    /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
       SURVEY QUESTION CARDS \u2014 brand tinted
       \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
    .dap-survey-question {
      background: var(--dap-tint-bg, ${FALLBACK_SKY_LIGHT}) !important;
      border: 2px solid var(--dap-primary, ${FALLBACK_SKY_FULL}) !important;
    }

    .dap-question-input input,
    .dap-question-input textarea,
    .dap-question-input select,
    .dap-radio-wrapper,
    .dap-checkbox-wrapper {
      border: 1.5px solid var(--dap-border-strong, ${FALLBACK_SKY_BORDER}) !important;
      background: #ffffff !important;
    }

    /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
       GLOBAL TEXT ENFORCEMENT \u2014 #000000 everywhere, always
       \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
    .dap-modal-title,
    .dap-popover-v2,
    .dap-popover-title,
    .dap-popover-description,
    .dap-popover-body,
    .dap-tooltip-content,
    .dap-tooltip-header,
    .dap-tip-bubble,
    .dap-modal-header,
    .dap-modal-sub-header,
    .dap-beacon-title,
    .dap-beacon-body,
    .dap-question-label,
    .dap-star-choice-text,
    .dap-opinion-label,
    .dap-tasklist-title,
    .dap-tasklist-item-title,
    .dap-tasklist-item-description,
    .dap-tasklist-description,
    .dap-kb-article-viewer,
    .dap-kb-link-info,
    .dap-kb-document-info,
    .dap-enhanced-fallback-message,
    .dap-kb-external-btn,
    .dap-action-btn,
    .dap-content-link,
    .dap-modal-button,
    .dap-btn-text,
    .dap-hotspot-title,
    .dap-hotspot-description,
    .dap-walkthrough-title,
    .dap-walkthrough-content,
    .dap-survey-intro,
    .dap-article-title,
    .dap-article-description,
    .dap-article-content {
      color: #000000 !important;
    }
  `;
  }
  function removeExistingInjection() {
    const existing = document.getElementById("dap-adaptive-theme-vars");
    if (existing) existing.remove();
  }
  function injectCssVariablesFromPalette(p, hostTheme) {
    removeExistingInjection();
    const style = document.createElement("style");
    style.id = "dap-adaptive-theme-vars";
    style.textContent = buildCssVariables(p, hostTheme);
    document.head.appendChild(style);
    console.debug("[DAP] Adaptive theming applied. Primary:", p.primary, "Host mode:", hostTheme.mode);
  }
  function rgbToHsl([r, g, b]) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
    return [h * 360, s, l];
  }
  function deriveMutedFallbackRgb(hostTheme) {
    const SKY_BLUE = [14, 165, 233];
    const bgRgb = backgroundToRgb(hostTheme.background);
    if (bgRgb) {
      const [hue, sat] = rgbToHsl(bgRgb);
      if (sat > 0.1) {
        const mutedSat = Math.max(0.12, Math.min(0.18, sat * 0.35));
        const mutedLight = hostTheme.mode === "dark" ? 0.55 : 0.48;
        return hslToRgb(hue, mutedSat, mutedLight);
      }
    }
    return SKY_BLUE;
  }
  function fallbackPalette(hostTheme) {
    const fallbackRgb = deriveMutedFallbackRgb(hostTheme);
    return generatePalette(fallbackRgb, hostTheme, DEFAULT_MIN_CONTRAST_TEXT);
  }
  function injectFallbackVars(hostTheme) {
    const p = fallbackPalette(hostTheme);
    injectCssVariablesFromPalette(p, hostTheme);
    console.debug("[DAP] No host brand color detected. Using sky-blue fallback palette.");
  }
  function normalizeWatchDebounceMs(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_WATCH_DEBOUNCE_MS;
    return Math.max(50, Math.round(value));
  }
  function clearHostThemeWatcher() {
    if (hostThemeObserver) {
      hostThemeObserver.disconnect();
      hostThemeObserver = null;
    }
    if (hostThemeWatchTimer !== null) {
      window.clearTimeout(hostThemeWatchTimer);
      hostThemeWatchTimer = null;
    }
  }
  function startHostThemeWatcher(debounceMs) {
    if (typeof MutationObserver === "undefined" || !document.body) return;
    clearHostThemeWatcher();
    const scheduleRun = () => {
      if (hostThemeWatchTimer !== null) window.clearTimeout(hostThemeWatchTimer);
      hostThemeWatchTimer = window.setTimeout(() => {
        hostThemeWatchTimer = null;
        runAdaptiveTheming();
      }, debounceMs);
    };
    hostThemeObserver = new MutationObserver(() => scheduleRun());
    const attributesToWatch = ["class", "style", "data-theme", "data-mode", "data-color-mode"];
    hostThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: attributesToWatch });
    hostThemeObserver.observe(document.body, { attributes: true, attributeFilter: attributesToWatch });
  }
  function getAppliedThemeKey(hostTheme, brandRgb) {
    const hostPart = `${hostTheme.background}|${hostTheme.softBackground}|${hostTheme.mode}`;
    if (!brandRgb) return `fallback|${hostPart}`;
    return `brand|${brandRgb[0]},${brandRgb[1]},${brandRgb[2]}|${hostPart}`;
  }
  function runAdaptiveTheming(options = {}) {
    try {
      const hostTheme = detectHostThemeContext();
      const brandRgb = detectHostBrandColor();
      const themeKey = getAppliedThemeKey(hostTheme, brandRgb);
      const hasInjected = !!document.getElementById("dap-adaptive-theme-vars");
      if (themeKey === lastAppliedThemeKey && hasInjected) return;
      if (!brandRgb) {
        injectFallbackVars(hostTheme);
        lastAppliedThemeKey = themeKey;
        return;
      }
      const palette = generatePalette(
        brandRgb,
        hostTheme,
        options.minContrastText ?? DEFAULT_MIN_CONTRAST_TEXT
      );
      palette.buttonText = "#000000";
      injectCssVariablesFromPalette(palette, hostTheme);
      lastAppliedThemeKey = themeKey;
    } catch (err) {
      console.debug("[DAP] Adaptive theming error, using fallback:", err);
      injectFallbackVars({ background: "#F8FAFC", softBackground: "rgba(248,250,252,0.9)", mode: "light" });
      lastAppliedThemeKey = null;
    }
  }
  var RETRY_BUDGET_MS = 8e3;
  var RETRY_INTERVAL_MS = 300;
  var retryTimer = null;
  var retryStart = null;
  function stopRetry() {
    if (retryTimer !== null) {
      window.clearInterval(retryTimer);
      retryTimer = null;
    }
    retryStart = null;
  }
  function runWithRetry(options, watchHostTheme, watchDebounceMs) {
    runAdaptiveTheming(options);
    if (detectHostBrandColor()) {
      stopRetry();
      if (watchHostTheme) startHostThemeWatcher(watchDebounceMs);
      else clearHostThemeWatcher();
      return;
    }
    if (retryTimer !== null) return;
    retryStart = Date.now();
    console.debug("[DAP] Brand color not found on first run. Starting retry loop (SPA mode)...");
    retryTimer = window.setInterval(() => {
      const elapsed = Date.now() - (retryStart ?? 0);
      const foundRgb = detectHostBrandColor();
      if (foundRgb) {
        stopRetry();
        lastAppliedThemeKey = null;
        runAdaptiveTheming(options);
        if (watchHostTheme) startHostThemeWatcher(watchDebounceMs);
        else clearHostThemeWatcher();
        console.debug("[DAP] Brand color detected after SPA retry. Real theme applied.");
        return;
      }
      if (elapsed >= RETRY_BUDGET_MS) {
        stopRetry();
        if (watchHostTheme) startHostThemeWatcher(watchDebounceMs);
        else clearHostThemeWatcher();
        console.debug("[DAP] Retry budget exhausted. Keeping fallback theme.");
      }
    }, RETRY_INTERVAL_MS);
  }
  function initAdaptiveTheming(options = {}) {
    if (typeof window === "undefined" || !document) return;
    const watchHostTheme = options.watchHostTheme === true;
    const watchDebounceMs = normalizeWatchDebounceMs(options.watchDebounceMs);
    const run = () => runWithRetry(options, watchHostTheme, watchDebounceMs);
    if (!document.body) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run, { once: true });
      } else {
        requestAnimationFrame(run);
      }
      return;
    }
    run();
  }

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
  var _corsCheckPassed = null;
  var ACTIVE_FLOWS_KEY = "dap_active_flows";
  function trackActiveFlowId(flowId) {
    try {
      const key = ACTIVE_FLOWS_KEY;
      const activeStr = sessionStorage.getItem(key);
      const active = activeStr ? JSON.parse(activeStr) : [];
      if (!Array.isArray(active)) {
        sessionStorage.setItem(key, JSON.stringify([flowId]));
        return;
      }
      if (!active.includes(flowId)) {
        active.push(flowId);
        sessionStorage.setItem(key, JSON.stringify(active));
        log(`[Cross-Site] Tracked active flow: ${flowId}. Total: ${active.length}`);
      }
    } catch (e) {
      log("Error tracking active flow:", e);
    }
  }
  function recoverCrossSiteFlows() {
    try {
      const key = ACTIVE_FLOWS_KEY;
      const activeStr = sessionStorage.getItem(key);
      if (!activeStr) return [];
      const active = JSON.parse(activeStr);
      if (Array.isArray(active)) {
        log(`[Cross-Site] Recovered ${active.length} flows from previous site:`, active);
        return active;
      }
      return [];
    } catch (e) {
      log("Error recovering cross-site flows:", e);
      return [];
    }
  }
  function clearCrossSiteFlowTracking() {
    try {
      sessionStorage.removeItem(ACTIVE_FLOWS_KEY);
    } catch {
    }
  }
  async function init(opts) {
    const { configUrl, debug, screenId, user } = opts || {};
    window.__DAP_DEBUG__ = !!debug;
    initAdaptiveTheming({ watchHostTheme: true });
    if (debug && typeof window !== "undefined") {
      Object.assign(window.DAP, {
        getFlowState: () => flowEngine.getState(),
        getManagedFlows: () => multiFlowOrchestrator.getManagedFlows(),
        getUserState: () => userContextService.getDebugState(),
        testFlow: async (flowId) => {
          if (!_dapConfig) throw new Error("SDK not initialized");
          const previewMode2 = detectPreviewMode();
          const previewSessionId = previewMode2.isPreviewMode ? previewMode2.previewSessionId : null;
          const rawFlowData = await fetchFlowById(_dapConfig, location.origin, flowId, previewSessionId);
          const flowData = normalizeRawFlowData(rawFlowData, flowId);
          return multiFlowOrchestrator.startFlow(flowData);
        },
        renderModal,
        resolveSelector,
        locationContext: LocationContextService.getInstance(),
        userContext: userContextService,
        flowEngine,
        multiFlowOrchestrator,
        // ✅ Cache debugging methods for cross-site flows
        getFlowFromCache,
        clearFlowCache,
        getCacheStats: () => {
          const stats = { totalCached: 0, flows: [] };
          try {
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (key?.startsWith("dap_flow_cache_")) {
                const cached = sessionStorage.getItem(key);
                if (cached) {
                  try {
                    const entry = JSON.parse(cached);
                    stats.totalCached++;
                    stats.flows.push({
                      flowId: entry.flowId,
                      originalSiteId: entry.originalSiteId,
                      cachedAt: new Date(entry.timestamp).toISOString()
                    });
                  } catch {
                  }
                }
              }
            }
          } catch {
          }
          return stats;
        }
      });
    }
    if (!configUrl) throw new Error("DAP.init: configUrl is required");
    const pathname = location.pathname.replace(/^\/+/, "");
    let cfg = await loadConfig(configUrl);
    const hostBase = location.origin;
    window.__DAP_CONFIG__ = cfg;
    _dapConfig = cfg;
    telemetryService.setConfig(cfg);
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
    if (_corsCheckPassed === null) {
      log("Performing CORS origin check...");
      try {
        _corsCheckPassed = await checkCorsAccess(cfg, location.origin);
      } catch (err) {
        console.error("[DAP] CORS check encountered an unexpected error:", err);
        _corsCheckPassed = false;
      }
    }
    if (!_corsCheckPassed) {
      console.error(
        `[DAP] CORS check failed: origin '${location.origin}' is not allowed for this site collection. SDK initialization aborted. Verify that this domain is registered under the site collection DomainNames.`
      );
      return;
    }
    log("CORS check passed, proceeding with SDK initialization");
    let resumeFlowId = null;
    let resumeStepIndex = null;
    if (typeof window !== "undefined") {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const flowId = urlParams.get("dap_flow_id");
        const stepIndexStr = urlParams.get("dap_step_index");
        const flowOrigin = urlParams.get("dap_flow_origin");
        if (flowId && stepIndexStr) {
          resumeFlowId = flowId;
          resumeStepIndex = parseInt(stepIndexStr, 10);
          log("Cross-site resume query parameters detected:", { flowId, stepIndex: resumeStepIndex, flowOrigin });
          const snapshotKey = `dap_flow_snapshot_${flowId}`;
          const existingSnapshot = sessionStorage.getItem(snapshotKey);
          if (!existingSnapshot) {
            const snapshot = {
              flowId,
              activeStep: resumeStepIndex,
              triggeredSteps: Array.from({ length: resumeStepIndex }, (_, i) => i),
              timestamp: Date.now(),
              activeStepTriggered: false,
              activeStepTriggeredPageId: null,
              pendingUXResume: false,
              flowOrigin
            };
            sessionStorage.setItem(snapshotKey, JSON.stringify(snapshot));
            log(`Seeded session snapshot for cross-site flow resume: ${flowId} at step ${resumeStepIndex} with origin ${flowOrigin}`);
          }
        }
      } catch (e) {
        log("Error processing cross-site resume parameters:", e);
      }
    }
    const previewMode = detectPreviewMode();
    if (typeof window !== "undefined" && resumeFlowId) {
      try {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("dap_flow_id");
        cleanUrl.searchParams.delete("dap_step_index");
        cleanUrl.searchParams.delete("dap_flow_origin");
        cleanUrl.searchParams.delete("previewSessionId");
        cleanUrl.searchParams.delete("flowId");
        const newUrl = cleanUrl.searchParams.toString() ? `${cleanUrl.pathname}?${cleanUrl.searchParams.toString()}${cleanUrl.hash}` : `${cleanUrl.pathname}${cleanUrl.hash}`;
        window.history.replaceState({}, "", newUrl);
        log("Cleaned up cross-site resume parameters from URL:", newUrl);
      } catch (urlCleanupErr) {
        log("Failed to clean up cross-site parameters from URL:", urlCleanupErr);
      }
    }
    if (previewMode.isPreviewMode && previewMode.previewSessionId && previewMode.flowId) {
      log("Preview mode detected, flowId:", previewMode.flowId, "sessionId:", previewMode.previewSessionId);
      _previewSessionId = previewMode.previewSessionId;
      _pendingFlowIds = [previewMode.flowId];
      await initializeFlowsWhenReady();
      return;
    } else {
      _previewSessionId = null;
      clearPreviewSession();
    }
    const cachedFlowData = [];
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith("dap_flow_snapshot_")) {
          const snapshotStr = sessionStorage.getItem(key);
          if (snapshotStr) {
            const snapshot = JSON.parse(snapshotStr);
            if (snapshot.flowData) {
              cachedFlowData.push(snapshot.flowData);
            }
          }
        }
      }
    } catch (e) {
      log("Error checking for cached flows in sessionStorage:", e);
    }
    if (cachedFlowData.length > 0) {
      log(`Fast-Path: Starting ${cachedFlowData.length} cached flows immediately from session persistence`);
      waitForDOMReady().then(() => {
        multiFlowOrchestrator.startFlows(cachedFlowData);
      });
    }
    let ids = [];
    try {
      ids = await fetchVisibleFlowIds(cfg, hostBase, pathname);
      log("Visible flow IDs from current site:", ids);
    } catch (err) {
      console.error("[DAP] Failed to fetch visible flows:", err);
      await handleRuntimeCorsError(err);
    }
    const recoveredFlows = recoverCrossSiteFlows();
    for (const flowId of recoveredFlows) {
      if (!ids.includes(flowId)) {
        ids.push(flowId);
        log(`[Cross-Site] Added recovered flow to load queue: ${flowId}`);
      }
    }
    if (resumeFlowId && !ids.includes(resumeFlowId)) {
      ids.push(resumeFlowId);
      log(`Added cross-site resume flow ${resumeFlowId} to visible flows list`);
    }
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
  async function handleRuntimeCorsError(err) {
    const isCorsCandidate = err instanceof TypeError && !err.status && _corsCheckPassed === true;
    if (!isCorsCandidate || !_dapConfig) return false;
    console.warn(
      "[DAP] Network-level error detected during a runtime request \u2014 CORS policy may have changed. Re-checking origin..."
    );
    try {
      _corsCheckPassed = null;
      const allowed = await checkCorsAccess(_dapConfig, location.origin);
      _corsCheckPassed = allowed;
      if (!allowed) {
        console.error(
          "[DAP] CORS re-check failed: origin is no longer allowed for this site collection. The site collection DomainNames may have been updated. SDK will not make further API calls until CORS is restored."
        );
        return true;
      }
      console.warn(
        "[DAP] CORS re-check passed \u2014 the original network error was likely transient."
      );
    } catch (corsErr) {
      _corsCheckPassed = false;
      console.error("[DAP] CORS re-check encountered an unexpected error:", corsErr);
      return true;
    }
    return false;
  }
  async function startPendingFlows() {
    if (!_dapConfig) {
      _flowInitializationPending = false;
      return;
    }
    while (_pendingFlowIds.length > 0) {
      if (!_dapConfig) break;
      const queue = [..._pendingFlowIds];
      _pendingFlowIds = [];
      log(`Starting flows concurrently: [${queue.join(", ")}]`);
      const flowDataList = [];
      for (const flowId of queue) {
        if (!_dapConfig) break;
        let rawFlowData;
        try {
          let fetchOrigin = location.origin;
          try {
            const snapshotStr = sessionStorage.getItem(`dap_flow_snapshot_${flowId}`);
            if (snapshotStr) {
              const snapshot = JSON.parse(snapshotStr);
              if (snapshot.flowOrigin) {
                fetchOrigin = snapshot.flowOrigin;
                log(`Using cached flowOrigin from snapshot for fetching flow ${flowId}: ${fetchOrigin}`);
              }
            }
          } catch {
          }
          rawFlowData = await fetchFlowById(
            _dapConfig,
            fetchOrigin,
            flowId,
            _previewSessionId ?? void 0
          );
        } catch (err) {
          console.error(`[DAP] Failed to fetch flow ${flowId}:`, err);
          const corsBlocked = await handleRuntimeCorsError(err);
          if (corsBlocked) {
            _flowInitializationPending = false;
            return;
          }
          continue;
        }
        if (!rawFlowData) {
          console.error("[DAP] Failed to resolve flow data for flow ID:", flowId);
          continue;
        }
        flowDataList.push(normalizeRawFlowData(rawFlowData, flowId));
      }
      if (flowDataList.length > 0) {
        await multiFlowOrchestrator.startFlows(flowDataList);
        for (const flowData of flowDataList) {
          trackActiveFlowId(flowData.flowId);
        }
        log(`[Cross-Site] Tracked ${flowDataList.length} flows as active for cross-site recovery`);
      }
    }
    _flowInitializationPending = false;
  }
  function normalizeRawFlowData(rawFlowData, flowId) {
    const steps = (Array.isArray(rawFlowData.steps) ? rawFlowData.steps : null) || (Array.isArray(rawFlowData.actions) ? rawFlowData.actions : null) || (Array.isArray(rawFlowData.actionGroups) ? rawFlowData.actionGroups : null) || [];
    const rawFreq = rawFlowData.execution?.frequency || rawFlowData.frequency || {
      // Default to 'Always' (no throttling) so flows without explicit frequency config
      // run on every page visit as intended. Using 'Daily' here was silently throttling them.
      type: rawFlowData.frequencyType || "Always",
      maxRuns: rawFlowData.maxRuns || 0
    };
    const rawType = String(rawFreq.type || "Always").toLowerCase().trim();
    let normalizedType = "Always";
    if (rawType === "always") normalizedType = "Always";
    else if (rawType === "onetime" || rawType === "one-time" || rawType === "one_time") normalizedType = "OneTime";
    else if (rawType === "recurring") normalizedType = "Recurring";
    else if (rawType === "daily") normalizedType = "Daily";
    else if (rawType === "weekly") normalizedType = "Weekly";
    else if (rawType === "monthly") normalizedType = "Monthly";
    const frequency = {
      type: normalizedType,
      maxRuns: rawFreq.maxRuns !== void 0 ? rawFreq.maxRuns : 0
    };
    return {
      flowId: rawFlowData.flowId || rawFlowData.id || flowId,
      flowName: rawFlowData.flowName || rawFlowData.name || flowId,
      steps,
      // ── Page-URL targeting ─────────────────────────────────────────────────
      // Accept both array (targetUrls) and scalar (targetUrl) from raw data.
      targetUrls: rawFlowData.targetUrls ? Array.isArray(rawFlowData.targetUrls) ? rawFlowData.targetUrls : [rawFlowData.targetUrls] : rawFlowData.targetUrl ? [rawFlowData.targetUrl] : void 0,
      // ──────────────────────────────────────────────────────────────────────
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
        await handleRuntimeCorsError(err);
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
        try {
          sessionStorage.removeItem(`dap_flow_completed_session_${flowId}`);
        } catch {
        }
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
        try {
          const sessionKeysToRemove = [];
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith("dap_flow_completed_session_")) {
              sessionKeysToRemove.push(key);
            }
          }
          sessionKeysToRemove.forEach((k) => sessionStorage.removeItem(k));
          console.debug(`[DAP] All flow session runs reset (${sessionKeysToRemove.length} session keys cleared)`);
        } catch {
        }
        clearCrossSiteFlowTracking();
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
      targetUrls: flow.targetUrls ? Array.isArray(flow.targetUrls) ? flow.targetUrls : [flow.targetUrls] : flow.targetUrl ? [flow.targetUrl] : void 0,
      execution: flow.execution ? {
        mode: flow.execution.mode,
        multiPage: flow.execution.multiPage,
        frequency: flow.execution.frequency ? (() => {
          const rawType = String(flow.execution.frequency.type ?? "OneTime").toLowerCase().trim();
          let normalizedType = "OneTime";
          if (rawType === "onetime" || rawType === "one-time" || rawType === "one_time") normalizedType = "OneTime";
          else if (rawType === "recurring") normalizedType = "Recurring";
          else if (rawType === "daily") normalizedType = "Daily";
          else if (rawType === "weekly") normalizedType = "Weekly";
          else if (rawType === "monthly") normalizedType = "Monthly";
          return {
            type: normalizedType,
            maxRuns: flow.execution.frequency.maxRuns ?? (normalizedType === "Recurring" ? Infinity : 1)
          };
        })() : void 0
      } : flow.executionMode ? {
        mode: flow.executionMode,
        multiPage: flow.isMultiPage
      } : void 0
    };
    log("Executing custom flow:", normalizedFlow);
    return multiFlowOrchestrator.startFlow(normalizedFlow);
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
      return multiFlowOrchestrator.startFlow(registeredFlow);
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
      return multiFlowOrchestrator.startFlow(flowData);
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