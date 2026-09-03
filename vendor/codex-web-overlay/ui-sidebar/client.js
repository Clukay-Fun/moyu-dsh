window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-sidebar",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		// === MoyuIcon：Lucide 内联图标适配层 ===
		// 图标数据提取自 lucide-react@1.33.0（ISC License）dist/esm/icons 的 __iconNode，构建期手工内联。
		// 纯构建期内联：无任何 lucide 运行时 require。默认 16px / strokeWidth 1.75 / aria-hidden。
		const MOYU_LUCIDE = {"PanelLeftClose":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"M9 3v18"}],["path",{"d":"m16 15-3-3 3-3"}]],"PanelLeftOpen":[["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2"}],["path",{"d":"M9 3v18"}],["path",{"d":"m14 9 3 3-3 3"}]]};
		function MoyuLucideIcon(props) {
			const size = props.size || 16;
			return react_jsx_runtime.jsx("svg", {
				xmlns: "http://www.w3.org/2000/svg",
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: props.strokeWidth || 1.75,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				className: props.className,
				style: props.style,
				"aria-hidden": "true",
				focusable: "false",
				children: props.node.map((entry, index) => react_jsx_runtime.jsx(entry[0], entry[1], index))
			});
		}
		const moyuPanelLeftClose = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.PanelLeftClose }, props));
		const moyuPanelLeftOpen = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.PanelLeftOpen }, props));
		// === MOYU 统一品牌组件（替代 DSH 原生品牌标记）===
		const MOYU_ICON_SRC = "data:image/png;base64,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";
		const moyuReact = require("react");
		function MoyuIcon(props) {
			const s = (props && props.size) || 24;
			const [moyuErr, moyuSetErr] = moyuReact.useState(false);
			if (moyuErr) return react_jsx_runtime.jsx("span", { style: { fontWeight: 600, fontSize: Math.round(s * 0.7), lineHeight: 1, color: "inherit" }, children: "M" });
			return react_jsx_runtime.jsx("img", {
				src: MOYU_ICON_SRC, width: s, height: s, alt: "MOYU DSH",
				onError: () => moyuSetErr(true),
				style: { display: "block", objectFit: "contain" }
			});
		}
		function MoyuBrand(props) {
			const s = (props && props.size) || 20;
			return react_jsx_runtime.jsxs("span", {
				style: { display: "inline-flex", alignItems: "center", gap: 10 },
				children: [
					react_jsx_runtime.jsx(MoyuIcon, { size: s }),
					react_jsx_runtime.jsx("span", { style: { fontWeight: 600, letterSpacing: "0.04em", fontSize: Math.max(16, Math.round(s * 0.5)), lineHeight: 1 }, children: "MOYU DSH" })
				]
			});
		}

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
		//#region \0dsh-css:/Users/clukay/Program/deepseek-harness/packages/client/ui-sidebar/src/client/SidebarRoot.module.css.mjs
		const css = ".TQ0BVq_root{--dsh-sidebar-inline-padding:12px;height:100%;padding:6px var(--dsh-sidebar-inline-padding);box-sizing:border-box;background:var(--dsw-specific-sidebar-fill);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);flex-direction:column;font-size:14px;display:flex}.TQ0BVq_root.TQ0BVq_collapsed{padding:18px 10px 6px}.TQ0BVq_root.TQ0BVq_quietBars{--dsh-scrollbar-thumb:transparent;--dsh-scrollbar-thumb-hover:transparent}.TQ0BVq_fading>*{opacity:0;transition:opacity .15s var(--ds-ease-in-out)}.TQ0BVq_wide{animation:TQ0BVq_wide-in .2s var(--ds-ease-in-out)}@keyframes TQ0BVq_wide-in{0%{opacity:0}}.TQ0BVq_railIn .TQ0BVq_iconButton,.TQ0BVq_railIn .TQ0BVq_regionArea{animation:TQ0BVq_rail-in .15s var(--ds-ease-in-out) backwards}.TQ0BVq_railIn .TQ0BVq_footArea{animation:TQ0BVq_rail-fade-in .15s var(--ds-ease-in-out) backwards}@keyframes TQ0BVq_rail-in{0%{opacity:0;transform:translate(49px)}}@keyframes TQ0BVq_rail-fade-in{0%{opacity:0}}.TQ0BVq_logoRow{box-sizing:border-box;flex:none;justify-content:space-between;align-items:center;gap:8px;height:60px;margin-bottom:8px;padding:8px 0 8px 4px;display:flex;overflow:hidden}.TQ0BVq_collapsed .TQ0BVq_logoRow{justify-content:flex-start;height:36px;margin-bottom:12px;padding:0}.TQ0BVq_brand{min-width:0;color:inherit;cursor:pointer;background:0 0;border:none;flex:1;align-items:center;padding:0;display:inline-flex;overflow:hidden}.TQ0BVq_iconButton{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.TQ0BVq_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.TQ0BVq_collapsed .TQ0BVq_iconButton{width:36px;height:36px}.TQ0BVq_toggle .TQ0BVq_openIcon{display:none}.TQ0BVq_collapsed .TQ0BVq_toggle .TQ0BVq_panelIcon{display:none}.TQ0BVq_collapsed .TQ0BVq_toggle .TQ0BVq_openIcon{display:inline}.TQ0BVq_collapsed .TQ0BVq_toggle:hover .TQ0BVq_railFish{display:none}.TQ0BVq_collapsed .TQ0BVq_iconButton{color:var(--dsw-alias-label-primary)}.TQ0BVq_regionArea{min-height:0;margin-left:-4px;margin-right:calc(-1 * var(--dsh-sidebar-inline-padding));flex-direction:column;flex:1;padding-left:4px;display:flex;overflow:hidden}.TQ0BVq_collapsed .TQ0BVq_regionArea{margin-left:0;margin-right:0;padding-left:0}.TQ0BVq_footArea{flex-direction:column;flex:none;display:flex}.TQ0BVq_settingsArea,.TQ0BVq_footerActions{flex:none;width:100%;min-width:0}.TQ0BVq_footerActions{display:flex}.TQ0BVq_collapsed .TQ0BVq_footArea{align-items:center}.TQ0BVq_collapsed .TQ0BVq_settingsArea,.TQ0BVq_collapsed .TQ0BVq_footerActions{justify-content:center;width:auto;display:flex}@media (prefers-reduced-motion:reduce){.TQ0BVq_wide,.TQ0BVq_fading>*,.TQ0BVq_railIn .TQ0BVq_iconButton,.TQ0BVq_railIn .TQ0BVq_footArea,.TQ0BVq_railIn .TQ0BVq_regionArea{transition:none;animation:none}}";
		const tagId = "@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SidebarRoot_module_css_default = {
			"brand": "TQ0BVq_brand",
			"collapsed": "TQ0BVq_collapsed",
			"fading": "TQ0BVq_fading",
			"footArea": "TQ0BVq_footArea",
			"footerActions": "TQ0BVq_footerActions",
			"iconButton": "TQ0BVq_iconButton",
			"logoRow": "TQ0BVq_logoRow",
			"panelIcon": "TQ0BVq_panelIcon",
			"openIcon": "TQ0BVq_openIcon",
			"quietBars": "TQ0BVq_quietBars",
			"rail-fade-in": "TQ0BVq_rail-fade-in",
			"rail-in": "TQ0BVq_rail-in",
			"railFish": "TQ0BVq_railFish",
			"railIn": "TQ0BVq_railIn",
			"regionArea": "TQ0BVq_regionArea",
			"root": "TQ0BVq_root",
			"settingsArea": "TQ0BVq_settingsArea",
			"toggle": "TQ0BVq_toggle",
			"wide": "TQ0BVq_wide",
			"wide-in": "TQ0BVq_wide-in"
		};
		//#endregion
		//#region lib/types/client/SidebarRoot.js
		/**
		* Sidebar shell: column geometry only. Collapse is a slide plus crossfade:
		* content freezes at its expanded width (inline style) and fades out in place
		* while the sliding column (AppFrame grid tracks) clips it — nothing reflows
		* mid-slide. At settle the wide-only content unmounts and the four upper
		* controls enter the 56px rail from the same horizontal offset (one icon each,
		* same top-down order) on one fade that ends with the slide. The bottom-pinned
		* settings control only fades. The workspace/session browsing region between
		* the New Session button and the foot is the `sidebar.workspaces` registrant's,
		* and the foot holds `sidebar.settings` plus `sidebar.footer.action`; the shell
		* hands them the wide flag (plus an expand request callback for the browser).
		*
		* The column also owns whether the scroll regions nested in it draw a
		* scrollbar at all: the shell tracks the pointer and rebinds ui-theme's
		* scrollbar indirection away while it is elsewhere, so a list the user is not
		* pointing at carries no bar.
		*/
		/** Wide-content unmount delay; matches the 150ms wide-content fade-out. */
		const COLLAPSE_SETTLE_MS = 150;
		/**
		* How long the column's scrollbars stay drawn after the pointer leaves it.
		* The bar is a pointer affordance here, and hiding it on the leave event
		* itself makes it blink out while the pointer is only crossing the column's
		* edge — on the way to the conversation, or around a portalled menu.
		*/
		const SCROLLBAR_LINGER_MS = 2e3;
		/**
		* Render the sidebar column shell.
		* @param props - composed slot props (runtime share + injected callbacks, contract/slots.ts).
		* @returns the sidebar element tree.
		*/
		function SidebarRoot({ collapsed, width, surface, toggleSidebar, setSurface, t, renderSlot }) {
			const [settled, setSettled] = (0, react.useState)(collapsed);
			(0, react.useEffect)(() => {
				if (!collapsed) {
					setSettled(false);
					return;
				}
				const timer = window.setTimeout(() => {
					setSettled(true);
				}, COLLAPSE_SETTLE_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [collapsed]);
			const wide = !collapsed || !settled;
			const lastWideWidth = (0, react.useRef)(width);
			if (!collapsed) lastWideWidth.current = width;
			const everWide = (0, react.useRef)(!collapsed);
			if (!collapsed) everWide.current = true;
			const column = (0, react.useRef)(null);
			const [pointerInside, setPointerInside] = (0, react.useState)(false);
			const lingerTimer = (0, react.useRef)(void 0);
			const armLinger = () => {
				if (lingerTimer.current !== void 0) return;
				lingerTimer.current = window.setTimeout(() => {
					lingerTimer.current = void 0;
					setPointerInside(false);
				}, SCROLLBAR_LINGER_MS);
			};
			const cancelLinger = () => {
				window.clearTimeout(lingerTimer.current);
				lingerTimer.current = void 0;
			};
			(0, react.useEffect)(() => {
				if (!pointerInside) return;
				const onMove = (event) => {
					const rect = column.current?.getBoundingClientRect();
					/* v8 ignore next -- the listener only exists while the column is mounted and revealed. */
					if (rect === void 0) return;
					if (event.clientX >= rect.left && event.clientX < rect.right && event.clientY >= rect.top && event.clientY < rect.bottom) cancelLinger();
					else armLinger();
				};
				document.addEventListener("pointermove", onMove);
				return () => {
					document.removeEventListener("pointermove", onMove);
					cancelLinger();
				};
			}, [pointerInside]);
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: column,
				className: clsx(SidebarRoot_module_css_default.root, !wide && SidebarRoot_module_css_default.collapsed, !wide && everWide.current && SidebarRoot_module_css_default.railIn, collapsed && wide && SidebarRoot_module_css_default.fading, !pointerInside && SidebarRoot_module_css_default.quietBars),
				style: wide ? { width: collapsed ? lastWideWidth.current : width } : void 0,
				onPointerEnter: () => {
					cancelLinger();
					setPointerInside(true);
				},
				onPointerLeave: () => {
					armLinger();
				},
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: SidebarRoot_module_css_default.logoRow,
						children: [!collapsed && (0, react_jsx_runtime.jsx)("span", { style: { fontWeight: 600, letterSpacing: "0.04em", fontSize: 18, lineHeight: 1, color: "inherit" }, children: "MOYU DSH" }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: collapsed ? t("toggle.open") : t("toggle.collapse"),
							delayMs: 500,
							children: (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: clsx(SidebarRoot_module_css_default.iconButton, SidebarRoot_module_css_default.toggle),
								"aria-label": collapsed ? t("toggle.open") : t("toggle.collapse"),
								onClick: () => {
									toggleSidebar();
								},
								children: [(0, react_jsx_runtime.jsx)(moyuPanelLeftClose, {
									className: SidebarRoot_module_css_default.panelIcon,
									size: wide ? 16 : 18
								}), (0, react_jsx_runtime.jsx)(moyuPanelLeftOpen, {
									className: SidebarRoot_module_css_default.openIcon,
									size: wide ? 16 : 18
								})]
							})
						})]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: SidebarRoot_module_css_default.regionArea,
						children: renderSlot("sidebar.workspaces", {
							wide,
							surface,
							expandSidebar: () => {
								if (collapsed) toggleSidebar();
							},
							selectSurface: setSurface
						})
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: SidebarRoot_module_css_default.footArea,
						children: [(0, react_jsx_runtime.jsx)("div", {
							className: SidebarRoot_module_css_default.footerActions,
							children: renderSlot("sidebar.footer.action", { wide })
						}), (0, react_jsx_runtime.jsx)("div", {
							className: SidebarRoot_module_css_default.settingsArea,
							children: renderSlot("sidebar.settings", { wide })
						})]
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** `sidebar` namespace dictionaries: shell controls (brand row, New Session, fold toggle). */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"toggle.open": "打开侧边栏",
			"toggle.collapse": "收起侧边栏"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"toggle.open": "Open sidebar",
			"toggle.collapse": "Collapse sidebar"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin (shell controls copy). */
		const NS = "sidebar";
		/** Services required by the sidebar plugin. */
		const inject = [
			"slots",
			"layout",
			"sessions",
			"workspaces",
			"locale"
		];
		/** Registers the sidebar shell and its service callbacks.
		* @param ctx - Client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-sidebar: dictionaries");
			const injectProps = () => ({
				toggleSidebar: () => {
					ctx.layout.toggleSidebar();
				},
				setSurface: (surface) => {
					ctx.layout.setSurface(surface);
				}
			});
			ctx.effect(() => ctx.slots.register({
				name: "sidebar",
				locale: NS,
				children: {
					"sidebar.workspaces": {
						kind: "single",
						scope: "root"
					},
					"sidebar.settings": {
						kind: "single",
						scope: "root"
					},
					"sidebar.footer.action": {
						kind: "list",
						scope: "root"
					}
				},
				inject: injectProps
			}, SidebarRoot), "ui-sidebar: slot registration");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
