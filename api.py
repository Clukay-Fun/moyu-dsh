"""
Python ↔ JavaScript bridge for the webview UI.
"""

import os
import sys
import io
import json
import queue
import threading
import subprocess
import webview

try:
    import pythoncom
    import win32com.client
    HAS_WIN32 = True
except ImportError:
    # 非 Windows 平台（如 macOS 调试）无 pywin32，AI/PS 联动功能不可用，
    # 但 UI 与条码生成等其余功能仍可正常运行。
    pythoncom = None
    win32com = None
    HAS_WIN32 = False

from converter import (
    BatchWorker, OutlineWorker, find_ai_files, format_size,
    MSG_PROGRESS, MSG_LOG, MSG_ERROR, MSG_COMPLETE, MSG_CANCELLED, MSG_ABORTED,
)
from barcode_engine import generate_svg, SUPPORTED_TYPES
from theme import load_settings, save_settings, resolve_theme, THEME_LIGHT, THEME_DARK, THEME_SYSTEM

import re as _re


def _reveal_in_file_manager(path):
    """在系统文件管理器中定位文件，按平台选择命令。"""
    if not path or not os.path.exists(path):
        return
    if sys.platform.startswith("win"):
        subprocess.run(["explorer", "/select,", os.path.normpath(path)])
    elif sys.platform == "darwin":
        subprocess.run(["open", "-R", path])
    else:
        subprocess.run(["xdg-open", os.path.dirname(path)])


def _safe_filename(name, fallback="barcode", maxlen=64):
    """把用户输入的 code 清洗成安全文件名主干：只保留字母/数字/-/_。

    Code39/Code128 允许 `/`、`\\`、`.`、空格 等字符，若直接拼进路径可能
    穿越到桌面/临时目录之外甚至覆盖任意可写文件。这里统一清洗以杜绝穿越。
    """
    safe = _re.sub(r"[^A-Za-z0-9_-]", "_", str(name)).strip("_-")
    return safe[:maxlen] or fallback


class Api:

    def __init__(self):
        # pywebview 会递归公开 js_api 的非私有属性；窗口对象必须私有，
        # 否则会扫描其原生控件树并导致 API 注入递归失败。
        self._window = None
        self._worker = None
        self._gen = 0
        self._msg_queue = queue.Queue()
        self._file_list = []
        self.settings = load_settings()

    # =====================================================================
    # Message pump
    # =====================================================================

    def poll_messages(self):
        msgs = []
        while True:
            try:
                msg = self._msg_queue.get_nowait()
                if msg[-1] == self._gen:
                    msgs.append(self._serialise_msg(msg))
            except queue.Empty:
                break
        return json.dumps(msgs) if msgs else "[]"

    def _serialise_msg(self, msg):
        mtype = msg[0]
        result = {"type": mtype}
        if mtype == MSG_LOG:
            result["text"] = str(msg[1])
        elif mtype == MSG_PROGRESS:
            result["current"] = msg[1]
            result["total"] = msg[2]
            result["filename"] = str(msg[3])
        elif mtype == MSG_ERROR:
            result["filename"] = str(msg[1])
            result["error"] = str(msg[2])
        elif mtype == MSG_COMPLETE:
            result["success"] = msg[1]
            result["fail"] = msg[2]
        elif mtype == MSG_ABORTED:
            result["reason"] = str(msg[1])
        return result

    # =====================================================================
    # File list
    # =====================================================================

    def add_paths(self, paths_json):
        paths = json.loads(paths_json)
        found = []
        for p in paths:
            p = os.path.normpath(p)
            if os.path.isfile(p) and p.lower().endswith(".ai"):
                found.append(p)
            elif os.path.isdir(p):
                found.extend(find_ai_files(p))
        added = 0
        for p in found:
            if not any(p == f[0] for f in self._file_list):
                try:
                    sz = os.path.getsize(p)
                except OSError:
                    sz = 0
                self._file_list.append((p, sz))
                added += 1
        if added:
            self._emit_log(f"已添加 {added} 个文件")
        return json.dumps(self._get_file_list())

    def remove_file(self, index_json):
        idx = json.loads(index_json)
        if 0 <= idx < len(self._file_list):
            del self._file_list[idx]
        return json.dumps(self._get_file_list())

    def clear_files(self):
        self._file_list.clear()
        return json.dumps(self._get_file_list())

    def get_files(self):
        return json.dumps(self._get_file_list())

    def _get_file_list(self):
        return [{"name": os.path.basename(p), "size": format_size(s), "path": p}
                for p, s in self._file_list]

    def open_file_location(self, index_json):
        idx = json.loads(index_json)
        if 0 <= idx < len(self._file_list):
            fp = self._file_list[idx][0]
            _reveal_in_file_manager(fp)

    # =====================================================================
    # Workers
    # =====================================================================

    def start_pdf_export(self, mode_json):
        opts = json.loads(mode_json)
        mode = opts.get("mode", "default")
        same_folder = opts.get("sameFolder", True)
        out_dir = opts.get("outputDir", "")
        if not self._file_list:
            self._emit_log("请先添加 AI 文件")
            return "error:no_files"
        if not same_folder and not out_dir:
            self._emit_log("请选择输出目录")
            return "error:no_output_dir"
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        self._gen += 1
        gen = self._gen
        worker = BatchWorker(
            [f[0] for f in self._file_list], out_dir,
            same_folder=same_folder, generation=gen, mode=mode)
        self._worker = worker
        self._start_worker_pump(worker)
        worker.start()
        return json.dumps({"gen": gen, "total": len(self._file_list)})

    def start_outline(self):
        if not self._file_list:
            self._emit_log("请先添加 AI 文件")
            return "error:no_files"
        self._gen += 1
        gen = self._gen
        worker = OutlineWorker([f[0] for f in self._file_list], generation=gen)
        self._worker = worker
        self._start_worker_pump(worker)
        worker.start()
        return json.dumps({"gen": gen, "total": len(self._file_list)})

    def stop_worker(self):
        if self._worker:
            self._worker.cancelled = True
        self._gen += 1

    def _start_worker_pump(self, worker):
        def pump():
            while True:
                try:
                    msg = worker.queue.get(timeout=0.2)
                    self._msg_queue.put(msg)
                except queue.Empty:
                    if not worker.is_alive():
                        break
                except Exception:
                    break
        threading.Thread(target=pump, daemon=True).start()

    def _emit_log(self, text):
        self._msg_queue.put((MSG_LOG, text, self._gen))

    # =====================================================================
    # Barcode
    # =====================================================================

    def barcode_types(self):
        types = [("UPCA  —— 通用商品条码", "upca"),
                 ("EAN-13 —— 国际商品条码", "ean13"),
                 ("EAN-8  —— 小包装条码", "ean8"),
                 ("Code128—— 物流仓储", "code128"),
                 ("Code39 —— 工业标识", "code39"),
                 ("ITF    —— 外箱条码", "itf"),
                 ("Auto   —— 自动识别 UPC/EAN", "auto"),
                 ("QR     —— 二维码", "qrcode")]
        return json.dumps([{"label": n, "value": v} for n, v in types])

    def generate_barcode(self, opts_json):
        opts = json.loads(opts_json)
        code = opts.get("code", "").strip()
        bc_type = opts.get("type", "upca")
        if not code:
            return json.dumps({"error": "请输入条码编码"})
        try:
            svg = generate_svg(code, bc_type)
            return json.dumps({"svg": svg, "code": code, "type": bc_type})
        except Exception as e:
            return json.dumps({"error": str(e)})

    def _barcode_to_raster(self, code, bc_type, dpi, fmt):
        """Render barcode to raster bytes at given DPI using ImageWriter."""
        if bc_type == "qrcode":
            import segno
            from PIL import Image

            png = io.BytesIO()
            segno.make(code).save(png, kind="png", scale=max(1, round(dpi / 72)), border=4)
            if fmt == "PNG":
                return png.getvalue()
            png.seek(0)
            image = Image.open(png)
            output = io.BytesIO()
            image.save(output, format="BMP" if fmt == "BMP" else "TIFF", dpi=(dpi, dpi))
            return output.getvalue()

        import barcode
        from barcode.writer import ImageWriter

        # Calculate size: ~400px wide at 72 DPI, scale for target DPI
        scale = dpi / 72.0
        width = int(400 * scale)
        height = int(180 * scale)

        bc_cls = barcode.get(bc_type)
        writer = ImageWriter()
        writer.set_options({
            "module_width": 0.3 * scale,
            "module_height": height * 0.5 / 100,
            "font_size": int(14 * scale),
            "text_distance": int(5 * scale),
            "quiet_zone": 6.5,
            "write_text": True,
            "text": code,
            "background": "white",
            "foreground": "black",
            "center_text": True,
            "dpi": dpi,
        })

        buf = io.BytesIO()
        bc = bc_cls(code, writer=writer)

        # ImageWriter saves as PNG to a buffer
        bc.write(buf, options=writer.options)
        buf.seek(0)

        if fmt == "PNG":
            return buf.read()

        from PIL import Image
        img = Image.open(buf)

        out = io.BytesIO()
        if fmt == "BMP":
            img.save(out, format="BMP")
        elif fmt == "TIF":
            img.save(out, format="TIFF", dpi=(dpi, dpi))
        else:
            img.save(out, format="PNG")
        return out.getvalue()

    def export_barcode_raster(self, opts_json):
        """Export barcode as raster (PNG/BMP/TIF) to Desktop at given DPI."""
        opts = json.loads(opts_json)
        code = opts["code"]; bc_type = opts["type"]
        dpi = opts.get("dpi", 300); fmt = opts.get("format", "PNG")
        ext = "." + fmt.lower()
        filepath = self.get_desktop_path(code, ext)
        try:
            generate_svg(code, bc_type)
            data = self._barcode_to_raster(code, bc_type, dpi, fmt)
            with open(filepath, "wb") as f:
                f.write(data)
            return json.dumps({"ok": True, "filepath": filepath,
                               "filename": os.path.basename(filepath)})
        except Exception as e:
            return json.dumps({"error": str(e)})

    def export_barcode_svg(self, opts_json):
        """Export barcode as SVG to Desktop."""
        opts = json.loads(opts_json)
        code = opts["code"]; bc_type = opts["type"]
        filepath = self.get_desktop_path(code, ".svg")
        try:
            svg = generate_svg(code, bc_type)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(svg)
            return json.dumps({"ok": True, "filepath": filepath,
                               "filename": os.path.basename(filepath)})
        except Exception as e:
            return json.dumps({"error": str(e)})

    def export_barcode_eps(self, opts_json):
        """Export barcode as vector EPS to Desktop via Illustrator COM."""
        opts = json.loads(opts_json)
        if not HAS_WIN32:
            return json.dumps({"error": "EPS 导出需要 Adobe Illustrator + pywin32（仅 Windows 可用）"})
        code = opts["code"]; bc_type = opts["type"]
        filepath = self.get_desktop_path(code, ".eps")

        try:
            svg = generate_svg(code, bc_type)
        except Exception as e:
            return json.dumps({"error": str(e)})

        import tempfile
        tmp_svg = os.path.join(tempfile.gettempdir(), f"_bc_{_safe_filename(code)}.svg")
        with open(tmp_svg, "w", encoding="utf-8") as f:
            f.write(svg)

        try:
            pythoncom.CoInitialize()
            app = win32com.client.Dispatch("Illustrator.Application")
            # Set UI level via JS (more reliable than Python COM property)
            app.DoJavaScript(
                'app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS')
            app.Open(tmp_svg)
            eps_js = (
                'var d=app.activeDocument;'
                'var f=new File("' + filepath.replace("\\", "/") + '");'
                'var o=new EPSSaveOptions();'
                'o.includeDocumentThumbnails=false;'
                'd.saveAs(f,o);'
                'd.close(SaveOptions.DONOTSAVECHANGES);'
                '"OK";'
            )
            result = app.DoJavaScript(eps_js)
            pythoncom.CoUninitialize()
            if result == "OK" and os.path.isfile(filepath):
                return json.dumps({"ok": True, "filepath": filepath,
                                   "filename": os.path.basename(filepath)})
            return json.dumps({"error": f"EPS export failed: {result}"})
        except Exception as e:
            try: pythoncom.CoUninitialize()
            except: pass
            return json.dumps({"error": str(e)})

    def get_desktop_path(self, code, ext):
        """Build a save path on the Desktop: ~/Desktop/{code}.{ext}"""
        desktop = os.path.expanduser("~/Desktop")
        base = os.path.join(desktop, _safe_filename(code))
        path = base + ext
        # If file exists, append (1), (2), ...
        n = 1
        while os.path.exists(path):
            path = f"{base} ({n}){ext}"
            n += 1
        return path

    def open_in_illustrator(self, opts_json):
        """Generate SVG in temp dir and open in Adobe Illustrator."""
        if not HAS_WIN32:
            return json.dumps({"error": "打开 Illustrator 需要 pywin32（仅 Windows 可用）"})
        opts = json.loads(opts_json)
        code = opts["code"]; bc_type = opts["type"]

        import tempfile
        filepath = os.path.join(tempfile.gettempdir(), f"{_safe_filename(code)}.svg")

        try:
            svg = generate_svg(code, bc_type)
        except Exception as e:
            return json.dumps({"error": str(e)})

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(svg)

        try:
            pythoncom.CoInitialize()
            app = win32com.client.Dispatch("Illustrator.Application")
            app.DoJavaScript(
                'app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS')
            app.Open(filepath)
            pythoncom.CoUninitialize()
            return json.dumps({"ok": True})
        except Exception as e:
            try: pythoncom.CoUninitialize()
            except: pass
            os.startfile(filepath)
            return json.dumps({"ok": True, "fallback": True})

    def open_in_photoshop(self, opts_json):
        """Generate PNG in temp dir and open in Photoshop."""
        if not HAS_WIN32:
            return json.dumps({"error": "打开 Photoshop 需要 pywin32（仅 Windows 可用）"})
        opts = json.loads(opts_json)
        code = opts["code"]; bc_type = opts["type"]
        dpi = opts.get("dpi", 300)

        import tempfile
        filepath = os.path.join(tempfile.gettempdir(), f"{_safe_filename(code)}.png")

        try:
            generate_svg(code, bc_type)
        except Exception as e:
            return json.dumps({"error": str(e)})

        try:
            data = self._barcode_to_raster(code, bc_type, dpi, "PNG")
            with open(filepath, "wb") as f:
                f.write(data)
        except Exception as e:
            return json.dumps({"error": str(e)})

        try:
            pythoncom.CoInitialize()
            app = win32com.client.Dispatch("Photoshop.Application")
            app.Open(filepath)
            pythoncom.CoUninitialize()
            return json.dumps({"ok": True, "filename": os.path.basename(filepath)})
        except Exception:
            try: pythoncom.CoUninitialize()
            except: pass
            os.startfile(filepath)
            return json.dumps({"ok": True, "fallback": True,
                               "filename": os.path.basename(filepath)})

    # =====================================================================
    # Theme
    # =====================================================================

    def get_theme(self):
        accent = self.settings.get("accent", {})
        return json.dumps({
            "theme": self.settings.get("theme", THEME_SYSTEM),
            "accent": accent,
        })

    def set_theme(self, theme):
        self.settings["theme"] = theme
        save_settings(self.settings)
        return resolve_theme(self.settings)

    def save_accent(self, accent_json):
        accent = json.loads(accent_json)
        self.settings["accent"] = accent
        # "windows" flag means follow Windows accent — don't persist
        save_settings(self.settings)
        return "ok"

    def get_windows_accent(self):
        """Return the Windows system accent colour as {r,g,b}."""
        try:
            import winreg
            key = winreg.OpenKey(
                winreg.HKEY_CURRENT_USER,
                r"Software\Microsoft\Windows\DWM")
            value, _ = winreg.QueryValueEx(key, "AccentColor")
            winreg.CloseKey(key)
            # Windows stores as ABGR
            a = (value >> 24) & 0xFF
            b = (value >> 16) & 0xFF
            g = (value >> 8) & 0xFF
            r = value & 0xFF
            return json.dumps({"r": r, "g": g, "b": b})
        except Exception:
            return json.dumps({"r": 94, "g": 92, "b": 214})

    # =====================================================================
    # Dialogs
    # =====================================================================

    def _create_file_dialog(self, dialog_type, **kwargs):
        """在 Windows UI 线程中打开 pywebview 原生文件对话框。

        pywebview 的 js_api 方法运行在工作线程；WinForms 对话框若直接从该
        线程调用会静默失败并返回 None。macOS 仍可直接使用 pywebview 的窗口 API。
        """
        if not self._window:
            return None

        def open_dialog():
            return self._window.create_file_dialog(dialog_type, **kwargs)

        if sys.platform.startswith("win"):
            import webview.platforms.winforms as winforms
            form = winforms.BrowserView.instances.get(self._window.uid)
            if form and form.InvokeRequired:
                return form.Invoke(winforms.Func[winforms.Object](open_dialog))
        return open_dialog()

    def pick_folder(self):
        paths = self._create_file_dialog(webview.FOLDER_DIALOG)
        return paths[0] if paths else ""

    def pick_files(self):
        paths = self._create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=True,
            file_types=("Adobe Illustrator 文件 (*.ai)", "所有文件 (*.*)"),
        )
        return json.dumps(list(paths)) if paths else "[]"

    def pick_folder_files(self):
        paths = self._create_file_dialog(webview.FOLDER_DIALOG)
        return paths[0] if paths else ""
