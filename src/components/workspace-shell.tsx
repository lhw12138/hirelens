"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, LogOut } from "lucide-react";
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  return <div className="hl-app"><a className="hl-skip" href="#main-content">跳到主要内容</a>
    <header className="hl-header"><Link href="/" className="hl-brand">MeritTrace<span>招聘工作台</span></Link>
      <nav aria-label="主导航"><Link href="/" aria-current={path === "/" || path.startsWith("/tasks/") ? "page" : undefined}>招聘任务</Link><Link href="/records" aria-current={path === "/records" ? "page" : undefined}>操作记录</Link><Link href="/settings/mail" aria-current={path === "/settings/mail" ? "page" : undefined}>发信设置</Link><Link href="/health" aria-current={path === "/health" ? "page" : undefined}>系统状态</Link><Link href="/guide" aria-current={path === "/guide" ? "page" : undefined}>使用帮助 <ArrowUpRight size={13}/></Link></nav>
      <button className="hl-quiet hl-logout" onClick={async () => { const r=await fetch("/api/auth/logout",{method:"POST"}); if(r.ok){router.push("/login");router.refresh();} }} aria-label="退出登录"><LogOut size={17}/><span>退出</span></button>
    </header><main id="main-content" className="hl-main">{children}</main>
  </div>;
}
