import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CodeBlockProps {
    language?: string;
    value: string;
    className?: string;
}

export function CodeBlock({ language = "json", value, className }: CodeBlockProps) {
    const [copied, setCopied] = React.useState(false);

    const onCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={cn("group relative rounded-lg bg-[#1d1f21] border border-zinc-800/60 overflow-hidden shadow-inner", className)}>
            <div className="absolute right-3 top-3 z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 backdrop-blur-sm"
                    onClick={onCopy}
                >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    <span className="sr-only">Copy code</span>
                </Button>
            </div>
            <div className="max-h-[500px] overflow-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                <SyntaxHighlighter
                    language={language}
                    style={atomDark}
                    customStyle={{
                        margin: 0,
                        padding: "1.5rem",
                        background: "transparent",
                        fontSize: "0.875rem",
                        lineHeight: "1.5",
                    }}
                    wrapLongLines={false}
                >
                    {value}
                </SyntaxHighlighter>
            </div>
        </div>
    );
}
