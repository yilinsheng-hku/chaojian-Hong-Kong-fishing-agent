"""Build the Node-RED export from explicit page includes and function sources.

Run with --check to validate without writing. No migrations or code-string patches.
"""
import argparse
import json
import re
from pathlib import Path

FOLDER = Path(__file__).resolve().parent
INCLUDE = re.compile(r"\{\{include:([\w.-]+)\}\}")


def render_dashboard(folder=FOLDER):
    template = (folder / "dashboard.html").read_text(encoding="utf-8")
    included = set()

    def include(match):
        name = match[1]
        if name in included:
            raise ValueError(f"Duplicate dashboard include: {name}")
        if Path(name).suffix not in {".css", ".js", ".html"}:
            raise ValueError(f"Unsupported dashboard include: {name}")
        included.add(name)
        return (folder / name).read_text(encoding="utf-8")

    html = INCLUDE.sub(include, template)
    if "{{include:" in html:
        raise ValueError("Unresolved dashboard include")
    return html


def build_flows(folder=FOLDER):
    flows = json.loads((folder / "flows.json").read_text(encoding="utf-8"))
    nodes = {node["id"]: node for node in flows}
    if len(nodes) != len(flows):
        raise ValueError("Duplicate Node-RED node IDs")
    extra_pipelines = [
        (
            "forecast",
            "定时 9天天气预报",
            "天文台 9天预报 URL",
            "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=sc",
            "获取 9天天气预报",
            "清洗 9天天气预报",
            "1800",
            4,
            750,
        ),
        (
            "warnings",
            "定时 天气警告摘要",
            "天文台警告摘要 URL",
            "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=sc",
            "获取 天气警告摘要",
            "清洗 天气警告摘要",
            "300",
            5,
            810,
        ),
    ]
    for suffix, inj_name, url_name, url_val, http_name, parse_name, repeat_s, delay_s, y_pos in extra_pipelines:
        inj_id, url_id, http_id, parse_id = f"inject_{suffix}", f"url_{suffix}", f"http_{suffix}", f"parse_{suffix}"
        if inj_id not in nodes:
            new_nodes = [
                {
                    "id": inj_id, "type": "inject", "z": "fishing", "name": inj_name,
                    "props": [{"p": "payload"}], "repeat": repeat_s, "crontab": "",
                    "once": True, "onceDelay": delay_s, "topic": "", "payload": "", "payloadType": "date",
                    "x": 170, "y": y_pos, "wires": [[url_id]],
                },
                {
                    "id": url_id, "type": "change", "z": "fishing", "name": url_name,
                    "rules": [{"t": "set", "p": "url", "pt": "msg", "to": url_val, "tot": "str"}],
                    "action": "", "property": "", "from": "", "to": "", "reg": False,
                    "x": 410, "y": y_pos, "wires": [[http_id]],
                },
                {
                    "id": http_id, "type": "http request", "z": "fishing", "name": http_name,
                    "method": "GET", "ret": "txt", "paytoqs": "ignore", "url": "", "tls": "",
                    "persist": False, "proxy": "", "insecureHTTPParser": False, "authType": "",
                    "senderr": False, "headers": [], "x": 660, "y": y_pos, "wires": [[parse_id]],
                },
                {
                    "id": parse_id, "type": "function", "z": "fishing", "name": parse_name,
                    "func": "", "outputs": 1, "timeout": 0, "noerr": 0,
                    "initialize": "", "finalize": "", "libs": [], "x": 920, "y": y_pos, "wires": [["save"]],
                },
            ]
            for n in new_nodes:
                flows.append(n)
                nodes[n["id"]] = n
    nodes["page"]["func"] = (
        "msg.headers={'Content-Type':'text/html; charset=utf-8'};msg.payload="
        + json.dumps(render_dashboard(folder), ensure_ascii=False)
        + ";return msg;"
    )
    for source in sorted((folder / "functions").glob("*.js")):
        if source.stem == "tide_request":
            continue
        node = nodes[source.stem]
        if node["type"] != "function":
            raise ValueError(f"Expected function node: {source.stem}")
        node["func"] = source.read_text(encoding="utf-8").rstrip() + "\n"
    nodes["location_fn"]["func"] = (folder / "location_analysis.js").read_text(encoding="utf-8")
    request = (folder / "functions/tide_request.js").read_text(encoding="utf-8")
    if request.count("__DATA_TYPE__") != 1:
        raise ValueError("Expected one tide data-type placeholder")
    for node_id, data_type in [("url_pred", "HHOT"), ("url_events", "HLT")]:
        node = nodes[node_id]
        node.pop("rules", None)
        node.update(type="function", func=request.replace("__DATA_TYPE__", data_type),
                    outputs=1, timeout=0, noerr=0, initialize="", finalize="", libs=[])
    for node in flows:
        for output in node.get("wires", []):
            for target in output:
                if target not in nodes:
                    raise ValueError(f"Missing wire target: {node['id']} -> {target}")
    return flows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check that flows.json is up to date")
    args = parser.parse_args()
    path = FOLDER / "flows.json"
    built = build_flows()
    if args.check:
        if json.loads(path.read_text(encoding="utf-8")) != built:
            parser.exit(1, "flows.json is out of date; run python sync_dashboard.py\n")
        print("Dashboard, function sources and flow wiring are in sync.")
    else:
        # Write only after every include and function has been validated.
        path.write_text(json.dumps(built, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Built dashboard and functions into {len(built)} Node-RED nodes.")


if __name__ == "__main__":
    main()
