import type { PropsWithChildren, ReactNode } from "react";

type SectionCardProps = PropsWithChildren<{
  title: string;
  kicker?: string;
  action?: ReactNode;
  className?: string;
}>;

export function SectionCard({ title, kicker, action, className, children }: SectionCardProps) {
  return (
    <section className={`section-card ${className ?? ""}`.trim()}>
      <div className="section-card-header">
        <div>
          {kicker ? <p className="eyebrow">{kicker}</p> : null}
          <h3>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
