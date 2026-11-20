# COMP7503A Programming Assignment — Hong Kong Island Station Atlas

Draft updated: 18 November 2026. Add team details, assignment-specific requirements, final deployment screenshots and measured data counts before submission.

## Smart City use case

“潮间” helps people inspect coastal environmental conditions around Hong Kong Island. It combines Hong Kong Observatory station observations, Quarry Bay tidal predictions, a map and a conversational assistant. Every observation retains its station, valid time, source URL and missing-value status. Station observations describe regional context; individual shoreline access and fishing permission require separate checks.

## Architecture and data provenance

Docker Compose defines three services: Node-RED fetches official data and serves the dashboard and APIs, MongoDB stores observations and predictions, and a Node.js service runs the pi agent SDK. Only Node-RED is exposed, on localhost port 1880. Persistent Docker volumes retain records and running flow edits.

Quarry Bay supplies hourly predicted tide, high/low tide events and observed tide. Wind comes from North Point, Central Pier, Stanley and Wong Chuk Hang, with Green Island and Lamma Island retained only as adjacent-island context. Hourly rainfall comes from Shau Kei Wan, Happy Valley, Stanley and Wong Chuk Hang. Air temperature additionally includes Hong Kong Park; visibility comes from Central and Sai Wan Ho. The map also marks EPD WM1, WT1 and WT3 as periodic sampling locations, without claiming live water-quality readings.

Sources: [HKO station directory](https://www.hko.gov.hk/en/cis/stn.htm), [HKO open-data directory](https://www.hko.gov.hk/en/abouthko/opendata_intro.htm), and [EPD marine water quality](https://www.epd.gov.hk/epd/english/environmentinhk/water/hkwqrc/waterquality/marine-1.html).

## Cleaning, time alignment and validation

Missing tide markers, missing rainfall codes and blank numeric fields become null. Hourly predicted-tide columns 01–24 represent Hong Kong time 01:00 through next-day 00:00. Annual requests use the current Hong Kong calendar year and include the adjacent year around New Year; parsers use the request's year rather than a hard-coded constant. Deterministic record IDs permit MongoDB upserts.

The data API filters stations and dates. Tide validation pairs predictions and observations only at Quarry Bay and only when timestamps differ by at most ten minutes. It returns sample count, individual errors and mean absolute error. Final report measurements must state the collection period and sample size.

## Visual analysis and map interaction

The homepage presents five current-observation cards and an environmental summary. A 49-point timeline spans 24 hours before and after the current hour. Past hours prefer valid observed tide; future hours display predicted tide. Mouse selection, keyboard arrows and a range slider expose the time-aligned station evidence. Future weather remains explicitly unavailable.

The former heuristic total score has been removed. The interface displays tide-height change in metres per hour, calculated using adjacent records from the same series and their actual time difference. It does not calculate changes across source boundaries, missing hours or unsuitable time gaps. Three separated future intervals with larger predicted height changes provide shortcuts into the chart. These are tide-reading references and do not estimate current speed or catch probability.

The map uses Leaflet 1.9.4 and OpenStreetMap tiles with visible attribution. It supports six named areas and shows lines from the selected coordinate to the station used for each metric. The built-in coordinate diagram remains available when external map resources cannot load. Location analysis chooses the nearest fresh, non-missing station separately for tide, wind, rain, air temperature and visibility, explaining rejected candidates and reference distances. It also returns island-wide station ranges and medians. Wind/rain comparisons use fixed demonstration values of 25 km/h and 5 mm in the past hour.

## Conversational assistant

The separate service exposes nine read-only tools: current observations, future tides, island rainfall, regional wind, tide validation, sources, named-location analysis, species context, and HKO 9-day weather outlook / active warning summary (including North Point reference sea temperature). A configured model—either a local key-free Ollama / OpenAI-compatible gateway (`AGENT_MODEL=ollama:...`) or a cloud provider via pi agent SDK—can make iterative tool calls, with a six-call limit and a 90-second run limit. Without an external model, a labelled local analysis mode handles common questions.

Answers display headings, short lists and clickable HTTP(S) source links. Model-supplied HTML is escaped. Tool traces use Chinese labels. Named-location answers distinguish the observed environment, tide references, general trial-fishing ideas and missing evidence. The assistant has no shell, arbitrary browsing or database-write tool. Personal trips and preferences are no longer collected by this version.

## Verification and limits

Regression scripts cover nearest-station replacement, empty and invalid coordinates, regional summaries, time alignment, missing hours, observed/predicted boundaries, future weather gaps, stable physical tide changes, year rollover, missing CSV values and safe answer rendering. Browser checks use the separate, clearly labelled synthetic preview; they do not verify live HKO ingestion or external model inference. Deployment-specific verification remains necessary after starting Docker.

No station-based hourly wind/rain forecast, local current-speed model, live sea temperature or catch calibration has been added. Air temperature is not sea temperature. Quarry Bay tide is most relevant to Victoria Harbour and the north coast; south-coast use requires caution. EPD sampling points are periodic rather than hourly observations. The map does not encode legal fishing boundaries.

## Reproducibility and submission

Run `python sync_dashboard.py` after editing the explicit HTML/CSS/JS includes or files in `functions/`, then run the checks documented in README. Export any running editor changes before replacing the volume's flow. Package source files, Docker configuration, generated `flows.json` and the final report; exclude secrets, local backups, previews and installed dependencies. Add team roles, verified deployment screenshots, data counts and the assignment brief's required evaluation before submitting.
