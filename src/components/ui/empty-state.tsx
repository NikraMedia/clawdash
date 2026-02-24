import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
    ...props
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "group relative flex min-h-[400px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-8 text-center shadow-inner ring-1 ring-inset ring-white/5 transition-all animate-in fade-in duration-700",
                className
            )}
            {...props}
        >
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/10 to-transparent opacity-50" />
            <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-900 ring-1 ring-zinc-800/80 shadow-[0_0_20px_rgba(255,255,255,0.02)] transition-transform duration-500 group-hover:scale-105">
                <Icon className="h-8 w-8 text-zinc-500 transition-colors duration-500 group-hover:text-zinc-400" strokeWidth={1.5} />
            </div>
            <h3 className="relative mt-2 text-lg font-semibold tracking-tight text-zinc-200">{title}</h3>
            {description && (
                <p className="relative mt-2 max-w-sm text-sm text-zinc-500 leading-relaxed">{description}</p>
            )}
            {action && <div className="relative mt-8">{action}</div>}
        </div>
    );
}
