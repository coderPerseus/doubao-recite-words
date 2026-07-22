import Link from "next/link";

export default function SourcesPage() {
  return <main className="info-page"><article className="info-card">
    <Link href="/">← 返回 chatWords</Link>
    <h1>数据来源</h1>
    <p>chatWords 将词典整理成静态文件随网页发布，学习时不会把你的答案发送到任何词典服务。</p>
    <h2>ECDICT</h2>
    <p>默认词本的中文释义、英文解释和部分音标来自 <a href="https://github.com/skywind3000/ECDICT" target="_blank" rel="noreferrer">ECDICT</a>，使用 MIT License。</p>
    <h2>Qwerty Learner 词本</h2>
    <p>计算机英语的选词来自 <a href="https://github.com/RealKai42/qwerty-learner/tree/master/public/dicts" target="_blank" rel="noreferrer">Qwerty Learner 公开词本</a>，并合并“计算机专用英语”与“Coder Dict”后去重。CET-4、CET-6 和考研词本的部分例句来自该项目所使用的公开词书数据。</p>
    <h2>Basic English 850</h2>
    <p>基础英语词本采用 C. K. Ogden 的 850 词体系，英美拼写变体会作为同一词条的可接受答案；中英释义、音标和例句再由现有词典数据补全。</p>
    <h2>Free Dictionary API</h2>
    <p>部分英文释义、例句和发音地址来自 <a href="https://dictionaryapi.dev/" target="_blank" rel="noreferrer">Free Dictionary API</a>。音频可能来自 Wiktionary，并采用对应条目标注的 Creative Commons 许可。</p>
    <h2>网易有道词典发音</h2>
    <p>单词发音优先使用有道词典公开的单词发音地址，默认播放美式发音。该用法参考了 <a href="https://github.com/RealKai42/qwerty-learner" target="_blank" rel="noreferrer">qwerty-learner</a> 的开源实现；它不是有道智云正式、带 SLA 的鉴权 API，服务可用性由有道词典决定。</p>
    <h2>发音降级</h2>
    <p>播放顺序为：有道美音、词条自带录音、浏览器优选英语 SpeechSynthesis 音色。最后一级不需要 API Key。</p>
  </article></main>;
}
