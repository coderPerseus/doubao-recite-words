import Link from "next/link";

export default function SourcesPage() {
  return <main className="info-page"><article className="info-card">
    <Link href="/">← 返回 chatWords</Link>
    <h1>数据来源</h1>
    <p>chatWords 将词典整理成静态文件随网页发布，学习时不会把你的答案发送到任何词典服务。</p>
    <h2>ECDICT</h2>
    <p>默认词本的中文释义、英文解释和部分音标来自 <a href="https://github.com/skywind3000/ECDICT" target="_blank" rel="noreferrer">ECDICT</a>，使用 MIT License。</p>
    <h2>Free Dictionary API</h2>
    <p>部分英文释义、例句和发音地址来自 <a href="https://dictionaryapi.dev/" target="_blank" rel="noreferrer">Free Dictionary API</a>。音频可能来自 Wiktionary，并采用对应条目标注的 Creative Commons 许可。</p>
    <h2>发音降级</h2>
    <p>当远程音频缺失或播放失败时，chatWords 使用浏览器自带的 SpeechSynthesis 朗读，不需要 API Key。</p>
  </article></main>;
}
