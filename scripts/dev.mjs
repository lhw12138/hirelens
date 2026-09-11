import { spawn } from "node:child_process";
import path from "node:path";

try { process.loadEnvFile?.(".env"); } catch {}

let stopping = false;
const children = new Set();

function launch(name, args, restart = true) {
  const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
  children.add(child);
  child.on("exit", (code) => {
    children.delete(child);
    if (stopping) return;
    if (name === "web") return shutdown(code ?? 0);
    console.error(`[HireLens] ${name} stopped; restarting in 1.5 seconds.`);
    if (restart) setTimeout(() => { if (!stopping) launch(name, args, restart); }, 1500);
  });
  return child;
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 300).unref();
}

if ((process.env.RAG_MODE || "hybrid") === "hybrid") launch("local RAG", ["--env-file=.env", "scripts/local-embeddings.mjs"]);
launch("scoring worker", ["--env-file=.env", "--conditions=react-server", "--import", "tsx", "scripts/scoring-worker.ts"]);
launch("evaluation worker", ["--env-file=.env", "--conditions=react-server", "--import", "tsx", "scripts/eval-worker.ts"]);
launch("web", [path.join("node_modules", "next", "dist", "bin", "next"), "dev", ...process.argv.slice(2)], false);

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
