import { useEffect, useMemo, useState } from "react";
import { codeToHtml, type BundledLanguage, type SpecialLanguage } from "shiki";
import { cx } from "./ui";

type CodeLang = BundledLanguage | SpecialLanguage;

const LANG_ALIASES: Record<string, CodeLang> = {
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "tsx",
  mts: "typescript",
  cts: "typescript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  php: "php",
  cs: "csharp",
  csharp: "csharp",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  c: "c",
  h: "c",
  hpp: "cpp",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  shell: "bash",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  md: "markdown",
  markdown: "markdown",
  sql: "sql",
  html: "html",
  css: "css",
  scss: "scss",
  vue: "vue",
  svelte: "svelte",
  graphql: "graphql",
  dockerfile: "dockerfile",
  docker: "dockerfile",
  xml: "xml",
  text: "plaintext",
  txt: "plaintext",
  plain: "plaintext",
};

function resolveLang(language?: string | null, path?: string | null): CodeLang {
  const raw = (language ?? "").trim().toLowerCase();
  if (raw && LANG_ALIASES[raw]) return LANG_ALIASES[raw];
  if (raw) return raw as BundledLanguage;
  if (path) {
    const base = path.split(/[\\/]/).pop() ?? "";
    if (/^dockerfile$/i.test(base)) return "dockerfile";
    const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : "";
    if (ext && LANG_ALIASES[ext]) return LANG_ALIASES[ext];
  }
  return "typescript";
}

export function CodeBlock({
  code,
  language,
  path,
  startLine,
  className,
  showChrome = true,
}: {
  code: string;
  language?: string | null;
  path?: string | null;
  startLine?: number | null;
  className?: string;
  /** Language/path bar above the code. Off when the parent already shows that. */
  showChrome?: boolean;
}) {
  const lang = useMemo(() => resolveLang(language, path), [language, path]);
  const lines = useMemo(() => code.replace(/\n$/, "").split("\n"), [code]);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    void codeToHtml(code, {
      lang,
      theme: "github-dark",
    })
      .then((out) => {
        if (!cancelled) setHtml(out);
      })
      .catch(async () => {
        try {
          const out = await codeToHtml(code, {
            lang: "plaintext",
            theme: "github-dark",
          });
          if (!cancelled) setHtml(out);
        } catch {
          if (!cancelled) setHtml(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const showLines = startLine != null && startLine > 0;

  return (
    <div className={cx("code-block relative overflow-hidden bg-[#0d1117]", className)}>
      {showChrome && (
        <div className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">
            {lang}
          </span>
          {path && (
            <span className="truncate font-mono text-[10px] text-white/35">{path}</span>
          )}
        </div>
      )}
      <div className="flex overflow-x-auto">
        {showLines && (
          <div
            aria-hidden
            className="sticky left-0 select-none border-r border-white/5 bg-[#0d1117] px-2 py-3 text-right font-mono text-[11px] leading-[1.55] text-white/25"
          >
            {lines.map((_, i) => (
              <div key={i}>{startLine! + i}</div>
            ))}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {html ? (
            <div
              className="code-block-shiki [&_pre]:m-0 [&_pre]:!bg-transparent [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[12px] [&_pre]:leading-[1.55] [&_code]:font-mono"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <pre className="m-0 p-3 font-mono text-[12px] leading-[1.55] text-[#e6edf3]">
              {code}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
