import { REFERENCE_NAME, referenceSlug } from "./headings";

/** The part of a hast node this plugin reads and writes. */
type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Array<HastNode>;
};

function elements(node: HastNode, tagName: string): Array<HastNode> {
  return (node.children ?? []).filter(
    (child) => child.type === "element" && child.tagName === tagName,
  );
}

function text(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(text).join("");
}

/** The name a cell holds when its whole content is one inline `code`. */
function cellName(cell: HastNode): string | undefined {
  const content = (cell.children ?? []).filter(
    (child) => !(child.type === "text" && !child.value?.trim()),
  );
  const [only] = content;
  if (content.length !== 1 || only.tagName !== "code") return undefined;
  const name = text(only);
  return REFERENCE_NAME.test(name) ? name : undefined;
}

/**
 * Two things for every markdown table, done on the tree so the markdown stays
 * plain tables:
 *
 * - every body cell carries its column's header as `data-label`, which the
 *   stacked layout on a narrow page prints above the value
 * - a row whose first cell names a symbol gets the symbol's `ref-` anchor as
 *   its `id`, and a `#` link to itself after the name, so search and a pasted
 *   link land on the row, not on the top of the table
 *
 * The first row to name a symbol takes the anchor; a later one on the same
 * page would repeat the `id`.
 */
export function rehypeReferenceRows({ anchorClass }: { anchorClass: string }) {
  return (tree: HastNode) => {
    const seen = new Set<string>();

    const visit = (node: HastNode) => {
      if (node.tagName !== "table") {
        node.children?.forEach(visit);
        return;
      }

      const [head] = elements(node, "thead");
      const [headRow] = head ? elements(head, "tr") : [];
      const labels = headRow ? elements(headRow, "th").map(text) : [];

      for (const body of elements(node, "tbody")) {
        for (const row of elements(body, "tr")) {
          const cells = elements(row, "td");
          cells.forEach((cell, index) => {
            if (labels[index]) {
              cell.properties = {
                ...cell.properties,
                dataLabel: labels[index],
              };
            }
          });

          const name = cells[0] && cellName(cells[0]);
          if (!name) continue;
          const slug = referenceSlug(name);
          if (seen.has(slug)) continue;
          seen.add(slug);

          row.properties = { ...row.properties, id: slug };
          cells[0].children = [
            ...(cells[0].children ?? []),
            {
              type: "element",
              tagName: "a",
              properties: {
                href: `#${slug}`,
                className: [anchorClass],
                ariaLabel: `Link to ${name}`,
              },
              children: [{ type: "text", value: "#" }],
            },
          ];
        }
      }
    };

    visit(tree);
  };
}
