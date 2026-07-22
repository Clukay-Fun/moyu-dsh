"""
Precision 1D barcode engine — corrected SVG Y-axis layout.
A4 297×210 mm canvas, barcode centred.
Text BELOW bars (not above). Clean guard-bar hierarchy.
"""

import io
import re, os as _os

# =========================================================================
# Canvas
# =========================================================================
A4_W  = 297.0
A4_H  = 210.0

# =========================================================================
# Barcode dimensions (mm)
# =========================================================================
MODULE_MM   = 0.33
QUIET_MM    = 2.97
BC_BAR_W    = 95 * MODULE_MM            # 31.35 mm
BC_TOTAL_W  = BC_BAR_W + 2 * QUIET_MM   # 37.29 mm

# ==== bar geometry (SVG Y-down, all bars TOP-aligned) ==================
BAR_TOP       = 0.0
DATA_BOT      = 15.0                    # short bars — leave room for text
GUARD_BOT     = 28.0                    # long bars — frame down to baseline
GUARD_H       = GUARD_BOT - BAR_TOP     # 28.0 mm
DATA_H        = DATA_BOT  - BAR_TOP     # 15.0 mm (13 mm shorter than guards)

# ==== text — small, nested below short bars =============================
MID_FS_PT     = 8                       # ~40% smaller than 13pt
EDGE_FS_PT    = 6
MID_FS_MM     = MID_FS_PT  * 0.3528    # ~2.82 mm
EDGE_FS_MM    = EDGE_FS_PT * 0.3528    # ~2.12 mm
TEXT_BASE     = GUARD_BOT - 2.5        # baseline near guard bottom
# total barcode height
BC_TOTAL_H    = GUARD_BOT + 2.0        # 30 mm

# Centring offsets in A4
BC_X0 = (A4_W - BC_TOTAL_W) / 2
BC_Y0 = (A4_H - BC_TOTAL_H) / 2

# =========================================================================
# Digit patterns
# =========================================================================
_LEFT  = {'0':'0001101','1':'0011001','2':'0010011','3':'0111101',
          '4':'0100011','5':'0110001','6':'0101111','7':'0111011',
          '8':'0110111','9':'0001011'}
_RIGHT = {k:''.join('1' if c=='0' else '0' for c in v) for k,v in _LEFT.items()}
_EAN_EV = {'0':'0100111','1':'0110011','2':'0011011','3':'0100001',
           '4':'0011101','5':'0111001','6':'0000101','7':'0010001',
           '8':'0001001','9':'0010111'}
_EAN_1ST = {'0':'LLLLLL','1':'LLGLGG','2':'LLGGLG','3':'LLGGGL',
            '4':'LGLLGG','5':'LGGLLG','6':'LGGGLL','7':'LGLGLG',
            '8':'LGLGGL','9':'LGGLGL'}
_CODE128 = [
    '11011001100','11001101100','11001100110','10010011000','10010001100',
    '10001001100','10011001000','10011000100','10001100100','11001001000',
    '11001000100','11000100100','10110011100','10011011100','10011001110',
    '10111001100','10011101100','10011100110','11001110010','11001011100',
    '11001001110','11011100100','11001110100','11101101110','11101001100',
    '11100101100','11100100110','11101100100','11100110100','11100110010',
    '11011011000','11011000110','11000110110','10100011000','10001011000',
    '10001000110','10110001000','10001101000','10001100010','11010001000',
    '11000101000','11000100010','10110111000','10110001110','10001101110',
    '10111011000','10111000110','10001110110','11101110110','11010001110',
    '11000101110','11011101000','11011100010','11011101110','11101011000',
    '11101000110','11100010110','11101101000','11101100010','11100011010',
    '11101111010','11001000010','11110001010','10100110000','10100001100',
    '10010110000','10010000110','10000101100','10000100110','10110010000',
    '10110000100','10011010000','10011000010','10000110100','10000110010',
    '11000010010','11001010000','11110111010','11000010100','10001111010',
    '10100111100','10010111100','10010011110','10111100100','10011110100',
    '10011110010','11110100100','11110010100','11110010010','11011011110',
    '11011110110','11110110110','10101111000','10100011110','10001011110',
    '10111101000','10111100010','11110101000','11110100010','10111011110',
    '10111101110','11101011110','11110101110','11010000100','11010010000',
    '11010011100','1100011101011',
]
_C128_SA=103; _C128_SB=104; _C128_SC=105; _C128_SP=106
_CODE39 = {
    '0':'101001101101','1':'110100101011','2':'101100101011','3':'110110010101',
    '4':'101001101011','5':'110100110101','6':'101100110101','7':'101001011011',
    '8':'110100101101','9':'101100101101','A':'110101001011','B':'101101001011',
    'C':'110110100101','D':'101011001011','E':'110101100101','F':'101101100101',
    'G':'101010011011','H':'110101001101','I':'101101001101','J':'101011001101',
    'K':'110101010011','L':'101101010011','M':'110110101001','N':'101011010011',
    'O':'110101101001','P':'101101101001','Q':'101010110011','R':'110101011001',
    'S':'101101011001','T':'101011011001','U':'110010101011','V':'100110101011',
    'W':'110011010101','X':'100101101011','Y':'110010110101','Z':'100110110101',
    '-':'100101011011','.':'110010101101',' ':'100110101101','*':'100101101101',
    '$':'100100100101','/':'100100101001','+':'100101001001','%':'101001001001',
}
_ITF = {'0':'00110','1':'10001','2':'01001','3':'11000','4':'00101',
        '5':'10100','6':'01100','7':'00011','8':'10010','9':'01010'}

def _csum_u(s):
    t=sum(int(d)*(3 if i%2 else 1) for i,d in enumerate(s)); return(10-t%10)%10
def _csum_e(s): return _csum_u(s[::-1])
def _csum_c(v):
    t=v[0];
    for i,vv in enumerate(v[1:],1): t+=vv*i
    return t%103

# =========================================================================
# Font — OCR-B embedded as Base64 (no system font dependency)
# =========================================================================
_FONT_B64 = ""
_FONT_PATH = None
for _c in [_os.path.expandvars(r"%SystemRoot%\Fonts\ocraext.ttf"),
           _os.path.expandvars(r"%SystemRoot%\Fonts\OCRB.ttf"),
           _os.path.expandvars(r"%SystemRoot%\Fonts\OCRB-Regular.ttf")]:
    if _os.path.isfile(_c): _FONT_PATH = _c; break

if _FONT_PATH:
    import base64
    with open(_FONT_PATH, "rb") as _ff:
        _FONT_B64 = base64.b64encode(_ff.read()).decode("ascii")

_FONT_FACE = ""
if _FONT_B64:
    _FONT_FACE = (
        "<defs><style>"
        "@font-face{font-family:'OCRB-Embedded';"
        "src:url(data:font/ttf;charset=utf-8;base64," + _FONT_B64 + ") format('truetype');}"
        ".bc-text{font-family:'OCRB-Embedded','OCRB','Courier New',monospace;"
        "fill:#000;stroke:none!important;stroke-width:0!important}"
        "</style></defs>"
    )
if not _FONT_FACE:
    _FONT_FACE = "<defs/>"

# =========================================================================
# SVG builder
# =========================================================================

def _upc_svg(modules, chars12):
    x0 = BC_X0 + QUIET_MM
    y0 = BC_Y0
    total = len(modules)
    g_s=(0,3); g_m=(45,50); g_e=(total-3,total)

    # ---- bars (all TOP-aligned) ----------------------------------------
    bar_rects = []
    x = 0.0; i = 0
    while i < total:
        bit=modules[i]; run=1
        while i+run<total and modules[i+run]==bit: run+=1
        w=run*MODULE_MM
        if bit=='1':
            ing=((i>=g_s[0] and i<g_s[1]) or
                 (i>=g_m[0] and i<g_m[1]) or
                 (i>=g_e[0] and i<g_e[1]))
            h = GUARD_H if ing else DATA_H
            bar_rects.append((x0+x, y0+BAR_TOP, w, h))
        x+=w; i+=run

    # ---- text (all BASELINE-aligned) -----------------------------------
    gs_e  = x0 + 3  * MODULE_MM
    gm_s  = x0 + 45 * MODULE_MM
    gm_e  = x0 + 50 * MODULE_MM
    ge_s  = x0 + 92 * MODULE_MM
    baseline = y0 + TEXT_BASE

    texts = []
    # Digit 0 — left of start guard (10pt)
    texts.append((x0 - QUIET_MM/2, chars12[0], EDGE_FS_PT))
    # Digits 1-5 — between guards (13pt each, even spacing)
    w2 = gm_s - gs_e
    for k in range(5):
        texts.append((gs_e + w2*(k+0.5)/5, chars12[1+k], MID_FS_PT))
    # Digits 6-10 — between guards (13pt each, even spacing)
    w3 = ge_s - gm_e
    for k in range(5):
        texts.append((gm_e + w3*(k+0.5)/5, chars12[6+k], MID_FS_PT))
    # Digit 11 — right of end guard (10pt)
    texts.append((x0 + BC_BAR_W + QUIET_MM/2, chars12[11], EDGE_FS_PT))

    # ---- SVG ------------------------------------------------------------
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg"'
        f' width="{A4_W}mm" height="{A4_H}mm"'
        f' viewBox="0 0 {A4_W} {A4_H}">',
        _FONT_FACE,
        '<g id="Barcode_Group">',
    ]
    for rx, ry, rw, rh in bar_rects:
        lines.append(
            f'<rect x="{rx:.4f}" y="{ry:.4f}" width="{rw:.4f}" height="{rh:.4f}" fill="#000000"/>')
    for cx, ch, fs_pt in texts:
        lines.append(
            f'<text class="bc-text" x="{cx:.3f}" y="{baseline:.3f}"'
            f' text-anchor="middle" font-size="{fs_pt}pt">{ch}</text>')
    lines.append('</g>')
    lines.append('</svg>')
    return '\n'.join(lines)


def _ean8_svg(modules, code8):
    """EAN-8 版式：67 模块，护线 3+5+3，数字 4+4 分居左右数据区下方。"""
    total = len(modules)                      # 67
    bar_w = total * MODULE_MM
    x0 = (A4_W - bar_w) / 2                    # EAN-8 单独居中（比 EAN-13 窄）
    y0 = BC_Y0
    g_s = (0, 3); g_m = (31, 36); g_e = (total - 3, total)

    # ---- bars ----------------------------------------------------------
    bar_rects = []
    x = 0.0; i = 0
    while i < total:
        bit = modules[i]; run = 1
        while i + run < total and modules[i + run] == bit: run += 1
        w = run * MODULE_MM
        if bit == '1':
            ing = ((g_s[0] <= i < g_s[1]) or
                   (g_m[0] <= i < g_m[1]) or
                   (g_e[0] <= i < g_e[1]))
            h = GUARD_H if ing else DATA_H
            bar_rects.append((x0 + x, y0 + BAR_TOP, w, h))
        x += w; i += run

    # ---- text: 左 4 位 (模块 3..31)，右 4 位 (模块 36..64) --------------
    baseline = y0 + TEXT_BASE
    left_s = x0 + 3 * MODULE_MM;  left_e = x0 + 31 * MODULE_MM
    right_s = x0 + 36 * MODULE_MM; right_e = x0 + 64 * MODULE_MM
    texts = []
    wl = left_e - left_s
    for k in range(4):
        texts.append((left_s + wl * (k + 0.5) / 4, code8[k], MID_FS_PT))
    wr = right_e - right_s
    for k in range(4):
        texts.append((right_s + wr * (k + 0.5) / 4, code8[4 + k], MID_FS_PT))

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg"'
        f' width="{A4_W}mm" height="{A4_H}mm"'
        f' viewBox="0 0 {A4_W} {A4_H}">',
        _FONT_FACE,
        '<g id="Barcode_Group">',
    ]
    for rx, ry, rw, rh in bar_rects:
        lines.append(
            f'<rect x="{rx:.4f}" y="{ry:.4f}" width="{rw:.4f}" height="{rh:.4f}" fill="#000000"/>')
    for cx, ch, fs_pt in texts:
        lines.append(
            f'<text class="bc-text" x="{cx:.3f}" y="{baseline:.3f}"'
            f' text-anchor="middle" font-size="{fs_pt}pt">{ch}</text>')
    lines.append('</g>')
    lines.append('</svg>')
    return '\n'.join(lines)


def _simple_svg(modules, text):
    x0 = BC_X0 + QUIET_MM; y0 = BC_Y0
    rects = []; x=0.0; i=0
    while i<len(modules):
        bit=modules[i]; run=1
        while i+run<len(modules) and modules[i+run]==bit: run+=1
        w=run*MODULE_MM
        if bit=='1': rects.append((x0+x, y0+BAR_TOP, w, DATA_H))
        x+=w; i+=run
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg"'
        f' width="{A4_W}mm" height="{A4_H}mm"'
        f' viewBox="0 0 {A4_W} {A4_H}">',
        _FONT_FACE,
        '<g id="Barcode_Group">',
    ]
    for rx,ry,rw,rh in rects:
        lines.append(f'<rect x="{rx:.4f}" y="{ry:.4f}" width="{rw:.4f}" height="{rh:.4f}" fill="#000000"/>')
    lines.append('</g>')
    lines.append('</svg>')
    return '\n'.join(lines)

# =========================================================================
# Public API
# =========================================================================

def encode_upca(code):
    code=re.sub(r'\D','',code)
    if len(code)==11:
        code+=str(_csum_u(code))
    elif len(code)==12:
        exp=_csum_u(code[:11])
        if int(code[11])!=exp:
            raise ValueError(f"UPC-A 校验位错误：末位应为 {exp}")
    else:
        raise ValueError(f"UPC-A 需要 11-12 位数字，收到 {len(code)}")
    mods=('101'+''.join(_LEFT[d] for d in code[:6])+
          '01010'+''.join(_RIGHT[d] for d in code[6:])+'101')
    return _upc_svg(mods, code)

def encode_ean13(code):
    code=re.sub(r'\D','',code)
    if len(code)==12:
        code+=str(_csum_e(code))
    elif len(code)==13:
        exp=_csum_e(code[:12])
        if int(code[12])!=exp:
            raise ValueError(f"EAN-13 校验位错误：末位应为 {exp}")
    else:
        raise ValueError(f"EAN-13 需要 12-13 位数字，收到 {len(code)}")
    first=code[0]; left=code[1:7]; right=code[7:]; parity=_EAN_1ST[first]
    mods='101'
    for i,d in enumerate(left): mods+=_LEFT[d] if parity[i]=='L' else _EAN_EV[d]
    mods+='01010'
    for d in right: mods+=_RIGHT[d]
    mods+='101'
    return _upc_svg(mods, code)

def encode_ean8(code):
    code=re.sub(r'\D','',code)
    if len(code)==7:
        code+=str(_csum_e(code+'00000'))
    elif len(code)==8:
        exp=_csum_e(code[:7]+'00000')
        if int(code[7])!=exp:
            raise ValueError(f"EAN-8 校验位错误：末位应为 {exp}")
    else:
        raise ValueError(f"EAN-8 需要 7-8 位数字，收到 {len(code)}")
    mods=('101'+''.join(_LEFT[d] for d in code[:4])+
          '01010'+''.join(_RIGHT[d] for d in code[4:])+'101')
    return _ean8_svg(mods, code)

def encode_code128(text):
    if not text:
        raise ValueError("Code128 输入不能为空")
    for c in text:
        if not (32 <= ord(c) <= 126):
            raise ValueError(f"Code128 仅支持可打印 ASCII 字符，非法字符：{c!r}")
    hl=any(c.islower() for c in text)
    ad=all(c.isdigit() for c in text) and len(text)>=2
    if ad and len(text)%2==0:
        s=_C128_SC; vals=[s]
        for i in range(0,len(text),2): vals.append(int(text[i:i+2]))
    else:
        s=_C128_SB; vals=[s]
        for c in text: vals.append(max(0,ord(c)-32))
    vals.append(_csum_c(vals)); vals.append(_C128_SP)
    return _simple_svg(''.join(_CODE128[v] for v in vals), text)

def encode_code39(text):
    text=text.upper().strip()
    if not text:
        raise ValueError("Code39 输入不能为空")
    for c in text:
        if c not in _CODE39: raise ValueError(f"Code39 invalid: {c}")
    mods=_CODE39['*']
    for c in text: mods+='0'+_CODE39[c]
    mods+='0'+_CODE39['*']
    return _simple_svg(mods, text)

def encode_itf(code):
    code=re.sub(r'\D','',code)
    if len(code)%2: code='0'+code
    mods='1010'
    for i in range(0,len(code),2):
        for b,s in zip(_ITF[code[i]],_ITF[code[i+1]]): mods+=b+s
    mods+='1101'
    return _simple_svg(mods, code)

def encode_auto(code):
    code=re.sub(r'\D','',code)
    if len(code) in (11,12): return encode_upca(code)
    elif len(code) in (12,13): return encode_ean13(code)
    elif len(code) in (7,8): return encode_ean8(code)
    raise ValueError(f"Cannot auto-detect type for {len(code)} digits")

def encode_qrcode(text):
    if not text:
        raise ValueError("二维码输入不能为空")
    try:
        import segno
    except ImportError as exc:
        raise RuntimeError("缺少 segno 依赖，请运行 pip install -r requirements.txt") from exc
    output = io.BytesIO()
    segno.make(text).save(output, kind="svg", scale=5, border=4, xmldecl=True)
    return output.getvalue().decode("utf-8")

SUPPORTED_TYPES = {
    "upca":("UPCA",encode_upca),"ean13":("EAN-13",encode_ean13),
    "ean8":("EAN-8",encode_ean8),"code128":("Code128",encode_code128),
    "code39":("Code39",encode_code39),"itf":("ITF",encode_itf),
    "auto":("Auto",encode_auto),"qrcode":("QR",encode_qrcode),
}

def generate_svg(code, bc_type):
    if bc_type not in SUPPORTED_TYPES: raise ValueError(f"Unsupported: {bc_type}")
    return SUPPORTED_TYPES[bc_type][1](code)

def get_type_label(bc_type):
    return SUPPORTED_TYPES.get(bc_type,(bc_type,))[0]
