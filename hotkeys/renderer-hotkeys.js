(function installPlasticityHotkeys() {
  const VERSION = "0.4.2";
  const DEBUG_MAX_LOGS = 12;
  const DEBUG_TOAST_MS = 2600;
  const existing = window.__plasticityHotkeys;
  const runtimeConfig = window.__PLASTICITY_HOTKEYS_CONFIG || {};

  if (existing && existing.version === VERSION && typeof existing.reloadConfig === "function") {
    existing.reloadConfig(runtimeConfig);
    return;
  }

  const state = {
    installedAt: new Date().toISOString(),
    debugVisible: false,
    lastPointerRowText: null,
    lastResolvedRowText: null,
    lastCommand: null,
    lastResult: null,
    lastError: null,
    lastEvent: null,
    lastTargetSummary: null,
    lastSelectorDecision: null,
    lastSelectionSnapshot: null,
    logs: [],
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function trimText(text, max = 80) {
    if (!text) {
      return "";
    }
    const normalized = String(text).replace(/\s+/g, " ").trim();
    if (normalized.length <= max) {
      return normalized;
    }
    return `${normalized.slice(0, max - 1)}…`;
  }

  function getClassName(element) {
    return typeof element?.className === "string" ? element.className : "";
  }

  function summarizeElement(element) {
    if (!(element instanceof Element)) {
      return null;
    }

    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : "";
    const classes = getClassName(element)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .map((item) => `.${item}`)
      .join("");
    const text = trimText(element.textContent, 36);

    return `${tag}${id}${classes}${text ? ` "${text}"` : ""}`;
  }

  function pushLog(type, detail) {
    const maxLogs = Number(window.__plasticityHotkeysConfig?.__meta?.debugMaxEntries) || DEBUG_MAX_LOGS;
    state.logs = [
      ...state.logs.slice(-(maxLogs - 1)),
      {
        type,
        at: nowIso(),
        detail,
      },
    ];
    renderDebugUi();
  }

  function ensureDebugRoot() {
    let root = document.getElementById("plasticity-hotkeys-debug");
    if (!root) {
      root = document.createElement("div");
      root.id = "plasticity-hotkeys-debug";
      root.style.position = "fixed";
      root.style.right = "16px";
      root.style.bottom = "16px";
      root.style.zIndex = "2147483647";
      root.style.maxWidth = "420px";
      root.style.pointerEvents = "none";
      root.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      document.body.appendChild(root);
    }
    return root;
  }

  function showToast(message, tone = "info") {
    if (window.__plasticityHotkeysConfig?.__meta?.debugToast !== true) {
      return;
    }

    const root = ensureDebugRoot();
    const toast = document.createElement("div");
    const background = tone === "error"
      ? "rgba(160, 28, 28, 0.92)"
      : tone === "success"
        ? "rgba(26, 120, 56, 0.92)"
        : "rgba(20, 20, 24, 0.92)";

    toast.style.marginTop = "8px";
    toast.style.padding = "10px 12px";
    toast.style.borderRadius = "10px";
    toast.style.boxShadow = "0 10px 24px rgba(0, 0, 0, 0.32)";
    toast.style.background = background;
    toast.style.color = "#f6f6f8";
    toast.style.fontSize = "12px";
    toast.style.lineHeight = "1.45";
    toast.textContent = message;
    root.appendChild(toast);

    const duration = Number(window.__plasticityHotkeysConfig?.__meta?.debugToastMs) || DEBUG_TOAST_MS;
    window.setTimeout(() => {
      toast.remove();
    }, duration);
  }

  function renderDebugUi() {
    const root = ensureDebugRoot();
    const panelId = "plasticity-hotkeys-debug-panel";
    let panel = document.getElementById(panelId);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = panelId;
      panel.style.marginTop = "8px";
      panel.style.padding = "12px";
      panel.style.borderRadius = "12px";
      panel.style.background = "rgba(18, 18, 22, 0.94)";
      panel.style.color = "#f5f5f7";
      panel.style.boxShadow = "0 16px 36px rgba(0, 0, 0, 0.34)";
      panel.style.whiteSpace = "pre-wrap";
      panel.style.fontSize = "11px";
      panel.style.lineHeight = "1.5";
      root.appendChild(panel);
    }

    if (!state.debugVisible) {
      panel.style.display = "none";
      return;
    }

    panel.style.display = "block";
    const lines = [
      "[plasticity-hotkeys debug]",
      `version: ${VERSION}`,
      `lastCommand: ${state.lastCommand || "-"}`,
      `lastError: ${state.lastError || "-"}`,
      `lastRow: ${state.lastResolvedRowText || state.lastPointerRowText || "-"}`,
      `lastTarget: ${state.lastTargetSummary || "-"}`,
      `selector: ${state.lastSelectorDecision || "-"}`,
      `selection: ${trimText(JSON.stringify(state.lastSelectionSnapshot || []), 180) || "-"}`,
      "recent:",
      ...state.logs.slice(-5).map((entry) => {
        const summary = trimText(JSON.stringify(entry.detail), 160);
        return `- ${entry.type} ${summary}`;
      }),
    ];
    panel.textContent = lines.join("\n");
  }

  function normalizeSelector(selector) {
    return selector
      .replace(/\bplasticity-outliner\b/g, ".plasticity-outliner")
      .replace(/\bplasticity-assets\b/g, ".plasticity-assets");
  }

  function isEditableTarget(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    if (target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")) {
      return true;
    }

    const role = target.getAttribute("role");
    return role === "textbox" || role === "searchbox";
  }

  function normalizeChord(event) {
    const parts = [];
    if (event.ctrlKey) parts.push("ctrl");
    if (event.metaKey) parts.push("cmd");
    if (event.altKey) parts.push("alt");

    const rawKey = event.key || "";
    let key = rawKey;

    switch (rawKey) {
      case " ":
        key = "space";
        break;
      case "Escape":
        key = "escape";
        break;
      case "ArrowUp":
        key = "up";
        break;
      case "ArrowDown":
        key = "down";
        break;
      case "ArrowLeft":
        key = "left";
        break;
      case "ArrowRight":
        key = "right";
        break;
      case "Enter":
        key = "enter";
        break;
      case "Tab":
        key = "tab";
        break;
      case "Backspace":
        key = "backspace";
        break;
      case "Delete":
        key = "delete";
        break;
      default:
        key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey.toLowerCase();
        break;
    }

    if (key && !["shift", "control", "alt", "meta"].includes(key)) {
      if (event.shiftKey) {
        parts.push("shift");
      }
      parts.push(key);
    }

    return parts.join("-");
  }

  function isLikelyOutlinerRow(node) {
    if (!(node instanceof HTMLElement)) {
      return false;
    }
    if (!node.closest(".plasticity-outliner")) {
      return false;
    }

    const className = getClassName(node);
    return (
      className.includes("h-7") &&
      className.includes("w-full") &&
      className.includes("flex-row")
    );
  }

  function findClosestOutlinerRow(node) {
    let current = node instanceof Element ? node : null;
    while (current) {
      if (isLikelyOutlinerRow(current)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function getRowText(row) {
    if (!(row instanceof Element)) {
      return null;
    }
    return trimText(row.textContent, 120) || null;
  }

  function getOutlinerRows() {
    return Array.from(document.querySelectorAll(".plasticity-outliner *")).filter(isLikelyOutlinerRow);
  }

  function getBackgroundAlpha(element) {
    if (!(element instanceof Element)) {
      return 0;
    }

    const backgroundColor = window.getComputedStyle(element).backgroundColor || "";
    if (!backgroundColor || backgroundColor === "transparent") {
      return 0;
    }

    const match = backgroundColor.match(/rgba?\(([^)]+)\)/i);
    if (!match) {
      return 0;
    }

    const parts = match[1].split(",").map((part) => Number(part.trim()));
    if (parts.length === 4) {
      return Number.isFinite(parts[3]) ? parts[3] : 0;
    }

    if (parts.length === 3) {
      const [red, green, blue] = parts;
      return red === 0 && green === 0 && blue === 0 ? 0 : 1;
    }

    return 0;
  }

  function collectRowSignals(row) {
    const signals = [];
    const elements = [row, ...row.querySelectorAll("*")];

    for (const element of elements) {
      if (element.getAttribute("aria-selected") === "true") {
        signals.push("aria-selected");
      }
      if (element.getAttribute("data-selected") === "true") {
        signals.push("data-selected");
      }
    }

    const backgroundAlpha = getBackgroundAlpha(row);
    if (backgroundAlpha >= 0.08) {
      signals.push(`computed-bg:${backgroundAlpha.toFixed(2)}`);
    }

    return Array.from(new Set(signals));
  }

  function scoreRow(row) {
    const reasons = [];
    let score = 0;
    const signals = collectRowSignals(row);
    const backgroundAlpha = getBackgroundAlpha(row);

    if (document.activeElement instanceof Element && row.contains(document.activeElement)) {
      score += 120;
      reasons.push("contains-active-element");
    }

    if (window.__plasticityHotkeysLastOutlinerRow === row) {
      score += 100;
      reasons.push("last-pointer-row");
    }

    if (signals.length > 0) {
      score += 90;
      reasons.push(...signals);
    }

    if (backgroundAlpha >= 0.08) {
      score += Math.round(backgroundAlpha * 1000);
      reasons.push(`computed-background:${backgroundAlpha.toFixed(2)}`);
    }

    const label = row.querySelector("span.font-medium");
    if (label && getClassName(label).includes("text-black-600")) {
      score += 15;
      reasons.push("label-text-black-600");
    }

    return {
      row,
      rowText: getRowText(row),
      score,
      reasons,
      summary: summarizeElement(row),
      backgroundAlpha,
    };
  }

  function findSelectedOutlinerRow() {
    const rows = getOutlinerRows();
    const candidates = rows.map(scoreRow).sort((a, b) => b.score - a.score);
    const best = candidates[0];

    state.lastSelectionSnapshot = candidates.slice(0, 4).map((candidate) => ({
      rowText: candidate.rowText,
      score: candidate.score,
      reasons: candidate.reasons,
      backgroundAlpha: candidate.backgroundAlpha,
    }));

    if (!best || best.score <= 0) {
      return {
        row: null,
        candidates,
      };
    }

    return {
      row: best.row,
      candidates,
      chosen: best,
    };
  }

  function findRowLabelElement(row) {
    return Array.from(row.querySelectorAll("span")).find((element) => {
      const className = getClassName(element);
      return className.includes("font-medium") && className.includes("truncate");
    }) || null;
  }

  function getVisibleRect(element) {
    if (!(element instanceof Element)) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return rect;
  }

  function findFolderIconTarget(row) {
    if (!(row instanceof Element)) {
      return { target: null, reason: "no-row" };
    }

    const label = findRowLabelElement(row);
    const labelRect = getVisibleRect(label);
    const rowRect = getVisibleRect(row);
    const svgNodes = Array.from(row.querySelectorAll("svg"));
    const iconCandidates = [];

    for (const svg of svgNodes) {
      const wrapper = svg.closest("span, div, button") || svg;
      const rect = getVisibleRect(wrapper);
      if (!rect || !rowRect) {
        continue;
      }

      if (labelRect && rect.left >= labelRect.left) {
        continue;
      }

      if (rect.left > rowRect.left + rowRect.width * 0.45) {
        continue;
      }

      iconCandidates.push({
        target: wrapper,
        rect,
        summary: summarizeElement(wrapper),
      });
    }

    if (iconCandidates.length > 0) {
      iconCandidates.sort((a, b) => b.rect.left - a.rect.left);
      return {
        target: iconCandidates[0].target,
        reason: "folder-icon-candidate",
        candidates: iconCandidates.slice(0, 4).map((item) => item.summary),
      };
    }

    const clickable = Array.from(row.querySelectorAll("*")).find((element) => {
      const className = getClassName(element);
      return className.includes("cursor-pointer") && className.includes("items-center");
    });

    return {
      target: clickable || row,
      reason: clickable ? "clickable-row-fallback" : "row-fallback",
      candidates: [summarizeElement(clickable || row)],
    };
  }

  function dispatchSyntheticDoubleClick(target) {
    if (!(target instanceof Element)) {
      return {
        ok: false,
        reason: "no-target",
        targetSummary: null,
      };
    }

    const rect = target.getBoundingClientRect();
    const clientX = rect.left + Math.max(2, Math.min(rect.width - 2, rect.width / 2));
    const clientY = rect.top + Math.max(2, Math.min(rect.height - 2, rect.height / 2));
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX,
      clientY,
      button: 0,
      buttons: 1,
    };

    const sequence = [
      ["pointerdown", 1],
      ["mousedown", 1],
      ["pointerup", 1],
      ["mouseup", 1],
      ["click", 1],
      ["pointerdown", 2],
      ["mousedown", 2],
      ["pointerup", 2],
      ["mouseup", 2],
      ["click", 2],
      ["dblclick", 2],
    ];

    for (const [type, detail] of sequence) {
      const eventInit = { ...base, detail };
      const event = type.startsWith("pointer")
        ? new PointerEvent(type, { ...eventInit, pointerId: 1, pointerType: "mouse", isPrimary: true })
        : new MouseEvent(type, eventInit);
      target.dispatchEvent(event);
    }

    return {
      ok: true,
      reason: "dispatched-dblclick",
      targetSummary: summarizeElement(target),
      point: { x: Math.round(clientX), y: Math.round(clientY) },
    };
  }

  function dispatchSyntheticClick(target) {
    if (!(target instanceof Element)) {
      return {
        ok: false,
        reason: "no-target",
        targetSummary: null,
      };
    }

    const rect = target.getBoundingClientRect();
    const clientX = rect.left + Math.max(2, Math.min(rect.width - 2, rect.width / 2));
    const clientY = rect.top + Math.max(2, Math.min(rect.height - 2, rect.height / 2));
    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX,
      clientY,
      button: 0,
      buttons: 1,
      detail: 1,
    };

    const sequence = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"];
    for (const type of sequence) {
      const event = type.startsWith("pointer")
        ? new PointerEvent(type, { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true })
        : new MouseEvent(type, base);
      target.dispatchEvent(event);
    }

    return {
      ok: true,
      reason: "dispatched-click",
      targetSummary: summarizeElement(target),
      point: { x: Math.round(clientX), y: Math.round(clientY) },
    };
  }

  function isVisibleElement(element) {
    const rect = getVisibleRect(element);
    if (!rect) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function hasThreeCircleIcon(button) {
    const circles = button.querySelectorAll("svg circle");
    return circles.length === 3;
  }

  function getVisibleButtons(root) {
    if (!(root instanceof Element)) {
      return [];
    }
    return Array.from(root.querySelectorAll("button")).filter(isVisibleElement);
  }

  function sortButtonsLeftToRight(buttons) {
    return [...buttons].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  }

  function findOutlinerSectionRoot(outlinerRoot) {
    if (!(outlinerRoot instanceof Element)) {
      return null;
    }

    return outlinerRoot.parentElement instanceof Element
      ? outlinerRoot.parentElement
      : null;
  }

  function findOutlinerToolbarRow(sectionRoot, outlinerRoot) {
    if (!(sectionRoot instanceof Element) || !(outlinerRoot instanceof Element)) {
      return null;
    }

    const outlinerRect = outlinerRoot.getBoundingClientRect();
    const children = Array.from(sectionRoot.children).filter((child) => child instanceof HTMLElement && isVisibleElement(child));

    const candidates = children
      .filter((child) => child !== outlinerRoot)
      .map((child) => ({
        element: child,
        rect: child.getBoundingClientRect(),
        buttonCount: getVisibleButtons(child).length,
      }))
      .filter((item) => item.buttonCount >= 2)
      .filter((item) => item.rect.bottom <= outlinerRect.top + 8)
      .filter((item) => item.rect.left <= outlinerRect.left + 16 && item.rect.right >= outlinerRect.right - 16)
      .sort((a, b) => b.rect.bottom - a.rect.bottom);

    return candidates[0]?.element || null;
  }

  function findToolbarTrailingButtonGroup(toolbarRow) {
    if (!(toolbarRow instanceof Element)) {
      return null;
    }

    const groups = Array.from(toolbarRow.children)
      .filter((child) => child instanceof HTMLElement && isVisibleElement(child))
      .map((child) => ({
        element: child,
        rect: child.getBoundingClientRect(),
        buttonCount: getVisibleButtons(child).length,
      }))
      .filter((item) => item.buttonCount > 0)
      .sort((a, b) => b.rect.right - a.rect.right);

    return groups[0]?.element || null;
  }

  function findOutlinerOverflowButton() {
    const outlinerRoot = document.querySelector(".plasticity-outliner");
    if (!outlinerRoot) {
      return {
        button: null,
        reason: "outliner-not-found",
      };
    }

    const sectionRoot = findOutlinerSectionRoot(outlinerRoot);
    const toolbarRow = findOutlinerToolbarRow(sectionRoot, outlinerRoot);
    const trailingGroup = findToolbarTrailingButtonGroup(toolbarRow);
    const trailingButtons = sortButtonsLeftToRight(getVisibleButtons(trailingGroup));
    const rowButtons = sortButtonsLeftToRight(getVisibleButtons(toolbarRow));
    const sectionButtons = getVisibleButtons(sectionRoot);
    const trailingThreeDot = trailingButtons.find(hasThreeCircleIcon);

    if (trailingThreeDot) {
      return {
        button: trailingThreeDot,
        reason: "toolbar-trailing-three-circle-button",
        candidates: trailingButtons.map(summarizeElement),
      };
    }

    if (trailingButtons.length >= 2) {
      return {
        button: trailingButtons[0],
        reason: "toolbar-trailing-left-button",
        candidates: trailingButtons.map(summarizeElement),
      };
    }

    if (rowButtons.length >= 3) {
      return {
        button: rowButtons[1],
        reason: "toolbar-middle-button-fallback",
        candidates: rowButtons.map(summarizeElement),
      };
    }

    const sectionThreeDot = getVisibleButtons(sectionRoot).find(hasThreeCircleIcon);
    if (sectionThreeDot) {
      return {
        button: sectionThreeDot,
        reason: "section-three-circle-button",
        candidates: sectionButtons.map(summarizeElement).slice(0, 6),
      };
    }

    return {
      button: null,
      reason: "overflow-button-not-found",
      candidates: sectionButtons.slice(0, 8).map(summarizeElement),
    };
  }

  function getContextMenuItems() {
    return Array.from(document.querySelectorAll(".z-context-menu [role='menuitem'], .z-context-menu button, .z-context-menu .cursor-pointer"))
      .filter(isVisibleElement);
  }

  function findMenuItemByText(labelText) {
    const normalizedLabel = trimText(labelText, 200).toLowerCase();
    const items = getContextMenuItems();

    const match = items.find((item) => trimText(item.textContent, 200).toLowerCase() === normalizedLabel);
    if (match) {
      return {
        item: match,
        reason: "exact-text-match",
        itemSummary: summarizeElement(match),
      };
    }

    const fuzzy = items.find((item) => trimText(item.textContent, 200).toLowerCase().includes(normalizedLabel));
    if (fuzzy) {
      return {
        item: fuzzy,
        reason: "includes-text-match",
        itemSummary: summarizeElement(fuzzy),
      };
    }

    return {
      item: null,
      reason: "menu-item-not-found",
      candidates: items.slice(0, 12).map((item) => trimText(item.textContent, 120)),
    };
  }

  async function waitForMenuItemByText(labelText, timeoutMs = 1200) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const result = findMenuItemByText(labelText);
      if (result.item) {
        return result;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 40));
    }

    return findMenuItemByText(labelText);
  }

  function selectorMatchesDetailed(selector, event) {
    const normalized = normalizeSelector(selector);
    const eventTarget = event.target instanceof Element ? event.target : null;

    if (eventTarget && eventTarget.closest(normalized)) {
      return { matched: true, reason: "event-target-in-selector" };
    }

    if (document.activeElement instanceof Element && document.activeElement.closest(normalized)) {
      return { matched: true, reason: "active-element-in-selector" };
    }

    if (normalized.includes(".plasticity-outliner")) {
      const selection = findSelectedOutlinerRow();
      if (selection.row) {
        return {
          matched: true,
          reason: "outliner-selected-row-available",
          selection,
        };
      }

      return {
        matched: false,
        reason: "outliner-no-selected-row",
        selection,
      };
    }

    if (document.querySelector(normalized)) {
      return { matched: true, reason: "selector-found-in-dom" };
    }

    return { matched: false, reason: "selector-not-found" };
  }

  function activateSelectedOutlinerItem() {
    const selection = findSelectedOutlinerRow();
    if (!selection.row) {
      return {
        ok: false,
        reason: "no-selected-outliner-row",
        selectionSnapshot: selection.candidates.slice(0, 4).map((candidate) => ({
          rowText: candidate.rowText,
          score: candidate.score,
          reasons: candidate.reasons,
        })),
      };
    }

    const rowText = getRowText(selection.row);
    const targetInfo = findFolderIconTarget(selection.row);
    const dispatchResult = dispatchSyntheticDoubleClick(targetInfo.target);

    state.lastResolvedRowText = rowText;
    state.lastTargetSummary = dispatchResult.targetSummary || summarizeElement(targetInfo.target);

    return {
      ...dispatchResult,
      rowText,
      targetReason: targetInfo.reason,
      targetCandidates: targetInfo.candidates || [],
      chosenRow: selection.chosen
        ? {
            rowText: selection.chosen.rowText,
            score: selection.chosen.score,
            reasons: selection.chosen.reasons,
          }
        : null,
    };
  }

  async function deleteEmptyGroupsFromOutlinerMenu() {
    const selection = findSelectedOutlinerRow();
    if (!selection.row) {
      return {
        ok: false,
        reason: "no-selected-outliner-row",
        selectionSnapshot: selection.candidates.slice(0, 4).map((candidate) => ({
          rowText: candidate.rowText,
          score: candidate.score,
          reasons: candidate.reasons,
        })),
      };
    }

    const rowText = getRowText(selection.row);
    const overflow = findOutlinerOverflowButton();
    if (!overflow.button) {
      state.lastResolvedRowText = rowText;
      state.lastTargetSummary = null;
      return {
        ok: false,
        reason: overflow.reason,
        rowText,
        targetCandidates: overflow.candidates || [],
      };
    }

    const openResult = dispatchSyntheticClick(overflow.button);
    if (!openResult.ok) {
      state.lastResolvedRowText = rowText;
      state.lastTargetSummary = openResult.targetSummary || summarizeElement(overflow.button);
      return {
        ...openResult,
        rowText,
        targetReason: overflow.reason,
        targetCandidates: overflow.candidates || [],
      };
    }

    const menuItemResult = await waitForMenuItemByText("Delete empty groups");
    if (!menuItemResult.item) {
      state.lastResolvedRowText = rowText;
      state.lastTargetSummary = openResult.targetSummary || summarizeElement(overflow.button);
      return {
        ok: false,
        reason: menuItemResult.reason,
        rowText,
        menuCandidates: menuItemResult.candidates || [],
        targetReason: overflow.reason,
        targetCandidates: overflow.candidates || [],
      };
    }

    const clickResult = dispatchSyntheticClick(menuItemResult.item);
    state.lastResolvedRowText = rowText;
    state.lastTargetSummary = clickResult.targetSummary || menuItemResult.itemSummary || summarizeElement(menuItemResult.item);

    return {
      ...clickResult,
      rowText,
      menuReason: menuItemResult.reason,
      menuItemText: trimText(menuItemResult.item.textContent, 120),
      targetReason: overflow.reason,
      targetCandidates: overflow.candidates || [],
    };
  }

  async function runCustomCommand(commandId) {
    switch (commandId) {
      case "custom:outliner:activate-selected":
      case "custom:assets:set-active-folder":
        return activateSelectedOutlinerItem();
      case "custom:outliner:delete-empty-groups":
        return deleteEmptyGroupsFromOutlinerMenu();
      default:
        return { ok: false, reason: "unknown-command", commandId };
    }
  }

  function onPointerDown(event) {
    const row = findClosestOutlinerRow(event.target);
    window.__plasticityHotkeysLastOutlinerRow = row || null;
    state.lastPointerRowText = getRowText(row);
    pushLog("pointerdown", {
      rowText: state.lastPointerRowText,
      target: summarizeElement(event.target),
    });
  }

  function findBindingsForChord(chord) {
    return Object.entries(window.__plasticityHotkeysConfig || {})
      .map(([selector, bindings]) => ({
        selector,
        commandId: bindings[chord],
      }))
      .filter((item) => item.commandId);
  }

  async function onKeyDown(event) {
    const chord = normalizeChord(event);
    if (!chord) {
      return;
    }

    const bindings = findBindingsForChord(chord);
    const shouldTrace = chord === "enter" || bindings.length > 0;

    if (shouldTrace) {
      pushLog("keydown", {
        chord,
        defaultPrevented: event.defaultPrevented,
        isComposing: event.isComposing,
        target: summarizeElement(event.target),
        activeElement: summarizeElement(document.activeElement),
      });
    }

    if (event.defaultPrevented || event.isComposing || isEditableTarget(event.target)) {
      if (shouldTrace) {
        const reason = event.defaultPrevented
          ? "default-prevented"
          : event.isComposing
            ? "is-composing"
            : "editable-target";
        state.lastError = reason;
        state.lastEvent = { chord, skipped: reason, at: nowIso() };
        showToast(`${chord} 已捕获，但被跳过: ${reason}`, "error");
        pushLog("keydown-skipped", { chord, reason });
      }
      return;
    }

    if (bindings.length === 0) {
      return;
    }

    const selectorChecks = bindings.map((binding) => ({
      ...binding,
      match: selectorMatchesDetailed(binding.selector, event),
    }));

    const matched = selectorChecks.find((item) => item.match.matched);
    state.lastSelectorDecision = selectorChecks
      .map((item) => `${item.selector} => ${item.match.reason}`)
      .join(" | ");

    if (!matched) {
      state.lastError = "selector-not-matched";
      state.lastEvent = {
        chord,
        selectorChecks: selectorChecks.map((item) => ({
          selector: item.selector,
          reason: item.match.reason,
        })),
        at: nowIso(),
      };
      showToast(`${chord} 已捕获，但上下文未命中: ${state.lastSelectorDecision}`, "error");
      pushLog("selector-miss", state.lastEvent);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const result = await runCustomCommand(matched.commandId);
    state.lastCommand = matched.commandId;
    state.lastResult = result;
    state.lastError = result && result.ok ? null : result?.reason || "unknown-error";
    state.lastEvent = {
      chord,
      selector: matched.selector,
      selectorReason: matched.match.reason,
      at: nowIso(),
    };

    pushLog("command", {
      commandId: matched.commandId,
      selector: matched.selector,
      selectorReason: matched.match.reason,
      result,
    });

    if (result && result.ok) {
      showToast(`${chord} -> ${matched.commandId} -> ${result.rowText || "-"}`, "success");
      return;
    }

    showToast(`${chord} 已命中 ${matched.commandId}，但失败: ${result?.reason || "unknown-error"}`, "error");
  }

  function reloadConfig(nextConfig) {
    window.__plasticityHotkeysConfig = nextConfig || {};
    state.debugVisible = window.__plasticityHotkeysConfig?.__meta?.debugOverlay === true;
    state.lastEvent = {
      type: "reload-config",
      at: nowIso(),
    };
    pushLog("reload-config", { config: window.__plasticityHotkeysConfig });
  }

  function status() {
    return {
      version: VERSION,
      installedAt: state.installedAt,
      config: window.__plasticityHotkeysConfig,
      state: { ...state },
    };
  }

  function simulateEnter() {
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    return status();
  }

  function simulateChord(key, modifiers = {}) {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ctrlKey: Boolean(modifiers.ctrlKey),
      altKey: Boolean(modifiers.altKey),
      shiftKey: Boolean(modifiers.shiftKey),
      metaKey: Boolean(modifiers.metaKey),
    });
    document.dispatchEvent(event);
    return status();
  }

  function toggleDebugUi(force) {
    state.debugVisible = typeof force === "boolean" ? force : !state.debugVisible;
    renderDebugUi();
    return state.debugVisible;
  }

  reloadConfig(runtimeConfig);

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);

  window.__plasticityHotkeys = {
    version: VERSION,
    installed: true,
    reloadConfig,
    status,
    simulateEnter,
    simulateChord,
    toggleDebugUi,
    activateSelectedOutlinerItem,
    deleteEmptyGroupsFromOutlinerMenu,
  };

  renderDebugUi();
  if (state.debugVisible) {
    showToast("[plasticity-hotkeys] debug enabled", "info");
  }
  console.info("[plasticity-hotkeys] installed", VERSION);
})();
