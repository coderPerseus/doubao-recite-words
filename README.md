# chatWords

一个 Agent 优先、同时支持 Web 和终端的本地背单词工具。它会给出中文释义、英文解释和挖空例句，你只需要猜出对应的英文单词。

[在线体验](https://chatwords.snailrun160.workers.dev/?ui=c62ff50c)

![chatWords 界面预览](docs/chatwords-ui-concept.png)

## 功能亮点

- 8 个内置词本：职场高频、CET-4 核心、程序员英语、Basic English 850、CET-4 完整、CET-6 完整、考研英语、计算机英语
- 聊天式练习：根据释义和挖空例句猜单词
- 支持发音、错误提示、跳过和练习完成总结
- 支持 CSV / JSON 自定义词本导入、预览和校验
- 学习进度保存在浏览器本地，无需注册账号
- 提供可交互的 `chatwords` CLI，以及适合 Agent 调用的稳定 JSON 输出
- 提供全局有状态的 `$chatwords-learn` Skill，可跨对话继续上一次练习
- 支持浅色、深色主题和移动端布局

## Monorepo 结构

项目使用 pnpm workspace：

```text
apps/web                 Next.js Web 应用
packages/core            Web/CLI 共用的词本、答题和进度模块
packages/cli             chatwords 命令行工具
skills/chatwords-learn   包装 CLI 的有状态 Skill
```

答题判定、别名、错误次数、跳过和学习进度都由 `@chatwords/core` 统一处理。Web 使用浏览器 IndexedDB；CLI 和 Skill 共用 `~/.chatwords/state.json`。两边遵循同一套状态语义，但当前不会自动同步彼此的数据。

## Web 本地运行

需要 Node.js 和 pnpm：

```bash
pnpm install
pnpm dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 即可使用。

常用命令：

```bash
pnpm test       # 运行测试
pnpm lint       # 检查代码规范
pnpm typecheck  # 检查类型
pnpm build      # 构建生产版本
```

## 终端背单词

在仓库内可以直接运行：

```bash
pnpm cli -- books
pnpm cli -- study workplace
pnpm cli -- status
```

安装为全局 CLI 和 Skill：

```bash
pnpm skill:install
```

安装后可以在任意目录使用：

```bash
chatwords books
chatwords study workplace --size 20
chatwords status
```

交互输出会在支持颜色的终端中自动高亮当前题目、答题结果和学习进度；设置 `NO_COLOR=1` 可以关闭颜色。

CLI 的非交互命令都支持 `--json`，方便 Agent 稳定调用：

```bash
chatwords start workplace --json
chatwords current --json
chatwords answer organize --json
chatwords skip --json
chatwords status --json
```

Skill 安装在全局的 Codex/Agent Skills 目录中。重新打开任务后，可以直接说“用 `$chatwords-learn` 继续背单词”。Skill 不自行维护另一份记录，只通过 CLI 读写同一个全局状态文件。

## 自定义词本

在页面中打开 **Upload word book**，可以上传 CSV 或 JSON 文件，也可以直接下载 CSV 模板。

CSV 格式：

```csv
word,zh,en,example,phonetic,audio,aliases
abandon,放弃,to leave something completely,I ___ the old plan.,/əˈbændən/,,give up
```

其中 `word`、`zh`、`en`、`example` 为必填字段；多条释义或别名可以使用 `|` 或 `；` 分隔。

## 部署到 Cloudflare Workers

项目基于 Next.js 和 `@opennextjs/cloudflare`：

```bash
pnpm cf:build
pnpm cf:preview
npx wrangler whoami
pnpm cf:deploy
```

## 致谢

- 感谢[网易有道翻译](https://fanyi.youdao.com/)提供优秀的翻译与语言学习服务。
- 感谢 [Qwerty Learner](https://github.com/RealKai42/qwerty-learner) 开源项目带来的灵感与参考。

## 开源许可

本项目基于 [MIT License](LICENSE) 开源。
