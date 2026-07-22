"""条码引擎单元测试（纯标准库，无需 pytest）。

运行：python tests/test_barcode_engine.py
锁定 fix/barcode-and-path-safety 的修复，防止回归。对应 scope/v1-done.md 的 A3。
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import barcode_engine as be
from api import _safe_filename


def ok(code, t):
    """能成功编码则返回 SVG 字符串。"""
    return be.generate_svg(code, t)


class TestEncodingSucceeds(unittest.TestCase):
    def test_upca(self):
        self.assertIn("<svg", ok("03600029145", "upca"))       # 11 位补校验位
        self.assertIn("<svg", ok("036000291458", "upca"))      # 12 位含正确校验位

    def test_ean13(self):
        self.assertIn("<svg", ok("690123456789", "ean13"))
        self.assertIn("<svg", ok("6901234567898", "ean13"))

    def test_ean8_no_longer_crashes(self):
        # 回归：曾因走 _upc_svg 的 12 位排版而 IndexError
        self.assertIn("<svg", ok("9638507", "ean8"))
        self.assertIn("<svg", ok("55123457", "ean8"))

    def test_code128_no_longer_crashes(self):
        # 回归：曾因缺停止符 _CODE128[106] 而 IndexError
        self.assertIn("<svg", ok("67893067", "code128"))       # 数字 → Set C
        self.assertIn("<svg", ok("369", "code128"))            # 奇数位 → Set B
        self.assertIn("<svg", ok("ABC-123", "code128"))

    def test_code39(self):
        self.assertIn("<svg", ok("6789-3067", "code39"))
        self.assertIn("<svg", ok("NNP", "code39"))

    def test_qrcode(self):
        self.assertIn("<svg", ok("https://example.com/product/123", "qrcode"))
        self.assertIn("<svg", ok("包装条码 QR 测试", "qrcode"))


class TestCode128TableCorrect(unittest.TestCase):
    def test_start_stop_symbols_match_standard(self):
        self.assertEqual(be._CODE128[103], "11010000100")      # Start A
        self.assertEqual(be._CODE128[104], "11010010000")      # Start B
        self.assertEqual(be._CODE128[105], "11010011100")      # Start C
        self.assertEqual(be._CODE128[106], "1100011101011")    # Stop（含终止条）
        self.assertEqual(len(be._CODE128), 107)


class TestChecksumValidation(unittest.TestCase):
    def test_wrong_checksum_rejected(self):
        for code, t in [("036000291450", "upca"),
                        ("6901234567890", "ean13"),
                        ("96385070", "ean8")]:
            with self.assertRaises(ValueError):
                ok(code, t)

    def test_correct_checksum_accepted(self):
        self.assertIn("<svg", ok("036000291458", "upca"))
        self.assertIn("<svg", ok("6901234567898", "ean13"))


class TestInputValidation(unittest.TestCase):
    def test_code128_rejects_non_ascii(self):
        with self.assertRaises(ValueError):
            ok("你好", "code128")

    def test_empty_input_rejected(self):
        for t in ("code128", "code39"):
            with self.assertRaises(ValueError):
                ok("", t)

    def test_wrong_length_rejected(self):
        for code, t in [("123", "upca"), ("123", "ean13"), ("123", "ean8")]:
            with self.assertRaises(ValueError):
                ok(code, t)

    def test_qrcode_rejects_empty_input(self):
        with self.assertRaises(ValueError):
            ok("", "qrcode")


class TestSafeFilename(unittest.TestCase):
    def test_path_traversal_stripped(self):
        self.assertNotIn("/", _safe_filename("../../etc/passwd"))
        self.assertNotIn("\\", _safe_filename("a\\b"))
        self.assertNotIn("..", _safe_filename("a..b"))

    def test_valid_chars_kept(self):
        self.assertEqual(_safe_filename("6789-3067"), "6789-3067")

    def test_empty_falls_back(self):
        self.assertEqual(_safe_filename(""), "barcode")
        self.assertEqual(_safe_filename("你好"), "barcode")


if __name__ == "__main__":
    unittest.main(verbosity=2)
