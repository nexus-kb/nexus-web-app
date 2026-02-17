interface PaneEmptyStateProps {
  kicker: string;
  title: string;
  description: string;
}

export function PaneEmptyState({ kicker, title, description }: PaneEmptyStateProps) {
  return (
    <div className="pane-empty">
      <p className="pane-kicker">{kicker}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
