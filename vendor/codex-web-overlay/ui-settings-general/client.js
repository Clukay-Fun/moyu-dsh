window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-settings-general",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
		//#endregion
		let _deepseek_ai_dsh_client_ui_slots = require("@deepseek-ai/dsh-client-ui-slots");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		//#region ../../../node_modules/.pnpm/use-sync-external-store@1.2.0_react@18.3.1/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.production.min.js
		/**
		* @license React
		* use-sync-external-store-shim.production.min.js
		*
		* Copyright (c) Facebook, Inc. and its affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*/
		var require_use_sync_external_store_shim_production_min = /* @__PURE__ */ __commonJSMin(((exports) => {
			var e = require("react");
			function h(a, b) {
				return a === b && (0 !== a || 1 / a === 1 / b) || a !== a && b !== b;
			}
			var k = "function" === typeof Object.is ? Object.is : h, l = e.useState, m = e.useEffect, n = e.useLayoutEffect, p = e.useDebugValue;
			function q(a, b) {
				var d = b(), f = l({ inst: {
					value: d,
					getSnapshot: b
				} }), c = f[0].inst, g = f[1];
				n(function() {
					c.value = d;
					c.getSnapshot = b;
					r(c) && g({ inst: c });
				}, [
					a,
					d,
					b
				]);
				m(function() {
					r(c) && g({ inst: c });
					return a(function() {
						r(c) && g({ inst: c });
					});
				}, [a]);
				p(d);
				return d;
			}
			function r(a) {
				var b = a.getSnapshot;
				a = a.value;
				try {
					var d = b();
					return !k(a, d);
				} catch (f) {
					return !0;
				}
			}
			function t(a, b) {
				return b();
			}
			var u = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? t : q;
			exports.useSyncExternalStore = void 0 !== e.useSyncExternalStore ? e.useSyncExternalStore : u;
		}));
		//#endregion
		//#region ../../../node_modules/.pnpm/use-sync-external-store@1.2.0_react@18.3.1/node_modules/use-sync-external-store/shim/index.js
		var require_shim = /* @__PURE__ */ __commonJSMin(((exports, module) => {
			module.exports = require_use_sync_external_store_shim_production_min();
		}));
		//#endregion
		//#region ../../../node_modules/.pnpm/use-sync-external-store@1.2.0_react@18.3.1/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.min.js
		/**
		* @license React
		* use-sync-external-store-shim/with-selector.production.min.js
		*
		* Copyright (c) Facebook, Inc. and its affiliates.
		*
		* This source code is licensed under the MIT license found in the
		* LICENSE file in the root directory of this source tree.
		*/
		var require_with_selector_production_min = /* @__PURE__ */ __commonJSMin(((exports) => {
			var h = require("react"), n = require_shim();
			function p(a, b) {
				return a === b && (0 !== a || 1 / a === 1 / b) || a !== a && b !== b;
			}
			var q = "function" === typeof Object.is ? Object.is : p, r = n.useSyncExternalStore, t = h.useRef, u = h.useEffect, v = h.useMemo, w = h.useDebugValue;
			exports.useSyncExternalStoreWithSelector = function(a, b, e, l, g) {
				var c = t(null);
				if (null === c.current) {
					var f = {
						hasValue: !1,
						value: null
					};
					c.current = f;
				} else f = c.current;
				c = v(function() {
					function a(a) {
						if (!c) {
							c = !0;
							d = a;
							a = l(a);
							if (void 0 !== g && f.hasValue) {
								var b = f.value;
								if (g(b, a)) return k = b;
							}
							return k = a;
						}
						b = k;
						if (q(d, a)) return b;
						var e = l(a);
						if (void 0 !== g && g(b, e)) return b;
						d = a;
						return k = e;
					}
					var c = !1, d, k, m = void 0 === e ? null : e;
					return [function() {
						return a(b());
					}, null === m ? void 0 : function() {
						return a(m());
					}];
				}, [
					b,
					e,
					l,
					g
				]);
				var d = r(a, c[0], c[1]);
				u(function() {
					f.hasValue = !0;
					f.value = d;
				}, [d]);
				w(d);
				return d;
			};
		}));
		//#endregion
		//#region lib/types/client/snapshot-bind.js
		var import_with_selector = (/* @__PURE__ */ __commonJSMin(((exports, module) => {
			module.exports = require_with_selector_production_min();
		})))();
		function bindSnapshotSelector(w) {
			const subscribe = (fn) => w.subscribe(fn);
			const getSnapshot = () => w.getSnapshot();
			return function useSelector(sel, eq) {
				return (0, import_with_selector.useSyncExternalStoreWithSelector)(subscribe, getSnapshot, void 0, sel, eq);
			};
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region \0dsh-css:/Users/clukay/Program/deepseek-harness/packages/client/ui-settings-general/src/client/SettingsRoot.module.css.mjs
		const css$3 = ".FGywRq_trigger{box-sizing:border-box;cursor:pointer;width:calc(100% + 8px);height:34px;color:var(--dsw-alias-label-primary);background:0 0;border:none;border-radius:12px;flex:none;align-items:center;gap:8px;margin:4px -4px;padding:6px 2px 6px 10px;font-family:inherit;font-size:14px;line-height:22px;display:flex;overflow:hidden}.FGywRq_trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}.FGywRq_trigger.FGywRq_rail{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;margin:8px 0 10px;padding:0}.FGywRq_triggerLabel{white-space:nowrap;overflow:hidden}.FGywRq_overlay{z-index:1000;justify-content:center;align-items:center;padding:24px;display:flex;position:fixed;inset:0}.FGywRq_mask{background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur);position:absolute;inset:0}.FGywRq_panel{z-index:1;background:var(--dsw-alias-bg-layer-2);width:66.6667vw;max-width:calc(100vw - 48px);height:min(760px,100vh - 48px);box-shadow:var(--dsw-shadow-lv3);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:18px;display:flex;position:relative;overflow:hidden}.FGywRq_nav{box-sizing:border-box;flex-direction:column;flex:none;gap:18px;width:224px;padding:24px 14px 0;display:flex}.FGywRq_navTitle{color:var(--dsw-alias-label-primary);padding:0 12px;font-size:16px;font-weight:500;line-height:24px}.FGywRq_navList{flex-direction:column;gap:4px;display:flex}.FGywRq_navCell{box-sizing:border-box;cursor:pointer;height:38px;color:var(--dsw-alias-label-primary);text-align:left;background:0 0;border:none;border-radius:9px;align-items:center;gap:8px;padding:9px 16px 9px 12px;font-family:inherit;font-size:14px;font-weight:400;line-height:22px;display:flex}.FGywRq_navCell:hover{background:var(--dsw-specific-sidebar-nav-item-hover)}.FGywRq_navCell.FGywRq_active{background:var(--dsw-specific-sidebar-nav-item-active)}.FGywRq_navIcon{flex:none}.FGywRq_navLabel{white-space:nowrap;text-overflow:ellipsis;flex:1;min-width:0;overflow:hidden}.FGywRq_content{flex-direction:column;flex:1;min-width:0;display:flex}.FGywRq_header{box-sizing:border-box;flex:none;justify-content:space-between;align-items:flex-start;gap:8px;height:54px;padding:20px 14px 8px 10px;display:flex}.FGywRq_actions{justify-content:flex-end;align-items:center;gap:8px;min-width:0;margin-left:auto;display:flex}.FGywRq_close{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-primary);background:0 0;border:none;border-radius:28px;justify-content:center;align-items:center;padding:0;display:inline-flex}.FGywRq_close:hover{background:var(--dsw-alias-interactive-bg-hover)}.FGywRq_options{flex:1;min-height:0;padding:0 24px 24px;overflow-y:auto}.FGywRq_hiddenLabel{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}@media (width<=960px){.FGywRq_panel{width:calc(100vw - 48px)}}@media (width<=720px){.FGywRq_overlay{padding:0}.FGywRq_panel{border-radius:0;width:100vw;max-width:none;height:100vh}.FGywRq_nav{width:176px;padding-inline:8px}.FGywRq_navCell{padding-inline:8px}}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-settings-general/SettingsRoot.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-general";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var SettingsRoot_module_css_default = {
			"actions": "FGywRq_actions",
			"active": "FGywRq_active",
			"close": "FGywRq_close",
			"content": "FGywRq_content",
			"header": "FGywRq_header",
			"hiddenLabel": "FGywRq_hiddenLabel",
			"mask": "FGywRq_mask",
			"nav": "FGywRq_nav",
			"navCell": "FGywRq_navCell",
			"navIcon": "FGywRq_navIcon",
			"navLabel": "FGywRq_navLabel",
			"navList": "FGywRq_navList",
			"navTitle": "FGywRq_navTitle",
			"options": "FGywRq_options",
			"overlay": "FGywRq_overlay",
			"panel": "FGywRq_panel",
			"rail": "FGywRq_rail",
			"trigger": "FGywRq_trigger",
			"triggerLabel": "FGywRq_triggerLabel"
		};
		//#endregion
		//#region lib/types/client/SettingsRoot.js
		/**
		* Settings shell root: the sidebar-foot trigger row plus the centered modal
		* panel (figma 501:29947, 1080x700) with the section nav rail. The shell is
		* a pure composition face — every piece of text (trigger label, panel title,
		* close label, sections) arrives from registrants through slots; accessible
		* names resolve to that content (trigger: its own text; dialog:
		* aria-labelledby the title node; close: visually-hidden slot text). Modal
		* open state and the active section id are component-local viewing state;
		* the onboarding coordinator mounts exactly one ordered registrant while the
		* sessions-derived empty-Hero fact is active. Visible dialog chrome belongs
		* to the step, so a mounted-but-deciding step paints nothing here.
		*/
		/** Nav glyph by section id; unknown ids fall back to the settings gear. */
		function navIcon(id) {
			if (id === "models") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutline16, {
				className: SettingsRoot_module_css_default.navIcon,
				size: 16
			});
			if (id === "agent-presets") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutline16, {
				className: SettingsRoot_module_css_default.navIcon,
				size: 16
			});
			if (id === "plugins") return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPersonalizationOutline16, {
				className: SettingsRoot_module_css_default.navIcon,
				size: 16
			});
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutline16, {
				className: SettingsRoot_module_css_default.navIcon,
				size: 16
			});
		}
		/**
		* The modal layer: full-viewport mask + centered panel. Close paths: the
		* header button, a mask click, and document-level Escape (mounted only while
		* open, so the listener lifetime is the panel's).
		*/
		function SettingsPanel({ rows, renderSlot, activeId, onSelect, onClose }) {
			const active = rows.find((r) => r.id === activeId)?.id ?? rows[0]?.id;
			const titleId = (0, react.useId)();
			(0, react.useEffect)(() => {
				const onKeyDown = (e) => {
					if (e.key === "Escape") onClose();
				};
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [onClose]);
			const closeButton = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				closeButton.current?.focus();
			}, []);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: SettingsRoot_module_css_default.overlay,
				role: "presentation",
				children: [(0, react_jsx_runtime.jsx)("div", {
					className: SettingsRoot_module_css_default.mask,
					"aria-hidden": "true",
					onClick: onClose
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: SettingsRoot_module_css_default.panel,
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": titleId,
					children: [(0, react_jsx_runtime.jsxs)("nav", {
						className: SettingsRoot_module_css_default.nav,
						children: [(0, react_jsx_runtime.jsx)("div", {
							className: SettingsRoot_module_css_default.navTitle,
							id: titleId,
							children: renderSlot("settings.header", {})
						}), (0, react_jsx_runtime.jsx)("div", {
							className: SettingsRoot_module_css_default.navList,
							children: rows.map((row) => (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: clsx(SettingsRoot_module_css_default.navCell, row.id === active && SettingsRoot_module_css_default.active),
								"aria-current": row.id === active ? "true" : void 0,
								onClick: () => {
									onSelect(row.id);
								},
								children: [navIcon(row.id), (0, react_jsx_runtime.jsx)("span", {
									className: SettingsRoot_module_css_default.navLabel,
									children: row.label
								})]
							}, row.id))
						})]
					}), (0, react_jsx_runtime.jsxs)("div", {
						className: SettingsRoot_module_css_default.content,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: SettingsRoot_module_css_default.header,
							children: [(0, react_jsx_runtime.jsx)("div", {
								className: SettingsRoot_module_css_default.actions,
								children: renderSlot("settings.action", {})
							}), (0, react_jsx_runtime.jsxs)("button", {
								ref: closeButton,
								type: "button",
								className: SettingsRoot_module_css_default.close,
								onClick: onClose,
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 14 }), (0, react_jsx_runtime.jsx)("span", {
									className: SettingsRoot_module_css_default.hiddenLabel,
									children: renderSlot("settings.close", {})
								})]
							})]
						}), (0, react_jsx_runtime.jsx)("div", {
							className: SettingsRoot_module_css_default.options,
							children: active !== void 0 && renderSlot("settings.section", { close: onClose }, { only: active })
						})]
					})]
				})]
			});
		}
		/**
		* Render the settings trigger and panel.
		* @param props - composed slot props (contract/slots.ts).
		* @returns the settings shell element tree.
		*/
		function SettingsRoot(props) {
			const { wide, useSections, useOnboardingSteps, useOpenRequest, clearOpenRequest, useSessions, renderSlot } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const [activeId, setActiveId] = (0, react.useState)(void 0);
			const [completedOnboarding, setCompletedOnboarding] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const close = (0, react.useCallback)(() => {
				setOpen(false);
				setActiveId(void 0);
			}, []);
			const openSection = (0, react.useCallback)((id) => {
				setActiveId(id);
				setOpen(true);
			}, []);
			const rows = useSections((s) => s);
			const onboardingSteps = useOnboardingSteps((s) => s);
			const openRequest = useOpenRequest((s) => s);
			const onboardingActive = useSessions((state) => state.phase === "ready" && (state.current === void 0 || state.byId[state.current]?.blank === true));
			const onboardingStep = onboardingActive ? onboardingSteps.find((step) => !completedOnboarding.has(step.id)) : void 0;
			(0, react.useEffect)(() => {
				if (openRequest === null) return;
				setActiveId(openRequest.sectionId);
				setOpen(true);
				clearOpenRequest(openRequest.id);
			}, [clearOpenRequest, openRequest]);
			(0, react.useEffect)(() => {
				if (onboardingActive) return;
				setCompletedOnboarding(/* @__PURE__ */ new Set());
			}, [onboardingActive]);
			const completeOnboardingStep = (0, react.useCallback)((id) => {
				setCompletedOnboarding((previous) => {
					if (previous.has(id)) return previous;
					return new Set([...previous, id]);
				});
			}, []);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: clsx(SettingsRoot_module_css_default.trigger, !wide && SettingsRoot_module_css_default.rail),
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					onClick: () => {
						setOpen(true);
					},
					children: renderSlot("settings.trigger", { wide })
				}),
				open && (0, react_jsx_runtime.jsx)(SettingsPanel, {
					rows,
					renderSlot,
					activeId,
					onSelect: setActiveId,
					onClose: close
				}),
				onboardingStep !== void 0 && renderSlot("settings.onboarding", {
					stepId: onboardingStep.id,
					complete: () => {
						completeOnboardingStep(onboardingStep.id);
					},
					openSection
				}, { only: onboardingStep.id })
			] });
		}
		//#endregion
		//#region \0dsh-css:/Users/clukay/Program/deepseek-harness/packages/client/ui-settings-general/src/client/chrome.module.css.mjs
		const css$2 = ".LOSoJW_triggerLabel{white-space:nowrap;overflow:hidden}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-settings-general/chrome.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-general";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var chrome_module_css_default = { "triggerLabel": "LOSoJW_triggerLabel" };
		//#endregion
		//#region lib/types/client/chrome.js
		/**
		* Shell chrome content registered into the shell's trigger/header seats: the
		* trigger row icon + label (figma sidebar foot) and the panel title text.
		* The shell renders the surrounding chrome (button, nav heading row) and
		* reads each entry's `label` option for aria text.
		*/
		/**
		* Render the trigger row content (icon; label only in the wide column).
		* @param props - composed slot props.
		* @returns the trigger content fragment.
		*/
		function TriggerContent({ wide, t }) {
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [wide ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutline16, { size: 16 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSettingsOutline14, { size: 18 }), wide && (0, react_jsx_runtime.jsx)("span", {
				className: chrome_module_css_default.triggerLabel,
				children: t("trigger")
			})] });
		}
		/**
		* Render the panel title text.
		* @param props - composed slot props.
		* @returns the title text node.
		*/
		function HeaderContent({ t }) {
			return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: t("title") });
		}
		/**
		* Render the close button's visually-hidden label text.
		* @param props - composed slot props.
		* @returns the label text node.
		*/
		function CloseLabel({ t }) {
			return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: t("close") });
		}
		//#endregion
		//#region \0dsh-css:/Users/clukay/Program/deepseek-harness/packages/client/ui-settings-general/src/client/GeneralSection.module.css.mjs
		const css$1 = ".TVUgQW_section{flex-direction:column;width:100%;display:flex}.TVUgQW_section>[data-slot=\"settings.general.item\"]>:last-child{border-bottom:none}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-settings-general/GeneralSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-general";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var GeneralSection_module_css_default = { "section": "TVUgQW_section" };
		//#endregion
		//#region lib/types/client/GeneralSection.js
		/**
		* Render the General section content column.
		* @param props - composed slot props (contract/slots.ts).
		* @returns the section element tree.
		*/
			function GeneralSection({ renderSlot }) {
		const MOYU_ICON_SRC = "data:image/png;base64,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";
		const moyuAbout = (0, react_jsx_runtime.jsx)("div", {
			style: { marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--dsw-alias-border, #e5e7eb)" },
			children: [
				(0, react_jsx_runtime.jsx)("div", {
					style: { display: "flex", alignItems: "center", gap: 10 },
					children: [
						(0, react_jsx_runtime.jsx)("img", { src: MOYU_ICON_SRC, width: 28, height: 28, alt: "MOYU DSH", style: { borderRadius: 6 } }),
						(0, react_jsx_runtime.jsx)("span", { style: { fontWeight: 600, fontSize: 16, letterSpacing: "0.04em" }, children: "MOYU DSH" })
					]
				}),
				(0, react_jsx_runtime.jsx)("p", {
					style: { marginTop: 8, marginBottom: 0, fontSize: 13, lineHeight: 1.6, opacity: 0.72, maxWidth: 520 },
					children: "MOYU DSH 是一款基于 DeepSeek Harness 的原生桌面工作台。"
				})
			]
		});
		return (0, react_jsx_runtime.jsx)("div", {
			className: GeneralSection_module_css_default.section,
			children: [renderSlot("settings.general.item", {}), moyuAbout]
		});
	}
		//#endregion
		//#region \0dsh-css:/Users/clukay/Program/deepseek-harness/packages/client/ui-settings-general/src/client/SettingsDocumentAction.module.css.mjs
		const css = ".CkEfuq_action{align-items:center;gap:8px;min-width:0;display:flex}.CkEfuq_error{max-width:180px;color:var(--dsw-alias-state-error-primary);text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;overflow:hidden}";
		const tagId = "@deepseek-ai/dsh-client-ui-settings-general/SettingsDocumentAction.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-general";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SettingsDocumentAction_module_css_default = {
			"action": "CkEfuq_action",
			"error": "CkEfuq_error"
		};
		//#endregion
		//#region lib/types/client/SettingsDocumentAction.js
		/** Optional settings-header action for opening a file-backed Host document. */
		/**
		* Render the open-document action only after Host metadata confirms document availability.
		* @param props - header owner props, localized copy, and injected document state.
		* @returns the action, or null while unavailable or unresolved.
		*/
		function SettingsDocumentAction({ controller, useSnapshot, t }) {
			const state = useSnapshot((snapshot) => snapshot);
			(0, react.useEffect)(() => {
				controller.load();
			}, [controller]);
			if (state.status !== "ready") return null;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: SettingsDocumentAction_module_css_default.action,
				children: [state.error === null ? null : (0, react_jsx_runtime.jsx)("span", {
					className: SettingsDocumentAction_module_css_default.error,
					role: "alert",
					children: t("openDocument.error")
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					size: "sm",
					disabled: state.opening,
					onClick: () => {
						controller.open();
					},
					children: t("openDocument")
				})]
			});
		}
		//#endregion
		//#region lib/types/client/settings-document-store.js
		/** State owner for the optional local settings-document action. */
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/** Derives local-document availability from the shared mirror and invokes the pathless Host-owned open operation. */
		var SettingsDocumentStore = class {
			api;
			describeFace;
			/** uSES-safe state source shared by the registered header action. */
			store = (0, _deepseek_ai_dsh_client_runtime_client.createSnapshotStore)({
				status: "idle",
				opening: false,
				error: null
			});
			following;
			/**
			* @param api - loopback settings wire face that opens the provider document.
			* @param describeFace - the shared mirror's describe face (`hasDocument` source).
			*/
			constructor(api, describeFace) {
				this.api = api;
				this.describeFace = describeFace;
			}
			/**
			* Begin following the mirror (idempotent) and reflect whether the current
			* provider owns a local document.
			* @returns settlement once the snapshot reflects the mirror.
			*/
			async load() {
				this.following ??= this.describeFace.subscribe(() => {
					this.derive();
				});
				this.store.update((state) => {
					state.status = "loading";
					state.error = null;
				});
				await this.describeFace.ensure();
				this.derive();
			}
			/**
			* Open the loaded document once; concurrent gestures collapse behind the in-flight action.
			* @returns after the native-open request settles, or immediately when unavailable/already opening.
			*/
			async open() {
				const current = this.store.getSnapshot();
				if (current.status !== "ready" || current.opening) return;
				this.store.update((state) => {
					state.opening = true;
					state.error = null;
				});
				try {
					const response = await this.api.settings.openDocument({});
					if (!response.result.ok) throw new Error(response.result.error.message);
				} catch (error) {
					this.store.update((state) => {
						state.error = messageOf(error);
					});
				} finally {
					this.store.update((state) => {
						state.opening = false;
					});
				}
			}
			/** Stop following the mirror. */
			dispose() {
				this.following?.();
				this.following = void 0;
			}
			derive() {
				const mirrored = this.describeFace.getSnapshot();
				if (mirrored.view === void 0) {
					if (mirrored.error !== null) this.store.update((state) => {
						state.status = "unavailable";
						state.error = mirrored.error;
					});
					return;
				}
				const { hasDocument } = mirrored.view;
				this.store.update((state) => {
					state.status = hasDocument ? "ready" : "unavailable";
					state.error = null;
				});
			}
		};
		/** Re-derive the mirror-derived state after a connection reset; no-op when unavailable. */
		function refreshDocumentIfLoaded(controller) {
			controller?.load().catch(() => {});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Shell chrome and General-nav dictionaries; feature rows own their copy. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"trigger": "设置",
			"title": "设置",
			"close": "关闭",
			"openDocument": "打开配置文件",
			"openDocument.error": "无法打开配置文件",
			"general.nav": "通用设置"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"trigger": "Settings",
			"title": "Settings",
			"close": "Close",
			"openDocument": "Open configuration file",
			"openDocument.error": "Could not open configuration file",
			"general.nav": "General"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin (shell chrome + General copy). */
		const NS = "settings";
		/**
		* Required services (cordis fiber inject). The target slots are declared by
		* ui-settings' apply, whose activation order relative to this one is NOT
		* constrained; registrations depend on their slots through `slots.inject()`.
		*/
		const inject = [
			"slots",
			"locale",
			"connection",
			"settingsNavigation"
		];
		/**
		* Register the `settings` dictionaries, the chrome content, and the General
		* section, each once its slot declaration is on the ledger.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-settings-general: dictionaries");
			const t = ctx.locale.bind(NS);
			const settings = ctx.settingsNavigation;
			const connection = ctx.get("connection");
			const documentController = connection.isLoopback ? new SettingsDocumentStore(connection.api) : void 0;
			const documentInjected = documentController === void 0 ? void 0 : (() => {
				const useSnapshot = bindSnapshotSelector(documentController.store);
				return () => ({
					controller: documentController,
					useSnapshot
				});
			})();
			ctx.effect(() => ctx.on("connection/reset", () => {
				refreshDocumentIfLoaded(documentController);
			}), "ui-settings-general: metadata invalidations");
			let rowsVersion = -1;
			let rowsRevision = -1;
			let rows = [];
			let onboardingVersion = -1;
			let onboardingSteps = [];
			const shellInjected = () => ({
				hooks: {
					sections: {
						getSnapshot: () => {
							const version = ctx.slots.getVersion("settings.section");
							const revision = ctx.locale.getSnapshot().revision;
							if (version !== rowsVersion || revision !== rowsRevision) {
								rowsVersion = version;
								rowsRevision = revision;
								rows = ctx.slots.entries("settings.section").map((e) => ({
									/* v8 ignore next -- list-slot registration requires id (SlotCore rejects an entry without one) */
									id: e.options.id ?? "",
									order: e.options.order ?? 0,
									label: (0, _deepseek_ai_dsh_client_ui_slots.resolveSlotLabel)(e.options.label) ?? ""
								})).sort((a, b) => a.order - b.order);
							}
							return rows;
						},
						subscribe: (listener) => {
							const offLedger = ctx.slots.subscribe("settings.section", listener);
							const offLocale = ctx.locale.subscribe(listener);
							return () => {
								offLedger();
								offLocale();
							};
						}
					},
					onboardingSteps: {
						getSnapshot: () => {
							const version = ctx.slots.getVersion("settings.onboarding");
							if (version !== onboardingVersion) {
								onboardingVersion = version;
								onboardingSteps = ctx.slots.entries("settings.onboarding").map((e) => ({
									/* v8 ignore next -- list-slot registration requires id */
									id: e.options.id ?? "",
									order: e.options.order ?? 0
								})).sort((a, b) => a.order - b.order);
							}
							return onboardingSteps;
						},
						subscribe: (listener) => ctx.slots.subscribe("settings.onboarding", listener)
					},
					openRequest: settings
				},
				clearOpenRequest: (id) => {
					settings.clear(id);
				}
			});
			ctx.slots.inject("sidebar.settings", () => ctx.slots.register({
				name: "sidebar.settings",
				children: {
					"settings.trigger": {
						kind: "single",
						scope: "root"
					},
					"settings.header": {
						kind: "single",
						scope: "root"
					},
					"settings.action": {
						kind: "list",
						scope: "root"
					},
					"settings.close": {
						kind: "single",
						scope: "root"
					},
					"settings.section": {
						kind: "list",
						scope: "root"
					},
					"settings.onboarding": {
						kind: "list",
						scope: "root"
					}
				},
				inject: shellInjected
			}, SettingsRoot));
			ctx.slots.inject("settings.trigger", () => ctx.slots.register({
				name: "settings.trigger",
				locale: NS
			}, TriggerContent));
			ctx.slots.inject("settings.header", () => ctx.slots.register({
				name: "settings.header",
				locale: NS
			}, HeaderContent));
			if (documentInjected !== void 0) ctx.slots.inject("settings.action", () => ctx.slots.register({
				name: "settings.action",
				id: "open-document",
				order: 0,
				locale: NS,
				inject: documentInjected
			}, SettingsDocumentAction));
			ctx.slots.inject("settings.close", () => ctx.slots.register({
				name: "settings.close",
				locale: NS
			}, CloseLabel));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "general",
				order: 0,
				label: () => t("general.nav"),
				locale: NS,
				children: { "settings.general.item": {
					kind: "list",
					scope: "root"
				} }
			}, GeneralSection));
		}
		//#endregion
		exports.SettingsDocumentStore = SettingsDocumentStore;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
