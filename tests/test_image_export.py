import base64
import io
import json
import os
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from api import Api


class ImageExportTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.previous_home = os.environ.get("HOME")
        os.environ["HOME"] = self.temp_dir.name
        source = Image.new("RGBA", (64, 48), (0, 0, 0, 0))
        for x in range(20, 44):
            for y in range(12, 36):
                source.putpixel((x, y), (30, 100, 220, 255))
        stream = io.BytesIO()
        source.save(stream, "PNG")
        self.data_url = "data:image/png;base64," + base64.b64encode(stream.getvalue()).decode("ascii")

    def tearDown(self):
        if self.previous_home is None:
            os.environ.pop("HOME", None)
        else:
            os.environ["HOME"] = self.previous_home
        self.temp_dir.cleanup()

    def export(self, fmt):
        response = Api().export_image(json.dumps({
            "dataUrl": self.data_url,
            "format": fmt,
            "width": 32,
            "height": 24,
            "quality": 75,
            "sourceName": "transparent-sample.png",
        }))
        result = json.loads(response)
        self.assertTrue(result.get("ok"), result)
        return Path(result["filepath"])

    def test_all_supported_formats_open(self):
        for fmt in ("PNG", "JPG", "WEBP", "BMP", "TIFF", "ICO", "TGA"):
            with self.subTest(fmt=fmt):
                filepath = self.export(fmt)
                self.assertTrue(filepath.is_file())
                with Image.open(filepath) as exported:
                    exported.load()
                    self.assertGreater(exported.width, 0)
                    self.assertGreater(exported.height, 0)

    def test_transparent_png_to_jpg_uses_white_background(self):
        filepath = self.export("JPG")
        with Image.open(filepath).convert("RGB") as exported:
            self.assertEqual(exported.size, (32, 24))
            red, green, blue = exported.getpixel((0, 0))
            self.assertGreater(red, 235)
            self.assertGreater(green, 235)
            self.assertGreater(blue, 235)


if __name__ == "__main__":
    unittest.main()
