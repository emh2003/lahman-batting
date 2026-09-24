"""
Check data/batting.csv against the project's data requirements and against
a few well-known numbers, so anyone can confirm the file is right.

    uv run scripts/check_data.py
"""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
df = pd.read_csv(ROOT / "data" / "batting.csv", keep_default_na=False, na_values=[""])
raw = pd.read_csv(ROOT / "data" / "raw" / "Batting.csv", keep_default_na=False, na_values=[""])


def check(label, ok, detail=""):
    print(f"[{'PASS' if ok else 'FAIL'}] {label} {detail}")
    return ok


results = [
    check("At least 50,000 rows", len(df) >= 50_000, f"({len(df):,})"),
    check("At least 8 columns", df.shape[1] >= 8, f"({df.shape[1]})"),
    check("At least 5 periods (seasons)", df["year"].nunique() >= 5,
          f"({df['year'].nunique()} seasons, {df['year'].min()}-{df['year'].max()})"),
    check("At least 10 groups (players)", df["player_id"].nunique() >= 10,
          f"({df['player_id'].nunique():,} players, {df['team_id'].nunique()} team codes)"),
    check("No duplicate player-season-stint rows",
          not df.duplicated(["player_id", "year", "stint"]).any()),
]

# Totals should match the raw file (minus the one dropped row).
for col in ["G", "AB", "H", "HR", "RBI", "BB", "SO"]:
    dropped = raw.loc[(raw["2B"] + raw["3B"] + raw["HR"]) > raw["H"], col].sum()
    results.append(check(f"Total {col} matches raw file", df[col].sum() == raw[col].sum() - dropped))

# Well-known single-season and career numbers.
def season(pid, yr, col):
    return df.loc[(df.player_id == pid) & (df.year == yr), col].sum()

results += [
    check("Barry Bonds, 2001: 73 HR", season("bondsba01", 2001, "HR") == 73),
    check("Ichiro Suzuki, 2004: 262 H", season("suzukic01", 2004, "H") == 262),
    check("Hank Aaron career: 755 HR (MLB)",
          df.loc[(df.player_id == "aaronha01") & (df.league_group != "Negro Leagues"), "HR"].sum() == 755),
]
tw = df[(df.player_id == "willite01") & (df.year == 1941)]
results.append(check("Ted Williams, 1941: .406 AVG", round(tw.H.sum() / tw.AB.sum(), 3) == 0.406))

print(f"\n{sum(results)} of {len(results)} checks passed")
