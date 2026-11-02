import { describe, expect, it } from "vitest";
import { rehypeReferenceRows } from "./referenceRows";

type Node = Parameters<ReturnType<typeof rehypeReferenceRows>>[0];

const el = (tagName: string, children: Array<Node>): Node => ({
  type: "element",
  tagName,
  properties: {},
  children,
});
const text = (value: string): Node => ({ type: "text", value });
const code = (value: string) => el("code", [text(value)]);

function table(...rows: Array<Array<Node>>): Node {
  return el("table", [
    el("thead", [el("tr", [el("th", [text("Name")]), el("th", [text("Type")])])]),
    el(
      "tbody",
      rows.map((cells) => el("tr", cells.map((cell) => el("td", [cell])))),
    ),
  ]);
}

function run(tree: Node): Node {
  rehypeReferenceRows({ anchorClass: "anchor" })(tree);
  return tree;
}

const rows = (tree: Node) => tree.children![1].children!;

describe("rehypeReferenceRows", () => {
  it("anchors a row whose first cell names a symbol, and links to it", () => {
    const tree = run(table([code("selectionMode"), code("string")]));
    const [row] = rows(tree);
    expect(row.properties?.id).toBe("ref-selectionMode");
    const link = row.children![0].children![1];
    expect(link.properties).toMatchObject({
      href: "#ref-selectionMode",
      className: ["anchor"],
    });
  });

  it("drops the leading dashes of a CSS variable from the anchor", () => {
    const [row] = rows(run(table([code("--dg-row-selected-bg"), text("colour")])));
    expect(row.properties?.id).toBe("ref-dg-row-selected-bg");
  });

  it("leaves a row alone that leads with a value or with prose", () => {
    const tree = run(
      table([code("{ updated, created }"), text("x")], [text("Plain"), text("x")]),
    );
    expect(rows(tree).map((row) => row.properties?.id)).toEqual([undefined, undefined]);
  });

  it("gives a name's anchor to its first row only", () => {
    const tree = run(table([code("rows"), text("a")], [code("rows"), text("b")]));
    expect(rows(tree).map((row) => row.properties?.id)).toEqual(["ref-rows", undefined]);
  });

  it("labels every body cell with its column header", () => {
    const [row] = rows(run(table([code("selectionMode"), code("string")])));
    expect(row.children!.map((cell) => cell.properties?.dataLabel)).toEqual([
      "Name",
      "Type",
    ]);
  });
});
