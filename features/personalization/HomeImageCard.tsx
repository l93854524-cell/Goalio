import type { ReactNode } from "react";
import type { HomeBlock } from "./usePersonalization";

export function HomeImageCard({ block, label, image, children, className = "" }: {
  block: HomeBlock; label: string; image?: string; children: ReactNode; className?: string;
}) {
  return (
    <section className={`home-image-card ${className}`.trim()} data-home-block={block} data-has-image={!!image} aria-label={label}>
      {image && <div className="card-background" aria-hidden="true" style={{ backgroundImage: `url("${image}")` }} />}
      {children}
    </section>
  );
}
