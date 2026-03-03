import { EmptyState } from "@nexus/design-system";

interface PaneEmptyStateProps {
  kicker: string;
  title: string;
  description: string;
}

export function PaneEmptyState({ kicker, title, description }: PaneEmptyStateProps) {
  return <EmptyState kicker={kicker} title={title} description={description} className="pane-empty" />;
}
