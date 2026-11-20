# 安全策略 (Security Policy)

## 密钥与凭证安全

- **禁止提交 `.env`**：`.env` 已被列入 `.gitignore` 与 `.dockerignore`。任何真实云端 API Key 绝不能进入版本库或 Docker 镜像层。
- **免密钥本地大模型支持**：问答助手原生支持对接宿主机免密钥的 Ollama 或其他本地 OpenAI 兼容推理服务（设置 `AGENT_MODEL=ollama:qwen2.5:7b` 与 `OPENAI_BASE_URL=http://host.docker.internal:11434/v1`），无需付费云端密钥即可运行完整的多轮工具调用。
- **打包安全扫描**：发布或提交作业前，请运行 `python fishing-node-red/package_submission.py`，脚本会自动扫描所有文本文件并拦截疑似 `sk-...` 或 `*_API_KEY=...` 的敏感凭证。

## 助手安全边界

- 助手仅暴露 **9 个只读数据查询工具**（只读本站 `/fishing/api` 与 `/fishing/location-analysis`）。
- 助手不具备 Shell 执行、任意外部 URL 抓取或数据库写入权限。
- 前端渲染模型输出时对所有 HTML 标签进行转义，仅放行经过 `URL` 校验的 `http:` / `https:` 链接。
