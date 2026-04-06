import ReactMarkdown from "react-markdown";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-1 ml-4 list-disc last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-1 ml-4 list-decimal last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        code: ({ children }) => (
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-700">
            {children}
          </code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
