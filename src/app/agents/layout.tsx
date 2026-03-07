export default function AgentsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-1 h-full w-full bg-zinc-950 relative overflow-hidden min-h-0 min-w-0">
            {children}
        </div>
    );
}
