import { Kbd, UnstyledButton } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { SiteHeader } from "docs-shell/SiteHeader.tsx";
import classes from "./AppHeader.module.css";

/**
 * The shared site header, with the grid's mark and its search.
 *
 * The search button is styled as an input rather than being one. A real input
 * here would take focus on click and then have to hand it to the palette's own
 * field; a button opens the palette and the palette handles the typing.
 */

const GRID_GLYPH_CELLS = [
  [3, 3],
  [11, 3],
  [3, 11],
  [11, 11],
] as const;

/** A four-cell grid - the product, at 22px. */
function BrandMark() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 22 22"
      aria-hidden
      className={classes.mark}
    >
      <rect x={1} y={1} width={20} height={20} rx={4} className={classes.markFrame} />
      {GRID_GLYPH_CELLS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={8} height={8} rx={1.5} />
      ))}
    </svg>
  );
}

export function AppHeader({ onSearch }: { onSearch: () => void }) {
  return (
    <SiteHeader site="tmdatagrid" mark={<BrandMark />}>
      <UnstyledButton
        onClick={onSearch}
        className={classes.search}
        aria-label="Search the documentation"
      >
        <IconSearch size={15} stroke={1.8} />
        <span className={classes.searchLabel}>Search…</span>
        {/* Not a hint anyone has to have read: the palette answers Ctrl+K
            whether or not this is on screen. */}
        <Kbd size="xs" className={classes.shortcut}>
          Ctrl K
        </Kbd>
      </UnstyledButton>
    </SiteHeader>
  );
}
