"""
Core conversion engine: Adobe Illustrator COM automation for batch AI -> PDF export.
Runs on a background thread; communicates with the GUI via a thread-safe queue.
"""

import os
import re
import time
import threading
import queue
import traceback
import json
import subprocess
import sys

# COM is imported inside the worker thread (apartment-threading requirement).

# ---------------------------------------------------------------------------
# Message types the worker pushes into the queue
# ---------------------------------------------------------------------------
MSG_PROGRESS = "progress"   # (type, current, total, filename, generation)
MSG_LOG      = "log"        # (type, message, generation)
MSG_ERROR    = "error"      # (type, filename, error_message, generation)
MSG_COMPLETE = "complete"   # (type, success_count, fail_count, generation)
MSG_CANCELLED = "cancelled" # (type, generation)
MSG_ABORTED  = "aborted"    # (type, reason, generation)


def find_ai_files(folder_path):
    """Recursively find all .ai files under *folder_path*."""
    ai_files = []
    for root, _dirs, files in os.walk(folder_path):
        for f in files:
            if f.lower().endswith(".ai"):
                ai_files.append(os.path.join(root, f))
    return sorted(ai_files)


def format_size(size_bytes):
    """Human-readable file size."""
    for unit in ("B", "KB", "MB", "GB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


# ---------------------------------------------------------------------------
# COM message filter — prevents RPC timeouts on long-running calls.
# When Illustrator is busy opening/saving a 100 MB+ file the COM call may
# take several minutes; the default RPC timeout would kill the call.
# ---------------------------------------------------------------------------

class _ComMessageFilter:
    """IMessageFilter that retries SERVERCALL_RETRYLATER for up to 10 min."""

    _timeout_ms = 600_000   # 10 minutes

    def __init__(self, old_filter=None):
        self._old = old_filter

    # IMessageFilter methods  (called by COM, not by our code directly)

    def HandleInComingCall(self, dwCallType, htaskCaller, dwTickCount,
                           lpInterfaceInfo):
        try:
            import pythoncom
        except ImportError:
            return 0
        return pythoncom.SERVERCALL_ISHANDLED

    def RetryRejectedCall(self, htaskCallee, dwTickCount, dwRejectType):
        try:
            import pythoncom
        except ImportError:
            return -1
        if (dwRejectType == pythoncom.SERVERCALL_RETRYLATER
                and dwTickCount < self._timeout_ms):
            return 1000  # retry after 1 s
        return -1         # give up

    def MessagePending(self, htaskCallee, dwTickCount, dwPendingType):
        try:
            import pythoncom
        except ImportError:
            return 0
        return pythoncom.PENDINGMSG_WAITNOPROCESS


def _install_com_message_filter():
    """Install a tolerant COM message filter. Returns the previous filter."""
    try:
        import pythoncom
        old = pythoncom.MessageFilter
        pythoncom.MessageFilter = _ComMessageFilter(old)
        return old
    except Exception:
        return None


def _uninstall_com_message_filter(old):
    """Restore the previous COM message filter."""
    if old is not None:
        try:
            import pythoncom
            pythoncom.MessageFilter = old
        except Exception:
            pass


# ---------------------------------------------------------------------------
# ExtendScript string escaping
# ---------------------------------------------------------------------------
_JS_ESCAPE_RE = re.compile(r'[\\"\n\r\t\x00-\x1f]')
_JS_ESCAPE_MAP = {
    "\\": "\\\\",
    "\"": '\\"',
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
}


def _escape_for_js(s: str) -> str:
    """Escape *s* for safe embedding inside a JS double-quoted string."""
    def _replacer(m):
        ch = m.group(0)
        if ch in _JS_ESCAPE_MAP:
            return _JS_ESCAPE_MAP[ch]
        return "\\u{:04x}".format(ord(ch))
    return _JS_ESCAPE_RE.sub(_replacer, s)


def _run_macos_javascript(script: str) -> str:
    """Run ExtendScript in Illustrator through macOS' built-in osascript."""
    controller = (
        'const app = Application("Adobe Illustrator");\n'
        'app.activate();\n'
        f'const result = app.doJavascript({json.dumps(script)});\n'
        'if (result !== undefined) console.log(result);\n'
    )
    result = subprocess.run(
        ["osascript", "-l", "JavaScript", "-"],
        input=controller,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        detail = (result.stderr or result.stdout).strip()
        raise RuntimeError(
            "无法控制 Adobe Illustrator。请确认已安装 Illustrator，并在 macOS"
            "‘自动化’权限中允许本应用控制它。" + (f" {detail}" if detail else "")
        )
    return result.stdout.strip()


def _macos_pdf_script(ai_path: str, pdf_path: str, mode: str) -> str:
    """Build one self-contained JSX job for macOS Illustrator automation."""
    options = "var _opts = new PDFSaveOptions();"
    if mode == "minimal250":
        options = """\
var _opts = new PDFSaveOptions();
_opts.preserveEditability = false;
_opts.optimization = true;
_opts.generateThumbnails = false;
_opts.colorCompression = CompressionQuality.JPEGMINIMUM;
_opts.grayscaleCompression = CompressionQuality.JPEGMINIMUM;
_opts.compressArt = true;
_opts.colorDownsamplingMethod = DownsampleMethod.BICUBICDOWNSAMPLE;
_opts.colorDownsampling = 250;
_opts.colorDownsamplingImageThreshold = 250;
_opts.grayscaleDownsamplingMethod = DownsampleMethod.BICUBICDOWNSAMPLE;
_opts.grayscaleDownsampling = 250;
_opts.grayscaleDownsamplingImageThreshold = 250;
_opts.monochromeDownsamplingMethod = DownsampleMethod.BICUBICDOWNSAMPLE;
_opts.monochromeDownsampling = 250;
_opts.monochromeDownsamplingImageThreshold = 250;"""
    return """\
try {
    var _doc = app.open(File("%(ai_path)s"));
    %(options)s
    _doc.saveAs(new File("%(pdf_path)s"), _opts);
    _doc.close(SaveOptions.DONOTSAVECHANGES);
    "OK";
} catch (_e) {
    "ERR:" + _e.toString();
}""" % {
        "ai_path": _escape_for_js(ai_path.replace("\\", "/")),
        "pdf_path": _escape_for_js(pdf_path.replace("\\", "/")),
        "options": options,
    }


# ---------------------------------------------------------------------------
# JavaScript template: open -> save-as-PDF -> close
# ---------------------------------------------------------------------------
# NOTE: We do NOT set pDFPreset because the named-preset list varies across
# Illustrator versions / localisations and can cause error 1129270854 ('CONF').
# The default PDFSaveOptions produce a high-quality PDF without needing a preset.
# JavaScript templates: save-only (open/close are separate Python COM calls).
# Splitting the workflow means each COM call is shorter, avoiding RPC timeouts
# on large files (100 MB+).

_SAVE_STANDARD_SCRIPT = """\
try {
    var _opts = new PDFSaveOptions();
    app.activeDocument.saveAs(new File("%(pdf_path)s"), _opts);
    "OK";
} catch (_e) {
    "ERR:" + _e.toString();
}"""

_SAVE_MINIMAL_250_SCRIPT = """\
try {
    var _opts = new PDFSaveOptions();
    // ---- discard AI editing data (key for small files)
    _opts.preserveEditability = false;
    // ---- web optimisation
    _opts.optimization = true;
    _opts.generateThumbnails = false;
    // ---- image compression: lowest quality = smallest files
    _opts.colorCompression = CompressionQuality.JPEGMINIMUM;
    _opts.grayscaleCompression = CompressionQuality.JPEGMINIMUM;
    _opts.compressArt = true;
    // ---- color bitmap: bicubic to 250 PPI
    _opts.colorDownsamplingMethod = DownsampleMethod.BICUBICDOWNSAMPLE;
    _opts.colorDownsampling = 250;
    _opts.colorDownsamplingImageThreshold = 250;
    // ---- grayscale bitmap: bicubic to 250 PPI
    _opts.grayscaleDownsamplingMethod = DownsampleMethod.BICUBICDOWNSAMPLE;
    _opts.grayscaleDownsampling = 250;
    _opts.grayscaleDownsamplingImageThreshold = 250;
    // ---- monochrome bitmap: bicubic to 250 PPI
    _opts.monochromeDownsamplingMethod = DownsampleMethod.BICUBICDOWNSAMPLE;
    _opts.monochromeDownsampling = 250;
    _opts.monochromeDownsamplingImageThreshold = 250;
    // ---- save
    app.activeDocument.saveAs(new File("%(pdf_path)s"), _opts);
    "OK";
} catch (_e) {
    "ERR:" + _e.toString();
}"""

_CLOSE_SCRIPT = (
    'try{app.activeDocument.close('
    'SaveOptions.DONOTSAVECHANGES)}catch(_e){}'
)


# =========================================================================
# Worker thread
# =========================================================================

class BatchWorker(threading.Thread):
    """
    Background thread that converts .ai -> PDF via Illustrator COM.

    Each file is converted atomically by one ExtendScript call.
    Cancellation is checked between files — clicking Stop during a file
    waits for that file to finish (normally a few seconds), then aborts.
    """

    def __init__(self, file_list, output_dir, same_folder=False, generation=0,
                 mode="default"):
        super().__init__(daemon=True)
        self.file_list = list(file_list)
        self.output_dir = output_dir
        self.same_folder = same_folder
        self.generation = generation
        self.mode = mode                      # "default" | "minimal250"
        self.queue = queue.Queue()
        self.cancelled = False

    # ---- helpers --------------------------------------------------------

    def _emit(self, *args):
        self.queue.put(args)

    def _log(self, msg):
        self._emit(MSG_LOG, msg, self.generation)

    def _progress(self, current, total, filename):
        self._emit(MSG_PROGRESS, current, total, filename, self.generation)

    def _run_macos(self):
        """Batch PDF export via AppleScript/JXA on macOS."""
        success = fail = 0
        total = len(self.file_list)
        cancelled = False
        for idx, filepath in enumerate(self.file_list, 1):
            if self.cancelled:
                cancelled = True
                break
            filename = os.path.basename(filepath)
            self._log(f"[{idx}/{total}] {filename}")
            if not os.path.isfile(filepath):
                self._emit(MSG_ERROR, filename, "file not found", self.generation)
                fail += 1
                self._progress(idx, total, filename)
                continue
            base, _ext = os.path.splitext(filename)
            out_dir = os.path.dirname(filepath) if (self.same_folder or not self.output_dir) else self.output_dir
            pdf_path = os.path.join(out_dir, base + ".pdf")
            started = time.time()
            try:
                result = _run_macos_javascript(_macos_pdf_script(filepath, pdf_path, self.mode))
                if result == "OK" and os.path.isfile(pdf_path):
                    success += 1
                    self._log(f"  OK ({time.time()-started:.0f}s) -> {pdf_path}")
                else:
                    raise RuntimeError(result or "Illustrator did not create a PDF")
            except Exception as exc:
                fail += 1
                self._log(f"  x {exc}")
                self._emit(MSG_ERROR, filename, str(exc), self.generation)
            self._progress(idx, total, filename)
        if cancelled:
            self._emit(MSG_CANCELLED, self.generation)
        else:
            self._emit(MSG_COMPLETE, success, fail, self.generation)

    # ---- main -----------------------------------------------------------

    def run(self):
        if sys.platform == "darwin":
            self._run_macos()
            return
        try:
            import pythoncom
            import win32com.client
        except ImportError:
            self._emit(MSG_ABORTED, "missing pywin32 - pip install pywin32",
                       self.generation)
            return

        pythoncom.CoInitialize()

        # Install a forgiving COM message filter so long-running calls
        # (e.g. opening / saving 100 MB+ files) don't time out.
        _install_com_message_filter()

        success = 0
        fail = 0
        total = len(self.file_list)
        cancelled = False

        # -- connect to Illustrator ---------------------------------------
        try:
            app = win32com.client.Dispatch("Illustrator.Application")
        except Exception:
            self._emit(MSG_ABORTED,
                       "无法启动 Adobe Illustrator", self.generation)
            pythoncom.CoUninitialize()
            return

        try:
            try:
                app.DoJavaScript(
                    'app.userInteractionLevel='
                    'UserInteractionLevel.DONTDISPLAYALERTS')
            except Exception:
                pass

            for idx, filepath in enumerate(self.file_list, 1):
                if self.cancelled:
                    cancelled = True
                    break

                filename = os.path.basename(filepath)
                self._log(f"[{idx}/{total}] {filename}")

                if not os.path.isfile(filepath):
                    self._log("  x file not found, skip")
                    self._emit(MSG_ERROR, filename, "file not found",
                               self.generation)
                    fail += 1
                    self._progress(idx, total, filename)
                    continue

                # Output path
                base, _ext = os.path.splitext(filename)
                out_dir = (os.path.dirname(filepath)
                           if (self.same_folder or not self.output_dir)
                           else self.output_dir)
                pdf_path = os.path.join(out_dir, base + ".pdf")

                t_total = time.time()

                # ==========================================================
                # STEP 1 — Open (Python COM, keeps backslashes on Windows)
                # ==========================================================
                t0 = time.time()
                try:
                    doc = app.Open(filepath)   # native Windows path
                except Exception as exc:
                    self._log(f"  x open failed ({time.time()-t0:.0f}s): {exc}")
                    self._emit(MSG_ERROR, filename, str(exc), self.generation)
                    fail += 1
                    self._progress(idx, total, filename)
                    if "rpc" in str(exc).lower():
                        self._emit(MSG_ABORTED, "Illustrator connection lost",
                                   self.generation)
                        break
                    continue
                self._log(f"  opened ({time.time()-t0:.0f}s)")

                if self.cancelled:
                    try:
                        doc.Close(2)  # aiDontSaveChanges
                    except Exception:
                        pass
                    cancelled = True
                    break

                # ==========================================================
                # STEP 2 — Save as PDF (short JS, only save)
                # ==========================================================
                template = (_SAVE_MINIMAL_250_SCRIPT
                            if self.mode == "minimal250"
                            else _SAVE_STANDARD_SCRIPT)
                save_js = template % {
                    "pdf_path": _escape_for_js(pdf_path.replace("\\", "/")),
                }

                t0 = time.time()
                try:
                    result = app.DoJavaScript(save_js)
                except Exception as exc:
                    self._log(f"  x save failed ({time.time()-t0:.0f}s): {exc}")
                    self._emit(MSG_ERROR, filename, str(exc), self.generation)
                    fail += 1
                    self._progress(idx, total, filename)
                    # Try to close the open document
                    try:
                        app.DoJavaScript(_CLOSE_SCRIPT)
                    except Exception:
                        pass
                    if "rpc" in str(exc).lower():
                        self._emit(MSG_ABORTED, "Illustrator connection lost",
                                   self.generation)
                        break
                    continue

                save_sec = time.time() - t0

                # ==========================================================
                # STEP 3 — Close document
                # ==========================================================
                try:
                    app.DoJavaScript(_CLOSE_SCRIPT)
                except Exception:
                    pass

                total_sec = time.time() - t_total

                # Interpret save result
                if result == "OK":
                    self._log(f"  OK ({total_sec:.0f}s) -> {pdf_path}")
                    success += 1
                elif (result is None
                      and os.path.isfile(pdf_path)
                      and os.path.getsize(pdf_path) > 0):
                    self._log(f"  OK ({total_sec:.0f}s) -> {pdf_path}")
                    success += 1
                else:
                    err_text = str(result or "unknown error")
                    if err_text.startswith("ERR:"):
                        err_text = err_text[4:].strip()
                    self._log(f"  x save={save_sec:.0f}s total={total_sec:.0f}s: {err_text}")
                    self._emit(MSG_ERROR, filename, err_text, self.generation)
                    fail += 1

                self._progress(idx, total, filename)

        except Exception as exc:
            self._emit(MSG_ABORTED, f"unexpected error: {exc}", self.generation)
        finally:
            app = None
            pythoncom.CoUninitialize()
            if cancelled:
                self._emit(MSG_CANCELLED, self.generation)
            else:
                self._emit(MSG_COMPLETE, success, fail, self.generation)


# =========================================================================
# Text-to-outlines worker
# =========================================================================

# ExtendScript: open -> outline all text -> save as -OL -> close
_OUTLINE_SCRIPT = """\
try {
    var _doc = app.open(File("%(ai_path)s"));
    var _n = _doc.textFrames.length;
    if (_n > 0) {
        for (var _i = _n - 1; _i >= 0; _i--) {
            _doc.textFrames[_i].createOutline();
        }
    }
    _doc.saveAs(new File("%(out_path)s"));
    _doc.close(SaveOptions.DONOTSAVECHANGES);
    "OK:" + _n;
} catch (_e) {
    "ERR:" + _e.toString();
}"""


class OutlineWorker(threading.Thread):
    """
    Background thread that opens each .ai file, converts all text frames
    to outlines, and saves as ``filename-OL.ai`` alongside the original.
    """

    def __init__(self, file_list, generation=0):
        super().__init__(daemon=True)
        self.file_list = list(file_list)
        self.generation = generation
        self.queue = queue.Queue()
        self.cancelled = False

    def _emit(self, *args):
        self.queue.put(args)

    def _log(self, msg):
        self._emit(MSG_LOG, msg, self.generation)

    def _progress(self, current, total, filename):
        self._emit(MSG_PROGRESS, current, total, filename, self.generation)

    def _run_macos(self):
        """Text-to-outlines via AppleScript/JXA on macOS."""
        success = fail = 0
        total = len(self.file_list)
        cancelled = False
        for idx, filepath in enumerate(self.file_list, 1):
            if self.cancelled:
                cancelled = True
                break
            filename = os.path.basename(filepath)
            self._log(f"[{idx}/{total}] {filename}")
            if not os.path.isfile(filepath):
                self._emit(MSG_ERROR, filename, "file not found", self.generation)
                fail += 1
                self._progress(idx, total, filename)
                continue
            base, ext = os.path.splitext(filename)
            out_name = base + "-OL" + ext
            out_path = os.path.join(os.path.dirname(filepath), out_name)
            script = _OUTLINE_SCRIPT % {
                "ai_path": _escape_for_js(filepath.replace("\\", "/")),
                "out_path": _escape_for_js(out_path.replace("\\", "/")),
            }
            started = time.time()
            try:
                result = _run_macos_javascript(script)
                if result.startswith("OK:") and os.path.isfile(out_path):
                    success += 1
                    self._log(f"  OK ({time.time()-started:.0f}s) -> {out_name}")
                else:
                    raise RuntimeError(result or "Illustrator did not create an outlined file")
            except Exception as exc:
                fail += 1
                self._log(f"  x {exc}")
                self._emit(MSG_ERROR, filename, str(exc), self.generation)
            self._progress(idx, total, filename)
        if cancelled:
            self._emit(MSG_CANCELLED, self.generation)
        else:
            self._emit(MSG_COMPLETE, success, fail, self.generation)

    def run(self):
        if sys.platform == "darwin":
            self._run_macos()
            return
        try:
            import pythoncom
            import win32com.client
        except ImportError:
            self._emit(MSG_ABORTED, "missing pywin32 - pip install pywin32",
                       self.generation)
            return

        pythoncom.CoInitialize()
        _install_com_message_filter()

        success = 0
        skipped = 0
        fail = 0
        total = len(self.file_list)
        cancelled = False

        try:
            app = win32com.client.Dispatch("Illustrator.Application")
        except Exception:
            self._emit(MSG_ABORTED,
                       "无法启动 Adobe Illustrator", self.generation)
            pythoncom.CoUninitialize()
            return

        try:
            try:
                app.UserInteractionLevel = 1
            except Exception:
                pass

            for idx, filepath in enumerate(self.file_list, 1):
                if self.cancelled:
                    cancelled = True
                    break

                filename = os.path.basename(filepath)
                self._log(f"[{idx}/{total}] {filename}")

                if not os.path.isfile(filepath):
                    self._log("  x file not found, skip")
                    self._emit(MSG_ERROR, filename, "file not found",
                               self.generation)
                    fail += 1
                    self._progress(idx, total, filename)
                    continue

                # Build output name:  name.ai -> name-OL.ai
                base, ext = os.path.splitext(filename)
                out_name = base + "-OL" + ext
                out_dir = os.path.dirname(filepath)
                out_path = os.path.join(out_dir, out_name)

                script = _OUTLINE_SCRIPT % {
                    "ai_path":  _escape_for_js(filepath.replace("\\", "/")),
                    "out_path": _escape_for_js(out_path.replace("\\", "/")),
                }

                t0 = time.time()
                try:
                    result = app.DoJavaScript(script)
                except Exception as exc:
                    elapsed = time.time() - t0
                    tb = traceback.format_exc()
                    self._log(f"  x COM call failed after {elapsed:.0f}s: {exc}")
                    self._log(f"    {tb.split(chr(10))[-3].strip()}")
                    self._emit(MSG_ERROR, filename, str(exc), self.generation)
                    fail += 1
                    self._progress(idx, total, filename)
                    msg = str(exc).lower()
                    if "rpc" in msg or "disconnected" in msg:
                        self._emit(MSG_ABORTED,
                                   "Illustrator connection lost", self.generation)
                        break
                    continue

                elapsed = time.time() - t0

                # Interpret: "OK:144" = outlined 144 text frames
                #            "OK:0"   = no text, file saved as-is
                if result and str(result).startswith("OK:"):
                    n = int(str(result)[3:])
                    if n > 0:
                        self._log(f"  OK ({elapsed:.0f}s) -> {out_name}  ({n} text frames outlined)")
                    else:
                        self._log(f"  - no text frames, saved as {out_name}")
                    success += 1
                elif (result is None
                      and os.path.isfile(out_path)
                      and os.path.getsize(out_path) > 0):
                    self._log(f"  OK -> {out_name}")
                    success += 1
                else:
                    err_text = str(result or "unknown error")
                    if err_text.startswith("ERR:"):
                        err_text = err_text[4:].strip()
                    self._log(f"  x {err_text}")
                    self._emit(MSG_ERROR, filename, err_text, self.generation)
                    fail += 1

                self._progress(idx, total, filename)

        except Exception as exc:
            self._emit(MSG_ABORTED, f"unexpected error: {exc}", self.generation)
        finally:
            app = None
            pythoncom.CoUninitialize()
            if cancelled:
                self._emit(MSG_CANCELLED, self.generation)
            else:
                self._emit(MSG_COMPLETE, success, fail, self.generation)
