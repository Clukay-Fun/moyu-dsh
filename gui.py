"""
包装设计工具箱 — GUI 主界面。
Illustrator 工具（PDF 导出 / 文字转曲）与条码生成器共享同一窗口，
通过菜单切换页面。
"""

import os
import re
import sys
import queue
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

try:
    from tkinterdnd2 import TkinterDnD
    HAS_DND = True
except ImportError:
    TkinterDnD = None
    HAS_DND = False

from converter import (
    BatchWorker,
    OutlineWorker,
    find_ai_files,
    format_size,
    MSG_PROGRESS,
    MSG_LOG,
    MSG_ERROR,
    MSG_COMPLETE,
    MSG_CANCELLED,
    MSG_ABORTED,
)
from barcode_gen import BarcodePreview
from theme import (
    ThemeManager, load_settings, save_settings, resolve_theme,
    build_settings_panel, THEME_SYSTEM,
)

# ---------------------------------------------------------------------------
# Drop-data parser
# ---------------------------------------------------------------------------
_DROP_RE = re.compile(r"\{(.+?)\}|(\S+)")


def parse_drop_data(data: str):
    paths = []
    for m in _DROP_RE.finditer(data):
        path = m.group(1) or m.group(2)
        if path:
            paths.append(os.path.normpath(path.strip()))
    return paths


_RootClass = TkinterDnD.Tk if HAS_DND else tk.Tk

# =========================================================================
# Main application
# =========================================================================


class App(_RootClass):
    def __init__(self):
        super().__init__()

        self.title("包装设计工具箱")
        self.geometry("860x680")
        self.minsize(720, 520)

        # ---- shared state --------------------------------------------------
        self.file_list = []          # [(fullpath, size), ...]
        self.output_dir = tk.StringVar(value="")
        self.same_folder = tk.BooleanVar(value=True)
        self.worker = None
        self._gen = 0
        self._poll_id = None

        # ---- build UI ----------------------------------------------------
        self._build_menu()

        # ---- persistent nav bar ------------------------------------------
        self._build_nav_bar()

        # Page container — holds the two tool pages
        self.page_container = ttk.Frame(self)
        self.page_container.pack(fill=tk.BOTH, expand=True)

        # Page: Illustrator
        self.page_ai = ttk.Frame(self.page_container)
        self._build_ai_page()

        # Page: Barcode
        self.page_bc = ttk.Frame(self.page_container)
        self._build_bc_page()

        # Page: More (settings / about)
        self.page_more = ttk.Frame(self.page_container)
        self._build_more_page()

        # Shared status bar
        self.status_var = tk.StringVar(value="就绪")
        self.status_bar = ttk.Label(self, textvariable=self.status_var,
                                    relief=tk.SUNKEN, anchor=tk.W, padding=(6, 1))
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)

        # Show the Illustrator page by default
        self._switch_page("ai")

        # ---- theme -------------------------------------------------------
        self.settings = load_settings()
        self.theme = ThemeManager(self)
        self._register_theme_widgets()
        self.theme.apply(resolve_theme(self.settings))

        # Start queue poll
        self._poll_queue()

        self.protocol("WM_DELETE_WINDOW", self._on_close)

        # Show about dialog on startup
        self.after(400, self._about)

    # =====================================================================
    # Persistent navigation bar
    # =====================================================================

    def _build_nav_bar(self):
        """Glass-pill navigation bar."""
        bar = ttk.Frame(self, padding=(10, 8, 10, 4))
        bar.pack(fill=tk.X)

        # Pill container — a single row of rounded-feel buttons
        pill_row = ttk.Frame(bar, style="Card.TFrame", padding=(4, 4, 4, 4))
        pill_row.pack(side=tk.LEFT)

        self.nav_ai = ttk.Button(
            pill_row, text="  Illustrator  ", style="Nav.TButton",
            command=lambda: self._switch_page("ai"))
        self.nav_ai.pack(side=tk.LEFT, padx=2)

        self.nav_bc = ttk.Button(
            pill_row, text="  条码生成器  ", style="Nav.TButton",
            command=lambda: self._switch_page("bc"))
        self.nav_bc.pack(side=tk.LEFT, padx=2)

        self.nav_more = ttk.Button(
            pill_row, text="  更多  ", style="Nav.TButton",
            command=lambda: self._switch_page("more"))
        self.nav_more.pack(side=tk.LEFT, padx=2)

        # Bottom hairline
        ttk.Separator(self, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=6)

    # =====================================================================
    # Page switching
    # =====================================================================

    def _switch_page(self, name):
        """Show *name* page, hide others. Highlight the active nav button."""
        self.page_ai.pack_forget()
        self.page_bc.pack_forget()
        self.page_more.pack_forget()

        # Reset all nav buttons
        self.nav_ai.configure(style="Nav.TButton")
        self.nav_bc.configure(style="Nav.TButton")
        self.nav_more.configure(style="Nav.TButton")

        if name == "ai":
            self.page_ai.pack(fill=tk.BOTH, expand=True)
            self.nav_ai.configure(style="NavActive.TButton")
        elif name == "bc":
            self.page_bc.pack(fill=tk.BOTH, expand=True)
            self.nav_bc.configure(style="NavActive.TButton")
        elif name == "more":
            self.page_more.pack(fill=tk.BOTH, expand=True)
            self.nav_more.configure(style="NavActive.TButton")
            self._switch_more("settings")  # default to settings panel

    # =====================================================================
    # Menu bar
    # =====================================================================

    def _build_menu(self):
        menubar = tk.Menu(self)
        self.config(menu=menubar)

        ai_menu = tk.Menu(menubar, tearoff=0)
        ai_menu.add_command(label="Illustrator 工具", command=lambda: self._switch_page("ai"))
        ai_menu.add_separator()
        ai_menu.add_command(label="导出 PDF 文件", command=self._start_pdf)
        ai_menu.add_command(label="导出最小化PDF 250ppi", command=self._start_minimal_pdf)
        ai_menu.add_command(label="文字转曲 (生成 -OL.ai)", command=self._start_outline)
        ai_menu.add_separator()
        ai_menu.add_command(label="添加文件...", command=self._add_files)
        ai_menu.add_command(label="添加文件夹...", command=self._add_folder)
        menubar.add_cascade(label="Illustrator", menu=ai_menu)

        bc_menu = tk.Menu(menubar, tearoff=0)
        bc_menu.add_command(label="条码生成器", command=lambda: self._switch_page("bc"))
        menubar.add_cascade(label="条码", menu=bc_menu)

        more_menu = tk.Menu(menubar, tearoff=0)
        more_menu.add_command(label="设置", command=lambda: self._switch_page("more"))
        more_menu.add_separator()
        more_menu.add_command(label="关于", command=lambda: self._switch_more("about"))
        menubar.add_cascade(label="更多", menu=more_menu)

    # =====================================================================
    # Page: Illustrator tools
    # =====================================================================

    def _build_ai_page(self):
        p = self.page_ai

        # -- toolbar --------------------------------------------------------
        tb = ttk.Frame(p)
        tb.pack(fill=tk.X, padx=8, pady=(8, 0))
        ttk.Button(tb, text="添加文件", command=self._add_files).pack(side=tk.LEFT, padx=2)
        ttk.Button(tb, text="添加文件夹", command=self._add_folder).pack(side=tk.LEFT, padx=2)
        ttk.Button(tb, text="移除选中", command=self._remove_selected).pack(side=tk.LEFT, padx=2)
        ttk.Button(tb, text="清空列表", command=self._clear_list).pack(side=tk.LEFT, padx=2)

        # -- file list ------------------------------------------------------
        self.drop_frame = ttk.LabelFrame(
            p, text="  文件列表  ——  直接拖放 .ai 文件或文件夹到此处  ——  ",
            padding=4, style="Glass.TLabelframe")
        self.drop_frame.pack(fill=tk.BOTH, expand=True, padx=8, pady=4)
        inner = ttk.Frame(self.drop_frame)
        inner.pack(fill=tk.BOTH, expand=True)

        cols = ("#", "name", "size", "status")
        self.tree = ttk.Treeview(inner, columns=cols, show="headings",
                                 selectmode="extended", height=10)
        self.tree.heading("#", text="#")
        self.tree.heading("name", text="文件名")
        self.tree.heading("size", text="大小")
        self.tree.heading("status", text="状态")
        self.tree.column("#", width=45, anchor=tk.CENTER, stretch=False)
        self.tree.column("name", width=440, anchor=tk.W)
        self.tree.column("size", width=90, anchor=tk.CENTER, stretch=False)
        self.tree.column("status", width=100, anchor=tk.CENTER, stretch=False)

        sb = ttk.Scrollbar(inner, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=sb.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        sb.pack(side=tk.RIGHT, fill=tk.Y)

        self._drop_hint = tk.Label(
            inner, text="将 .ai 文件或文件夹拖放到此处",
            font=("Microsoft YaHei UI", 13), fg="#888888",
            bg="#f0f0f0", anchor=tk.CENTER)
        self._update_drop_hint()
        inner.bind("<Configure>", self._position_drop_hint)

        # DnD
        if HAS_DND:
            self.drop_target_register("*")
            self.dnd_bind("<<DragEnter>>", self._on_drag_enter)
            self.dnd_bind("<<DragLeave>>", self._on_drag_leave)
            self.dnd_bind("<<Drop>>", self._on_drop)

        # Context menu
        self._ctx_menu = tk.Menu(self, tearoff=0)
        self._ctx_menu.add_command(label="移除选中", command=self._remove_selected)
        self._ctx_menu.add_command(label="打开文件所在位置", command=self._open_file_location)
        self._ctx_menu.add_separator()
        self._ctx_menu.add_command(label="清空列表", command=self._clear_list)
        self.tree.bind("<Button-3>", self._on_right_click)
        self.tree.bind("<Delete>", lambda e: self._remove_selected())
        self.tree.bind("<Double-1>", self._on_double_click)

        # -- output row -----------------------------------------------------
        row = ttk.Frame(p)
        row.pack(fill=tk.X, padx=8, pady=2)
        ttk.Checkbutton(row, text="与原文件同目录输出",
                        variable=self.same_folder,
                        command=self._on_output_mode_change
                        ).pack(side=tk.LEFT, padx=(0, 12))
        ttk.Label(row, text="输出目录:").pack(side=tk.LEFT)
        self.out_entry = ttk.Entry(row, textvariable=self.output_dir, width=50)
        self.out_entry.pack(side=tk.LEFT, padx=4, fill=tk.X, expand=True)
        self.out_btn = ttk.Button(row, text="浏览...", command=self._browse_output)
        self.out_btn.pack(side=tk.LEFT, padx=2)
        self._on_output_mode_change()

        # -- progress row ---------------------------------------------------
        row2 = ttk.Frame(p)
        row2.pack(fill=tk.X, padx=8, pady=2)
        self.progress = ttk.Progressbar(row2, mode="determinate")
        self.progress.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 8))
        self.btn_pdf = ttk.Button(row2, text="导出 PDF 文件", command=self._start_pdf)
        self.btn_pdf.pack(side=tk.LEFT, padx=2)
        self.btn_minimal = ttk.Button(row2, text="导出最小化PDF 250ppi", command=self._start_minimal_pdf)
        self.btn_minimal.pack(side=tk.LEFT, padx=2)
        self.btn_outline = ttk.Button(row2, text="文字转曲", command=self._start_outline)
        self.btn_outline.pack(side=tk.LEFT, padx=2)
        self.btn_stop = ttk.Button(row2, text="⏹ 停止", command=self._stop, state=tk.DISABLED)
        self.btn_stop.pack(side=tk.LEFT, padx=2)

        # -- log ------------------------------------------------------------
        frame3 = ttk.LabelFrame(p, text="转换日志", padding=4)
        frame3.pack(fill=tk.BOTH, expand=True, padx=8, pady=(4, 0))
        self.log_text = tk.Text(frame3, height=7, state=tk.DISABLED,
                                wrap=tk.WORD, font=("Consolas", 9))
        sb3 = ttk.Scrollbar(frame3, orient=tk.VERTICAL, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=sb3.set)
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        sb3.pack(side=tk.RIGHT, fill=tk.Y)

    def _position_drop_hint(self, event=None):
        self._drop_hint.place(relx=0.5, rely=0.5, anchor=tk.CENTER,
                              relwidth=0.85, relheight=0.65)

    def _update_drop_hint(self):
        if self.file_list:
            self._drop_hint.place_forget()
        else:
            self._position_drop_hint()
            self._drop_hint.lift()

    # =====================================================================
    # Page: Barcode generator
    # =====================================================================

    def _build_bc_page(self):
        self.barcode_preview = BarcodePreview(self.page_bc)
        self.barcode_preview.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

    # =====================================================================
    # Page: More (left sidebar + right content)
    # =====================================================================

    def _build_more_page(self):
        """Sidebar layout: left nav, right content."""
        p = self.page_more

        # --- sidebar frame -------------------------------------------------
        sidebar = ttk.Frame(p, width=200)
        sidebar.pack(side=tk.LEFT, fill=tk.Y, padx=(12, 0), pady=12)
        sidebar.pack_propagate(False)

        ttk.Label(sidebar, text="更多", style="Heading.TLabel").pack(
            anchor=tk.W, padx=16, pady=(12, 12))

        self._sidebar_btns = {}

        def _make_sidebar_btn(label, key):
            btn = ttk.Button(sidebar, text=label, style="Sidebar.TButton",
                             command=lambda: self._switch_more(key))
            btn.pack(fill=tk.X, padx=8, pady=1)
            self._sidebar_btns[key] = btn

        _make_sidebar_btn("  设置", "settings")
        _make_sidebar_btn("  关于", "about")

        # ---- separator ----
        ttk.Separator(p, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=0)

        # ---- content area ----
        self.more_content = ttk.Frame(p)
        self.more_content.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=16, pady=12)

    def _switch_more(self, panel):
        """Switch the right-side content of the More page."""
        for w in self.more_content.winfo_children():
            w.destroy()

        for key, btn in self._sidebar_btns.items():
            btn.configure(style="Sidebar.TButton")

        if panel == "settings":
            if panel in self._sidebar_btns:
                self._sidebar_btns[panel].configure(style="SidebarActive.TButton")
            f = build_settings_panel(self.more_content, self.theme, self.settings)
            f.pack(fill=tk.BOTH, expand=True)

        elif panel == "about":
            if panel in self._sidebar_btns:
                self._sidebar_btns[panel].configure(style="SidebarActive.TButton")
            f = self._build_about_panel(self.more_content)
            f.pack(fill=tk.BOTH, expand=True)

    def _build_about_panel(self, parent):
        """iOS-style about card."""
        f = ttk.Frame(parent, padding=16)

        card = ttk.Frame(f, style="Card.TFrame", padding=28)
        card.pack(fill=tk.X)

        ttk.Label(card, text="包装设计工具箱",
                  style="Title.TLabel").pack(anchor=tk.W)
        ttk.Label(card, text="v2.1", style="Muted.TLabel").pack(
            anchor=tk.W, pady=(2, 20))

        ttk.Separator(card, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=(0, 16))

        info = [
            ("Illustrator", "批量导出 PDF / 最小化 PDF / 文字转曲"),
            ("条码生成器", "EAN / UPC / Code128 / 矢量 SVG 输出"),
            ("外观", "浅色 / 深色 / 追随系统"),
        ]
        for title, desc in info:
            row = ttk.Frame(card)
            row.pack(fill=tk.X, pady=4)
            ttk.Label(row, text=title, style="Card.TLabel",
                      font=("Microsoft YaHei UI", 10, "bold"),
                      width=10, anchor=tk.W).pack(side=tk.LEFT)
            ttk.Label(row, text=desc, style="Muted.TLabel").pack(side=tk.LEFT)

        ttk.Separator(card, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=(16, 16))

        ttk.Label(card, text="依赖：Adobe Illustrator + Python",
                  style="Muted.TLabel").pack(anchor=tk.W, pady=1)
        ttk.Label(card, text="").pack()  # spacer
        ttk.Label(card, text="软件为 Lewis-Weng 设计",
                  style="Card.TLabel").pack(anchor=tk.W)
        ttk.Label(card, text="Leclerc_Weng@gmail.com",
                  style="Muted.TLabel").pack(anchor=tk.W)

        return f

    # =====================================================================
    # Drag-and-drop
    # =====================================================================

    def _on_drag_enter(self, event):
        self._highlight_drop_zone(True)
        return event.action

    def _on_drag_leave(self, event):
        self._highlight_drop_zone(False)
        return event.action

    def _on_drop(self, event):
        self._highlight_drop_zone(False)
        if event.data:
            self._switch_page("ai")
            self._add_paths(parse_drop_data(event.data))
        return event.action

    def _highlight_drop_zone(self, active):
        if active:
            s = ttk.Style()
            s.configure("DropHL.TLabelframe", bordercolor="#0078d4",
                        borderwidth=2, relief="solid")
            self.drop_frame.configure(style="DropHL.TLabelframe")
        else:
            self.drop_frame.configure(style="TLabelframe")

    # =====================================================================
    # File-list actions
    # =====================================================================

    def _add_paths(self, paths):
        found = []
        for p in paths:
            if os.path.isfile(p) and p.lower().endswith(".ai"):
                found.append(p)
            elif os.path.isdir(p):
                found.extend(find_ai_files(p))
        added = 0
        for p in found:
            if not any(p == f[0] for f in self.file_list):
                try:
                    sz = os.path.getsize(p)
                except OSError:
                    sz = 0
                self.file_list.append((p, sz))
                added += 1
        if added:
            self._refresh_list()
            self._log(f"已添加 {added} 个文件。")

    def _add_files(self):
        paths = filedialog.askopenfilenames(
            title="选择 AI 文件",
            filetypes=[("Adobe Illustrator 文件", "*.ai"), ("所有文件", "*.*")])
        if paths:
            self._add_paths(list(paths))

    def _add_folder(self):
        folder = filedialog.askdirectory(title="选择包含 AI 文件的文件夹")
        if folder:
            self._add_paths([folder])

    def _remove_selected(self):
        iids = self.tree.selection()
        if not iids:
            return
        count = len(iids)
        if count > 1:
            ok = messagebox.askyesno("确认", f"确定要移除选中的 {count} 个文件吗？")
            if not ok:
                return
        indices = sorted({int(self.tree.item(i, "values")[0]) - 1 for i in iids},
                         reverse=True)
        for i in indices:
            if 0 <= i < len(self.file_list):
                del self.file_list[i]
        self._refresh_list()
        self._log(f"已移除 {len(indices)} 个文件。")

    def _on_right_click(self, event):
        row_iid = self.tree.identify_row(event.y)
        if row_iid:
            if row_iid not in self.tree.selection():
                self.tree.selection_set(row_iid)
        if self.tree.selection():
            self._ctx_menu.post(event.x_root, event.y_root)

    def _on_double_click(self, event):
        row_iid = self.tree.identify_row(event.y)
        if not row_iid:
            return
        self.tree.selection_set(row_iid)
        idx = int(self.tree.item(row_iid, "values")[0])
        fp = self.file_list[idx - 1][0]
        ok = messagebox.askyesno("移除文件",
                                 f"移除：{os.path.basename(fp)}\n\n确定要移除这个文件吗？")
        if ok:
            self._remove_selected()

    def _open_file_location(self):
        iids = self.tree.selection()
        if not iids:
            return
        idx = int(self.tree.item(iids[0], "values")[0]) - 1
        fp = self.file_list[idx][0]
        os.system(f'explorer /select,"{fp}"')

    def _clear_list(self):
        if self.file_list and messagebox.askyesno("确认", f"确定要清空全部 {len(self.file_list)} 个文件吗？"):
            self.file_list.clear()
            self._refresh_list()

    def _browse_output(self):
        d = filedialog.askdirectory(title="选择 PDF 输出目录")
        if d:
            self.output_dir.set(d)

    def _on_output_mode_change(self):
        st = tk.DISABLED if self.same_folder.get() else tk.NORMAL
        self.out_entry.configure(state=st)
        self.out_btn.configure(state=st)

    def _refresh_list(self):
        for iid in self.tree.get_children():
            self.tree.delete(iid)
        for idx, (fp, size) in enumerate(self.file_list, 1):
            self.tree.insert("", tk.END, iid=str(idx),
                             values=(idx, os.path.basename(fp),
                                     format_size(size), ""))
        self._update_drop_hint()

    # =====================================================================
    # Start / Stop — shared by all workers
    # =====================================================================

    def _start_pdf(self):
        if not self.file_list:
            messagebox.showwarning("提示", "请先在 Illustrator 页面添加 AI 文件。")
            return
        if not self.same_folder.get() and not self.output_dir.get():
            messagebox.showwarning("提示", "请选择 PDF 输出目录。")
            return
        if self.worker and self.worker.is_alive():
            messagebox.showwarning("提示", "正在转换中，请等待完成或点击停止。")
            return
        out_dir = "" if self.same_folder.get() else self.output_dir.get()
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        self._launch_worker(BatchWorker(
            [f[0] for f in self.file_list], out_dir,
            same_folder=self.same_folder.get(), generation=0, mode="default"))

    def _start_minimal_pdf(self):
        if not self.file_list:
            messagebox.showwarning("提示", "请先在 Illustrator 页面添加 AI 文件。")
            return
        if not self.same_folder.get() and not self.output_dir.get():
            messagebox.showwarning("提示", "请选择 PDF 输出目录。")
            return
        if self.worker and self.worker.is_alive():
            messagebox.showwarning("提示", "正在转换中，请等待完成或点击停止。")
            return
        out_dir = "" if self.same_folder.get() else self.output_dir.get()
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        self._launch_worker(BatchWorker(
            [f[0] for f in self.file_list], out_dir,
            same_folder=self.same_folder.get(), generation=0, mode="minimal250"))

    def _start_outline(self):
        if not self.file_list:
            messagebox.showwarning("提示", "请先在 Illustrator 页面添加 AI 文件。")
            return
        if self.worker and self.worker.is_alive():
            messagebox.showwarning("提示", "正在转换中，请等待完成或点击停止。")
            return
        self._launch_worker(OutlineWorker(
            [f[0] for f in self.file_list], generation=0))

    def _launch_worker(self, worker):
        self._gen += 1
        worker.generation = self._gen
        self.progress["value"] = 0
        self.progress["maximum"] = len(self.file_list)
        self._clear_log()
        self._set_status("处理中...")
        self.btn_pdf.configure(state=tk.DISABLED)
        self.btn_minimal.configure(state=tk.DISABLED)
        self.btn_outline.configure(state=tk.DISABLED)
        self.btn_stop.configure(state=tk.NORMAL)
        for iid in self.tree.get_children():
            self.tree.set(iid, "status", "等待中")
        self.worker = worker
        self.worker.start()

    def _stop(self):
        if self.worker:
            self.worker.cancelled = True
        self._log("-- 已请求停止 --")
        self._set_status("已停止")
        self.title("包装设计工具箱")
        self.btn_pdf.configure(state=tk.NORMAL)
        self.btn_minimal.configure(state=tk.NORMAL)
        self.btn_outline.configure(state=tk.NORMAL)
        self.btn_stop.configure(state=tk.DISABLED)
        self._gen += 1

    def _on_close(self):
        if self.worker and self.worker.is_alive():
            if not messagebox.askyesno("确认", "任务进行中，确定退出？"):
                return
            self.worker.cancelled = True
        self.destroy()
        sys.exit(0)

    # =====================================================================
    # Queue polling
    # =====================================================================

    def _poll_queue(self):
        if self.worker:
            try:
                while True:
                    msg = self.worker.queue.get_nowait()
                    if msg[-1] == self._gen:
                        self._handle_message(msg)
            except queue.Empty:
                pass
            except Exception:
                pass
        self._poll_id = self.after(100, self._poll_queue)

    def _handle_message(self, msg):
        mtype = msg[0]
        if mtype == MSG_LOG:
            self._log(msg[1])
        elif mtype == MSG_PROGRESS:
            _t, cur, total, fname, _gen = msg
            self.progress["value"] = cur
            self._set_status(f"处理中... {cur}/{total}")
            iid = str(cur)
            if self.tree.exists(iid):
                self.tree.set(iid, "status", "完成")
                self.tree.see(iid)
            pct = int(cur / total * 100) if total else 0
            self.title(f"包装设计工具箱 - {pct}%")
        elif mtype == MSG_ERROR:
            _t, fname, _err, _gen = msg
            for idx, (fp, _sz) in enumerate(self.file_list, 1):
                if os.path.basename(fp) == fname:
                    iid = str(idx)
                    if self.tree.exists(iid):
                        self.tree.set(iid, "status", "失败")
                    break
        elif mtype == MSG_COMPLETE:
            _t, ok, bad, _gen = msg
            self.progress["value"] = self.progress["maximum"]
            self._set_status(f"完成 — 成功 {ok}, 失败 {bad} (共 {ok + bad})")
            self.title("包装设计工具箱")
            self._reset_buttons()
            self.worker = None
        elif mtype == MSG_CANCELLED:
            self._log("已取消。")
            self._set_status("已取消")
            self.title("包装设计工具箱")
            self._reset_buttons()
            self.worker = None
        elif mtype == MSG_ABORTED:
            self._log(f"严重错误: {msg[1]}")
            self._set_status("错误中止")
            self.title("包装设计工具箱")
            messagebox.showerror("错误", msg[1])
            self._reset_buttons()
            self.worker = None

    def _reset_buttons(self):
        self.btn_pdf.configure(state=tk.NORMAL)
        self.btn_minimal.configure(state=tk.NORMAL)
        self.btn_outline.configure(state=tk.NORMAL)
        self.btn_stop.configure(state=tk.DISABLED)

    # =====================================================================
    # Helpers
    # =====================================================================

    def _log(self, text):
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, text + "\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _clear_log(self):
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.delete("1.0", tk.END)
        self.log_text.configure(state=tk.DISABLED)

    def _set_status(self, text):
        self.status_var.set(text)

    def _register_theme_widgets(self):
        """Tell the theme manager about plain-tk widgets that need recolouring."""
        t = self.theme
        t.register(self.status_bar, background="bg1", foreground="fg1")
        t.register(self.log_text, background="bg2", foreground="fg0",
                   insertbackground="fg0")
        t.register(self._drop_hint, bg="bg0", fg="fg1")
        t.register(self.barcode_preview.canvas, background="bg2")

    def _about(self):
        messagebox.showinfo("关于",
                            "包装设计工具箱  v2.1\n\n"
                            "Illustrator：批量导出 PDF / 最小化 PDF / 文字转曲\n"
                            "条码生成器：EAN / UPC / Code128 / 矢量 SVG 输出\n"
                            "外观：浅色 / 深色 / 追随系统\n\n"
                            "依赖：Adobe Illustrator + Python\n\n"
                            "软件为 Lewis-Weng 设计\n"
                            "联系方式：Leclerc_Weng@gmail.com")

    def destroy(self):
        if self._poll_id:
            self.after_cancel(self._poll_id)
            self._poll_id = None
        super().destroy()
