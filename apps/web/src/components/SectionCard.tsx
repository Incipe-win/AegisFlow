import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function SectionCard({
  title,
  description,
  children,
}: SectionCardProps) {
  return (
    <section className="section-card">
      <header className="section-header">
        <div>
          <p className="eyebrow">Module</p>
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}

