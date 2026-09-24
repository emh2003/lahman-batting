"""
Download the three raw Lahman tables into data/raw/.

The tables come from the pylahman package (version 0.7.0), which bundles
the Lahman Baseball Database as downloaded from https://sabr.org/lahman-database/
on 2026-01-08 (seasons 1871-2025). You only need to run this if you want to
re-create data/raw/ from scratch; the CSVs are already in the repository.
(pylahman leaves the league code blank for the 1871-1875 National
Association; build_data.py fills those in as "NA".)

    uv add pylahman==0.7.0
    uv run scripts/get_raw_data.py
"""

from pathlib import Path

import pylahman

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)

for name in ["Batting", "People", "Teams"]:
    table = getattr(pylahman, name)()
    table.to_csv(RAW / f"{name}.csv", index=False)
    print(f"{name}.csv: {len(table):,} rows x {table.shape[1]} columns")
