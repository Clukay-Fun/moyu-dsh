import json
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image


SESSIONS = {}


def load_session(model_path):
    key = str(Path(model_path).resolve())
    if key in SESSIONS:
        return SESSIONS[key]

    available = ort.get_available_providers()
    providers = ["CPUExecutionProvider"]
    options = ort.SessionOptions()
    if "DmlExecutionProvider" in available:
        providers = ["DmlExecutionProvider", "CPUExecutionProvider"]
        options.enable_mem_pattern = False
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

    try:
        session = ort.InferenceSession(
            key,
            providers=providers,
            sess_options=options,
        )
    except Exception:
        session = ort.InferenceSession(
            key,
            providers=["CPUExecutionProvider"],
        )

    SESSIONS[key] = session
    return session


def alpha_mask(session, image):
    resized = image.convert("RGB").resize((1024, 1024), Image.Resampling.BILINEAR)
    tensor = np.asarray(resized, dtype=np.float32) / 255.0
    tensor = (tensor - 0.5).transpose(2, 0, 1)[np.newaxis, ...]
    output = session.run(
        None,
        {session.get_inputs()[0].name: tensor.astype(np.float32)},
    )[0]
    mask = np.squeeze(output).astype(np.float32)
    minimum = float(mask.min())
    maximum = float(mask.max())
    if maximum <= minimum:
        raise RuntimeError("model returned a constant alpha mask")
    mask = ((mask - minimum) / (maximum - minimum) * 255).astype(np.uint8)
    return Image.fromarray(mask, mode="L").resize(
        image.size,
        Image.Resampling.BILINEAR,
    )


def remove_background(command):
    started_at = time.perf_counter()
    image = Image.open(command["input"]).convert("RGB")
    session = load_session(command["model"])
    alpha = alpha_mask(session, image)
    result = image.convert("RGBA")
    result.putalpha(alpha)
    output_path = Path(command["output"])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, "PNG")
    alpha_array = np.asarray(alpha)
    return {
        "output": str(output_path),
        "width": image.width,
        "height": image.height,
        "alpha_min": int(alpha_array.min()),
        "alpha_max": int(alpha_array.max()),
        "providers": session.get_providers(),
        "duration_ms": round((time.perf_counter() - started_at) * 1000),
    }


def parse_color(value):
    normalized = str(value or "").lstrip("#")
    if len(normalized) != 6:
        raise ValueError("background must be a six-digit hex color")
    return tuple(int(normalized[index:index + 2], 16) for index in (0, 2, 4))


def create_id_photo(command):
    started_at = time.perf_counter()
    width = min(4000, max(64, int(command["width"])))
    height = min(4000, max(64, int(command["height"])))
    image = Image.open(command["input"]).convert("RGB")
    session = load_session(command["model"])
    alpha = alpha_mask(session, image)
    subject = image.convert("RGBA")
    subject.putalpha(alpha)
    scale = min(width * 0.92 / subject.width, height * 0.94 / subject.height)
    size = (
        max(1, round(subject.width * scale)),
        max(1, round(subject.height * scale)),
    )
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), parse_color(command["background"]))
    position = ((width - size[0]) // 2, height - size[1])
    canvas.paste(subject, position, subject)
    output_path = Path(command["output"])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, "PNG")
    return {
        "output": str(output_path),
        "width": width,
        "height": height,
        "providers": session.get_providers(),
        "duration_ms": round((time.perf_counter() - started_at) * 1000),
    }


def inpaint(command):
    started_at = time.perf_counter()
    image = Image.open(command["input"]).convert("RGB")
    paint_mask = Image.open(command["mask"]).convert("L")
    session = load_session(command["model"])
    resized_image = image.resize((512, 512), Image.Resampling.BICUBIC)
    resized_mask = paint_mask.resize((512, 512), Image.Resampling.NEAREST)
    image_tensor = np.asarray(resized_image, dtype=np.uint8)
    image_tensor = image_tensor.transpose(2, 0, 1)[np.newaxis, ...]
    known_mask = 255 - np.asarray(resized_mask, dtype=np.uint8)
    mask_tensor = known_mask[np.newaxis, np.newaxis, ...]
    inputs = session.get_inputs()
    output = session.run(
        None,
        {
            inputs[0].name: image_tensor,
            inputs[1].name: mask_tensor,
        },
    )[0]
    output = np.clip(output, 0, 255).astype(np.uint8)
    output = output.transpose(0, 2, 3, 1)[0]
    result = Image.fromarray(output, mode="RGB").resize(
        image.size,
        Image.Resampling.BICUBIC,
    )
    output_path = Path(command["output"])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, "PNG")
    source_array = np.asarray(image, dtype=np.int16)
    result_array = np.asarray(result, dtype=np.int16)
    changed_pixels = int(
        np.count_nonzero(np.max(np.abs(source_array - result_array), axis=2) > 8)
    )
    return {
        "output": str(output_path),
        "width": image.width,
        "height": image.height,
        "changed_pixels": changed_pixels,
        "providers": session.get_providers(),
        "duration_ms": round((time.perf_counter() - started_at) * 1000),
    }


def handle(command):
    action = command.get("action")
    if action == "probe":
        return {
            "python": sys.version,
            "platform": sys.platform,
            "providers": ort.get_available_providers(),
        }
    if action == "remove_bg":
        return remove_background(command)
    if action == "id_photo":
        return create_id_photo(command)
    if action == "inpaint":
        return inpaint(command)
    if action == "shutdown":
        return {"shutdown": True}
    raise ValueError(f"unsupported action: {action}")


def main():
    for line in sys.stdin:
        command = None
        try:
            command = json.loads(line)
            result = handle(command)
            print(
                json.dumps(
                    {"id": command.get("id"), "ok": True, "result": result},
                    ensure_ascii=False,
                ),
                flush=True,
            )
            if result.get("shutdown"):
                return
        except Exception as error:
            print(
                json.dumps(
                    {
                        "id": command.get("id") if isinstance(command, dict) else None,
                        "ok": False,
                        "error": str(error),
                        "type": type(error).__name__,
                    },
                    ensure_ascii=False,
                ),
                flush=True,
            )


if __name__ == "__main__":
    main()
