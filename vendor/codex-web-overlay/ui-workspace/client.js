window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-workspace",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		// === MoyuIcon：Lucide 内联图标适配层 ===
		// 图标数据提取自 lucide-react@1.33.0（ISC License）dist/esm/icons 的 __iconNode，构建期手工内联。
		// 纯构建期内联：无任何 lucide 运行时 require。默认 16px / strokeWidth 1.75 / aria-hidden。
		const MOYU_LUCIDE = {"SquarePen":[["path",{"d":"M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"}],["path",{"d":"M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"}]],"ListTodo":[["path",{"d":"M13 5h8"}],["path",{"d":"M13 12h8"}],["path",{"d":"M13 19h8"}],["path",{"d":"m3 17 2 2 4-4"}],["rect",{"x":"3","y":"4","width":"6","height":"6","rx":"1"}]],"Blocks":[["path",{"d":"M10 22V7a1 1 0 0 0-1-1H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5a1 1 0 0 0-1-1H2"}],["rect",{"x":"14","y":"2","width":"8","height":"8","rx":"1"}]],"GitFork":[["circle",{"cx":"12","cy":"18","r":"3"}],["circle",{"cx":"6","cy":"6","r":"3"}],["circle",{"cx":"18","cy":"6","r":"3"}],["path",{"d":"M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"}],["path",{"d":"M12 12v3"}]],"Globe":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"}],["path",{"d":"M2 12h20"}]],"SlidersHorizontal":[["path",{"d":"M10 5H3"}],["path",{"d":"M12 19H3"}],["path",{"d":"M14 3v4"}],["path",{"d":"M16 17v4"}],["path",{"d":"M21 12h-9"}],["path",{"d":"M21 19h-5"}],["path",{"d":"M21 5h-7"}],["path",{"d":"M8 10v4"}],["path",{"d":"M8 12H3"}]],"Search":[["path",{"d":"m21 21-4.34-4.34"}],["circle",{"cx":"11","cy":"11","r":"8"}]],"X":[["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],"FolderPlus":[["path",{"d":"M12 10v6"}],["path",{"d":"M9 13h6"}],["path",{"d":"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"}]],"Plus":[["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]],"ChevronRight":[["path",{"d":"m9 18 6-6-6-6"}]],"Folder":[["path",{"d":"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"}]],"FolderOpen":[["path",{"d":"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"}]],"FolderInput":[["path",{"d":"M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1"}],["path",{"d":"M2 13h10"}],["path",{"d":"m9 16 3-3-3-3"}]],"Ellipsis":[["circle",{"cx":"12","cy":"12","r":"1"}],["circle",{"cx":"19","cy":"12","r":"1"}],["circle",{"cx":"5","cy":"12","r":"1"}]],"Pencil":[["path",{"d":"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"}],["path",{"d":"m15 5 4 4"}]],"Copy":[["rect",{"width":"14","height":"14","x":"8","y":"8","rx":"2","ry":"2"}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]],"Archive":[["rect",{"width":"20","height":"5","x":"2","y":"3","rx":"1"}],["path",{"d":"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"}],["path",{"d":"M10 12h4"}]],"Trash2":[["path",{"d":"M10 11v6"}],["path",{"d":"M14 11v6"}],["path",{"d":"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"}],["path",{"d":"M3 6h18"}],["path",{"d":"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"}]],"ClipboardCopy":[["rect",{"width":"8","height":"4","x":"8","y":"2","rx":"1","ry":"1"}],["path",{"d":"M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"}],["path",{"d":"M16 4h2a2 2 0 0 1 2 2v4"}],["path",{"d":"M21 14H11"}],["path",{"d":"m15 10-4 4 4 4"}]],"Pin":[["path",{"d":"M12 17v5"}],["path",{"d":"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"}]],"PinOff":[["path",{"d":"M12 17v5"}],["path",{"d":"M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"}],["path",{"d":"m2 2 20 20"}],["path",{"d":"M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"}]],"CircleDot":[["circle",{"cx":"12","cy":"12","r":"10"}],["circle",{"cx":"12","cy":"12","r":"1"}]]};
		function MoyuLucideIcon(props) {
			const size = props.size || 16;
			return react_jsx_runtime.jsx("svg", {
				xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24",
				fill: "none", stroke: "currentColor", strokeWidth: props.strokeWidth || 1.75,
				strokeLinecap: "round", strokeLinejoin: "round",
				className: props.className, style: props.style,
				"aria-hidden": "true", focusable: "false",
				children: props.node.map((entry, index) => react_jsx_runtime.jsx(entry[0], entry[1], index))
			});
		}
		const moyuSquarePen = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.SquarePen }, props));
		const moyuListTodo = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.ListTodo }, props));
		const moyuBlocks = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.Blocks }, props));
		const moyuGitFork = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.GitFork }, props));
		const moyuGlobe = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.Globe }, props));
		const moyuSlidersHorizontal = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.SlidersHorizontal }, props));
		const moyuSearch = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.Search }, props));
		const moyuX = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.X }, props));
		const moyuFolderPlus = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.FolderPlus }, props));
		const moyuPlus = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.Plus }, props));
		const moyuChevronRight = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.ChevronRight }, props));
		const moyuFolder = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.Folder }, props));
		const moyuFolderOpen = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.FolderOpen }, props));
		const moyuFolderInput = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.FolderInput }, props));
		const moyuEllipsis = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.Ellipsis }, props));
		const moyuPencil = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.Pencil }, props));
		const moyuCopy = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.Copy }, props));
		const moyuArchive = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.Archive }, props));
		const moyuTrash2 = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.Trash2 }, props));
		const moyuClipboardCopy = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.ClipboardCopy }, props));
		const moyuPin = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.Pin }, props));
		const moyuPinOff = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.PinOff }, props));
		const moyuCircleDot = (props) => (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.CircleDot }, props));
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		// 复制到剪贴板：优先 navigator.clipboard，但它在部分沙箱渲染进程里会挂起或
		// 被拒，所以用 1.5s 超时竞速兜底；失败再退到 textarea + execCommand（无需权限）。
		function copyText(text) {
			if (typeof text !== "string" || !text) return Promise.resolve(false);
			const nav = (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText)
				? navigator.clipboard.writeText(text).then(() => {}).then(() => true).catch(() => false)
				: Promise.resolve(false);
			return Promise.race([
				nav,
				new Promise((resolve) => setTimeout(() => resolve(false), 1500))
			]).then((ok) => {
				if (ok) return true;
				try {
					const ta = document.createElement("textarea");
					ta.value = text;
					ta.style.position = "fixed";
					ta.style.top = "-1000px";
					ta.style.opacity = "0";
					document.body.appendChild(ta);
					ta.focus();
					ta.select();
					const done = document.execCommand("copy");
					document.body.removeChild(ta);
					return done;
				} catch {
					return false;
				}
			});
		}
		// 轻量错误提示（闭包内无现成 toast API，且未打包 antd）：
		// 固定定位、自动消失，避免 catch {} 静默吞错。
		function showErrorToast(message) {
			try {
				const el = document.createElement("div");
				el.textContent = message;
				el.style.cssText = "position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:2147483647;background:#e5484d;color:#fff;padding:8px 14px;border-radius:8px;font-size:13px;line-height:1.4;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:80vw;pointer-events:none;";
				document.body.appendChild(el);
				setTimeout(() => {
					el.style.transition = "opacity .3s";
					el.style.opacity = "0";
					setTimeout(() => el.remove(), 320);
				}, 3200);
			} catch {}
		}
		//#region lib/types/client/stores.js
		/**
		* The workspace browser's viewing store: the session-list grouping mode,
		* persisted across reloads. Module level exports the factory only (a
		* module-level handle would pin the store identity across plugin reloads);
		* register() receives the factory and the browser derives its PropsStore
		* share from the return type.
		*/
		/** Browser-local order account for the hierarchy-free flat Session list. */
		const FLAT_SESSION_ORDER_KEY = "__flat_session_order__";
		/**
		* Create the session meta store handle (pinned/unread across reloads).
		* @returns the store handle.
		*/
		function createSessionMetaStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					pinned: [],
					unread: []
				}),
				persist: "dsh.workspace.session-meta.v1",
				actions: {
					togglePin: (d, sessionId) => {
						const i = d.pinned.indexOf(sessionId);
						if (i === -1) d.pinned.push(sessionId);
						else d.pinned.splice(i, 1);
					},
					unpin: (d, sessionId) => {
						const i = d.pinned.indexOf(sessionId);
						if (i !== -1) d.pinned.splice(i, 1);
					},
					toggleUnread: (d, sessionId) => {
						const i = d.unread.indexOf(sessionId);
						if (i === -1) d.unread.push(sessionId);
						else d.unread.splice(i, 1);
					},
					clearUnread: (d, sessionId) => {
						const i = d.unread.indexOf(sessionId);
						if (i !== -1) d.unread.splice(i, 1);
					}
				}
			});
		}
		/**
		* Create the workspace browser viewing store handle.
		* @returns the store handle (spec + type + identity + factory in one).
		*/
		function createWorkspaceViewStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					groupBy: "workspace",
					orderBy: "updated",
					groupExpansion: {},
					sessionOrderByAccount: {},
					sessionUpdatedAtByAccount: {}
				}),
				persist: "dsh.workspace.view.v5",
				actions: {
					setGroupBy: (d, mode) => {
						d.groupBy = mode;
					},
					setOrderBy: (d, mode) => {
						d.orderBy = mode;
					},
					setGroupExpanded: (d, key, expanded) => {
						d.groupExpansion[key] = expanded;
					},
					retainAccountKeys: (d, workspaceKeys) => {
						const retained = new Set(workspaceKeys);
						d.groupExpansion = Object.fromEntries(Object.entries(d.groupExpansion).filter(([key]) => retained.has(key)));
						d.sessionOrderByAccount = Object.fromEntries(Object.entries(d.sessionOrderByAccount).filter(([key]) => retained.has(key)));
						d.sessionUpdatedAtByAccount = Object.fromEntries(Object.entries(d.sessionUpdatedAtByAccount).filter(([key]) => retained.has(key)));
					},
					syncSessionOrderAccount: (d, accountKey, order, updatedAt) => {
						d.sessionOrderByAccount[accountKey] = order;
						d.sessionUpdatedAtByAccount[accountKey] = updatedAt;
					},
					setSessionOrder: (d, accountKey, order) => {
						d.sessionOrderByAccount[accountKey] = order;
					}
				}
			});
		}
		/**
		* Cross-instance shared session meta store (pinned / unread). A single
		* module-level instance keeps every rendering component reactive to the same
		* persisted state, so toggling from one tree node updates all others.
		*/
		const sessionMetaStore = createSessionMetaStore().create();
		function useSessionMeta() {
			const pinned = (0, react.useSyncExternalStore)(sessionMetaStore.subscribe, () => sessionMetaStore.getSnapshot().pinned);
			const unread = (0, react.useSyncExternalStore)(sessionMetaStore.subscribe, () => sessionMetaStore.getSnapshot().unread);
			return {
				pinnedIds: (0, react.useMemo)(() => new Set(pinned), [pinned]),
				unreadIds: (0, react.useMemo)(() => new Set(unread), [unread]),
				togglePin: sessionMetaStore.actions.togglePin,
				toggleUnread: sessionMetaStore.actions.toggleUnread
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
		/** Display label for the ungrouped bucket row. */
		const UNGROUPED_LABEL = "Ungrouped";
		/**
		* Directory display label: basename of the path (both separators accepted).
		* Ungrouped-bucket fallback for surfaces without a workspace title.
		* @param cwd - directory path, or undefined for the ungrouped bucket.
		* @returns basename, the raw cwd when it has no basename, or the ungrouped label.
		*/
		function workspaceLabel(cwd) {
			if (cwd === void 0 || cwd === "") return UNGROUPED_LABEL;
			const base = cwd.replace(/[/\\]+$/, "").split(/[/\\]/).pop();
			return base !== void 0 && base !== "" ? base : cwd;
		}
		/** Recency comparator: newest first, id as the deterministic tiebreak (ids are unique per group). */
		function byRecency(a, b) {
			if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
			return a.id < b.id ? -1 : 1;
		}
		/** Pinned sessions float to the top of their group; ties fall back to recency. */
		function byPinnedFirst(a, b, pinnedIds) {
			const pa = pinnedIds.has(a.id);
			const pb = pinnedIds.has(b.id);
			if (pa !== pb) return pa ? -1 : 1;
			return byRecency(a, b);
		}
		/**
		* Ordinary sessions are visible; blank draft sessions never enter history,
		* including the current provisional New Session. Subagent children use their parent header catalog; archived
		* sessions are visible nowhere, while their accounting slots remain so
		* unarchiving restores position.
		*
		* Moyu preset filter: when window.__moyuActivePreset is set (by the
		* moyu-media-client plugin), sessions whose agentPreset does not match
		* are hidden. The current (active) session is always visible regardless
		* of preset to prevent losing navigation context. Sessions without
		* agentPreset (legacy) are visible only when preset filter is unset or
		* set to 'moyu' (default).
		* Preset 过滤真源在此；legacy（无 agentPreset）会话在 'moyu' 视图下可见。
		* 不要再在别处平行实现。
		*/
		function sessionVisible(session, current, archived) {
			if (session.origin === "subagent" || archived.has(session.id)) return false;
			if (session.blank) return false;
			const activePreset = typeof window !== "undefined" && window.__moyuActivePreset;
			if (!activePreset) return true;
			if (session.id === current) return true;
			const sessionPreset = session.agentPreset;
			if (!sessionPreset || typeof sessionPreset !== "string" || sessionPreset.trim() === "") {
				return activePreset === "moyu";
			}
			return sessionPreset === activePreset;
		}
		/**
		* A blank session is the selected Workspace's provisional New Session row;
		* its canonical title never enters search (blank rows are query-excluded)
		* and the renderer localizes its display label.
		*/
		function sessionTitle(session) {
			return session.blank ? "New Session" : session.displayTitle;
		}
		/** Build one group without projecting session lineage into presentation. */
		function buildGroup(key, workspaceId, cwd, createdAt, label, members, order) {
			const sessions = [...members];
			if (order === "recency") sessions.sort(byRecency);
			return {
				key,
				workspaceId,
				cwd,
				createdAt,
				label,
				sessions
			};
		}
		/** Apply a stored Ungrouped order and append newly loose Sessions by recency. */
		function orderedUngrouped(members, stored) {
			const byId = new Map(members.map((session) => [session.id, session]));
			const included = /* @__PURE__ */ new Set();
			const ordered = [];
			for (const key of stored) {
				const session = byId.get(key);
				if (session === void 0 || included.has(key)) continue;
				ordered.push(session);
				included.add(key);
			}
			for (const session of [...members].sort(byRecency)) {
				if (included.has(session.id)) continue;
				ordered.push(session);
			}
			return ordered;
		}
		/**
		* Group Sessions by Host Workspace: one group per entity in stable Host
		* order, with members resolved from sessionIds in their stored order. Sessions
		* outside every Workspace trail in the browser-local Ungrouped order, which
		* falls back to recency before that order is initialized.
		*/
		function groupByWorkspace(list, workspaces, archived, ungroupedOrder) {
			const groups = [];
			const accounted = /* @__PURE__ */ new Set();
			for (const workspace of workspaces) {
				const members = [];
				for (const id of workspace.sessionIds) {
					const summary = list.byId[id];
					if (summary === void 0) continue;
					accounted.add(id);
					if (!sessionVisible(summary, list.current, archived)) continue;
					members.push(summary);
				}
				groups.push(buildGroup(workspace.workspaceId, workspace.workspaceId, workspace.path, Date.parse(workspace.createdAt), workspace.title, members, "account"));
			}
			const stray = list.ids.map((id) => list.byId[id]).filter((s) => s !== void 0 && !accounted.has(s.id) && sessionVisible(s, list.current, archived));
			if (stray.length > 0) groups.push(buildGroup("", void 0, void 0, void 0, UNGROUPED_LABEL, ungroupedOrder === void 0 ? stray : orderedUngrouped(stray, ungroupedOrder), ungroupedOrder === void 0 ? "recency" : "account"));
			return groups;
		}
		function sessionNode(s, descendants) {
			return {
				id: s.id,
				title: sessionTitle(s),
				blank: s.blank,
				running: s.running,
				runningSubagentCount: descendants.get(s.id)?.runningCount ?? 0,
				completed: s.completed === true,
				updatedAt: s.updatedAt,
				...s.pendingInteraction === void 0 ? {} : { pendingInteraction: s.pendingInteraction }
			};
		}
		/**
		* Derive the workspace browser groups with every session as a top-level row.
		*
		* Every group shows; sessions populate under expanded groups in the selected
		* local order. Blank sessions are excluded except for the selected
		* provisional New Session row; archived sessions are excluded everywhere.
		* Content search lives outside this derivation
		* (see {@link deriveSearchResults}).
		* @param list - sessions list snapshot (`current` feeds containsCurrent).
		* @param workspaces - real workspaces in stable Host order.
		* @param archivedSessionIds - registry-global archive set.
		* @param view - local expansion arrays.
		* @returns group sections in render order.
		*/
		function deriveGroups(list, workspaces, archivedSessionIds, view, pinnedIds) {
			const archived = new Set(archivedSessionIds);
			const expandedGroups = new Set(view.expandedGroups);
			const descendants = (0, _deepseek_ai_dsh_client_runtime_client.indexSubagentDescendants)(list.byId);
			const currentGroup = list.current === void 0 ? void 0 : workspaces.find((w) => w.sessionIds.includes(list.current))?.workspaceId ?? "";
			const groups = [];
			for (const g of groupByWorkspace(list, workspaces, archived, view.ungroupedOrder)) {
				const expanded = expandedGroups.has(g.key);
				groups.push({
					key: g.key,
					workspaceId: g.workspaceId,
					cwd: g.cwd,
					createdAt: g.createdAt,
					label: g.label,
					sessionCount: g.sessions.length,
					expanded,
					containsCurrent: g.key === currentGroup,
					sessions: expanded ? g.sessions.slice().sort((a, b) => byPinnedFirst(a, b, pinnedIds)).map((session) => sessionNode(session, descendants)) : []
				});
			}
			return groups;
		}
		/**
		* Derive the flat session list ("In one list" mode): every session — fork
		* children included — as a top-level row, strictly newest-first. No grouping,
		* no parent/child adjacency. Content search lives outside this derivation
		* (see {@link deriveSearchResults}).
		* @param list - sessions list snapshot.
		* @param archivedSessionIds - registry-global archive set.
		* @returns flat rows in render order.
		*/
		function deriveFlat(list, archivedSessionIds, pinnedIds) {
			const archived = new Set(archivedSessionIds);
			const descendants = (0, _deepseek_ai_dsh_client_runtime_client.indexSubagentDescendants)(list.byId);
			const rows = [];
			for (const id of list.ids) {
				const s = list.byId[id];
				if (s === void 0 || !sessionVisible(s, list.current, archived)) continue;
				rows.push(s);
			}
			rows.sort((a, b) => byPinnedFirst(a, b, pinnedIds));
			return rows.map((session) => sessionNode(session, descendants));
		}
		/**
		* Merge immediate title/Workspace substring matches with ranked Host content
		* matches. Local rows lead newest-first, content-only rows retain backend
		* order, and duplicate sessions receive the backend snippet in place.
		* @param list - session metadata authority.
		* @param workspaces - Workspace membership and display labels.
		* @param query - caller text; surrounding whitespace is ignored.
		* @param archivedSessionIds - registry-global archive set (members never match).
		* @param content - ranked Host content-search page.
		* @param limit - protocol-owned maximum merged row count.
		* @returns bounded deduplicated flat rows and a refine-query hint bit.
		*/
		function deriveSearchResults(list, workspaces, query, archivedSessionIds, content, limit) {
			const q = query.trim().toLowerCase();
			if (q === "") return {
				items: [],
				hasMore: false
			};
			const archived = new Set(archivedSessionIds);
			const descendants = (0, _deepseek_ai_dsh_client_runtime_client.indexSubagentDescendants)(list.byId);
			const workspaceBySession = /* @__PURE__ */ new Map();
			for (const workspace of workspaces) for (const sessionId of workspace.sessionIds) if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, workspace.title);
			const labelOf = (summary) => workspaceBySession.get(summary.id) ?? workspaceLabel(summary.cwd);
			const contentBySession = /* @__PURE__ */ new Map();
			for (const item of content.items) if (!contentBySession.has(item.sessionId)) contentBySession.set(item.sessionId, item);
			const local = [];
			for (const id of list.ids) {
				const summary = list.byId[id];
				if (summary === void 0 || summary.blank || !sessionVisible(summary, list.current, archived)) continue;
				if (sessionTitle(summary).toLowerCase().includes(q) || labelOf(summary).toLowerCase().includes(q)) local.push(summary);
			}
			local.sort(byRecency);
			const ordered = [];
			const included = /* @__PURE__ */ new Set();
			const include = (summary) => {
				if (included.has(summary.id)) return;
				included.add(summary.id);
				ordered.push(summary);
			};
			for (const summary of local) include(summary);
			for (const item of content.items) {
				const summary = list.byId[item.sessionId];
				if (summary !== void 0 && !summary.blank && sessionVisible(summary, list.current, archived)) include(summary);
			}
			return {
				items: ordered.slice(0, limit).map((summary) => {
					const match = contentBySession.get(summary.id);
					return {
						id: summary.id,
						title: sessionTitle(summary),
						workspace: labelOf(summary),
						running: summary.running,
						runningSubagentCount: descendants.get(summary.id)?.runningCount ?? 0,
						...summary.pendingInteraction === void 0 ? {} : { pendingInteraction: summary.pendingInteraction },
						completed: summary.completed === true,
						...match === void 0 ? {} : { snippet: match.snippet }
					};
				}),
				hasMore: content.hasMore || ordered.length > limit
			};
		}
		/**
		* Compact relative time for session rows, as a structured bucket the
		* renderer localizes ("now"/"5min"/"3h"/"2d"/"4mo"/"1y" in en).
		* @param updatedAt - epoch ms of the session's last activity.
		* @param now - current epoch ms (injected for pure rendering).
		* @returns the row's trailing time bucket and magnitude.
		*/
		function relativeTime(updatedAt, now) {
			const MIN = 6e4;
			const HOUR = 36e5;
			const DAY = 864e5;
			const diff = Math.max(0, now - updatedAt);
			if (diff < MIN) return {
				unit: "now",
				n: 0
			};
			if (diff < HOUR) return {
				unit: "minutes",
				n: Math.floor(diff / MIN)
			};
			if (diff < DAY) return {
				unit: "hours",
				n: Math.floor(diff / HOUR)
			};
			if (diff < 30 * DAY) return {
				unit: "days",
				n: Math.floor(diff / DAY)
			};
			if (diff < 365 * DAY) return {
				unit: "months",
				n: Math.floor(diff / (30 * DAY))
			};
			return {
				unit: "years",
				n: Math.floor(diff / (365 * DAY))
			};
		}
		//#endregion
		//#region \0dsh-css:/Users/clukay/Program/deepseek-harness/packages/client/ui-workspace/src/client/rows/Rows.module.css.mjs
		const css$3 = ".W1OuRW_projectRow,.W1OuRW_sessionRow{position:relative;cursor:pointer;user-select:none;color:var(--dsw-alias-label-primary);border-radius:8px;align-items:center;gap:6px;padding:0 0 0 8px;display:flex;transition:background 120ms ease}.W1OuRW_projectRow:hover,.W1OuRW_sessionRow:hover,.W1OuRW_sessionRow.W1OuRW_selected{background:var(--dsw-alias-interactive-bg-hover)}.W1OuRW_searchResultRow{box-sizing:border-box;cursor:pointer;text-align:left;width:100%;min-height:48px;color:var(--dsw-alias-label-primary);background:0 0;border:none;border-radius:8px;flex-direction:column;align-items:stretch;padding:4px 8px;display:flex}.W1OuRW_searchResultRow:hover,.W1OuRW_searchResultRow.W1OuRW_selected{background:var(--dsw-alias-interactive-bg-hover)}.W1OuRW_searchResultHeading{align-items:center;min-width:0;display:flex}.W1OuRW_searchResultTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;margin-left:4px;font-size:14px;line-height:20px;overflow:hidden}.W1OuRW_searchResultMeta{align-items:center;gap:6px;min-width:0;margin-left:20px;display:flex}.W1OuRW_searchResultWorkspace,.W1OuRW_searchResultSnippet{text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:17px;overflow:hidden}.W1OuRW_searchResultWorkspace{max-width:40%;color:var(--dsw-alias-label-tertiary);flex:none}.W1OuRW_searchResultSnippet{min-width:0;color:var(--dsw-alias-label-secondary);flex:1}.W1OuRW_projectRow{box-sizing:border-box;align-items:center;height:34px}.W1OuRW_projectRow .W1OuRW_rowActions{height:20px}.W1OuRW_sessionRow{height:32px;animation:W1OuRW_row-in .15s var(--ds-ease-in-out);gap:0}.W1OuRW_sessionRow .W1OuRW_title{margin:0 6px 0 4px}.W1OuRW_flatSessionRowWithoutStatus .W1OuRW_title{margin-left:0}@keyframes W1OuRW_row-in{0%{opacity:0}}.W1OuRW_slot{width:16px;height:20px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:center;align-items:center;display:inline-flex}.W1OuRW_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}.W1OuRW_folderActive{color:var(--dsw-alias-state-business-primary)}.W1OuRW_projectRow .W1OuRW_chevron{display:none}.W1OuRW_projectRow:hover .W1OuRW_chevron{display:inline-flex}.W1OuRW_projectRow:hover .W1OuRW_folder{display:none}.W1OuRW_arrow{transition:transform .15s var(--ds-ease-in-out)}.W1OuRW_arrowOpen{transform:rotate(90deg)}.W1OuRW_projectText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.W1OuRW_title{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:14px;line-height:20px;font-weight:400;overflow:hidden}.W1OuRW_titlePinned{font-weight:500}.W1OuRW_titleUnread{font-weight:600}.W1OuRW_pinIndicator{position:absolute;left:2px;top:50%;transform:translateY(-50%);width:2px;height:12px;border-radius:1px;background:var(--dsw-alias-state-business-primary);pointer-events:none}.W1OuRW_renameInput{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-elevated-fill);min-width:0;color:inherit;border-radius:4px;outline:none;padding:0 2px;font-size:14px;line-height:20px}.W1OuRW_sessionRow .W1OuRW_title{flex:1}.W1OuRW_meta{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px;overflow:hidden}.W1OuRW_time{color:var(--dsw-alias-label-tertiary);flex:none;font-size:12px;line-height:20px}.W1OuRW_dot{flex:none}.W1OuRW_rowActions{flex:none;align-items:center;gap:12px;display:none}.W1OuRW_projectRow:hover .W1OuRW_rowActions,.W1OuRW_sessionRow:hover .W1OuRW_rowActions,.W1OuRW_projectRow.W1OuRW_menuOpen .W1OuRW_rowActions,.W1OuRW_sessionRow.W1OuRW_menuOpen .W1OuRW_rowActions,.W1OuRW_rowActionsPinned{display:inline-flex}.W1OuRW_sessionRow:hover .W1OuRW_time,.W1OuRW_sessionRow.W1OuRW_menuOpen .W1OuRW_time{display:none}.W1OuRW_projectRow.W1OuRW_menuOpen,.W1OuRW_sessionRow.W1OuRW_menuOpen{background:var(--dsw-alias-interactive-bg-hover)}.W1OuRW_sessionRow.W1OuRW_dropBefore,.W1OuRW_sessionRow.W1OuRW_dropAfter{position:relative}.W1OuRW_sessionRow.W1OuRW_dropBefore:before,.W1OuRW_sessionRow.W1OuRW_dropAfter:after{content:\"\";z-index:1;background:linear-gradient(55deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 0 / 5px 7px no-repeat, linear-gradient(125deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 5px / 5px 7px no-repeat, linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px / calc(100% - 4px) 2px no-repeat;pointer-events:none;height:12px;position:absolute;left:0;right:4px}.W1OuRW_sessionRow.W1OuRW_dropBefore:before{top:-7px}.W1OuRW_sessionRow.W1OuRW_dropAfter:after{bottom:-7px}.W1OuRW_hoverContent{flex-direction:column;gap:8px;display:flex}.W1OuRW_hoverTitle{color:#fff;overflow-wrap:break-word;font-size:14px;line-height:20px}.W1OuRW_hoverPath{color:#cfd3d6;word-break:break-all;font-size:12px;line-height:16px}.W1OuRW_hoverTime{color:#cfd3d6;font-size:12px;line-height:16px}.W1OuRW_hoverStatus{color:#adb2b8;align-items:center;gap:8px;font-size:12px;line-height:20px;display:flex}.W1OuRW_iconButton{cursor:pointer;width:16px;height:16px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:4px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex;transition:color 120ms ease, opacity 120ms ease, transform 120ms ease}.W1OuRW_iconButton:hover{color:var(--dsw-alias-label-primary)}.W1OuRW_iconButton:active{transform:scale(.97)}.W1OuRW_iconButtonActive{color:var(--dsw-alias-state-business-primary)}.W1OuRW_pinButtonPinned{color:var(--dsw-alias-state-business-primary);opacity:0.85}.W1OuRW_pinButtonPinned:hover{color:var(--dsw-alias-state-business-primary);opacity:1}.W1OuRW_unreadDot{background:var(--dsw-alias-state-business-primary);vertical-align:middle;border-radius:50%;flex:none;width:6px;height:6px;margin-left:6px;display:inline-block}.W1OuRW_chevron{color:var(--dsw-alias-label-caption)}@media (prefers-reduced-motion:reduce){.W1OuRW_sessionRow,.W1OuRW_arrow,.W1OuRW_iconButton{transition:none!important;animation:none!important}}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-workspace/Rows.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-workspace";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var Rows_module_css_default = {
			"archiveButton": "W1OuRW_archiveButton",
			"arrow": "W1OuRW_arrow",
			"arrowOpen": "W1OuRW_arrowOpen",
			"chevron": "W1OuRW_chevron",
			"dot": "W1OuRW_dot",
			"dropAfter": "W1OuRW_dropAfter",
			"dropBefore": "W1OuRW_dropBefore",
			"flatSessionRowWithoutStatus": "W1OuRW_flatSessionRowWithoutStatus",
			"folder": "W1OuRW_folder",
			"folderActive": "W1OuRW_folderActive",
			"hoverContent": "W1OuRW_hoverContent",
			"hoverPath": "W1OuRW_hoverPath",
			"hoverStatus": "W1OuRW_hoverStatus",
			"hoverTime": "W1OuRW_hoverTime",
			"hoverTitle": "W1OuRW_hoverTitle",
			"iconButton": "W1OuRW_iconButton",
			"iconButtonActive": "W1OuRW_iconButtonActive",
			"menuOpen": "W1OuRW_menuOpen",
			"meta": "W1OuRW_meta",
			"pinButton": "W1OuRW_pinButton",
			"pinButtonPinned": "W1OuRW_pinButtonPinned",
			"pinIndicator": "W1OuRW_pinIndicator",
			"pinned": "W1OuRW_pinned",
			"projectRow": "W1OuRW_projectRow",
			"projectText": "W1OuRW_projectText",
			"renameInput": "W1OuRW_renameInput",
			"row-in": "W1OuRW_row-in",
			"rowActions": "W1OuRW_rowActions",
			"rowActionsPinned": "W1OuRW_rowActionsPinned",
			"searchResultHeading": "W1OuRW_searchResultHeading",
			"searchResultMeta": "W1OuRW_searchResultMeta",
			"searchResultRow": "W1OuRW_searchResultRow",
			"searchResultSnippet": "W1OuRW_searchResultSnippet",
			"searchResultTitle": "W1OuRW_searchResultTitle",
			"searchResultWorkspace": "W1OuRW_searchResultWorkspace",
			"selected": "W1OuRW_selected",
			"sessionRow": "W1OuRW_sessionRow",
			"slot": "W1OuRW_slot",
			"time": "W1OuRW_time",
			"title": "W1OuRW_title",
			"titlePinned": "W1OuRW_titlePinned",
			"titleUnread": "W1OuRW_titleUnread",
			"unreadDot": "W1OuRW_unreadDot",
			"visuallyHidden": "W1OuRW_visuallyHidden"
		};
		//#endregion
		//#region lib/types/client/rows/Rows.js
		/**
		* Workspace browser tree row components (figma Cell set 14:3080): pure presentational —
		* all data and callbacks arrive via props. Hover swaps (folder->chevron,
		* time->ellipsis, action buttons) are CSS-only. Row ... menus are visual-only
		* except workspace Rename/Delete and session Rename/Fork/Archive; the session
		* and workspace hover cards are suppressed while a menu is open.
		*/
		/** Inline glyphs for actions without a primitive icon export. */
		function PinIcon(props) {
					return (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: props && props.off ? MOYU_LUCIDE.PinOff : MOYU_LUCIDE.Pin }, props));
				}
		function MailIcon(props) {
					return (0, react_jsx_runtime.jsx)(MoyuLucideIcon, Object.assign({ node: MOYU_LUCIDE.CircleDot }, props));
				}
		/** Row display title: blank rows show the localized New Session label. */
		function displayTitle(node, t) {
			return node.blank ? t("session.new") : node.title;
		}
		/** Localized compact relative time ("刚刚"/"5分钟" in zh, "now"/"5min" in en). */
		function timeLabel(updatedAt, now, t) {
			const { unit, n } = relativeTime(updatedAt, now);
			return unit === "now" ? t("time.now") : t(`time.${unit}`, { n });
		}
		/** Hover-card variant: distances wrap in the ago template; the now bucket stays bare (no "now ago"). */
		function hoverTimeLabel(updatedAt, now, t) {
			const { unit, n } = relativeTime(updatedAt, now);
			return unit === "now" ? t("time.now") : t("time.ago", { t: t(`time.${unit}`, { n }) });
		}
		/**
		* Absolute creation time through the dictionary's date template (the message
		* clock pattern): `toLocaleString` would follow the browser language, not the
		* app locale, and produce mixed-language text after a switch.
		*/
		function createdLabel(createdAt, t) {
			const d = new Date(createdAt);
			const pad2 = (v) => String(v).padStart(2, "0");
			return t("hover.created", { time: `${t("date.ymd", {
				y: d.getFullYear(),
				m: d.getMonth() + 1,
				d: d.getDate()
			})} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` });
		}
		/** Hover-card body: workspace title, display directory path, absolute creation time. */
		function WorkspaceHoverContent({ label, cwd, createdAt, t }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: Rows_module_css_default.hoverContent,
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverTitle,
						children: label
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverPath,
						children: cwd
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverTime,
						children: createdLabel(createdAt, t)
					})
				]
			});
		}
		/** Pointer-position half of a row (insert line above or below). */
		function rowHalf(e) {
			const rect = e.currentTarget.getBoundingClientRect();
			return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
		}
		/**
		* Project (workspace) header row: folder + title;
		* hover reveals the chevron and create button, and dwelling on a real
		* Workspace shows its hover card (the ungrouped bucket has none).
		* `containsCurrent` arrives on the node (derivation fact, no renderer scan).
		* @param props.group - derived group node.
		* @param props.onToggle - expand/collapse the group.
		* @param props.onCreate - start a frontend Session inside this Workspace.
		* @param props.drag - optional workspace-row drag wiring.
		* @param props.home - host account home for POSIX hover-path abbreviation.
		* @param props.t - the browser root's locale seat.
		* @returns the row element.
		*/
		function ProjectRowItem({ group, onToggle, onCreate, actions, drag, home, t }) {
			const row = group;
			const label = row.workspaceId === void 0 ? t("group.ungrouped") : row.label;
			const active = group.expanded && group.containsCurrent;
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const workspaceMenuItems = [{
				id: "rename",
				label: t("rename"),
				icon: (0, react_jsx_runtime.jsx)(moyuPencil, {})
			}, {
				id: "delete",
				label: t("delete.workspace"),
				icon: (0, react_jsx_runtime.jsx)(moyuTrash2, {}),
				danger: true
			}];
			const ownRow = (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(Rows_module_css_default.projectRow, menuOpen && Rows_module_css_default.menuOpen),
				role: "treeitem",
				"aria-expanded": row.expanded,
				onClick: onToggle,
				draggable: drag !== void 0,
				onDragStart: drag === void 0 ? void 0 : (e) => {
					e.dataTransfer.effectAllowed = "move";
					e.dataTransfer.setData("text/plain", row.key);
					drag.start();
				},
				onDragEnd: drag?.end,
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: clsx(Rows_module_css_default.slot, Rows_module_css_default.folder, active && Rows_module_css_default.folderActive),
						children: row.expanded ? (0, react_jsx_runtime.jsx)(moyuFolderOpen, {}) : (0, react_jsx_runtime.jsx)(moyuFolder, {})
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: clsx(Rows_module_css_default.slot, Rows_module_css_default.chevron),
						children: (0, react_jsx_runtime.jsx)(moyuChevronRight, { className: clsx(Rows_module_css_default.arrow, row.expanded && Rows_module_css_default.arrowOpen) })
					}),
					(0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.projectText,
						children: (0, react_jsx_runtime.jsx)("span", {
							className: Rows_module_css_default.title,
							children: label
						})
					}),
					(0, react_jsx_runtime.jsxs)("span", {
						className: Rows_module_css_default.rowActions,
						children: [actions !== void 0 && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menuOpen,
							onClose: () => {
								setMenuOpen(false);
							},
							items: workspaceMenuItems,
							onSelect: (id) => {
								setMenuOpen(false);
								/* v8 ignore next -- workspaceMenuItems carries exactly these two rows today. */
								if (id !== "rename" && id !== "delete") return;
								if (id === "rename") actions.rename();
								else actions.delete();
							},
							portal: true,
							closeOnPointerLeave: true,
							anchor: (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Rows_module_css_default.iconButton,
								"aria-label": t("actions.workspace.aria", { name: label }),
								onClick: (e) => {
									e.stopPropagation();
									setMenuOpen((v) => !v);
								},
								children: (0, react_jsx_runtime.jsx)(moyuEllipsis, {})
							})
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: Rows_module_css_default.iconButton,
							"aria-label": t("actions.newSession.aria", { name: label }),
							onClick: (e) => {
								e.stopPropagation();
								onCreate();
							},
							children: (0, react_jsx_runtime.jsx)(moyuPlus, {})
						})]
					})
				]
			});
			if (row.createdAt === void 0) return ownRow;
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.HoverCard, {
				anchor: ownRow,
				content: (0, react_jsx_runtime.jsx)(WorkspaceHoverContent, {
					label: row.label,
					cwd: row.cwd === void 0 ? void 0 : (0, _deepseek_ai_dsh_client_runtime_client.abbreviateHomePath)(row.cwd, home),
					createdAt: row.createdAt,
					t
				}),
				disabled: menuOpen,
				copyText: row.cwd,
				copyLabel: t("copy"),
				copiedLabel: t("hover.copied")
			});
		}
		/* v8 ignore next 3 -- closed-union backstop; only reached if the status is forged */
		function assertNever(value) {
			throw new Error(`unknown pending interaction: ${String(value)}`);
		}
		/**
		* Session status presentation; pending interaction is primary and live activity
		* outranks completion reminders.
		*/
		function sessionStatuses(node, t) {
			const subagents = node.runningSubagentCount === 0 ? void 0 : {
				state: "ongoing",
				label: t(node.runningSubagentCount === 1 ? "status.subagentsRunning.one" : "status.subagentsRunning.other", { n: node.runningSubagentCount })
			};
			let pending;
			switch (node.pendingInteraction) {
				case "approval":
					pending = {
						state: "warning",
						label: t("status.waitingApproval")
					};
					break;
				case "plan-review":
					pending = {
						state: "warning",
						label: t("status.planReview")
					};
					break;
				case "question":
					pending = {
						state: "warning",
						label: t("status.waitingAnswer")
					};
					break;
				case void 0: break;
				/* v8 ignore next -- closed PendingInteractionStatus union */
				default: return assertNever(node.pendingInteraction);
			}
			if (pending !== void 0) return subagents === void 0 ? [pending] : [pending, subagents];
			if (node.running) {
				const primary = {
					state: "ongoing",
					label: t("status.running")
				};
				return subagents === void 0 ? [primary] : [primary, subagents];
			}
			if (subagents !== void 0) return [subagents];
			if (node.completed) return [{
				state: "done",
				label: t("status.completed")
			}];
			return [{
				state: "done",
				label: t("status.idle")
			}];
		}
		/** Primary status dot plus every status's screen-reader label, shared by the search and session rows. */
		function SessionStatusDots({ statuses }) {
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: statuses[0].state }), statuses.map((status) => (0, react_jsx_runtime.jsx)("span", {
				className: Rows_module_css_default.visuallyHidden,
				children: status.label
			}, status.label))] });
		}
		/** Hover-card body: full title, relative time, and every relevant live status. */
		function SessionHoverContent({ node, now, t }) {
			const statuses = sessionStatuses(node, t);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: Rows_module_css_default.hoverContent,
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverTitle,
						children: displayTitle(node, t)
					}),
					!node.blank && (0, react_jsx_runtime.jsx)("div", {
						className: Rows_module_css_default.hoverTime,
						children: hoverTimeLabel(node.updatedAt, now, t)
					}),
					statuses.map((status) => (0, react_jsx_runtime.jsxs)("div", {
						className: Rows_module_css_default.hoverStatus,
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: status.state }), (0, react_jsx_runtime.jsx)("span", { children: status.label })]
					}, status.label))
				]
			});
		}
		/**
		* One flat search result: title, Workspace context, and optional content
		* excerpt. Search navigation opens the session only; it does not address an
		* event inside the conversation.
		* @param props.result - merged local/content search row.
		* @param props.currentId - selected session id.
		* @param props.onOpen - open the selected session.
		* @param props.t - Workspace-browser translation seat.
		* @returns the result button.
		*/
		function SearchResultItem({ result, currentId, onOpen, t }) {
			const selected = result.id === currentId;
			const statuses = sessionStatuses(result, t);
			const primaryStatus = statuses[0];
			return (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: clsx(Rows_module_css_default.searchResultRow, selected && Rows_module_css_default.selected),
				role: "treeitem",
				"aria-selected": selected,
				onClick: () => {
					onOpen(result.id);
				},
				children: [(0, react_jsx_runtime.jsxs)("span", {
					className: Rows_module_css_default.searchResultHeading,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.slot,
						children: (primaryStatus.state !== "done" || result.completed) && (0, react_jsx_runtime.jsx)(SessionStatusDots, { statuses })
					}), (0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.searchResultTitle,
						children: result.title
					})]
				}), (0, react_jsx_runtime.jsxs)("span", {
					className: Rows_module_css_default.searchResultMeta,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.searchResultWorkspace,
						children: result.workspace
					}), result.snippet !== void 0 && (0, react_jsx_runtime.jsx)("span", {
						className: Rows_module_css_default.searchResultSnippet,
						children: result.snippet
					})]
				})]
			});
		}
		/**
		* One top-level 34px session row: status dot (pending user interaction outranks
		* own or descendant activity), title, relative time, and the row actions menu.
		* @param props.node - derived session node.
		* @param props.currentId - selected session id (row highlight).
		* @param props.now - epoch ms for relative-time formatting.
		* @param props.onOpen - open a session by id.
		* @param props.onRename - open the session rename dialog (id + current title).
		* @param props.onFork - fork a session at its last completed turn.
		* @param props.onArchive - archive a session by id.
		* @param props.drag - optional draggable-row wiring.
		* @param props.flat - omit the empty status slot in the hierarchy-free flat list.
		* @param props.t - the browser root's locale seat.
		* @returns the session row.
		*/
		function SessionNodeItem({ node, currentId, now, onOpen, onRename, onFork, onArchive, drag, flat = false, t, pinned = false, unread = false, onTogglePin, onToggleUnread, workspaces = [], onMoveToWorkspace, onCopySession, onCopyMarkdown }) {
			const row = node;
			const title = displayTitle(node, t);
			const selected = node.id === currentId;
			const statuses = sessionStatuses(node, t);
			const showStatus = statuses[0].state !== "done" || row.completed;
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const [menuRect, setMenuRect] = (0, react.useState)(null);
			const rowRef = (0, react.useRef)(null);
			const moveSubmenu = [{
				id: "move-none",
				label: t("moveToWorkspace.none"),
				icon: (0, react_jsx_runtime.jsx)(moyuFolder, {})
			}, ...workspaces.map((ws) => ({
				id: `move-${ws.id ?? "none"}`,
				label: ws.label,
				icon: (0, react_jsx_runtime.jsx)(moyuFolder, {})
			}))];
			const copySubmenu = [{
				id: "copy-session",
				label: t("copy.session"),
				icon: (0, react_jsx_runtime.jsx)(moyuCopy, {})
			}, {
				id: "copy-markdown",
				label: t("copy.markdown"),
				icon: (0, react_jsx_runtime.jsx)(moyuClipboardCopy, {})
			}];
			const sessionMenuItems = [
				{
					id: pinned ? "unpin" : "pin",
					label: pinned ? t("pin.remove") : t("pin.add"),
					icon: (0, react_jsx_runtime.jsx)(PinIcon, { off: pinned })
				},
				{
					id: unread ? "mark-read" : "mark-unread",
					label: unread ? t("unread.markRead") : t("unread.markUnread"),
					icon: (0, react_jsx_runtime.jsx)(MailIcon, {})
				},
				{
					id: "rename",
					label: t("rename"),
					icon: (0, react_jsx_runtime.jsx)(moyuPencil, {})
				},
				{
					id: "fork",
					label: t("menu.fork"),
					icon: (0, react_jsx_runtime.jsx)(moyuGitFork, {})
				},
				{
					id: "archive",
					label: t("menu.archiveSession"),
					icon: (0, react_jsx_runtime.jsx)(moyuArchive, { size: 16 })
				},
				{
					type: "separator",
					id: "sep-move"
				},
				{
					id: "move",
					label: t("moveToWorkspace.title"),
					icon: (0, react_jsx_runtime.jsx)(moyuFolderInput, {}),
					submenu: moveSubmenu
				},
				{
					id: "copy",
					label: t("copy.title"),
					icon: (0, react_jsx_runtime.jsx)(moyuCopy, {}),
					submenu: copySubmenu
				}
			];
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.HoverCard, {
				anchor: (0, react_jsx_runtime.jsxs)("div", {
					className: clsx(Rows_module_css_default.sessionRow, selected && Rows_module_css_default.selected, pinned && Rows_module_css_default.pinned, menuOpen && Rows_module_css_default.menuOpen, flat && !showStatus && Rows_module_css_default.flatSessionRowWithoutStatus, drag?.marker === "before" && Rows_module_css_default.dropBefore, drag?.marker === "after" && Rows_module_css_default.dropAfter),
					role: "treeitem",
					"aria-selected": selected,
					ref: rowRef,
					onContextMenu: (e) => {
						e.preventDefault();
						setMenuRect(new DOMRect(e.clientX, e.clientY, 1, 1));
						setMenuOpen(true);
					},
					onClick: () => {
						onOpen(node.id);
					},
					draggable: drag !== void 0,
					onDragStart: drag === void 0 ? void 0 : (e) => {
						e.dataTransfer.effectAllowed = "move";
						e.dataTransfer.setData("text/plain", node.id);
						drag.start();
					},
					onDragEnd: drag?.end,
					onDragOver: drag === void 0 ? void 0 : (e) => {
						if (!drag.active) return;
						e.preventDefault();
						e.dataTransfer.dropEffect = "move";
						drag.hover(rowHalf(e));
					},
					onDrop: drag === void 0 ? void 0 : (e) => {
						if (!drag.active) return;
						e.preventDefault();
						drag.drop(rowHalf(e));
					},
					children: [
						pinned && (0, react_jsx_runtime.jsx)("span", {
							className: Rows_module_css_default.pinIndicator,
							"aria-hidden": "true"
						}),
						(!flat || showStatus) && (0, react_jsx_runtime.jsx)("span", {
							className: Rows_module_css_default.slot,
							children: showStatus && (0, react_jsx_runtime.jsx)(SessionStatusDots, { statuses })
						}),
						(0, react_jsx_runtime.jsxs)("span", {
							className: clsx(Rows_module_css_default.title, pinned && Rows_module_css_default.titlePinned, unread && Rows_module_css_default.titleUnread),
							children: [title, unread && (0, react_jsx_runtime.jsx)("span", {
								className: Rows_module_css_default.unreadDot,
								"aria-label": t("unread.label")
							})]
						}),
						!row.blank && (0, react_jsx_runtime.jsxs)("span", {
							className: clsx(Rows_module_css_default.rowActions, pinned && Rows_module_css_default.rowActionsPinned),
							children: [
								pinned ? (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: clsx(Rows_module_css_default.iconButton, Rows_module_css_default.pinButton, Rows_module_css_default.pinButtonPinned),
									"aria-label": t("pin.remove.aria", { name: title }),
									"aria-pressed": true,
									title: t("pin.remove"),
									onClick: (e) => {
										e.stopPropagation();
										onTogglePin?.(node.id);
									},
									children: (0, react_jsx_runtime.jsx)(PinIcon, { off: false })
								}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
									children: [
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: clsx(Rows_module_css_default.iconButton, Rows_module_css_default.pinButton),
											"aria-label": t("pin.add.aria", { name: title }),
											"aria-pressed": false,
											title: t("pin.add"),
											onClick: (e) => {
												e.stopPropagation();
												onTogglePin?.(node.id);
											},
											children: (0, react_jsx_runtime.jsx)(PinIcon, { off: false })
										}),
										(0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: clsx(Rows_module_css_default.iconButton, Rows_module_css_default.archiveButton),
											"aria-label": t("menu.archiveSession.aria", { name: title }),
											title: t("menu.archiveSession"),
											onClick: (e) => {
												e.stopPropagation();
												onArchive(node.id);
											},
											children: (0, react_jsx_runtime.jsx)(moyuArchive, { size: 16 })
										})
									]
								}),
								(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
									open: menuOpen,
									onClose: () => {
										setMenuOpen(false);
									},
									items: sessionMenuItems,
									getAnchorRect: () => menuRect ?? rowRef.current?.getBoundingClientRect() ?? void 0,
									onSelect: (id) => {
										setMenuOpen(false);
										if (id === "pin") onTogglePin?.(node.id);
										else if (id === "unpin") onTogglePin?.(node.id);
										else if (id === "mark-unread") onToggleUnread?.(node.id);
										else if (id === "mark-read") onToggleUnread?.(node.id);
										else if (id === "rename") onRename(node.id, row.title);
										else if (id === "fork") onFork(node.id);
										else if (id === "archive") onArchive(node.id);
										else if (id === "move-none") onMoveToWorkspace?.(node.id, void 0);
										else if (id?.startsWith("move-")) onMoveToWorkspace?.(node.id, id.slice(5));
										else if (id === "copy-session") onCopySession?.(node.id);
										else if (id === "copy-markdown") onCopyMarkdown?.(node.id);
									},
									portal: true,
									anchor: (0, react_jsx_runtime.jsx)("span", {
										"aria-hidden": true,
										style: {
											position: "absolute",
											width: 0,
											height: 0
										}
									})
								})
							]
						})
					]
				}),
				content: (0, react_jsx_runtime.jsx)(SessionHoverContent, {
					node,
					now,
					t
				}),
				disabled: menuOpen || drag?.active === true,
				copyText: row.blank ? void 0 : row.title,
				copyLabel: t("copy"),
				copiedLabel: t("hover.copied")
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/clukay/Program/deepseek-harness/packages/client/ui-workspace/src/client/WorkspacePicker.module.css.mjs
		const css$2 = ".rYNBnG_modalAction{min-width:72px}.rYNBnG_modalError,.rYNBnG_menuStatus{margin-top:8px;font-size:12px;line-height:18px}.rYNBnG_modalError{color:var(--dsw-alias-state-error-primary)}.rYNBnG_menuStatus{color:var(--dsw-alias-label-secondary)}.rYNBnG_createBody{flex-direction:column;gap:20px;display:flex}.rYNBnG_nameField{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);width:100%;height:48px;color:var(--dsw-alias-label-primary);background:0 0;border-radius:12px;outline:none;padding:0 16px;font:inherit}.rYNBnG_nameField:focus{border-color:var(--dsw-alias-state-business-primary)}.rYNBnG_sourceLabel{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600}.rYNBnG_sourceButton{box-sizing:border-box;cursor:pointer;width:100%;min-height:112px;color:var(--dsw-alias-label-secondary);background:0 0;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;justify-content:center;align-items:center;gap:8px;padding:18px;display:flex}.rYNBnG_sourceButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.rYNBnG_sourceButton:disabled{cursor:default;opacity:.55}.rYNBnG_sourcePath{word-break:break-all;color:var(--dsw-alias-label-primary);text-align:left}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-workspace/WorkspacePicker.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-workspace";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var WorkspacePicker_module_css_default = {
			"createBody": "rYNBnG_createBody",
			"menuStatus": "rYNBnG_menuStatus",
			"modalAction": "rYNBnG_modalAction",
			"modalError": "rYNBnG_modalError",
			"nameField": "rYNBnG_nameField",
			"sourceButton": "rYNBnG_sourceButton",
			"sourceLabel": "rYNBnG_sourceLabel",
			"sourcePath": "rYNBnG_sourcePath"
		};
		//#endregion
		//#region lib/types/client/WorkspacePicker.js
		const ADD_WORKSPACE = "::add-workspace";
		/**
		* Render the pick menu plus the adoption error dialog.
		* @param props - owner-controlled flow props.
		* @returns menu + dialog elements.
		*/
		function WorkspacePickFlow({ t, open, anchorRef, useWorkspaces, createWorkspace, renameWorkspace, useDirectoryFlow, renderDirectoryFlow, onPick, onClose, addOnly = false, side = "bottom", selectedId }) {
			const workspaceSnapshot = useWorkspaces((state) => state);
			const workspaces = workspaceSnapshot.items;
			const getAnchorRect = (0, react.useCallback)(() => anchorRef?.current?.getBoundingClientRect() ?? null, [anchorRef]);
			const [errorOpen, setErrorOpen] = (0, react.useState)(false);
			const [modalError, setModalError] = (0, react.useState)(null);
			const [flowOpen, setFlowOpen] = (0, react.useState)(false);
			const [pickingFolder, setPickingFolder] = (0, react.useState)(false);
			const [createOpen, setCreateOpen] = (0, react.useState)(false);
			const [projectName, setProjectName] = (0, react.useState)("");
			const [sourcePath, setSourcePath] = (0, react.useState)(null);
			const [creating, setCreating] = (0, react.useState)(false);
			const flowBusy = flowOpen || pickingFolder || creating;
			const flowAvailable = useDirectoryFlow((occupied) => occupied);
			(0, react.useEffect)(() => {
				if (flowOpen && !flowAvailable) setFlowOpen(false);
			}, [flowOpen, flowAvailable]);
			const addEntries = flowAvailable ? [{
				id: ADD_WORKSPACE,
				label: t("menu.addWorkspace"),
				icon: (0, react_jsx_runtime.jsx)(moyuPlus, { size: 16 }),
				disabled: flowBusy
			}] : [];
			const pinAdd = !addOnly && workspaces.length > 0;
			const items = pinAdd ? workspaces.map((workspace) => ({
				id: workspace.workspaceId,
				label: workspace.title,
				icon: (0, react_jsx_runtime.jsx)(moyuFolder, { size: 16 }),
				disabled: flowBusy
			})) : addEntries;
			const menuIsEmpty = items.length === 0;
			const closeModal = () => {
				setErrorOpen(false);
				setModalError(null);
			};
			const folderName = (path) => path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
			const closeCreate = () => {
				if (flowBusy) return;
				setCreateOpen(false);
				setProjectName("");
				setSourcePath(null);
				setModalError(null);
			};
			const openCreate = (0, react.useCallback)(() => {
				onClose();
				setErrorOpen(false);
				setModalError(null);
				setProjectName("");
				setSourcePath(null);
				setCreateOpen(true);
			}, [onClose]);
			const confirmCreate = () => {
				const title = projectName.trim();
				if (creating || sourcePath === null || title === "") return;
				setCreating(true);
				setModalError(null);
				createWorkspace({ path: sourcePath }).then(async (workspace) => {
					if (renameWorkspace !== void 0 && workspace.title !== title) await renameWorkspace(workspace.workspaceId, title);
					setCreateOpen(false);
					onPick(workspace.workspaceId);
				}).catch((reason) => {
					setModalError(reason instanceof Error ? reason.message : String(reason));
				}).finally(() => {
					setCreating(false);
				});
			};
			const openDirectoryFlow = (0, react.useCallback)(() => {
				onClose();
				setErrorOpen(false);
				setModalError(null);
				setFlowOpen(true);
			}, [onClose]);
			const listSettled = addOnly || workspaceSnapshot.phase === "ready";
			const addIsTheOnlyEntry = !pinAdd && listSettled && addEntries.length === 1;
			(0, react.useEffect)(() => {
				if (open && addIsTheOnlyEntry && !flowBusy && !createOpen) openCreate();
			}, [
				open,
				addIsTheOnlyEntry,
				flowBusy,
				createOpen,
				openCreate
			]);
			/** Owner side of the flow conversation: adopt keeps the flow open (busy) until the Host answers. */
			const flowOwner = {
				open: flowOpen,
				busy: pickingFolder,
				onPicked: (path) => {
					setPickingFolder(true);
					setSourcePath(path);
					setProjectName((current) => current.trim() === "" ? folderName(path) : current);
					setFlowOpen(false);
					setPickingFolder(false);
				},
				onCancel: () => {
					setFlowOpen(false);
				},
				onError: (message) => {
					setFlowOpen(false);
					setModalError(message);
				}
			};
			const handleSelect = (id) => {
				if (id === ADD_WORKSPACE) {
					openCreate();
					return;
				}
				onPick(id);
			};
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
					open: open && !addIsTheOnlyEntry && !menuIsEmpty,
					anchor: null,
					items,
					...pinAdd ? { footer: addEntries } : {},
					selectedId,
					onSelect: handleSelect,
					onClose,
					side,
					portal: true,
					getAnchorRect
				}),
				open && !addIsTheOnlyEntry && !menuIsEmpty && workspaceSnapshot.phase === "pending" && (0, react_jsx_runtime.jsx)("div", {
					className: WorkspacePicker_module_css_default.menuStatus,
					role: "status",
					children: t("picker.loading")
				}),
				renderDirectoryFlow(flowOwner),
				(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: createOpen,
					onClose: closeCreate,
					closeLabel: t("close"),
					title: t("createProject.title"),
					footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						disabled: flowBusy,
						onClick: closeCreate,
						children: t("cancel")
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						disabled: flowBusy || sourcePath === null || projectName.trim() === "",
						onClick: confirmCreate,
						children: t("createProject.confirm")
					})] }),
					children: (0, react_jsx_runtime.jsxs)("div", {
						className: WorkspacePicker_module_css_default.createBody,
						children: [(0, react_jsx_runtime.jsx)("input", {
							className: WorkspacePicker_module_css_default.nameField,
							value: projectName,
							placeholder: t("createProject.name"),
							"aria-label": t("createProject.name"),
							autoFocus: true,
							disabled: flowBusy,
							onChange: (event) => setProjectName(event.target.value)
						}), (0, react_jsx_runtime.jsx)("div", {
							className: WorkspacePicker_module_css_default.sourceLabel,
							children: t("createProject.source")
						}), (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: WorkspacePicker_module_css_default.sourceButton,
							disabled: flowBusy || !flowAvailable,
							onClick: openDirectoryFlow,
							children: [(0, react_jsx_runtime.jsx)(moyuFolderPlus, { size: 22 }), (0, react_jsx_runtime.jsx)("span", {
								className: sourcePath === null ? void 0 : WorkspacePicker_module_css_default.sourcePath,
								children: sourcePath ?? t("createProject.addSource")
							})]
						}), modalError !== null && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspacePicker_module_css_default.modalError,
							role: "alert",
							children: modalError
						})]
					})
				}),
				(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: errorOpen,
					onClose: closeModal,
					closeLabel: t("close"),
					title: t("folderError.title"),
					footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						className: WorkspacePicker_module_css_default.modalAction,
						onClick: closeModal,
						children: t("cancel")
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						className: WorkspacePicker_module_css_default.modalAction,
						disabled: !flowAvailable,
						onClick: openDirectoryFlow,
						children: t("folderError.retry")
					})] }),
					children: (0, react_jsx_runtime.jsx)("div", {
						className: WorkspacePicker_module_css_default.modalError,
						role: "alert",
						children: modalError
					})
				})
			] });
		}
		/**
		* The conversation empty-state registration: adapts the owner share to the
		* core flow (all state and semantics live in the flow / the owner).
		* @param props - empty-state slot props (owner share + injected creation callback).
		* @returns the flow element.
		*/
		function WorkspacePicker({ open, anchorRef, useWorkspaces, selectedId, onPick, onClose, createWorkspace, renameWorkspace, useDirectoryFlow, renderSlot, t }) {
			return (0, react_jsx_runtime.jsx)(WorkspacePickFlow, {
				t,
				open,
				anchorRef,
				useWorkspaces,
				createWorkspace,
				renameWorkspace,
				useDirectoryFlow,
				renderDirectoryFlow: (owner) => renderSlot("conversation.hero.workspace.directoryFlow", owner),
				selectedId,
				onPick,
				onClose
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/clukay/Program/deepseek-harness/packages/client/ui-workspace/src/client/WorkspaceBrowser.module.css.mjs
		const css$1 = ".IDS31W_root{--dsh-session-list-edge-inset:var(--dsh-sidebar-inline-padding);--dsh-session-list-scrollbar-width:8px;--dsh-session-list-scrollbar-offset:2px;box-sizing:border-box;min-height:0;padding-right:var(--dsh-session-list-edge-inset);flex-direction:column;flex:1;display:flex}.IDS31W_root.IDS31W_rail{padding-right:0}.IDS31W_surfaceNav{flex-direction:column;flex:none;gap:2px;margin:0 0 14px;display:flex}.IDS31W_surfaceNavItem{width:100%;min-height:32px;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:none;border-radius:8px;align-items:center;gap:9px;padding:0 10px;font-size:13px;line-height:20px;display:flex}.IDS31W_surfaceNavItem:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.IDS31W_surfaceNavItemActive{background:var(--dsw-specific-sidebar-nav-item-active);color:var(--dsw-alias-label-primary)}.IDS31W_surfaceNavItem:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}.IDS31W_surfaceNavItem>svg{flex:none;width:16px;height:16px}.IDS31W_surfaceNavRail{align-items:center;gap:4px;margin-bottom:12px}.IDS31W_surfaceNavRail .IDS31W_surfaceNavItem{justify-content:center;width:36px;min-height:36px;padding:0}.IDS31W_iconButton{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.IDS31W_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.IDS31W_sectionHeader{box-sizing:border-box;height:36px;color:var(--dsw-alias-label-tertiary);border-radius:12px;flex:none;justify-content:flex-end;align-items:center;gap:4px;margin-bottom:4px;padding-left:4px;display:flex;overflow:hidden}.IDS31W_root:not(.IDS31W_rail) .IDS31W_sectionHeader{margin-top:2px;margin-right:-4px}.IDS31W_sectionLabel{white-space:nowrap;opacity:1;visibility:visible;min-width:0;max-width:45%;transition:max-width .18s var(--ds-ease-in-out), margin-right .18s var(--ds-ease-in-out), opacity .12s var(--ds-ease-in-out), transform .18s var(--ds-ease-in-out), visibility 0s linear;flex:none;line-height:20px;overflow:hidden}.IDS31W_sectionLabelHidden{opacity:0;visibility:hidden;max-width:0;margin-right:-4px;transition-delay:0s,0s,0s,0s,.18s;transform:translate(-4px)}.IDS31W_searchSlot{box-sizing:border-box;min-width:0;max-width:28px;transition:max-width .18s var(--ds-ease-in-out), padding-left .18s var(--ds-ease-in-out);flex:1;align-items:center;margin-left:auto;padding-left:0;display:flex}.IDS31W_searchSlotExpanded{max-width:100%;padding-left:0}.IDS31W_headerActions{opacity:1;visibility:visible;max-width:60px;transition:max-width .18s var(--ds-ease-in-out), opacity .12s var(--ds-ease-in-out), transform .18s var(--ds-ease-in-out), visibility 0s linear;flex:none;align-items:center;gap:4px;display:flex;overflow:hidden}.IDS31W_headerActionsHidden{opacity:0;visibility:hidden;pointer-events:none;max-width:0;transition-delay:0s,0s,0s,.18s;transform:translate(4px)}.IDS31W_search{box-sizing:border-box;cursor:text;width:100%;height:28px;color:var(--dsw-alias-label-secondary);transition:width .18s var(--ds-ease-in-out), padding .18s var(--ds-ease-in-out), border-color .18s var(--ds-ease-in-out), background-color .18s var(--ds-ease-in-out);background:0 0;border:none;border-radius:50%;flex:none;align-items:center;gap:0;margin:0;padding:0;display:flex;overflow:hidden}.IDS31W_searchExpanded{border:1px solid var(--dsw-alias-border-l2);width:calc(100% + 4px);height:30px;color:var(--dsw-alias-label-caption);background:0 0;border-radius:10px;margin-inline:-2px;padding:0 4px 0 0}.IDS31W_searchButton{cursor:pointer;width:28px;height:28px;color:inherit;background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.IDS31W_searchExpanded .IDS31W_searchButton{width:28px;height:30px}.IDS31W_searchButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.IDS31W_searchExpanded .IDS31W_searchButton:hover{background:0 0}.IDS31W_searchInput{opacity:0;pointer-events:none;width:0;min-width:0;color:var(--dsw-alias-label-primary);transition:opacity .12s var(--ds-ease-in-out);background:0 0;border:none;outline:none;flex:1;font-size:13px;line-height:18px}.IDS31W_searchExpanded .IDS31W_searchInput{opacity:1;pointer-events:auto;margin-left:-2px}.IDS31W_searchInput::placeholder{color:var(--dsw-alias-label-tertiary)}.IDS31W_clearButton{cursor:pointer;width:24px;height:24px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.IDS31W_clearButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.IDS31W_rail .IDS31W_sectionHeader{justify-content:flex-start;gap:0;margin-bottom:12px;padding-left:0}.IDS31W_rail .IDS31W_headerActions{max-width:none}.IDS31W_rail .IDS31W_iconButton{width:36px;height:36px;color:var(--dsw-alias-label-primary)}.IDS31W_rail .IDS31W_search{background:0 0;border-color:#0000;gap:0;width:36px;height:36px;margin:0 0 12px;padding:0}.IDS31W_rail .IDS31W_searchButton{width:36px;height:36px;color:var(--dsw-alias-label-primary)}.IDS31W_rail .IDS31W_searchButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.IDS31W_listArea{min-height:0;margin-left:-4px;margin-right:calc(-1 * var(--dsh-session-list-edge-inset));flex-direction:column;flex:1;padding-left:4px;display:flex;overflow:visible}.IDS31W_rail .IDS31W_listArea{margin-left:0;margin-right:0;padding-left:0}.IDS31W_treeBody{flex-direction:column;flex:1;min-height:0;display:flex;position:relative}.IDS31W_fade{left:0;right:var(--dsh-session-list-edge-inset);background:linear-gradient(to bottom, transparent, var(--dsw-specific-sidebar-fill));pointer-events:none;height:24px;position:absolute;bottom:0}.IDS31W_wide{animation:IDS31W_wide-in .2s var(--ds-ease-in-out)}@keyframes IDS31W_wide-in{0%{opacity:0}}.IDS31W_list{min-height:0;margin-left:-4px;margin-right:var(--dsh-session-list-scrollbar-offset);padding-left:4px;padding-right:calc(var(--dsh-session-list-edge-inset) - var(--dsh-session-list-scrollbar-width) - var(--dsh-session-list-scrollbar-offset));scrollbar-gutter:stable;flex:1;padding-bottom:16px;overflow-y:auto}.IDS31W_flatList>*+*,.IDS31W_searchTree>[role=treeitem]+[role=treeitem],.IDS31W_groupSection>*+*{margin-top:2px}.IDS31W_searchStatus,.IDS31W_searchWarning{color:var(--dsw-alias-label-tertiary);padding:10px 12px;font-size:12px;line-height:18px}.IDS31W_searchWarning{color:var(--dsw-alias-label-secondary)}.IDS31W_groupSection{position:relative}.IDS31W_groupSection+.IDS31W_groupSection{margin-top:4px}.IDS31W_listTopDropIndicator,.IDS31W_workspaceDropBefore:before,.IDS31W_workspaceDropAfter:after{content:\"\";z-index:1;background:linear-gradient(55deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 0 / 5px 7px no-repeat, linear-gradient(125deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 5px / 5px 7px no-repeat, linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px / calc(100% - 4px) 2px no-repeat;pointer-events:none;height:12px;position:absolute;left:0;right:0}.IDS31W_listTopDropIndicator{top:-8px;left:0;right:var(--dsh-session-list-edge-inset)}.IDS31W_listTopDropActive>.IDS31W_workspaceDropBefore:first-child:before{display:none}.IDS31W_workspaceDropBefore:before{top:-8px}.IDS31W_workspaceDropAfter:after{bottom:-8px}.IDS31W_sessionOverflowButton{cursor:pointer;text-align:left;width:100%;height:28px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:8px;padding:0 12px 0 28px;font-size:12px}.IDS31W_groupSection>.IDS31W_sessionOverflowButton{margin-top:0}.IDS31W_sessionOverflowButton:hover{color:var(--dsw-alias-label-secondary);background:0 0}.IDS31W_empty{color:var(--dsw-alias-label-tertiary);padding:16px 4px;font-size:13px}.IDS31W_renameInput{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);width:100%;height:44px;color:var(--dsw-alias-label-primary);background:0 0;border-radius:22px;outline:none;padding:7px 14px;font-size:14px;font-weight:400;line-height:22px}.IDS31W_renameInput:disabled{color:var(--dsw-alias-label-dimmed)}.IDS31W_renameError{color:var(--dsw-alias-state-error-primary);margin-top:8px;font-size:12px;line-height:18px}.IDS31W_deleteAction:not(:disabled){color:var(--dsw-alias-state-error-primary)}.IDS31W_deleteStatus{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}@media (prefers-reduced-motion:reduce){.IDS31W_wide{animation:none}.IDS31W_search,.IDS31W_sectionLabel,.IDS31W_searchSlot,.IDS31W_searchInput,.IDS31W_headerActions{transition:none}}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-workspace";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var WorkspaceBrowser_module_css_default = {
			"clearButton": "IDS31W_clearButton",
			"deleteAction": "IDS31W_deleteAction",
			"deleteStatus": "IDS31W_deleteStatus",
			"empty": "IDS31W_empty",
			"fade": "IDS31W_fade",
			"flatList": "IDS31W_flatList",
			"groupSection": "IDS31W_groupSection",
			"headerActions": "IDS31W_headerActions",
			"headerActionsHidden": "IDS31W_headerActionsHidden",
			"iconButton": "IDS31W_iconButton",
			"list": "IDS31W_list",
			"listArea": "IDS31W_listArea",
			"listTopDropActive": "IDS31W_listTopDropActive",
			"listTopDropIndicator": "IDS31W_listTopDropIndicator",
			"rail": "IDS31W_rail",
			"renameError": "IDS31W_renameError",
			"renameInput": "IDS31W_renameInput",
			"root": "IDS31W_root",
			"search": "IDS31W_search",
			"searchButton": "IDS31W_searchButton",
			"searchExpanded": "IDS31W_searchExpanded",
			"searchInput": "IDS31W_searchInput",
			"searchSlot": "IDS31W_searchSlot",
			"searchSlotExpanded": "IDS31W_searchSlotExpanded",
			"searchStatus": "IDS31W_searchStatus",
			"searchTree": "IDS31W_searchTree",
			"searchWarning": "IDS31W_searchWarning",
			"sectionHeader": "IDS31W_sectionHeader",
			"sectionLabel": "IDS31W_sectionLabel",
			"sectionLabelHidden": "IDS31W_sectionLabelHidden",
			"sessionOverflowButton": "IDS31W_sessionOverflowButton",
			"surfaceNav": "IDS31W_surfaceNav",
			"surfaceNavItem": "IDS31W_surfaceNavItem",
			"surfaceNavItemActive": "IDS31W_surfaceNavItemActive",
			"surfaceNavRail": "IDS31W_surfaceNavRail",
			"treeBody": "IDS31W_treeBody",
			"wide": "IDS31W_wide",
			"wide-in": "IDS31W_wide-in",
			"workspaceDropAfter": "IDS31W_workspaceDropAfter",
			"workspaceDropBefore": "IDS31W_workspaceDropBefore"
		};
		//#endregion
		//#region lib/types/client/WorkspaceBrowser.js
		/**
		* The workspace/session browsing region filling the sidebar shell's
		* `sidebar.workspaces` hole: section header (title + view options + add
		* workspace), search, the grouped tree or flat list, and the workspace
		* dialogs. Wide state renders the full browser; rail state renders the two
		* region icons (search / add workspace) as 36px controls on the shell's shared
		* rail entry path, each requesting expansion through the owner share. Adding
		* is the header button's one action, so it raises the directory flow with no
		* menu in between; the flow and its error dialog live in WorkspacePicker
		* (same package — direct composition, no slot between them).
		*/
		/**
		* Codex-style application navigation; workspace/session browsing stays below it.
		* Pull Requests and Browser surfaces are intentionally omitted from the Moyu
		* build — they are not part of the three-tool product surface.
		*/
		function SurfaceNavigation({ wide, surface, selectSurface, t, startSession }) {
			const items = [
				{
					id: "conversation",
					label: t("surface.conversation"),
					icon: (0, react_jsx_runtime.jsx)(moyuSquarePen, { size: 18 }),
					create: true
				},
				{
					id: "scheduled",
					label: t("surface.scheduled"),
					icon: (0, react_jsx_runtime.jsx)(moyuListTodo, { size: 18 })
				},
				{
					id: "plugins",
					label: t("surface.plugins"),
					icon: (0, react_jsx_runtime.jsx)(moyuBlocks, { size: 18 })
				}
			];
			return (0, react_jsx_runtime.jsx)("nav", {
				className: clsx(WorkspaceBrowser_module_css_default.surfaceNav, !wide && WorkspaceBrowser_module_css_default.surfaceNavRail),
				"aria-label": t("surface.navigation"),
				children: items.map((item) => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: item.label,
					side: "right",
					disabled: wide,
					children: (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: clsx(WorkspaceBrowser_module_css_default.surfaceNavItem, surface === item.id && WorkspaceBrowser_module_css_default.surfaceNavItemActive),
						"aria-current": surface === item.id ? "page" : void 0,
						"aria-label": item.label,
						onClick: () => {
							if (item.create) startSession();
							else selectSurface(item.id);
						},
						children: [item.icon, wide && (0, react_jsx_runtime.jsx)("span", { children: item.label })]
					})
				}, item.id))
			});
		}
		/**
		* Column slide length (--ds-transition-duration-slow): rail-search focus waits it out —
		* focus() forces a synchronous layout and would jank the slide.
		*/
		const EXPAND_SLIDE_MS = 300;
		/** Pause between the latest keystroke and a Host content-search request. */
		const SEARCH_DEBOUNCE_MS = 250;
		/** `session.search` wire bound, measured in JavaScript UTF-16 code units. */
		const SEARCH_QUERY_MAX_CODE_UNITS = 500;
		/** Session rows visible per Workspace before the local overflow control. */
		const COLLAPSED_SESSION_LIMIT = 5;
		/** Keep controlled input and RPC payload inside the session.search wire contract. */
		function sanitizeSearchQuery(value) {
			const withoutNul = value.replaceAll("\0", "");
			if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul;
			let end = SEARCH_QUERY_MAX_CODE_UNITS;
			const last = withoutNul.charCodeAt(end - 1);
			const next = withoutNul.charCodeAt(end);
			if (last >= 55296 && last <= 56319 && next >= 56320 && next <= 57343) end--;
			return withoutNul.slice(0, end);
		}
		/** Immutable membership toggle for the local expand-all array. */
		function toggled(list, key) {
			return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
		}
		/**
		* Accept the native drag at document level while a row drag is active: row
		* hover still owns the insertion marker, and releasing outside the list must
		* not be rendered as a rejected drop before dragend commits that last marker.
		*/
		function useNativeDragAcceptance(active) {
			(0, react.useEffect)(() => {
				if (!active) return;
				const acceptDrag = (event) => {
					event.preventDefault();
					if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "move";
				};
				const acceptDrop = (event) => {
					event.preventDefault();
				};
				document.addEventListener("dragover", acceptDrag);
				document.addEventListener("drop", acceptDrop);
				return () => {
					document.removeEventListener("dragover", acceptDrag);
					document.removeEventListener("drop", acceptDrop);
				};
			}, [active]);
		}
		/** Reconcile a stored view order with the Workspace's current session account. */
		function reconciledSessionOrder(sessionIds, stored) {
			if (stored === void 0) return [...sessionIds];
			const byId = new Map(sessionIds.map((id) => [id, id]));
			const ordered = [];
			const included = /* @__PURE__ */ new Set();
			for (const key of stored) {
				const id = byId.get(key);
				if (id === void 0 || included.has(key)) continue;
				ordered.push(id);
				included.add(key);
			}
			for (const id of sessionIds) {
				if (included.has(id)) continue;
				ordered.push(id);
			}
			return ordered;
		}
		/** Newest update first with stable Session identity as the tie-break. */
		function compareSessionRecency(a, b, byId) {
			const aUpdatedAt = byId[a]?.updatedAt ?? Number.NEGATIVE_INFINITY;
			const bUpdatedAt = byId[b]?.updatedAt ?? Number.NEGATIVE_INFINITY;
			if (aUpdatedAt !== bUpdatedAt) return bUpdatedAt - aUpdatedAt;
			return a < b ? -1 : 1;
		}
		/** Reconcile one editable order account and apply its activity-promotion policy. */
		function nextSessionOrderAccount({ sessionIds, previousOrder, previousUpdatedAt, list, orderBy, sortByRecency }) {
			let order = reconciledSessionOrder(sessionIds, previousOrder);
			if (sortByRecency) order.sort((a, b) => compareSessionRecency(a, b, list.byId));
			else if (orderBy === "updated") {
				const promoted = sessionIds.filter((id) => {
					const session = list.byId[id];
					return session !== void 0 && (previousUpdatedAt[id] === void 0 || session.updatedAt > previousUpdatedAt[id]);
				}).sort((a, b) => compareSessionRecency(a, b, list.byId));
				if (promoted.length > 0) {
					const promotedIds = new Set(promoted);
					order = [...promoted, ...order.filter((id) => !promotedIds.has(id))];
				}
			}
			const updatedAt = {};
			for (const id of sessionIds) {
				const session = list.byId[id];
				if (session !== void 0) updatedAt[id] = session.updatedAt;
			}
			const orderChanged = previousOrder === void 0 || order.length !== previousOrder.length || order.some((id, index) => id !== previousOrder[index]);
			const timestampsChanged = Object.keys(updatedAt).length !== Object.keys(previousUpdatedAt).length || Object.entries(updatedAt).some(([id, timestamp]) => previousUpdatedAt[id] !== timestamp);
			return {
				order,
				updatedAt,
				changed: orderChanged || timestampsChanged
			};
		}
		/** Grouping and ordering menu; own open state so it resets with the wide chrome. */
		function ViewOptionsMenu({ groupBy, orderBy, onGroupPick, onOrderPick, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open,
				onClose: () => {
					setOpen(false);
				},
				items: [
					{
						type: "label",
						id: "group-by",
						text: t("groupBy.label")
					},
					{
						id: "workspace",
						label: t("groupBy.workspace")
					},
					{
						id: "flat",
						label: t("groupBy.flat")
					},
					{
						type: "separator",
						id: "order-by-separator"
					},
					{
						type: "label",
						id: "order-by",
						text: t("orderBy.label")
					},
					{
						id: "manual",
						label: t("orderBy.manual")
					},
					{
						id: "updated",
						label: t("orderBy.updated")
					}
				],
				selectedIds: [groupBy, orderBy],
				onSelect: (id) => {
					if (id === "workspace" || id === "flat") onGroupPick(id);
					else if (id === "manual" || id === "updated") onOrderPick(id);
					setOpen(false);
				},
				align: "end",
				dense: true,
				portal: true,
				anchor: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: t("viewOptions.label"),
					side: "bottom",
					delayMs: 500,
					children: (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: clsx(WorkspaceBrowser_module_css_default.iconButton, WorkspaceBrowser_module_css_default.wide),
						"aria-label": t("viewOptions.label"),
						onClick: () => {
							setOpen((v) => !v);
						},
						children: (0, react_jsx_runtime.jsx)(moyuSlidersHorizontal, {})
					})
				})
			});
		}
		/** Resolve an insertion side from the full rendered workspace group. */
		function workspaceGroupHalf(e) {
			const rect = e.currentTarget.getBoundingClientRect();
			return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
		}
		/** The scrolling session tree; unmounting drops the sessions subscription and expand-all state. */
		function SessionTree({ useSessions, startSession, open, forkSession, workspaces, archivedSessionIds, onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, insertWorkspaceBefore, insertSessionBefore, orderBy, groupExpansion, setGroupExpanded, sessionOrderByAccount, sessionUpdatedAtByAccount, syncSessionOrderAccount, setSessionOrder, t }) {
			const list = useSessions((s) => s);
			const { pinnedIds, unreadIds, togglePin, toggleUnread } = useSessionMeta();
			const workspaceMoveTargets = (0, react.useMemo)(() => [{
				id: void 0,
				label: t("moveToWorkspace.none")
			}, ...workspaces.map((ws) => ({
				id: ws.workspaceId,
				label: ws.title
			}))], [workspaces, t]);
			const onMoveToWorkspace = (id, workspaceId) => {
				if (workspaceId === void 0) return;
				insertSessionBefore(workspaceId, id).catch((reason) => {
					console.warn("move session to workspace failed:", reason);
				});
			};
			const onCopySession = (id) => {
				forkSession(id);
			};
			const onCopyMarkdown = async (id) => {
				try {
					const res = await fetch("/moyu/session-export", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ sessionId: id })
					});
					if (!res.ok) return;
					const data = await res.json();
					if (typeof data.markdown === "string" && data.markdown) await copyText(data.markdown);
				} catch {}
			};
			const current = list.current;
			const [expandedSessionGroups, setExpandedSessionGroups] = (0, react.useState)([]);
			const [drag, setDrag] = (0, react.useState)(null);
			const sessionDropCommitted = (0, react.useRef)(false);
			const [workspaceDrag, setWorkspaceDrag] = (0, react.useState)(null);
			const workspaceDropCommitted = (0, react.useRef)(false);
			const previousOrderBy = (0, react.useRef)(orderBy);
			useNativeDragAcceptance(drag !== null || workspaceDrag !== null);
			const currentGroup = current === void 0 ? void 0 : workspaces.find((w) => w.sessionIds.includes(current))?.workspaceId ?? "";
			(0, react.useEffect)(() => {
				if (current === void 0 || currentGroup === void 0 || Object.hasOwn(groupExpansion, currentGroup)) return;
				setGroupExpanded(currentGroup, true);
			}, [
				current,
				currentGroup,
				setGroupExpanded,
				groupExpansion
			]);
			const expandedGroups = (0, react.useMemo)(() => Object.entries(groupExpansion).filter(([, expanded]) => expanded).map(([key]) => key), [groupExpansion]);
			const ungroupedSessionIds = (0, react.useMemo)(() => {
				const accounted = new Set(workspaces.flatMap((workspace) => workspace.sessionIds));
				return list.ids.filter((id) => list.byId[id] !== void 0 && !accounted.has(id));
			}, [list, workspaces]);
			(0, react.useEffect)(() => {
				if (list.phase !== "ready") return;
				const switchedToUpdated = previousOrderBy.current !== "updated" && orderBy === "updated";
				previousOrderBy.current = orderBy;
				const accounts = [...workspaces.map((workspace) => ({
					key: workspace.workspaceId,
					sessionIds: workspace.sessionIds.filter((id) => list.byId[id] !== void 0)
				})), {
					key: "",
					sessionIds: ungroupedSessionIds
				}];
				for (const { key, sessionIds } of accounts) {
					const previousOrder = sessionOrderByAccount[key];
					const next = nextSessionOrderAccount({
						sessionIds,
						previousOrder,
						previousUpdatedAt: sessionUpdatedAtByAccount[key] ?? {},
						list,
						orderBy,
						sortByRecency: orderBy === "updated" && (previousOrder === void 0 || switchedToUpdated)
					});
					if (next.changed) syncSessionOrderAccount(key, next.order.map((id) => id), next.updatedAt);
				}
			}, [
				list,
				orderBy,
				sessionOrderByAccount,
				sessionUpdatedAtByAccount,
				syncSessionOrderAccount,
				ungroupedSessionIds,
				workspaces
			]);
			const orderedWorkspaces = (0, react.useMemo)(() => {
				return workspaces.map((workspace) => {
					const stored = sessionOrderByAccount[workspace.workspaceId];
					const sessionIds = reconciledSessionOrder(workspace.sessionIds, stored);
					return {
						...workspace,
						sessionIds
					};
				});
			}, [sessionOrderByAccount, workspaces]);
			const orderedUngroupedSessionIds = (0, react.useMemo)(() => reconciledSessionOrder(ungroupedSessionIds, sessionOrderByAccount[""]), [sessionOrderByAccount, ungroupedSessionIds]);
			const groups = (0, react.useMemo)(() => deriveGroups(list, orderedWorkspaces, archivedSessionIds, {
				expandedGroups,
				...sessionOrderByAccount[""] === void 0 ? {} : { ungroupedOrder: sessionOrderByAccount[""] }
			}, pinnedIds), [
				list,
				orderedWorkspaces,
				archivedSessionIds,
				expandedGroups,
				sessionOrderByAccount,
				pinnedIds
			]);
			const now = Date.now();
			const commitSessionDrag = (activeDrag, over) => {
				if (sessionDropCommitted.current) return;
				sessionDropCommitted.current = true;
				setDrag(null);
				const group = groups.find((candidate) => candidate.key === activeDrag.accountKey);
				if (group === void 0) return;
				const targetIndex = group.sessions.findIndex((session) => session.id === over.id);
				if (targetIndex === -1) return;
				const anchor = over.half === "before" ? over.id : group.sessions[targetIndex + 1]?.id;
				if (anchor === activeDrag.sessionId) return;
				const sourceIndex = group.sessions.findIndex((session) => session.id === activeDrag.sessionId);
				const anchorIndex = anchor === void 0 ? group.sessions.length : group.sessions.findIndex((session) => session.id === anchor);
				if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return;
				const accountSessionIds = activeDrag.accountKey === "" ? orderedUngroupedSessionIds : orderedWorkspaces.find((workspace) => workspace.workspaceId === activeDrag.accountKey)?.sessionIds;
				if (accountSessionIds === void 0) return;
				const nextOrder = accountSessionIds.filter((id) => id !== activeDrag.sessionId);
				const insertAt = anchor === void 0 ? nextOrder.length : nextOrder.indexOf(anchor);
				nextOrder.splice(insertAt === -1 ? nextOrder.length : insertAt, 0, activeDrag.sessionId);
				setSessionOrder(activeDrag.accountKey, nextOrder.map((id) => id));
				if (orderBy === "updated" || activeDrag.accountKey === "") return;
				insertSessionBefore(activeDrag.accountKey, activeDrag.sessionId, anchor).catch((reason) => {
					console.warn("session reorder rejected:", reason);
				});
			};
			const commitWorkspaceDrag = (activeDrag, over) => {
				if (workspaceDropCommitted.current) return;
				workspaceDropCommitted.current = true;
				setWorkspaceDrag(null);
				const rowIndex = workspaces.findIndex((workspace) => workspace.workspaceId === over.id);
				if (rowIndex === -1) return;
				const anchor = over.half === "before" ? over.id : workspaces[rowIndex + 1]?.workspaceId;
				if (anchor === activeDrag.workspaceId) return;
				const sourceIndex = workspaces.findIndex((workspace) => workspace.workspaceId === activeDrag.workspaceId);
				const anchorIndex = anchor === void 0 ? workspaces.length : workspaces.findIndex((workspace) => workspace.workspaceId === anchor);
				if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return;
				insertWorkspaceBefore(activeDrag.workspaceId, anchor).catch((reason) => {
					console.warn("workspace reorder rejected:", reason);
				});
			};
			const workspaceDropAtListStart = groups[0]?.workspaceId !== void 0 && workspaceDrag?.over?.id === groups[0].workspaceId && workspaceDrag.over.half === "before";
			return (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(WorkspaceBrowser_module_css_default.treeBody, WorkspaceBrowser_module_css_default.wide),
				children: [
					workspaceDropAtListStart && (0, react_jsx_runtime.jsx)("span", {
						className: WorkspaceBrowser_module_css_default.listTopDropIndicator,
						"aria-hidden": "true"
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: clsx(WorkspaceBrowser_module_css_default.list, workspaceDropAtListStart && WorkspaceBrowser_module_css_default.listTopDropActive),
						role: "tree",
						"aria-label": t("section.sessions"),
						children: [groups.length === 0 && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.empty,
							children: t("empty.none")
						}), groups.map((group) => {
							const workspaceId = group.workspaceId;
							const workspaceMarker = workspaceId !== void 0 && workspaceDrag?.over?.id === workspaceId ? workspaceDrag.over.half : null;
							const workspaceDragProps = workspaceId === void 0 ? void 0 : {
								start: () => {
									workspaceDropCommitted.current = false;
									setWorkspaceDrag({
										workspaceId,
										over: null
									});
								},
								end: () => {
									if (workspaceDrag?.over !== null && workspaceDrag?.over !== void 0) commitWorkspaceDrag(workspaceDrag, workspaceDrag.over);
									else setWorkspaceDrag(null);
									workspaceDropCommitted.current = false;
								}
							};
							const hoverWorkspace = workspaceId === void 0 ? void 0 : (half) => {
								setWorkspaceDrag((active) => active === null ? active : {
									...active,
									over: {
										id: workspaceId,
										half
									}
								});
							};
							const dropWorkspace = workspaceId === void 0 ? void 0 : (half) => {
								if (workspaceDrag === null) return;
								commitWorkspaceDrag(workspaceDrag, {
									id: workspaceId,
									half
								});
							};
							return (0, react_jsx_runtime.jsxs)("div", {
								className: clsx(WorkspaceBrowser_module_css_default.groupSection, workspaceMarker === "before" && WorkspaceBrowser_module_css_default.workspaceDropBefore, workspaceMarker === "after" && WorkspaceBrowser_module_css_default.workspaceDropAfter),
								onDragOver: workspaceDrag === null || hoverWorkspace === void 0 ? void 0 : (e) => {
									e.preventDefault();
									e.dataTransfer.dropEffect = "move";
									hoverWorkspace(workspaceGroupHalf(e));
								},
								onDrop: workspaceDrag === null || dropWorkspace === void 0 ? void 0 : (e) => {
									e.preventDefault();
									dropWorkspace(workspaceGroupHalf(e));
								},
								children: [
									(0, react_jsx_runtime.jsx)(ProjectRowItem, {
										group,
										t,
										onToggle: () => {
											if (group.expanded) setExpandedSessionGroups((keys) => keys.filter((key) => key !== group.key));
											setGroupExpanded(group.key, !group.expanded);
										},
										onCreate: () => {
											if (group.workspaceId !== void 0) {
												setGroupExpanded(group.key, true);
												startSession(group.workspaceId);
											}
										},
										drag: workspaceDragProps,
										actions: group.workspaceId === void 0 ? void 0 : {
											rename: () => {
												/* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
												if (group.workspaceId !== void 0) onRenameRequest(group.workspaceId, group.label);
											},
											delete: () => {
												/* v8 ignore next -- narrowing guard: the actions object exists only for real-workspace groups. */
												if (group.workspaceId !== void 0) onDeleteRequest(group.workspaceId, group.label);
											}
										}
									}),
									(expandedSessionGroups.includes(group.key) ? group.sessions : group.sessions.slice(0, COLLAPSED_SESSION_LIMIT)).map((node) => {
										const sameGroupDrag = drag !== null && drag.accountKey === group.key;
										return (0, react_jsx_runtime.jsx)(SessionNodeItem, {
											node,
											currentId: current,
											now,
											onOpen: open,
											onRename: onSessionRename,
											onFork: forkSession,
											onArchive: onSessionArchive,
											drag: {
												start: () => {
													sessionDropCommitted.current = false;
													setDrag({
														accountKey: group.key,
														sessionId: node.id,
														over: null
													});
												},
												active: sameGroupDrag,
												marker: sameGroupDrag && drag.over?.id === node.id ? drag.over.half : null,
												hover: (half) => {
													/* v8 ignore next -- narrowing guard: Rows gates hover on `active`, which is false while the drag state is null. */
													setDrag((d) => d === null ? d : {
														...d,
														over: {
															id: node.id,
															half
														}
													});
												},
												drop: (half) => {
													/* v8 ignore next -- narrowing guard: Rows gates drop on `active`, which is false while the drag state is null. */
													if (drag === null) return;
													commitSessionDrag(drag, {
														id: node.id,
														half
													});
												},
												end: () => {
													if (drag?.over !== null && drag?.over !== void 0) commitSessionDrag(drag, drag.over);
													else setDrag(null);
													sessionDropCommitted.current = false;
												}
											},
											t,
											pinned: pinnedIds.has(node.id),
											unread: unreadIds.has(node.id),
											onTogglePin: togglePin,
											onToggleUnread: toggleUnread,
											workspaces: workspaceMoveTargets,
											onMoveToWorkspace,
											onCopySession,
											onCopyMarkdown
										}, node.id);
									}),
									group.sessions.length > COLLAPSED_SESSION_LIMIT && (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: WorkspaceBrowser_module_css_default.sessionOverflowButton,
										"aria-expanded": expandedSessionGroups.includes(group.key),
										onClick: () => {
											setExpandedSessionGroups((keys) => toggled(keys, group.key));
										},
										children: expandedSessionGroups.includes(group.key) ? t("sessions.collapse") : t("sessions.expand", { n: group.sessions.length - COLLAPSED_SESSION_LIMIT })
									})
								]
							}, group.key);
						})]
					}),
					(0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.fade })
				]
			});
		}
		/** The flat "In one list" body: every session is one draggable top-level row. */
		function FlatList({ useSessions, open, forkSession, onSessionRename, onSessionArchive, archivedSessionIds, workspaces, insertSessionBefore, orderBy, sessionOrderByAccount, sessionUpdatedAtByAccount, syncSessionOrderAccount, setSessionOrder, t }) {
			const list = useSessions((s) => s);
			const { pinnedIds, unreadIds, togglePin, toggleUnread } = useSessionMeta();
			const workspaceMoveTargets = (0, react.useMemo)(() => [{
				id: void 0,
				label: t("moveToWorkspace.none")
			}, ...workspaces.map((ws) => ({
				id: ws.workspaceId,
				label: ws.title
			}))], [workspaces, t]);
			const onMoveToWorkspace = (id, workspaceId) => {
				if (workspaceId === void 0) return;
				insertSessionBefore(workspaceId, id).catch((reason) => {
					console.warn("move session to workspace failed:", reason);
				});
			};
			const onCopySession = (id) => {
				forkSession(id);
			};
			const onCopyMarkdown = async (id) => {
				try {
					const res = await fetch("/moyu/session-export", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ sessionId: id })
					});
					if (!res.ok) return;
					const data = await res.json();
					if (typeof data.markdown === "string" && data.markdown) await copyText(data.markdown);
				} catch {}
			};
			const baseRows = (0, react.useMemo)(() => deriveFlat(list, archivedSessionIds, pinnedIds), [list, archivedSessionIds, pinnedIds]);
			const sessionIds = (0, react.useMemo)(() => baseRows.map((row) => row.id), [baseRows]);
			const previousOrderBy = (0, react.useRef)(orderBy);
			(0, react.useEffect)(() => {
				if (list.phase !== "ready") return;
				const previousOrder = sessionOrderByAccount[FLAT_SESSION_ORDER_KEY];
				const previousUpdatedAt = sessionUpdatedAtByAccount["__flat_session_order__"] ?? {};
				const switchedToUpdated = previousOrderBy.current !== "updated" && orderBy === "updated";
				previousOrderBy.current = orderBy;
				const next = nextSessionOrderAccount({
					sessionIds,
					previousOrder,
					previousUpdatedAt,
					list,
					orderBy,
					sortByRecency: orderBy === "updated" && (previousOrder === void 0 || switchedToUpdated)
				});
				if (next.changed) syncSessionOrderAccount(FLAT_SESSION_ORDER_KEY, next.order.map((id) => id), next.updatedAt);
			}, [
				list,
				orderBy,
				sessionOrderByAccount,
				sessionUpdatedAtByAccount,
				sessionIds,
				syncSessionOrderAccount
			]);
			const rows = (0, react.useMemo)(() => {
				const byId = new Map(baseRows.map((row) => [row.id, row]));
				return reconciledSessionOrder(sessionIds, sessionOrderByAccount[FLAT_SESSION_ORDER_KEY]).flatMap((id) => {
					const row = byId.get(id);
					return row === void 0 ? [] : [row];
				});
			}, [
				baseRows,
				sessionOrderByAccount,
				sessionIds
			]);
			const [drag, setDrag] = (0, react.useState)(null);
			const dropCommitted = (0, react.useRef)(false);
			useNativeDragAcceptance(drag !== null);
			const commitDrag = (activeDrag, over) => {
				if (dropCommitted.current) return;
				dropCommitted.current = true;
				setDrag(null);
				const targetIndex = rows.findIndex((row) => row.id === over.id);
				if (targetIndex === -1) return;
				const anchor = over.half === "before" ? over.id : rows[targetIndex + 1]?.id;
				if (anchor === activeDrag.sessionId) return;
				const sourceIndex = rows.findIndex((row) => row.id === activeDrag.sessionId);
				const anchorIndex = anchor === void 0 ? rows.length : rows.findIndex((row) => row.id === anchor);
				if (sourceIndex !== -1 && (anchorIndex === sourceIndex || anchorIndex === sourceIndex + 1)) return;
				const nextOrder = rows.map((row) => row.id).filter((id) => id !== activeDrag.sessionId);
				const insertAt = anchor === void 0 ? nextOrder.length : nextOrder.indexOf(anchor);
				nextOrder.splice(insertAt === -1 ? nextOrder.length : insertAt, 0, activeDrag.sessionId);
				setSessionOrder(FLAT_SESSION_ORDER_KEY, nextOrder.map((id) => id));
			};
			const now = Date.now();
			return (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(WorkspaceBrowser_module_css_default.treeBody, WorkspaceBrowser_module_css_default.wide),
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: clsx(WorkspaceBrowser_module_css_default.list, WorkspaceBrowser_module_css_default.flatList),
					role: "tree",
					"aria-label": t("section.sessions"),
					children: [rows.length === 0 && (0, react_jsx_runtime.jsx)("div", {
						className: WorkspaceBrowser_module_css_default.empty,
						children: t("empty.none")
					}), rows.map((node) => {
						const active = drag !== null;
						return (0, react_jsx_runtime.jsx)(SessionNodeItem, {
							node,
							currentId: list.current,
							now,
							onOpen: open,
							onRename: onSessionRename,
							onFork: forkSession,
							onArchive: onSessionArchive,
							flat: true,
							drag: {
								start: () => {
									dropCommitted.current = false;
									setDrag({
										accountKey: FLAT_SESSION_ORDER_KEY,
										sessionId: node.id,
										over: null
									});
								},
								active,
								marker: active && drag.over?.id === node.id ? drag.over.half : null,
								hover: (half) => {
									setDrag((current) => current === null ? current : {
										...current,
										over: {
											id: node.id,
											half
										}
									});
								},
								drop: (half) => {
									if (drag !== null) commitDrag(drag, {
										id: node.id,
										half
									});
								},
								end: () => {
									if (drag?.over !== null && drag?.over !== void 0) commitDrag(drag, drag.over);
									else setDrag(null);
									dropCommitted.current = false;
								}
							},
							t,
							pinned: pinnedIds.has(node.id),
							unread: unreadIds.has(node.id),
							onTogglePin: togglePin,
							onToggleUnread: toggleUnread,
							workspaces: workspaceMoveTargets,
							onMoveToWorkspace,
							onCopySession,
							onCopyMarkdown
						}, node.id);
					})]
				}), (0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.fade })]
			});
		}
		/** Flat search body: local metadata matches plus the current Host result page. */
		function SearchResults({ useSessions, open, workspaces, archivedSessionIds, query, remote, resultLimit, t }) {
			const list = useSessions((s) => s);
			const currentRemote = remote.query === query ? remote : {
				query,
				status: "loading",
				items: [],
				hasMore: false
			};
			const results = (0, react.useMemo)(() => deriveSearchResults(list, workspaces, query, archivedSessionIds, currentRemote, resultLimit), [
				list,
				workspaces,
				query,
				archivedSessionIds,
				currentRemote,
				resultLimit
			]);
			const pending = currentRemote.status === "loading";
			const failed = currentRemote.status === "error";
			return (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(WorkspaceBrowser_module_css_default.treeBody, WorkspaceBrowser_module_css_default.wide),
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: WorkspaceBrowser_module_css_default.list,
					children: [
						(0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.searchTree,
							role: "tree",
							"aria-label": t("search.results.aria"),
							children: results.items.map((result) => (0, react_jsx_runtime.jsx)(SearchResultItem, {
								result,
								currentId: list.current,
								onOpen: open,
								t
							}, result.id))
						}),
						pending && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.searchStatus,
							role: "status",
							children: t("search.pending")
						}),
						failed && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.searchWarning,
							role: "status",
							children: t("search.unavailable")
						}),
						!pending && results.items.length === 0 && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.empty,
							children: t("search.noMatches")
						}),
						results.hasMore && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.searchStatus,
							children: t("search.hasMore", { n: resultLimit })
						})
					]
				}), (0, react_jsx_runtime.jsx)("span", { className: WorkspaceBrowser_module_css_default.fade })]
			});
		}
		/**
		* Render the browsing region.
		* @param props - composed slot props (shell owner share + store + injected actions).
		* @returns the region element tree.
		*/
		function WorkspaceBrowser({ wide, surface, selectSurface, expandSidebar, useSessions, useWorkspaces, useStore, actions, startSession, open, renameSession, forkSession, renameWorkspace, deleteWorkspace, insertWorkspaceBefore, archiveSession, insertSessionBefore, createWorkspace, searchSessions, useArchivedSessionIds, searchResultLimit, useDirectoryFlow, renderSlot, t }) {
			const workspaces = useWorkspaces((state) => state.items);
			const workspacePhase = useWorkspaces((state) => state.phase);
			const archivedSessionIds = useArchivedSessionIds();
			const directoryFlowAvailable = useDirectoryFlow((occupied) => occupied);
			const groupBy = useStore((s) => s.groupBy);
			const orderBy = useStore((s) => s.orderBy);
			const groupExpansion = useStore((s) => s.groupExpansion);
			const sessionOrderByAccount = useStore((s) => s.sessionOrderByAccount);
			const sessionUpdatedAtByAccount = useStore((s) => s.sessionUpdatedAtByAccount);
			const { pinnedIds, unreadIds, togglePin, toggleUnread } = useSessionMeta();
			(0, react.useEffect)(() => {
				if (workspacePhase !== "ready") return;
				actions.retainAccountKeys([
					"",
					FLAT_SESSION_ORDER_KEY,
					...workspaces.map((workspace) => workspace.workspaceId)
				]);
			}, [
				actions.retainAccountKeys,
				workspacePhase,
				workspaces
			]);
			const [query, setQuery] = (0, react.useState)("");
			const [searchExpanded, setSearchExpanded] = (0, react.useState)(false);
			const normalizedQuery = sanitizeSearchQuery(query).trim();
			const [remoteSearch, setRemoteSearch] = (0, react.useState)({
				query: "",
				status: "idle",
				items: [],
				hasMore: false
			});
			const searchRoot = (0, react.useRef)(null);
			const searchInput = (0, react.useRef)(null);
			const [wsPickerOpen, setWsPickerOpen] = (0, react.useState)(false);
			const wsPlusRef = (0, react.useRef)(null);
			const composingRef = (0, react.useRef)(false);
			const [searchOnExpand, setSearchOnExpand] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (wide && searchOnExpand) {
					const timer = window.setTimeout(() => {
						searchInput.current?.focus({ preventScroll: true });
						setSearchOnExpand(false);
					}, EXPAND_SLIDE_MS);
					return () => {
						window.clearTimeout(timer);
					};
				}
			}, [wide, searchOnExpand]);
			(0, react.useEffect)(() => {
				if (!wide || !searchExpanded || searchOnExpand) return;
				searchInput.current?.focus({ preventScroll: true });
			}, [
				wide,
				searchExpanded,
				searchOnExpand
			]);
			(0, react.useEffect)(() => {
				if (!wide || !searchExpanded) return;
				const onClick = (event) => {
					if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) return;
					searchInput.current?.blur();
					if (normalizedQuery !== "") return;
					setSearchExpanded(false);
				};
				document.addEventListener("click", onClick);
				return () => {
					document.removeEventListener("click", onClick);
				};
			}, [
				normalizedQuery,
				wide,
				searchExpanded
			]);
			(0, react.useEffect)(() => {
				if (normalizedQuery === "") {
					setRemoteSearch({
						query: "",
						status: "idle",
						items: [],
						hasMore: false
					});
					return;
				}
				const controller = new AbortController();
				setRemoteSearch({
					query: normalizedQuery,
					status: "loading",
					items: [],
					hasMore: false
				});
				const timer = window.setTimeout(() => {
					searchSessions(normalizedQuery, controller.signal).then((result) => {
						if (controller.signal.aborted) return;
						setRemoteSearch({
							query: normalizedQuery,
							status: "ready",
							items: result.items,
							hasMore: result.hasMore
						});
					}).catch(() => {
						if (controller.signal.aborted) return;
						setRemoteSearch({
							query: normalizedQuery,
							status: "error",
							items: [],
							hasMore: false
						});
					});
				}, SEARCH_DEBOUNCE_MS);
				return () => {
					window.clearTimeout(timer);
					controller.abort();
				};
			}, [normalizedQuery, searchSessions]);
			const [renameTarget, setRenameTarget] = (0, react.useState)(null);
			const [renameDraft, setRenameDraft] = (0, react.useState)("");
			const [renaming, setRenaming] = (0, react.useState)(false);
			const [renameError, setRenameError] = (0, react.useState)(null);
			const renameTrimmed = renameDraft.trim();
			const renameDuplicate = renameTarget !== null && renameTrimmed !== "" && renameTrimmed !== renameTarget.currentTitle && workspaces.some((w) => w.title === renameTrimmed);
			const renameBlocked = renaming || renameTrimmed === "" || renameTarget === null || renameTrimmed === renameTarget.currentTitle || renameDuplicate;
			const closeRename = () => {
				if (renaming) return;
				setRenameTarget(null);
				setRenameError(null);
			};
			const confirmRename = () => {
				if (renameBlocked) return;
				setRenaming(true);
				setRenameError(null);
				renameWorkspace(renameTarget.workspaceId, renameTrimmed).then(() => {
					setRenaming(false);
					setRenameTarget(null);
				}).catch((reason) => {
					setRenaming(false);
					setRenameError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const [sessionRenameTarget, setSessionRenameTarget] = (0, react.useState)(null);
			const [sessionRenameDraft, setSessionRenameDraft] = (0, react.useState)("");
			const [sessionRenaming, setSessionRenaming] = (0, react.useState)(false);
			const [sessionRenameError, setSessionRenameError] = (0, react.useState)(null);
			const sessionRenameTrimmed = sessionRenameDraft.trim();
			const sessionRenameBlocked = sessionRenaming || sessionRenameTrimmed === "" || sessionRenameTarget === null;
			const closeSessionRename = () => {
				if (sessionRenaming) return;
				setSessionRenameTarget(null);
				setSessionRenameError(null);
			};
			const confirmSessionRename = () => {
				if (sessionRenameBlocked) return;
				setSessionRenaming(true);
				setSessionRenameError(null);
				renameSession(sessionRenameTarget.sessionId, sessionRenameTrimmed).then(() => {
					setSessionRenaming(false);
					setSessionRenameTarget(null);
				}).catch((reason) => {
					setSessionRenaming(false);
					setSessionRenameError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			const onSessionRename = (sessionId, currentTitle) => {
				setSessionRenameTarget({
					sessionId,
					currentTitle
				});
				setSessionRenameDraft(currentTitle);
				setSessionRenameError(null);
			};
			const onSessionArchive = async (sessionId) => {
				// ctx.workspaces.archiveSession（WorkspaceRuntime）成功时解析为 undefined、失败时 throw。
				// 归档是持久操作，由 Host 写入 registry；归档成功后运行时快照（manager.getSnapshot）
				// 会经 installArchived 更新，useArchivedSessionIds 订阅即刷新，会话随之隐藏。
				try {
					sessionMetaStore.actions.unpin(sessionId);
					sessionMetaStore.actions.clearUnread(sessionId);
					await archiveSession(sessionId);
					console.info("[moyu] archive ok:", sessionId);
				} catch (err) {
					console.error("[moyu] archive failed:", err);
					showErrorToast("归档失败：" + (err?.message || String(err)));
				}
			};
			const [deleteTarget, setDeleteTarget] = (0, react.useState)(null);
			const [deleting, setDeleting] = (0, react.useState)(false);
			const [deleteCommittedId, setDeleteCommittedId] = (0, react.useState)(null);
			const [deleteError, setDeleteError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (deleteCommittedId === null || workspaces.some((workspace) => workspace.workspaceId === deleteCommittedId)) return;
				setDeleting(false);
				setDeleteCommittedId(null);
				setDeleteTarget(null);
			}, [deleteCommittedId, workspaces]);
			const closeDelete = () => {
				if (deleting) return;
				setDeleteTarget(null);
				setDeleteError(null);
			};
			const confirmDelete = () => {
				/* v8 ignore next -- the Modal is absent without a target and its button is disabled while deleting. */
				if (deleting || deleteTarget === null) return;
				setDeleting(true);
				setDeleteCommittedId(null);
				setDeleteError(null);
				deleteWorkspace(deleteTarget.workspaceId).then(() => {
					setDeleteCommittedId(deleteTarget.workspaceId);
				}).catch((reason) => {
					setDeleting(false);
					setDeleteError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(WorkspaceBrowser_module_css_default.root, !wide && WorkspaceBrowser_module_css_default.rail),
				children: [
					(0, react_jsx_runtime.jsx)(SurfaceNavigation, {
						wide,
						surface,
						selectSurface,
						t,
						startSession
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: WorkspaceBrowser_module_css_default.sectionHeader,
						children: [
							wide && (0, react_jsx_runtime.jsx)("span", {
								className: clsx(WorkspaceBrowser_module_css_default.sectionLabel, WorkspaceBrowser_module_css_default.wide, searchExpanded && WorkspaceBrowser_module_css_default.sectionLabelHidden),
								children: groupBy === "flat" ? t("section.sessions") : t("section.workspaces")
							}),
							wide && (0, react_jsx_runtime.jsx)("div", {
								className: clsx(WorkspaceBrowser_module_css_default.searchSlot, searchExpanded && WorkspaceBrowser_module_css_default.searchSlotExpanded),
								children: (0, react_jsx_runtime.jsxs)("div", {
									ref: searchRoot,
									className: clsx(WorkspaceBrowser_module_css_default.search, searchExpanded && WorkspaceBrowser_module_css_default.searchExpanded),
									onClick: () => {
										setWsPickerOpen(false);
										setSearchExpanded(true);
										searchInput.current?.focus();
									},
									children: [
										(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: t("search"),
											side: "bottom",
											delayMs: 500,
											disabled: searchExpanded,
											children: (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: WorkspaceBrowser_module_css_default.searchButton,
												"aria-label": t("search.sessions.aria"),
												"aria-expanded": searchExpanded,
												onClick: () => {
													setWsPickerOpen(false);
													setSearchExpanded(true);
												},
												children: (0, react_jsx_runtime.jsx)(moyuSearch, { size: searchExpanded ? 11 : 14 })
											})
										}),
										(0, react_jsx_runtime.jsx)("input", {
											ref: searchInput,
											className: WorkspaceBrowser_module_css_default.searchInput,
											type: "text",
											placeholder: t("search.placeholder"),
											maxLength: SEARCH_QUERY_MAX_CODE_UNITS,
											value: query,
											tabIndex: searchExpanded ? 0 : -1,
											onChange: (e) => {
												setQuery(sanitizeSearchQuery(e.target.value));
											},
											onKeyDown: (e) => {
												if (e.key !== "Escape") return;
												setQuery("");
												setSearchExpanded(false);
											}
										}),
										searchExpanded && (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: WorkspaceBrowser_module_css_default.clearButton,
											"aria-label": t("search.clear"),
											onClick: (e) => {
												e.stopPropagation();
												setQuery("");
												setSearchExpanded(false);
											},
											children: (0, react_jsx_runtime.jsx)(moyuX, {})
										})
									]
								})
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: clsx(WorkspaceBrowser_module_css_default.headerActions, wide && searchExpanded && WorkspaceBrowser_module_css_default.headerActionsHidden),
								children: [wide && (0, react_jsx_runtime.jsx)(ViewOptionsMenu, {
									groupBy,
									orderBy,
									onGroupPick: (mode) => {
										actions.setGroupBy(mode);
									},
									onOrderPick: (mode) => {
										actions.setOrderBy(mode);
									},
									t
								}), directoryFlowAvailable && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
									label: t("workspace.add"),
									side: "bottom",
									delayMs: 500,
									children: (0, react_jsx_runtime.jsx)("button", {
										ref: wsPlusRef,
										type: "button",
										className: WorkspaceBrowser_module_css_default.iconButton,
										"aria-label": t("workspace.add"),
										onClick: () => {
											setWsPickerOpen((v) => !v);
										},
										children: (0, react_jsx_runtime.jsx)(moyuFolderPlus, { size: wide ? 16 : 18 })
									})
								})]
							}),
							(0, react_jsx_runtime.jsx)(WorkspacePickFlow, {
								t,
								open: wsPickerOpen,
								anchorRef: wsPlusRef,
								useWorkspaces,
								createWorkspace,
								renameWorkspace,
								useDirectoryFlow,
								renderDirectoryFlow: (owner) => renderSlot("sidebar.workspaces.directoryFlow", owner),
								addOnly: true,
								side: "right",
								onPick: (workspaceId) => {
									setWsPickerOpen(false);
									startSession(workspaceId);
								},
								onClose: () => {
									setWsPickerOpen(false);
								}
							})
						]
					}),
					!wide && (0, react_jsx_runtime.jsx)("div", {
						className: WorkspaceBrowser_module_css_default.search,
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: t("search"),
							children: (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: WorkspaceBrowser_module_css_default.searchButton,
								"aria-label": t("search.sessions.aria"),
								onClick: () => {
									setSearchExpanded(true);
									setSearchOnExpand(true);
									expandSidebar();
								},
								children: (0, react_jsx_runtime.jsx)(moyuSearch, { size: 18 })
							})
						})
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: WorkspaceBrowser_module_css_default.listArea,
						children: wide && (normalizedQuery !== "" ? (0, react_jsx_runtime.jsx)(SearchResults, {
							useSessions,
							open,
							workspaces,
							archivedSessionIds,
							query: normalizedQuery,
							remote: remoteSearch,
							resultLimit: searchResultLimit,
							t
						}) : groupBy === "flat" ? (0, react_jsx_runtime.jsx)(FlatList, {
							useSessions,
							open,
							forkSession,
							onSessionRename,
							onSessionArchive,
							archivedSessionIds,
							workspaces,
							insertSessionBefore,
							orderBy,
							sessionOrderByAccount,
							sessionUpdatedAtByAccount,
							syncSessionOrderAccount: actions.syncSessionOrderAccount,
							setSessionOrder: actions.setSessionOrder,
							t
						}) : (0, react_jsx_runtime.jsx)(SessionTree, {
							useSessions,
							onSessionRename,
							onSessionArchive,
							forkSession,
							workspaces,
							groupExpansion,
							setGroupExpanded: actions.setGroupExpanded,
							sessionOrderByAccount,
							sessionUpdatedAtByAccount,
							syncSessionOrderAccount: actions.syncSessionOrderAccount,
							setSessionOrder: actions.setSessionOrder,
							archivedSessionIds,
							startSession,
							open,
							insertWorkspaceBefore,
							insertSessionBefore,
							orderBy,
							t,
							onRenameRequest: (workspaceId, currentTitle) => {
								setRenameTarget({
									workspaceId,
									currentTitle
								});
								setRenameDraft(currentTitle);
								setRenameError(null);
							},
							onDeleteRequest: (workspaceId, title) => {
								setDeleteTarget({
									workspaceId,
									title
								});
								setDeleteError(null);
							}
						}))
					}),
					(0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: renameTarget !== null,
						onClose: closeRename,
						closeLabel: t("close"),
						title: t("rename.workspace.title"),
						footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: renaming,
							onClick: closeRename,
							children: t("cancel")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: renameBlocked,
							onClick: confirmRename,
							children: t("rename")
						})] }),
						children: [
							(0, react_jsx_runtime.jsx)("input", {
								className: WorkspaceBrowser_module_css_default.renameInput,
								value: renameDraft,
								"aria-label": t("field.workspaceName"),
								autoFocus: true,
								disabled: renaming,
								onFocus: (e) => {
									e.target.select();
								},
								onChange: (e) => {
									setRenameDraft(e.target.value);
									setRenameError(null);
								},
								onCompositionStart: () => {
									composingRef.current = true;
								},
								onCompositionEnd: () => {
									composingRef.current = false;
								},
								onKeyDown: (e) => {
									if (e.key === "Enter" && !composingRef.current) {
										e.preventDefault();
										confirmRename();
									}
								}
							}),
							renameDuplicate && (0, react_jsx_runtime.jsx)("div", {
								className: WorkspaceBrowser_module_css_default.renameError,
								role: "alert",
								children: t("conflict.named", { name: renameTrimmed })
							}),
							renameError !== null && (0, react_jsx_runtime.jsx)("div", {
								className: WorkspaceBrowser_module_css_default.renameError,
								role: "alert",
								children: renameError
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: sessionRenameTarget !== null,
						onClose: closeSessionRename,
						closeLabel: t("close"),
						title: t("rename.session.title"),
						footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: sessionRenaming,
							onClick: closeSessionRename,
							children: t("cancel")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: sessionRenameBlocked,
							onClick: confirmSessionRename,
							children: t("rename")
						})] }),
						children: [(0, react_jsx_runtime.jsx)("input", {
							className: WorkspaceBrowser_module_css_default.renameInput,
							value: sessionRenameDraft,
							"aria-label": t("field.sessionName"),
							autoFocus: true,
							disabled: sessionRenaming,
							onFocus: (e) => {
								e.target.select();
							},
							onChange: (e) => {
								setSessionRenameDraft(e.target.value);
								setSessionRenameError(null);
							},
							onCompositionStart: () => {
								composingRef.current = true;
							},
							onCompositionEnd: () => {
								composingRef.current = false;
							},
							onKeyDown: (e) => {
								if (e.key === "Enter" && !composingRef.current) {
									e.preventDefault();
									confirmSessionRename();
								}
							}
						}), sessionRenameError !== null && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.renameError,
							role: "alert",
							children: sessionRenameError
						})]
					}),
					(0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: deleteTarget !== null,
						onClose: closeDelete,
						closeLabel: t("close"),
						title: t("delete.workspace"),
						...deleteTarget === null ? {} : { description: t("delete.desc", { name: deleteTarget.title }) },
						footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: deleting,
							onClick: closeDelete,
							children: t("cancel")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							className: WorkspaceBrowser_module_css_default.deleteAction,
							disabled: deleting,
							onClick: confirmDelete,
							children: t("delete.workspace")
						})] }),
						children: [deleting && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.deleteStatus,
							role: "status",
							children: t("delete.pending")
						}), deleteError !== null && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.renameError,
							role: "alert",
							children: deleteError
						})]
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/Users/clukay/Program/deepseek-harness/packages/client/ui-workspace/src/client/SurfaceView.module.css.mjs
		const css = ".b39dpa_root{box-sizing:border-box;background:var(--dsw-alias-bg-base);min-width:0;min-height:100%;color:var(--dsw-alias-label-primary);justify-content:center;align-items:center;padding:48px 32px;display:flex}.b39dpa_content{text-align:center;flex-direction:column;align-items:center;width:min(100%,520px);display:flex}.b39dpa_icon{border:1px solid var(--dsw-alias-border-l2);width:44px;height:44px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-radius:14px;place-items:center;margin-bottom:20px;display:grid}.b39dpa_content h1{margin:0;font-size:24px;font-weight:600;line-height:32px}.b39dpa_content p{max-width:460px;color:var(--dsw-alias-label-secondary);margin:12px 0 0;font-size:14px;line-height:22px}.b39dpa_action{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-button-elevated-fill);min-height:36px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;border-radius:10px;margin-top:24px;padding:0 16px}.b39dpa_action:hover{background:var(--dsw-alias-button-floating-hover)}.b39dpa_action:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}@media (width<=640px){.b39dpa_root{padding:32px 20px}.b39dpa_content h1{font-size:20px;line-height:28px}}";
		const tagId = "@deepseek-ai/dsh-client-ui-workspace/SurfaceView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-workspace";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SurfaceView_module_css_default = {
			"action": "b39dpa_action",
			"content": "b39dpa_content",
			"icon": "b39dpa_icon",
			"root": "b39dpa_root"
		};
		//#endregion
		//#region lib/types/client/SurfaceView.js
		/** Browser-only application surfaces that do not have a backend capability yet. */
		function SurfaceGlyph({ surface }) {
			if (surface === "pull-requests") return (0, react_jsx_runtime.jsx)(moyuGitFork, { size: 20 });
			if (surface === "browser") return (0, react_jsx_runtime.jsx)(moyuGlobe, { size: 20 });
			if (surface === "scheduled") return (0, react_jsx_runtime.jsx)(moyuListTodo, { size: 20 });
			return (0, react_jsx_runtime.jsx)(moyuBlocks, { size: 20 });
		}
		/** Render a truthful empty or handoff state for an unconfigured surface. */
		function SurfaceView({ surface, openSettings, renderSlot, t }) {
			if (surface === "scheduled") {
				const scheduled = renderSlot("surface.scheduled", {});
				if (scheduled !== null && scheduled !== void 0) return scheduled;
			}
			const plugins = surface === "plugins";
			const title = surface === "pull-requests" ? t("surface.pullRequests") : surface === "browser" ? t("surface.browser") : surface === "scheduled" ? t("surface.scheduled") : t("surface.plugins.title");
			const description = surface === "pull-requests" ? t("surface.pullRequests.description") : surface === "browser" ? t("surface.browser.description") : surface === "scheduled" ? t("surface.scheduled.description") : t("surface.plugins.description");
			return (0, react_jsx_runtime.jsx)("main", {
				className: SurfaceView_module_css_default.root,
				"data-surface": surface,
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: SurfaceView_module_css_default.content,
					children: [
						(0, react_jsx_runtime.jsx)("div", {
							className: SurfaceView_module_css_default.icon,
							"aria-hidden": "true",
							children: (0, react_jsx_runtime.jsx)(SurfaceGlyph, { surface })
						}),
						(0, react_jsx_runtime.jsx)("h1", { children: plugins ? t("surface.plugins.title") : title }),
						(0, react_jsx_runtime.jsx)("p", { children: plugins ? t("surface.plugins.description") : description }),
						plugins && (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: SurfaceView_module_css_default.action,
							onClick: () => {
								openSettings("plugins");
							},
							children: t("surface.plugins.openSettings")
						})
					]
				})
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/**
		* `workspace` namespace dictionaries: the browsing region (section header,
		* search, tree rows, dialogs) and the pick/add flow. Runtime failure
		* messages (wire error strings) pass through untranslated by policy.
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"group.ungrouped": "未分组",
			"session.new": "新会话",
			"section.workspaces": "工作区",
			"section.sessions": "会话",
			"viewOptions.label": "视图选项",
			"groupBy.label": "分组方式",
			"groupBy.workspace": "按工作区",
			"groupBy.flat": "单列表",
			"orderBy.label": "排序方式",
			"orderBy.manual": "手动排序",
			"orderBy.updated": "最近更新",
			"sessions.expand": "展开其余 {n} 个会话",
			"sessions.collapse": "收起",
			"empty.none": "暂无会话",
			"empty.noMatches": "无匹配结果",
			"workspace.add": "添加工作区",
			"createProject.title": "创建项目",
			"createProject.name": "项目名称",
			"createProject.source": "源文件夹",
			"createProject.addSource": "添加 MOYU DSH 可读取和编辑的文件夹",
			"createProject.confirm": "创建项目",
			"search.sessions.aria": "搜索会话",
			"search.placeholder": "搜索会话…",
			"search.clear": "清除搜索",
			"search.results.aria": "搜索结果",
			"search.pending": "正在搜索会话历史…",
			"search.unavailable": "内容搜索暂不可用，仅显示名称匹配。",
			"search.noMatches": "无匹配会话",
			"search.hasMore": "仅显示前 {n} 条结果，请缩小搜索范围。",
			"menu.addWorkspace": "添加工作区…",
			"picker.loading": "正在加载工作区…",
			"conflict.named": "已存在名为“{name}”的工作区。",
			"folderError.title": "无法打开文件夹",
			"folderError.retry": "重新选择",
			"rename": "重命名",
			"rename.workspace.title": "重命名工作区",
			"rename.session.title": "重命名会话",
			"field.workspaceName": "工作区名称",
			"field.sessionName": "会话名称",
			"delete.workspace": "删除工作区",
			"delete.desc": "将把“{name}”从工作区列表中移除。文件夹与会话记录会保留，其会话将显示在“未分组”下。",
			"delete.pending": "正在删除工作区…",
			"menu.fork": "分叉会话",
			"menu.archiveSession": "归档会话",
			"menu.archiveSession.aria": "归档会话“{name}”",
			"menu.open": "更多操作",
			"menu.open.aria": "会话“{name}”的更多操作",
			"pin.add": "置顶会话",
			"pin.remove": "取消置顶",
			"pin.add.aria": "置顶会话“{name}”",
			"pin.remove.aria": "取消置顶会话“{name}”",
			"unread.markUnread": "标记为未读",
			"unread.markRead": "标记为已读",
			"unread.label": "未读",
			"moveToWorkspace.title": "移动到工作区",
			"moveToWorkspace.none": "无工作区",
			"copy.title": "复制",
			"copy.session": "复制会话",
			"copy.markdown": "复制为 Markdown",
			"sessions.count.one": "{n} 个会话",
			"sessions.count.other": "{n} 个会话",
			"actions.workspace.aria": "工作区“{name}”的操作",
			"actions.session.aria": "会话“{name}”的操作",
			"actions.newSession.aria": "在“{name}”中新建会话",
			"status.running": "进行中",
			"status.subagentsRunning.one": "{n} 个子代理运行中",
			"status.subagentsRunning.other": "{n} 个子代理运行中",
			"status.idle": "空闲",
			"status.waitingApproval": "等待审批",
			"status.planReview": "计划待审",
			"status.waitingAnswer": "等待回答",
			"status.completed": "已完成",
			"hover.created": "创建于 {time}",
			"hover.copied": "已复制",
			"date.ymd": "{y}年{m}月{d}日",
			"time.now": "刚刚",
			"time.minutes": "{n}分钟",
			"time.hours": "{n}小时",
			"time.days": "{n}天",
			"time.months": "{n}个月",
			"time.years": "{n}年",
			"time.ago": "{t}前",
			"surface.conversation": "新会话",
			"surface.navigation": "应用导航",
			"surface.pullRequests": "拉取请求",
			"surface.browser": "站点",
			"surface.scheduled": "安排任务",
			"surface.plugins": "插件",
			"surface.plugins.title": "插件",
			"surface.plugins.description": "查看已加载的插件和可配置的运行能力。",
			"surface.plugins.openSettings": "打开插件设置",
			"surface.pullRequests.description": "Pull Request 数据源尚未配置。连接 GitHub 或 GitLab 后，这里会显示真实的请求。",
			"surface.browser.description": "浏览器能力尚未配置。当前页面不会伪造网页或浏览结果。",
			"surface.scheduled.description": "当前没有可用的计划任务数据源。"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"group.ungrouped": "Ungrouped",
			"session.new": "New Session",
			"section.workspaces": "Workspaces",
			"section.sessions": "Sessions",
			"viewOptions.label": "View options",
			"groupBy.label": "Group by",
			"groupBy.workspace": "WorkSpace",
			"groupBy.flat": "In one list",
			"orderBy.label": "Order by",
			"orderBy.manual": "Manual",
			"orderBy.updated": "Last updated",
			"sessions.expand": "Show {n} more sessions",
			"sessions.collapse": "Show less",
			"empty.none": "No sessions yet",
			"empty.noMatches": "No matches",
			"workspace.add": "Add workspace",
			"createProject.title": "Create project",
			"createProject.name": "Project name",
			"createProject.source": "Source folder",
			"createProject.addSource": "Add a folder MOYU DSH can read and edit",
			"createProject.confirm": "Create project",
			"search.sessions.aria": "Search sessions",
			"search.placeholder": "Search sessions...",
			"search.clear": "Clear search",
			"search.results.aria": "Search results",
			"search.pending": "Searching session history…",
			"search.unavailable": "Content search is temporarily unavailable. Showing name matches.",
			"search.noMatches": "No matching sessions",
			"search.hasMore": "Showing the first {n} results. Narrow your search.",
			"menu.addWorkspace": "Add workspace…",
			"picker.loading": "Loading workspaces…",
			"conflict.named": "A workspace named “{name}” already exists.",
			"folderError.title": "Couldn’t open folder",
			"folderError.retry": "Choose again",
			"rename": "Rename",
			"rename.workspace.title": "Rename workspace",
			"rename.session.title": "Rename session",
			"field.workspaceName": "Workspace name",
			"field.sessionName": "Session name",
			"delete.workspace": "Delete workspace",
			"delete.desc": "This removes “{name}” from the workspace list. The folder and session logs will be kept. Its sessions will appear under Ungrouped.",
			"delete.pending": "Deleting workspace…",
			"menu.fork": "Fork session",
			"menu.archiveSession": "Archive session",
			"menu.archiveSession.aria": "Archive session “{name}”",
			"menu.open": "More actions",
			"menu.open.aria": "More actions for session “{name}”",
			"pin.add": "Pin session",
			"pin.remove": "Unpin session",
			"pin.add.aria": "Pin session “{name}”",
			"pin.remove.aria": "Unpin session “{name}”",
			"unread.markUnread": "Mark as unread",
			"unread.markRead": "Mark as read",
			"unread.label": "Unread",
			"moveToWorkspace.title": "Move to workspace",
			"moveToWorkspace.none": "No workspace",
			"copy.title": "Copy",
			"copy.session": "Copy session",
			"copy.markdown": "Copy as Markdown",
			"sessions.count.one": "{n} session",
			"sessions.count.other": "{n} sessions",
			"actions.workspace.aria": "Workspace actions for {name}",
			"actions.session.aria": "Session actions for {name}",
			"actions.newSession.aria": "New session in {name}",
			"status.running": "Running",
			"status.subagentsRunning.one": "{n} subagent running",
			"status.subagentsRunning.other": "{n} subagents running",
			"status.idle": "Idle",
			"status.waitingApproval": "Waiting for approval",
			"status.planReview": "Plan awaiting review",
			"status.waitingAnswer": "Waiting for answer",
			"status.completed": "Completed",
			"hover.created": "Created {time}",
			"hover.copied": "Copied",
			"date.ymd": "{y}-{m}-{d}",
			"time.now": "now",
			"time.minutes": "{n}min",
			"time.hours": "{n}h",
			"time.days": "{n}d",
			"time.months": "{n}mo",
			"time.years": "{n}y",
			"time.ago": "{t} ago",
			"surface.conversation": "New Session",
			"surface.navigation": "Application navigation",
			"surface.pullRequests": "Pull Requests",
			"surface.browser": "Browser",
			"surface.scheduled": "Scheduled Tasks",
			"surface.plugins": "Plugins",
			"surface.plugins.title": "Plugins",
			"surface.plugins.description": "Review loaded plugins and configurable runtime capabilities.",
			"surface.plugins.openSettings": "Open plugin settings",
			"surface.pullRequests.description": "No Pull Request data source is configured. Connect GitHub or GitLab to show real requests here.",
			"surface.browser.description": "Browser capability is not configured. This page does not fabricate web content or results.",
			"surface.scheduled.description": "No scheduled-task data source is available."
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "workspace";
		/**
		* Required services (cordis fiber inject). The target slots are declared by
		* the ui-sidebar / ui-conversation applies, whose activation order relative
		* to this one is NOT constrained: dsh.client.inject edges are informational
		* (loading/prefetch metadata, never apply sequencing) and neither owner
		* provides a waitable service. apply therefore depends on each slot
		* declaration through `slots.inject()` instead of assuming order.
		*/
		const inject = [
			"slots",
			"sessions",
			"workspaces",
			"locale",
			"settingsNavigation",
			"layout"
		];
		/**
		* Register the browser and picker once their slot declarations are on the
		* ledger. Inject factories return plain callbacks; data reads use the
		* framework's global hooks.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-workspace: dictionaries");
			const searchSessions = async (query, signal) => {
				const result = await ctx.sessions.search(query, signal);
				if (!result.ok) throw new Error(result.error.message);
				return result.value;
			};
			const flowSource = (hole) => ({
				getSnapshot: () => ctx.slots.entries(hole).length > 0,
				subscribe: (listener) => ctx.slots.subscribe(hole, listener)
			});
			const browserFlowSource = flowSource("sidebar.workspaces.directoryFlow");
			const pickerFlowSource = flowSource("conversation.hero.workspace.directoryFlow");
			const workspacesManager = ctx.workspaces.manager;
			const useArchivedSessionIds = () => {
				const [ids, setIds] = (0, react.useState)(() => {
					try {
						return workspacesManager ? workspacesManager.getSnapshot().archivedSessionIds || [] : [];
					} catch {
						return [];
					}
				});
				(0, react.useEffect)(() => {
					if (!workspacesManager || typeof workspacesManager.subscribe !== "function") return;
					const sync = () => {
						try {
							setIds(workspacesManager.getSnapshot().archivedSessionIds || []);
						} catch {
						}
					};
					sync();
					return workspacesManager.subscribe(sync);
				}, []);
				return ids;
			};
			const browserInjected = () => ({
				startSession: (workspaceId) => {
					ctx.layout.setSurface("conversation");
					ctx.workspaces.startSession(workspaceId);
				},
				open: (sessionId) => {
					ctx.layout.setSurface("conversation");
					ctx.sessions.open(sessionId);
				},
				searchSessions,
				useArchivedSessionIds,
				searchResultLimit: ctx.sessions.searchResultLimit,
				renameSession: async (sessionId, title) => {
					const session = ctx.sessions.binding(sessionId)?.session;
					if (session === void 0) throw new Error(`unknown session "${sessionId}"`);
					const result = await session.rename(title);
					if (!result.ok) throw new Error(result.error.message);
				},
				forkSession: (sessionId) => {
					ctx.sessions.fork({
						sessionId,
						increaseTitle: true
					}).then((childId) => {
						ctx.sessions.open(childId);
					}).catch(() => {});
				},
				renameWorkspace: async (workspaceId, title) => {
					await ctx.workspaces.rename(workspaceId, title);
				},
				deleteWorkspace: async (workspaceId) => {
					await ctx.workspaces.delete(workspaceId);
				},
				insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
					await ctx.workspaces.insertBefore(workspaceId, beforeWorkspaceId);
				},
				archiveSession: (sessionId) => ctx.workspaces.archiveSession(sessionId),
				insertSessionBefore: async (workspaceId, sessionId, beforeSessionId) => {
					await ctx.workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId);
				},
				createWorkspace: (input) => ctx.workspaces.create(input),
				hooks: { directoryFlow: browserFlowSource }
			});
			const pickerInjected = () => ({
				createWorkspace: (input) => ctx.workspaces.create(input),
				renameWorkspace: async (workspaceId, title) => {
					await ctx.workspaces.rename(workspaceId, title);
				},
				hooks: { directoryFlow: pickerFlowSource }
			});
			const surfaceInjected = () => ({ openSettings: (sectionId) => {
				ctx.settingsNavigation.open(sectionId);
			} });
			ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register({
				name: "sidebar.workspaces",
				children: { "sidebar.workspaces.directoryFlow": {
					kind: "single",
					scope: "root"
				} },
				store: createWorkspaceViewStore(),
				inject: browserInjected,
				locale: NS
			}, WorkspaceBrowser));
			ctx.slots.inject("conversation.hero.workspace", () => ctx.slots.register({
				name: "conversation.hero.workspace",
				children: { "conversation.hero.workspace.directoryFlow": {
					kind: "single",
					scope: "root"
				} },
				inject: pickerInjected,
				locale: NS
			}, WorkspacePicker));
			ctx.slots.inject("surface", () => ctx.slots.register({
				name: "surface",
				locale: NS,
				children: { "surface.scheduled": {
					kind: "single",
					scope: "root"
				} },
				inject: surfaceInjected
			}, SurfaceView));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
