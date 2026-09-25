# Lahman Batting: 155 Seasons of Hitting

A two-page website (a report and an interactive dashboard) built from the batting table of the Lahman Baseball Database.

*Author: Emily*

## Where the data comes from

The data is the **Lahman Baseball Database** by Sean Lahman, now maintained by the Society for American Baseball Research (SABR): <https://sabr.org/lahman-database/>. It is licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

`data/raw/Batting.csv` is the Batting table downloaded from the Lahman database. `People.csv` and `Teams.csv` come from the [`pylahman`](https://pypi.org/project/pylahman/) Python package, version 0.7.0, which bundles the same release (downloaded from SABR on 2026-01-08). The data covers seasons 1871 through 2025. This release includes the Negro Leagues (1920–1948), which MLB recognized as major leagues in 2020, and earlier independent Black clubs.

## Files

| File | What it does |
|---|---|
| `README.md` | This file. Describes the project, the data source, and every file. |
| `.gitignore` | Tells Git which files to leave out (Python caches, editor settings). |
| `pyproject.toml` | Python project settings: the Python version and the packages the scripts need. |
| `.python-version` | The Python version for this project (used by `uv`). |
| `uv.lock` | Exact package versions installed by `uv`, so the scripts run the same everywhere. |
| `data/raw/Batting.csv` | Raw Lahman batting table. One row per player, per season, per team stint. |
| `data/raw/People.csv` | Raw Lahman player table (names, batting and throwing hand, birth country). |
| `data/raw/Teams.csv` | Raw Lahman team-season table (team names, franchise codes). |
| `data/batting.csv` | The clean file the report and dashboard use. Built by `scripts/build_data.py`. |
| `scripts/get_raw_data.py` | Re-downloads the three raw tables into `data/raw/` from `pylahman`. |
| `scripts/build_data.py` | Joins the raw tables, drops bad rows, adds derived columns, and writes `data/batting.csv`. |
| `scripts/check_data.py` | Checks `data/batting.csv` against the project requirements and some well-known stats. |

| `index.html` | The report page (opens at the site URL): "How the Game Changed," with headline numbers, nine findings with charts, and a section about the data. |
| `css/report.css` | Styles used only on the report page. |
| `js/report.js` | Draws the report's nine charts from `data/report.json`. |
| `data/report.json` | Every number and chart series used on the report page. Written by `scripts/report_numbers.py`. |
| `scripts/report_numbers.py` | Computes every number quoted in the report from `data/batting.csv`, prints them, and writes `data/report.json`. |
| `dashboard.html` | The dashboard page: filters, measure and breakdown switches, four charts, a table, and "Legends" player cards that alternate between the left and right margins and fade in as you scroll (hover for career stats, click to filter). Also holds the inline baseball graphics (diamond and batter silhouette). |
| `css/style.css` | Shared styles for both pages: navigation bar, fonts, colors, cards. |
| `css/dashboard.css` | Styles used only on the dashboard (filter grid, chart cards, table). |
| `js/dashboard.js` | Loads `data/batting.csv` in the browser, applies the filters, and computes every number, chart, and table on the dashboard, plus the career stats on the "Legends" player cards. |
| `img/baseball.svg` | Baseball icon used in the navigation bar and as the browser-tab icon. |
| `js/vendor/chart.umd.js` | [Chart.js](https://www.chartjs.org/) 4.4.1, the charting library (MIT License). |
| `js/vendor/papaparse.min.js` | [Papa Parse](https://www.papaparse.com/) 5.4.1, reads the CSV in the browser (MIT License). |

## Viewing the site locally

Browsers won't let a page opened straight from a file load `data/batting.csv`, so start a small local server from the project folder:

```
uv run python -m http.server 8000
```

Then open <http://localhost:8000/dashboard.html>.

## How to rebuild the data

```
uv run scripts/build_data.py
uv run scripts/check_data.py
uv run scripts/report_numbers.py
```

`build_data.py` needs only `pandas`. `get_raw_data.py` also needs `pylahman==0.7.0`.

## The clean data file: `data/batting.csv`

**One row = one player's batting line for one team in one season.** A player traded mid-season has one row per team (`stint` 1, 2, …). The file has 128,597 rows and 34 columns, covering 155 seasons (1871–2025) and 24,011 players.

**Rows dropped:** 1 row out of 128,598 raw rows. For `tayloci99` (1912, team WBS), the record shows 0 hits and 1 home run, which can't both be true.

### Columns

| Column | Type | Meaning |
|---|---|---|
| `year` | time | Season |
| `decade` | category | Decade of the season, e.g. `1990s` |
| `player_id` | group | Lahman player ID |
| `player_name` | category | First and last name |
| `stint` | number | Order of the player's teams within the season |
| `team_id` | group | Lahman team code for that season |
| `team_name` | category | Team name that season |
| `franchise_id` | category | Franchise code (links a franchise across moves and renames) |
| `league` | category | League code (`AL`, `NL`, `NNL`, …) |
| `league_name` | category | Full league name |
| `league_group` | category | `AL/NL and 19th-century majors`, `Negro Leagues`, or `Independent Black clubs` |
| `bats` | category | Batting hand: Right, Left, Both, Unknown |
| `throws` | category | Throwing hand: Right, Left, Both, Unknown |
| `birth_country` | category | Player's birth country |
| `G` | number | Games |
| `PA` | number | Plate appearances = AB + BB + HBP + SH + SF (a blank component counts as 0) |
| `AB` | number | At-bats |
| `R` | number | Runs |
| `H` | number | Hits |
| `1B` | number | Singles = H − 2B − 3B − HR |
| `2B`, `3B`, `HR` | number | Doubles, triples, home runs |
| `TB` | number | Total bases = 1B + 2×2B + 3×3B + 4×HR |
| `RBI` | number | Runs batted in |
| `SB`, `CS` | number | Stolen bases, caught stealing |
| `BB`, `IBB` | number | Walks, intentional walks |
| `SO` | number | Strikeouts |
| `HBP` | number | Hit by pitch |
| `SH`, `SF` | number | Sacrifice hits, sacrifice flies |
| `GIDP` | number | Grounded into double play |

**Blank cells** mean the stat wasn't recorded that season. They are not zeros. For example, `SF` was only tracked from 1954 on, and `CS`, `IBB`, and `GIDP` are missing for many early seasons.

### How rates are computed

Rates are computed from **summed totals**, never by averaging each row's rate:

- Batting average (AVG) = sum(H) / sum(AB)
- On-base percentage (OBP) = (H + BB + HBP) / (AB + BB + HBP + SF)
- Slugging (SLG) = sum(TB) / sum(AB)
- OPS = OBP + SLG
- Home-run rate = sum(HR) / sum(PA); strikeout rate = sum(SO) / sum(PA)
