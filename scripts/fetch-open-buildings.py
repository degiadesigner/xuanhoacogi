"""
Tải đường viền nhà Open Buildings (Google + Microsoft, bản gộp của VIDA) cho Phường Xuân Hòa.

- Nguồn: https://source.coop/vida/google-microsoft-open-buildings (CC BY 4.0 / ODbL)
- DuckDB chỉ đọc đúng các row-group có bbox giao với khung Phường Xuân Hòa
  (file VNM.parquet ~8 GB nhưng chỉ tải vài chục MB).

Cách chạy:
    python -m pip install duckdb
    python scripts/fetch-open-buildings.py
Kết quả: scripts/.cache/openbuildings_raw.json (đầu vào của scripts/build-3d-city.mjs)
"""
import json
import os
import time

import duckdb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = (
    "https://data.source.coop/vida/google-microsoft-open-buildings/"
    "geoparquet/by_country/country_iso=VNM/VNM.parquet"
)

boundary = json.load(
    open(os.path.join(ROOT, "public", "geo", "xuanhoa-boundary.geojson"), encoding="utf8")
)
ring = boundary["features"][0]["geometry"]["coordinates"][0]
xs = [p[0] for p in ring]
ys = [p[1] for p in ring]
x0, x1 = min(xs) - 0.003, max(xs) + 0.003
y0, y1 = min(ys) - 0.003, max(ys) + 0.003

con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;")

t = time.time()
rows = con.execute(
    f"""
    SELECT bf_source, confidence, area_in_meters, ST_AsGeoJSON(geometry) AS g
    FROM read_parquet('{URL}')
    WHERE bbox.xmin >= {x0} AND bbox.xmax <= {x1}
      AND bbox.ymin >= {y0} AND bbox.ymax <= {y1}
    """
).fetchall()
print(f"Đã tải {len(rows)} đường viền nhà trong {time.time() - t:.1f}s")

out = [
    {"s": src, "c": round(conf or 0, 3), "a": round(area or 0, 1), "g": json.loads(g)}
    for src, conf, area, g in rows
]
os.makedirs(os.path.join(ROOT, "scripts", ".cache"), exist_ok=True)
with open(os.path.join(ROOT, "scripts", ".cache", "openbuildings_raw.json"), "w") as f:
    json.dump(out, f)
print("Đã lưu scripts/.cache/openbuildings_raw.json")
