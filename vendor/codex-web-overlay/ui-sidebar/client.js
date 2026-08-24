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
				src: MOYU_ICON_SRC, width: s, height: s, alt: "MOYU",
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
					react_jsx_runtime.jsx("span", { style: { fontWeight: 600, letterSpacing: "0.04em", fontSize: Math.max(16, Math.round(s * 0.5)), lineHeight: 1 }, children: "MOYU" })
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
						children: [!collapsed && (0, react_jsx_runtime.jsx)("span", { style: { fontWeight: 600, letterSpacing: "0.04em", fontSize: 18, lineHeight: 1, color: "inherit" }, children: "MOYU" }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
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
