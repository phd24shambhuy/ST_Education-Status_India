# Methodology

## School Education (EMRS)
* Sources: NESTS Annual Reports 2020-21, 2021-22, 2022-23, 2023-24 (State/UT tables), extracted by two independent parsers with exact agreement.
* Indicators: functional EMRSs; sanctioned EMRSs (cumulative); functional ÷ sanctioned (same report); building construction status (old Art. 275(1) + new scheme).
* States/UTs absent from the NESTS tables are hatched as “not listed”, never shown as zero.
* School records: only schools named in the reports (148 records); district and block as printed; no coordinates exist, so no school points.

## Higher Education (AISHE)
* Sources: AISHE State/UT tables 2019-20 to 2023-24 — Table 14 (social-group enrolment), 19 (GER), 20 (GPI), 38 (population 18-23), 1(a) (institutions).
* ST share = ST enrolment ÷ total enrolment × 100 (same table and year).
* GER/GPI: published values; 2019-20 excluded from comparisons (older population projection); “not applicable” where Table 38 shows no ST population.
* Enrolment is by institution location and includes AISHE estimation for non-response.

## Map
DataMeet `States/Admin2` (CC BY 4.0), post-2020 States/UTs, simplified. Fixed class breaks per indicator (listed in `data/*.js` as `breaks`) so colours are comparable across years.

## Reproduce
From the project root: `bash scripts/run_all.sh` (requires the original input files in `inputs/`).
