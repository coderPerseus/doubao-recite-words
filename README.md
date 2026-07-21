# chatWords

一个藏在 ChatGPT 风格聊天页面里的本地背单词工具。AI 回复是中文释义、英文解释和挖空例句，用户在输入框中猜出对应单词。

## 功能

- 3 个内置词本：职场高频 300、CET-4 核心 500、程序员英语 300
- CSV / JSON 自定义词本导入、预览与校验
- 发音音频与浏览器 SpeechSynthesis 降级
- 练习队列、错误提示、跳过、完成总结与本地进度
- 浅色、深色、手机侧栏适配
- 无账号、无数据库、无业务后端

## 本地开发

```bash
pnpm install
pnpm dev
```

质量检查：

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

## Cloudflare Workers

项目使用 `@opennextjs/cloudflare`：

```bash
pnpm cf:build
pnpm cf:preview
npx wrangler whoami
pnpm cf:deploy
```

Worker 名为 `chatwords`，默认发布到当前 Cloudflare 账号的 `workers.dev`。

## 自定义词本

CSV 列：

```text
word,zh,en,example,phonetic,audio,aliases
```

其中 `word`、`zh`、`en`、`example` 必填，多条释义或别名使用 `|` 或 `；` 分隔。页面的 Upload word book 对话框可以直接下载模板。

## 词典来源

- [ECDICT](https://github.com/skywind3000/ECDICT)，MIT License
- [Free Dictionary API](https://dictionaryapi.dev/)，用于补充部分英文释义、例句和发音
- 浏览器 [SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/Window/speechSynthesis)，作为免费发音降级

`pnpm dict:build` 会重新整理词典。正常产品构建直接使用已经生成在 `public/data` 的轻量 JSON，不依赖在线词典服务。
