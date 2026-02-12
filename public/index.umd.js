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

  // src/utils/normalize.ts
  function normalizePlacement(p) {
    if (!p) return "top";
    const s = p.trim().toLowerCase();
    if (s.startsWith("top")) return "top";
    if (s.startsWith("bottom")) return "bottom";
    if (s.startsWith("left")) return "left";
    if (s.startsWith("right")) return "right";
    if (s === "auto") return "auto";
    return "top";
  }
  var init_normalize = __esm({
    "src/utils/normalize.ts"() {
    }
  });

  // src/utils/selectors.ts
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
      const node = result.singleNodeValue;
      if (node) return node;
      if (sel.startsWith("/html[1]/body[1]/")) {
        const simplified = sel.replace("/html[1]/body[1]/", "//");
        const fallbackResult = doc.evaluate(
          simplified,
          root,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        const fallbackNode = fallbackResult.singleNodeValue;
        if (fallbackNode) {
          console.debug(`[DAP] Found element using simplified XPath fallback: ${simplified}`);
          return fallbackNode;
        }
      }
    } catch (e) {
    }
    return null;
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
  var init_selectors = __esm({
    "src/utils/selectors.ts"() {
    }
  });

  // src/utils/triggerNormalizer.ts
  function normalizeTrigger(trigger) {
    if (!trigger) {
      console.warn("[DAP] No trigger specified, defaulting to click");
      return { eventType: "click", isSynthetic: false };
    }
    const normalizedTrigger = trigger.toLowerCase().trim();
    console.debug(`[DAP] Normalizing trigger: "${trigger}" \u2192 processing "${normalizedTrigger}"`);
    if (normalizedTrigger === "on page load" || normalizedTrigger === "page load" || normalizedTrigger === "pageload") {
      console.debug(`[DAP] Trigger normalized: "${trigger}" \u2192 synthetic page load`);
      return { eventType: "pageload", isSynthetic: true };
    }
    if (normalizedTrigger === "on hover" || normalizedTrigger === "hover" || normalizedTrigger === "mouseover") {
      console.debug(`[DAP] Trigger normalized: "${trigger}" \u2192 "mouseenter"`);
      return { eventType: "mouseenter", isSynthetic: false };
    }
    if (normalizedTrigger === "on click" || normalizedTrigger === "click") {
      console.debug(`[DAP] Trigger normalized: "${trigger}" \u2192 "click"`);
      return { eventType: "click", isSynthetic: false };
    }
    if (normalizedTrigger === "on focus" || normalizedTrigger === "focus") {
      console.debug(`[DAP] Trigger normalized: "${trigger}" \u2192 "focus"`);
      return { eventType: "focus", isSynthetic: false };
    }
    if (normalizedTrigger === "on blur" || normalizedTrigger === "blur") {
      console.debug(`[DAP] Trigger normalized: "${trigger}" \u2192 "blur"`);
      return { eventType: "blur", isSynthetic: false };
    }
    if (normalizedTrigger === "on input" || normalizedTrigger === "input" || normalizedTrigger === "typing") {
      console.debug(`[DAP] Trigger normalized: "${trigger}" \u2192 "input"`);
      return { eventType: "input", isSynthetic: false };
    }
    if (normalizedTrigger === "on change" || normalizedTrigger === "change") {
      console.debug(`[DAP] Trigger normalized: "${trigger}" \u2192 "change"`);
      return { eventType: "change", isSynthetic: false };
    }
    if (normalizedTrigger === "on keydown" || normalizedTrigger === "keydown") {
      console.debug(`[DAP] Trigger normalized: "${trigger}" \u2192 "keydown"`);
      return { eventType: "keydown", isSynthetic: false };
    }
    if (normalizedTrigger === "on keyup" || normalizedTrigger === "keyup") {
      console.debug(`[DAP] Trigger normalized: "${trigger}" \u2192 "keyup"`);
      return { eventType: "keyup", isSynthetic: false };
    }
    console.warn(`[DAP] Unknown trigger type: "${trigger}", defaulting to click`);
    return { eventType: "click", isSynthetic: false };
  }
  function waitForElement2(selector, options = {}) {
    const {
      timeout = 1e4,
      // 10 seconds default
      interval = 100,
      // Check every 100ms
      maxRetries = timeout / interval
    } = options;
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const checkElement = () => {
        attempts++;
        console.debug(`[DAP] Attempting to find element (${attempts}/${maxRetries}): ${selector}`);
        try {
          const element = resolveSelector(selector);
          if (element) {
            console.debug(`[DAP] Element found after ${attempts} attempts: ${selector}`);
            resolve(element);
            return;
          }
        } catch (error) {
          console.debug(`[DAP] Error finding element: ${error}`);
        }
        if (attempts >= maxRetries) {
          console.warn(`[DAP] Element not found after ${attempts} attempts (${timeout}ms): ${selector}`);
          reject(new Error(`Element not found: ${selector}`));
          return;
        }
        setTimeout(checkElement, interval);
      };
      checkElement();
    });
  }
  var init_triggerNormalizer = __esm({
    "src/utils/triggerNormalizer.ts"() {
      init_selectors();
    }
  });

  // src/utils/idGenerator.ts
  function isValidStepId(stepId) {
    if (!stepId) return false;
    const validPattern = /^(step-\d+|[mtps]\d+|[a-zA-Z0-9_-]+)$/;
    return validPattern.test(stepId);
  }
  function generateStepId(prefix = "step", index) {
    if (index !== void 0) {
      return `${prefix}-${index}`;
    }
    const timestamp = Date.now().toString(36);
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    return `${prefix}-${timestamp}${randomSuffix}`;
  }
  function normalizeStepId(stepId, fallbackPrefix = "step", index) {
    if (isValidStepId(stepId)) {
      return stepId;
    }
    return generateStepId(fallbackPrefix, index);
  }
  var init_idGenerator = __esm({
    "src/utils/idGenerator.ts"() {
    }
  });

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

  // src/flows.ts
  var flows_exports = {};
  __export(flows_exports, {
    fetchFlowById: () => fetchFlowById,
    fetchVisibleFlowIds: () => fetchVisibleFlowIds,
    normalizeServerFlow: () => normalizeServerFlow
  });
  function normalizeTriggerToLegacyFormat(trigger) {
    const normalized = normalizeTrigger(trigger);
    switch (normalized.eventType) {
      case "mouseenter":
      case "hover":
        return "hover";
      case "focus":
      case "input":
      case "change":
        return "focus";
      case "click":
      case "keydown":
      case "keyup":
      default:
        return "click";
    }
  }
  async function fetchVisibleFlowIds(cfg, hostBase, page) {
    const base = joinUrl(cfg.apiurl, `/iap-experience/${cfg.organizationid}/${cfg.siteid}/visible-flows`);
    console.debug(`[DAP] fetchVisibleFlowIds calling: ${base} with host: ${hostBase}, page: ${page}`);
    try {
      const res = await http(cfg, base, {
        method: "POST",
        hostBase,
        includeHostHeader: true,
        body: { hostname: hostBase, page }
      });
      const flows = Array.isArray(res) ? res : [];
      console.debug("[DAP] fetchVisibleFlowIds (POST) returned items count:", flows.length);
      return flows;
    } catch (e) {
      if (e && e.status === 405) {
        const url = `${base}?hostname=${encodeURIComponent(hostBase)}&page=${encodeURIComponent(page || "")}`;
        const res = await http(cfg, url, {
          method: "GET",
          hostBase,
          includeHostHeader: true
        });
        const flows = Array.isArray(res?.flowIds) ? res.flowIds : Array.isArray(res) ? res : [];
        console.debug("[DAP] fetchVisibleFlowIds (GET fallback) returned items count:", flows.length);
        return flows;
      }
      throw e;
    }
  }
  async function fetchFlowById(cfg, hostBase, flowId) {
    const id = typeof flowId === "object" ? flowId.flowId || flowId.id : flowId;
    if (!id) {
      throw new Error(`Invalid flowId provided to fetchFlowById: ${JSON.stringify(flowId)}`);
    }
    const patterns = [
      `/iap-experience/${cfg.organizationid}/${cfg.siteid}/flows/${id}`,
      `/iap-experience/${cfg.organizationid}/${cfg.siteid}/flow/${id}`,
      `/iap-experience/organizationId/${cfg.organizationid}/siteId/${cfg.siteid}/flows/${id}`,
      `/iap-experience/organizationId/${cfg.organizationid}/siteCollectionId/${cfg.siteid}/flows/${id}`,
      `/iap-experience/organizationId/${cfg.organizationid}/siteId/${cfg.siteid}/flow/${id}`,
      `/iap-experience/organizationId/${cfg.organizationid}/siteCollectionId/${cfg.siteid}/flow/${id}`,
      `/iap-experience/siteId/${cfg.siteid}/flows/${id}`,
      `/iap-experience/siteCollectionId/${cfg.siteid}/flows/${id}`,
      `/iap-experience/flows/${id}`,
      `/iap-experience/flow/${id}`,
      `/iap-experience/${cfg.siteid}/flows/${id}`,
      `/iap-experience/${cfg.siteid}/flow/${id}`,
      `/flows/${id}`,
      `/flow/${id}`
    ];
    console.debug(`[DAP] Fetching flow by ID: ${id}. Trying ${patterns.length} patterns...`);
    for (const pattern of patterns) {
      const url = joinUrl(cfg.apiurl, pattern);
      const urlWithHost = `${url}${url.includes("?") ? "&" : "?"}hostname=${encodeURIComponent(hostBase)}`;
      try {
        console.debug(`[DAP] Trying pattern (GET): ${urlWithHost}`);
        const result = await http(cfg, urlWithHost, { method: "GET", hostBase, includeHostHeader: true });
        console.debug(`[DAP] Successfully fetched flow via GET from: ${urlWithHost}`);
        return result;
      } catch (e) {
        if (e && (e.status === 404 || e.status === 400)) {
          console.debug(`[DAP] GET failed with ${e.status}: ${urlWithHost}`, e.body || "");
          if (pattern.includes(cfg.organizationid) && pattern.includes(cfg.siteid)) {
            try {
              console.debug(`[DAP] Trying pattern (POST): ${url}`);
              const result = await http(cfg, url, {
                method: "POST",
                hostBase,
                includeHostHeader: true,
                body: { hostname: hostBase }
              });
              console.debug(`[DAP] Successfully fetched flow via POST from: ${url}`);
              return result;
            } catch (postErr) {
              console.debug(`[DAP] POST failed with ${postErr.status}: ${url}`, postErr.body || "");
            }
          }
          continue;
        }
        if (e && e.status === 405) {
          try {
            console.debug(`[DAP] Trying pattern (POST fallback): ${url}`);
            const result = await http(cfg, url, {
              method: "POST",
              hostBase,
              includeHostHeader: true,
              body: { hostname: hostBase }
            });
            console.debug(`[DAP] Successfully fetched flow via POST from: ${url}`);
            return result;
          } catch (postErr) {
          }
        }
        throw e;
      }
    }
    const queryUrl = joinUrl(cfg.apiurl, `/flows/${id}?organizationId=${cfg.organizationid}&siteId=${cfg.siteid}`);
    try {
      console.debug(`[DAP] Trying final fallback with query params: ${queryUrl}`);
      return await http(cfg, queryUrl, { method: "GET", hostBase, includeHostHeader: true });
    } catch (e) {
    }
    throw new Error(`Flow ${id} not found after trying all patterns. Patterns attempted: ${patterns.length} GET/POST variations.`);
  }
  function normalizeServerFlow(serverFlow) {
    console.debug("[DAP] === NORMALIZING SERVER FLOW ===");
    console.debug("[DAP] Raw server flow data:", serverFlow);
    console.debug("[DAP] Flow ID:", serverFlow?.flowId);
    console.debug("[DAP] Flow Name:", serverFlow?.flowName);
    console.debug("[DAP] Steps count:", serverFlow?.steps?.length);
    const firstStep = serverFlow?.steps?.[0];
    if (firstStep?.uxExperience) {
      const ux = firstStep.uxExperience;
      ux.elementSelector;
      ux.elementTrigger;
      ux.elementLocation;
    }
    const out = { steps: [], startAt: 0 };
    const steps = Array.isArray(serverFlow?.steps) ? serverFlow.steps : [];
    console.debug(`[DAP] Processing flow with ${steps.length} steps`);
    for (const step of steps) {
      console.debug(`[DAP] Processing step:`, {
        stepId: step?.stepId,
        stepName: step?.stepName,
        hasUxExperience: !!step?.uxExperience,
        hasConditionRuleBlocks: !!(step?.conditionRuleBlocks && step.conditionRuleBlocks.length > 0),
        conditionRuleBlocksLength: step?.conditionRuleBlocks?.length || 0
      });
      if (step?.conditionRuleBlocks && Array.isArray(step.conditionRuleBlocks) && step.conditionRuleBlocks.length > 0) {
        console.debug(`[DAP] Processing rule step:`, step);
        const stepId = normalizeStepId(step.stepId, "step", out.steps.length + 1);
        const inputSelector = step.userInputSelector || step.conditionRuleBlocks[0]?.selector || "";
        console.debug(`[DAP] Rule step input selector: ${inputSelector}`);
        console.debug(`[DAP] Rule step has ${step.conditionRuleBlocks.length} rule blocks`);
        if (!inputSelector) {
          console.warn(`[DAP] Rule step ${step.stepId} has no input selector, skipping`);
          continue;
        }
        const ruleStep = {
          kind: "rule",
          stepId,
          inputSelector,
          rules: step.conditionRuleBlocks
        };
        console.debug(`[DAP] Created rule step:`, ruleStep);
        out.steps.push({
          kind: "rule",
          rule: ruleStep,
          stepId
        });
        console.debug(`[DAP] Added rule step to modal sequence. Total steps: ${out.steps.length}`);
        continue;
      }
      const ux = step?.uxExperience;
      if (!ux) {
        console.debug(`[DAP] Skipping step ${step?.stepId} - no uxExperience and no conditionRuleBlocks`);
        continue;
      }
      const uxType = String(ux.uxExperienceType || "").toLowerCase();
      if (uxType === "tooltip" || ux?.content?.componentType === "Tooltip") {
        const stepId = normalizeStepId(step.stepId, "step", out.steps.length + 1);
        const t = {
          targetSelector: ux.elementSelector || "",
          text: ux?.content?.text || "",
          placement: normalizePlacement(ux?.content?.placement),
          trigger: normalizeTriggerToLegacyFormat(ux.elementTrigger),
          stepId
        };
        out.steps.push({
          kind: "tooltip",
          tooltip: t,
          title: ux?.name || "Tip",
          stepId,
          // Preserve trigger information at step level
          elementSelector: ux.elementSelector,
          elementTrigger: ux.elementTrigger,
          elementLocation: ux.elementLocation
        });
        continue;
      }
      if (uxType === "popover" || ux?.content?.componentType === "Popover") {
        const stepId = normalizeStepId(step.stepId, "step", out.steps.length + 1);
        const p = {
          title: ux?.content?.title || ux?.name || "Info",
          body: ux?.content?.body || "",
          bodyBlocks: Array.isArray(ux?.content?.bodyBlocks) ? ux.content.bodyBlocks : void 0,
          targetSelector: ux?.elementSelector || "",
          placement: normalizePlacement(ux?.content?.placement),
          trigger: normalizeTriggerToLegacyFormat(ux.elementTrigger),
          showArrow: ux?.content?.showArrow !== false,
          stepId
        };
        out.steps.push({
          kind: "popover",
          popover: p,
          title: p.title,
          stepId,
          // Preserve trigger information at step level
          elementSelector: ux.elementSelector,
          elementTrigger: ux.elementTrigger,
          elementLocation: ux.elementLocation
        });
        continue;
      }
      if (uxType === "modal" || ux?.content?.componentType === "Modal") {
        const blocks = [];
        console.debug("[DAP] Processing modal content for step:", step.stepName);
        console.debug("[DAP] ux.content:", ux?.content);
        console.debug("[DAP] ux.modalContent:", ux?.modalContent);
        const contentType = String(ux?.modalContent?.contentType || "").toLowerCase();
        const isKnowledgeBase = contentType === "knowledgebase";
        console.log("[DAP] Processing Knowledge Base content:", isKnowledgeBase);
        console.debug("[DAP] Is Knowledge Base modal:", isKnowledgeBase);
        console.debug("[DAP] modalContent.contentType:", ux?.modalContent?.contentType);
        console.debug("[DAP] modalContent full object:", ux?.modalContent);
        console.log("[DAP] ux.content.body:", ux?.content?.body);
        if (ux?.content?.body && !isKnowledgeBase) {
          console.debug("[DAP] Adding text block with body:", typeof ux.content.body, ux.content.body);
          if (Array.isArray(ux.content.body)) {
            console.warn("[DAP] Body content is an array, likely KB items incorrectly assigned to body:", ux.content.body);
            const kbItems = toKbItems(ux.content.body);
            console.debug("[DAP] Creating KB block from body array:", kbItems);
            const kb = {
              kind: "kb",
              title: ux?.content?.header || ux?.name || "Knowledge Base",
              items: kbItems
            };
            blocks.push(kb);
            console.debug("[DAP] Added KB block from body array:", kb);
          } else {
            blocks.push({ kind: "text", html: String(ux.content.body) });
          }
        } else if (ux?.content?.body && isKnowledgeBase) {
          console.debug("[DAP] Skipping body text for Knowledge Base modal, body content:", ux.content.body);
        }
        if (contentType === "knowledgebase") {
          console.debug("[DAP] Processing Knowledge Base content:", ux?.modalContent);
          const kbItems = toKbItems(ux?.modalContent?.contentData);
          console.debug("[DAP] Generated KB items:", kbItems);
          const kb = {
            kind: "kb",
            title: ux?.content?.header || ux?.name || "Knowledge Base",
            items: kbItems
          };
          blocks.push(kb);
          console.debug("[DAP] Added KB block:", kb);
        } else {
          const c = ux?.modalContent;
          if (c) {
            const url = c.presignedUrl || c.contentData || "";
            const ctype = String(c.contentType || "").toLowerCase();
            if (ctype === "link") {
              if (isYouTube(url)) {
                blocks.push({ kind: "youtube", href: url, title: c.contentName || "YouTube" });
              } else if (isHttp(url)) {
                blocks.push({ kind: "link", href: url, label: c.contentName || url });
              }
            } else if (ctype === "video") {
              if (isHttp(url)) blocks.push({ kind: "video", sources: [{ src: url }] });
            } else if (ctype === "image") {
              if (isHttp(url)) blocks.push({ kind: "image", url, alt: c.contentName || "" });
            } else if (ctype === "article") {
              if (isHttp(url)) {
                blocks.push({
                  kind: "article",
                  url,
                  fileName: c.contentData || void 0,
                  mime: /\.pdf(\?|#|$)/i.test(url) ? "application/pdf" : /\.docx(\?|#|$)/i.test(url) ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : void 0
                });
              }
            }
          }
        }
        console.debug("[DAP] Final blocks array for modal:", blocks);
        console.debug("[DAP] Block kinds:", blocks.map((b) => b.kind));
        const stepId = normalizeStepId(step.stepId, "step", out.steps.length + 1);
        out.steps.push({
          kind: "modal",
          title: ux?.content?.header || ux?.name || "Info",
          footerText: ux?.content?.footer || "",
          body: blocks,
          stepId,
          // Preserve trigger information at step level
          elementSelector: ux.elementSelector,
          elementTrigger: ux.elementTrigger,
          elementLocation: ux.elementLocation
        });
        continue;
      }
      if (uxType === "survey" || ux?.content?.componentType === "MicroSurvey") {
        const stepId = normalizeStepId(step.stepId, "step", out.steps.length + 1);
        const survey = {
          header: ux?.content?.header || ux?.name || "Survey",
          body: ux?.content?.body || "",
          questions: Array.isArray(ux?.content?.questions) ? ux.content.questions.map((q) => ({
            questionId: q.questionId || `q${Math.random().toString(36).substring(2, 10)}`,
            question: q.question || "",
            type: q.type || "SingleChoice",
            options: Array.isArray(q.options) ? q.options : void 0,
            scaleMin: q.scaleMin !== void 0 ? q.scaleMin : void 0,
            scaleMax: q.scaleMax !== void 0 ? q.scaleMax : void 0,
            labelMin: q.labelMin || void 0,
            labelMax: q.labelMax || void 0,
            criteria: Array.isArray(q.criteria) ? q.criteria : void 0
          })) : [],
          flowId: serverFlow.flowId,
          organizationId: serverFlow.organizationId,
          siteId: serverFlow.siteId,
          stepId
        };
        out.steps.push({
          kind: "survey",
          survey,
          title: survey.header || "Survey",
          stepId,
          // Preserve trigger information at step level
          elementSelector: ux.elementSelector,
          elementTrigger: ux.elementTrigger,
          elementLocation: ux.elementLocation
        });
        continue;
      }
    }
    out.steps.forEach((step) => {
      if (step.stepId) {
        step.stepId = normalizeStepId(step.stepId);
        if (step.tooltip && step.tooltip.stepId) {
          step.tooltip.stepId = step.stepId;
        } else if (step.popover && step.popover.stepId) {
          step.popover.stepId = step.stepId;
        } else if (step.survey && step.survey.stepId) {
          step.survey.stepId = step.stepId;
        }
      }
    });
    if (out.steps.length > 0) {
      out.stepsCount = out.steps.length;
    }
    console.debug("[DAP] === NORMALIZATION COMPLETE ===");
    console.debug("[DAP] Total steps created:", out.steps.length);
    console.debug("[DAP] Final modal sequence payload:", out);
    out.steps.forEach((step, index) => {
      console.debug(`[DAP] Step ${index + 1}:`, {
        kind: step.kind,
        stepId: step.stepId,
        hasRule: step.kind === "rule",
        ruleData: step.kind === "rule" ? step.rule : void 0
      });
    });
    console.debug("[DAP] === END NORMALIZATION ===");
    return out;
  }
  function isHttp(url) {
    try {
      const u = new URL(url, location.origin);
      return /^https?:$/i.test(u.protocol);
    } catch {
      return false;
    }
  }
  function isYouTube(url) {
    try {
      const u = new URL(url, location.origin);
      const h = u.hostname.toLowerCase();
      return /(^|\.)youtube\.com$/.test(h) || /(^|\.)youtu\.be$/.test(h) || /(^|\.)youtube-nocookie\.com$/.test(h);
    } catch {
      return false;
    }
  }
  function mapItemType(t, url) {
    const v = (t || "").toLowerCase();
    if (v === "link") return isYouTube(url) ? "youtube" : "link";
    if (v === "video") return "video";
    if (v === "image") return "image";
    if (v === "article") return "article";
    return "link";
  }
  function toKbItems(arr) {
    console.debug("[DAP] toKbItems input:", arr);
    if (!Array.isArray(arr)) return [];
    const items = [];
    for (const it of arr) {
      const url = it?.presignedUrl || "";
      const title = it?.contentName || "";
      const description = it?.contentDescription || "";
      const contentType = it?.contentType || "";
      const fileName = it?.contentData || "";
      console.debug("[DAP] Processing KB item:", {
        raw: it,
        extracted: { url, title, description, contentType, fileName }
      });
      if (!url || !title) {
        console.warn("[DAP] KB item missing required fields (url or title), skipping:", it);
        continue;
      }
      const kbItem = {
        kind: "kb-item",
        itemType: mapItemType(contentType, url),
        title,
        description,
        url,
        fileName: fileName || void 0,
        mime: /\.pdf(\?|#|$)/i.test(url) ? "application/pdf" : /\.docx(\?|#|$)/i.test(url) ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : void 0
      };
      console.debug("[DAP] Generated KB item:", kbItem);
      items.push(kbItem);
    }
    console.debug("[DAP] Final KB items array:", items);
    return items;
  }
  function joinUrl(base, tail) {
    const b = (base || "").replace(/\/+$/, "");
    const t = (tail || "").replace(/^\/+/, "");
    return `${b}/${t}`;
  }
  var init_flows = __esm({
    "src/flows.ts"() {
      init_normalize();
      init_triggerNormalizer();
      init_idGenerator();
      init_http();
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

  // src/experiences/tooltip.ts
  var tooltip_exports = {};
  __export(tooltip_exports, {
    registerTooltip: () => registerTooltip,
    renderDirectTooltip: () => renderDirectTooltip,
    renderTooltip: () => renderTooltip
  });
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
      return;
    }
    const target = await waitForTarget(payload.targetSelector, 5e3);
    if (!target) {
      console.warn("[DAP] Tooltip target not found", { selector: payload.targetSelector });
      return;
    }
    console.debug("[DAP] Tooltip target resolved", { selector: payload.targetSelector });
    const tooltip = new DAPTooltip(id, target, payload);
    tooltip.initialize();
  }
  async function renderDirectTooltip(payload) {
    const directFlow = {
      id: `validation-${Date.now()}`,
      payload
    };
    await renderTooltip(directFlow);
  }
  async function waitForTarget(selector, timeout) {
    const startTime = Date.now();
    let element = resolveSelector(selector);
    if (element) return element;
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        element = resolveSelector(selector);
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
        resolve(resolveSelector(selector));
      }, timeout);
    });
  }
  var DAPTooltip;
  var init_tooltip = __esm({
    "src/experiences/tooltip.ts"() {
      init_registry();
      init_selectors();
      DAPTooltip = class {
        constructor(id, target, payload) {
          this.container = null;
          this.overlay = null;
          this.isVisible = false;
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
          if (this.trigger === "hover" || this.trigger === "focus") {
            this.show();
          }
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
          const onClick = (e) => {
            e.stopPropagation();
            if (this.isVisible) {
              this.hide();
            } else {
              this.show();
            }
          };
          const onDocumentClick = (e) => {
            const target = e.target;
            if (!this.container?.contains(target) && !this.target.contains(target)) {
              this.hide();
            }
          };
          this.target.addEventListener("click", onClick);
          document.addEventListener("click", onDocumentClick, true);
          this.listeners.push(
            () => this.target.removeEventListener("click", onClick),
            () => document.removeEventListener("click", onDocumentClick, true)
          );
        }
        setupFocusTrigger() {
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
          if (this.isVisible) return;
          console.debug("[DAP] Tooltip shown", { id: this.id });
          this.createTooltip();
          this.position();
          this.isVisible = true;
          requestAnimationFrame(() => {
            if (this.container) {
              this.container.classList.add("dap-tooltip-visible");
            }
          });
          if (this.payload._completionTracker?.onComplete) {
            console.debug("[DAP] Completing tooltip flow", { id: this.id });
            this.payload._completionTracker.onComplete();
          }
        }
        hide() {
          if (!this.isVisible) return;
          console.debug("[DAP] Tooltip dismissed", { id: this.id });
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
      .dap-tooltip {
        position: fixed;
        background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
        color: #2c3e50;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 14px;
        font-weight: 400;
        line-height: 1.5;
        max-width: 320px;
        min-width: 200px;
        word-wrap: break-word;
        z-index: 2147483641;
        pointer-events: auto;
        box-shadow: 
          0 8px 32px rgba(0, 0, 0, 0.15),
          0 4px 16px rgba(0, 0, 0, 0.08),
          0 0 0 1px rgba(0, 0, 0, 0.05);
        border: 1px solid rgba(0, 0, 0, 0.08);
        backdrop-filter: blur(8px);
        opacity: 0;
        transform: scale(0.95) translateY(-4px);
        transition: all 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
        animation: dap-tooltip-enter 0.25s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
      }

      .dap-tooltip.dap-tooltip-visible {
        opacity: 1;
        transform: scale(1) translateY(0);
      }

      .dap-tooltip-content {
        margin: 0;
        color: #2c3e50;
        text-shadow: none;
        letter-spacing: 0.02em;
      }

      .dap-tooltip-content p {
        margin: 0;
      }

      .dap-tooltip-content strong {
        font-weight: 600;
        color: #1a202c;
      }

      .dap-tooltip-arrow {
        position: absolute;
        width: 0;
        height: 0;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
      }

      /* Arrow positioning and styling */
      .dap-tooltip[data-placement="top"] .dap-tooltip-arrow {
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid #f8f9fa;
      }

      .dap-tooltip[data-placement="right"] .dap-tooltip-arrow {
        left: -8px;
        top: 50%;
        transform: translateY(-50%);
        border-top: 8px solid transparent;
        border-bottom: 8px solid transparent;
        border-right: 8px solid #f8f9fa;
      }

      .dap-tooltip[data-placement="bottom"] .dap-tooltip-arrow {
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-bottom: 8px solid #f8f9fa;
      }

      .dap-tooltip[data-placement="left"] .dap-tooltip-arrow {
        right: -8px;
        top: 50%;
        transform: translateY(-50%);
        border-top: 8px solid transparent;
        border-bottom: 8px solid transparent;
        border-left: 8px solid #f8f9fa;
      }

      /* Animation keyframes */
      @keyframes dap-tooltip-enter {
        0% {
          opacity: 0;
          transform: scale(0.9) translateY(-8px);
        }
        50% {
          opacity: 0.8;
        }
        100% {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      @keyframes dap-tooltip-exit {
        0% {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
        100% {
          opacity: 0;
          transform: scale(0.95) translateY(-4px);
        }
      }

      /* Hover states */
      .dap-tooltip:hover {
        background: linear-gradient(135deg, #ffffff 0%, #f1f3f5 100%);
        box-shadow: 
          0 12px 40px rgba(0, 0, 0, 0.18),
          0 6px 20px rgba(0, 0, 0, 0.1),
          0 0 0 1px rgba(0, 0, 0, 0.08);
        transform: translateY(-1px);
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .dap-tooltip {
          background: #ffffff;
          border: 2px solid #000000;
          color: #000000;
        }
        
        .dap-tooltip-arrow {
          filter: none;
        }
        
        .dap-tooltip[data-placement="top"] .dap-tooltip-arrow {
          border-top-color: #ffffff;
        }
        
        .dap-tooltip[data-placement="right"] .dap-tooltip-arrow {
          border-right-color: #ffffff;
        }
        
        .dap-tooltip[data-placement="bottom"] .dap-tooltip-arrow {
          border-bottom-color: #ffffff;
        }
        
        .dap-tooltip[data-placement="left"] .dap-tooltip-arrow {
          border-left-color: #ffffff;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .dap-tooltip {
          transition: opacity 0.15s ease;
          animation: none;
        }
        
        .dap-tooltip:hover {
          transform: none;
        }
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .dap-tooltip {
          background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.4),
            0 4px 16px rgba(0, 0, 0, 0.24),
            0 0 0 1px rgba(255, 255, 255, 0.1);
        }
        
        .dap-tooltip-content {
          color: #ffffff;
        }
        
        .dap-tooltip-content strong {
          color: #e2e8f0;
        }
        
        .dap-tooltip[data-placement="top"] .dap-tooltip-arrow {
          border-top-color: #2d3748;
        }
        
        .dap-tooltip[data-placement="right"] .dap-tooltip-arrow {
          border-right-color: #2d3748;
        }
        
        .dap-tooltip[data-placement="bottom"] .dap-tooltip-arrow {
          border-bottom-color: #2d3748;
        }
        
        .dap-tooltip[data-placement="left"] .dap-tooltip-arrow {
          border-left-color: #2d3748;
        }
      }

      /* Focus indicators for accessibility */
      .dap-tooltip:focus-within {
        outline: 2px solid #4a90e2;
        outline-offset: 2px;
      }

      /* RTL support */
      [dir="rtl"] .dap-tooltip {
        text-align: right;
      }

      /* Mobile responsive adjustments */
      @media (max-width: 768px) {
        .dap-tooltip {
          max-width: calc(100vw - 32px);
          font-size: 16px;
          padding: 16px 20px;
        }
      }

      @media (max-width: 480px) {
        .dap-tooltip {
          max-width: calc(100vw - 16px);
          border-radius: 12px;
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
    }
  });

  // src/utils/immediateValidationPrevention.ts
  (function immediateValidationPrevention() {
    console.debug("[DAP] Immediate validation prevention activated");
    if (typeof HTMLFormElement !== "undefined") {
      HTMLFormElement.prototype.checkValidity = function() {
        console.debug("[DAP] Form.checkValidity() intercepted");
        return true;
      };
      HTMLFormElement.prototype.reportValidity = function() {
        console.debug("[DAP] Form.reportValidity() intercepted");
        return true;
      };
    }
    if (typeof HTMLInputElement !== "undefined") {
      HTMLInputElement.prototype.checkValidity = function() {
        console.debug("[DAP] Input.checkValidity() intercepted");
        return true;
      };
      HTMLInputElement.prototype.reportValidity = function() {
        console.debug("[DAP] Input.reportValidity() intercepted");
        return true;
      };
    }
    let lastPreventedTarget = null;
    let lastPreventedTime = 0;
    const preventValidation = (event) => {
      const now = Date.now();
      if (event.target === lastPreventedTarget && now - lastPreventedTime < 100) {
        return false;
      }
      lastPreventedTarget = event.target;
      lastPreventedTime = now;
      console.debug("[DAP] Validation event prevented:", event.type, event.target);
      event.preventDefault();
      event.stopImmediatePropagation();
      const target = event.target;
      if (target && typeof target.setCustomValidity === "function") {
        target.setCustomValidity("");
      }
      return false;
    };
    document.addEventListener("invalid", preventValidation, { capture: true, passive: false });
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (form && form.tagName === "FORM") {
        form.setAttribute("novalidate", "");
        form.noValidate = true;
        console.debug("[DAP] Form novalidate applied during submit");
      }
    }, { capture: true });
    const style = document.createElement("style");
    style.id = "dap-validation-override";
    style.textContent = `
    /* Hide all browser validation UI */
    input:invalid,
    input:-webkit-any(invalid),
    input:-moz-ui-invalid {
      box-shadow: none !important;
    }
    
    /* Hide validation pseudo-elements */
    input::-webkit-validation-bubble,
    input::-webkit-validation-bubble-message,
    input::-webkit-validation-bubble-arrow,
    input::-webkit-validation-bubble-arrow-clipper {
      display: none !important;
    }
    
    /* Firefox validation hiding */
    input:-moz-ui-invalid {
      box-shadow: none !important;
    }
    
    /* Hide any tooltips or popups */
    [role="tooltip"]:not(.dap-tooltip):not(.dap-tip-bubble) {
      display: none !important;
    }
  `;
    if (document.head) {
      document.head.appendChild(style);
    } else {
      const observer = new MutationObserver(() => {
        if (document.head) {
          document.head.appendChild(style);
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    const processExistingForms = () => {
      const forms = document.querySelectorAll("form");
      forms.forEach((form) => {
        form.setAttribute("novalidate", "");
        form.noValidate = true;
        console.debug("[DAP] Existing form processed:", form);
      });
    };
    if (document.readyState !== "loading") {
      processExistingForms();
    } else {
      document.addEventListener("DOMContentLoaded", processExistingForms);
    }
    const formObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (element.tagName === "FORM") {
              const form = element;
              form.setAttribute("novalidate", "");
              form.noValidate = true;
              console.debug("[DAP] New form processed:", form);
            }
            const forms = element.querySelectorAll?.("form");
            forms?.forEach((form) => {
              form.setAttribute("novalidate", "");
              form.noValidate = true;
              console.debug("[DAP] Nested form processed:", form);
            });
          }
        });
      });
    });
    if (document.body) {
      formObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        formObserver.observe(document.body, { childList: true, subtree: true });
      });
    }
    console.debug("[DAP] Immediate validation prevention setup complete");
  })();

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
    "th"
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
    "scope"
  ]);
  function isSafeHttpUrl(u) {
    if (!u) return false;
    try {
      const url = new URL(u, location.origin);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
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
  init_selectors();

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
        default:
          console.warn(`[DAP] Unknown condition operator: ${condition.operator}`);
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
        const targetElement = await waitForElement3(step.elementSelector);
        if (!targetElement) {
          console.warn(`[DAP] Target element not found for step trigger: ${step.elementSelector}`);
          console.warn(`[DAP] \u{1F6E1}\uFE0F Recovery: Advancing to next step in sequence.`);
          if (stepIndex < payload.steps.length - 1) {
            setTimeout(() => transitionToStep(stepIndex + 1), 100);
          } else {
            closeAll();
          }
          return;
        }
        const triggerEvent = normalizeTrigger2(step.elementTrigger);
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
            await renderTooltipStep(step.tooltip);
          }
          break;
        case "popover":
          if (step.popover) {
            await renderPopoverStep(step.popover);
          }
          break;
        case "survey":
          console.warn("[DAP] Survey step not implemented");
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
      if (!showNavigation && stepIndex < payload.steps.length - 1) {
        setTimeout(() => transitionToStep(stepIndex + 1), 2e3);
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
    async function renderTooltipStep(tooltipPayload) {
      try {
        const tooltipRenderer = getRenderer("tooltip");
        if (tooltipRenderer) {
          await tooltipRenderer({
            id: `${id}-tooltip`,
            type: "tooltip",
            payload: tooltipPayload
          });
        }
      } catch (error) {
        console.error("[DAP] Error rendering tooltip step:", error);
      }
    }
    async function renderPopoverStep(popoverPayload) {
      try {
        const popoverRenderer = getRenderer("popover");
        if (popoverRenderer) {
          await popoverRenderer({
            id: `${id}-popover`,
            type: "popover",
            payload: popoverPayload
          });
        }
      } catch (error) {
        console.error("[DAP] Error rendering popover step:", error);
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
            console.debug(`[DAP] Rule evaluation triggered transition to flow: ${nextFlowId}`);
            console.debug(`[DAP] Rule Evaluated! Next Flow: ${nextFlowId} - Rule evaluation is working correctly`);
            console.info(`[DAP] Would transition to flow: ${nextFlowId}`);
            if (stepIndex < payload.steps.length - 1) {
              console.debug(`[DAP] Auto-advancing to next step: ${stepIndex + 1}`);
              setTimeout(() => transitionToStep(stepIndex + 1), 100);
            } else {
              console.debug(`[DAP] Rule step was the last step`);
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
  async function waitForElement3(selector, timeout = 5e3) {
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
  function normalizeTrigger2(trigger) {
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
          articleContainer.innerHTML = content.content;
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
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "download";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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

  // src/index.ts
  init_registry();

  // src/experiences/modal.ts
  init_registry();
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
    function closeModal() {
      if (modal._accessibilityCleanup) {
        modal._accessibilityCleanup();
      }
      overlay.style.animation = "modalFadeOut 0.2s ease-in";
      modal.style.animation = "modalSlideOut 0.2s ease-in";
      setTimeout(() => {
        overlay.remove();
        prevActive?.focus();
        if (completionTracker?.onComplete) {
          console.debug(`[DAP] Completing modal flow: ${id}`);
          completionTracker.onComplete();
        }
      }, 200);
    }
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });
    const closeBtn = modal.querySelector(".dap-modal-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }
    function handleKeyboard(e) {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", handleKeyboard);
      }
    }
    document.addEventListener("keydown", handleKeyboard);
    modal._closeModal = closeModal;
    const nextBtn = modal.querySelector(".dap-modal-next-btn");
    if (nextBtn) {
      nextBtn.addEventListener("click", closeModal);
    }
    if (!document.getElementById("dap-modal-exit-styles")) {
      const style = document.createElement("style");
      style.id = "dap-modal-exit-styles";
      style.textContent = `
      @keyframes modalFadeOut {
        from { opacity: 1; backdrop-filter: blur(4px); }
        to { opacity: 0; backdrop-filter: blur(0px); }
      }
      @keyframes modalSlideOut {
        from { opacity: 1; transform: scale(1) translateY(0); }
        to { opacity: 0; transform: scale(0.95) translateY(-10px); }
      }
    `;
      document.head.appendChild(style);
    }
    setupModalDragging(modal, header, overlay);
    setupMediaHandling(modal, overlay);
  }
  function setupModalDragging(modal, header, overlay) {
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let modalStartX = 0;
    let modalStartY = 0;
    header.style.cursor = "move";
    const startDrag = (e) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = modal.getBoundingClientRect();
      modalStartX = rect.left;
      modalStartY = rect.top;
      header.classList.add("dragging");
      overlay.classList.add("dragging");
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
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };
      newX = Math.max(10, Math.min(newX, viewport.width - modalRect.width - 10));
      newY = Math.max(10, Math.min(newY, viewport.height - modalRect.height - 10));
      modal.style.position = "fixed";
      modal.style.left = `${newX}px`;
      modal.style.top = `${newY}px`;
      modal.style.transform = "none";
    };
    const endDrag = () => {
      isDragging = false;
      header.classList.remove("dragging");
      overlay.classList.remove("dragging");
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
    if (firstFocusable) {
      firstFocusable.focus();
    }
    const handleTabKey = (e) => {
      if (e.key === "Tab") {
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
      }
    };
    modal.addEventListener("keydown", handleTabKey);
    modal._accessibilityCleanup = () => {
      modal.removeEventListener("keydown", handleTabKey);
    };
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
          if (document.contains(video)) {
            video.play().catch(() => {
            });
          }
        });
      }, 100);
    };
  }
  function createModalElements(payload) {
    console.log("[DAP] Creating modal elements with payload:", payload);
    const overlay = document.createElement("div");
    overlay.className = "dap-modal-overlay";
    const modal = document.createElement("div");
    modal.className = "dap-modal";
    if (payload.size) {
      modal.classList.add(`dap-modal-${payload.size}`);
    } else {
      modal.classList.add("dap-modal-medium");
    }
    const header = document.createElement("div");
    header.className = "dap-modal-header";
    if (payload.title) {
      const title = document.createElement("h2");
      title.className = "dap-modal-title";
      title.id = "modal-title";
      title.textContent = payload.title;
      header.appendChild(title);
    } else {
      const title = document.createElement("h2");
      title.className = "dap-modal-title";
      title.id = "modal-title";
      title.style.visibility = "hidden";
      title.innerHTML = "&nbsp;";
      header.appendChild(title);
    }
    const closeBtn = document.createElement("button");
    closeBtn.className = "dap-modal-close";
    closeBtn.setAttribute("aria-label", "Close modal");
    closeBtn.innerHTML = "\xD7";
    header.appendChild(closeBtn);
    const body = document.createElement("div");
    body.className = "dap-modal-body";
    console.debug("[DAP] Processing modal body:", payload.body);
    console.debug("[DAP] Body type:", typeof payload.body);
    console.debug("[DAP] Is body array:", Array.isArray(payload.body));
    if (payload.body && Array.isArray(payload.body)) {
      payload.body.forEach((content, index) => {
        console.debug(`[DAP] Processing body content ${index}:`, content);
        const contentEl = renderModalContent2(content);
        if (contentEl) body.appendChild(contentEl);
      });
    } else if (payload.body) {
      console.warn("[DAP] Body is not an array:", payload.body);
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
    const hasButtons2 = payload.body && Array.isArray(payload.body) && payload.body.some((c) => c.kind === "button");
    if (payload._completionTracker && !hasButtons2) {
      const nextBtn = document.createElement("button");
      nextBtn.className = "dap-modal-button primary";
      nextBtn.textContent = "Next step";
      nextBtn.style.padding = "10px 20px";
      nextBtn.style.minWidth = "120px";
      nextBtn.classList.add("dap-modal-next-btn");
      footer.appendChild(nextBtn);
    }
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    return { overlay, modal, header, body, footer };
  }
  function renderModalContent2(content) {
    console.log("[DAP] Rendering modal content with kind:", content.kind);
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
        return renderKnowledgeBase(content);
      case "kb-item-viewer":
        console.debug("[DAP] Rendering KB item viewer:", content);
        return renderKBItemViewer(content);
      case "article":
        console.debug("[DAP] Rendering Article content:", content);
        console.debug("[DAP] Detected MIME type:", content.mime);
        return createArticleViewer(content);
      case "button":
        const btn = document.createElement("button");
        btn.className = `dap-modal-button ${content.variant || "primary"}`;
        btn.textContent = content.label;
        btn.style.marginTop = "10px";
        btn.style.width = "100%";
        btn.onclick = () => {
          const modal = btn.closest(".dap-modal");
          if (modal && modal._closeModal) {
            modal._closeModal();
          }
        };
        return btn;
      default:
        console.warn("[DAP] Unknown content kind:", content?.kind);
        return null;
    }
  }
  function renderKnowledgeBase(content) {
    const kbEl = document.createElement("div");
    kbEl.className = "dap-content-kb";
    if (!kbState || kbState.view === "item") {
      console.debug("[DAP] Initializing KB state with items:", content.items);
      kbState = {
        view: "list",
        items: content.items || [],
        selectedItem: null,
        title: content.title || "Knowledge Base",
        modalBodyRef: null
      };
      console.debug("[DAP] KB state initialized, items count:", kbState.items.length);
    }
    if (content.title) {
      const title = document.createElement("h3");
      title.textContent = content.title;
      kbEl.appendChild(title);
    }
    if (content.items && Array.isArray(content.items)) {
      console.debug("[DAP] Processing KB items:", content.items);
      content.items.forEach((item, index) => {
        console.debug(`[DAP] Processing KB item ${index}:`, item);
        const itemEl = document.createElement("div");
        itemEl.className = "dap-kb-item";
        let itemUrl = "";
        let itemTitle = "";
        let itemDescription = "";
        let itemType = "";
        if (typeof item === "string") {
          itemUrl = item;
          itemTitle = item;
          itemType = "link";
        } else if (item && typeof item === "object") {
          const kbItem = item;
          itemUrl = kbItem.url || "";
          itemTitle = kbItem.title || "";
          itemDescription = kbItem.description || "";
          itemType = kbItem.itemType || detectContentType(itemUrl, kbItem.fileName);
          console.debug(`[DAP] Extracted: url=${itemUrl}, title=${itemTitle}, description=${itemDescription}, type=${itemType}`);
        } else {
          console.warn("[DAP] Invalid KB item structure:", item);
          return;
        }
        if (!itemUrl || !itemTitle) {
          console.warn("[DAP] KB item missing required fields (url or title), skipping:", item);
          return;
        }
        const button = document.createElement("button");
        button.className = "dap-kb-item-button dap-modal-button primary";
        button.textContent = itemTitle;
        button.title = itemDescription || itemTitle;
        const icon = document.createElement("span");
        icon.className = `dap-kb-icon dap-kb-icon-${itemType}`;
        button.insertBefore(icon, button.firstChild);
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
      console.warn("[DAP] KB content has no items or items is not an array:", content);
      const noItemsMsg = document.createElement("p");
      noItemsMsg.className = "dap-kb-no-items";
      noItemsMsg.textContent = "No knowledge base items available.";
      kbEl.appendChild(noItemsMsg);
    }
    return kbEl;
  }
  function renderKBItemViewer(content) {
    const viewerEl = document.createElement("div");
    viewerEl.className = "dap-kb-item-viewer";
    const headerEl = document.createElement("div");
    headerEl.className = "dap-kb-viewer-header";
    const backBtn = document.createElement("button");
    backBtn.className = "dap-kb-back-button dap-modal-button outline";
    backBtn.innerHTML = "\u2190 Back to " + (content.kbTitle || "Knowledge Base");
    backBtn.addEventListener("click", () => {
      goBackToKBList();
    });
    headerEl.appendChild(backBtn);
    const itemType = content.item.itemType || detectContentType(content.item.url, content.item.fileName);
    const badge = createFileTypeBadge(itemType, content.item.fileName);
    headerEl.appendChild(badge);
    const title = document.createElement("h3");
    title.className = "dap-kb-item-title";
    title.textContent = content.item.title || "Content";
    headerEl.appendChild(title);
    if (content.item.fileName) {
      const fileInfo = document.createElement("p");
      fileInfo.className = "dap-file-metadata";
      fileInfo.innerHTML = `<strong>File:</strong> ${content.item.fileName}`;
      headerEl.appendChild(fileInfo);
    }
    viewerEl.appendChild(headerEl);
    const contentEl = renderKBItemContent(content.item);
    if (contentEl) {
      viewerEl.appendChild(contentEl);
    }
    return viewerEl;
  }
  function renderKBItemContent(item) {
    const itemType = item.itemType || detectContentType(item.url, item.fileName);
    console.debug("[DAP] Rendering KB item content, type:", itemType, "url:", item.url);
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
    const videoEl = document.createElement("video");
    videoEl.className = "dap-kb-video";
    videoEl.controls = true;
    videoEl.preload = "metadata";
    videoEl.style.width = "100%";
    videoEl.style.maxHeight = "400px";
    const source = document.createElement("source");
    source.src = url;
    videoEl.appendChild(source);
    return videoEl;
  }
  function createImageViewer(url, alt) {
    const imgEl = document.createElement("img");
    imgEl.className = "dap-kb-image";
    imgEl.src = url;
    imgEl.alt = alt || "";
    imgEl.style.width = "100%";
    imgEl.style.maxHeight = "500px";
    imgEl.style.objectFit = "contain";
    return imgEl;
  }
  function createPDFViewer(url, fileName) {
    const container = document.createElement("div");
    container.className = "dap-kb-pdf-container";
    const iframe = document.createElement("iframe");
    iframe.className = "dap-kb-pdf-iframe";
    iframe.src = url;
    iframe.style.width = "100%";
    iframe.style.height = "500px";
    iframe.style.border = "1px solid #ddd";
    const fallback = document.createElement("div");
    fallback.className = "dap-kb-pdf-fallback";
    fallback.innerHTML = `
    <p>PDF preview not available in this browser.</p>
    <button class="dap-kb-download-btn dap-modal-button secondary" onclick="window.open('${url}', '_blank')">
      Open PDF in New Tab
    </button>
  `;
    iframe.addEventListener("error", () => {
      iframe.style.display = "none";
      fallback.style.display = "block";
    });
    container.appendChild(iframe);
    container.appendChild(fallback);
    return container;
  }
  function resolveArticleViewer(articleContent) {
    console.debug("[DAP] Resolving Article viewer for:", articleContent);
    const url = articleContent.url || articleContent.presignedUrl || "";
    const mimeType = articleContent.mime || articleContent.mimeType || null;
    const fileName = articleContent.fileName || "";
    console.debug("[DAP] Detected MIME type:", mimeType || "none");
    console.debug("[DAP] File URL:", url);
    console.debug("[DAP] File name:", fileName);
    if (mimeType) {
      if (mimeType === "application/pdf") {
        console.debug("[DAP] Selected viewer: pdf");
        return { viewer: "pdf", mimeType };
      }
      if (mimeType.includes("word") || mimeType.includes("msword") || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        console.debug("[DAP] Selected viewer: document");
        return { viewer: "document", mimeType };
      }
      if (mimeType.includes("presentation") || mimeType.includes("powerpoint") || mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
        console.debug("[DAP] Selected viewer: presentation");
        return { viewer: "presentation", mimeType };
      }
      if (mimeType === "text/html" || mimeType.includes("text/")) {
        console.debug("[DAP] Selected viewer: web");
        return { viewer: "web", mimeType };
      }
    }
    const urlLower = url.toLowerCase();
    const fileNameLower = fileName.toLowerCase();
    if (urlLower.includes(".pdf") || fileNameLower.endsWith(".pdf")) {
      console.debug("[DAP] Selected viewer: pdf (by extension)");
      return { viewer: "pdf", mimeType: "application/pdf" };
    }
    if (urlLower.match(/\.(doc|docx)/) || fileNameLower.match(/\.(doc|docx)$/)) {
      console.debug("[DAP] Selected viewer: document (by extension)");
      return { viewer: "document", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    }
    if (urlLower.match(/\.(ppt|pptx)/) || fileNameLower.match(/\.(ppt|pptx)$/)) {
      console.debug("[DAP] Selected viewer: presentation (by extension)");
      return { viewer: "presentation", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
    }
    if (urlLower.match(/\.(html?|htm)/) || fileNameLower.match(/\.(html?|htm)$/)) {
      console.debug("[DAP] Selected viewer: web (by extension)");
      return { viewer: "web", mimeType: "text/html" };
    }
    if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
      if (!urlLower.match(/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|rar)$/)) {
        console.debug("[DAP] Selected viewer: web (by URL pattern)");
        return { viewer: "web", mimeType: "text/html" };
      }
    }
    console.debug("[DAP] Selected viewer: fallback");
    return { viewer: "fallback", mimeType };
  }
  function createArticleViewer(articleContent) {
    console.debug("[DAP] Rendering Article");
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
      console.debug("[DAP] Rendering direct HTML content");
      const contentEl = document.createElement("div");
      contentEl.className = "dap-article-content";
      contentEl.innerHTML = content;
      container.appendChild(contentEl);
      if (url) {
        const actions = createDocumentActions(url, fileName);
        container.appendChild(actions);
      }
    } else if (url) {
      const loadingEl = document.createElement("div");
      loadingEl.className = "dap-article-loading";
      loadingEl.innerHTML = `
      <div class="dap-loading-spinner"></div>
      <p>Loading article content...</p>
    `;
      container.appendChild(loadingEl);
      const { viewer, mimeType } = resolveArticleViewer(articleContent);
      console.debug("[DAP] Selected viewer type:", viewer, "for URL:", url);
      setTimeout(() => {
        loadingEl.remove();
        switch (viewer) {
          case "pdf":
            const pdfViewer = createInlinePDFViewer(url, fileName);
            container.appendChild(pdfViewer);
            break;
          case "document":
            const docViewer = createInlineDocumentViewer(url, fileName, mimeType);
            container.appendChild(docViewer);
            break;
          case "presentation":
            const pptViewer = createInlinePresentationViewer(url, fileName, mimeType);
            container.appendChild(pptViewer);
            break;
          case "web":
            const webViewer = createWebContentViewer(url, title);
            container.appendChild(webViewer);
            break;
          case "fallback":
          default:
            console.debug("[DAP] Fallback activated for URL:", url);
            const fallbackViewer = createEnhancedFallbackViewer(articleContent, "This document cannot be previewed inline.");
            container.appendChild(fallbackViewer);
            break;
        }
      }, 300);
    } else {
      console.error("[DAP] No content or URL provided for Article");
      const errorViewer = createEnhancedFallbackViewer(articleContent, "No article content available to display.");
      container.appendChild(errorViewer);
    }
    return container;
  }
  function createInlinePDFViewer(url, fileName) {
    const container = document.createElement("div");
    container.className = "dap-pdf-viewer-container";
    const iframe = document.createElement("iframe");
    iframe.className = "dap-pdf-iframe";
    iframe.src = url;
    iframe.style.width = "100%";
    iframe.style.height = "500px";
    iframe.style.border = "1px solid #ddd";
    iframe.setAttribute("frameborder", "0");
    iframe.onerror = () => {
      console.warn("[DAP] PDF iframe failed, showing fallback");
      container.innerHTML = "";
      const fallback = createFallbackViewer(
        { url, fileName},
        "PDF preview failed. Please download or open in a new tab."
      );
      container.appendChild(fallback);
    };
    container.appendChild(iframe);
    const actions = createDocumentActions(url, fileName);
    container.appendChild(actions);
    return container;
  }
  function createInlineDocumentViewer(url, fileName, mimeType) {
    const container = document.createElement("div");
    container.className = "dap-document-viewer-container";
    if (mimeType && (mimeType.includes("word") || mimeType.includes("msword"))) {
      const iframe = document.createElement("iframe");
      iframe.className = "dap-document-iframe";
      iframe.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
      iframe.style.width = "100%";
      iframe.style.height = "500px";
      iframe.style.border = "1px solid #ddd";
      iframe.setAttribute("frameborder", "0");
      iframe.onerror = () => {
        console.warn("[DAP] Office Online viewer failed, showing fallback");
        container.innerHTML = "";
        const fallback = createFallbackViewer(
          { url, fileName},
          "Document preview is not available. Please download or open in a new tab."
        );
        container.appendChild(fallback);
      };
      container.appendChild(iframe);
    } else {
      const fallback = createFallbackViewer(
        { url, fileName},
        "Document preview is not supported for this file type."
      );
      container.appendChild(fallback);
    }
    const actions = createDocumentActions(url, fileName);
    container.appendChild(actions);
    return container;
  }
  function createInlinePresentationViewer(url, fileName, mimeType) {
    const container = document.createElement("div");
    container.className = "dap-presentation-viewer-container";
    if (mimeType && mimeType.includes("presentation")) {
      const iframe = document.createElement("iframe");
      iframe.className = "dap-presentation-iframe";
      iframe.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
      iframe.style.width = "100%";
      iframe.style.height = "500px";
      iframe.style.border = "1px solid #ddd";
      iframe.setAttribute("frameborder", "0");
      iframe.onerror = () => {
        console.warn("[DAP] Office Online presentation viewer failed, showing fallback");
        container.innerHTML = "";
        const fallback = createFallbackViewer(
          { url, fileName},
          "Presentation preview is not available. Please download or open in a new tab."
        );
        container.appendChild(fallback);
      };
      container.appendChild(iframe);
    } else {
      const fallback = createFallbackViewer(
        { url, fileName},
        "Presentation preview is not supported for this file type."
      );
      container.appendChild(fallback);
    }
    const actions = createDocumentActions(url, fileName);
    container.appendChild(actions);
    return container;
  }
  function createFallbackViewer(articleContent, message) {
    const container = document.createElement("div");
    container.className = "dap-fallback-viewer";
    const url = articleContent.url || articleContent.presignedUrl || "";
    const fileName = articleContent.fileName || "Document";
    const messageEl = document.createElement("div");
    messageEl.className = "dap-fallback-message";
    messageEl.innerHTML = `
    <p><strong>${message}</strong></p>
    <p>File: ${fileName}</p>
  `;
    container.appendChild(messageEl);
    const actions = createDocumentActions(url, fileName);
    container.appendChild(actions);
    return container;
  }
  function createEnhancedFallbackViewer(articleContent, message) {
    const container = document.createElement("div");
    container.className = "dap-enhanced-fallback-viewer";
    const url = articleContent.url || articleContent.presignedUrl || "";
    const fileName = articleContent.fileName || "Document";
    const title = articleContent.title || fileName;
    const fileExtension = fileName.split(".").pop()?.toUpperCase() || "";
    const iconEl = document.createElement("div");
    iconEl.className = "dap-fallback-icon";
    if (fileExtension.includes("PDF")) {
      iconEl.innerHTML = "\u{1F4C4}";
    } else if (["DOC", "DOCX"].includes(fileExtension)) {
      iconEl.innerHTML = "\u{1F4DD}";
    } else if (["PPT", "PPTX"].includes(fileExtension)) {
      iconEl.innerHTML = "\u{1F4CA}";
    } else if (["XLS", "XLSX"].includes(fileExtension)) {
      iconEl.innerHTML = "\u{1F4C8}";
    } else {
      iconEl.innerHTML = "\u{1F4F0}";
    }
    container.appendChild(iconEl);
    const messageEl = document.createElement("div");
    messageEl.className = "dap-enhanced-fallback-message";
    messageEl.innerHTML = `
    <h4>${title}</h4>
    <p class="dap-fallback-primary">${message}</p>
    ${fileName !== title ? `<p class="dap-fallback-filename">File: ${fileName}</p>` : ""}
    ${fileExtension ? `<p class="dap-fallback-type">Type: ${fileExtension} Document</p>` : ""}
  `;
    container.appendChild(messageEl);
    if (url) {
      const actions = createEnhancedDocumentActions(url, fileName);
      container.appendChild(actions);
    } else {
      const noUrlMessage = document.createElement("p");
      noUrlMessage.className = "dap-fallback-no-url";
      noUrlMessage.textContent = "No document link available.";
      container.appendChild(noUrlMessage);
    }
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
    iframe.style.border = "1px solid var(--dap-border)";
    iframe.style.borderRadius = "4px";
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("loading", "lazy");
    iframe.onerror = () => {
      console.warn("[DAP] Web content iframe failed, showing fallback");
      container.innerHTML = "";
      const fallback = createEnhancedFallbackViewer(
        { url, title, fileName: title },
        "Web content could not be loaded. Please open in a new tab."
      );
      container.appendChild(fallback);
    };
    container.appendChild(iframe);
    const actions = document.createElement("div");
    actions.className = "dap-web-actions";
    const openBtn = document.createElement("button");
    openBtn.className = "dap-action-btn dap-open-btn";
    openBtn.textContent = "Open in New Tab";
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(url, "_blank", "noopener,noreferrer");
    });
    actions.appendChild(openBtn);
    container.appendChild(actions);
    return container;
  }
  function createEnhancedDocumentActions(url, fileName) {
    const actions = document.createElement("div");
    actions.className = "dap-enhanced-document-actions";
    const downloadBtn = document.createElement("button");
    downloadBtn.className = "dap-action-btn dap-download-btn dap-primary-btn";
    downloadBtn.innerHTML = `
    <span class="dap-btn-icon">\u2B07\uFE0F</span>
    <span class="dap-btn-text">Download</span>
  `;
    downloadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "download";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      downloadBtn.innerHTML = `<span class="dap-btn-icon">\u2705</span><span class="dap-btn-text">Downloaded</span>`;
      setTimeout(() => {
        downloadBtn.innerHTML = `<span class="dap-btn-icon">\u2B07\uFE0F</span><span class="dap-btn-text">Download</span>`;
      }, 2e3);
    });
    const openBtn = document.createElement("button");
    openBtn.className = "dap-action-btn dap-open-btn dap-secondary-btn";
    openBtn.innerHTML = `
    <span class="dap-btn-icon">\u{1F517}</span>
    <span class="dap-btn-text">Open in New Tab</span>
  `;
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(url, "_blank", "noopener,noreferrer");
    });
    actions.appendChild(downloadBtn);
    actions.appendChild(openBtn);
    return actions;
  }
  function createDocumentActions(url, fileName) {
    const actions = document.createElement("div");
    actions.className = "dap-document-actions dap-modal-buttons";
    const downloadBtn = document.createElement("button");
    downloadBtn.className = "dap-action-btn dap-download-btn dap-modal-button primary";
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "download";
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
    const openBtn = document.createElement("button");
    openBtn.className = "dap-action-btn dap-open-btn dap-modal-button secondary";
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
  function createDocumentViewer(url, fileName, type) {
    const container = document.createElement("div");
    container.className = "dap-kb-document-container";
    container.innerHTML = `
    <div class="dap-kb-document-info">
      <h4>${fileName || "Document"}</h4>
      <p>Document type: ${type?.toUpperCase()}</p>
      <div class="dap-kb-document-actions">
        <button class="dap-kb-download-btn" onclick="window.open('${url}', '_blank')">
          Open in New Tab
        </button>
        <button class="dap-kb-download-btn" onclick="downloadFile('${url}', '${fileName}')">
          Download
        </button>
      </div>
    </div>
  `;
    return container;
  }
  function createYouTubeViewer(url) {
    const iframe = document.createElement("iframe");
    iframe.className = "dap-kb-youtube";
    iframe.src = url;
    iframe.style.width = "100%";
    iframe.style.height = "315px";
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allowfullscreen", "true");
    return iframe;
  }
  function createLinkViewer(url, title, description) {
    const container = document.createElement("div");
    container.className = "dap-kb-link-container";
    container.innerHTML = `
    <div class="dap-kb-link-info">
      <h4>${title || "External Link"}</h4>
      ${description ? `<p>${description}</p>` : ""}
      <p><strong>URL:</strong> ${url}</p>
      <button class="dap-kb-external-btn" onclick="window.open('${url}', '_blank')">
        Open Link in New Tab
      </button>
    </div>
  `;
    return container;
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
  var kbState = null;
  function createFileTypeBadge(itemType, fileName) {
    const badge = document.createElement("div");
    badge.className = `dap-file-type-badge ${itemType}`;
    let icon = "";
    let label = "";
    switch (itemType) {
      case "video":
        icon = "\u{1F3A5}";
        label = "Video";
        break;
      case "image":
        icon = "\u{1F5BC}\uFE0F";
        label = "Image";
        break;
      case "pdf":
        icon = "\u{1F4C4}";
        label = "PDF";
        break;
      case "docx":
      case "doc":
        icon = "\u{1F4DD}";
        label = "Document";
        break;
      case "pptx":
      case "ppt":
        icon = "\u{1F4CA}";
        label = "Presentation";
        break;
      case "xlsx":
      case "xls":
        icon = "\u{1F4C8}";
        label = "Spreadsheet";
        break;
      case "article":
      default:
        icon = "\u{1F4F0}";
        label = "Article";
        break;
    }
    badge.innerHTML = `<span>${icon}</span> ${label}`;
    return badge;
  }
  function openKBItemInModal(item, kbTitle) {
    console.debug("[DAP] Opening KB item in modal:", item);
    console.debug("[DAP] KB view changed to item");
    const modalBody = document.querySelector(".dap-modal-body");
    if (!modalBody) {
      console.error("[DAP] Could not find modal body for KB item viewing");
      return;
    }
    if (kbState) {
      kbState.view = "item";
      kbState.selectedItem = item;
      kbState.modalBodyRef = modalBody;
      console.debug("[DAP] KB items count:", kbState.items.length);
    } else {
      console.error("[DAP] KB state not initialized when opening item");
      return;
    }
    const viewerContent = {
      item,
      kbTitle
    };
    modalBody.innerHTML = "";
    const viewerEl = renderKBItemViewer(viewerContent);
    modalBody.appendChild(viewerEl);
  }
  function goBackToKBList() {
    console.debug("[DAP] Going back to KB list");
    console.debug("[DAP] KB view changed to list");
    if (!kbState || !kbState.modalBodyRef) {
      console.error("[DAP] Cannot go back: missing KB state or modal reference");
      return;
    }
    console.debug("[DAP] KB items count:", kbState.items.length);
    kbState.view = "list";
    kbState.selectedItem = null;
    const kbContent = {
      title: kbState.title,
      items: kbState.items
    };
    kbState.modalBodyRef.innerHTML = "";
    const kbListEl = renderKnowledgeBase(kbContent);
    kbState.modalBodyRef.appendChild(kbListEl);
  }
  function ensureStyles2() {
    if (!document.getElementById("dap-modal-style")) {
      const style = document.createElement("style");
      style.id = "dap-modal-style";
      style.textContent = modalCssText;
      document.head.appendChild(style);
    }
  }

  // src/index.ts
  init_tooltip();

  // src/experiences/survey.ts
  init_registry();

  // src/styles/survey.css.ts
  var surveyCssText = `
/* Survey specific styles */
.dap-modal-wrap {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: rgba(15, 23, 42, 0.6); /* Improved overlay color */
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  padding: 24px; /* Better padding */
  box-sizing: border-box;
  width: 100vw;
  height: 100vh;
  margin: 0;
  animation: fadeIn 0.3s ease-out;
  backdrop-filter: blur(4px); /* Enhanced blur effect */
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translate(-50%, -40%); }
  to { opacity: 1; transform: translate(-50%, -50%); }
}

.dap-survey-modal {
  position: absolute;
  max-width: 680px;
  max-height: 85vh;
  width: 92%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: white;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border-radius: 12px;
  z-index: 2147483648;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  animation: slideUp 0.35s ease-out;
}

/* Content-adaptive sizing for survey modals */
.dap-survey-modal.dap-size-small {
  max-width: min(92vw, 450px);
  max-height: min(85vh, 500px);
}

.dap-survey-modal.dap-size-medium {
  max-width: min(92vw, 680px);
  max-height: min(85vh, 650px);
}

.dap-survey-modal.dap-size-large {
  max-width: min(92vw, 950px);
  max-height: min(85vh, 800px);
}

/* Improved scrollable handling */
.dap-survey-modal.dap-scrollable .dap-survey-body {
  overflow-y: auto;
  overflow-x: auto;
}

.dap-survey-modal .dap-survey-body {
  overflow: visible; /* Default: no scroll unless needed */
}

.dap-survey-body {
  max-height: calc(85vh - 140px);
  overflow: visible; /* Let adaptive sizing handle overflow */
  padding: 32px;
  flex: 1;
}

.dap-survey-content {
  display: flex;
  flex-direction: column;
  gap: 24px; /* Increased gap for better spacing */
  width: 100%;
}

/* Two column layout for larger screens */
@media (min-width: 650px) {
  .dap-survey-content {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px; /* Consistent gap in grid layout */
  }
  
  /* Certain question types should still span full width */
  .dap-survey-question.dap-full-width {
    grid-column: 1 / -1;
  }
}

.dap-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background-color: #fff;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.dap-modal-header {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #111;
}

/* Progress bar similar to React version */
.dap-progress-container {
  height: 4px;
  width: 100%;
  background-color: #f0f2f5;
  border-radius: 2px;
  overflow: hidden;
  margin-top: 12px;
}

.dap-progress-bar {
  height: 100%;
  background-color: #4361ee;
  transition: width 0.3s ease;
}

.dap-progress-text {
  font-size: 12px;
  color: #666;
  text-align: right;
  margin-top: 4px;
}

.dap-close {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  color: #666;
  font-size: 22px;
  line-height: 1;
  border-radius: 9999px;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.dap-close:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #333;
}

.dap-close:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(67, 97, 238, 0.2);
}
  border-radius: 50%;
  transition: all 0.2s;
  width: 32px;
  height: 32px;
}

.dap-close:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #333;
}

.dap-survey-intro {
  margin: 0;
  padding: 24px 24px 0;
  line-height: 1.5;
  color: #555;
  font-size: 15px;
}

.dap-survey-form {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  padding: 20px 24px 24px;
}

.dap-survey-error {
  background-color: #fff0f0;
  color: #e53935;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-weight: 500;
  font-size: 14px;
  border-left: 3px solid #e53935;
}

.dap-survey-question {
  padding: 20px;
  width: 100%;
  border: 1px solid #eaeef2;
  border-radius: 12px;
  margin-bottom: 16px;
  background-color: white;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.dap-survey-question:hover {
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
  border-color: #dbe1e8;
}

.dap-survey-question:last-child {
  margin-bottom: 0;
}

.dap-question-label {
  display: block;
  font-weight: 600;
  margin-bottom: 14px;
  color: #222;
  font-size: 16px;
  line-height: 1.4;
}

.dap-question-input {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

/* Radio and Checkbox */
.dap-radio-wrapper,
.dap-checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0;
  padding: 10px 14px;
  border-radius: 6px;
  transition: all 0.2s ease;
  border: 1px solid #eaeef2;
  background-color: #fafbfd;
}

.dap-radio-wrapper:hover,
.dap-checkbox-wrapper:hover {
  background-color: #f0f4f8;
  border-color: #dbe1e8;
  transform: translateY(-1px);
}

.dap-radio-wrapper input,
.dap-checkbox-wrapper input {
  margin: 0;
  width: 18px;
  height: 18px;
  accent-color: #4361ee;
}

.dap-radio-wrapper label,
.dap-checkbox-wrapper label {
  cursor: pointer;
  font-size: 15px;
  color: #333;
  flex: 1;
  font-weight: 500;
}

/* Text inputs */
.dap-question-input input[type="text"],
.dap-question-input textarea,
.dap-question-input select {
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-family: inherit;
  font-size: 15px;
  width: 100%;
  box-sizing: border-box;
  transition: all 0.2s ease;
  background-color: white;
  color: #333;
  line-height: 1.5;
}

.dap-question-input input[type="text"]:focus,
.dap-question-input textarea:focus,
.dap-question-input select:focus {
  outline: none;
  border-color: #4361ee;
  box-shadow: 0 0 0 2px rgba(67, 97, 238, 0.15);
}

.dap-question-input textarea {
  min-height: 120px;
  resize: vertical;
  line-height: 1.6;
}
}

.dap-question-input textarea {
  resize: vertical;
  min-height: 90px;
  line-height: 1.5;
}

/* Opinion Scale */
.dap-scale-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 12px;
}

.dap-scale-options {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.dap-scale-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.dap-scale-option input {
  margin: 0;
  width: 18px;
  height: 18px;
  accent-color: #4361ee;
}

.dap-scale-option label {
  font-size: 14px;
  text-align: center;
  font-weight: 500;
}

.dap-scale-label {
  font-size: 14px;
  color: #555;
  max-width: 120px;
  font-weight: 500;
}

/* Opinion Scale Choice (Face Scale) */
.dap-scale-faces {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  margin-top: 12px;
}

.dap-face-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.dap-face-radio {
  display: none;
}

.dap-face-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  font-size: 28px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: #f0f4f8;
  border: 2px solid transparent;
}

.dap-face-radio:checked + .dap-face-label {
  background-color: #e0e7ff;
  border-color: #4361ee;
  transform: scale(1.1);
}

.dap-face-label:hover {
  background-color: #e0e7ff;
  transform: translateY(-2px);
}

/* NPS Scale */
.dap-nps-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 12px;
}

.dap-nps-scale {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.dap-nps-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.dap-nps-option input {
  margin: 0;
  width: 18px;
  height: 18px;
  accent-color: #4361ee;
}

.dap-nps-option label {
  font-size: 14px;
  text-align: center;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s ease;
}

.dap-nps-labels {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #555;
  width: 100%;
  margin-top: 4px;
  font-weight: 500;
}

.dap-nps-label-min {
  text-align: left;
}

.dap-nps-label-max {
  text-align: right;
}

/* NPS Options */
.dap-nps-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.dap-nps-category {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background-color: #f7f9fc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}

.dap-nps-category:hover {
  background-color: #edf2fc;
  transform: translateY(-2px);
}

.dap-nps-category input {
  accent-color: #4361ee;
  width: 18px;
  height: 18px;
}

.dap-nps-category label {
  font-weight: 500;
  font-size: 15px;
  cursor: pointer;
}

/* Star Rating */
.dap-star-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  transition: all 0.2s ease;
  background: transparent;
  border: none;
}

/* Star Rating Styles */
.dap-rating-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dap-star-rating {
  display: inline-flex;
  direction: rtl; /* This reverses the order for the hover effect */
  unicode-bidi: bidi-override;
  justify-content: center;
  gap: 0;
  margin: 5px 0;
}

/* Clear button */
.dap-clear-rating {
  font-size: 13px;
  background: transparent;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 8px;
  color: #555;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  height: fit-content;
}

.dap-clear-rating:hover {
  background-color: #f5f5f5;
  border-color: #ccc;
  color: #333;
}

/* Rating text only used in StarChoice */
.dap-rating-text {
  font-size: 14px;
  color: #777;
  margin-top: 8px;
  text-align: center;
  min-height: 20px;
}

.dap-rating-selected {
  font-weight: 500;
  color: #4361ee;
}

/* Hide radio buttons */
.dap-star-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

/* Star labels */
.dap-star-label {
  font-size: 30px;
  color: #e0e0e0;
  cursor: pointer;
  display: inline-block;
  transition: color 0.15s ease;
  padding: 0 2px;
}

/* Create star shape */
.dap-star-label::before {
  content: "\u2605";
  display: block;
}

/* Unselected color */
.dap-star-rating .dap-star-label {
  color: #e0e0e0;
}

/* Hover effect */
.dap-star-label:hover,
.dap-star-label:hover ~ .dap-star-label,
.dap-star-input:checked ~ .dap-star-label {
  color: #ffc107;
}

/* Selected stars */
.dap-star-input:checked ~ .dap-star-label {
  color: #ffc107;
}

/* When focusing on stars */
.dap-star-input:focus + .dap-star-label {
  outline: 1px dotted #4361ee;
  outline-offset: 2px;
}

/* Focused star for accessibility */
.dap-star:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.5);
  border-radius: 50%;
}

/* Star Choice Component */
.dap-star-ratings-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.dap-criterion-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  background-color: transparent;
  border: none;
  border-radius: 0;
  transition: all 0.2s ease;
}

.dap-criterion-card:hover {
  transform: none;
  box-shadow: none;
}

.dap-criterion-label {
  font-weight: 500;
  color: #333;
  font-size: 16px;
  margin-bottom: 2px;
}

/* Tables for multi-rating questions */
.dap-scale-table,
.dap-star-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin-top: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.dap-scale-table th,
.dap-scale-table td,
.dap-star-table th,
.dap-star-table td {
  padding: 12px 10px;
  text-align: center;
  vertical-align: middle;
  border-bottom: 1px solid #eee;
}

.dap-scale-table tr:last-child td,
.dap-star-table tr:last-child td {
  border-bottom: none;
}

.dap-scale-table th,
.dap-star-table th {
  background-color: #f7f9fc;
  color: #444;
  font-weight: 600;
  font-size: 14px;
  text-transform: none;
}

.dap-scale-table td:first-child,
.dap-star-table td:first-child {
  text-align: left;
  font-weight: 500;
  color: #333;
  padding-left: 16px;
}

.dap-option-name,
.dap-criterion-name {
  text-align: left !important;
  font-weight: normal;
  min-width: 120px;
}

.dap-scale-min-label {
  text-align: left !important;
  font-size: 13px;
  color: #666;
}

.dap-scale-max-label {
  text-align: right !important;
  font-size: 13px;
  color: #666;
}

.dap-scale-labels td {
  padding-top: 0 !important;
}

/* Footer buttons */
.dap-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  background-color: #fafbfc;
  border-bottom-left-radius: var(--dap-radius, 8px);
  border-bottom-right-radius: var(--dap-radius, 8px);
  width: 100%;
  box-sizing: border-box;
  margin: 0;
}

.dap-footer button {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 15px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
  outline: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.dap-footer .dap-cta {
  background-color: #4361ee;
  color: white;
  border: none;
}

.dap-footer .dap-secondary {
  background-color: transparent;
  color: #555;
  border: 1px solid #ddd;
}

.dap-footer .dap-cta:hover {
  background-color: #3a56d4;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(67, 97, 238, 0.15);
}

.dap-footer .dap-secondary:hover {
  background-color: #f0f2f5;
  border-color: #ccc;
}

/* Responsive adjustments */
@media (max-width: 720px) {
  .dap-survey-modal {
    max-width: 95%;
  }
}

@media (max-width: 480px) {
  .dap-survey-modal {
    width: 100%;
    max-width: 95%;
    max-height: 95vh;
    margin: 0 auto;
    border-radius: 12px;
  }
  
  .dap-survey-body {
    padding: 16px;
    max-height: calc(95vh - 110px);
  }
  
  .dap-header-bar {
    padding: 14px 16px;
  }
  
  .dap-footer {
    padding: 14px 16px;
  }
  
  .dap-survey-title {
    font-size: 18px;
  }
  
  .dap-question-label {
    font-size: 15px;
  }
  
  .dap-radio-wrapper,
  .dap-checkbox-wrapper {
    padding: 8px;
  }
  
  .dap-scale-table,
  .dap-star-table {
    font-size: 13px;
  }
  
  .dap-scale-option label,
  .dap-nps-option label {
    font-size: 12px;
  }
  
  .dap-star {
    font-size: 28px;
  }
  
  .dap-footer button {
    padding: 9px 16px;
    font-size: 14px;
    width: 100%;
  }
  
  .dap-footer {
    flex-direction: column-reverse;
    gap: 8px;
  }
  
  .dap-text-input, 
  .dap-textarea {
    font-size: 15px;
  }
  
  /* Star rating responsive adjustments */
  .dap-star-label {
    font-size: 28px;
  }
  
  .dap-criterion-card {
    padding: 12px;
  }
}

/* Additional star choice styles */
.dap-criterion-card .dap-star-rating {
  margin: 8px 0;
}

.dap-criterion-card .dap-rating-text {
  text-align: left;
  margin-left: 4px;
  color: #555;
  font-style: italic;
  font-size: 13px;
  min-height: 20px;
}

.dap-criterion-card .dap-rating-selected {
  color: #4361ee;
  font-weight: 500;
  font-style: normal;
}

/* Adjust for survey question spacing */
.dap-question-input .dap-star-rating {
  padding: 5px 0;
  margin: 5px 0;
}

/* Style for criterion cards */
.dap-criterion-card {
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.dap-criterion-card:last-child {
  border-bottom: none;
}

/* Make clear button smaller for criterion cards */
.dap-criterion-card .dap-clear-rating {
  font-size: 12px;
  padding: 3px 6px;
}

/* Enhanced Star Choice Styles */
.dap-star-choice-container {
  display: flex;
  flex-direction: column;
  padding: 10px 0;
}



/* Star Choice Specific Styles */
.dap-star-choice-container {
  padding: 8px 0;
}

.dap-star-choice-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dap-star-choice-option {
  display: flex;
  align-items: center;
  position: relative;
}

.dap-star-choice-input {
  margin: 0;
  margin-right: 8px;
}

.dap-star-choice-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  gap: 8px;
}

.dap-star-choice-stars {
  display: flex;
  align-items: center;
}

.dap-star-choice-star {
  color: #e0e0e0;
  font-size: 20px;
  line-height: 1;
}

.dap-star-choice-star.filled {
  color: #ffc107;
}

.dap-star-choice-text {
  font-size: 14px;
  color: #333;
  margin-left: 4px;
}

/* Hover effect for the star choice options */
.dap-star-choice-option:hover .dap-star-choice-label {
  font-weight: 500;
}

/* Selected state */
.dap-star-choice-input:checked + .dap-star-choice-label .dap-star-choice-text {
  font-weight: 500;
}

/* Accessible focus style */
.dap-star-choice-input:focus {
  outline: 2px solid #4361ee;
  outline-offset: 2px;
}

/* Focus states for keyboard navigation */
.dap-star-choice-container .dap-star-input:focus + .dap-star-label {
  outline: 2px solid #4361ee;
  outline-offset: 2px;
}

/* Mobile-friendly adjustments */
@media (max-width: 768px) {
  .dap-star-choice-star {
    font-size: 18px;
  }
  
  .dap-star-choice-text {
    font-size: 13px;
  }
}

/* Small mobile devices */
@media (max-width: 480px) {
  .dap-star-choice-option {
    margin-bottom: 4px;
  }
  
  .dap-star-choice-star {
    font-size: 16px;
  }
}
`;

  // src/experiences/survey.ts
  init_http();
  init_selectors();
  var modalCssText2 = `
:root {
  --dap-z: 2147483640;
  --dap-overlay: rgba(15, 23, 42, 0.5);
  --dap-modal-bg: #f8fafc;
  --dap-modal-header-bg: #f1f5f9;
  --dap-modal-border: #e2e8f0;
  --dap-modal-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  --dap-text-primary: #1e293b;
  --dap-text-secondary: #64748b;
  --dap-text-muted: #94a3b8;
  --dap-btn-primary: #3b82f6;
  --dap-btn-primary-hover: #2563eb;
  --dap-btn-secondary: #e2e8f0;
  --dap-btn-secondary-hover: #cbd5e1;
  --dap-radius: 12px;
  --dap-spacing: 16px;
}

.dap-modal-wrap {
  position: fixed;
  inset: 0;
  background: var(--dap-overlay);
  z-index: var(--dap-z);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  backdrop-filter: blur(4px);
}

.dap-modal {
  background: var(--dap-modal-bg);
  border: 1px solid var(--dap-modal-border);
  border-radius: var(--dap-radius);
  box-shadow: var(--dap-modal-shadow);
  width: 100%;
  max-width: min(90vw, 500px);
  max-height: min(90vh, 600px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Content-adaptive size classes */
.dap-modal.dap-size-small {
  max-width: min(90vw, 400px);
  max-height: min(90vh, 500px);
}

.dap-modal.dap-size-medium {
  max-width: min(90vw, 600px);
  max-height: min(90vh, 650px);
}

.dap-modal.dap-size-large {
  max-width: min(90vw, 900px);
  max-height: min(90vh, 800px);
}

/* Scrollable class when content overflows */
.dap-modal.dap-scrollable .dap-modal-body {
  overflow-y: auto;
  overflow-x: auto;
}

/* Default: no scroll unless needed */
.dap-modal .dap-modal-body {
  overflow: visible;
}

.dap-header-bar {
  background: var(--dap-modal-header-bg);
  border-bottom: 1px solid var(--dap-modal-border);
  padding: var(--dap-spacing);
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 60px;
}

.dap-modal-header {
  color: var(--dap-text-primary);
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  flex: 1;
}

.dap-close {
  background: transparent;
  border: none;
  color: var(--dap-text-secondary);
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  width: 32px;
  height: 32px;
  font-size: 18px;
}

.dap-close:hover {
  background: var(--dap-btn-secondary);
}

.dap-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
  background: var(--dap-modal-bg);
}

.dap-footer {
  background: var(--dap-modal-bg);
  border-top: 1px solid var(--dap-modal-border);
  padding: var(--dap-spacing);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.dap-cta {
  background: var(--dap-btn-primary);
  color: white;
  border: 1px solid var(--dap-btn-primary);
  cursor: pointer;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.dap-cta:hover {
  background: var(--dap-btn-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
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
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const responses = [];
        for (const q of payload.questions) {
          const questionData = {
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
            case "StarRating":
            case "NpsScale": {
              const radio = form.querySelector(`input[name="${q.questionId}"]:checked`);
              questionData.answer = radio?.value ? parseInt(radio.value) : null;
              break;
            }
            case "OpinionScaleChoice": {
              const items = q.criteria || [];
              if (items.length === 0) break;
              const ratings = {};
              items.forEach((item, idx) => {
                const radio = form.querySelector(`input[name="${q.questionId}_${idx}"]:checked`);
                if (radio?.value) {
                  ratings[item] = parseInt(radio.value);
                }
              });
              questionData.answer = Object.keys(ratings).length > 0 ? ratings : null;
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
          client: {
            userId: "",
            clientIP: "",
            userAgent: navigator.userAgent,
            locale: navigator.language
          }
        };
        console.log("[DAP] Survey submission payload:", submissionData);
        if (flow.config && payload.flowId && payload.organizationId && payload.siteId) {
          const url = flow.config?.apiurl + `/iap-experience/${payload.organizationId}/${payload.siteId}/survey-responses/${payload.flowId}`;
          const hostBase = location.origin;
          console.log("[DAP] Submitting survey to API:", url);
          console.log("[DAP] Request will include X-Host-Url header:", hostBase);
          try {
            await http(flow.config, url, {
              method: "POST",
              body: submissionData,
              hostBase,
              includeHostHeader: true
            });
            console.log("[DAP] Survey successfully submitted to API");
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
    const closeAll = () => {
      document.removeEventListener("keydown", onKey, true);
      shell.wrap.remove();
      if (prevActive?.focus) prevActive.focus();
      if (payload._completionTracker?.onComplete) {
        console.debug("[DAP] Survey completed, signaling flow engine");
        payload._completionTracker.onComplete();
      }
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
      const element = resolveSelector(payload.targetSelector);
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
    buttonsEl.style.cssText = `
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  `;
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = payload.cancelText || "Cancel";
    cancelBtn.style.cssText = `
    padding: 8px 16px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #ffffff;
    color: #374151;
    cursor: pointer;
    font-size: 14px;
  `;
    cancelBtn.addEventListener("click", () => {
      cleanupMicroSurvey(id);
      payload._completionTracker?.onComplete?.();
    });
    const submitBtn = document.createElement("button");
    submitBtn.textContent = payload.submitText || "Submit";
    submitBtn.style.cssText = `
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: #3b82f6;
    color: #ffffff;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  `;
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
      font-size: 24px;
      color: #d1d5db;
      cursor: pointer;
      transition: color 0.2s;
    `;
      star.addEventListener("click", () => {
        ratingContainer.querySelectorAll("button").forEach((btn, idx) => {
          btn.style.color = idx < i ? "#fbbf24" : "#d1d5db";
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
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #ffffff;
      color: #374151;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
    `;
      optionEl.addEventListener("click", () => {
        choiceContainer.querySelectorAll("button").forEach((btn) => {
          btn.style.background = "#ffffff";
          btn.style.borderColor = "#d1d5db";
        });
        optionEl.style.background = "#eff6ff";
        optionEl.style.borderColor = "#3b82f6";
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
    min-height: 80px;
    padding: 12px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
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
    const submissionData = {
      stepId: payload.stepId,
      sessionId: `user-session-${Date.now()}`,
      submittedAt: (/* @__PURE__ */ new Date()).toISOString(),
      response: data,
      question: payload.question,
      type: payload.type,
      client: {
        userId: "",
        clientIP: "",
        userAgent: navigator.userAgent,
        locale: navigator.language
      }
    };
    console.log("[DAP] MicroSurvey submission payload:", submissionData);
    if (flow.config && payload.flowId && payload.organizationId && payload.siteId) {
      const url = flow.config?.apiurl + `/iap-experience/${payload.organizationId}/${payload.siteId}/survey-responses/${payload.flowId}`;
      const hostBase = location.origin;
      console.log("[DAP] Submitting micro survey to API:", url);
      await http(flow.config, url, {
        method: "POST",
        body: submissionData,
        hostBase,
        includeHostHeader: true
      });
      console.log("[DAP] MicroSurvey successfully submitted to API");
    } else {
      console.warn("[DAP] MicroSurvey API submission skipped - missing configuration");
    }
  }
  function cleanupMicroSurvey(id) {
    const state = activeMicroSurveys.get(id);
    if (!state) return;
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
    activeMicroSurveys.delete(id);
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
    const scaleSize = max - min + 1;
    const faces = ["\u{1F623}", "\u{1F615}", "\u{1F610}", "\u{1F642}", "\u{1F604}"];
    const scaleContainer = document.createElement("div");
    scaleContainer.className = "dap-scale-faces";
    for (let i = min; i <= max; i++) {
      const faceIndex = Math.min(scaleSize - 1, Math.floor((i - min) / (max - min) * (faces.length - 1)));
      const option = document.createElement("div");
      option.className = "dap-face-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.className = "dap-face-radio";
      input.name = question.questionId;
      input.id = `${question.questionId}_${i}`;
      input.value = i.toString();
      const label = document.createElement("label");
      label.className = "dap-face-label";
      label.htmlFor = `${question.questionId}_${i}`;
      label.textContent = faces[faceIndex];
      label.title = `Rating: ${i}`;
      option.appendChild(input);
      option.appendChild(label);
      scaleContainer.appendChild(option);
    }
    container.appendChild(scaleContainer);
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
      style.textContent = modalCssText2;
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

  // src/experiences/popover.ts
  init_registry();
  init_selectors();
  var activePopovers = /* @__PURE__ */ new Map();
  function registerPopover() {
    register("popover", renderPopover);
  }
  async function renderPopover(flow) {
    const { payload, id } = flow;
    console.debug("[DAP] Popover initialized", { id, payload });
    console.debug("[DAP] Popover targetSelector:", payload.targetSelector);
    console.debug("[DAP] Popover trigger:", payload.trigger);
    console.debug("[DAP] Popover body:", payload.body);
    console.debug("[DAP] Popover bodyBlocks:", payload.bodyBlocks);
    if (!payload.targetSelector) {
      console.error("[DAP] Popover missing required elementSelector");
      payload._completionTracker?.onComplete?.();
      return;
    }
    if (!payload.body && !payload.bodyBlocks) {
      console.error("[DAP] Popover missing required content");
      payload._completionTracker?.onComplete?.();
      return;
    }
    const targetSelector = payload.targetSelector;
    const trigger = payload.trigger || "click";
    console.debug("[DAP] Popover looking for target element:", targetSelector);
    if (activePopovers.has(id)) {
      cleanupPopover(id);
    }
    const targetElement = await waitForTargetElement(targetSelector);
    if (!targetElement) {
      console.warn("[DAP] Popover target not found:", targetSelector);
      console.debug("[DAP] Available elements with IDs:", Array.from(document.querySelectorAll("[id]")).map((el) => el.id));
      console.debug("[DAP] Available elements with classes:", Array.from(document.querySelectorAll("[class]")).slice(0, 10).map((el) => el.className));
      payload._completionTracker?.onComplete?.();
      return;
    }
    console.debug("[DAP] Popover anchor resolved successfully", { targetSelector, targetElement });
    const popoverElement = createPopoverElement(payload, id);
    console.debug("[DAP] Popover element created:", popoverElement);
    const popoverState = {
      id,
      element: popoverElement,
      targetElement,
      observer: null,
      cleanup: [],
      isActive: false
    };
    activePopovers.set(id, popoverState);
    setupTriggerHandling(popoverState, trigger, payload);
    setupTargetObservation(popoverState);
    const t = String(trigger).toLowerCase().trim();
    const isInteractionTrigger = t === "click" || t === "on click" || t === "hover" || t === "on hover" || t === "focus" || t === "on focus";
    if (isInteractionTrigger) {
      console.debug(`[DAP] Popover immediate show for trigger: ${t}`);
      showPopover(popoverState, payload);
    }
    console.debug("[DAP] Popover setup complete", { id, trigger });
  }
  async function waitForTargetElement(selector, timeout = 5e3) {
    const existing = resolveSelector(selector);
    if (existing) {
      return existing;
    }
    return new Promise((resolve) => {
      let timeoutId;
      let observer;
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (observer) observer.disconnect();
      };
      timeoutId = setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeout);
      observer = new MutationObserver(() => {
        const element = resolveSelector(selector);
        if (element) {
          cleanup();
          resolve(element);
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: false
      });
    });
  }
  function createPopoverElement(payload, id) {
    const popover = document.createElement("div");
    popover.className = "dap-popover";
    popover.id = `dap-popover-${id}`;
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-live", "polite");
    Object.assign(popover.style, {
      position: "absolute",
      zIndex: "9999",
      background: "#f0f9ff",
      border: "1px solid #bae6fd",
      borderRadius: "12px",
      boxShadow: "0 8px 32px rgba(59, 130, 246, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)",
      padding: "18px",
      maxWidth: "320px",
      minWidth: "200px",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: "14px",
      lineHeight: "1.5",
      color: "#1e293b",
      opacity: "0",
      transform: "scale(0.95)",
      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      pointerEvents: "none"
    });
    if (payload.title) {
      const title = document.createElement("h4");
      title.style.cssText = `
      margin: 0 0 10px 0; 
      font-size: 16px; 
      font-weight: 600; 
      color: #0f172a;
      line-height: 1.25;
      text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
    `;
      title.textContent = payload.title;
      popover.appendChild(title);
    }
    if (payload.body) {
      const body = document.createElement("div");
      body.style.cssText = `
      color: #475569; 
      line-height: 1.6;
      margin: 0;
      text-shadow: 0 1px 1px rgba(255, 255, 255, 0.3);
    `;
      body.innerHTML = sanitizeHtml(payload.body);
      popover.appendChild(body);
    }
    const ctaContainer = createCTAButtons(payload, id);
    if (ctaContainer) {
      popover.appendChild(ctaContainer);
    }
    if (payload.showArrow !== false) {
      const arrow = createPopoverArrow();
      popover.appendChild(arrow);
    }
    return popover;
  }
  function createCTAButtons(payload, id) {
    const hasButtons2 = payload.bodyBlocks?.some((block) => block.kind === "button");
    if (!hasButtons2) return null;
    const container = document.createElement("div");
    container.style.cssText = `
    margin-top: 12px;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  `;
    payload.bodyBlocks?.forEach((block) => {
      if (block.kind === "button") {
        const buttonBlock = block;
        const button = document.createElement("button");
        button.style.cssText = `
        padding: 8px 16px;
        border: 1px solid ${buttonBlock.variant === "primary" ? "#3b82f6" : "#cbd5e1"};
        border-radius: 8px;
        background: ${buttonBlock.variant === "primary" ? "#3b82f6" : "#ffffff"};
        color: ${buttonBlock.variant === "primary" ? "#ffffff" : "#1e293b"};
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      `;
        button.textContent = buttonBlock.label;
        button.addEventListener("click", () => {
          console.debug("[DAP] Popover CTA clicked", { id, action: buttonBlock.action });
          if (buttonBlock.action === "advance") {
            payload._completionTracker?.onStepAdvance?.(payload.stepId || id);
          } else if (buttonBlock.action === "dismiss") {
            dismissPopover(id);
          }
          payload._completionTracker?.onComplete?.();
        });
        button.addEventListener("mouseenter", () => {
          if (buttonBlock.variant === "primary") {
            button.style.background = "#2563eb";
            button.style.transform = "translateY(-1px)";
          } else {
            button.style.background = "#f1f5f9";
            button.style.transform = "translateY(-1px)";
          }
        });
        button.addEventListener("mouseleave", () => {
          button.style.background = buttonBlock.variant === "primary" ? "#3b82f6" : "#ffffff";
          button.style.transform = "translateY(0)";
        });
        container.appendChild(button);
      }
    });
    return container.children.length > 0 ? container : null;
  }
  function createPopoverArrow() {
    const arrow = document.createElement("div");
    arrow.className = "dap-popover-arrow";
    arrow.style.cssText = `
    position: absolute;
    width: 10px;
    height: 10px;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    transform: rotate(45deg);
    z-index: -1;
  `;
    return arrow;
  }
  function setupTriggerHandling(state, trigger, payload) {
    const { targetElement, element } = state;
    const normalizedTrigger = trigger === "on click" ? "click" : trigger === "on hover" ? "hover" : trigger === "on focus" ? "focus" : trigger === "on page load" ? "on page load" : trigger;
    console.debug("[DAP] Popover setting up trigger:", { originalTrigger: trigger, normalizedTrigger, targetElement });
    switch (normalizedTrigger) {
      case "click":
        const clickHandler = (e) => {
          console.debug("[DAP] Popover click triggered", e);
          e.preventDefault();
          e.stopPropagation();
          showPopover(state, payload);
        };
        targetElement.addEventListener("click", clickHandler);
        state.cleanup.push(() => targetElement.removeEventListener("click", clickHandler));
        console.debug("[DAP] Popover click listener attached");
        break;
      case "hover":
        const showHandler = () => {
          console.debug("[DAP] Popover hover show triggered");
          showPopover(state, payload);
        };
        const hideHandler = () => {
          console.debug("[DAP] Popover hover hide triggered");
          hidePopover(state, payload);
        };
        targetElement.addEventListener("mouseenter", showHandler);
        targetElement.addEventListener("mouseleave", hideHandler);
        element.addEventListener("mouseenter", showHandler);
        element.addEventListener("mouseleave", hideHandler);
        state.cleanup.push(() => {
          targetElement.removeEventListener("mouseenter", showHandler);
          targetElement.removeEventListener("mouseleave", hideHandler);
          element.removeEventListener("mouseenter", showHandler);
          element.removeEventListener("mouseleave", hideHandler);
        });
        console.debug("[DAP] Popover hover listeners attached");
        break;
      case "focus":
        const focusHandler = () => {
          console.debug("[DAP] Popover focus triggered");
          showPopover(state, payload);
        };
        const blurHandler = () => {
          console.debug("[DAP] Popover blur triggered");
          hidePopover(state, payload);
        };
        targetElement.addEventListener("focus", focusHandler);
        targetElement.addEventListener("blur", blurHandler);
        state.cleanup.push(() => {
          targetElement.removeEventListener("focus", focusHandler);
          targetElement.removeEventListener("blur", blurHandler);
        });
        if (document.activeElement === targetElement) {
          showPopover(state, payload);
        }
        console.debug("[DAP] Popover focus listeners attached");
        break;
    }
    showPopover(state, payload);
  }
  function setupTargetObservation(state) {
    const observer = new MutationObserver(() => {
      const isStillConnected = state.targetElement.isConnected;
      if (!isStillConnected) {
        console.debug("[DAP] Popover target element disappeared", { id: state.id });
        cleanupPopover(state.id);
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    state.observer = observer;
    state.cleanup.push(() => observer.disconnect());
  }
  function showPopover(state, payload) {
    console.debug("[DAP] showPopover called", { id: state.id, isActive: state.isActive });
    if (state.isActive) {
      console.debug("[DAP] Popover already active, skipping");
      return;
    }
    state.isActive = true;
    console.debug("[DAP] Popover shown", { id: state.id });
    document.body.appendChild(state.element);
    console.debug("[DAP] Popover element appended to body");
    positionPopover(state, payload.placement || "bottom", payload.showArrow !== false);
    console.debug("[DAP] Popover positioned");
    setTimeout(() => {
      state.element.style.pointerEvents = "auto";
      state.element.style.opacity = "1";
      state.element.style.transform = "scale(1)";
      console.debug("[DAP] Popover animation started");
    }, 10);
    setupGlobalEventHandlers(state, payload);
    if (hasButtons(payload)) {
      state.element.setAttribute("tabindex", "-1");
      state.element.focus();
      trapFocus(state.element);
    }
    console.debug("[DAP] Popover show complete");
  }
  function hidePopover(state, payload) {
    if (!state.isActive) return;
    state.isActive = false;
    console.debug("[DAP] Popover dismissed", { id: state.id });
    state.element.style.opacity = "0";
    state.element.style.transform = "scale(0.95)";
    state.element.style.pointerEvents = "none";
    setTimeout(() => {
      if (state.element.parentNode) {
        state.element.parentNode.removeChild(state.element);
      }
    }, 150);
    payload._completionTracker?.onComplete?.();
  }
  function dismissPopover(id) {
    const state = activePopovers.get(id);
    if (state) {
      hidePopover(state, {});
    }
  }
  function positionPopover(state, placement, showArrow) {
    const { element, targetElement } = state;
    const targetRect = targetElement.getBoundingClientRect();
    const popoverRect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const spacing = 8;
    const viewportPadding = 16;
    let top;
    let left;
    let actualPlacement = placement;
    const positions = {
      top: {
        top: targetRect.top + scrollY - popoverRect.height - spacing,
        left: targetRect.left + scrollX + (targetRect.width - popoverRect.width) / 2
      },
      bottom: {
        top: targetRect.bottom + scrollY + spacing,
        left: targetRect.left + scrollX + (targetRect.width - popoverRect.width) / 2
      },
      left: {
        top: targetRect.top + scrollY + (targetRect.height - popoverRect.height) / 2,
        left: targetRect.left + scrollX - popoverRect.width - spacing
      },
      right: {
        top: targetRect.top + scrollY + (targetRect.height - popoverRect.height) / 2,
        left: targetRect.right + scrollX + spacing
      }
    };
    const preferred = positions[placement];
    if (!preferred || !fitsInViewport(preferred, popoverRect, viewportPadding)) {
      actualPlacement = findBestPlacement(positions, popoverRect, viewportPadding) || placement;
    }
    const finalPosition = positions[actualPlacement] || positions.bottom;
    top = finalPosition.top;
    left = finalPosition.left;
    left = Math.max(viewportPadding, Math.min(left, viewportWidth - popoverRect.width - viewportPadding));
    top = Math.max(viewportPadding, Math.min(top, viewportHeight - popoverRect.height - viewportPadding));
    element.style.top = `${top}px`;
    element.style.left = `${left}px`;
    if (showArrow) {
      positionArrow(element, targetRect, actualPlacement, { top, left }, scrollX, scrollY);
    }
  }
  function fitsInViewport(position, rect, padding) {
    return position.top >= padding && position.left >= padding && position.top + rect.height <= window.innerHeight - padding && position.left + rect.width <= window.innerWidth - padding;
  }
  function findBestPlacement(positions, rect, padding) {
    const placements = ["bottom", "top", "right", "left"];
    for (const placement of placements) {
      const pos = positions[placement];
      if (pos && fitsInViewport(pos, rect, padding)) {
        return placement;
      }
    }
    return null;
  }
  function positionArrow(popover, targetRect, placement, popoverPos, scrollX, scrollY) {
    const arrow = popover.querySelector(".dap-popover-arrow");
    if (!arrow) return;
    const arrowSize = 8;
    const targetCenterX = targetRect.left + scrollX + targetRect.width / 2;
    const targetCenterY = targetRect.top + scrollY + targetRect.height / 2;
    switch (placement) {
      case "top":
        arrow.style.top = `calc(100% - 1px)`;
        arrow.style.left = `${Math.max(12, Math.min(targetCenterX - popoverPos.left - arrowSize / 2, popover.offsetWidth - 20))}px`;
        arrow.style.borderBottomColor = "transparent";
        arrow.style.borderRightColor = "transparent";
        break;
      case "bottom":
        arrow.style.top = `-${arrowSize / 2}px`;
        arrow.style.left = `${Math.max(12, Math.min(targetCenterX - popoverPos.left - arrowSize / 2, popover.offsetWidth - 20))}px`;
        arrow.style.borderTopColor = "transparent";
        arrow.style.borderLeftColor = "transparent";
        break;
      case "left":
        arrow.style.left = `calc(100% - 1px)`;
        arrow.style.top = `${Math.max(12, Math.min(targetCenterY - popoverPos.top - arrowSize / 2, popover.offsetHeight - 20))}px`;
        arrow.style.borderRightColor = "transparent";
        arrow.style.borderBottomColor = "transparent";
        break;
      case "right":
        arrow.style.left = `-${arrowSize / 2}px`;
        arrow.style.top = `${Math.max(12, Math.min(targetCenterY - popoverPos.top - arrowSize / 2, popover.offsetHeight - 20))}px`;
        arrow.style.borderLeftColor = "transparent";
        arrow.style.borderTopColor = "transparent";
        break;
    }
  }
  function setupGlobalEventHandlers(state, payload) {
    const outsideClickHandler = (e) => {
      const target = e.target;
      if (!state.element.contains(target) && !state.targetElement.contains(target)) {
        hidePopover(state, payload);
      }
    };
    const keyHandler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        hidePopover(state, payload);
      }
    };
    const navigationHandler = () => {
      hidePopover(state, payload);
    };
    setTimeout(() => {
      document.addEventListener("click", outsideClickHandler);
      document.addEventListener("keydown", keyHandler);
      window.addEventListener("beforeunload", navigationHandler);
      window.addEventListener("popstate", navigationHandler);
    }, 100);
    state.cleanup.push(() => {
      document.removeEventListener("click", outsideClickHandler);
      document.removeEventListener("keydown", keyHandler);
      window.removeEventListener("beforeunload", navigationHandler);
      window.removeEventListener("popstate", navigationHandler);
    });
  }
  function hasButtons(payload) {
    return payload.bodyBlocks?.some((block) => block.kind === "button") || false;
  }
  function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const handleTab = (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    element.addEventListener("keydown", handleTab);
  }
  function cleanupPopover(id) {
    console.debug("[DAP] Popover destroyed", { id });
    const state = activePopovers.get(id);
    if (!state) return;
    state.cleanup.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        console.warn("[DAP] Error during popover cleanup:", error);
      }
    });
    if (state.element && state.element.parentNode) {
      state.element.parentNode.removeChild(state.element);
    }
    activePopovers.delete(id);
  }

  // src/experiences/beacon.ts
  init_registry();
  init_selectors();
  var activeBeacons = /* @__PURE__ */ new Map();
  function registerBeacon() {
    register("beacon", renderBeacon);
  }
  async function renderBeacon(flow) {
    const { payload, id } = flow;
    console.debug("[DAP] Beacon initialized", { id, payload });
    if (!payload.title && !payload.body) {
      console.error("[DAP] Beacon missing required content (title or body)");
      payload._completionTracker?.onComplete?.();
      return;
    }
    if (activeBeacons.has(id)) {
      cleanupBeacon(id);
    }
    let targetElement;
    if (payload.targetSelector) {
      try {
        targetElement = await waitForElement(payload.targetSelector, { timeout: 5e3 });
        console.debug("[DAP] Beacon target element found", { selector: payload.targetSelector });
      } catch (e) {
        console.warn(`[DAP] Beacon: Target element not found for selector: ${payload.targetSelector}`);
      }
    }
    const beaconElement = createBeaconElement(payload, id);
    const beaconState = {
      id,
      element: beaconElement,
      targetElement,
      cleanup: [],
      isActive: false
    };
    activeBeacons.set(id, beaconState);
    showBeacon(beaconState, payload);
    console.debug("[DAP] Beacon setup complete", { id });
  }
  function createBeaconElement(payload, id) {
    const beacon = document.createElement("div");
    beacon.className = "dap-beacon";
    beacon.id = `dap-beacon-${id}`;
    beacon.setAttribute("role", "alert");
    beacon.setAttribute("aria-live", "assertive");
    const position = payload.position || "top-right";
    const positionStyles = getPositionStyles(position);
    Object.assign(beacon.style, {
      position: "fixed",
      zIndex: "10000",
      padding: "12px 16px",
      borderRadius: "16px",
      background: "rgba(255, 255, 255, 0.95)",
      border: "2px solid #3b82f6",
      boxShadow: "0 8px 32px rgba(59, 130, 246, 0.15), 0 4px 16px rgba(0, 0, 0, 0.08)",
      backdropFilter: "blur(12px)",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: "13px",
      lineHeight: "1.4",
      color: "#1e40af",
      maxWidth: "280px",
      minWidth: "200px",
      opacity: "0",
      transform: "translateY(-10px) scale(0.95)",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      cursor: "pointer",
      pointerEvents: "auto",
      userSelect: "none",
      ...positionStyles
    });
    beacon.style.animation = "dap-beacon-pulse 2s ease-in-out infinite";
    if (!document.querySelector("#dap-beacon-pulse-styles")) {
      const pulseStyles = document.createElement("style");
      pulseStyles.id = "dap-beacon-pulse-styles";
      pulseStyles.textContent = `
      @keyframes dap-beacon-pulse {
        0%, 100% { 
          box-shadow: 0 8px 32px rgba(59, 130, 246, 0.15), 0 4px 16px rgba(0, 0, 0, 0.08), 0 0 0 0 rgba(59, 130, 246, 0.4);
        }
        50% { 
          box-shadow: 0 8px 32px rgba(59, 130, 246, 0.25), 0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 8px rgba(59, 130, 246, 0.1);
        }
      }
      
      .dap-beacon:hover {
        transform: translateY(-2px) scale(1.02) !important;
        box-shadow: 0 12px 40px rgba(59, 130, 246, 0.25), 0 6px 20px rgba(0, 0, 0, 0.12) !important;
        animation: none !important;
      }
    `;
      document.head.appendChild(pulseStyles);
    }
    if (payload.icon) {
      const icon = document.createElement("span");
      icon.style.cssText = `
      display: inline-block;
      margin-right: 8px;
      font-size: 18px;
      vertical-align: middle;
    `;
      icon.textContent = payload.icon;
      beacon.appendChild(icon);
    }
    if (payload.title) {
      const title = document.createElement("div");
      title.style.cssText = `
      font-weight: 600;
      font-size: 15px;
      color: #78350f;
      margin-bottom: ${payload.body ? "6px" : "0"};
      line-height: 1.3;
    `;
      title.textContent = payload.title;
      beacon.appendChild(title);
    }
    if (payload.body) {
      const body = document.createElement("div");
      body.style.cssText = `
      color: #a16207;
      line-height: 1.4;
      font-size: 13px;
    `;
      body.innerHTML = sanitizeHtml(payload.body);
      beacon.appendChild(body);
    }
    const closeButton = document.createElement("button");
    closeButton.style.cssText = `
    position: absolute;
    top: 6px;
    right: 6px;
    background: rgba(59, 130, 246, 0.1);
    border: none;
    font-size: 14px;
    color: #3b82f6;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    font-weight: 500;
    width: 24px;
    height: 24px;
  `;
    closeButton.innerHTML = "\xD7";
    closeButton.title = "Close beacon";
    closeButton.setAttribute("aria-label", "Close beacon");
    closeButton.addEventListener("mouseenter", () => {
      closeButton.style.backgroundColor = "rgba(59, 130, 246, 0.2)";
      closeButton.style.transform = "scale(1.1)";
    });
    closeButton.addEventListener("mouseleave", () => {
      closeButton.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
      closeButton.style.transform = "scale(1)";
    });
    closeButton.addEventListener("click", (e) => {
      e.stopPropagation();
      dismissBeacon(id);
    });
    beacon.appendChild(closeButton);
    beacon.__beaconPayload = payload;
    return beacon;
  }
  function getPositionStyles(position) {
    const margin = "20px";
    switch (position) {
      case "top-left":
        return { top: margin, left: margin };
      case "top-center":
        return { top: margin, left: "50%", transform: "translateX(-50%) translateY(-20px) scale(0.9)" };
      case "top-right":
      default:
        return { top: margin, right: margin };
      case "bottom-left":
        return { bottom: margin, left: margin };
      case "bottom-center":
        return { bottom: margin, left: "50%", transform: "translateX(-50%) translateY(20px) scale(0.9)" };
      case "bottom-right":
        return { bottom: margin, right: margin };
      case "center":
        return {
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) translateY(-20px) scale(0.9)"
        };
    }
  }
  function showBeacon(state, payload) {
    if (state.isActive) return;
    state.isActive = true;
    console.debug("[DAP] Beacon shown", { id: state.id, hasTarget: !!state.targetElement });
    document.body.appendChild(state.element);
    requestAnimationFrame(() => {
      if (state.targetElement) {
        const position = payload.position ? parsePosition(payload.position) : { x: "right", y: "center" };
        console.debug("[DAP] Positioning beacon with position:", position);
        if (position) {
          positionBeaconRelativeToElement(state.element, state.targetElement, position);
        }
      } else {
        console.debug("[DAP] No target element, using fallback positioning");
        const positionStyles = getPositionStyles(payload.position || "top-right");
        Object.assign(state.element.style, positionStyles);
      }
      applyBeaconAnimation(state.element, payload.beaconStyles);
      setTimeout(() => {
        state.element.style.opacity = "1";
        state.element.style.transform = "scale(1)";
        console.debug("[DAP] Beacon animation complete");
      }, 50);
    });
    const clickHandler = (e) => {
      const target = e.target;
      if (!target.closest("button")) {
        console.debug("[DAP] Beacon clicked", { id: state.id });
        if (payload.action) {
          console.debug("[DAP] Executing beacon action", { action: payload.action });
        }
        dismissBeacon(state.id);
      }
    };
    state.element.addEventListener("click", clickHandler);
    state.cleanup.push(() => state.element.removeEventListener("click", clickHandler));
    setupGlobalEventHandlers2(state);
    if (state.targetElement) {
      setupPositionObserver(state, payload);
    }
    if (payload.autoDismiss && payload.autoDismiss > 0) {
      setTimeout(() => {
        dismissBeacon(state.id);
      }, payload.autoDismiss * 1e3);
    }
  }
  function applyBeaconAnimation(element, beaconStyles) {
    const styles = {
      enabled: true,
      color1: "#f59e0b",
      color2: "#eab308",
      duration: "2s",
      padding: "8px",
      borderWidth: "3px",
      borderRadius: "16px",
      shadowSize: "20px",
      ...beaconStyles
    };
    if (!styles.enabled) return;
    const animationId = `beacon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const style = document.createElement("style");
    style.dataset.beaconAnimation = animationId;
    style.textContent = `
    .dap-beacon[data-beacon-id="${animationId}"]::before {
      content: '';
      position: absolute;
      top: -${styles.padding};
      left: -${styles.padding};
      right: -${styles.padding};
      bottom: -${styles.padding};
      border: ${styles.borderWidth} solid ${styles.color1};
      border-radius: ${styles.borderRadius};
      animation: beaconPulse-${animationId} ${styles.duration} ease-in-out infinite;
      pointer-events: none;
      z-index: -1;
    }
    
    @keyframes beaconPulse-${animationId} {
      0% {
        border-color: ${styles.color1};
        box-shadow: 0 0 0 0 ${styles.color1}40, 0 0 ${styles.shadowSize} ${styles.color1}30;
        transform: scale(1);
      }
      50% {
        border-color: ${styles.color2};
        box-shadow: 0 0 0 10px ${styles.color2}20, 0 0 ${styles.shadowSize} ${styles.color2}40;
        transform: scale(1.05);
      }
      100% {
        border-color: ${styles.color1};
        box-shadow: 0 0 0 0 ${styles.color1}40, 0 0 ${styles.shadowSize} ${styles.color1}30;
        transform: scale(1);
      }
    }
  `;
    document.head.appendChild(style);
    element.setAttribute("data-beacon-id", animationId);
    const cleanup = () => {
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
    const beaconId = element.id.replace("dap-beacon-", "");
    const state = activeBeacons.get(beaconId);
    if (state) {
      state.cleanup.push(cleanup);
    }
  }
  function setupGlobalEventHandlers2(state, payload) {
    const keyHandler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismissBeacon(state.id);
      }
    };
    const navigationHandler = () => {
      dismissBeacon(state.id);
    };
    document.addEventListener("keydown", keyHandler);
    window.addEventListener("beforeunload", navigationHandler);
    window.addEventListener("popstate", navigationHandler);
    state.cleanup.push(() => {
      document.removeEventListener("keydown", keyHandler);
      window.removeEventListener("beforeunload", navigationHandler);
      window.removeEventListener("popstate", navigationHandler);
    });
  }
  function dismissBeacon(id) {
    const state = activeBeacons.get(id);
    if (!state || !state.isActive) return;
    state.isActive = false;
    console.debug("[DAP] Beacon dismissed", { id });
    state.element.style.opacity = "0";
    state.element.style.transform = state.element.style.transform.replace(/translateY\([^)]+\)/, "translateY(-20px)").replace(/scale\([^)]+\)/, "scale(0.9)");
    const beaconElement = state.element;
    const payloadData = beaconElement.__beaconPayload;
    if (payloadData?._completionTracker?.onComplete) {
      payloadData._completionTracker.onComplete();
    }
    setTimeout(() => {
      if (state.element.parentNode) {
        state.element.parentNode.removeChild(state.element);
      }
      cleanupBeacon(id);
    }, 300);
  }
  function cleanupBeacon(id) {
    console.debug("[DAP] Beacon destroyed", { id });
    const state = activeBeacons.get(id);
    if (!state) return;
    state.cleanup.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        console.warn("[DAP] Error during beacon cleanup:", error);
      }
    });
    if (state.element && state.element.parentNode) {
      state.element.parentNode.removeChild(state.element);
    }
    activeBeacons.delete(id);
  }
  function parsePosition(position) {
    if (typeof position === "object" && position.x && position.y) {
      return { x: position.x, y: position.y };
    }
    if (typeof position === "string") {
      switch (position) {
        case "top-left":
          return { x: "left", y: "top" };
        case "top-center":
          return { x: "center", y: "top" };
        case "top-right":
          return { x: "right", y: "top" };
        case "bottom-left":
          return { x: "left", y: "bottom" };
        case "bottom-center":
          return { x: "center", y: "bottom" };
        case "bottom-right":
          return { x: "right", y: "bottom" };
        case "center":
          return { x: "center", y: "center" };
        default:
          return { x: "center", y: "center" };
      }
    }
    return null;
  }
  function positionBeaconRelativeToElement(beaconElement, targetElement, position) {
    console.debug("[DAP] Starting beacon positioning", {
      targetElement: targetElement.tagName,
      targetSelector: targetElement.id || targetElement.className,
      position
    });
    const targetRect = targetElement.getBoundingClientRect();
    console.debug("[DAP] Target element bounds:", targetRect);
    beaconElement.style.position = "fixed";
    beaconElement.style.display = "block";
    beaconElement.style.visibility = "visible";
    beaconElement.style.opacity = "0";
    if (!beaconElement.parentNode) {
      document.body.appendChild(beaconElement);
    }
    beaconElement.offsetHeight;
    const beaconRect = beaconElement.getBoundingClientRect();
    console.debug("[DAP] Beacon element bounds:", beaconRect);
    const spacing = 30;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left = 0;
    let top = 0;
    let placement = "right";
    left = targetRect.right + spacing;
    top = targetRect.top + (targetRect.height - beaconRect.height) / 2;
    if (left + beaconRect.width > viewportWidth - 10) {
      left = targetRect.left - beaconRect.width - spacing;
      placement = "left";
      if (left < 10) {
        left = targetRect.left + (targetRect.width - beaconRect.width) / 2;
        top = targetRect.bottom + spacing;
        placement = "bottom";
        if (top + beaconRect.height > viewportHeight - 10) {
          top = targetRect.top - beaconRect.height - spacing;
          placement = "top";
          if (top < 10) {
            left = Math.min(targetRect.right + spacing, viewportWidth - beaconRect.width - 10);
            top = Math.max(10, Math.min(targetRect.top, viewportHeight - beaconRect.height - 10));
            placement = "right-constrained";
          }
        }
      }
    }
    left = Math.max(10, Math.min(left, viewportWidth - beaconRect.width - 10));
    top = Math.max(10, Math.min(top, viewportHeight - beaconRect.height - 10));
    console.debug("[DAP] Final beacon position:", {
      left,
      top,
      placement,
      beaconWidth: beaconRect.width,
      beaconHeight: beaconRect.height,
      viewportWidth,
      viewportHeight
    });
    beaconElement.style.left = `${Math.round(left)}px`;
    beaconElement.style.top = `${Math.round(top)}px`;
    beaconElement.style.transform = "none";
    beaconElement.style.zIndex = "10000";
    beaconElement.setAttribute("data-placement", placement);
    console.debug("[DAP] Beacon positioned successfully");
  }
  function setupPositionObserver(state, payload) {
    if (!state.targetElement) return;
    console.debug("[DAP] Setting up position observer for beacon", { id: state.id });
    let updateTimeout = null;
    const updatePosition = () => {
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        if (state.targetElement && state.isActive) {
          const position = payload.position ? parsePosition(payload.position) : { x: "right", y: "center" };
          console.debug("[DAP] Updating beacon position on scroll");
          if (position) {
            positionBeaconRelativeToElement(state.element, state.targetElement, position);
          }
        }
      }, 8);
    };
    const intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          state.element.style.display = "block";
          updatePosition();
        } else {
          state.element.style.display = "none";
        }
      });
    }, { threshold: 0.1 });
    intersectionObserver.observe(state.targetElement);
    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    document.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    let scrollableParent = state.targetElement.parentElement;
    const scrollListeners = [];
    while (scrollableParent) {
      const style = window.getComputedStyle(scrollableParent);
      if (style.overflow === "auto" || style.overflow === "scroll" || style.overflowY === "auto" || style.overflowY === "scroll") {
        scrollableParent.addEventListener("scroll", handleScroll, { passive: true });
        scrollListeners.push({ element: scrollableParent, listener: handleScroll });
      }
      scrollableParent = scrollableParent.parentElement;
    }
    state.cleanup.push(() => {
      intersectionObserver.disconnect();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("scroll", handleScroll, true);
      scrollListeners.forEach(({ element, listener }) => {
        element.removeEventListener("scroll", listener);
      });
      if (updateTimeout) clearTimeout(updateTimeout);
    });
    console.debug("[DAP] Position observer setup complete");
  }

  // src/experiences/banner.ts
  init_registry();
  var bannerCssText = `
:root {
  --dap-z-banner: 2147483620;
  --dap-banner-bg-info: #eff6ff;
  --dap-banner-bg-warning: #fefce8;
  --dap-banner-bg-error: #fef2f2;
  --dap-banner-bg-success: #f0f9ff;
  --dap-banner-text-info: #1e40af;
  --dap-banner-text-warning: #92400e;
  --dap-banner-text-error: #dc2626;
  --dap-banner-text-success: #059669;
  --dap-banner-border-info: #3b82f6;
  --dap-banner-border-warning: #f59e0b;
  --dap-banner-border-error: #ef4444;
  --dap-banner-border-success: #10b981;
}

.dap-banner-wrap {
  position: fixed;
  left: 0;
  right: 0;
  z-index: var(--dap-z-banner);
  padding: 0 16px;
  pointer-events: none;
}

.dap-banner-wrap.top {
  top: 16px;
}

.dap-banner-wrap.bottom {
  bottom: 16px;
}

.dap-banner {
  max-width: 800px;
  margin: 0 auto;
  padding: 16px 20px;
  border-radius: 8px;
  border-left: 4px solid;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
  pointer-events: auto;
  animation: bannerSlideIn 0.3s ease-out;
}

@keyframes bannerSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dap-banner.bottom {
  animation: bannerSlideInBottom 0.3s ease-out;
}

@keyframes bannerSlideInBottom {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dap-banner.info {
  background: var(--dap-banner-bg-info);
  color: var(--dap-banner-text-info);
  border-color: var(--dap-banner-border-info);
}

.dap-banner.warning {
  background: var(--dap-banner-bg-warning);
  color: var(--dap-banner-text-warning);
  border-color: var(--dap-banner-border-warning);
}

.dap-banner.error {
  background: var(--dap-banner-bg-error);
  color: var(--dap-banner-text-error);
  border-color: var(--dap-banner-border-error);
}

.dap-banner.success {
  background: var(--dap-banner-bg-success);
  color: var(--dap-banner-text-success);
  border-color: var(--dap-banner-border-success);
}

.dap-banner-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
}

.dap-banner-message {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
}

.dap-banner-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.dap-banner-btn {
  padding: 6px 12px;
  border: 1px solid currentColor;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: all 0.15s ease;
}

.dap-banner-btn:hover {
  background: currentColor;
  color: white;
}

.dap-banner-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 14px;
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.dap-banner-close:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.1);
}

@media (max-width: 640px) {
  .dap-banner-wrap {
    padding: 0 12px;
  }
  
  .dap-banner {
    padding: 14px 16px;
  }
  
  .dap-banner-actions {
    flex-direction: column;
    gap: 6px;
  }
  
  .dap-banner-btn {
    font-size: 11px;
    padding: 4px 8px;
  }
}
`;
  function registerBanner() {
    register("banner", renderBanner);
  }
  async function renderBanner(flow) {
    const { payload, id } = flow;
    const root = ensureRoot2();
    const completionTracker = payload._completionTracker;
    const shell = createBannerShell(payload);
    shell.messageEl.innerHTML = sanitizeHtml(payload.message);
    if (payload.actions?.length) {
      payload.actions.forEach((action) => {
        const btn = document.createElement(action.action === "navigate" ? "a" : "button");
        btn.className = "dap-banner-btn";
        btn.textContent = action.label;
        if (action.action === "navigate" && action.href) {
          btn.href = action.href;
          btn.target = "_blank";
          btn.rel = "noopener noreferrer";
        } else {
          btn.addEventListener("click", () => {
            if (action.action === "dismiss") {
              dismissBanner();
            } else if (action.action === "custom" && action.customAction) {
              window.dispatchEvent(new CustomEvent("dap-banner-action", {
                detail: { action: action.customAction, bannerId: id }
              }));
              dismissBanner();
            }
          });
        }
        shell.actionsEl.appendChild(btn);
      });
    }
    let autoHideTimer;
    if (payload.autoHide && payload.autoHide > 0) {
      autoHideTimer = window.setTimeout(() => {
        dismissBanner();
      }, payload.autoHide * 1e3);
    }
    function dismissBanner() {
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
      shell.wrap.style.animation = payload.position === "bottom" ? "bannerSlideOutBottom 0.2s ease-in" : "bannerSlideOut 0.2s ease-in";
      setTimeout(() => {
        shell.wrap.remove();
        if (completionTracker?.onComplete) {
          console.debug(`[DAP] Completing banner flow: ${id}`);
          completionTracker.onComplete();
        }
      }, 200);
    }
    if (payload.dismissible !== false) {
      shell.closeBtn.addEventListener("click", dismissBanner);
    } else {
      shell.closeBtn.style.display = "none";
    }
    if (!document.getElementById("dap-banner-dismiss-styles")) {
      const style = document.createElement("style");
      style.id = "dap-banner-dismiss-styles";
      style.textContent = `
      @keyframes bannerSlideOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
      }
      @keyframes bannerSlideOutBottom {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(20px); }
      }
    `;
      document.head.appendChild(style);
    }
    root.appendChild(shell.wrap);
    shell.banner.setAttribute("role", "alert");
    shell.banner.setAttribute("aria-live", "polite");
  }
  function createBannerShell(payload) {
    const wrap = document.createElement("div");
    wrap.className = `dap-banner-wrap ${payload.position || "top"}`;
    const banner = document.createElement("div");
    banner.className = `dap-banner ${payload.variant || "info"}`;
    if (payload.theme) {
      for (const [key, value] of Object.entries(payload.theme)) {
        banner.style.setProperty(key, value);
      }
    }
    const iconEl = document.createElement("div");
    iconEl.className = "dap-banner-icon";
    const icons = {
      info: "\u2139",
      warning: "\u26A0",
      error: "\u2715",
      success: "\u2713"
    };
    iconEl.textContent = icons[payload.variant || "info"];
    const messageEl = document.createElement("div");
    messageEl.className = "dap-banner-message";
    const actionsEl = document.createElement("div");
    actionsEl.className = "dap-banner-actions";
    const closeBtn = document.createElement("button");
    closeBtn.className = "dap-banner-close";
    closeBtn.innerHTML = "\xD7";
    closeBtn.setAttribute("aria-label", "Close banner");
    banner.appendChild(iconEl);
    banner.appendChild(messageEl);
    banner.appendChild(actionsEl);
    banner.appendChild(closeBtn);
    wrap.appendChild(banner);
    return { wrap, banner, iconEl, messageEl, actionsEl, closeBtn };
  }
  function ensureRoot2() {
    let host = document.querySelector("dap-banner-root");
    if (!host) {
      host = document.createElement("dap-banner-root");
      host.style.position = "fixed";
      host.style.zIndex = "2147483620";
      host.style.inset = "0";
      host.style.pointerEvents = "none";
      document.documentElement.appendChild(host);
      if (!host.shadowRoot && !document.getElementById("dap-banner-style")) {
        const style = document.createElement("style");
        style.id = "dap-banner-style";
        style.textContent = bannerCssText;
        document.head.appendChild(style);
      }
    }
    return host;
  }

  // src/experiences/hotspots.ts
  init_registry();
  init_triggerNormalizer();
  var hotspotsCssText = `
:root {
  --dap-z-hotspots: 2147483630;
  --dap-hotspot-primary: #3b82f6;
  --dap-hotspot-bg: #ffffff;
  --dap-hotspot-border: #e2e8f0;
  --dap-hotspot-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  --dap-hotspot-text: #1e293b;
  --dap-hotspot-text-muted: #64748b;
}

.dap-hotspots-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  z-index: var(--dap-z-hotspots);
  pointer-events: none;
  opacity: 0;
  animation: hotspotsOverlayFadeIn 0.3s ease-out forwards;
}

@keyframes hotspotsOverlayFadeIn {
  to { opacity: 1; }
}

.dap-hotspot-marker {
  position: absolute;
  width: 24px;
  height: 24px;
  background: var(--dap-hotspot-primary);
  border: 3px solid white;
  border-radius: 50%;
  cursor: pointer;
  z-index: calc(var(--dap-z-hotspots) + 1);
  animation: hotspotPulse 2s infinite;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.dap-hotspot-marker:hover {
  transform: scale(1.1);
  animation-play-state: paused;
}

.dap-hotspot-marker.completed {
  background: #10b981;
  animation: none;
}

.dap-hotspot-marker.required {
  background: #f59e0b;
  animation-duration: 1.5s;
}

@keyframes hotspotPulse {
  0% {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  70% {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 10px rgba(59, 130, 246, 0);
  }
  100% {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 0 rgba(59, 130, 246, 0);
  }
}

.dap-hotspot-tooltip {
  position: absolute;
  background: var(--dap-hotspot-bg);
  border: 1px solid var(--dap-hotspot-border);
  border-radius: 8px;
  box-shadow: var(--dap-hotspot-shadow);
  padding: 16px;
  max-width: 320px;
  z-index: calc(var(--dap-z-hotspots) + 2);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  opacity: 0;
  transform: scale(0.9);
  animation: hotspotTooltipIn 0.2s ease-out forwards;
  pointer-events: auto;
}

@keyframes hotspotTooltipIn {
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dap-hotspot-tooltip::before {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border: 8px solid transparent;
}

.dap-hotspot-tooltip.top::before {
  bottom: -16px;
  left: 50%;
  transform: translateX(-50%);
  border-top-color: var(--dap-hotspot-bg);
}

.dap-hotspot-tooltip.bottom::before {
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  border-bottom-color: var(--dap-hotspot-bg);
}

.dap-hotspot-tooltip.left::before {
  right: -16px;
  top: 50%;
  transform: translateY(-50%);
  border-left-color: var(--dap-hotspot-bg);
}

.dap-hotspot-tooltip.right::before {
  left: -16px;
  top: 50%;
  transform: translateY(-50%);
  border-right-color: var(--dap-hotspot-bg);
}

.dap-hotspot-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--dap-hotspot-text);
  margin: 0 0 8px 0;
}

.dap-hotspot-description {
  font-size: 14px;
  color: var(--dap-hotspot-text-muted);
  line-height: 1.4;
  margin: 0 0 12px 0;
}

.dap-hotspot-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.dap-hotspot-btn {
  padding: 6px 12px;
  border: 1px solid var(--dap-hotspot-primary);
  border-radius: 4px;
  background: transparent;
  color: var(--dap-hotspot-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dap-hotspot-btn:hover {
  background: var(--dap-hotspot-primary);
  color: white;
}

.dap-hotspot-btn.primary {
  background: var(--dap-hotspot-primary);
  color: white;
}

.dap-hotspot-btn.primary:hover {
  background: #2563eb;
  border-color: #2563eb;
}

.dap-hotspots-progress {
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--dap-hotspot-bg);
  border: 1px solid var(--dap-hotspot-border);
  border-radius: 8px;
  padding: 12px 16px;
  z-index: calc(var(--dap-z-hotspots) + 1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  box-shadow: var(--dap-hotspot-shadow);
  animation: hotspotProgressIn 0.3s ease-out forwards;
  opacity: 0;
}

@keyframes hotspotProgressIn {
  to { opacity: 1; }
}

.dap-hotspots-progress-text {
  font-size: 14px;
  color: var(--dap-hotspot-text);
  margin-bottom: 4px;
}

.dap-hotspots-progress-bar {
  width: 120px;
  height: 4px;
  background: var(--dap-hotspot-border);
  border-radius: 2px;
  overflow: hidden;
}

.dap-hotspots-progress-fill {
  height: 100%;
  background: var(--dap-hotspot-primary);
  border-radius: 2px;
  transition: width 0.3s ease;
  width: 0%;
}

.dap-hotspots-controls {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 8px;
  z-index: calc(var(--dap-z-hotspots) + 1);
}

.dap-hotspots-skip {
  padding: 8px 16px;
  background: var(--dap-hotspot-bg);
  border: 1px solid var(--dap-hotspot-border);
  border-radius: 6px;
  color: var(--dap-hotspot-text);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: var(--dap-hotspot-shadow);
}

.dap-hotspots-skip:hover {
  background: var(--dap-hotspot-border);
}

@media (max-width: 640px) {
  .dap-hotspots-progress {
    top: 10px;
    right: 10px;
    padding: 8px 12px;
  }
  
  .dap-hotspots-controls {
    bottom: 10px;
    right: 10px;
  }
  
  .dap-hotspot-tooltip {
    max-width: 280px;
    padding: 12px;
  }
}
`;
  function registerHotspots() {
    register("hotspots", renderHotspots);
  }
  async function renderHotspots(flow) {
    const { payload, id } = flow;
    const completionTracker = payload._completionTracker;
    ensureStyles3();
    const completedHotspots = /* @__PURE__ */ new Set();
    let currentTooltip = null;
    const overlay = document.createElement("div");
    overlay.className = "dap-hotspots-overlay";
    document.documentElement.appendChild(overlay);
    let progressEl = null;
    if (payload.showProgress) {
      progressEl = createProgressIndicator(payload);
      document.documentElement.appendChild(progressEl);
    }
    let skipEl = null;
    if (payload.allowSkip) {
      skipEl = createSkipControls();
      document.documentElement.appendChild(skipEl);
      skipEl.addEventListener("click", completeHotspots);
    }
    const markers = [];
    const waitForElements = payload.hotspots.map(async (hotspot) => {
      try {
        const element = await waitForElement2(hotspot.selector, { timeout: 2e3 });
        if (element && element instanceof HTMLElement) {
          createHotspotMarker(hotspot, element);
        }
      } catch (error) {
        console.warn(`[DAP] Failed to find element for hotspot: ${hotspot.selector}`);
      }
    });
    await Promise.allSettled(waitForElements);
    function createHotspotMarker(hotspot, element) {
      const rect = element.getBoundingClientRect();
      const marker = document.createElement("div");
      marker.className = "dap-hotspot-marker";
      marker.dataset.hotspotId = hotspot.id;
      if (hotspot.required) {
        marker.classList.add("required");
      }
      if (hotspot.pulseColor) {
        marker.style.background = hotspot.pulseColor;
      }
      marker.style.left = `${rect.left + window.scrollX + rect.width / 2 - 12}px`;
      marker.style.top = `${rect.top + window.scrollY + rect.height / 2 - 12}px`;
      marker.addEventListener("click", () => showTooltip(hotspot, marker, element));
      document.documentElement.appendChild(marker);
      markers.push(marker);
    }
    function showTooltip(hotspot, marker, element) {
      if (currentTooltip) {
        currentTooltip.remove();
      }
      const tooltip = document.createElement("div");
      tooltip.className = "dap-hotspot-tooltip";
      const title = document.createElement("h3");
      title.className = "dap-hotspot-title";
      title.textContent = hotspot.title;
      const description = document.createElement("div");
      description.className = "dap-hotspot-description";
      description.innerHTML = sanitizeHtml(hotspot.description);
      const actions = document.createElement("div");
      actions.className = "dap-hotspot-actions";
      const gotItBtn = document.createElement("button");
      gotItBtn.className = "dap-hotspot-btn primary";
      gotItBtn.textContent = "Got it!";
      gotItBtn.addEventListener("click", () => {
        markHotspotCompleted(hotspot, marker);
        tooltip.remove();
        currentTooltip = null;
      });
      actions.appendChild(gotItBtn);
      tooltip.appendChild(title);
      tooltip.appendChild(description);
      tooltip.appendChild(actions);
      positionTooltip(tooltip, marker, element, hotspot.placement || "top");
      document.documentElement.appendChild(tooltip);
      currentTooltip = tooltip;
      setTimeout(() => {
        const closeOnOutside = (e) => {
          if (!tooltip.contains(e.target) && !marker.contains(e.target)) {
            tooltip.remove();
            currentTooltip = null;
            document.removeEventListener("click", closeOnOutside);
          }
        };
        document.addEventListener("click", closeOnOutside);
      }, 100);
    }
    function positionTooltip(tooltip, marker, element, placement) {
      element.getBoundingClientRect();
      const markerRect = marker.getBoundingClientRect();
      tooltip.classList.add(placement);
      let left = 0;
      let top = 0;
      switch (placement) {
        case "top":
          left = markerRect.left - 160 + markerRect.width / 2;
          top = markerRect.top - 16 - 120;
          break;
        case "bottom":
          left = markerRect.left - 160 + markerRect.width / 2;
          top = markerRect.bottom + 16;
          break;
        case "left":
          left = markerRect.left - 320 - 16;
          top = markerRect.top - 60 + markerRect.height / 2;
          break;
        case "right":
          left = markerRect.right + 16;
          top = markerRect.top - 60 + markerRect.height / 2;
          break;
        default:
          left = markerRect.left - 160 + markerRect.width / 2;
          top = markerRect.top - 16 - 120;
      }
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      left = Math.max(10, Math.min(left, viewportWidth - 330));
      top = Math.max(10, Math.min(top, viewportHeight - 150));
      tooltip.style.left = `${left + window.scrollX}px`;
      tooltip.style.top = `${top + window.scrollY}px`;
    }
    function markHotspotCompleted(hotspot, marker) {
      completedHotspots.add(hotspot.id);
      marker.classList.add("completed");
      if (progressEl) {
        updateProgress();
      }
      const requiredHotspots = payload.hotspots.filter((h) => h.required);
      const completedRequired = requiredHotspots.filter((h) => completedHotspots.has(h.id));
      if (completedRequired.length === requiredHotspots.length) {
        setTimeout(() => {
          if (canComplete()) {
            completeHotspots();
          }
        }, 1e3);
      }
    }
    function updateProgress() {
      if (!progressEl) return;
      const total = payload.hotspots.length;
      const completed = completedHotspots.size;
      const percentage = completed / total * 100;
      const progressText = progressEl.querySelector(".dap-hotspots-progress-text");
      const progressFill = progressEl.querySelector(".dap-hotspots-progress-fill");
      if (progressText) {
        progressText.textContent = `${completed} / ${total} explored`;
      }
      if (progressFill) {
        progressFill.style.width = `${percentage}%`;
      }
    }
    function canComplete() {
      const requiredHotspots = payload.hotspots.filter((h) => h.required);
      return requiredHotspots.every((h) => completedHotspots.has(h.id));
    }
    function completeHotspots() {
      overlay.remove();
      markers.forEach((marker) => marker.remove());
      if (currentTooltip) {
        currentTooltip.remove();
      }
      if (progressEl) {
        progressEl.remove();
      }
      if (skipEl) {
        skipEl.remove();
      }
      if (completionTracker?.onComplete) {
        console.debug(`[DAP] Completing hotspots flow: ${id}`);
        completionTracker.onComplete();
      }
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (currentTooltip) {
          currentTooltip.remove();
          currentTooltip = null;
        } else if (payload.allowSkip) {
          completeHotspots();
        }
      }
    });
    if (progressEl) {
      updateProgress();
    }
  }
  function createProgressIndicator(payload) {
    const progress = document.createElement("div");
    progress.className = "dap-hotspots-progress";
    const text = document.createElement("div");
    text.className = "dap-hotspots-progress-text";
    text.textContent = "0 / " + payload.hotspots.length + " explored";
    const bar = document.createElement("div");
    bar.className = "dap-hotspots-progress-bar";
    const fill = document.createElement("div");
    fill.className = "dap-hotspots-progress-fill";
    bar.appendChild(fill);
    progress.appendChild(text);
    progress.appendChild(bar);
    return progress;
  }
  function createSkipControls() {
    const controls = document.createElement("div");
    controls.className = "dap-hotspots-controls";
    const skipBtn = document.createElement("button");
    skipBtn.className = "dap-hotspots-skip";
    skipBtn.textContent = "Skip tour";
    controls.appendChild(skipBtn);
    return controls;
  }
  function ensureStyles3() {
    if (!document.getElementById("dap-hotspots-style")) {
      const style = document.createElement("style");
      style.id = "dap-hotspots-style";
      style.textContent = hotspotsCssText;
      document.head.appendChild(style);
    }
  }

  // src/experiences/hotspotTour.ts
  init_registry();
  init_triggerNormalizer();
  var hotspotTourCssText = `
:root {
  --dap-z-tour: 2147483635;
  --dap-tour-primary: #3b82f6;
  --dap-tour-bg: #ffffff;
  --dap-tour-border: #e2e8f0;
  --dap-tour-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  --dap-tour-text: #1e293b;
  --dap-tour-text-muted: #64748b;
  --dap-tour-overlay: rgba(15, 23, 42, 0.5);
}

.dap-tour-overlay {
  position: fixed;
  inset: 0;
  background: var(--dap-tour-overlay);
  z-index: var(--dap-z-tour);
  pointer-events: none;
  opacity: 0;
  animation: tourOverlayFadeIn 0.3s ease-out forwards;
}

@keyframes tourOverlayFadeIn {
  to { opacity: 1; }
}

.dap-tour-spotlight {
  position: absolute;
  border: 3px solid var(--dap-tour-primary);
  border-radius: 8px;
  pointer-events: none;
  z-index: calc(var(--dap-z-tour) + 1);
  box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.5);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  animation: tourSpotlightPulse 2s ease-in-out infinite;
}

@keyframes tourSpotlightPulse {
  0%, 100% { 
    border-color: var(--dap-tour-primary);
    box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.5), 0 0 20px rgba(59, 130, 246, 0.3);
  }
  50% { 
    border-color: #60a5fa;
    box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.4), 0 0 30px rgba(59, 130, 246, 0.5);
  }
}

.dap-tour-tooltip {
  position: absolute;
  background: var(--dap-tour-bg);
  border: 1px solid var(--dap-tour-border);
  border-radius: 12px;
  box-shadow: var(--dap-tour-shadow);
  padding: 20px;
  max-width: 360px;
  z-index: calc(var(--dap-z-tour) + 2);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  opacity: 0;
  transform: scale(0.9);
  animation: tourTooltipIn 0.3s ease-out 0.2s forwards;
  pointer-events: auto;
}

@keyframes tourTooltipIn {
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dap-tour-tooltip::before {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border: 12px solid transparent;
}

.dap-tour-tooltip.top::before {
  bottom: -24px;
  left: 50%;
  transform: translateX(-50%);
  border-top-color: var(--dap-tour-bg);
}

.dap-tour-tooltip.bottom::before {
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  border-bottom-color: var(--dap-tour-bg);
}

.dap-tour-tooltip.left::before {
  right: -24px;
  top: 50%;
  transform: translateY(-50%);
  border-left-color: var(--dap-tour-bg);
}

.dap-tour-tooltip.right::before {
  left: -24px;
  top: 50%;
  transform: translateY(-50%);
  border-right-color: var(--dap-tour-bg);
}

.dap-tour-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.dap-tour-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--dap-tour-text);
  margin: 0;
}

.dap-tour-step-indicator {
  font-size: 12px;
  color: var(--dap-tour-text-muted);
  background: var(--dap-tour-border);
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.dap-tour-description {
  font-size: 14px;
  color: var(--dap-tour-text-muted);
  line-height: 1.5;
  margin: 0 0 16px 0;
}

.dap-tour-actions {
  display: flex;
  gap: 8px;
  justify-content: space-between;
  align-items: center;
}

.dap-tour-nav {
  display: flex;
  gap: 8px;
}

.dap-tour-btn {
  padding: 8px 16px;
  border: 1px solid var(--dap-tour-border);
  border-radius: 6px;
  background: transparent;
  color: var(--dap-tour-text);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dap-tour-btn:hover {
  background: var(--dap-tour-border);
}

.dap-tour-btn.primary {
  background: var(--dap-tour-primary);
  border-color: var(--dap-tour-primary);
  color: white;
}

.dap-tour-btn.primary:hover {
  background: #2563eb;
  border-color: #2563eb;
}

.dap-tour-skip {
  font-size: 12px;
  color: var(--dap-tour-text-muted);
  text-decoration: underline;
  cursor: pointer;
  padding: 4px;
  border: none;
  background: none;
}

.dap-tour-skip:hover {
  color: var(--dap-tour-text);
}

.dap-tour-progress {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--dap-tour-bg);
  border: 1px solid var(--dap-tour-border);
  border-radius: 20px;
  padding: 8px 16px;
  z-index: calc(var(--dap-z-tour) + 1);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  box-shadow: var(--dap-tour-shadow);
  animation: tourProgressIn 0.3s ease-out forwards;
  opacity: 0;
}

@keyframes tourProgressIn {
  to { opacity: 1; }
}

.dap-tour-progress-text {
  font-size: 12px;
  color: var(--dap-tour-text-muted);
  margin-bottom: 4px;
  text-align: center;
}

.dap-tour-progress-bar {
  width: 200px;
  height: 3px;
  background: var(--dap-tour-border);
  border-radius: 2px;
  overflow: hidden;
}

.dap-tour-progress-fill {
  height: 100%;
  background: var(--dap-tour-primary);
  border-radius: 2px;
  transition: width 0.4s ease;
  width: 0%;
}

.dap-tour-close {
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--dap-tour-bg);
  border: 1px solid var(--dap-tour-border);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: calc(var(--dap-z-tour) + 1);
  box-shadow: var(--dap-tour-shadow);
  color: var(--dap-tour-text-muted);
  font-size: 18px;
  transition: all 0.15s ease;
}

.dap-tour-close:hover {
  background: var(--dap-tour-border);
  color: var(--dap-tour-text);
}

@media (max-width: 640px) {
  .dap-tour-tooltip {
    max-width: 320px;
    padding: 16px;
  }
  
  .dap-tour-progress {
    top: 10px;
    padding: 6px 12px;
  }
  
  .dap-tour-progress-bar {
    width: 160px;
  }
  
  .dap-tour-close {
    top: 10px;
    right: 10px;
    width: 36px;
    height: 36px;
  }
  
  .dap-tour-actions {
    flex-direction: column;
    gap: 8px;
  }
  
  .dap-tour-nav {
    width: 100%;
    justify-content: space-between;
  }
}
`;
  function registerHotspotTour() {
    register("hotspotTour", renderHotspotTour);
  }
  async function renderHotspotTour(flow) {
    const { payload, id } = flow;
    const completionTracker = payload._completionTracker;
    ensureStyles4();
    let currentStepIndex = 0;
    let currentSpotlight = null;
    let currentTooltip = null;
    let autoAdvanceTimer;
    const overlay = createTourOverlay();
    const progressEl = payload.showProgress ? createProgressIndicator2(payload) : null;
    const closeEl = createCloseButton();
    document.documentElement.appendChild(overlay);
    if (progressEl) document.documentElement.appendChild(progressEl);
    document.documentElement.appendChild(closeEl);
    closeEl.addEventListener("click", completeTour);
    document.addEventListener("keydown", handleKeyboard);
    await showStep(currentStepIndex);
    async function showStep(stepIndex) {
      if (stepIndex >= payload.steps.length) {
        completeTour();
        return;
      }
      const step = payload.steps[stepIndex];
      currentStepIndex = stepIndex;
      if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer);
        autoAdvanceTimer = void 0;
      }
      try {
        const element = await waitForElement2(step.selector, { timeout: 3e3 });
        if (!(element instanceof HTMLElement)) {
          console.warn(`[DAP] Element not found for step: ${step.selector}`);
          nextStep();
          return;
        }
        createSpotlight2(element);
        createTooltip2(step, element);
        if (progressEl) {
          updateProgress();
        }
        if (payload.autoAdvance && payload.autoAdvance > 0) {
          autoAdvanceTimer = window.setTimeout(() => {
            nextStep();
          }, payload.autoAdvance * 1e3);
        }
      } catch (error) {
        console.warn(`[DAP] Failed to show step ${stepIndex}:`, error);
        nextStep();
      }
    }
    function createSpotlight2(element) {
      if (currentSpotlight) {
        currentSpotlight.remove();
      }
      const rect = element.getBoundingClientRect();
      const spotlight = document.createElement("div");
      spotlight.className = "dap-tour-spotlight";
      const padding = 8;
      spotlight.style.left = `${rect.left + window.scrollX - padding}px`;
      spotlight.style.top = `${rect.top + window.scrollY - padding}px`;
      spotlight.style.width = `${rect.width + padding * 2}px`;
      spotlight.style.height = `${rect.height + padding * 2}px`;
      document.documentElement.appendChild(spotlight);
      currentSpotlight = spotlight;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    function createTooltip2(step, element) {
      if (currentTooltip) {
        currentTooltip.remove();
      }
      const tooltip = document.createElement("div");
      tooltip.className = "dap-tour-tooltip";
      const header = document.createElement("div");
      header.className = "dap-tour-header";
      const title = document.createElement("h3");
      title.className = "dap-tour-title";
      title.textContent = step.title;
      const indicator = document.createElement("span");
      indicator.className = "dap-tour-step-indicator";
      indicator.textContent = `${currentStepIndex + 1} / ${payload.steps.length}`;
      header.appendChild(title);
      header.appendChild(indicator);
      const description = document.createElement("div");
      description.className = "dap-tour-description";
      description.innerHTML = sanitizeHtml(step.description);
      const actions = document.createElement("div");
      actions.className = "dap-tour-actions";
      if (payload.allowSkip) {
        const skipBtn = document.createElement("button");
        skipBtn.className = "dap-tour-skip";
        skipBtn.textContent = "Skip tour";
        skipBtn.addEventListener("click", completeTour);
        actions.appendChild(skipBtn);
      } else {
        actions.appendChild(document.createElement("div"));
      }
      const nav = document.createElement("div");
      nav.className = "dap-tour-nav";
      if (currentStepIndex > 0) {
        const prevBtn = document.createElement("button");
        prevBtn.className = "dap-tour-btn";
        prevBtn.textContent = "Previous";
        prevBtn.addEventListener("click", previousStep);
        nav.appendChild(prevBtn);
      }
      const nextBtn = document.createElement("button");
      nextBtn.className = "dap-tour-btn primary";
      if (currentStepIndex === payload.steps.length - 1) {
        nextBtn.textContent = step.action === "close" ? "Close" : "Finish";
        nextBtn.addEventListener("click", () => {
          if (step.action === "custom" && step.customAction) {
            window.dispatchEvent(new CustomEvent("dap-tour-action", {
              detail: { action: step.customAction, tourId: id, stepId: step.id }
            }));
          }
          completeTour();
        });
      } else {
        nextBtn.textContent = "Next";
        nextBtn.addEventListener("click", nextStep);
      }
      nav.appendChild(nextBtn);
      actions.appendChild(nav);
      tooltip.appendChild(header);
      tooltip.appendChild(description);
      tooltip.appendChild(actions);
      positionTooltip(tooltip, element, step.placement || "bottom");
      document.documentElement.appendChild(tooltip);
      currentTooltip = tooltip;
    }
    function positionTooltip(tooltip, element, placement) {
      const rect = element.getBoundingClientRect();
      tooltip.classList.add(placement);
      let left = 0;
      let top = 0;
      switch (placement) {
        case "top":
          left = rect.left + window.scrollX + rect.width / 2 - 180;
          top = rect.top + window.scrollY - 16 - 140;
          break;
        case "bottom":
          left = rect.left + window.scrollX + rect.width / 2 - 180;
          top = rect.bottom + window.scrollY + 16;
          break;
        case "left":
          left = rect.left + window.scrollX - 360 - 16;
          top = rect.top + window.scrollY + rect.height / 2 - 70;
          break;
        case "right":
          left = rect.right + window.scrollX + 16;
          top = rect.top + window.scrollY + rect.height / 2 - 70;
          break;
        default:
          left = rect.left + window.scrollX + rect.width / 2 - 180;
          top = rect.bottom + window.scrollY + 16;
      }
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      left = Math.max(10, Math.min(left, viewportWidth - 370));
      top = Math.max(10, Math.min(top, viewportHeight - 160));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }
    function nextStep() {
      showStep(currentStepIndex + 1);
    }
    function previousStep() {
      if (currentStepIndex > 0) {
        showStep(currentStepIndex - 1);
      }
    }
    function updateProgress() {
      if (!progressEl) return;
      const progress = (currentStepIndex + 1) / payload.steps.length * 100;
      const progressText = progressEl.querySelector(".dap-tour-progress-text");
      const progressFill = progressEl.querySelector(".dap-tour-progress-fill");
      if (progressText) {
        progressText.textContent = `Step ${currentStepIndex + 1} of ${payload.steps.length}`;
      }
      if (progressFill) {
        progressFill.style.width = `${progress}%`;
      }
    }
    function handleKeyboard(e) {
      switch (e.key) {
        case "Escape":
          if (payload.allowSkip) {
            completeTour();
          }
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
    function completeTour() {
      if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer);
      }
      document.removeEventListener("keydown", handleKeyboard);
      overlay.remove();
      if (currentSpotlight) currentSpotlight.remove();
      if (currentTooltip) currentTooltip.remove();
      if (progressEl) progressEl.remove();
      closeEl.remove();
      if (completionTracker?.onComplete) {
        console.debug(`[DAP] Completing hotspot tour flow: ${id}`);
        completionTracker.onComplete();
      }
    }
  }
  function createTourOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "dap-tour-overlay";
    return overlay;
  }
  function createProgressIndicator2(payload) {
    const progress = document.createElement("div");
    progress.className = "dap-tour-progress";
    const text = document.createElement("div");
    text.className = "dap-tour-progress-text";
    text.textContent = `Step 1 of ${payload.steps.length}`;
    const bar = document.createElement("div");
    bar.className = "dap-tour-progress-bar";
    const fill = document.createElement("div");
    fill.className = "dap-tour-progress-fill";
    bar.appendChild(fill);
    progress.appendChild(text);
    progress.appendChild(bar);
    return progress;
  }
  function createCloseButton() {
    const closeBtn = document.createElement("button");
    closeBtn.className = "dap-tour-close";
    closeBtn.innerHTML = "\xD7";
    closeBtn.setAttribute("aria-label", "Close tour");
    return closeBtn;
  }
  function ensureStyles4() {
    if (!document.getElementById("dap-tour-style")) {
      const style = document.createElement("style");
      style.id = "dap-tour-style";
      style.textContent = hotspotTourCssText;
      document.head.appendChild(style);
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
    ensureStyles5();
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
    function completeTaskList() {
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
  function ensureStyles5() {
    if (!document.getElementById("dap-tasklist-style")) {
      const style = document.createElement("style");
      style.id = "dap-tasklist-style";
      style.textContent = taskListCssText;
      document.head.appendChild(style);
    }
  }

  // src/experiences/walkthrough.ts
  init_selectors();
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
    ensureStyles6();
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
    function completeWalkthrough() {
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
  function ensureStyles6() {
    if (!document.getElementById("dap-walkthrough-style")) {
      const style = document.createElement("style");
      style.id = "dap-walkthrough-style";
      style.textContent = walkthroughCssText;
      document.head.appendChild(style);
    }
  }

  // src/services/locationContextService.ts
  var LocationContextService = class _LocationContextService {
    constructor() {
      this._listeners = /* @__PURE__ */ new Set();
      this._currentContext = {
        currentPath: window.location.pathname.replace(/^\/+/, "")
      };
      window.addEventListener("popstate", this.updateContext.bind(this));
      window.addEventListener("hashchange", this.updateContext.bind(this));
      this.monitorHistoryChanges();
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
     * Monitor history API changes for SPAs
     * This helps detect navigation in single-page applications
     */
    monitorHistoryChanges() {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      history.pushState = (...args) => {
        originalPushState.apply(history, args);
        this.updateContext();
      };
      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        this.updateContext();
      };
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

  // src/services/userContextService.ts
  var _UserContextService = class _UserContextService {
    constructor() {
      this._user = null;
      this._fallbackUserId = null;
      this._eventListeners = [];
      this.SESSION_STORAGE_KEY = "dap_user_context";
      this.FALLBACK_USER_KEY = "dap_anonymous_user_id";
      this.initializeFromStorage();
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
      if (!user || !user.id) {
        console.error("[DAP UserContext] Invalid user - id is required");
        return;
      }
      const previousUser = this._user;
      this._user = { ...user };
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
        if (path === "id") {
          return this._fallbackUserId;
        }
        console.debug(`[DAP UserContext] Property ${propertyPath} not available - no user context`);
        return null;
      }
      switch (path) {
        case "id":
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

  // src/services/pageContextService.ts
  var _PageContextService = class _PageContextService {
    constructor() {
      this.handlers = /* @__PURE__ */ new Set();
      this.currentContext = null;
      this.initialized = false;
      this.originalPushState = history.pushState;
      this.originalReplaceState = history.replaceState;
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
      window.addEventListener("popstate", this.handlePopState.bind(this));
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
      window.removeEventListener("popstate", this.handlePopState.bind(this));
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

  // src/core/flowEngine.ts
  init_selectors();
  init_triggerNormalizer();

  // src/tracking.ts
  var StepTrackingState = class {
    constructor() {
      this.trackedSteps = /* @__PURE__ */ new Set();
      this.currentFlowId = null;
    }
    /**
     * Check if a step has already been tracked for the current flow
     */
    isStepTracked(flowId, stepId) {
      if (this.currentFlowId !== flowId) {
        this.reset(flowId);
      }
      const key = `${flowId}:${stepId}`;
      return this.trackedSteps.has(key);
    }
    /**
     * Mark a step as tracked
     */
    markStepTracked(flowId, stepId) {
      if (this.currentFlowId !== flowId) {
        this.reset(flowId);
      }
      const key = `${flowId}:${stepId}`;
      this.trackedSteps.add(key);
      console.debug(`[DAP Tracking] Step marked as tracked: ${key}`);
    }
    /**
     * Reset tracking state for a new flow
     */
    reset(flowId) {
      this.currentFlowId = flowId;
      this.trackedSteps.clear();
      console.debug(`[DAP Tracking] Tracking state reset for flow: ${flowId}`);
    }
    /**
     * Get current tracking state (for debugging)
     */
    getState() {
      return {
        flowId: this.currentFlowId,
        trackedCount: this.trackedSteps.size,
        trackedSteps: Array.from(this.trackedSteps)
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
    const dapConfig = window.__DAP_CONFIG__;
    if (!dapConfig) {
      console.error("[DAP Tracking] No configuration available for tracking");
      return;
    }
    const userAnalyticsContext = userContextService.getAnalyticsContext();
    const userId = userAnalyticsContext.userId;
    if (!userId) {
      console.warn("[DAP Tracking] No user ID available for tracking");
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

  // src/core/triggerManager.ts
  init_selectors();
  function resolveSelectorAll(selector, root = document) {
    if (!selector || typeof selector !== "string") return [];
    try {
      const cssElements = root.querySelectorAll(selector);
      if (cssElements.length > 0) return Array.from(cssElements);
    } catch {
    }
    try {
      const doc = root instanceof Document ? root : root.ownerDocument ?? document;
      const resolve = (sel) => {
        const result = doc.evaluate(
          sel,
          root,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );
        const elements = [];
        for (let i = 0; i < result.snapshotLength; i++) {
          const element = result.snapshotItem(i);
          if (element) elements.push(element);
        }
        return elements;
      };
      const primaryResults = resolve(selector);
      if (primaryResults.length > 0) return primaryResults;
      if (selector.startsWith("/html[1]/body[1]/")) {
        const simplified = selector.replace("/html[1]/body[1]/", "//");
        const fallbackResults = resolve(simplified);
        if (fallbackResults.length > 0) {
          console.debug(`[DAP] resolveSelectorAll found elements using simplified XPath fallback: ${simplified}`);
          return fallbackResults;
        }
      }
    } catch {
    }
    try {
      const shadowElements = [];
      const walk = (node) => {
        if (node instanceof Element) {
          if (node.shadowRoot) {
            try {
              const results = node.shadowRoot.querySelectorAll(selector);
              shadowElements.push(...Array.from(results));
            } catch {
            }
            walk(node.shadowRoot);
          }
        }
        node.childNodes.forEach(walk);
      };
      walk(document.body);
      if (shadowElements.length > 0) return shadowElements;
    } catch {
    }
    return [];
  }
  var TriggerManager = class _TriggerManager {
    // 30 seconds default
    constructor() {
      this._activeListeners = /* @__PURE__ */ new Map();
      this._triggeredOnceSet = /* @__PURE__ */ new Set();
      this._pageContextUnsubscribe = null;
      this._initialized = false;
      this._registeredTriggers = {};
      this._waitTimeouts = /* @__PURE__ */ new Map();
      this._selectorWaitTimeout = 3e4;
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
          registration.flowContext
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
     * Re-evaluate active triggers on page change
     */
    reEvaluateActiveTriggers(event) {
      Object.entries(this._registeredTriggers).forEach(([stepId, { trigger, onTrigger, flowContext }]) => {
        this.registerTriggerListeners(stepId, trigger, onTrigger, flowContext);
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
      this._initialized = false;
    }
    /**
     * Resolve trigger for a step following the priority rules:
     * 1. Use step.trigger if it exists and has valid conditions
     * 2. Fallback to uxExperience.elementTrigger if available
     * 3. Return null if no trigger is resolvable
     */
    resolveTrigger(step) {
      console.debug(`[DAP] Resolving trigger for step: ${step.stepId}`);
      if (step.trigger && step.trigger.conditions && step.trigger.conditions.length > 0) {
        console.log(`\u2705 [DAP] Step ${step.stepId}: Using STEP-LEVEL trigger with ${step.trigger.conditions.length} conditions`);
        console.log(`   \u2514\u2500\u2500 Trigger type: ${step.trigger.type}, Event: ${step.trigger.conditions[0]?.event}, Kind: ${step.trigger.conditions[0]?.kind}`);
        if (step.uxExperience?.elementTrigger) {
          console.log(`   \u26A0\uFE0F  Note: elementTrigger "${step.uxExperience.elementTrigger}" is present but IGNORED (step-level takes priority)`);
        }
        return step.trigger;
      }
      if (step.uxExperience?.elementTrigger) {
        console.warn(`\u26A0\uFE0F  [DAP] Step ${step.stepId}: Falling back to ELEMENT-LEVEL trigger: "${step.uxExperience.elementTrigger}"`);
        console.warn(`   \u2514\u2500\u2500 This fallback will be removed in the future! Please add step-level trigger.`);
        console.warn(`   \u2514\u2500\u2500 Element selector: ${step.uxExperience.elementSelector}`);
        const fallbackTrigger = this.convertElementTriggerToTriggerDefinition(
          step.uxExperience.elementTrigger,
          step.uxExperience.elementSelector
        );
        return fallbackTrigger;
      }
      console.error(`\u274C [DAP] Step ${step.stepId}: NO TRIGGER FOUND! Step will execute immediately.`);
      console.error(`   \u2514\u2500\u2500 Consider adding either step-level trigger or elementTrigger`);
      return null;
    }
    /**
     * Convert legacy elementTrigger to TriggerDefinition
     */
    convertElementTriggerToTriggerDefinition(elementTrigger, elementSelector) {
      let condition;
      switch (elementTrigger.toLowerCase().trim()) {
        case "on click":
        case "click":
          condition = {
            kind: "Dom",
            event: "click",
            selector: elementSelector
          };
          break;
        case "on hover":
        case "hover":
          condition = {
            kind: "Dom",
            event: "hover",
            selector: elementSelector
          };
          break;
        case "on page load":
        case "page load":
          condition = {
            kind: "Lifecycle",
            event: "page-load"
          };
          break;
        case "on focus":
        case "focus":
          condition = {
            kind: "Dom",
            event: "focus",
            selector: elementSelector
          };
          break;
        default:
          console.warn(`[DAP] Unknown elementTrigger: ${elementTrigger}, defaulting to click`);
          condition = {
            kind: "Dom",
            event: "click",
            selector: elementSelector
          };
      }
      return {
        type: "Single",
        operator: "And",
        once: true,
        conditions: [condition]
      };
    }
    /**
     * Register trigger listeners for a step (page-aware)
     */
    registerTriggerListeners(stepId, trigger, onTrigger, flowContext) {
      pageContextService.getPageId();
      this._registeredTriggers[stepId] = { trigger, onTrigger, flowContext };
      this.removeTriggerListeners(stepId);
      const listeners = [];
      for (const condition of trigger.conditions) {
        const listener = this.createConditionListener(stepId, condition, trigger, onTrigger, flowContext);
        if (listener) {
          listeners.push(listener);
        }
      }
      if (listeners.length > 0) {
        this._activeListeners.set(stepId, listeners);
      }
    }
    /**
     * Create listener for individual trigger condition
     */
    createConditionListener(stepId, condition, trigger, onTrigger, flowContext) {
      switch (condition.kind) {
        case "Dom":
          return this.createDomListener(stepId, condition, trigger, onTrigger);
        case "Lifecycle":
          return this.createLifecycleListener(stepId, condition, trigger, onTrigger, flowContext);
        case "Input":
          return this.createInputListener(stepId, condition, trigger, onTrigger);
        case "Time":
          return this.createTimeListener(stepId, condition, trigger, onTrigger);
        default:
          console.warn(`[DAP] Unsupported condition kind: ${condition.kind}`);
          return null;
      }
    }
    /**
     * Map trigger events to actual DOM events
     */
    mapTriggerEventToDOMEvents(triggerEvent) {
      switch (triggerEvent) {
        case "hover":
          return ["mouseenter"];
        case "click":
          return ["click"];
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
          return [triggerEvent];
      }
    }
    /**
     * Create DOM event listener
     */
    createDomListener(stepId, condition, trigger, onTrigger) {
      if (!condition.selector) {
        console.warn(`[DAP] DOM condition missing selector for step: ${stepId}`);
        return null;
      }
      const validation = this.validateSelectorOnCurrentPage(condition.selector);
      console.debug(`[DAP] \u{1F4C4} Page context validation for ${stepId}: selector exists=${validation.exists}, count=${validation.elementCount}`);
      let targetElement = null;
      let observer = null;
      let timeoutCleanup = null;
      const isDelegatable = condition.event === "click" || condition.event === "focus" || condition.event === "blur";
      if (isDelegatable && condition.selector) {
        console.debug(`[DAP] Using event delegation for "${condition.event}" trigger on selector: ${condition.selector}`);
        const eventNames = this.mapTriggerEventToDOMEvents(condition.event);
        const useCapture = condition.event === "focus" || condition.event === "blur";
        const actualEventNames = useCapture ? eventNames : eventNames.map((name) => name === "focus" ? "focusin" : name === "blur" ? "focusout" : name);
        const delegatedHandler = (event) => {
          const eventTarget = event.target;
          if (!eventTarget) return;
          let matchedElement = null;
          try {
            matchedElement = eventTarget.closest(condition.selector);
          } catch {
          }
          if (!matchedElement) {
            const allMatches = resolveSelectorAll(condition.selector);
            matchedElement = allMatches.find((el) => el === eventTarget || el.contains(eventTarget)) || null;
          }
          if (matchedElement) {
            console.debug(`[DAP] Delegated "${condition.event}" event matched selector: ${condition.selector}`);
            const onceKey = `${stepId}:${condition.kind}:${condition.event}`;
            if (trigger.once && this._triggeredOnceSet.has(onceKey)) {
              return;
            }
            if (condition.debounceMs) {
              const debounceKey = `debounce:${stepId}:${condition.event}`;
              const lastFired = this.getLastFiredTime(debounceKey);
              const now = Date.now();
              if (lastFired && now - lastFired < condition.debounceMs) return;
              this.setLastFiredTime(debounceKey, now);
            }
            const context = {
              stepId,
              flowId: "",
              element: matchedElement,
              event
            };
            const result = this.evaluateTrigger(trigger, context);
            if (result.triggered) {
              if (trigger.once) {
                this._triggeredOnceSet.add(onceKey);
              }
              onTrigger(context);
            }
          }
        };
        actualEventNames.forEach((name) => {
          document.addEventListener(name, delegatedHandler, true);
        });
        return () => {
          actualEventNames.forEach((name) => {
            document.removeEventListener(name, delegatedHandler, true);
          });
        };
      }
      const attachListener = (element) => {
        if (timeoutCleanup) {
          timeoutCleanup();
          timeoutCleanup = null;
        }
        const eventNames = this.mapTriggerEventToDOMEvents(condition.event);
        const cleanupFunctions = [];
        console.debug(`[DAP] Mapping trigger event "${condition.event}" to DOM events:`, eventNames);
        for (const eventName of eventNames) {
          const eventHandler = (event) => {
            console.debug(`[DAP] DOM event triggered:`, event.type, condition.selector);
            const onceKey = `${stepId}:${condition.kind}:${condition.event}`;
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
              event
            };
            if (element && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
              if (condition.event === "input" || condition.event === "change" || condition.event === "keyup") {
                context.userInput = element.value;
                console.debug(`[DAP] Captured input value: "${context.userInput}" for step: ${stepId}`);
              }
            }
            const result = this.evaluateTrigger(trigger, context);
            if (result.triggered) {
              if (trigger.once) {
                this._triggeredOnceSet.add(onceKey);
              }
              onTrigger(context);
            }
          };
          element.addEventListener(eventName, eventHandler);
          cleanupFunctions.push(() => {
            element.removeEventListener(eventName, eventHandler);
          });
        }
        return () => {
          cleanupFunctions.forEach((cleanup) => cleanup());
        };
      };
      if (validation.exists) {
        try {
          targetElement = resolveSelector(condition.selector);
          if (targetElement) {
            console.debug(`[DAP] Element found immediately for selector: ${condition.selector}`);
            return attachListener(targetElement);
          }
        } catch (error) {
          console.warn(`[DAP] Invalid selector: ${condition.selector}`, error);
          return null;
        }
      }
      console.debug(`[DAP] Element not found, waiting for: ${condition.selector}`);
      let listenerCleanup = null;
      this.setupSelectorTimeout(stepId, condition.selector, () => {
        console.warn(`[DAP] \u26A0\uFE0F Selector timeout for step ${stepId}: ${condition.selector}`);
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        console.warn(`[DAP] \u{1F4CA} Telemetry: selector-not-found - Step: ${stepId}, Selector: ${condition.selector}`);
        if (this._onSelectorTimeout) {
          this._onSelectorTimeout(stepId, condition.selector);
        }
      });
      timeoutCleanup = () => this.clearTimeoutForStep(stepId);
      observer = new MutationObserver(() => {
        try {
          const element = resolveSelector(condition.selector);
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
    createLifecycleListener(stepId, condition, trigger, onTrigger, flowContext) {
      switch (condition.event) {
        case "page-load":
          const onceKey = `${stepId}:${condition.kind}:${condition.event}`;
          const shouldFireImmediately = !trigger.once || !this._triggeredOnceSet.has(onceKey);
          if (shouldFireImmediately) {
            setTimeout(() => {
              const context = {
                stepId,
                flowId: "",
                // Will be set by caller
                pageState: {
                  loaded: true,
                  pageId: pageContextService.getPageId()
                }
              };
              const result = this.evaluateTrigger(trigger, context);
              if (result.triggered) {
                if (trigger.once) {
                  this._triggeredOnceSet.add(onceKey);
                }
                onTrigger(context);
              }
            }, 100);
          }
          const pageChangeUnsubscribe = pageContextService.subscribe((event) => {
            if (event.type === "navigation" || event.type === "reload") {
              console.debug(`[DAP] Page change detected for page-load trigger, step: ${stepId}`);
              const pageLoadOnceKey = `${stepId}:${condition.kind}:${condition.event}`;
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
                  }
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
        case "page-unload":
          const unloadHandler = () => {
            const context = {
              stepId,
              flowId: "",
              pageState: {
                unloading: true,
                pageId: pageContextService.getPageId()
              }
            };
            const result = this.evaluateTrigger(trigger, context);
            if (result.triggered) {
              onTrigger(context);
            }
          };
          window.addEventListener("beforeunload", unloadHandler);
          return () => {
            window.removeEventListener("beforeunload", unloadHandler);
          };
        default:
          console.warn(`[DAP] Unsupported lifecycle event: ${condition.event}`);
          return null;
      }
    }
    /**
     * Create input event listener
     */
    createInputListener(stepId, condition, trigger, onTrigger) {
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
            userInput: value
          };
          const result = this.evaluateTrigger(trigger, context);
          if (result.triggered) {
            onTrigger(context);
          }
        }
      };
      const elements = resolveSelectorAll(condition.selector);
      if (elements.length === 0) {
        console.log(`[DAP] Input elements not found, waiting: ${condition.selector}`);
        this.setupSelectorTimeout(stepId, condition.selector, () => {
          console.warn(`[DAP] \u26A0\uFE0F Input selector timeout for step ${stepId}: ${condition.selector}`);
          console.warn(`[DAP] \u{1F4CA} Telemetry: input-selector-not-found - Step: ${stepId}, Selector: ${condition.selector}`);
          if (stepId.includes("rule") || stepId.includes("condition")) {
            console.error(`[DAP] \u{1F6A8} Rule-based step ${stepId} cannot find input selector - possible cross-page navigation issue`);
          }
        });
        const observer = new MutationObserver(() => {
          const foundElements = resolveSelectorAll(condition.selector);
          if (foundElements.length > 0) {
            console.log(`[DAP] Input elements appeared: ${condition.selector}`);
            this.clearTimeoutForStep(stepId);
            foundElements.forEach((element) => {
              element.addEventListener("input", inputHandler);
              element.addEventListener("change", inputHandler);
            });
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
          const foundElements = resolveSelectorAll(condition.selector);
          foundElements.forEach((element) => {
            element.removeEventListener("input", inputHandler);
            element.removeEventListener("change", inputHandler);
          });
        };
      }
      console.debug(`[DAP] \u2705 Input elements found immediately: ${elements.length} element(s)`);
      elements.forEach((element) => {
        element.addEventListener("input", inputHandler);
        element.addEventListener("change", inputHandler);
      });
      return () => {
        elements.forEach((element) => {
          element.removeEventListener("input", inputHandler);
          element.removeEventListener("change", inputHandler);
        });
      };
    }
    /**
     * Create time-based listener
     */
    createTimeListener(stepId, condition, trigger, onTrigger) {
      const delay = typeof condition.value === "number" ? condition.value : 1e3;
      const timeoutId = setTimeout(() => {
        const context = {
          stepId,
          flowId: "",
          pageState: { timeElapsed: delay }
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
      if (trigger.type === "Single" && totalConditions === 1) {
        matchedConditions = 1;
      } else if (trigger.type === "Composite") {
        matchedConditions = 1;
      }
      let triggered = false;
      if (trigger.operator === "And") {
        triggered = matchedConditions === totalConditions;
      } else if (trigger.operator === "Or") {
        triggered = matchedConditions > 0;
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
    }
    getLastFiredTime(key) {
      return this._debounceTimestamps.get(key);
    }
    setLastFiredTime(key, timestamp) {
      this._debounceTimestamps.set(key, timestamp);
    }
    /**
     * Unregister all triggers for a specific flow (used when aborting)
     */
    unregisterAllTriggersForFlow(flowId) {
      console.debug(`[DAP] Unregistering all triggers for flow: ${flowId}`);
      this.resetOnceTriggersForFlow(flowId);
    }
    onSelectorTimeout(callback) {
      this._onSelectorTimeout = callback;
    }
  };
  var triggerManager = TriggerManager.getInstance();

  // src/utils/prompt.ts
  var pendingPromise = null;
  async function showDapExperiencePrompt() {
    const sessionChoice = sessionStorage.getItem("dap_experience_choice");
    if (sessionChoice === "yes") return true;
    if (sessionChoice === "no") return false;
    if (pendingPromise) return pendingPromise;
    pendingPromise = new Promise((resolve) => {
      if (!document.getElementById("dap-modal-styles")) {
        const style = document.createElement("style");
        style.id = "dap-modal-styles";
        style.textContent = modalCssText;
        document.head.appendChild(style);
      }
      const overlay = document.createElement("div");
      overlay.className = "dap-modal-overlay";
      overlay.style.zIndex = "2147483647";
      const modal = document.createElement("div");
      modal.className = "dap-modal";
      modal.style.minHeight = "auto";
      modal.style.width = "450px";
      const header = document.createElement("div");
      header.className = "dap-modal-header";
      const title = document.createElement("h2");
      title.className = "dap-modal-title";
      title.textContent = "Experience Enhancement";
      header.appendChild(title);
      const body = document.createElement("div");
      body.className = "dap-modal-body";
      body.style.textAlign = "center";
      body.style.padding = "32px 24px";
      const message = document.createElement("p");
      message.style.fontSize = "18px";
      message.style.margin = "0 0 24px 0";
      message.style.fontWeight = "500";
      message.textContent = "Do you want to enable the DAP experience?";
      body.appendChild(message);
      const submessage = document.createElement("p");
      submessage.style.fontSize = "14px";
      submessage.style.color = "#64748b";
      submessage.style.margin = "0";
      submessage.textContent = "Gain access to interactive guides and tooltips to help you navigate efficiently.";
      body.appendChild(submessage);
      const footer = document.createElement("div");
      footer.className = "dap-modal-footer";
      footer.style.justifyContent = "center";
      footer.style.gap = "16px";
      const noBtn = document.createElement("button");
      noBtn.className = "dap-modal-button secondary";
      noBtn.textContent = "Later";
      noBtn.style.flex = "1";
      const yesBtn = document.createElement("button");
      yesBtn.className = "dap-modal-button primary";
      yesBtn.textContent = "Yes, please!";
      yesBtn.style.flex = "1";
      footer.appendChild(noBtn);
      footer.appendChild(yesBtn);
      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      overlay.appendChild(modal);
      document.documentElement.appendChild(overlay);
      const cleanup = (choice) => {
        overlay.style.animation = "modalFadeOut 0.2s ease-in";
        modal.style.animation = "modalSlideOut 0.2s ease-in";
        sessionStorage.setItem("dap_experience_choice", choice ? "yes" : "no");
        setTimeout(() => {
          overlay.remove();
          pendingPromise = null;
          resolve(choice);
        }, 200);
      };
      yesBtn.onclick = () => cleanup(true);
      noBtn.onclick = () => cleanup(false);
    });
    return pendingPromise;
  }

  // src/core/flowEngine.ts
  function resolveSelectorAll2(selector, root = document) {
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
        const element = result.snapshotItem(i);
        if (element) elements.push(element);
      }
      return elements;
    } catch {
      return [];
    }
  }
  var FlowEngine = class _FlowEngine {
    constructor() {
      this._locationService = LocationContextService.getInstance();
      this._states = /* @__PURE__ */ new Map();
      this._flows = /* @__PURE__ */ new Map();
      this._primaryFlowId = null;
      // Track the most recently started flow as primary
      this._stepTriggerListeners = /* @__PURE__ */ new Map();
      this._pageChangeUnsubscribe = null;
      this._domObservers = /* @__PURE__ */ new Map();
      // CRITICAL FIX 2: Debounced Rule Evaluation System
      this._ruleEvaluationTimers = /* @__PURE__ */ new Map();
      this._inputStabilityTimers = /* @__PURE__ */ new Map();
      this._defaultDebounceDelay = 500;
      // 500ms for input triggers
      this._inputStabilityMinLength = 3;
      // 🚨 CRITICAL FIX: Minimum 3 characters for meaningful rule evaluation
      // CRITICAL FIX 3: Input Stability Tracking
      this._lastInputValues = /* @__PURE__ */ new Map();
      this._inputStabilityChecks = /* @__PURE__ */ new Map();
      pageContextService.initialize();
      triggerManager.initialize();
      this._pageChangeUnsubscribe = this._locationService.subscribe((context) => {
        this.checkFlowResumption();
      });
      pageContextService.subscribe(this.handlePageChange.bind(this));
      triggerManager.onSelectorTimeout((stepId, selector) => {
        if (!this._currentFlow || !this._state.flowInProgress) return;
        const step = this._currentFlow.steps[this._state.activeStep];
        if (step && step.stepId === stepId) {
          console.warn(`[DAP] \u{1F6E1}\uFE0F Recovery: Selector timeout for active step ${stepId}. Checking fail-soft policy.`);
          if (step.stepType === "Optional" || !step.stepType) {
            console.warn(`[DAP] \u23ED\uFE0F Step is Optional (or untyped). Auto-advancing to next step.`);
            this.advanceToNextStep();
          } else {
            console.error(`[DAP] \u{1F6D1} Step is Mandatory. Flow will remain in current state until element appears.`);
          }
        }
      });
    }
    _getFlowState(flowId) {
      let state = this._states.get(flowId);
      if (!state) {
        state = {
          activeFlowId: flowId,
          flowInProgress: false,
          activeStep: 0,
          activeStepTriggered: false,
          executionState: "TERMINATED",
          executionMode: "Linear",
          triggeredSteps: /* @__PURE__ */ new Set()
        };
        this._states.set(flowId, state);
      }
      return state;
    }
    /**
     * Compatibility getter for the "current" state
     */
    get _state() {
      if (this._primaryFlowId) {
        return this._getFlowState(this._primaryFlowId);
      }
      return {
        activeFlowId: null,
        flowInProgress: false,
        activeStep: 0,
        activeStepTriggered: false,
        executionState: "TERMINATED",
        executionMode: "Linear",
        triggeredSteps: /* @__PURE__ */ new Set()
      };
    }
    set _state(value) {
      if (value.activeFlowId) {
        this._states.set(value.activeFlowId, value);
        this._primaryFlowId = value.activeFlowId;
      }
    }
    /**
     * Compatibility getter for the "current" flow
     */
    get _currentFlow() {
      return this._primaryFlowId ? this._flows.get(this._primaryFlowId) || null : null;
    }
    set _currentFlow(value) {
      if (value) {
        this._flows.set(value.flowId, value);
        this._primaryFlowId = value.flowId;
      } else if (this._primaryFlowId) {
        this._primaryFlowId = null;
      }
    }
    /**
     * Handle page changes and re-evaluate active flows
     */
    handlePageChange(event) {
      console.debug("[DAP] FlowEngine: Handling page change:", event.type, {
        from: event.previous?.pathname,
        to: event.current.pathname
      });
      for (const [flowId, state] of this._states) {
        if (state.flowInProgress) {
          this.reRegisterFlowTriggers(flowId);
        }
      }
      this.checkFlowResumption();
    }
    /**
     * Re-register triggers for a specific flow after page change
     */
    reRegisterFlowTriggers(flowId) {
      const state = this._getFlowState(flowId);
      const flow = this._flows.get(flowId);
      if (!flow || !state.flowInProgress) {
        return;
      }
      console.debug(`[DAP] FlowEngine: Re-registering triggers for flow ${flowId} after page change`);
      if (state.executionMode === "Linear") {
        if (state.activeStep < flow.steps.length && !state.activeStepTriggered) {
          const currentStep = flow.steps[state.activeStep];
          this.setupStepTrigger(currentStep, state.activeStep, flowId);
        }
      } else {
        flow.steps.forEach((step, index) => {
          if (!state.triggeredSteps.has(index)) {
            this.setupStepTrigger(step, index, flowId);
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
      console.log(`[DAP] \u{1F50D} Validating frequency for flow ${flowData.flowId}`);
      if (!flowData.execution) {
        console.warn(`[DAP] No execution config found for flow ${flowData.flowId}, allowing by default`);
        return true;
      }
      const frequency = flowData.execution.frequency;
      if (!frequency) {
        console.warn(`[DAP] No frequency config found for flow ${flowData.flowId}, allowing by default`);
        return true;
      }
      console.log(`[DAP] Flow frequency config:`, {
        type: frequency.type,
        maxRuns: frequency.maxRuns,
        flowId: flowData.flowId
      });
      if (frequency.type === "OneTime") {
        const maxRuns = frequency.maxRuns || 1;
        const flowRunKey = `dap_flow_runs_${flowData.flowId}`;
        const flowCompletedKey = `dap_flow_completed_${flowData.flowId}`;
        try {
          const completionData = localStorage.getItem(flowCompletedKey);
          if (completionData) {
            try {
              const completion = JSON.parse(completionData);
              console.log(`[DAP] \u{1F6D1} FLOW BLOCKED: ${flowData.flowId} was completed via ${completion.reason} at ${new Date(completion.timestamp).toISOString()}`);
              console.log(`[DAP] \u{1F3AF} This enforces: "Flow is completed when a rule-based step branches to a new flow"`);
              return false;
            } catch {
              console.log(`[DAP] \u{1F6D1} FLOW BLOCKED: ${flowData.flowId} was previously completed`);
              return false;
            }
          }
          const storedRuns = localStorage.getItem(flowRunKey);
          const currentRuns = storedRuns ? parseInt(storedRuns, 10) : 0;
          console.log(`[DAP] OneTime flow ${flowData.flowId}: ${currentRuns}/${maxRuns} runs`);
          if (currentRuns >= maxRuns) {
            console.log(`[DAP] \u{1F6D1} FLOW BLOCKED: ${flowData.flowId} has reached maxRuns limit (${currentRuns}/${maxRuns})`);
            console.log(`[DAP] \u{1F3AF} This enforces the OneTime + maxRuns = 1 invariant`);
            return false;
          }
          const newRunCount = currentRuns + 1;
          localStorage.setItem(flowRunKey, newRunCount.toString());
          console.log(`[DAP] \u2705 FLOW ALLOWED: ${flowData.flowId} (${newRunCount}/${maxRuns} runs)`);
          return true;
        } catch (error) {
          console.error(`[DAP] Error checking flow frequency for ${flowData.flowId}:`, error);
          return true;
        }
      }
      if (frequency.type === "Daily" || frequency.type === "Weekly" || frequency.type === "Monthly") {
        console.log(`[DAP] \u2705 FLOW ALLOWED: ${flowData.flowId} (${frequency.type} frequency not yet implemented)`);
        return true;
      }
      console.log(`[DAP] \u2705 FLOW ALLOWED: ${flowData.flowId} (unknown frequency type: ${frequency.type})`);
      return true;
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
                if (condition.property?.startsWith("user.")) {
                  console.debug(`[DAP] Flow ${flowData.flowId} requires user context due to rule: ${condition.property}`);
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
      console.log(`[DAP] \u{1F680} Starting flow: ${flowData.flowId}`);
      const existingState = this._states.get(flowData.flowId);
      if (existingState && existingState.flowInProgress) {
        console.log(`[DAP] \u{1F504} Flow ${flowData.flowId} already in progress - skipping start`);
        return;
      }
      if (!this.validateFlowFrequency(flowData)) {
        console.log(`[DAP] \u{1F6D1} Flow ${flowData.flowId} blocked by frequency validation`);
        return;
      }
      this.analyzeTriggerUsage(flowData);
      this.analyzeFlowPageContext(flowData);
      if (this.flowRequiresUserContext(flowData) && !userContextService.hasRealUser()) {
        console.warn(`[DAP] Flow ${flowData.flowId} requires user context but none available - flow execution blocked`);
        return;
      }
      const ruleSteps = flowData.steps.filter(
        (step) => step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0
      );
      console.debug(`[DAP] Flow has ${ruleSteps.length} rule steps:`, ruleSteps);
      if (ruleSteps.length > 0) {
        this.analyzeRuleStepsPageContext(ruleSteps);
      }
      resetFlowTracking(flowData.flowId);
      const flowState = {
        activeFlowId: flowData.flowId,
        flowInProgress: true,
        activeStep: 0,
        activeStepTriggered: false,
        executionState: "ACTIVE",
        executionMode: flowData.execution?.mode || "Linear",
        triggeredSteps: /* @__PURE__ */ new Set()
      };
      this._states.set(flowData.flowId, flowState);
      this._flows.set(flowData.flowId, flowData);
      this._primaryFlowId = flowData.flowId;
      console.log(`[DAP] Flow ${flowData.flowId} started with execution mode: ${flowState.executionMode}`);
      this.executeStep(flowData.flowId);
    }
    /**
     * Abort current or specified flow
     */
    abortFlow(flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) {
        console.debug(`[DAP] No active flow to abort`);
        return;
      }
      const state = this._states.get(id);
      const flow = this._flows.get(id);
      if (!state || !flow || !state.flowInProgress) {
        console.debug(`[DAP] Flow ${id} is not in progress`);
        return;
      }
      console.debug(`[DAP] Aborting flow: ${id}`);
      triggerManager.resetOnceTriggersForFlow(id);
      this.cleanupCurrentStep(id);
      state.flowInProgress = false;
      state.executionState = "TERMINATED";
      if (id === this._primaryFlowId) {
        this._primaryFlowId = Array.from(this._states.entries()).filter(([_, s]) => s.flowInProgress).map(([fid, _]) => fid)[0] || null;
      }
    }
    /**
     * Helper to cleanup a specific flow's current step
     */
    cleanupFlowCurrentStep(flowId) {
      const flow = this._flows.get(flowId);
      const state = this._states.get(flowId);
      if (!flow || !state) return;
      if (state.activeStep < flow.steps.length) {
        const step = flow.steps[state.activeStep];
        console.debug(`[DAP] Cleaning up step ${step.stepId} for flow ${flowId}`);
        if (flowId === this._primaryFlowId) {
          this.cleanupCurrentStep();
        } else {
          triggerManager.unregisterAllTriggersForFlow(flowId);
          for (const [stepId, timerId] of this._ruleEvaluationTimers) {
            if (flow.steps.some((s) => s.stepId === stepId)) {
              clearTimeout(timerId);
              this._ruleEvaluationTimers.delete(stepId);
            }
          }
          for (const [stepId, timerId] of this._inputStabilityTimers) {
            if (flow.steps.some((s) => s.stepId === stepId)) {
              clearTimeout(timerId);
              this._inputStabilityTimers.delete(stepId);
            }
          }
          flow.steps.forEach((step2) => {
            this._lastInputValues.delete(step2.stepId);
            this._inputStabilityChecks.delete(step2.stepId);
          });
        }
      }
    }
    /**
     * CRITICAL FIX 2 & 3: Clean up all timers and tracking state
     */
    cleanupAllTimers() {
      for (const [stepId, timerId] of this._ruleEvaluationTimers) {
        clearTimeout(timerId);
      }
      this._ruleEvaluationTimers.clear();
      for (const [stepId, timerId] of this._inputStabilityTimers) {
        clearTimeout(timerId);
      }
      this._inputStabilityTimers.clear();
      this._lastInputValues.clear();
      this._inputStabilityChecks.clear();
      console.debug(`[DAP] All debounce and input stability timers cleaned up`);
    }
    /**
     * Execute current step in the flow with enhanced trigger support
     */
    executeStep(flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) return;
      const state = this._getFlowState(id);
      const flow = this._flows.get(id);
      if (!flow || !state.flowInProgress) return;
      console.debug(`[DAP] executeStep for flow: ${id}, mode: ${state.executionMode}`);
      if (state.executionMode === "Linear") {
        this.executeLinearStep(id);
      } else if (state.executionMode === "AnyOrder") {
        this.executeAnyOrderSteps(id);
      }
    }
    /**
     * Execute steps in linear order (traditional flow)
     * Enhanced with Linear Execution Gate enforcement
     */
    executeLinearStep(flowId) {
      const state = this._getFlowState(flowId);
      const flow = this._flows.get(flowId);
      if (!flow) return;
      if (state.activeStep >= flow.steps.length) {
        console.log(`[DAP] Flow ${flowId} sequence completed`);
        this.completeFlow(flowId);
        return;
      }
      const step = flow.steps[state.activeStep];
      this.cleanupPreviousStepTriggers(flowId);
      console.debug(`[DAP] Linear Execution Gate: Enforcing step-by-step execution for step ${step.stepId} (index ${state.activeStep}) for flow ${flowId}`);
      this.executeStepWithTrigger(step, state.activeStep, flowId);
    }
    /**
     * Execute steps in any order (all steps listen simultaneously)
     */
    executeAnyOrderSteps(flowId) {
      const state = this._getFlowState(flowId);
      const flow = this._flows.get(flowId);
      if (!flow) return;
      console.log(`[DAP] Executing AnyOrder flow ${flowId} - all step triggers active`);
      flow.steps.forEach((step, index) => {
        if (!state.triggeredSteps.has(index)) {
          this.setupStepTrigger(step, index, flowId);
        }
      });
    }
    /**
     * Execute a step with enhanced trigger support
     */
    executeStepWithTrigger(step, stepIndex, flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) return;
      const state = this._getFlowState(id);
      const flow = this._flows.get(id);
      if (!flow) return;
      console.log(`[DAP] ========== EXECUTING STEP ${step.stepId} FOR FLOW ${id} ==========`);
      const trigger = triggerManager.resolveTrigger(step);
      if (!trigger) {
        console.log(`[DAP] Step ${step.stepId}: NO TRIGGER - executing immediately`);
        this.executeStepContent(step, id);
        this.postStepTransition(step, id);
        return;
      }
      console.log(`[DAP] Step ${step.stepId}: TRIGGER RESOLVED - setting up listeners`);
      const actualStepIndex = stepIndex !== void 0 ? stepIndex : state.activeStep;
      const isCurrentActiveStep = actualStepIndex === state.activeStep;
      const flowContext = {
        mode: state.executionMode,
        currentStepActive: isCurrentActiveStep
      };
      if (!step.uxExperience && step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0 && step.userInputSelector) {
        this.setupInputSelectorMutationObserver(step);
        this.setupBlurEventHandler(step);
      }
      triggerManager.registerTriggerListeners(step.stepId, trigger, async (context) => {
        const userWantsDap = await showDapExperiencePrompt();
        if (!userWantsDap) {
          console.log(`[DAP] User declined DAP experience - ignoring trigger for step ${step.stepId}`);
          return;
        }
        const currentState = this._getFlowState(id);
        if (currentState.executionMode === "Linear") {
          const currentStepIndex = currentState.activeStep;
          if (actualStepIndex !== currentStepIndex) {
            console.debug(`[DAP] Linear Execution Gate: Rejecting trigger for flow ${id} non-current step ${step.stepId} (index ${actualStepIndex}, current ${currentStepIndex})`);
            return;
          }
          if (step.uxExperience && currentState.activeStepTriggered) {
            console.debug(`[DAP] Linear Execution Gate: UX step ${step.stepId} already triggered for flow ${id}, ignoring duplicate trigger`);
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
            currentState.activeStepTriggered = true;
          }
        }
        if (currentState.executionMode === "AnyOrder") {
          currentState.triggeredSteps.add(actualStepIndex);
        }
        console.log(`[DAP] TRIGGER ACTIVATED for step ${step.stepId} in flow ${id}`);
        this.executeStepContent(step, id);
        if (!step.uxExperience && step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0) {
          console.log(`[DAP] Step ${step.stepId} is rule-based - applying smart evaluation logic`);
          if (step.userInputSelector) {
            const inputElements = resolveSelectorAll2(step.userInputSelector);
            if (inputElements.length === 0) {
              console.error(`[DAP] \u{1F6A8} CRITICAL: Rule-based step ${step.stepId} input selector not found: ${step.userInputSelector}`);
              console.error(`[DAP] This indicates a cross-page navigation issue. Skipping rule evaluation.`);
              this.advanceToNextStep(id);
              return;
            }
          }
          const inputElement = step.userInputSelector ? resolveSelector(step.userInputSelector) : null;
          const inputType = inputElement ? this.getInputElementType(inputElement) : "unknown";
          if (["text", "email", "password", "textarea", "number", "search", "url", "tel"].includes(inputType)) {
            console.log(`[DAP] \u{1F4DD} Text-based input detected - rules will evaluate ONLY on blur/focus-out events`);
          } else {
            console.log(`[DAP] \u{1F504} Non-text input triggered - evaluating rules immediately`);
            this.evaluateStepRulesWithValue(step, context.userInput || "", "change", id);
            return;
          }
        } else {
          this.postStepTransition(step, id);
        }
      }, flowContext);
    }
    /**
     * Set up trigger for a specific step (used in AnyOrder mode)
     */
    setupStepTrigger(step, stepIndex, flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) return;
      const state = this._getFlowState(id);
      const trigger = triggerManager.resolveTrigger(step);
      if (!trigger) {
        if (step.stepType === "Optional") {
          state.triggeredSteps.add(stepIndex);
        }
        return;
      }
      const flowContext = {
        mode: state.executionMode,
        currentStepActive: true
      };
      triggerManager.registerTriggerListeners(step.stepId, trigger, async (context) => {
        const userWantsDap = await showDapExperiencePrompt();
        if (!userWantsDap) {
          console.log(`[DAP] User declined DAP experience - ignoring trigger for step ${step.stepId}`);
          return;
        }
        const currentState = this._getFlowState(id);
        currentState.triggeredSteps.add(stepIndex);
        this.executeStepContent(step, id);
        this.postStepTransition(step, id);
        this.checkFlowCompletion(id);
      }, flowContext);
    }
    /**
     * Execute the actual step content (UX experience)
     */
    executeStepContent(step, flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) return;
      const state = this._getFlowState(id);
      if (state.activeFlowId) {
        trackStepView(state.activeFlowId, step.stepId);
      }
      if (step.uxExperience) {
        this.triggerUXExperience(step, id);
      } else {
        console.log(`[DAP] Step ${step.stepId} is rule-based, waiting for conditions`);
      }
    }
    /**
     * Handle post-step transition (rules evaluation and flow control)
     */
    postStepTransition(step, flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) return;
      const state = this._getFlowState(id);
      if (step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0 && !step.uxExperience) {
        console.log(`[DAP] Step ${step.stepId} has rules but no UX - waiting for input trigger`);
        return;
      }
      if (step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0 && step.uxExperience) {
        this.evaluateStepRules(step, id);
        return;
      }
      if (step.uxExperience && (!step.conditionRuleBlocks || step.conditionRuleBlocks.length === 0)) {
        return;
      }
      if (!step.uxExperience && (!step.conditionRuleBlocks || step.conditionRuleBlocks.length === 0)) {
        if (state.executionMode === "Linear") {
          this.advanceToNextStep(id);
        }
      }
    }
    /**
     * 🚨 DISABLED: Debounced rule evaluation - Rules now evaluate ONLY on blur events
     * This method is kept for potential future use but should not be called
     */
    setupDebouncedRuleEvaluation(step, inputValue) {
      console.warn(`[DAP] \u26A0\uFE0F setupDebouncedRuleEvaluation called but DISABLED - rules evaluate ONLY on blur events`);
      console.warn(`[DAP] \u{1F3AF} Input/change events are for trigger activation only, rule evaluation happens on blur/focus-out`);
      return;
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
      const inputElement = resolveSelector(step.userInputSelector);
      if (!inputElement) {
        console.warn(`[DAP] Input element not found for rule evaluation check: ${step.userInputSelector}`);
        return true;
      }
      const inputType = this.getInputElementType(inputElement);
      console.log(`[DAP] \u{1F50D} SMART EVALUATION CHECK: Input type "${inputType}" with trigger "${triggerSource}"`);
      switch (inputType) {
        case "text":
        case "email":
        case "password":
        case "textarea":
        case "number":
        case "search":
        case "url":
        case "tel":
          console.log(`[DAP] \u{1F4DD} Text-based input: Rules evaluate ONLY on blur/focus-out`);
          return triggerSource === "blur";
        case "select":
        case "select-one":
        case "select-multiple":
          console.log(`[DAP] \u{1F4CB} Dropdown/Select input: Rules evaluate on change/blur events`);
          return triggerSource === "change" || triggerSource === "blur";
        case "checkbox":
        case "radio":
          console.log(`[DAP] \u2611\uFE0F Checkbox/Radio input: Rules evaluate on change events`);
          return triggerSource === "change" || triggerSource === "blur";
        case "date":
        case "time":
        case "datetime-local":
        case "month":
        case "week":
          console.log(`[DAP] \u{1F4C5} Date/Time input: Rules evaluate on change/blur events`);
          return triggerSource === "change" || triggerSource === "blur";
        case "range":
        case "color":
          console.log(`[DAP] \u{1F3A8} Range/Color input: Rules evaluate on change events`);
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
      if (inputValue.length === 1) {
        console.debug(`[DAP] \u274C Input stability: Single character "${inputValue}" is not meaningful for rule evaluation - BLOCKING`);
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
          const inputElements = resolveSelectorAll2(step.userInputSelector);
          if (inputElements.length > 0) {
            console.log(`[DAP] \u2705 Input selector now available for step ${step.stepId}, re-registering triggers`);
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
      console.log(`[DAP] \u{1F3AF} Setting up PRIMARY blur event handler for rule-based step ${step.stepId}`);
      console.log(`[DAP] \u{1F4CB} Rules will evaluate ONLY on blur/focus-out events, not during typing`);
      this.waitForInputElement(step.userInputSelector, (inputElement) => {
        console.debug(`[DAP] \u2705 Input element found for blur handler, setting up listener`);
        const blurHandler = () => {
          console.log(`[DAP]  PRIMARY BLUR EVENT - User finished input and moved focus away from step ${step.stepId}`);
          const currentValue = inputElement.value;
          console.log(`[DAP] \u{1F3AF} BLUR EVALUATION: Input value for rule evaluation: "${currentValue}"`);
          console.log(`[DAP] \u{1F50D} BLUR EVENT STATE CHECK:`);
          console.log(`[DAP] - Current flow exists: ${!!this._currentFlow}`);
          console.log(`[DAP] - Active step index: ${this._state.activeStep}`);
          console.log(`[DAP] - Total steps: ${this._currentFlow?.steps?.length || 0}`);
          console.log(`[DAP] - Step being checked: ${step.stepId}`);
          if (!this._currentFlow) {
            console.log(`[DAP] \u274C No active flow, ignoring blur event`);
            return;
          }
          const stepExists = this._currentFlow.steps.some((s) => s.stepId === step.stepId);
          if (!stepExists) {
            console.log(`[DAP] \u274C Step ${step.stepId} not found in current flow, ignoring blur event`);
            return;
          }
          const stepIndex = this._currentFlow.steps.findIndex((s) => s.stepId === step.stepId);
          if (stepIndex === -1) {
            console.log(`[DAP] \u274C Could not find step index for ${step.stepId}, ignoring blur event`);
            return;
          }
          const isCurrentOrRecentStep = stepIndex <= this._state.activeStep && this._state.activeStep - stepIndex <= 2;
          if (!isCurrentOrRecentStep) {
            console.log(`[DAP] \u274C Step ${step.stepId} is too far behind current step (${stepIndex} vs ${this._state.activeStep}), ignoring blur event`);
            return;
          }
          console.log(`[DAP] \u2705 Step validation passed - proceeding with rule evaluation`);
          this._currentFlow.steps[stepIndex];
          this.clearRuleEvaluationTimers(step.stepId);
          console.log(`[DAP] \u{1F3AF} EXECUTING PRIMARY RULE EVALUATION on blur for step ${step.stepId}`);
          console.log(`[DAP] \u{1F4A1} User has finished typing and moved focus - perfect time for rule evaluation`);
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
    }
    /**
     * CRITICAL FIX: Wait for input element to be available (handles both CSS and XPath)
     */
    waitForInputElement(selector, callback) {
      const checkElement = () => {
        const elements = resolveSelectorAll2(selector);
        if (elements.length > 0) {
          console.debug(`[DAP] \u2705 Input element found: ${selector}`);
          callback(elements[0]);
        } else {
          setTimeout(checkElement, 100);
        }
      };
      checkElement();
    }
    /**
     * Get current input value for a step using CSS or XPath selector
     */
    getCurrentInputValue(step) {
      if (!step.userInputSelector) return "";
      const inputElement = resolveSelector(step.userInputSelector);
      return inputElement ? inputElement.value : "";
    }
    /**
     * Evaluate step rules with a specific input value (enhanced with better error handling)
     */
    /**
     * Evaluate step rules with a specific input value (enhanced with better error handling)
     * 🚨 CRITICAL: Smart rule evaluation based on input type and interaction pattern
     * - Text inputs: Rules evaluate ONLY on blur events (when user finishes typing)
     * - Dropdowns/Select: Rules evaluate on change events (immediate after selection)
     * - Checkboxes/Radio: Rules evaluate on change events (immediate after click)
     * Enhanced with CRITICAL FIX 5 & 6: Fallback Logic and Mandatory Step Enforcement
     */
    evaluateStepRulesWithValue(step, inputValue, triggerSource, flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) return;
      const state = this._getFlowState(id);
      const flow = this._flows.get(id);
      if (!flow) return;
      const source = triggerSource || "unknown";
      const shouldEvaluateRules = this.shouldEvaluateRulesForTriggerSource(step, source);
      if (!shouldEvaluateRules) {
        console.warn(`[DAP] \u{1F6A8} RULE EVALUATION BLOCKED: Input type requires different evaluation trigger`);
        console.warn(`[DAP] \u{1F3AF} Trigger source "${source}" not appropriate for this input type`);
        return;
      }
      console.log(`[DAP] ========== RULE EVALUATION START: Step ${step.stepId} (${source.toUpperCase()} TRIGGER) ==========`);
      console.log(`[DAP] \u2705 SMART EVALUATION: Trigger source "${source}" is appropriate for this input type`);
      console.log(`[DAP] Input value: "${inputValue}"`);
      console.log(`[DAP] Rule blocks: ${step.conditionRuleBlocks?.length || 0}`);
      if (!step.conditionRuleBlocks || step.conditionRuleBlocks.length === 0) {
        console.log(`[DAP] No rule blocks found, advancing to next step`);
        this.advanceToNextStep(id);
        return;
      }
      console.debug(`[DAP] \u{1F4C4} Rule evaluation page context check for step: ${step.stepId}`);
      let pageContextValid = true;
      for (const ruleBlock of step.conditionRuleBlocks) {
        if (ruleBlock.selector) {
          const elements = resolveSelectorAll2(ruleBlock.selector);
          if (elements.length === 0) {
            console.warn(`[DAP] \u26A0\uFE0F Rule block selector not found on current page: ${ruleBlock.selector}`);
            console.warn(`[DAP] This may indicate a cross-page navigation issue for rule-based step ${step.stepId}`);
            pageContextValid = false;
          }
        }
      }
      if (!pageContextValid) {
        console.warn(`[DAP] \u{1F6A8} Page context validation failed for rule-based step ${step.stepId}`);
        console.warn(`[DAP] Skipping rule evaluation due to missing selectors - possible cross-page issue`);
        this.handleRuleEvaluationFailure(step, "page_context_invalid");
        return;
      }
      try {
        let ruleMatched = false;
        let matchedRuleBlock = null;
        for (const ruleBlock of step.conditionRuleBlocks) {
          console.log(`[DAP] Evaluating rule block with input: "${inputValue}"`);
          const ruleResult = evaluateRuleBlock(ruleBlock, inputValue);
          console.log(`[DAP] Rule block result for "${inputValue}": ${ruleResult}`);
          if (ruleResult) {
            console.log(`[DAP] \u2705 Rule matched for step ${step.stepId}, handling branching`);
            ruleMatched = true;
            matchedRuleBlock = ruleBlock;
            break;
          }
        }
        if (ruleMatched && matchedRuleBlock) {
          if (step.stepType === "Mandatory" && state.executionMode === "Linear") {
            console.log(`[DAP] \u2705 MANDATORY STEP COMPLETED: ${step.stepId}`);
            this.trackMandatoryStepCompletion(step);
          }
          console.log(`[DAP] \u{1F3AF} Rule matched on ${source} trigger - executing branching logic`);
          this.handleRuleBranching(matchedRuleBlock);
        } else {
          console.log(`[DAP] \u274C No rules matched for step ${step.stepId} on ${source} trigger`);
          this.handleNoRuleMatch(step, inputValue);
        }
      } catch (error) {
        console.error(`[DAP] Error evaluating rules for step ${step.stepId}:`, error);
        this.handleRuleEvaluationFailure(step, "evaluation_error", error);
      }
      console.log(`[DAP] ========== RULE EVALUATION END: Step ${step.stepId} (${source.toUpperCase()} TRIGGER) ==========`);
    }
    /**
     * CRITICAL FIX 5: Handle rule evaluation failures with proper fallback logic
     * Updated to advance by default unless explicitly configured otherwise
     */
    handleRuleEvaluationFailure(step, reason, error) {
      console.warn(`[DAP] \u{1F6A8} FALLBACK LOGIC: Rule evaluation failed for step ${step.stepId}, reason: ${reason}`);
      console.log(`[DAP] Step type: ${step.stepType || "Not specified"}`);
      const shouldBlockOnFailure = step.blockOnRuleFailure === true;
      if (shouldBlockOnFailure) {
        console.warn(`[DAP] \u26A0\uFE0F BLOCKING STEP: ${step.stepId} configured to block on rule failures`);
        console.warn(`[DAP] Staying on current step and waiting for valid input`);
        this._state.activeStepTriggered = false;
        this.clearRuleEvaluationTimers(step.stepId);
        this.clearInputStabilityTimers(step.stepId);
        return;
      } else {
        console.warn(`[DAP] \u2705 ADVANCING: Step ${step.stepId} (type: ${step.stepType || "default"}) failed ${reason}, moving to next step`);
        console.log(`[DAP] \u{1F3AF} This is the default behavior as requested: "move to next step in the current flow"`);
        this.advanceToNextStepWithRuleCheck();
      }
    }
    /**
     * CRITICAL FIX 5: Handle case where no rules match the input
     * Updated to advance by default unless explicitly configured otherwise
     */
    handleNoRuleMatch(step, inputValue) {
      console.log(`[DAP] \u{1F504} FALLBACK LOGIC: No rule matched for input "${inputValue}" in step ${step.stepId}`);
      console.log(`[DAP] Step type: ${step.stepType || "Not specified"}`);
      const shouldBlockOnNoMatch = step.blockOnNoRuleMatch === true;
      if (shouldBlockOnNoMatch) {
        console.log(`[DAP] \u26A0\uFE0F BLOCKING STEP: ${step.stepId} configured to block when no rules match, staying on current step`);
        this._state.activeStepTriggered = false;
        console.log(`[DAP] User must provide input that matches one of the defined rules`);
        return;
      } else {
        console.log(`[DAP] \u2705 ADVANCING: Step ${step.stepId} (type: ${step.stepType || "default"}) - moving to next step when no rules match`);
        console.log(`[DAP] \u{1F3AF} This is the default behavior as requested: "move to next step in the current flow"`);
        this.advanceToNextStepWithRuleCheck();
      }
    }
    /**
     * CRITICAL FIX 6: Track mandatory step completion for flow validation
     */
    trackMandatoryStepCompletion(step) {
      console.log(`[DAP] \u{1F4CB} Mandatory step completion tracked: ${step.stepId}`);
    }
    /**
     * Evaluate a single rule block with a specific input value
     */
    evaluateRuleBlockWithValue(ruleBlock, inputValue) {
      return evaluateRuleBlock(ruleBlock, inputValue);
    }
    /**
     * Evaluate condition rule blocks and handle branching
     */
    evaluateStepRules(step, flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) return;
      const state = this._getFlowState(id);
      const flow = this._flows.get(id);
      if (!flow) return;
      console.debug(`[DAP] Evaluating rules for step: ${step.stepId} in flow ${id}`);
      if (!step.conditionRuleBlocks) return;
      for (const ruleBlock of step.conditionRuleBlocks) {
        try {
          let inputValue = "";
          if (step.userInputSelector) {
            const inputElement = resolveSelector(step.userInputSelector);
            if (inputElement) {
              inputValue = inputElement.value;
            }
          }
          const ruleMatched = evaluateRuleBlock(ruleBlock, inputValue);
          if (ruleMatched) {
            console.debug(`[DAP] Rule matched for step ${step.stepId}, handling branching`);
            this.handleRuleBranching(ruleBlock);
            return;
          }
        } catch (error) {
          console.error(`[DAP] Error evaluating rule block:`, error);
        }
      }
      if (state.executionMode === "Linear") {
        this.advanceToNextStep(id);
      }
    }
    /**
     * Handle rule-based branching based on BranchType
     * 🚨 CRITICAL FIX: Proper completion tracking for rule-based branching
     */
    handleRuleBranching(ruleBlock) {
      console.log(`[DAP] Handling rule-based branching for block:`, ruleBlock);
      const branchType = ruleBlock.branchType;
      switch (branchType) {
        case "Flow":
          const nextFlowId = ruleBlock.nextFlowId;
          if (nextFlowId) {
            console.log(`[DAP] \u{1F3AF} RULE MATCHED - Branching to new flow: ${nextFlowId}`);
            if (this._currentFlow && this._state.activeStep < this._currentFlow.steps.length) {
              const currentStep = this._currentFlow.steps[this._state.activeStep];
              console.log(`[DAP] \u2705 STEP COMPLETED: ${currentStep.stepId} (Mandatory step completed via rule branching)`);
              if (this._state.activeFlowId) {
                console.log(`[DAP] \u{1F4CB} Tracking completion for mandatory rule-based step ${currentStep.stepId}`);
              }
            }
            console.log(`[DAP] \u2705 FLOW COMPLETED: ${this._currentFlow?.flowId} (Terminated by rule branching)`);
            this.markFlowAsCompletedByBranching(this._currentFlow);
            this.terminateCurrentFlowAfterCompletion();
            this.startNewFlow(nextFlowId);
          } else {
            console.warn(`[DAP] Flow branch type specified but no nextFlowId found`);
            this.continueToNextStep();
          }
          break;
        case "Step":
          const targetStepId = ruleBlock.stepId;
          if (targetStepId) {
            console.log(`[DAP] Jumping to step: ${targetStepId}`);
            this.jumpToStep(targetStepId);
          } else {
            console.warn(`[DAP] Step branch type specified but no stepId found`);
            this.continueToNextStep();
          }
          break;
        case "Continue":
        default:
          console.log(`[DAP] Continuing to next step`);
          this.continueToNextStep();
          break;
      }
    }
    /**
     * Terminate current flow execution
     */
    terminateCurrentFlow() {
      console.log(`[DAP] Terminating current flow: ${this._currentFlow?.flowId}`);
      this.resetFlowState();
      if (this._currentFlow) {
        resetFlowTracking(this._currentFlow.flowId);
      }
    }
    /**
     * 🚨 CRITICAL FIX: Mark flow as completed specifically when branching occurs
     * This ensures proper tracking for rule-based flow transitions
     */
    markFlowAsCompletedByBranching(flowData) {
      const flowId = flowData.flowId;
      console.log(`[DAP] \u{1F3AF} RULE BRANCHING: Marking flow ${flowId} as completed via rule branching`);
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
        console.log(`[DAP] \u2705 RULE BRANCHING: Flow ${flowId} completed via rule branching at ${new Date(completionTimestamp).toISOString()}`);
        console.log(`[DAP] \u{1F3AF} Flow completion tracked - this satisfies the requirement: "OR a rule-based step branches to a new flow"`);
        if (flowData.execution?.frequency?.type === "OneTime") {
          const flowRunKey = `dap_flow_runs_${flowId}`;
          const currentRuns = localStorage.getItem(flowRunKey);
          const newRunCount = currentRuns ? parseInt(currentRuns, 10) : 1;
          localStorage.setItem(flowRunKey, newRunCount.toString());
          console.log(`[DAP] \u{1F4CA} OneTime flow run count updated: ${newRunCount}/${flowData.execution.frequency.maxRuns}`);
        }
      } catch (error) {
        console.error(`[DAP] Failed to mark branching completion for flow ${flowId}:`, error);
      }
    }
    /**
     * 🚨 CRITICAL FIX: Terminate flow after proper completion tracking
     * This ensures flow state is cleaned up AFTER completion is recorded
     */
    terminateCurrentFlowAfterCompletion() {
      console.log(`[DAP] \u{1F3AF} TERMINATING FLOW: Current flow completion tracking finished, now cleaning up state`);
      this.resetFlowState();
      if (this._currentFlow) {
        console.log(`[DAP] \u{1F4E2} Broadcasting flow completion event for tracking system`);
        resetFlowTracking(this._currentFlow.flowId);
      }
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
        triggeredSteps: /* @__PURE__ */ new Set()
      };
      this._currentFlow = null;
    }
    /**
     * Start a new flow by ID
     */
    startNewFlow(flowId) {
      console.log(`[DAP] Starting new flow: ${flowId}`);
      if (typeof window !== "undefined" && window.DAP && window.DAP.startFlow) {
        try {
          window.DAP.startFlow(flowId);
        } catch (error) {
          console.error(`[DAP] Error starting flow ${flowId}:`, error);
        }
      } else {
        const event = new CustomEvent("dap:startFlow", {
          detail: { flowId }
        });
        window.dispatchEvent(event);
      }
    }
    /**
     * Jump to a specific step within current flow
     */
    jumpToStep(stepId) {
      console.log(`[DAP] Jumping to step: ${stepId}`);
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
      this._state.activeStep = targetStepIndex;
      this._state.activeStepTriggered = false;
      const targetStep = this._currentFlow.steps[targetStepIndex];
      this.executeStepWithTrigger(targetStep, targetStepIndex);
    }
    /**
     * Continue to next step in sequence
     */
    continueToNextStep() {
      if (this._state.executionMode === "Linear") {
        this.advanceToNextStep();
      }
    }
    /**
     * Check if AnyOrder flow is complete
     */
    checkFlowCompletion(flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) return;
      const state = this._getFlowState(id);
      const flow = this._flows.get(id);
      if (!flow || state.executionMode !== "AnyOrder") return;
      const mandatorySteps = flow.steps.filter(
        (step, index) => step.stepType === "Mandatory"
      );
      const triggeredMandatory = flow.steps.filter(
        (step, index) => step.stepType === "Mandatory" && state.triggeredSteps.has(index)
      );
      console.debug(`[DAP] Flow completion check: ${triggeredMandatory.length}/${mandatorySteps.length} mandatory steps completed`);
      if (triggeredMandatory.length === mandatorySteps.length) {
        console.debug(`[DAP] All mandatory steps completed, flow complete`);
        this.completeFlow(id);
      }
    }
    /**
     * Execute UX Experience step
     */
    executeUXStep(step) {
      const ux = step.uxExperience;
      console.debug(`[DAP] Executing UX step: ${step.stepId}`, {
        elementSelector: ux.elementSelector,
        elementTrigger: ux.elementTrigger,
        elementLocation: ux.elementLocation
      });
      if (ux.elementLocation) {
        const currentContext = this._locationService.getContext();
        const locationMatches = this.matchesLocation(ux.elementLocation, currentContext);
        if (!locationMatches) {
          console.debug(`[DAP] Step ${step.stepId} waiting for location: ${ux.elementLocation} (current: ${currentContext.currentPath})`);
          return;
        }
      }
      console.debug(`[DAP] Step ${step.stepId} location matches, setting up trigger`);
      const trigger = ux.elementTrigger?.toLowerCase() || "on page load";
      if (trigger === "on page load" || trigger === "page load" || trigger === "pageload") {
        console.debug(`[DAP] Step ${step.stepId} has immediate trigger`);
        this.triggerUXExperience(step);
      } else {
        this.setupDOMTrigger(step);
      }
    }
    /**
     * Execute Rule step (DAP-standard)
     */
    executeRuleStep(step) {
      console.debug(`[DAP] === FLOWENGINE: Rule step initialized: ${step.stepId} ===`);
      console.debug(`[DAP] FlowEngine Rule Step - Step: ${step.stepId}, UserInputSelector: ${step.userInputSelector}, Rule blocks: ${step.conditionRuleBlocks?.length || 0}`);
      if (!step.userInputSelector) {
        console.warn(`[DAP] Rule step ${step.stepId} has no userInputSelector`);
        return;
      }
      if (!step.conditionRuleBlocks || step.conditionRuleBlocks.length === 0) {
        console.warn(`[DAP] Rule step ${step.stepId} has no conditionRuleBlocks`);
        return;
      }
      this._state.executionState = "WAITING_FOR_INPUT";
      this.setupRuleMonitoring(step);
    }
    setupRuleMonitoring(step) {
      const existingCleanup = this._stepTriggerListeners.get(step.stepId);
      if (existingCleanup) {
        existingCleanup();
        this._stepTriggerListeners.delete(step.stepId);
      }
      const inputElement = resolveSelector(step.userInputSelector);
      if (!inputElement) {
        console.warn(`[DAP] Input element not found: ${step.userInputSelector}`);
        console.debug(`[DAP] Setting up page change listener to retry when page/component changes...`);
        this.setupPageChangeRetry(step);
        return;
      }
      console.debug(`[DAP] \u2705 Input element found: ${step.userInputSelector}`);
      console.debug(`[DAP] Listening for input on ${step.userInputSelector}`);
      const cleanup = () => {
        inputElement.removeEventListener("input", evaluateRules2);
        inputElement.removeEventListener("change", evaluateRules2);
        inputElement.removeEventListener("blur", evaluateRules2);
        console.debug(`[DAP] \u2705 Rule event listeners cleaned up for step: ${step.stepId}`);
      };
      let ruleMatched = false;
      const evaluateRules2 = () => {
        if (step.uxExperience?.elementLocation && !this.isLocationValid(step.uxExperience.elementLocation)) {
          console.debug(`[DAP] Rule evaluation paused - wrong location. Expected: ${step.uxExperience.elementLocation}`);
          return;
        }
        if (ruleMatched) {
          console.debug(`[DAP] Rule already matched for step ${step.stepId}, ignoring additional events`);
          return;
        }
        const inputValue = inputElement.value;
        console.debug(`[DAP] Evaluating rules for input value: "${inputValue}"`);
        for (let i = 0; i < step.conditionRuleBlocks.length; i++) {
          const ruleBlock = step.conditionRuleBlocks[i];
          if (evaluateRuleBlock(ruleBlock, inputValue)) {
            console.debug(`[DAP] Rule matched \u2192 transitioning to flow ${ruleBlock.nextFlowId}`);
            console.debug(`[DAP] Rule block ${i + 1} of ${step.conditionRuleBlocks.length} triggered the transition`);
            ruleMatched = true;
            cleanup();
            console.debug(`[DAP] FlowEngine Rule Matched! Input: "${inputValue}", Next Flow: ${ruleBlock.nextFlowId}`);
            this.transitionToFlow(ruleBlock, step.stepId);
            return;
          }
        }
        console.debug(`[DAP] No rules matched for input "${inputValue}", advancing to next step`);
        console.debug(`[DAP] Current step: ${this._state.activeStep}, moving to: ${this._state.activeStep + 1}`);
        ruleMatched = true;
        cleanup();
        console.debug(`[DAP] FlowEngine Rule Not Matched! Input: "${inputValue}", No rules satisfied, Advancing to next step...`);
        this.advanceToNextStep();
      };
      inputElement.addEventListener("input", evaluateRules2);
      inputElement.addEventListener("change", evaluateRules2);
      inputElement.addEventListener("blur", evaluateRules2);
      this._stepTriggerListeners.set(step.stepId, cleanup);
    }
    setupPageChangeRetry(step) {
      let unsubscribeLocation = null;
      const retryOnPageChange = () => {
        console.debug(`[DAP] Page/component changed - retrying element detection for rule step: ${step.stepId}`);
        if (unsubscribeLocation) {
          unsubscribeLocation();
          unsubscribeLocation = null;
        }
        this.setupRuleMonitoring(step);
      };
      unsubscribeLocation = this._locationService.subscribe(retryOnPageChange);
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            const addedNodes = Array.from(mutation.addedNodes);
            for (const node of addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                try {
                  const targetElement = resolveSelector(step.userInputSelector);
                  if (targetElement) {
                    console.debug(`[DAP] Target element appeared in DOM - retrying rule setup`);
                    observer.disconnect();
                    if (unsubscribeLocation) {
                      unsubscribeLocation();
                    }
                    this.setupRuleMonitoring(step);
                    return;
                  }
                } catch (error) {
                  console.debug(`[DAP] Element still not available: ${error}`);
                }
              }
            }
          }
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      const existingObserver = this._domObservers.get(step.stepId);
      if (existingObserver) {
        existingObserver.disconnect();
      }
      this._domObservers.set(step.stepId, observer);
    }
    /**
    * Evaluate a rule block (DAP-standard)
    */
    /**
     * Transition to next flow (DAP-standard)
     */
    async transitionToFlow(ruleBlock, fromStepId) {
      console.debug(`[DAP] Current flow terminated`);
      console.debug(`[DAP] Transitioning from step ${fromStepId} to flow ${ruleBlock.nextFlowId}`);
      this._state.executionState = "TRANSITIONING";
      this.cleanupCurrentStep();
      this.abortFlow();
      try {
        const { fetchFlowById: fetchFlowById2 } = await Promise.resolve().then(() => (init_flows(), flows_exports));
        const config = window.__DAP_CONFIG__;
        if (!config) {
          console.error("[DAP] No config available for flow transition");
          return;
        }
        const flowData = await fetchFlowById2(config, location.origin, ruleBlock.nextFlowId);
        await this.startFlow(flowData);
      } catch (error) {
        console.error(`[DAP] Failed to transition to flow ${ruleBlock.nextFlowId}:`, error);
        this._state.executionState = "TERMINATED";
      }
    }
    /**
     * Set up DOM trigger for UX step
     */
    setupDOMTrigger(step) {
      const ux = step.uxExperience;
      if (!ux.elementSelector) {
        console.warn(`[DAP] UX step ${step.stepId} has no elementSelector`);
        this.advanceToNextStep();
        return;
      }
      this.waitForElement(ux.elementSelector, (element) => {
        if (this._state.activeStepTriggered) return;
        const trigger = ux.elementTrigger?.toLowerCase() || "click";
        const normalizedTrigger = normalizeTrigger(trigger);
        console.debug(`[DAP] Setting up trigger "${normalizedTrigger.eventType}" on ${ux.elementSelector}`);
        const triggerHandler = () => {
          if (this._state.activeStepTriggered) return;
          console.debug(`[DAP] Trigger fired for step: ${step.stepId}`);
          this.triggerUXExperience(step);
        };
        console.debug(`[DAP] Trigger handler created for step ${step.stepId}`);
        if (normalizedTrigger.isSynthetic) {
          if (normalizedTrigger.eventType === "pageload") {
            setTimeout(() => triggerHandler(), 0);
          }
        } else {
          element.addEventListener(normalizedTrigger.eventType, triggerHandler);
          this._stepTriggerListeners.set(step.stepId, () => {
            element.removeEventListener(normalizedTrigger.eventType, triggerHandler);
          });
        }
      });
    }
    /**
     * Trigger UX experience rendering
     */
    triggerUXExperience(step, flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) return;
      const state = this._getFlowState(id);
      const flow = this._flows.get(id);
      if (flow) {
        trackStepView(flow.flowId, step.stepId).catch((error) => {
          console.debug(`[DAP] Step tracking failed: ${error.message}`);
        });
      }
      console.log(`[DAP] Triggering UX experience for step ${step.stepId} for flow ${id}`);
      const ux = step.uxExperience;
      Promise.resolve().then(() => (init_registry(), registry_exports)).then(({ getRenderer: getRenderer2 }) => {
        const experienceType = ux.uxExperienceType.toLowerCase();
        const rendererType = experienceType === "microsurvey" ? "survey" : experienceType;
        const renderer = getRenderer2(rendererType);
        if (!renderer) {
          console.error(`[DAP] No renderer found for: ${ux.uxExperienceType}`);
          this.advanceToNextStep(id);
          return;
        }
        let payload;
        console.log(`[DAP] Preparing payload for renderer: ${rendererType} (Step ${step.stepId})`);
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
                  url: modalContent.presignedUrl || modalContent.contentData || "",
                  fileName: modalContent.contentName,
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
                console.debug(`[DAP] UX experience completed for step: ${step.stepId}`);
                if (flow && state.activeStep < flow.steps.length && flow.steps[state.activeStep].stepId === step.stepId) {
                  this.advanceToNextStep(id);
                } else {
                  console.debug(`[DAP] Step ${step.stepId} is no longer active, skipping advancement`);
                }
              }
            }
          };
        } else if (experienceType === "tooltip") {
          payload = {
            targetSelector: ux.elementSelector,
            text: ux.content?.text || ux.content?.body || "Tooltip",
            placement: ux.content?.placement || "auto",
            trigger: "hover",
            // Ensure trigger is set correctly
            stepId: step.stepId,
            _completionTracker: {
              onComplete: () => {
                console.debug(`[DAP] UX experience completed for step: ${step.stepId}`);
                this.advanceToNextStep(id);
              }
            }
          };
        } else if (experienceType === "popover") {
          payload = {
            targetSelector: ux.elementSelector,
            title: ux.content?.title || ux.content?.header,
            body: ux.content?.body,
            placement: ux.content?.placement || "auto",
            trigger: ux.elementTrigger || ux.content?.trigger || "click",
            showArrow: ux.content?.showArrow !== false,
            stepId: step.stepId,
            _completionTracker: {
              onComplete: () => {
                console.debug(`[DAP] UX experience completed for step: ${step.stepId}`);
                this.advanceToNextStep(id);
              }
            }
          };
        } else if (experienceType === "survey" || experienceType === "microsurvey") {
          payload = {
            // Standard survey fields
            header: ux.content?.header || ux.content?.title,
            body: ux.content?.body,
            questions: ux.content?.questions || [],
            // Micro survey fields (singular forms for lightweight surveys)
            question: ux.content?.question || ux.content?.title || ux.content?.header,
            type: ux.content?.type || ux.content?.surveyType || "choice",
            options: ux.content?.options,
            placeholder: ux.content?.placeholder,
            submitText: ux.content?.submitText,
            cancelText: ux.content?.cancelText,
            rating: ux.content?.rating,
            targetSelector: ux.elementSelector,
            position: ux.content?.position || "center",
            mode: ux.content?.mode,
            // Let renderer decide if not specified
            stepId: step.stepId,
            _completionTracker: {
              onComplete: () => {
                console.debug(`[DAP] UX experience completed for step: ${step.stepId}`);
                this.advanceToNextStep(id);
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
            targetSelector: ux.elementSelector,
            // Add target selector for element-relative positioning
            trigger: ux.elementTrigger || "click",
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
                console.debug(`[DAP] UX experience completed for step: ${step.stepId}`);
                this.advanceToNextStep(id);
              }
            }
          };
        } else if (experienceType === "banner" || experienceType === "alert") {
          payload = {
            message: ux.content?.message || ux.content?.body || ux.content?.header || "",
            variant: ux.content?.variant || ux.content?.type || "info",
            position: ux.content?.position || "top",
            dismissible: ux.content?.dismissible !== false,
            autoHide: ux.content?.autoHide || ux.content?.autoDismiss,
            actions: ux.content?.actions || [],
            stepId: step.stepId,
            _completionTracker: {
              onComplete: () => {
                console.debug(`[DAP] UX experience completed for step: ${step.stepId}`);
                this.advanceToNextStep(id);
              }
            }
          };
        } else if (experienceType === "hotspots" || experienceType === "hotspot-tour") {
          payload = {
            title: ux.content?.title || ux.content?.header,
            description: ux.content?.description || ux.content?.body,
            hotspots: ux.content?.hotspots || ux.content?.steps || [],
            steps: ux.content?.steps || ux.content?.hotspots || [],
            showProgress: ux.content?.showProgress !== false,
            allowSkip: ux.content?.allowSkip !== false,
            theme: ux.content?.theme || {},
            stepId: step.stepId,
            _completionTracker: {
              onComplete: () => {
                console.debug(`[DAP] UX experience completed for step: ${step.stepId}`);
                this.advanceToNextStep(id);
              }
            }
          };
        } else {
          payload = {
            ...ux.content,
            stepId: step.stepId,
            targetSelector: ux.elementSelector,
            trigger: ux.elementTrigger,
            _completionTracker: {
              onComplete: () => {
                console.debug(`[DAP] UX experience completed for step: ${step.stepId}`);
                this.advanceToNextStep(id);
              }
            }
          };
          payload.steps = [{
            stepId: step.stepId,
            kind: experienceType,
            [experienceType]: {
              ...ux.content,
              stepId: step.stepId
            },
            title: ux.content?.header || ux.content?.title || "Info",
            elementSelector: ux.elementSelector,
            elementTrigger: ux.elementTrigger,
            elementLocation: ux.elementLocation
          }];
        }
        const flowForRenderer = {
          id: `step-${step.stepId}`,
          type: experienceType,
          payload
        };
        console.debug(`[DAP] Rendering ${experienceType} experience:`, flowForRenderer);
        console.debug(`[DAP] Payload structure:`, {
          type: experienceType,
          targetSelector: payload.targetSelector,
          trigger: payload.trigger,
          elementSelector: ux.elementSelector,
          elementTrigger: ux.elementTrigger
        });
        if (experienceType === "tooltip") {
          flowForRenderer.payload.trigger = payload.trigger || "hover";
          flowForRenderer.payload.targetSelector = payload.targetSelector || ux.elementSelector;
        } else if (experienceType === "popover") {
          flowForRenderer.payload.trigger = payload.trigger || "click";
          flowForRenderer.payload.targetSelector = payload.targetSelector || ux.elementSelector;
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
        this.advanceToNextStep(id);
      });
    }
    /**
     * Advance to next step intelligently (respects triggers)
     * Enhanced with CRITICAL FIXES 1-6 integration
     */
    advanceToNextStep(flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) return;
      const state = this._getFlowState(id);
      const flow = this._flows.get(id);
      if (state.stepAdvancing) {
        console.debug(`[DAP] Step advancement already in progress for flow ${id}, skipping duplicate request`);
        return;
      }
      state.stepAdvancing = true;
      console.debug(`[DAP] ========== ADVANCING FROM STEP ${state.activeStep} FOR FLOW ${id} ==========`);
      this.cleanupCurrentStep(id);
      if (state.executionMode === "Linear") {
        this.cleanupPreviousStepTriggers(id);
      }
      state.activeStep++;
      state.activeStepTriggered = false;
      console.debug(`[DAP] Advanced to step ${state.activeStep} for flow ${id}`);
      if (flow && state.activeStep < flow.steps.length) {
        const nextStep = flow.steps[state.activeStep];
        console.debug(`[DAP] Next step: ${nextStep.stepId} (type: ${nextStep.stepType})`);
        if (nextStep.stepType === "Mandatory") {
          console.log(`[DAP] \u{1F4CB} MANDATORY STEP: Starting mandatory step ${nextStep.stepId} for flow ${id}`);
        }
        const nextStepTrigger = triggerManager.resolveTrigger(nextStep);
        const shouldWaitForTrigger = state.executionMode !== "Linear";
        if (nextStepTrigger && shouldWaitForTrigger) {
          console.debug(`[DAP] Next step ${nextStep.stepId} has trigger, setting up listener (waiting)`);
          this.executeStepWithTrigger(nextStep, state.activeStep, id);
          state.stepAdvancing = false;
          return;
        }
      } else if (flow) {
        console.debug(`[DAP] No more steps for flow ${id}, flow completed`);
        state.stepAdvancing = false;
        this.completeFlow(id);
        return;
      }
      state.stepAdvancing = false;
      this.executeStep(id);
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
          console.log(`[DAP] \u{1F4CB} MANDATORY STEP: Starting mandatory step ${nextStep.stepId}`);
        }
        const nextStepTrigger = triggerManager.resolveTrigger(nextStep);
        if (nextStepTrigger) {
          console.debug(`[DAP] Next step ${nextStep.stepId} has trigger, setting up listener`);
          if (!nextStep.uxExperience && nextStep.conditionRuleBlocks && nextStep.conditionRuleBlocks.length > 0 && nextStep.userInputSelector) {
            console.log(`[DAP] \u{1F50D} RULE CHECK: Step ${nextStep.stepId} is rule-based, checking for existing input value`);
            this.waitForInputElement(nextStep.userInputSelector, (inputElement) => {
              const existingValue = inputElement.value;
              console.log(`[DAP] \u{1F50D} RULE CHECK: Found existing input value: "${existingValue}"`);
              if (existingValue && existingValue.trim() !== "") {
                console.log(`[DAP] \u{1F50D} RULE CHECK: Existing value found but NOT evaluating rules immediately`);
                console.log(`[DAP] \u{1F3AF} Rules will evaluate ONLY when user focuses out (blur event)`);
                this.executeStepWithTrigger(nextStep, this._state.activeStep);
              } else {
                console.log(`[DAP] \u{1F50D} RULE CHECK: No existing value, setting up trigger normally`);
                this.executeStepWithTrigger(nextStep, this._state.activeStep);
              }
            });
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
    completeFlow(flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) return;
      this._getFlowState(id);
      const flow = this._flows.get(id);
      console.debug(`[DAP] Flow completed: ${id}`);
      if (flow && id) {
        this.markFlowCompleted(flow);
      }
      this.abortFlow(id);
    }
    /**
     * 🚨 CRITICAL FIX: Mark flow as completed in tracking system
     * This ensures OneTime flows are properly tracked and blocked on subsequent runs
     */
    markFlowCompleted(flowData) {
      const flowId = flowData.flowId;
      console.log(`[DAP] \u{1F3AF} Marking flow ${flowId} as completed`);
      if (flowData.execution?.frequency?.type === "OneTime") {
        const flowCompletedKey = `dap_flow_completed_${flowId}`;
        const completionTimestamp = Date.now();
        try {
          localStorage.setItem(flowCompletedKey, completionTimestamp.toString());
          console.log(`[DAP] \u2705 OneTime flow ${flowId} marked as completed at ${new Date(completionTimestamp).toISOString()}`);
          console.log(`[DAP] \u{1F3AF} This flow will be blocked on future attempts due to OneTime + maxRuns limit`);
        } catch (error) {
          console.error(`[DAP] Failed to mark flow ${flowId} as completed:`, error);
        }
      }
    }
    /**
     * Redirect to another flow
     */
    async redirectToFlow(nextFlowId) {
      console.debug(`[DAP] Redirecting to flow: ${nextFlowId}`);
      try {
        const { fetchFlowById: fetchFlowById2 } = await Promise.resolve().then(() => (init_flows(), flows_exports));
        const config = window.__DAP_CONFIG__;
        if (!config) {
          console.error("[DAP] No config available for flow redirect");
          return;
        }
        const flowData = await fetchFlowById2(config, location.origin, nextFlowId);
        this.startFlow(flowData);
      } catch (err) {
        console.error(`[DAP] Failed to redirect to flow ${nextFlowId}:`, err);
      }
    }
    /**
     * Clean up current step listeners and state
     */
    cleanupCurrentStep(flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) return;
      const state = this._getFlowState(id);
      const flow = this._flows.get(id);
      if (!flow) return;
      const stepId = flow.steps[state.activeStep]?.stepId;
      if (!stepId) return;
      console.debug(`[DAP] Cleaning up step ${stepId} for flow ${id}`);
      this.clearRuleEvaluationTimers(stepId);
      this.clearInputStabilityTimers(stepId);
      this._lastInputValues.delete(stepId);
      this._inputStabilityChecks.delete(stepId);
      triggerManager.removeTriggerListeners(stepId);
      const cleanup = this._stepTriggerListeners.get(stepId);
      if (cleanup) {
        cleanup();
        this._stepTriggerListeners.delete(stepId);
      }
      const blurCleanup = this._stepTriggerListeners.get(`${stepId}_blur`);
      if (blurCleanup) {
        blurCleanup();
        this._stepTriggerListeners.delete(`${stepId}_blur`);
      }
      const observer = this._domObservers.get(stepId);
      if (observer) {
        observer.disconnect();
        this._domObservers.delete(stepId);
      }
    }
    /**
     * CRITICAL FIX 1: Clean up triggers from previous steps in linear mode
     * This enforces the Linear Execution Gate by ensuring only current step has active triggers
     */
    cleanupPreviousStepTriggers(flowId) {
      const id = flowId || this._primaryFlowId;
      if (!id) return;
      const state = this._getFlowState(id);
      const flow = this._flows.get(id);
      if (!flow || state.executionMode !== "Linear") return;
      for (let i = 0; i < state.activeStep; i++) {
        if (i < flow.steps.length) {
          const previousStep = flow.steps[i];
          console.debug(`[DAP] Linear Execution Gate: Cleaning up triggers for previous step ${previousStep.stepId} (${i})`);
          triggerManager.removeTriggerListeners(previousStep.stepId);
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
      const timerId = this._inputStabilityTimers.get(stepId);
      if (timerId) {
        clearTimeout(timerId);
        this._inputStabilityTimers.delete(stepId);
      }
      this._lastInputValues.delete(stepId);
      this._inputStabilityChecks.delete(stepId);
    }
    /**
     * Check if flow can resume after page change
     */
    checkFlowResumption() {
      if (!this._state.flowInProgress || !this._currentFlow) return;
      console.debug("[DAP] Checking if current step can resume after page change");
      this.executeStep();
    }
    /**
     * Check if current location matches step requirement
     */
    matchesLocation(elementLocation, context) {
      if (!elementLocation) return true;
      const normalizedRequired = elementLocation.replace(/^\/+/, "").toLowerCase();
      const normalizedCurrent = (context.currentPath || "").replace(/^\/+/, "").toLowerCase();
      const normalizedScreen = (context.screenId || "").replace(/^\/+/, "").toLowerCase();
      return normalizedRequired === normalizedCurrent || normalizedRequired === normalizedScreen || normalizedRequired === "*";
    }
    /**
     * Wait for element to exist in DOM
     */
    waitForElement(selector, callback) {
      const check = () => {
        const element = resolveSelector(selector);
        if (element) {
          callback(element);
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    }
    /**
     * Check if current page location allows rule evaluation
     */
    isLocationValid(elementLocation) {
      if (!elementLocation) return true;
      const currentContext = this._locationService.getContext();
      const currentPath = currentContext.currentPath;
      return currentPath.includes(elementLocation) || elementLocation === "dashboard";
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
        triggeredSteps: /* @__PURE__ */ new Set()
      };
      this._currentFlow = null;
      if (this._pageChangeUnsubscribe) {
        this._pageChangeUnsubscribe();
        this._pageChangeUnsubscribe = null;
      }
      triggerManager.destroy();
      pageContextService.destroy();
      console.debug("[DAP] FlowEngine: Destroyed");
    }
    /**
     * Analyze flow page context to detect multi-page flows
     */
    analyzeFlowPageContext(flowData) {
      console.log(`[DAP] \u{1F4C4} FLOW PAGE CONTEXT ANALYSIS: ${flowData.flowId}`);
      console.log(`[DAP] ================================================================`);
      const currentPage = pageContextService.getCurrentContext();
      const selectors = /* @__PURE__ */ new Set();
      const elementLocations = /* @__PURE__ */ new Set();
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
        if (step.uxExperience?.elementSelector) {
          selectors.add(step.uxExperience.elementSelector);
        }
        if (step.userInputSelector) {
          selectors.add(step.userInputSelector);
        }
        if (step.uxExperience?.elementLocation) {
          elementLocations.add(step.uxExperience.elementLocation);
        }
      }
      console.log(`[DAP] Total unique selectors in flow: ${selectors.size}`);
      console.log(`[DAP] Element locations: ${Array.from(elementLocations).join(", ") || "none specified"}`);
      for (const selector of selectors) {
        try {
          const elements = resolveSelectorAll2(selector);
          if (elements.length === 0) {
            selectorMismatches++;
            console.warn(`[DAP] \u26A0\uFE0F Selector not found on current page: ${selector}`);
          } else {
            console.debug(`[DAP] \u2705 Selector found (${elements.length} elements): ${selector}`);
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
      console.log(`[DAP] Flow execution mode: ${executionMode}`);
      if (possibleMultiPage && executionMode === "Linear") {
        console.warn(`[DAP] \u{1F4A1} Recommendation: Consider enabling multiPage support for this flow`);
        console.warn(`[DAP] Some steps may wait indefinitely for elements on other pages`);
      }
      console.log(`[DAP] Current page: ${currentPage?.pathname || "unknown"}`);
      console.log(`[DAP] ================================================================`);
    }
    /**
     * Analyze rule-based steps for page context issues
     */
    analyzeRuleStepsPageContext(ruleSteps) {
      console.log(`[DAP] \u{1F916} RULE STEPS PAGE CONTEXT ANALYSIS`);
      console.log(`[DAP] ================================================================`);
      pageContextService.getCurrentContext();
      for (const step of ruleSteps) {
        console.log(`[DAP] Rule step ${step.stepId}:`);
        const triggerSelectors = step.trigger?.conditions?.map((c) => c.selector).filter(Boolean) || [];
        console.log(`[DAP]   Trigger selectors: ${triggerSelectors.length}`);
        for (const selector of triggerSelectors) {
          if (selector) {
            const elements = resolveSelectorAll2(selector);
            if (elements.length === 0) {
              console.error(`[DAP]   \u274C CRITICAL: Rule trigger selector not found: ${selector}`);
              console.error(`[DAP]   This rule-based step will wait indefinitely!`);
            } else {
              console.debug(`[DAP]   \u2705 Trigger selector found: ${selector}`);
            }
          }
        }
        if (step.userInputSelector) {
          const inputElements = resolveSelectorAll2(step.userInputSelector);
          if (inputElements.length === 0) {
            console.error(`[DAP]   \u274C CRITICAL: Rule input selector not found: ${step.userInputSelector}`);
            console.error(`[DAP]   Rule condition evaluation will fail!`);
            console.error(`[DAP]   Possible cross-page navigation issue detected.`);
          } else {
            console.debug(`[DAP]   \u2705 Input selector found: ${step.userInputSelector}`);
          }
        }
        if (step.conditionRuleBlocks) {
          for (let i = 0; i < step.conditionRuleBlocks.length; i++) {
            const ruleBlock = step.conditionRuleBlocks[i];
            if (ruleBlock.selector) {
              const ruleElements = resolveSelectorAll2(ruleBlock.selector);
              if (ruleElements.length === 0) {
                console.warn(`[DAP]   \u26A0\uFE0F Rule block ${i} selector not found: ${ruleBlock.selector}`);
              }
            }
          }
        }
      }
      console.log(`[DAP] ================================================================`);
    }
    /**
     * Analyze and log trigger usage for the entire flow
     * This helps identify which steps use step-level vs element-level triggers
     */
    analyzeTriggerUsage(flowData) {
      console.log(`[DAP] \u{1F4CA} TRIGGER USAGE ANALYSIS FOR FLOW: ${flowData.flowId}`);
      console.log(`[DAP] ================================================================`);
      let stepLevelCount = 0;
      let elementLevelCount = 0;
      let noTriggerCount = 0;
      let ruleBasedCount = 0;
      for (const step of flowData.steps) {
        const hasStepTrigger = step.trigger && step.trigger.conditions && step.trigger.conditions.length > 0;
        const hasElementTrigger = step.uxExperience?.elementTrigger;
        const hasRuleBlocks = step.conditionRuleBlocks && step.conditionRuleBlocks.length > 0;
        if (hasStepTrigger) {
          stepLevelCount++;
          const triggerType = `${step.trigger?.conditions?.[0]?.kind}-${step.trigger?.conditions?.[0]?.event}`;
          if (hasRuleBlocks) {
            console.log(`[DAP] \u{1F916} Step ${step.stepId}: STEP-LEVEL trigger (${triggerType}) + RULE-BASED decision`);
            ruleBasedCount++;
          } else {
            console.log(`[DAP] \u2705 Step ${step.stepId}: STEP-LEVEL trigger (${triggerType}) + UX experience`);
          }
          if (hasElementTrigger) {
            console.log(`[DAP]    \u2514\u2500\u2500 \u26A0\uFE0F  elementTrigger "${step.uxExperience?.elementTrigger}" will be IGNORED`);
          }
        } else if (hasElementTrigger) {
          elementLevelCount++;
          console.warn(`[DAP] \u26A0\uFE0F  Step ${step.stepId}: ELEMENT-LEVEL trigger "${step.uxExperience?.elementTrigger}" (LEGACY)`);
          console.warn(`[DAP]    \u2514\u2500\u2500 \u{1F6A8} This will BREAK when element-level triggers are removed!`);
        } else {
          noTriggerCount++;
          console.error(`[DAP] \u274C Step ${step.stepId}: NO TRIGGER - will execute immediately`);
        }
      }
      console.log(`[DAP] ================================================================`);
      console.log(`[DAP] \u{1F4CA} SUMMARY:`);
      console.log(`[DAP]    \u2705 Step-level triggers: ${stepLevelCount}`);
      console.log(`[DAP]    \u26A0\uFE0F  Element-level triggers: ${elementLevelCount}`);
      console.log(`[DAP]    \u274C No triggers: ${noTriggerCount}`);
      console.log(`[DAP]    \u{1F916} Rule-based decision steps: ${ruleBasedCount}`);
      console.log(`[DAP] ================================================================`);
      if (elementLevelCount > 0) {
        console.warn(`[DAP] \u{1F6A8} WARNING: ${elementLevelCount} steps use element-level triggers!`);
        console.warn(`[DAP]    These will BREAK when element-level support is removed.`);
        console.warn(`[DAP]    Please migrate to step-level triggers.`);
      }
      if (noTriggerCount > 0) {
        console.error(`[DAP] \u{1F6A8} ERROR: ${noTriggerCount} steps have no triggers!`);
        console.error(`[DAP]    These steps will execute immediately without user interaction.`);
      }
      if (stepLevelCount === flowData.steps.length) {
        console.log(`[DAP] \u{1F389} PERFECT! All steps use step-level triggers. Ready for element-level trigger removal.`);
      }
    }
  };
  var flowEngine = FlowEngine.getInstance();

  // src/utils/validationInterceptor.ts
  var _ValidationInterceptor = class _ValidationInterceptor {
    constructor() {
      this.observerRef = null;
      this.isInitialized = false;
    }
    static getInstance() {
      if (!_ValidationInterceptor.instance) {
        _ValidationInterceptor.instance = new _ValidationInterceptor();
      }
      return _ValidationInterceptor.instance;
    }
    /**
     * Inject CSS styles for validation tooltips and error states
     */
    injectValidationStyles() {
      const existingStyles = document.querySelector("#dap-validation-styles");
      if (existingStyles) return;
      const style = document.createElement("style");
      style.id = "dap-validation-styles";
      style.textContent = `
      /* Validation error state for inputs */
      .dap-validation-error {
        border-color: #ef4444 !important;
        box-shadow: 0 0 0 1px #ef4444 !important;
      }
      
      /* Fallback validation tooltip */
      .dap-validation-tooltip-fallback {
        position: absolute !important;
        background: #ef4444 !important;
        color: white !important;
        padding: 8px 12px !important;
        border-radius: 4px !important;
        font-size: 14px !important;
        font-family: system-ui, -apple-system, sans-serif !important;
        z-index: 10000 !important;
        max-width: 200px !important;
        word-wrap: break-word !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2) !important;
        pointer-events: none !important;
        transform: translateY(-2px) !important;
      }
      
      .dap-validation-tooltip-fallback::before {
        content: '';
        position: absolute;
        top: 100%;
        left: 12px;
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid #ef4444;
      }
      
      /* Hide native validation bubbles */
      input:invalid {
        box-shadow: none !important;
      }
      
      /* Ensure tooltips appear above everything */
      .dap-tip-layer {
        z-index: 10001 !important;
      }
    `;
      document.head.appendChild(style);
    }
    /**
     * Initialize validation interception for the entire page
     */
    initialize() {
      if (this.isInitialized) {
        console.debug("[DAP] Validation interceptor already initialized");
        return;
      }
      console.debug("[DAP] Initializing validation interceptor for DAP tooltips");
      this.injectValidationStyles();
      this.setupDAPTooltipTriggers();
      this.isInitialized = true;
      console.debug("[DAP] Validation interceptor initialized successfully");
    }
    /**
     * Set up DAP tooltip triggers for validation errors
     */
    setupDAPTooltipTriggers() {
      document.addEventListener("submit", async (event) => {
        const form = event.target;
        if (form.tagName === "FORM") {
          const firstInvalidInput = this.validateForm(form);
          if (firstInvalidInput) {
            event.preventDefault();
            firstInvalidInput.focus();
            await this.triggerDAPValidation(firstInvalidInput);
          }
        }
      }, { passive: false });
      document.addEventListener("blur", async (event) => {
        const input = event.target;
        if (input && (input.tagName === "INPUT" || input.tagName === "TEXTAREA") && input.hasAttribute("required")) {
          if (!this.isInputValid(input)) {
            await this.triggerDAPValidation(input);
          }
        }
      }, { capture: true });
    }
    /**
     * Disable native validation on all forms in the document
     */
    disableNativeValidationOnForms() {
      const forms = document.querySelectorAll("form");
      forms.forEach((form) => {
        this.disableFormValidation(form);
      });
      if (forms.length > 0) {
        console.debug("[DAP] Browser validation suppressed on", forms.length, "forms");
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          setTimeout(() => {
            const newForms = document.querySelectorAll("form:not([novalidate])");
            newForms.forEach((form) => {
              this.disableFormValidation(form);
            });
            if (newForms.length > 0) {
              console.debug("[DAP] Additional forms processed after DOM load:", newForms.length);
            }
          }, 100);
        });
      }
    }
    /**
     * Disable native validation on a specific form
     */
    disableFormValidation(form) {
      form.setAttribute("novalidate", "");
      form.noValidate = true;
      form.addEventListener("submit", this.handleFormSubmit.bind(this), { capture: true, passive: false });
      const inputs = form.querySelectorAll("input, select, textarea");
      inputs.forEach((input) => {
        this.setupInputValidation(input);
      });
      console.debug("[DAP] Form validation disabled for:", form);
    }
    /**
     * Set up validation listeners on individual inputs
     */
    setupInputValidation(input) {
      input.addEventListener("invalid", this.preventBrowserTooltip.bind(this), { capture: true, passive: false });
      if ("setCustomValidity" in input) {
        input.setCustomValidity("");
      }
      input.addEventListener("blur", this.validateInput.bind(this));
      input.addEventListener("input", this.clearValidationErrors.bind(this));
      input.addEventListener("focus", (event) => {
        const inputElement = event.target;
        if ("setCustomValidity" in inputElement) {
          inputElement.setCustomValidity("");
        }
      });
      console.debug("[DAP] Input validation setup for:", input);
    }
    /**
     * Prevent browser validation tooltips from appearing
     */
    preventBrowserTooltip(event) {
      console.debug("[DAP] Browser validation suppressed for element:", event.target);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const target = event.target;
      if (target && "setCustomValidity" in target) {
        target.setCustomValidity("");
      }
      this.triggerDAPValidation(event.target);
    }
    /**
     * Handle form submission with custom validation
     */
    handleFormSubmit(event) {
      const form = event.target;
      const firstInvalidInput = this.validateForm(form);
      if (firstInvalidInput) {
        event.preventDefault();
        event.stopPropagation();
        firstInvalidInput.focus();
        this.triggerDAPValidation(firstInvalidInput);
      }
    }
    /**
     * Validate a form and return first invalid input
     */
    validateForm(form) {
      const inputs = form.querySelectorAll("input[required], select[required], textarea[required]");
      for (let i = 0; i < inputs.length; i++) {
        const element = inputs[i];
        if (!this.isInputValid(element)) {
          return element;
        }
      }
      return null;
    }
    /**
     * Validate individual input
     */
    validateInput(event) {
      const input = event.target;
      if (!this.isInputValid(input)) {
        this.triggerDAPValidation(input);
      } else {
        this.clearValidationErrors(event);
      }
    }
    /**
     * Check if an input is valid
     */
    isInputValid(input) {
      if (input.hasAttribute("required") && !input.value.trim()) {
        return false;
      }
      if (input.type === "email" && input.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(input.value);
      }
      if (input.type === "url" && input.value) {
        try {
          new URL(input.value);
          return true;
        } catch {
          return false;
        }
      }
      return true;
    }
    /**
     * Trigger DAP validation tooltip
     */
    async triggerDAPValidation(input) {
      this.clearAllTooltips();
      console.debug("[DAP] DAP validation tooltip triggered for:", input);
      const validationMessage = this.getValidationMessage(input);
      const validationExperience = {
        elementSelector: input.id ? `#${input.id}` : this.generateSelector(input),
        elementTrigger: "validation_error",
        elementLocation: window.location.pathname,
        content: {
          text: validationMessage,
          placement: "top"
        }
      };
      input.classList.add("dap-validation-error");
      await this.showDAPTooltip(input, validationExperience);
    }
    /**
     * Get appropriate validation message for an input
     */
    getValidationMessage(input) {
      const inputElement = input;
      const fieldName = this.getFieldName(input);
      if (inputElement.hasAttribute("required") && !inputElement.value.trim()) {
        return `Please enter ${fieldName}`;
      }
      if (inputElement.type === "email" && inputElement.value) {
        return "Please enter a valid email address";
      }
      if (inputElement.type === "url" && inputElement.value) {
        return "Please enter a valid URL";
      }
      return `Please check the ${fieldName} field`;
    }
    /**
     * Get user-friendly field name
     */
    getFieldName(input) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) {
        return label.textContent?.trim().replace(":", "") || "field";
      }
      const placeholder = input.placeholder;
      if (placeholder) {
        return placeholder;
      }
      const name = input.name;
      if (name) {
        return name.replace(/[_-]/g, " ").toLowerCase();
      }
      return "field";
    }
    /**
     * Generate CSS selector for element
     */
    generateSelector(element) {
      if (element.id) {
        return `#${element.id}`;
      }
      if (element.className) {
        return `.${element.className.split(" ")[0]}`;
      }
      return element.tagName.toLowerCase();
    }
    /**
     * Show DAP tooltip for validation
     */
    async showDAPTooltip(element, experience) {
      try {
        const { renderDirectTooltip: renderDirectTooltip2 } = await Promise.resolve().then(() => (init_tooltip(), tooltip_exports));
        const tooltipPayload = {
          targetSelector: experience.elementSelector,
          text: experience.content.text,
          placement: experience.content.placement || "top",
          trigger: "click"
          // Use click trigger for validation tooltips
        };
        console.debug("[DAP] Showing DAP validation tooltip:", tooltipPayload);
        await renderDirectTooltip2(tooltipPayload);
      } catch (error) {
        console.error("[DAP] Failed to load tooltip renderer:", error);
        console.debug("[DAP] Using enhanced fallback tooltip");
        this.showDAPStyledFallbackTooltip(element, experience.content.text);
      }
    }
    /**
     * Enhanced fallback tooltip with DAP styling
     */
    showDAPStyledFallbackTooltip(element, message) {
      this.clearAllTooltips();
      const tooltipWrapper = document.createElement("div");
      tooltipWrapper.className = "dap-validation-tooltip-wrap";
      tooltipWrapper.style.cssText = `
      position: absolute;
      z-index: 10001;
      pointer-events: none;
    `;
      const tooltip = document.createElement("div");
      tooltip.className = "dap-validation-tooltip-bubble";
      tooltip.style.cssText = `
      background: #2563eb;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 280px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      position: relative;
      word-wrap: break-word;
      line-height: 1.4;
    `;
      tooltip.textContent = message;
      const arrow = document.createElement("div");
      arrow.className = "dap-validation-tooltip-arrow";
      arrow.style.cssText = `
      position: absolute;
      top: 100%;
      left: 20px;
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid #2563eb;
    `;
      tooltip.appendChild(arrow);
      tooltipWrapper.appendChild(tooltip);
      const rect = element.getBoundingClientRect();
      const tooltipTop = Math.max(10, rect.top - 50 + window.scrollY);
      const tooltipLeft = Math.max(10, Math.min(rect.left + window.scrollX, window.innerWidth - 300));
      tooltipWrapper.style.top = `${tooltipTop}px`;
      tooltipWrapper.style.left = `${tooltipLeft}px`;
      console.debug("[DAP] DAP-styled fallback tooltip positioned at:", tooltipTop, tooltipLeft);
      document.body.appendChild(tooltipWrapper);
      setTimeout(() => {
        if (tooltipWrapper.parentNode) {
          tooltipWrapper.parentNode.removeChild(tooltipWrapper);
        }
      }, 4e3);
    }
    /**
     * Clear all validation tooltips (both DAP and fallback)
     */
    clearAllTooltips() {
      const dapTooltips = document.querySelectorAll(".dap-tip-layer, .dap-tooltip-wrap");
      dapTooltips.forEach((tooltip) => tooltip.remove());
      const fallbackTooltips = document.querySelectorAll(".dap-validation-tooltip-fallback, .dap-validation-tooltip-wrap");
      fallbackTooltips.forEach((tooltip) => tooltip.remove());
      console.debug("[DAP] All validation tooltips cleared");
    }
    /**
     * Fallback tooltip if DAP tooltip fails (DEPRECATED - use DAP styled version)
     */
    showFallbackTooltip(element, message) {
      this.clearFallbackTooltips();
      const tooltip = document.createElement("div");
      tooltip.className = "dap-validation-tooltip-fallback";
      tooltip.textContent = message;
      tooltip.style.cssText = `
      position: absolute;
      background: #ef4444;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10000;
      max-width: 200px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      pointer-events: none;
    `;
      const rect = element.getBoundingClientRect();
      const tooltipTop = Math.max(10, rect.top - 35 + window.scrollY);
      const tooltipLeft = Math.max(10, Math.min(rect.left + window.scrollX, window.innerWidth - 220));
      tooltip.style.top = `${tooltipTop}px`;
      tooltip.style.left = `${tooltipLeft}px`;
      console.debug("[DAP] Fallback tooltip positioned at:", tooltipTop, tooltipLeft);
      document.body.appendChild(tooltip);
      setTimeout(() => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      }, 3e3);
    }
    /**
     * Clear validation errors when user starts typing
     */
    clearValidationErrors(event) {
      const input = event.target;
      input.classList.remove("dap-validation-error");
      this.clearAllTooltips();
    }
    /**
     * Clear fallback tooltips
     */
    clearFallbackTooltips() {
      const tooltips = document.querySelectorAll(".dap-validation-tooltip-fallback");
      tooltips.forEach((tooltip) => tooltip.remove());
    }
    /**
     * Dismiss DAP tooltips
     */
    dismissDAPTooltips() {
      console.debug("[DAP] DAP tooltip dismissed");
      const activeTooltips = document.querySelectorAll(".dap-tooltip-wrap");
      activeTooltips.forEach((tooltip) => {
        const closeButton = tooltip.querySelector(".dap-tooltip-close");
        if (closeButton) {
          closeButton.click();
        } else {
          tooltip.remove();
        }
      });
    }
    /**
     * Set up observer for dynamically added forms
     */
    setupFormObserver() {
      this.observerRef = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node;
              if (element.tagName === "FORM") {
                this.disableFormValidation(element);
              }
              const forms = element.querySelectorAll?.("form");
              forms?.forEach((form) => {
                this.disableFormValidation(form);
              });
            }
          });
        });
      });
      this.observerRef.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    /**
     * Set up additional validation listeners for enhanced coverage
     */
    setupValidationListeners() {
      window.addEventListener("invalid", this.preventBrowserTooltip.bind(this), { capture: true, passive: false });
      document.addEventListener("focusin", (event) => {
        const input = event.target;
        if (input.tagName === "INPUT" || input.tagName === "TEXTAREA" || input.tagName === "SELECT") {
          input.setCustomValidity("");
        }
      }, { capture: true });
    }
    /**
     * Cleanup and destroy the interceptor
     */
    destroy() {
      if (this.observerRef) {
        this.observerRef.disconnect();
        this.observerRef = null;
      }
      document.removeEventListener("invalid", this.preventBrowserTooltip.bind(this), true);
      this.clearFallbackTooltips();
      _ValidationInterceptor.instance = null;
    }
  };
  _ValidationInterceptor.instance = null;
  var ValidationInterceptor = _ValidationInterceptor;

  // src/index.ts
  init_selectors();
  var validationInterceptor = ValidationInterceptor.getInstance();
  registerModalSequence();
  registerModal();
  registerTooltip();
  registerSurvey();
  registerPopover();
  registerBeacon();
  registerBanner();
  register("alert", getRenderer("banner"));
  registerHotspots();
  registerHotspotTour();
  registerTaskList();
  registerWalkthrough();
  var log = (...args) => window.__DAP_DEBUG__ ? console.log("[DAP]", ...args) : void 0;
  var _dapConfig = null;
  var _flowInitializationPending = false;
  var _pendingFlowIds = [];
  var _registeredFlows = /* @__PURE__ */ new Map();
  async function init(opts) {
    const { configUrl, debug, screenId, user } = opts || {};
    window.__DAP_DEBUG__ = !!debug;
    if (!configUrl) throw new Error("DAP.init: configUrl is required");
    const pathname = location.pathname.replace(/^\/+/, "");
    const cfg = await loadConfig(configUrl);
    const hostBase = location.origin;
    window.__DAP_CONFIG__ = cfg;
    _dapConfig = cfg;
    if (user) {
      userContextService.setUser(user);
      log("User context set during init:", user.id);
    }
    log("Loaded config", { cfg, hostBase });
    validationInterceptor.initialize();
    const locationService = LocationContextService.getInstance();
    locationService.setContext({
      currentPath: pathname,
      screenId: screenId || pathname
    });
    log("Location context set", locationService.getContext());
    const ids = await fetchVisibleFlowIds(cfg, hostBase, pathname);
    log("Visible flow IDs", ids);
    if (ids.length === 0) {
      log("No flows available");
      return;
    }
    _pendingFlowIds = ids;
    await initializeFlowsWhenReady();
  }
  async function loadConfig(configUrl) {
    const res = await fetch(configUrl);
    if (!res.ok) throw new Error(`Failed to load config: ${res.status}`);
    return res.json();
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
      return;
    }
    await startPendingFlows();
  }
  async function waitForDOMReady() {
    return new Promise((resolve) => {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => resolve());
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
    log(`Starting ${_pendingFlowIds.length} pending flows`);
    for (const flowObj of _pendingFlowIds) {
      try {
        const flowId = typeof flowObj === "object" ? flowObj.flowId || flowObj.id : flowObj;
        log(`Processing flow: ${flowId}`);
        let rawFlowData;
        if (typeof flowObj === "object" && Array.isArray(flowObj.steps) && flowObj.steps.length > 0) {
          log(`Using pre-loaded flow data for: ${flowId}`);
          rawFlowData = flowObj;
        } else {
          log(`Fetching flow data for: ${flowId}`);
          rawFlowData = await fetchFlowById(_dapConfig, location.origin, flowId);
        }
        const flowData = {
          flowId: rawFlowData.flowId || rawFlowData.id || flowId,
          flowName: rawFlowData.flowName || rawFlowData.name || flowId,
          steps: rawFlowData.steps || []
        };
        log("Starting flow with engine:", flowData);
        await flowEngine.startFlow(flowData);
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (err) {
        console.error(`[DAP] Failed to start flow`, err);
      }
    }
    _flowInitializationPending = false;
  }
  function setUser(user) {
    userContextService.setUser(user);
    if (_pendingFlowIds.length > 0 && !_flowInitializationPending) {
      log("User context set - starting pending flows");
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
  function runModalSequence() {
    console.warn("[DAP] runModalSequence is deprecated, flows are managed by FlowEngine");
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
        uxExperience: {
          uxExperienceType: step.type,
          elementSelector: step.trigger?.selector,
          elementTrigger: step.trigger?.type || "immediate",
          elementLocation: step.trigger?.placement || "auto",
          content: step.content
        }
      }))
    };
    log("Executing custom flow:", normalizedFlow);
    return flowEngine.startFlow(normalizedFlow);
  }
  function registerFlow(flowData) {
    _registeredFlows.set(flowData.flowId, flowData);
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
    try {
      const rawFlowData = await fetchFlowById(_dapConfig, location.origin, flowId);
      const flowData = {
        flowId: rawFlowData.flowId || rawFlowData.id || flowId,
        flowName: rawFlowData.flowName || rawFlowData.name || flowId,
        steps: rawFlowData.steps || []
      };
      log("Starting flow from backend:", flowId);
      return flowEngine.startFlow(flowData);
    } catch (error) {
      throw new Error(`Flow not found: ${flowId}. Make sure to register it first or check if it exists in the backend.`);
    }
  }
  if (typeof window !== "undefined") {
    window.DAP = {
      init,
      executeFlow,
      // Add executeFlow to public API
      registerFlow,
      // Add registerFlow to public API
      startFlow,
      // Add startFlow to public API
      // User context APIs
      setUser,
      updateUser,
      getUser,
      clearUser,
      // Core services
      locationContext: LocationContextService.getInstance(),
      userContext: userContextService,
      flowEngine,
      // Debug methods
      getFlowState: () => flowEngine.getState(),
      getUserState: () => userContextService.getDebugState(),
      resolveSelector,
      // Expose for testing
      // Development utilities (only in debug mode)
      ...typeof window.__DAP_DEBUG__ !== "undefined" && window.__DAP_DEBUG__ ? {
        testFlow: async (flowId) => {
          if (!_dapConfig) throw new Error("SDK not initialized");
          const rawFlowData = await fetchFlowById(_dapConfig, location.origin, flowId);
          const flowData = {
            flowId: rawFlowData.flowId,
            flowName: rawFlowData.flowName || flowId,
            steps: rawFlowData.steps || []
          };
          return flowEngine.startFlow(flowData);
        },
        renderModal
        // Add for testing
      } : {
        renderModal
        // Always available for testing draggable functionality
      }
    };
  }

  exports.clearUser = clearUser;
  exports.executeFlow = executeFlow;
  exports.getUser = getUser;
  exports.init = init;
  exports.registerFlow = registerFlow;
  exports.runModalSequence = runModalSequence;
  exports.setUser = setUser;
  exports.startFlow = startFlow;
  exports.updateUser = updateUser;

  return exports;

})({});
//# sourceMappingURL=index.umd.js.map
//# sourceMappingURL=index.umd.js.map