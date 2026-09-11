import type { Metadata } from "next";
import "./globals.css";
import "./product-surfaces.css";
import "./data-surfaces.css";
import "./login.css";
import "./workflow.css";

export const metadata: Metadata = {
  title: "HireLens · 招聘 Agent 评测与决策工作台",
  description: "证据可追溯、人工可校准的招聘决策辅助工作台。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
