# Lahman Batting: 155 Seasons of Hitting

A two-page website (a report and an interactive dashboard) built from the batting table of the Lahman Baseball Database.

*Author: Emily Huddleston*

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

| `index.html` | The report page (opens at the site URL): "How the Game Changed," with headline numbers, a clickable "nine innings" scoreboard, nine findings with charts, a scroll-animated seventh-inning stretch (with an end-of-stretch celebration), and a section about the data. |
| `css/report.css` | Styles used only on the report page. |
| `js/hit-field.js` | The ballpark at the top of the dashboard (share of hits that are singles, doubles, triples and home runs in the current view) and the "Step Up to the Plate" batting game it opens: a notable player from the data bats, each fair ball is a hit with his real career batting average, and a scoreboard shows the count, bases, play-by-play and his career numbers. |
| `js/chart-theme.js` | Shared chart styling for both pages: dark-theme colors, gradient fills, the hover crosshair, count-up numbers, and fade-in on scroll. |
| `js/report.js` | Draws the report's nine charts from `data/report.json`, runs the scoreboard (hover preview, jump links, current-inning highlight), draws the seventh-inning-stretch fans, and drives that animation as you scroll down (with the end-of-stretch celebration and confetti). |
| `data/report.json` | Every number and chart series used on the report page. Written by `scripts/report_numbers.py`. |
| `scripts/report_numbers.py` | Computes every number quoted in the report from `data/batting.csv`, prints them, and writes `data/report.json`. |
| `dashboard.html` | The dashboard page: a ballpark that opens a batting game (with its pop-up scoreboard), filters, measure and breakdown switches, four charts, a table, and "Legends" player cards that alternate between the left and right margins and fade in as you scroll (hover for career stats, click to filter). Also holds the inline batter silhouette used when a player photo can't load. |
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

## Player photo credits

The "Legends" cards on the dashboard show photos hot-linked from [Wikimedia Commons](https://commons.wikimedia.org/). They're public domain or openly licensed, and each is credited on the back of its card:

| Player | Photo | License |
|---|---|---|
| Babe Ruth | Irwin, La Broad & Pudlin, 1920 ([file](https://commons.wikimedia.org/wiki/File:Babe_Ruth2.jpg)) | Public domain |
| Josh Gibson | Harrison Studio, 1931 ([file](https://commons.wikimedia.org/wiki/File:Josh_Gibson_1931.jpg)) | Public domain |
| Ted Williams | Unknown photographer, 1958 ([file](https://commons.wikimedia.org/wiki/File:Ted_Williams_(cropped).jpg)) | Public domain |
| Jackie Robinson | Harry Warnecke et al., 1949, National Portrait Gallery ([file](https://commons.wikimedia.org/wiki/File:Jackie_Robinson,_NPG_97_135.jpg)) | CC0 |
| Hank Aaron | Unknown photographer, 1974 ([file](https://commons.wikimedia.org/wiki/File:Hank_Aaron_1974.jpg)) | Public domain |
| Rickey Henderson | Dlz28 (Wikipedia user), 2002 ([file](https://commons.wikimedia.org/wiki/File:Rickeyhenderson2002.jpg)) | Public domain |
| Ichiro Suzuki | Jeffrey Hayes, 2011 ([file](https://commons.wikimedia.org/wiki/File:Ichiro_Suzuki_(51007034081)_(cropped).jpg)) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| Barry Bonds | druchoy (Flickr), 2005 ([file](https://commons.wikimedia.org/wiki/File:BarryLamar_Bonds.jpg)) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |

The card frames are an original design, not copies of any real baseball-card set.

The batting game uses the photos above plus these, also from Wikimedia Commons:

| Player | Photo | License |
|---|---|---|
| Albert Pujols | Rafael Amado Deras, 2006 ([file](https://commons.wikimedia.org/wiki/File:Albert_Pujols_%28MLB_All-Star_Game_July_11,_2006%29.jpg)) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| Alex Rodriguez | Keith Allison, 2007 ([file](https://commons.wikimedia.org/wiki/File:Alex_Rodriguez_by_Keith_Allison.jpg)) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |
| Willie Mays | Unknown photographer, 1955 ([file](https://commons.wikimedia.org/wiki/File:Willie_Mays_%281955%29_%28cropped%29.jpg)) | Public domain |
| Ken Griffey Jr. | Keith Allison, 2009 ([file](https://commons.wikimedia.org/wiki/File:Ken_Griffey,_Jr._June_2009_%28cropped%29.jpg)) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |
| Jim Thome | Erik Drost, 2015 ([file](https://commons.wikimedia.org/wiki/File:Jim_Thome_%2818421174923%29.jpg)) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| Sammy Sosa | mr609sosa (Flickr), 2012 ([file](https://commons.wikimedia.org/wiki/File:Sammy_Sosa_2012_%28cropped%29.jpg)) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| Frank Robinson | Unknown photographer, 1961 ([file](https://commons.wikimedia.org/wiki/File:Frank_Robinson_1961.jpg)) | Public domain |
| Mark McGwire | Keith Allison, 2011 ([file](https://commons.wikimedia.org/wiki/File:Mark_McGwire_on_June_29,_2011.jpg)) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |
| Harmon Killebrew | Unknown photographer, 1962 ([file](https://commons.wikimedia.org/wiki/File:Harmon_Killebrew_1962.png)) | Public domain |
| Pete Rose | Unknown photographer, 1963 ([file](https://commons.wikimedia.org/wiki/File:Pete_Rose_%28cropped%29.jpg)) | Public domain |
| Ty Cobb | International Film Service, 1913 ([file](https://commons.wikimedia.org/wiki/File:1913_Ty_Cobb_portrait_photo.png)) | Public domain |
| Stan Musial | Jay Publishing, 1957 ([file](https://commons.wikimedia.org/wiki/File:Stan_Musial_-_St._Louis_Cardinals_-_1957.jpg)) | Public domain |
| Tris Speaker | Bain News Service, 1912 ([file](https://commons.wikimedia.org/wiki/File:Tris_Speaker.jpg)) | Public domain |
| Derek Jeter | D. Benjamin Miller, 2024 ([file](https://commons.wikimedia.org/wiki/File:Derek_Jeter_during_MLB_on_Fox_pre-game_show,_October_16,_2024_-_001_%28cropped%29.jpg)) | CC0 |
| Cap Anson | Stevens, Chicago, 1888 ([file](https://commons.wikimedia.org/wiki/File:Cap_Anson,_Spaulding_Cabinet_Photo,_1888.png)) | Public domain |
| Honus Wagner | Chicago Daily News, 1903 ([file](https://commons.wikimedia.org/wiki/File:Honus_Wagner_%28crop%29.JPG)) | Public domain |
| Carl Yastrzemski | Unknown photographer, 1966 ([file](https://commons.wikimedia.org/wiki/File:Carl_Yastrzemski_1966.jpg)) | Public domain |
| Paul Molitor | Paul Morse, White House, 2005 ([file](https://commons.wikimedia.org/wiki/File:Paul_Molitor_white_house.jpg)) | Public domain |
| Eddie Collins | Bain News Service, 1911 ([file](https://commons.wikimedia.org/wiki/File:Eddie_Collins_1911.jpg)) | Public domain |

