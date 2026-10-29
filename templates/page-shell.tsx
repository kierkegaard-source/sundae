import type { ReactNode } from "react";

// __PLACEHOLDER__: import every section that has exactly one version.
import { TrustedBy } from "@/components/home/trusted-by";
import { Products } from "@/components/home/products";

/**
 * The page order, with every section that has more than one version passed in
 * as a prop. The public route supplies the shipped versions and /preview
 * supplies whatever the panel has selected, so neither can drift from the other
 * when a section is added, removed, or moved.
 *
 * Do not let either route re-declare this order. That drift is the whole reason
 * this component exists.
 */
export function PageShell({
  hero,
  footer,
}: {
  hero: ReactNode;
  footer: ReactNode;
}) {
  return (
    <>
      {hero}
      <TrustedBy />
      <Products />
      {footer}
    </>
  );
}
