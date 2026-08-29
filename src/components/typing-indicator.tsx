export function TypingIndicator({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-foreground-muted" role="status" aria-label={label}>
      <span className="typing-indicator-dot" aria-hidden="true" />
      <span className="typing-indicator-dot" aria-hidden="true" />
      <span className="typing-indicator-dot" aria-hidden="true" />
    </span>
  );
}
