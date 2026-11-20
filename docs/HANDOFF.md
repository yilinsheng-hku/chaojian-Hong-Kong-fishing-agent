# 香港岛钓鱼环境项目交接

更新：2026-11-19（香港时间）。当前代码目录：`C:\Users\25328\Desktop\project\fishing-node-red`。

## 当前实现

“潮间”使用 Node-RED + MongoDB + pi agent 服务，展示香港岛测站环境与鰂鱼涌潮汐。页面入口为 `http://127.0.0.1:1880/fishing`，Node-RED 编辑器为 `http://127.0.0.1:1880`。模型由本机 `.env` 配置；未读取密钥内容；2026-11-19 已通过一次实际提问验证模型连通。

首页有潮位、风、雨、气温、能见度五张卡片，环境摘要，以及未来 24 小时可点击的潮位变化时段。前后各 24 小时时间图支持悬浮、键盘、点击和滑块；详情展示实际单位的潮位升降量与同时段风雨依据。原先归一化总分已移除，缺测、跨来源和时间断档不会计算跳变；未来风雨不由当前读数外推。

地图有 11 个港岛参考点、2 个邻近离岛风站及3个环保署定期采样点。真实底图使用 Leaflet / OpenStreetMap，支持六个街区的中英文定位，以及选点至采用测站的连线。外部底图不可用时显示内置坐标示意图。离岛风站和水质采样点不参与港岛实时选点。地图不验证岸边通达或垂钓许可。

选点分析按每类指标分别选择最近有效站，返回过期/缺测替代原因、距离、时间、来源和港岛区域范围/中位数。示范风雨条件固定为平均风速 ≤25 km/h、过去一小时雨量 ≤5 mm。

助手有 9 个只读工具（含新增的天文台 9 天天气预报、北角参考海温与实时天气警告），支持多轮调用，每题上限6次、90秒。回答支持标题、列表与来源链接；查询过程显示中文名称。支持三种零密钥泄露风险模式：本地免密钥 Ollama / OpenAI 兼容模型（`AGENT_MODEL=ollama:...`）、内置本地测站分析模式、以及未纳入版本控制的环境变量云端模型。个人钓行、个人偏好和独立雨量回放已经移除。

## 源文件与同步

- `dashboard.html`：含明确 `{{include:文件名}}` 标记的页面模板。
- `dashboard.js`：指标、有效期校验、聊天与安全排版。
- `dashboard_v2.js`：时间图、潮位变化与时段卡片。
- `location_ui.js`：站点目录、选点请求与详情；`map_view.js`：真实地图、街区与连线。
- `dashboard.css`、`dashboard_v2.css`、`location_ui.css`、`improvements.css`：样式。
- `functions/*.js`：采集清洗、数据 API 等 Node-RED Function 的可编辑来源。
- `location_analysis.js`：后端最近站分析；`agent/server.mjs`：助手后端。
- `sync_dashboard.py`：校验模板和节点连线后生成 `flows.json`，不再执行旧版字符串迁移。

修改后运行 `python sync_dashboard.py`，用 `python sync_dashboard.py --check` 检查同步。年度潮汐请求按香港年份动态生成，跨年窗口会读取相邻年份，清洗器使用请求中的年份。

## 验证与启动

```powershell
Set-Location 'C:\Users\25328\Desktop\project\fishing-node-red'
python sync_dashboard.py --check
node tests/test_timeline.mjs
node tests/test_location.mjs
node tests/test_ingestion.mjs
node tests/test_render.mjs
node --experimental-vm-modules tests/test_agent_offline.mjs
```

首次启动与后续更新都只需 `docker compose up -d --build`。镜像中的 flow 有变化时，启动脚本会自动安装，并将旧 flow 备份到数据卷 `/data/backups/`。

`node dev/preview.mjs` 提供 `http://127.0.0.1:1881/fishing` 合成数据界面预览，不写数据库、不请求真实模型。

2026-11-19 已在本机 Docker 完成首次实时部署验证：五类天文台数据均成功写入 MongoDB，页面五张指标卡、地图（16 个标点）与选点分析正常；DeepSeek Flash 模型连通，测试问答的高低潮时间与数据库一致。

## 2026-11-19 修正

- **雨量时间格式错误（已修复）**：天文台雨量 `obsTime` 带 `+08:00`，原样入库后与其他 UTC `Z` 时间做字符串比较，API 把全部雨量当作“未来”记录过滤掉，首页雨量卡与示范风雨条件一直显示缺测。现统一转为 UTC，并新增回归测试。旧数据卷中格式错误的雨量记录可用 `db.observations.deleteMany({kind:'rain',at:/\+08:00$/})` 清除。
- **部署更新自动化**：`start.sh` 按镜像中 flow 与 settings 的校验和判断是否更新，旧 flow 自动备份，不再需要 `docker compose cp`。
- **固定基础镜像**：`nodered/node-red:5.0.10`、`mongo:7.0`；Dockerfile 去除 `start.sh` 的 CRLF，避免 Windows 检出后容器无法启动。
- **MongoDB 索引**：首次写入时创建 `observations(kind,station,at)`、`observations(at)`、`predicted_tide/tide_events(station,at)`，数据增长后查询不变慢。
- **错误处理**：助手后端区分 400（输入错误）与 502（模型/数据上游失败）；Node-RED 设 `NODE_ENV=production`，非法请求不再向浏览器返回堆栈。
- **代码整理**：`parse_temperature.js`、`parse_visibility.js`、`parse_rain.js` 由单行压缩改为可读格式；移除 `parse_pred`/`parse_events` 中未使用的辅助函数。行为以实时天文台数据核对一致。

## 局限与提交

尚未接入逐时风雨预报、地点化流速、实时海温或渔获校准；气温不能代替海温，鰂鱼涌潮位主要参考维港与北岸。报告草稿已按当前功能更新，仍需补团队分工、实际部署截图、数据量、误差样本和课程要求。

提交时排除 `.env` 和 `node_modules/`（可直接运行 `python fishing-node-red/package_submission.py` 自动扫描拦截敏感密钥并生成干净提交包）。旧版 `.backups/` 与临时 `.preview/` 已清理，项目由根目录 Git 仓库统一追踪。

## 2026-11-20 修正（安全加固、本地免密钥模型、天气展望与开源规范化）

- **清除明文 API 密钥与防呆加固**：清空 `fishing-node-red/.env` 中的明文密钥，新增 `.dockerignore`、`agent/.dockerignore` 及 `package_submission.py` 打包与密钥正则扫描工具，防止任何 `sk-...` 或 `*_API_KEY` 进入镜像、提交包或 Git 历史。
- **本地免密钥大模型支持（Ollama / OpenAI 兼容网关）**：`agent/server.mjs` 与 `compose.yaml` 新增 `OPENAI_BASE_URL` 与 `ollama:<model>` / `local:<model>` 原生多轮 Tool Calling 支持，并配置 `host.docker.internal:host-gateway`，无需付费云端密钥即可运行真实大模型问答。
- **天文台 9 天天气预报、北角海温与生效警告接入**：新增 `functions/parse_forecast.js`（HKO `fnd`）与 `functions/parse_warnings.js`（HKO `warnsum`），同步进 `flows.json`（共 56 个节点）与 `/fishing/api`；首页新增天气警告、北角参考海温与明日天气展望条；助手新增第 9 个只读工具 `get_weather_outlook`。
- **开源规范化**：初始化 Git 仓库，补充根目录 `README.md`、`LICENSE`（MIT）、`CONTRIBUTING.md`、`SECURITY.md`。
