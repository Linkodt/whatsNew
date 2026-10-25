# UpdateWhat for DeepSeek Harness

[English](README.md) | 中文

**给 agent 用的依赖升级证据包。** UpdateWhat 把两个版本之间的差异整理成 agent 可以直接行动的简报：release notes、带破坏性信号的 commit、源码链接和迁移清单。升级指南由 agent 来写、代码由 agent 来改，插件不会额外调用第二个 LLM。

灵感来自 [updateWhat-web](https://github.com/Linkodt/updateWhat-web)。

## 为什么需要它

升级一个依赖，通常要翻几十条 release note 和 commit，再把它们翻译成代码改动。直接在 agent 会话里做，要么上下文被灌满，要么漏掉关键条目。这个 bundle 负责把原始材料取回来、筛干净、压到 agent 能消化的体积。

## 它能做什么

- 拉取指定版本区间内的 release（最多两页 GitHub API），标签带不带 `v` 都能匹配。
- 对比两个 tag，保留包含 breaking、remove、deprecate、migrate、refactor、feat、fix、security、performance、CVE 等关键词的 commit。
- releases 和 compare 两个请求并行；一边失败时，仍返回另一边的证据并附上 collection warning。
- 输出一份 Markdown 证据包：数量统计、compare 与 commit 链接、截断说明、以及明确的下一步。
- 把 GitHub 文本当作不可信数据，不做模型调用。

## 安装

### 通过插件市场

本仓库在根目录提供 format 1 的市场索引 [`market.json`](market.json)。在 Harness Web UI 里：

1. 打开 **Plugins** → **Experimental plugins** → **More**，启用 **Custom plugin markets**。
2. 打开 **Discover** → **Add index source**，填入下面任一地址：
   - `https://fastly.jsdelivr.net/gh/Linkodt/whatsNew@main/market.json` —— CDN 镜像，`raw.githubusercontent.com` 被墙时可用；
   - `https://raw.githubusercontent.com/Linkodt/whatsNew/main/market.json` —— GitHub 原始地址。
3. 在卡片上安装 **UpdateWhat**。

市场索引没有签名，只添加你信任的来源。

### 通过 Git

```
plugin_manager install_bundle
  target: git+https://github.com/Linkodt/whatsNew.git#<commit>
```

commit 用 [`market.json`](market.json) 里钉死的那一个。插件没有构建步骤，Git 安装会直接运行仓库里的文件。

如果 `github.com` 的 HTTPS 被阻断，先把 Git 改走 SSH，再执行上面的安装：

```bash
git config --global url."git@github.com:".insteadOf "https://github.com/"
```

安装 spec 不用改，Git 会自动改写成 SSH。另一个可靠办法是发布到 npm。

### 从本地目录

```
plugin_manager install_bundle
  target: /absolute/path/to/whatsNew
```

bundle 会插入一个 Host 行（`updatewhat`），并向该 profile 的 agent 暴露一个工具（`upgrade_guide`）。安装对该 profile 的所有会话生效。

## 使用

直接用自然语言对 agent 说：

> 把 React 从 17.0.0 升到 18.0.0，并修好迁移。

agent 会调用 `upgrade_guide`，写升级指南，改 workspace，然后跑项目检查。

也可以直接调用工具：

```
upgrade_guide repo=facebook/react from=17.0.0 to=18.0.0
```

### 工具参数

| 参数 | 必填 | 含义 |
|---|---|---|
| `repo` | 是 | `owner/repo`、`https://github.com/owner/repo` 或 `github.com/owner/repo`。 |
| `from` | 是 | 当前版本或 tag，例如 `17.0.0`、`v17.0.0`。 |
| `to` | 是 | 目标版本或 tag，例如 `18.2.0`、`v18.2.0`。 |
| `maxReleases` | 否 | 最多包含多少条 release note，1–50，默认 20。 |
| `maxCommits` | 否 | 最多列出多少个重要 commit，1–300，默认 120。 |

### 输出结构

证据包包含：

- 源仓库与 compare 链接，以及 release / commit 数量；
- **Collection warnings**：某个 GitHub 端点失败时的说明；
- **Release notes**：区间内的 release，按时间从旧到新；
- **Important commits**：短 SHA、日期、标题和 commit 链接；
- **Next steps for the agent**：确认清单文件、按固定章节写指南、执行迁移、跑检查、不确定的 API 留成 open question。

## 配置

| 配置 | 默认值 | 含义 |
|---|---|---|
| `githubToken` | 环境变量 `GITHUB_TOKEN` / `GH_TOKEN` | Bearer token，提高限额并访问私有仓库。 |
| `githubApiBase` | `https://api.github.com` | API 源和可选路径前缀，例如 `https://ghe.example.com/api/v3`。 |

建议在启动 Harness 的环境里设置 token，把未认证的 60 次/小时提高到 5,000 次/小时。也可以写在插件行的 config 里。

## 工作原理

1. `fetchReleases` 最多读两页 release，筛出区间内的 tag。
2. `compareTags` 调 GitHub compare，标签带不带 `v` 都会重试。
3. commit 按关键词和 conventional commit 的破坏性标记（`feat!:`, `BREAKING CHANGE`）筛选。
4. 组装证据包时对单条和总 release 文本设上限，避免一个超大 changelog 灌爆上下文。

每个 HTTP 请求独立连接、45 秒截止、响应上限 12 MiB。一边失败而另一边成功时，失败会变成 warning，而不是整次调用失败。

## 限制

- GitHub 未认证限额 60 次/小时；私有仓库需要 token。
- compare 单次最多返回 250 个 commit，超出时证据包会注明。
- release note 最多覆盖最新 200 个 release，起点更早的区间可能缺旧 note。
- 单条 release 截断到 6,000 字符，总计 40,000 字符。
- 插件不会自己改清单、跑包管理器或执行迁移；这些由 agent 用常规工作区工具完成。
- Discover 没有“升级”按钮；发新版等于新增索引条目并让用户重装。

## 开发

```bash
node --check index.js
node test/offline.mjs
```

测试会起一个本地 HTTP 服务替代 `api.github.com`，覆盖区间过滤、预发布版本、`v` 前缀、重定向、限流报错、半边失败和参数校验。测试不访问网络。运行时没有依赖，也没有构建步骤。

## 发布

Git、npm 和插件市场索引三条路径，以及 format 1 索引规则和发布前检查清单，见 [`publishing/README.md`](publishing/README.md)。

## 许可证

MIT © 2026 keda，见 [LICENSE](LICENSE)。
