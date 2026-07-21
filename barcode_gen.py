"""
Barcode generation module for the 包装设计工具箱.
Uses python-barcode to generate vector SVG barcodes.
"""

import os
import io
import tkinter as tk
from tkinter import ttk, filedialog, messagebox


# ---------------------------------------------------------------------------
# Barcode types useful for packaging / logistics
# ---------------------------------------------------------------------------
BARCODE_TYPES = [
    ("EAN-13  —— 通用商品条码", "ean13"),
    ("EAN-8   —— 小包装条码", "ean8"),
    ("UPC-A   —— 北美商品条码", "upca"),
    ("Code128 —— 物流/仓储", "code128"),
    ("Code39  —— 工业标识", "code39"),
    ("ITF     —— 外箱条码", "itf"),
    ("GS1-128 —— 物流标签", "gs1_128"),
    ("ISBN-13 —— 图书条码", "isbn13"),
    ("ISSN    —— 期刊条码", "issn"),
]

DEFAULT_TYPE = "ean13"

# ---------------------------------------------------------------------------
# Fallback renderer — draws barcode with tkinter Canvas when python-barcode
# is not available or SVG render fails.
# ---------------------------------------------------------------------------
_FALLBACK_TYPES = {
    "ean13":   (12, r"^\d{12}$", [1, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6]),
    "ean8":    (7, r"^\d{7}$",  [1, 4, 4, 4, 4, 4, 4, 4]),
    "upca":    (11, r"^\d{11}$", [1, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6]),
    "code128": (None, r"^[\x20-\x7e]+$", None),
    "code39":  (None, r"^[A-Z0-9 .\-$/+%]+$", None),
    "itf":     (None, r"^\d+$", None),
    "gs1_128": (None, r"^[\x20-\x7e]+$", None),
    "isbn13":  (12, r"^\d{12}$", [1, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6]),
    "issn":    (7, r"^\d{7}$",  None),
}

# "Narrow / wide" patterns for the common linear symbologies.
# Only a simplified visual — the real rendering uses python-barcode.
_CODE39_TABLE = {
    '0':'101001101101','1':'110100101011','2':'101100101011','3':'110110010101',
    '4':'101001101011','5':'110100110101','6':'101100110101','7':'101001011011',
    '8':'110100101101','9':'101100101101','A':'110101001011','B':'101101001011',
    'C':'110110100101','D':'101011001011','E':'110101100101','F':'101101100101',
    'G':'101010011011','H':'110101001101','I':'101101001101','J':'101011001101',
    'K':'110101010011','L':'101101010011','M':'110110101001','N':'101011010011',
    'O':'110101101001','P':'101101101001','Q':'101010110011','R':'110101011001',
    'S':'101101011001','T':'101011011001','U':'110010101011','V':'100110101011',
    'W':'110011010101','X':'100101101011','Y':'110010110101','Z':'100110110101',
    ' ':'100110101101','-':'100101011011','.':'110010101101','$':'100100100101',
    '/':'100100101001','+':'100101001001','%':'101001001001',
}


# =========================================================================
# Barcode renderer — generates an SVG string
# =========================================================================

def generate_barcode_svg(code, barcode_type, width=400, height=200,
                         font_size=14, include_text=True):
    """
    Generate an SVG barcode image.

    Returns
    -------
    str : SVG content as a string, or None on failure.
    """
    try:
        import barcode
        from barcode.writer import SVGWriter

        bc_cls = barcode.get(barcode_type)
        bc = bc_cls(code, writer=SVGWriter())

        # Configure writer options
        opts = {
            "module_width": 0.3,
            "module_height": height * 0.5 / 100,  # approx
            "font_size": font_size,
            "text_distance": 5,
            "quiet_zone": 6.5,
            "write_text": include_text,
            "text": code if include_text else "",
            "background": "white",
            "foreground": "black",
            "center_text": True,
        }

        fp = io.BytesIO()
        bc.write(fp, options=opts)
        svg_bytes = fp.getvalue()
        return svg_bytes.decode("utf-8")
    except Exception:
        return None


def save_barcode_svg(code, barcode_type, filepath, width=400, height=200,
                     font_size=14):
    """Generate barcode and save as an SVG file. Returns True on success."""
    svg = generate_barcode_svg(code, barcode_type, width, height, font_size)
    if svg is None:
        return False
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(svg)
    return True


# =========================================================================
# Preview widget — renders the SVG in a tkinter Canvas (simple case)
# =========================================================================

class BarcodePreview(ttk.Frame):
    """A frame that shows a barcode preview and provides save controls."""

    def __init__(self, parent, **kw):
        super().__init__(parent, **kw)
        self._svg_data = None
        self._code = ""
        self._bc_type = DEFAULT_TYPE

        # ---- controls ----------------------------------------------------
        ctrl = ttk.Frame(self)
        ctrl.pack(fill=tk.X, pady=(0, 8))

        ttk.Label(ctrl, text="条码类型:").pack(side=tk.LEFT)
        self.type_var = tk.StringVar(value=BARCODE_TYPES[0][1])
        type_names = [n for n, _v in BARCODE_TYPES]
        self.type_combo = ttk.Combobox(
            ctrl, textvariable=self.type_var, values=type_names,
            state="readonly", width=30,
        )
        self.type_combo.pack(side=tk.LEFT, padx=4)
        self.type_combo.bind("<<ComboboxSelected>>", self._on_type_change)

        ttk.Label(ctrl, text="  编码:").pack(side=tk.LEFT)
        self.code_var = tk.StringVar()
        self.code_entry = ttk.Entry(ctrl, textvariable=self.code_var, width=28)
        self.code_entry.pack(side=tk.LEFT, padx=4)
        self.code_entry.bind("<Return>", lambda e: self.generate())

        ttk.Button(ctrl, text="生成预览", command=self.generate).pack(
            side=tk.LEFT, padx=6)

        # ---- canvas for preview ------------------------------------------
        self.canvas = tk.Canvas(
            self, bg="white", height=200, bd=1, relief=tk.SUNKEN)
        self.canvas.pack(fill=tk.BOTH, expand=True, pady=(0, 8))

        self.status_var = tk.StringVar(value="输入条码编码后点击「生成预览」")
        ttk.Label(self, textvariable=self.status_var, anchor=tk.CENTER).pack()

        # ---- export row --------------------------------------------------
        export_row = ttk.Frame(self)
        export_row.pack(fill=tk.X, pady=(8, 0))
        ttk.Button(export_row, text="导出 SVG (矢量)",
                   command=self._export_svg).pack(side=tk.LEFT, padx=2)
        ttk.Button(export_row, text="导出 PNG (位图)",
                   command=self._export_png).pack(side=tk.LEFT, padx=2)

    def _on_type_change(self, event=None):
        # Map display name → type key
        sel = self.type_combo.current()
        if 0 <= sel < len(BARCODE_TYPES):
            self._bc_type = BARCODE_TYPES[sel][1]

    def generate(self):
        code = self.code_var.get().strip()
        if not code:
            self.status_var.set("请输入条码编码")
            return

        # Resolve type from combo selection
        sel = self.type_combo.current()
        if 0 <= sel < len(BARCODE_TYPES):
            self._bc_type = BARCODE_TYPES[sel][1]

        self._code = code

        try:
            import barcode
            bc_cls = barcode.get(self._bc_type)
            bc = bc_cls(code)
            self.status_var.set(f"✓ {self._bc_type.upper()}: {code}  — 有效")
        except Exception as exc:
            self.status_var.set(f"✗ 无效条码: {exc}")
            self._svg_data = None
            self.canvas.delete("all")
            return

        # Generate SVG
        svg = generate_barcode_svg(code, self._bc_type, font_size=14)
        if svg is None:
            self.status_var.set("✗ 生成失败，请检查编码格式")
            self.canvas.delete("all")
            return

        self._svg_data = svg
        self._draw_preview(svg)

    def _draw_preview(self, svg):
        """Extract bar positions from SVG and draw on canvas."""
        self.canvas.delete("all")
        import xml.etree.ElementTree as ET
        try:
            root = ET.fromstring(svg)
        except Exception:
            self.canvas.create_text(200, 100, text="无法渲染预览\n(SVG 已生成，可导出)",
                                    fill="gray")
            return

        w = self.canvas.winfo_width() or 600
        h = self.canvas.winfo_height() or 200

        # Parse viewBox / width
        vb = root.get("viewBox", "")
        if vb:
            _x, _y, vb_w, vb_h = (float(x) for x in vb.split())
        else:
            vb_w = float(root.get("width", "200").replace("px", ""))
            vb_h = float(root.get("height", "100").replace("px", ""))

        scale_x = w / vb_w if vb_w > 0 else 1
        scale_y = h / vb_h if vb_h > 0 else 1
        scale = min(scale_x, scale_y)
        off_x = (w - vb_w * scale) / 2
        off_y = (h - vb_h * scale) / 2

        ns = "http://www.w3.org/2000/svg"
        for rect in root.iter(f"{{{ns}}}rect"):
            rx = float(rect.get("x", 0)) * scale + off_x
            ry = float(rect.get("y", 0)) * scale + off_y
            rw = float(rect.get("width", 0)) * scale
            rh = float(rect.get("height", 0)) * scale
            fill = rect.get("fill", "black")
            if fill != "white":
                self.canvas.create_rectangle(rx, ry, rx + rw, ry + rh,
                                             fill=fill, outline="")

        for text_elem in root.iter(f"{{{ns}}}text"):
            tx = float(text_elem.get("x", 0)) * scale + off_x
            ty = float(text_elem.get("y", 0)) * scale + off_y
            ttext = text_elem.text or ""
            self.canvas.create_text(tx, ty, text=ttext,
                                    anchor="s", font=("Arial", 10))

    def _export_svg(self):
        if not self._svg_data:
            messagebox.showwarning("提示", "请先生成条码预览。")
            return
        filepath = filedialog.asksaveasfilename(
            title="导出矢量 SVG",
            defaultextension=".svg",
            filetypes=[("SVG 矢量文件", "*.svg"), ("所有文件", "*.*")],
            initialfile=f"{self._code}.svg" if self._code else "barcode.svg",
        )
        if filepath:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(self._svg_data)
            self.status_var.set(f"✓ 已保存: {os.path.basename(filepath)}")

    def _export_png(self):
        if not self._svg_data:
            messagebox.showwarning("提示", "请先生成条码预览。")
            return
        filepath = filedialog.asksaveasfilename(
            title="导出位图 PNG",
            defaultextension=".png",
            filetypes=[("PNG 图片", "*.png"), ("所有文件", "*.*")],
            initialfile=f"{self._code}.png" if self._code else "barcode.png",
        )
        if not filepath:
            return
        try:
            import cairosvg
            cairosvg.svg2png(bytestring=self._svg_data.encode(),
                             write_to=filepath)
        except ImportError:
            messagebox.showwarning(
                "提示",
                "PNG 导出需要 cairosvg 库。\n请运行: pip install cairosvg\n\n"
                "您也可以先导出 SVG，再用 Illustrator 打开。")
            return
        except Exception as exc:
            messagebox.showerror("错误", f"PNG 导出失败: {exc}")
            return
        self.status_var.set(f"✓ 已保存: {os.path.basename(filepath)}")


# =========================================================================
# Standalone window
# =========================================================================

def open_barcode_window(parent):
    """Open a Toplevel window for barcode generation."""
    win = tk.Toplevel(parent)
    win.title("条码生成器")
    win.geometry("720x520")
    win.minsize(600, 400)
    win.transient(parent)

    preview = BarcodePreview(win)
    preview.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

    # Make sure we grab focus
    win.focus_set()
