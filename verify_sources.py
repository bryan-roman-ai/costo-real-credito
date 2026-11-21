#!/usr/bin/env python3
"""Compuerta anti-cifras inventadas para las tasas precargadas del simulador.

Lee cada preset(ea, fuente, url, [citas]) de app.js, descarga la URL y exige que
TODAS las citas aparezcan literalmente en la página (cifra + etiqueta + período), y
que cada cita con número contenga la tasa declarada. Buscar solo el número no basta:
en una serie histórica un valor viejo también aparece (falso positivo detectado el
21-nov-2026 con 83.40 en la serie del BCRP). Si algo falla, código 1: no publicar.

Uso:  python3 verify_sources.py     (correr antes de cada commit que toque tasas)
"""
import html
import re
import sys
import urllib.request
from pathlib import Path

APP = Path(__file__).with_name("app.js").read_text(encoding="utf-8")
CONSTS = dict(re.findall(r"const (\w+_URL) = '([^']+)'", APP))
PRESET = re.compile(r"(\w+): preset\(([\d.]+),\s*'[^']*',\s*(?:'([^']+)'|(\w+_URL)),\s*\[([^\]]*)\]\)", re.S)


def page_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (verificador de fuentes; costo-real-credito)"})
    with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310 (URLs fijas del propio repo)
        raw = r.read().decode(r.headers.get_content_charset() or "utf-8", "replace")
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", raw)))


def main():
    presets = PRESET.findall(APP)
    if not presets:
        sys.exit("No encontré presets en app.js (¿cambió el formato?)")
    cache, fails = {}, 0
    for key, ea, url, const, qraw in presets:
        url = url or CONSTS[const]
        quotes = re.findall(r"'([^']+)'", qraw)
        forms = {ea, ea.replace(".", ","), ea.rstrip("0").rstrip(".").replace(".", ",")}
        problems = []
        if not quotes:
            problems.append("sin citas de la fuente")
        if not any(any(f in q for f in forms) for q in quotes):
            problems.append(f"ninguna cita contiene la tasa {ea}")
        try:
            text = cache.setdefault(url, page_text(url))
            problems += [f"cita no encontrada: «{q}»" for q in quotes if q not in text]
        except Exception as e:  # noqa: BLE001
            problems.append(f"no pude leer la fuente ({e})")
        if problems:
            fails += 1
            print(f"✗ {key} ({ea}%): " + "; ".join(problems) + f" → {url}")
        else:
            print(f"✓ {key} ({ea}%): " + " + ".join(f"«{q}»" for q in quotes))
    print(f"\n{len(presets) - fails}/{len(presets)} tasas verificadas literalmente en su fuente.")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
