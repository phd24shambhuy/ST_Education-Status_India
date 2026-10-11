# Tribal Education in India — interactive dashboard

Two sections: **School Education (EMRS)** and **Higher Education (AISHE)**, each with a State/UT map, detail panel, ranking/table, and records.

## Open it
* **Simplest:** double-click `standalone.html` (one file, everything embedded, works offline).
* **Full site:** double-click `index.html`. It uses only local files and works offline in Chrome, Edge, Firefox and Safari.
* **Local server (if your browser blocks local files):**
  * Windows: double-click `serve.bat`, then open http://localhost:8000/
  * macOS / Linux: run `./serve.sh` in this folder, then open http://localhost:8000/
  * Any OS with Python 3: `python3 -m http.server 8000` in this folder.

The URL hash keeps the view, e.g. `index.html#aishe/ger_st/2023-24/JH`.

## Folders
`assets/` CSS, JS (d3 7.9.0, ISC licence), font (Public Sans, OFL) · `data/` generated data (do not edit) · `geo/` boundaries · `downloads/` verified CSVs · `methods/`, `sources/` documentation.
