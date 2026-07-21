"""
Refined UI theme for 包装设计工具箱.
Colour palette synthesised from 3 UI reference images:
  - Warm cream (#f0f0e0 family) → comfort & approachability
  - Neutral gray (#d0d0d0 family) → structure & hierarchy
  - Cool white (#f0f0f0 + blue undertones) → modern clarity
"""

import os
import json
import tkinter as tk
from tkinter import ttk

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
THEME_LIGHT  = "light"
THEME_DARK   = "dark"
THEME_SYSTEM = "system"

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             "settings.json")

# =========================================================================
# Refined colour palettes
# =========================================================================

_LIGHT = {
    # Background hierarchy (inspired by Image-3 cool white + Image-1 warmth)
    "bg0":          "#f2f1ee",
    "bg1":          "#fafaf8",
    "bg2":          "#ffffff",

    # Brand accent: muted indigo (derived from Image-3 blue undertones)
    "accent":       "#5e5cd6",
    "accent_soft":  "#e8e7fa",

    # Text
    "fg0":          "#1c1c1e",
    "fg1":          "#87878c",

    # Borders & shadows (Image-2 gray hierarchy)
    "border":       "#e4e3de",
    "border_strong":"#d0cfc8",
    "shadow":       "#e8e7e2",

    # Nav
    "nav_on":       "#5e5cd6",
    "nav_off":      "#fafaf8",

    # Semantic
    "danger":       "#e53e3e",
    "success":      "#38a169",
}

_DARK = {
    "bg0":          "#131315",
    "bg1":          "#1f1f22",
    "bg2":          "#2a2a2e",

    "accent":       "#817df2",
    "accent_soft":  "#2a2844",

    "fg0":          "#f2f2f5",
    "fg1":          "#9a9aa0",

    "border":       "#333338",
    "border_strong":"#44444a",
    "shadow":       "#0e0e10",

    "nav_on":       "#817df2",
    "nav_off":      "#1f1f22",

    "danger":       "#fc5c5c",
    "success":      "#4ade80",
}


def _resolve_palette(theme_name):
    return _DARK if theme_name == THEME_DARK else _LIGHT


# ---------------------------------------------------------------------------
# Settings I/O
# ---------------------------------------------------------------------------

def load_settings():
    if os.path.isfile(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"theme": THEME_SYSTEM}


def save_settings(settings):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)
    except Exception:
        pass


def _get_windows_theme():
    try:
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
        value, _ = winreg.QueryValueEx(key, "AppsUseLightTheme")
        winreg.CloseKey(key)
        return THEME_LIGHT if value == 1 else THEME_DARK
    except Exception:
        return THEME_LIGHT


def resolve_theme(settings):
    theme = settings.get("theme", THEME_SYSTEM)
    if theme == THEME_SYSTEM:
        return _get_windows_theme()
    return theme


# =========================================================================
# ThemeManager
# =========================================================================

class ThemeManager:
    """Applies the visual theme."""

    def __init__(self, app):
        self.app = app
        self._current = None
        self._registered = []

    def apply(self, theme_name):
        p = _resolve_palette(theme_name)
        self._current = theme_name
        style = ttk.Style()

        available = style.theme_names()
        base = "clam" if "clam" in available else available[0]
        style.theme_use(base)

        # ---- 0. global defaults ------------------------------------------
        style.configure(".", background=p["bg0"], foreground=p["fg0"],
                        fieldbackground=p["bg2"], borderwidth=0,
                        font=("Microsoft YaHei UI", 9))

        # ---- 1. frames ---------------------------------------------------
        style.configure("TFrame", background=p["bg0"], borderwidth=0)
        # Card surface (elevated / "glass")
        style.configure("Card.TFrame", background=p["bg1"],
                        borderwidth=1, relief="solid",
                        bordercolor=p["border"])
        style.configure("Surface.TFrame", background=p["bg1"], borderwidth=0)

        # ---- 2. labels ---------------------------------------------------
        style.configure("TLabel", background=p["bg0"], foreground=p["fg0"],
                        borderwidth=0)
        style.configure("Card.TLabel", background=p["bg1"], foreground=p["fg0"])
        style.configure("Muted.TLabel", foreground=p["fg1"])
        style.configure("Heading.TLabel",
                        font=("Microsoft YaHei UI", 13, "bold"),
                        foreground=p["fg0"])
        style.configure("Title.TLabel",
                        font=("Microsoft YaHei UI", 17, "bold"),
                        foreground=p["fg0"])
        style.configure("Accent.TLabel", foreground=p["accent"])

        # ---- 3. buttons --------------------------------------------------
        style.configure("TButton",
                        background=p["bg1"], foreground=p["fg0"],
                        borderwidth=1, relief="solid",
                        bordercolor=p["border"],
                        padding=(14, 6))
        style.map("TButton",
                  background=[("active", p["accent_soft"]),
                              ("!active", p["bg1"])],
                  foreground=[("active", p["accent"]),
                              ("!active", p["fg0"])])

        style.configure("Primary.TButton",
                        background=p["accent"], foreground="#ffffff",
                        borderwidth=0, padding=(16, 8),
                        font=("Microsoft YaHei UI", 9, "bold"))
        style.map("Primary.TButton",
                  background=[("active", p["accent"])])

        # ---- 4. nav pills ------------------------------------------------
        style.configure("Nav.TButton",
                        background=p["nav_off"], foreground=p["fg0"],
                        borderwidth=1, relief="solid",
                        bordercolor=p["border"],
                        padding=(20, 8),
                        font=("Microsoft YaHei UI", 10))
        style.map("Nav.TButton",
                  background=[("active", p["bg1"])])

        style.configure("NavActive.TButton",
                        background=p["accent"], foreground="#ffffff",
                        borderwidth=0, padding=(20, 8),
                        font=("Microsoft YaHei UI", 10, "bold"))
        style.map("NavActive.TButton",
                  background=[("active", p["accent"])])

        # ---- 5. sidebar items --------------------------------------------
        style.configure("Sidebar.TButton",
                        background=p["bg0"], foreground=p["fg0"],
                        borderwidth=0, padding=(12, 9), anchor=tk.W,
                        font=("Microsoft YaHei UI", 10))
        style.map("Sidebar.TButton",
                  background=[("active", p["bg1"])])

        style.configure("SidebarActive.TButton",
                        background=p["bg1"], foreground=p["accent"],
                        borderwidth=0, padding=(12, 9), anchor=tk.W,
                        font=("Microsoft YaHei UI", 10, "bold"))

        # ---- 6. form controls --------------------------------------------
        style.configure("TRadiobutton", background=p["bg0"],
                        foreground=p["fg0"])
        style.configure("Card.TRadiobutton", background=p["bg1"],
                        foreground=p["fg0"])
        style.configure("TCheckbutton", background=p["bg0"],
                        foreground=p["fg0"])
        style.configure("TEntry", fieldbackground=p["bg2"],
                        foreground=p["fg0"], borderwidth=1,
                        relief="solid", bordercolor=p["border"],
                        padding=(8, 6))
        style.configure("TCombobox", fieldbackground=p["bg2"],
                        foreground=p["fg0"], borderwidth=1,
                        relief="solid", bordercolor=p["border"],
                        padding=(6, 4))
        style.map("TCombobox",
                  fieldbackground=[("readonly", p["bg2"])])

        # ---- 7. progress bar ---------------------------------------------
        style.configure("TProgressbar", background=p["accent"],
                        troughcolor=p["bg2"], borderwidth=0, thickness=6)

        # ---- 8. separator ------------------------------------------------
        style.configure("TSeparator", background=p["border"])

        # ---- 9. treeview (file list) ------------------------------------
        style.configure("Treeview",
                        background=p["bg2"], foreground=p["fg0"],
                        fieldbackground=p["bg2"], borderwidth=0, rowheight=30)
        style.map("Treeview",
                  background=[("selected", p["accent"])],
                  foreground=[("selected", "#ffffff")])
        style.configure("Treeview.Heading",
                        background=p["bg0"], foreground=p["fg1"],
                        borderwidth=0, padding=(8, 6))

        # ---- 10. labelframe ----------------------------------------------
        style.configure("Glass.TLabelframe",
                        background=p["bg0"], foreground=p["fg0"],
                        borderwidth=1, relief="solid",
                        bordercolor=p["border"])
        style.configure("Glass.TLabelframe.Label",
                        background=p["bg0"], foreground=p["fg1"],
                        font=("Microsoft YaHei UI", 9))

        # ---- 11. tk root -------------------------------------------------
        self.app.configure(bg=p["bg0"])

        # ---- 12. registered plain-tk widgets ----------------------------
        for widget, attr_map in self._registered:
            try:
                for attr, key in attr_map.items():
                    widget.configure(**{attr: p[key]})
            except Exception:
                pass

        # ---- 13. barcode canvas -----------------------------------------
        try:
            preview = self.app.page_bc.winfo_children()[0]
            if hasattr(preview, 'canvas'):
                preview.canvas.configure(bg=p["bg2"])
        except Exception:
            pass

    # -- helpers ------------------------------------------------------------

    def current(self):
        return self._current

    def register(self, widget, **attr_map):
        self._registered.append((widget, attr_map))

    @property
    def palette(self):
        return _resolve_palette(self._current or THEME_LIGHT)


# =========================================================================
# Settings panel (inline in More page)
# =========================================================================

def build_settings_panel(parent, theme_manager, settings):
    p = theme_manager.palette
    f = ttk.Frame(parent, padding=24)

    card = ttk.Frame(f, style="Card.TFrame", padding=28)
    card.pack(fill=tk.X)

    ttk.Label(card, text="外观", style="Heading.TLabel").pack(anchor=tk.W)
    ttk.Label(card, text="选择界面主题，更改即时生效",
              style="Muted.TLabel").pack(anchor=tk.W, pady=(2, 24))

    theme_var = tk.StringVar(value=settings.get("theme", THEME_SYSTEM))

    for label, value in [
        ("☀️  浅色模式", THEME_LIGHT),
        ("🌙  深色模式", THEME_DARK),
        ("🖥️  跟随系统", THEME_SYSTEM),
    ]:
        rb = ttk.Radiobutton(card, text=label, variable=theme_var,
                             value=value, style="Card.TRadiobutton")
        rb.pack(anchor=tk.W, pady=6)

    def _on_change(*_):
        settings["theme"] = theme_var.get()
        save_settings(settings)
        theme_manager.apply(resolve_theme(settings))

    theme_var.trace_add("write", _on_change)
    return f
