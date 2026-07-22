import Link from "next/link";

export default function PrivacyPage() {
  return <main className="info-page"><article className="info-card">
    <Link href="/">← 返回 chatWords</Link>
    <h1>隐私说明</h1>
    <p>chatWords 没有账号系统、数据库或行为追踪服务。</p>
    <ul>
      <li>学习进度、设置和自定义词本保存在当前浏览器的 IndexedDB 与 localStorage 中。</li>
      <li>上传的 CSV 或 JSON 文件只在本机浏览器中解析，不会上传到服务器。</li>
      <li>清除浏览器网站数据会同时清除学习记录，请自行保留自定义词本原文件。</li>
      <li>点击或预加载发音时，浏览器会向网易有道词典或词条中标注的公开音频地址请求当前英文单词；对方服务器会像普通网络请求一样接收到 IP、浏览器信息和所请求的单词。</li>
    </ul>
  </article></main>;
}
