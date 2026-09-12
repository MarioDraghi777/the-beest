# -*- coding: utf-8 -*-
"""Ispezione read-only del dataset exercises-dataset.
Uso:  python tools/inspect-dataset.py [percorso-dataset]
Default percorso: D:/exercises-dataset
Non scrive nulla: serve solo a verificare schema, qualita' dati IT, media e pesi.
"""
import json, os, re, sys, gzip, collections, struct, random, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = (sys.argv[1] if len(sys.argv) > 1 else "D:/exercises-dataset").rstrip("/\\")
LANGS = ["en", "es", "it", "tr", "ru", "zh", "hi", "pl", "ko", "fr"]

d = json.load(open(os.path.join(ROOT, "data", "exercises.json"), encoding="utf-8"))
h = lambda t: print("\n" + "=" * 4, t)

h("VOLUMI")
print("record:", len(d), "| id unici:", len(set(x["id"] for x in d)),
      "| media_id unici:", len(set(x["media_id"] for x in d)))
print("id: min", min(x["id"] for x in d), "max", max(x["id"] for x in d), "(numerazione sparsa)")

h("TASSONOMIE (valori distinti, tutti in inglese)")
for f in ("body_part", "equipment", "target", "muscle_group"):
    c = collections.Counter(x[f] for x in d)
    print(f"{f:14s} {len(c):3d} valori  ->", ", ".join(f"{k} ({v})" for k, v in c.most_common(6)), "...")
sec = collections.Counter(m for x in d for m in x["secondary_muscles"])
print(f"{'secondary':14s} {len(sec):3d} valori")
print("category identico a body_part in",
      sum(1 for x in d if x["category"] == x["body_part"]), "/", len(d), "record -> campo ridondante")

h("TRADUZIONI")
missing = collections.Counter(); empty = collections.Counter(); same_en = collections.Counter()
for x in d:
    for L in LANGS:
        t = x["instructions"].get(L)
        if t is None: missing[L] += 1; continue
        if not t.strip(): empty[L] += 1
        if L != "en" and t.strip() == x["instructions"]["en"].strip(): same_en[L] += 1
print("chiavi lingua mancanti:", dict(missing) or "nessuna")
print("stringhe vuote:", dict(empty) or "nessuna")
print("traduzioni identiche all'inglese:", dict(same_en) or "nessuna")
print("step IT/EN disallineati:",
      sum(1 for x in d if len(x["instruction_steps"]["it"]) != len(x["instruction_steps"]["en"])))
print("distribuzione n. step IT:",
      sorted(collections.Counter(len(x["instruction_steps"]["it"]) for x in d).items()))
eng = re.compile(r"\b(the|your|with|and|repeat|position|keep|shoulder-width)\b", re.I)
bad = [x["id"] for x in d if eng.search(x["instructions"]["it"])]
print("record IT con frasi rimaste in inglese:", len(bad), bad)

h("QUALITA' NOMI")
names = [x["name"] for x in d]
print("nomi distinti:", len(set(names)), "/", len(names))
for n, v in collections.Counter(names).items():
    if v > 1:
        print("  duplicato:", n, [y["id"] for y in d if y["name"] == n])
moji = [x["id"] + " " + x["name"] for x in d if re.search(r"(Ã.|Â.|â€.|[а-я]°)", x["name"])]
print("nomi con mojibake:", len(moji), moji)
print("nomi con parentesi:", sum(1 for n in names if "(" in n),
      "| con tag genere:", sum(1 for n in names if re.search(r"\((male|female)\)", n)))

h("MEDIA")
imgs = set(os.listdir(os.path.join(ROOT, "images")))
vids = set(os.listdir(os.path.join(ROOT, "videos")))
mi = [x["id"] for x in d if os.path.basename(x["image"]) not in imgs]
mv = [x["id"] for x in d if os.path.basename(x["gif_url"]) not in vids]
print("thumbnail mancanti:", len(mi), "| gif mancanti:", len(mv),
      "| file orfani:", len(imgs) - len(d) + len(mi), "/", len(vids) - len(d) + len(mv))
def stats(folder, fs):
    s = sorted(os.path.getsize(os.path.join(ROOT, folder, f)) for f in fs)
    print(f"{folder:7s} n={len(s):5d} tot={sum(s)/1e6:6.1f} MB  min={s[0]/1024:6.1f} KB"
          f"  p50={s[len(s)//2]/1024:6.1f} KB  p90={s[int(len(s)*.9)]/1024:6.1f} KB  max={s[-1]/1024:6.1f} KB")
stats("images", imgs); stats("videos", vids)

def gifinfo(p):
    b = open(p, "rb").read()
    w, hh = struct.unpack("<HH", b[6:10])
    i = b.find(b"\x21\xf9\x04")
    return w, hh, b.count(b"\x00\x21\xf9\x04"), (struct.unpack("<H", b[i+5:i+7])[0] if i > 0 else None)
random.seed(1)
samp = [gifinfo(os.path.join(ROOT, "videos", f)) for f in random.sample(sorted(vids), 40)]
print("campione 40 gif -> dimensioni:", collections.Counter((a, b) for a, b, _, _ in samp),
      "| frame:", collections.Counter(c for _, _, c, _ in samp),
      "| delay dichiarato:", collections.Counter(x[3] for x in samp))
print("attribution distinte:", set(x["attribution"] for x in d))

h("PESO PAYLOAD PER L'APP")
def gz(o):
    b = json.dumps(o, ensure_ascii=False).encode()
    return f"{len(b)/1024:8.1f} KB raw / {len(gzip.compress(b,9))/1024:7.1f} KB gzip"
idx = [{"id": x["id"], "n": x["name"], "bp": x["body_part"], "eq": x["equipment"],
        "tg": x["target"], "m": x["media_id"]} for x in d]
full = [dict(i, mg=x["muscle_group"], sm=x["secondary_muscles"], st=x["instruction_steps"]["it"])
        for i, x in zip(idx, d)]
print("indice ricerca (solo campi filtro):", gz(idx))
print("catalogo completo solo-IT        :", gz(full))
print("dataset originale 10 lingue      :", gz(d))
