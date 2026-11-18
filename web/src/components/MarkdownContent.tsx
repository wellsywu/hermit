import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import SyntaxHighlighter from 'react-syntax-highlighter'
import {
  atomOneDark,
  atomOneLight,
} from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { useTheme } from '#/hooks/useTheme'
import { stripFrontMatter } from '#/lib/skill-files'

export function useCodeTheme() {
  const { isDark } = useTheme()
  return isDark ? atomOneDark : atomOneLight
}

export function MarkdownContent({
  content,
  stripHeading = false,
}: {
  content: string
  /** Drop the YAML front matter block before rendering. */
  stripHeading?: boolean
}) {
  const codeTheme = useCodeTheme()
  const rendered = stripHeading ? stripFrontMatter(content) : content
  return (
    <div className="prose prose-sm sm:prose-base max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({ node, className, children, ...props }) => {
            const lang = /language-([\w-]+)/.exec(className ?? '')?.[1]
            const text = String(children)
            if (!lang && !text.includes('\n')) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <SyntaxHighlighter
                language={lang ?? 'plaintext'}
                style={codeTheme}
                customStyle={{
                  margin: 0,
                  padding: '0.875rem 1rem',
                  background: 'transparent',
                  fontSize: '0.8125rem',
                  lineHeight: 1.6,
                }}
                codeTagProps={{ style: { fontFamily: 'inherit' } }}
                PreTag="div"
              >
                {text.replace(/\n$/, '')}
              </SyntaxHighlighter>
            )
          },
          pre: ({ children }) => (
            <div className="code-surface not-prose my-4 overflow-x-auto rounded-field border border-base-300 font-mono">
              {children}
            </div>
          ),
          a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} />
            </div>
          ),
        }}
      >
        {rendered}
      </ReactMarkdown>
    </div>
  )
}
