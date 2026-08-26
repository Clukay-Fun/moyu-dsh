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
		const css$3 = ".FGywRq_trigger{box-sizing:border-box;cursor:pointer;width:calc(100% + 8px);height:34px;color:var(--dsw-alias-label-primary);background:0 0;border:none;border-radius:12px;flex:none;align-items:center;gap:8px;margin:4px -4px;padding:6px 2px 6px 10px;font-family:inherit;font-size:14px;line-height:22px;display:flex;overflow:hidden}.FGywRq_trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}.FGywRq_trigger.FGywRq_rail{border-radius:50%;justify-content:center;gap:0;width:36px;height:36px;margin:8px 0 10px;padding:0}.FGywRq_triggerLabel{white-space:nowrap;overflow:hidden}.FGywRq_overlay{z-index:1000;justify-content:center;align-items:center;padding:24px;display:flex;position:fixed;inset:0}.FGywRq_mask{background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur);position:absolute;inset:0}.FGywRq_panel{z-index:1;background:var(--dsw-alias-bg-layer-2);width:min(1080px,100vw - 48px);max-width:calc(100vw - 48px);height:min(760px,100vh - 48px);box-shadow:var(--dsw-shadow-lv3);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:18px;display:flex;position:relative;overflow:hidden}.FGywRq_nav{box-sizing:border-box;flex-direction:column;flex:none;gap:18px;width:224px;padding:24px 14px 0;display:flex}.FGywRq_navTitle{color:var(--dsw-alias-label-primary);padding:0 12px;font-size:16px;font-weight:500;line-height:24px}.FGywRq_navList{flex-direction:column;gap:4px;display:flex}.FGywRq_navCell{box-sizing:border-box;cursor:pointer;height:38px;color:var(--dsw-alias-label-primary);text-align:left;background:0 0;border:none;border-radius:9px;align-items:center;gap:8px;padding:9px 16px 9px 12px;font-family:inherit;font-size:14px;font-weight:400;line-height:22px;display:flex}.FGywRq_navCell:hover{background:var(--dsw-specific-sidebar-nav-item-hover)}.FGywRq_navCell.FGywRq_active{background:var(--dsw-specific-sidebar-nav-item-active)}.FGywRq_navIcon{flex:none}.FGywRq_navLabel{white-space:nowrap;text-overflow:ellipsis;flex:1;min-width:0;overflow:hidden}.FGywRq_content{flex-direction:column;flex:1;min-width:0;display:flex}.FGywRq_header{box-sizing:border-box;flex:none;justify-content:space-between;align-items:flex-start;gap:8px;height:54px;padding:20px 14px 8px 10px;display:flex}.FGywRq_actions{justify-content:flex-end;align-items:center;gap:8px;min-width:0;margin-left:auto;display:flex}.FGywRq_close{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-primary);background:0 0;border:none;border-radius:28px;justify-content:center;align-items:center;padding:0;display:inline-flex}.FGywRq_close:hover{background:var(--dsw-alias-interactive-bg-hover)}.FGywRq_options{flex:1;min-height:0;padding:0 24px 24px;overflow-y:auto}.FGywRq_hiddenLabel{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}@media (width<=720px){.FGywRq_overlay{padding:0}.FGywRq_panel{border-radius:0;width:100vw;max-width:none;height:100vh}.FGywRq_nav{width:176px;padding-inline:8px}.FGywRq_navCell{padding-inline:8px}}";
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
						(0, react_jsx_runtime.jsx)("img", { src: MOYU_ICON_SRC, width: 28, height: 28, alt: "MOYU", style: { borderRadius: 6 } }),
						(0, react_jsx_runtime.jsx)("span", { style: { fontWeight: 600, fontSize: 16, letterSpacing: "0.04em" }, children: "MOYU" })
					]
				}),
				(0, react_jsx_runtime.jsx)("p", {
					style: { marginTop: 8, marginBottom: 0, fontSize: 13, lineHeight: 1.6, opacity: 0.72, maxWidth: 520 },
					children: "MOYU 是一款基于 DeepSeek Harness 开发的智能桌面工作台。"
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