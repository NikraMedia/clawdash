export default function SessionsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // The session data query has been moved to the global sidebar
    // This layout now just ensures the content fills the height properly
    return (
        <div className="flex flex-1 h-full w-full bg-zinc-950 relative overflow-hidden min-h-0 min-w-0">
            {children}
        </div>
    );
}
