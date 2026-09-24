"""
Build the clean batting data file used by the report and the dashboard.

Input  (data/raw/, straight from the Lahman Baseball Database):
    Batting.csv  - one row per player, per season, per team stint
    People.csv   - one row per player (name, bats, throws, birth country)
    Teams.csv    - one row per team per season (team name, franchise)

Output:
    data/batting.csv - one row per player, per season, per team stint,
                       with names and team info joined on and a few
                       derived counting stats (1B, TB, PA).

Run from the project folder:
    uv run scripts/build_data.py
"""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "batting.csv"

# League codes used in Lahman: (full name, league group).
# The 2025 release added the Negro Leagues (1920-1948, recognized as major
# leagues by MLB in 2020) and earlier independent Black clubs (1891-1936).
LEAGUES = {
    "NL": ("National League", "AL/NL and 19th-century majors"),
    "AL": ("American League", "AL/NL and 19th-century majors"),
    "AA": ("American Association", "AL/NL and 19th-century majors"),
    "NA": ("National Association", "AL/NL and 19th-century majors"),
    "UA": ("Union Association", "AL/NL and 19th-century majors"),
    "PL": ("Players' League", "AL/NL and 19th-century majors"),
    "FL": ("Federal League", "AL/NL and 19th-century majors"),
    "NNL": ("Negro National League (1920-31)", "Negro Leagues"),
    "NN2": ("Negro National League (1933-48)", "Negro Leagues"),
    "NAL": ("Negro American League", "Negro Leagues"),
    "ECL": ("Eastern Colored League", "Negro Leagues"),
    "ANL": ("American Negro League", "Negro Leagues"),
    "EWL": ("East-West League", "Negro Leagues"),
    "NSL": ("Negro Southern League", "Negro Leagues"),
    "EAS": ("Eastern independent clubs", "Independent Black clubs"),
    "WES": ("Western independent clubs", "Independent Black clubs"),
    "IND": ("Independent clubs", "Independent Black clubs"),
    "NAC": ("National Association of Colored Baseball Clubs", "Independent Black clubs"),
    "INT": ("International League of Colored Baseball Clubs", "Independent Black clubs"),
}

HAND_NAMES = {"R": "Right", "L": "Left", "B": "Both", "S": "Both"}

# keep_default_na=False plus na_values=[""] makes sure the league code "NA"
# (National Association) is never read as a missing value.
READ_OPTS = dict(keep_default_na=False, na_values=[""])


def main():
    batting = pd.read_csv(RAW / "Batting.csv", **READ_OPTS)
    people = pd.read_csv(RAW / "People.csv", **READ_OPTS)
    teams = pd.read_csv(RAW / "Teams.csv", **READ_OPTS)
    n_raw = len(batting)

    # 1. League. The 1871-1875 National Association has the code "NA". Some
    #    copies of the data leave it blank instead, so fill blanks with "NA".
    batting["lgID"] = batting["lgID"].fillna("NA")

    # 2. Player info.
    people = people[["playerID", "nameFirst", "nameLast", "bats", "throws", "birthCountry"]].copy()
    people["player_name"] = (
        people["nameFirst"].fillna("").str.strip() + " " + people["nameLast"].fillna("").str.strip()
    ).str.strip()
    df = batting.merge(people, on="playerID", how="left", validate="many_to_one")

    # 3. Team info (team name as it was that season, plus franchise code).
    team_info = teams[["yearID", "teamID", "name", "franchID"]].rename(
        columns={"name": "team_name", "franchID": "franchise_id"}
    )
    df = df.merge(team_info, on=["yearID", "teamID"], how="left", validate="many_to_one")

    # 4. Drop rows whose hit columns contradict each other (more extra-base
    #    hits than hits). In the 2025 release this is a single row:
    #    tayloci99, 1912, WBS (0 H but 1 HR).
    bad = df["2B"] + df["3B"] + df["HR"] > df["H"]
    if bad.any():
        print(f"Dropping {bad.sum()} row(s) where 2B + 3B + HR > H:")
        print(df.loc[bad, ["playerID", "yearID", "teamID", "H", "2B", "3B", "HR"]].to_string(index=False))
    df = df[~bad].copy()
    n_dropped = int(bad.sum())

    # 5. Derived counting stats. These are totals, so they can be summed
    #    across rows. Missing components (e.g. SF before 1954) count as 0
    #    in PA only; the original columns keep their blanks.
    df["1B"] = df["H"] - df["2B"] - df["3B"] - df["HR"]
    df["TB"] = df["1B"] + 2 * df["2B"] + 3 * df["3B"] + 4 * df["HR"]
    df["PA"] = df["AB"] + df[["BB", "HBP", "SH", "SF"]].fillna(0).sum(axis=1)

    # 6. Labels for filtering.
    df["decade"] = (df["yearID"] // 10 * 10).astype(str) + "s"
    df["league_name"] = df["lgID"].map({k: v[0] for k, v in LEAGUES.items()})
    df["league_group"] = df["lgID"].map({k: v[1] for k, v in LEAGUES.items()})
    df["bats"] = df["bats"].map(HAND_NAMES).fillna("Unknown")
    df["throws"] = df["throws"].map(HAND_NAMES).fillna("Unknown")
    df["birthCountry"] = df["birthCountry"].fillna("Unknown")

    # 7. Rename to friendly column names and order the columns.
    df = df.rename(
        columns={
            "yearID": "year",
            "playerID": "player_id",
            "teamID": "team_id",
            "lgID": "league",
            "birthCountry": "birth_country",
        }
    )
    cols = [
        "year", "decade", "player_id", "player_name", "stint",
        "team_id", "team_name", "franchise_id", "league", "league_name", "league_group",
        "bats", "throws", "birth_country",
        "G", "PA", "AB", "R", "H", "1B", "2B", "3B", "HR", "TB", "RBI",
        "SB", "CS", "BB", "SO", "IBB", "HBP", "SH", "SF", "GIDP",
    ]
    df = df[cols].sort_values(["year", "player_id", "stint"]).reset_index(drop=True)
    stat_cols = cols[cols.index("G"):]
    df[stat_cols] = df[stat_cols].astype("Int64")  # whole numbers, blanks stay blank

    # 8. Sanity checks: only the dropped rows are gone, every join matched.
    assert len(df) == n_raw - n_dropped, "row count changed during the joins"
    assert df["player_name"].notna().all(), "a player did not match People.csv"
    assert df["team_name"].notna().all(), "a team did not match Teams.csv"
    assert df["league_name"].notna().all(), "unknown league code"
    assert (df["1B"] >= 0).all(), "negative singles"

    df.to_csv(OUT, index=False)
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(df):,} rows x {df.shape[1]} columns")


if __name__ == "__main__":
    main()
