import Link from "next/link";

export default function NotFound() {
  return <main className="info-page"><article className="info-card"><Link href="/">← 返回 chatWords</Link><h1>这个对话不存在</h1><p>可能是链接写错了，或者本地会话已经被清除。</p></article></main>;
}
