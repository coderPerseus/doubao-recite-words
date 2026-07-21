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
      <li>点击发音时，浏览器可能访问词条中标注的公开音频地址。</li>
    </ul>
  </article></main>;
}
