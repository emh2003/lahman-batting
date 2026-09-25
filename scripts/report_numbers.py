"""
Compute every number and chart series used on the report page (index.html).

Reads  data/batting.csv
Writes data/report.json  - the chart data the report page loads
Prints every number quoted in the report text, so each one can be checked.

    uv run scripts/report_numbers.py

Scope: unless a section says otherwise, the report covers the league group
"AL/NL and 19th-century majors" (the AL, NL, and the 19th-century major
leagues). All rates are computed from summed totals, exactly as on the
dashboard:
    AVG    = H / AB
    OBP    = (H + BB + HBP) / (AB + BB + HBP + SF)   (blank HBP/SF count as 0)
    SLG    = TB / AB
    OPS    = OBP + SLG
    HR/600 = HR / PA * 600
    K%     = SO / PA, using only rows where SO was recorded
    BB%    = BB / PA
    Three true outcomes % = (HR + BB + SO) / PA, using only rows where SO was recorded
    Singles share = 1B / H
"""

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
df = pd.read_csv(ROOT / "data" / "batting.csv", keep_default_na=False, na_values=[""])

MLB = "AL/NL and 19th-century majors"
mlb = df[df["league_group"] == MLB].copy()


def rates(g):
    """Summed-total rates for a group of rows."""
    s = lambda c: g[c].fillna(0).sum()
    H, AB, BB, HBP, SF, TB, PA, HR, B1 = (s(c) for c in ["H", "AB", "BB", "HBP", "SF", "TB", "PA", "HR", "1B"])
    so_rows = g[g["SO"].notna()]
    pa_so = so_rows["PA"].sum()
    obp = (H + BB + HBP) / (AB + BB + HBP + SF)
    return pd.Series({
        "PA": PA,
        "players": g["player_id"].nunique(),
        "teams": g["team_id"].nunique(),
        "AVG": H / AB,
        "OBP": obp,
        "SLG": TB / AB,
        "OPS": obp + TB / AB,
        "HR600": HR / PA * 600,
        "K": so_rows["SO"].sum() / pa_so if pa_so else None,
        "BB": BB / PA,
        "TTO": (so_rows["HR"].sum() + so_rows["BB"].sum() + so_rows["SO"].sum()) / pa_so if pa_so else None,
        "singles_share": B1 / H,
        "SB": s("SB"),
    })


by_year = mlb.groupby("year").apply(rates, include_groups=False)
by_decade = mlb.groupby("decade").apply(rates, include_groups=False)

# Share of plate appearances by players born outside the USA (Unknown counts as not foreign).
mlb["foreign"] = ~mlb["birth_country"].isin(["USA", "Unknown"])
foreign_by_decade = mlb.groupby("decade").apply(
    lambda g: g.loc[g["foreign"], "PA"].sum() / g["PA"].sum(), include_groups=False)
recent = mlb[mlb["year"] >= 2020]
top_countries = (recent.groupby("birth_country")["PA"].sum() / recent["PA"].sum()).sort_values(ascending=False)

# Negro Leagues vs AL/NL, 1920-1948 (the seasons MLB recognizes as major-league).
era = df[df["year"].between(1920, 1948)]
nl_vs = era[era["league_group"].isin([MLB, "Negro Leagues"])].groupby("league_group").apply(rates, include_groups=False)
nl_by_year = (era[era["league_group"].isin([MLB, "Negro Leagues"])]
              .groupby(["league_group", "year"]).apply(rates, include_groups=False)["AVG"].unstack(0))

r = lambda x, n=3: None if pd.isna(x) else round(float(x), n)

# ------------------------------------------------------------------ numbers in the text
yrs = by_year
low_since = yrs.loc[1969:2025, "AVG"]
numbers = {
    "rows": len(df),
    "players": int(df["player_id"].nunique()),
    "seasons": int(df["year"].nunique()),
    "mlb_rows": len(mlb),
    # 1. Home runs
    "hr600_1900s": r(by_decade.loc["1900s", "HR600"], 1),
    "hr600_1920s": r(by_decade.loc["1920s", "HR600"], 1),
    "hr600_2020s": r(by_decade.loc["2020s", "HR600"], 1),
    "hr600_peak_year": int(yrs["HR600"].idxmax()),
    "hr600_peak": r(yrs["HR600"].max(), 1),
    "hr600_multiple": r(by_decade.loc["2020s", "HR600"] / by_decade.loc["1900s", "HR600"], 1),
    # 2. Strikeouts
    "k_1950s": r(by_decade.loc["1950s", "K"]),
    "k_2020s": r(by_decade.loc["2020s", "K"]),
    "k_peak_year": int(yrs.loc[1910:, "K"].idxmax()),
    "k_peak": r(yrs.loc[1910:, "K"].max()),
    # 3. Batting average
    "avg_1999": r(yrs.loc[1999, "AVG"]),
    "avg_2022": r(yrs.loc[2022, "AVG"]),
    "avg_2024": r(yrs.loc[2024, "AVG"]),
    "avg_2025": r(yrs.loc[2025, "AVG"]),
    "avg_1968": r(yrs.loc[1968, "AVG"]),
    "avg_1930": r(yrs.loc[1930, "AVG"]),
    "avg_low_1969_2025_year": int(low_since.idxmin()),
    "avg_low_1969_2025": r(low_since.min()),
    # 4. Three true outcomes
    "tto_1950s": r(by_decade.loc["1950s", "TTO"]),
    "tto_2020s": r(by_decade.loc["2020s", "TTO"]),
    "bb_1950s": r(by_decade.loc["1950s", "BB"]),
    "bb_2020s": r(by_decade.loc["2020s", "BB"]),
    # 5. Singles
    "singles_1900s": r(by_decade.loc["1900s", "singles_share"]),
    "singles_2020s": r(by_decade.loc["2020s", "singles_share"]),
    # 6. Stolen bases
    "sb_2022": int(yrs.loc[2022, "SB"]),
    "sb_2023": int(yrs.loc[2023, "SB"]),
    "sb_2023_change": r(yrs.loc[2023, "SB"] / yrs.loc[2022, "SB"] - 1),
    "avg_low_year_since_1968_gap": 2022 - 1968,
    "sb_1998_2022_low_year": int(yrs.loc[1998:2022].drop(2020)["SB"].idxmin()),
    "sb_1998_2022_low": int(yrs.loc[1998:2022].drop(2020)["SB"].min()),
    "sb_2024": int(yrs.loc[2024, "SB"]),
    "sb_2025": int(yrs.loc[2025, "SB"]),
    "sb_max_1998_2025_year": int(yrs.loc[1998:2025, "SB"].idxmax()),
    # 7. International
    "foreign_1920s": r(foreign_by_decade["1920s"]),
    "foreign_1930s": r(foreign_by_decade["1930s"]),
    "foreign_low_decade": foreign_by_decade.idxmin(),
    "foreign_1870s": r(foreign_by_decade["1870s"]),
    "foreign_1960s": r(foreign_by_decade["1960s"]),
    "foreign_2020s": r(foreign_by_decade["2020s"]),
    "foreign_jump_1990s_pts": r((foreign_by_decade["1990s"] - foreign_by_decade["1980s"]) * 100, 1),
    "foreign_jump_2000s_pts": r((foreign_by_decade["2000s"] - foreign_by_decade["1990s"]) * 100, 1),
    "top_countries_2020s": {k: r(v) for k, v in top_countries.head(5).items()},
    # 8. Bigger league
    "players_1925": int(yrs.loc[1925, "players"]),
    "teams_1925": int(yrs.loc[1925, "teams"]),
    "players_2025": int(yrs.loc[2025, "players"]),
    "teams_2025": int(yrs.loc[2025, "teams"]),
    # 9. Negro Leagues
    "nl_era": {g: {k: r(nl_vs.loc[g, k]) for k in ["AVG", "OBP", "SLG", "OPS"]} for g in nl_vs.index},
    "nl_era_pa": {g: int(nl_vs.loc[g, "PA"]) for g in nl_vs.index},
}

# ------------------------------------------------------------------ chart data
decades = list(by_decade.index)
years = [int(y) for y in by_year.index]
charts = {
    "hr_by_decade": {"labels": decades, "values": [r(v, 1) for v in by_decade["HR600"]]},
    "k_by_year": {"labels": [y for y in years if y >= 1910],
                  "k": [r(by_year.loc[y, "K"]) for y in years if y >= 1910],
                  "bb": [r(by_year.loc[y, "BB"]) for y in years if y >= 1910]},
    "avg_by_year": {"labels": [y for y in years if y >= 1901], "values": [r(by_year.loc[y, "AVG"]) for y in years if y >= 1901]},
    "tto_by_decade": {"labels": [d for d in decades if d >= "1910s"],
                      "values": [r(by_decade.loc[d, "TTO"]) for d in decades if d >= "1910s"]},
    "singles_by_decade": {"labels": decades, "values": [r(v) for v in by_decade["singles_share"]]},
    "sb_by_year": {"labels": [y for y in years if y >= 1998], "values": [int(by_year.loc[y, "SB"]) for y in years if y >= 1998]},
    "foreign_by_decade": {"labels": decades, "values": [r(v) for v in foreign_by_decade]},
    "players_by_year": {"labels": years, "players": [int(v) for v in by_year["players"]], "teams": [int(v) for v in by_year["teams"]]},
    "negro_vs_mlb": {"labels": [int(y) for y in nl_by_year.index],
                     "mlb": [r(v) for v in nl_by_year[MLB]],
                     "negro": [r(v) for v in nl_by_year["Negro Leagues"]]},
}

out = {"numbers": numbers, "charts": charts}
(ROOT / "data" / "report.json").write_text(json.dumps(out, indent=1))
print(json.dumps(numbers, indent=2))
print("\nWrote data/report.json")
