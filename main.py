"""
摸鱼工具箱 — Webview entry point.
"""

import os
import sys
import webview

from api import Api


def resource_path(relative):
    """Get path to resource, works for PyInstaller --onefile bundles."""
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative)


HERE = os.path.dirname(os.path.abspath(__file__))
FRONTEND = resource_path("frontend")
INDEX = os.path.join(FRONTEND, "index.html")
ICON = resource_path("icon.ico")


def _ensure_icon():
    """Auto-generate icon.ico from source PNG if missing."""
    if os.path.exists(ICON):
        return
    src = os.path.join(HERE, "icon.ico")
    if os.path.exists(src):
        return
    # Try source PNG locations
    for png in [
        r"C:\Users\AAA\Desktop\UI\logo\icon.png",
        os.path.join(HERE, "icon.png"),
        resource_path("icon.png"),
    ]:
        if os.path.exists(png):
            try:
                from PIL import Image
                img = Image.open(png)
                img.save(ICON, format="ICO",
                         sizes=[(256, 256), (48, 48), (32, 32), (16, 16)])
                return
            except Exception:
                pass


def main():
    _ensure_icon()

    window = webview.create_window(
        title="摸鱼工具箱",
        url=INDEX,
        js_api=Api(),
        width=920,
        height=720,
        min_size=(760, 520),
        text_select=False,
    )

    webview.start(debug=False)


if __name__ == "__main__":
    main()
