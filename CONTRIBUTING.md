# 贡献指南 (Contributing Guide)

感谢关注和参与 **潮间 · 香港岛测站环境图册 (Hong Kong Island Station Atlas)**！

## 1. 核心原则

- **数据真实性与可溯源**：所有接入的环境变量必须来自香港天文台（HKO）、环保署（EPD）或渔护署（AFCD）等官方开放数据，并保留测站名称、观测时间、原始 URL 与缺测状态（`null`，绝不能把缺测当作 `0`）。
- **克制推断**：不输出未经渔获校准的“综合中鱼率评分”，不将单一站点（如鰂鱼涌潮位、北角海温或天文台全港 9 天预报）冒充为任意岸边钓位的微气候逐时实测。
- **零密钥泄露 (Zero Secrets in Repo)**：严禁在代码、配置文件、提交记录或打包产物中硬编码任何云端 API 密钥（如 `sk-...`）。本地开发或演示优先使用免密钥的 **Ollama 本地大模型** 或内置 **离线测站分析模式**。

## 2. 开发与同步流程

本项目采用模块化源文件生成 Node-RED `flows.json` 的工作流，**请勿直接手改 `flows.json` 中由源文件生成的节点代码**：

1. 修改页面模板（`dashboard.html`、`stations_panel.html`）、样式（`*.css`）、前端脚本（`dashboard.js`、`dashboard_v2.js`、`location_ui.js`、`map_view.js`）或后端函数（`functions/*.js`、`location_analysis.js`、`agent/server.mjs`）。
2. 运行同步与校验脚本：
   ```bash
   cd fishing-node-red
   python sync_dashboard.py
   python sync_dashboard.py --check
   ```
3. 运行全套回归测试：
   ```bash
   node tests/test_timeline.mjs
   node tests/test_location.mjs
   node tests/test_ingestion.mjs
   node tests/test_render.mjs
   node --experimental-vm-modules tests/test_agent_offline.mjs
   ```
4. 使用打包校验脚本检查是否混入敏感信息：
   ```bash
   python package_submission.py
   ```
