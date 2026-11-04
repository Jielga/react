import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NORDIC_MAP_LABELS_SV } from "./labels.ts";
import type { MapPin } from "./mapItems.ts";
import type { MapLayers, MapSource } from "./mapSource.ts";
import { NordicMap } from "./NordicMap.tsx";
import type { NordicMapHandle } from "./NordicMap.tsx";

/**
 * jsdom has no canvas and no Path2D. The map still loads its data, places its pins and handles input, which is
 * what these tests cover; what it draws is covered by the Playwright specs.
 */
class Path2DStub {
  addPath() {}
}

const sweden: MapLayers = {
  land: [
    {
      type: "Polygon",
      coordinates: [
        [
          [11, 55],
          [11, 69],
          [24, 69],
          [24, 55],
          [11, 55],
        ],
      ],
    },
  ],
  water: [],
  borders: [],
  roads: [],
};

const source: MapSource = {
  extent: { west: 11, south: 55, east: 24, north: 69 },
  centralMeridian: 15,
  levels: [{ minZoom: 1, cellSize: 360 }],
  loadCell: async () => {
    return sweden;
  },
};

const failingSource: MapSource = {
  ...source,
  loadCell: async () => {
    throw new Error("offline");
  },
};

const pins: MapPin<{ office: number }>[] = [
  { id: "sto", lat: 59.33, lon: 18.07, label: "Stockholm", data: { office: 1 } },
  { id: "got", lat: 57.71, lon: 11.97, label: "Göteborg", data: { office: 2 } },
  { id: "kir", lat: 67.86, lon: 20.23, label: "Kiruna", data: { office: 3 } },
];

beforeEach(() => {
  vi.stubGlobal("Path2D", Path2DStub);
  // jsdom reports every canvas call as "not implemented" through console.error
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function shown() {
  await waitFor(() => {
    expect(screen.queryByRole("status", { name: "Loading map" })).toBeNull();
  });
}

describe("NordicMap", () => {
  it("names the map and leaves the loader once the data is in", async () => {
    render(<NordicMap source={source} label="Offices" />);
    expect(screen.getByRole("application", { name: "Offices" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading map" })).toBeInTheDocument();
    await shown();
  });

  it("shows the error text when the map data can not be loaded", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<NordicMap source={failingSource} labels={{ loadError: "No map today." }} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No map today.");
    expect(error).toHaveBeenCalled();
  });

  it("takes its texts from labels", async () => {
    render(<NordicMap source={source} labels={NORDIC_MAP_LABELS_SV} />);
    await shown();
    expect(screen.getByRole("application", { name: "Karta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zooma in" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Zooma ut" })).toBeDisabled();
  });

  it("gives every pin on screen a button that selects it", async () => {
    const onSelectionChange = vi.fn();
    const onPinClick = vi.fn();
    render(<NordicMap source={source} pins={pins} onSelectionChange={onSelectionChange} onPinClick={onPinClick} />);
    await shown();
    const stockholm = screen.getByRole("button", { name: "Stockholm" });
    expect(stockholm).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(stockholm);
    expect(onSelectionChange).toHaveBeenLastCalledWith(["sto"]);
    expect(onPinClick).toHaveBeenCalledWith(pins[0]);
    expect(screen.getByRole("button", { name: "Stockholm" })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "Kiruna" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(["sto", "kir"]);
  });

  it("keeps a single pin selected in single mode", async () => {
    const onSelectionChange = vi.fn();
    render(<NordicMap source={source} pins={pins} selectionMode="single" onSelectionChange={onSelectionChange} />);
    await shown();
    await userEvent.click(screen.getByRole("button", { name: "Stockholm" }));
    await userEvent.click(screen.getByRole("button", { name: "Kiruna" }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(["kir"]);
  });

  it("does not select in none mode, and still reports the click", async () => {
    const onSelectionChange = vi.fn();
    const onPinClick = vi.fn();
    render(
      <NordicMap
        source={source}
        pins={pins}
        selectionMode="none"
        onSelectionChange={onSelectionChange}
        onPinClick={onPinClick}
      />,
    );
    await shown();
    const stockholm = screen.getByRole("button", { name: "Stockholm" });
    expect(stockholm).not.toHaveAttribute("aria-pressed");
    await userEvent.click(stockholm);
    expect(onPinClick).toHaveBeenCalledWith(pins[0]);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("reports the pin with keyboard focus as hovered", async () => {
    const onPinHover = vi.fn();
    render(<NordicMap source={source} pins={pins} onPinHover={onPinHover} />);
    await shown();
    await userEvent.tab();
    expect(screen.getByRole("application")).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Stockholm" })).toHaveFocus();
    expect(onPinHover).toHaveBeenLastCalledWith(pins[0]);
  });

  it("leaves hidden pins out of the keyboard order", async () => {
    render(<NordicMap source={source} pins={pins} showPins={{ minZoom: 4 }} />);
    await shown();
    expect(screen.queryByRole("button", { name: "Stockholm" })).toBeNull();
  });

  it("joins close pins into a cluster", async () => {
    const close: MapPin[] = [
      { id: "a", lat: 59.33, lon: 18.07, label: "A" },
      { id: "b", lat: 59.34, lon: 18.08, label: "B" },
    ];
    render(<NordicMap source={source} pins={close} cluster />);
    await shown();
    expect(screen.getByRole("button", { name: "2 pins" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "A" })).toBeNull();
  });

  it("reports its view, and queues a camera move made before the data is in", async () => {
    const ref = createRef<NordicMapHandle>();
    const onViewChange = vi.fn();
    render(<NordicMap ref={ref} source={source} pins={pins} onViewChange={onViewChange} />);
    expect(ref.current?.getView()).toBeNull();
    ref.current?.flyTo({ lat: 59.33, lon: 18.07, zoom: 8 });
    await shown();
    await waitFor(() => {
      expect(ref.current?.getView()?.zoom).toBe(8);
    });
    const view = ref.current?.getView();
    expect(view?.center.lat).toBeCloseTo(59.33, 1);
    expect(view?.center.lon).toBeCloseTo(18.07, 1);
    expect(onViewChange).toHaveBeenLastCalledWith(view);
  });

  it("converts between positions and points on screen", async () => {
    const ref = createRef<NordicMapHandle>();
    render(<NordicMap ref={ref} source={source} />);
    expect(ref.current?.project({ lat: 59.33, lon: 18.07 })).toBeNull();
    expect(ref.current?.unproject({ x: 0, y: 0 })).toBeNull();
    await shown();
    ref.current?.flyTo({ lat: 59.33, lon: 18.07, zoom: 8 }, { animate: false });
    await waitFor(() => {
      expect(ref.current?.getView()?.zoom).toBe(8);
    });
    // The setup gives every element a 1200 × 600 box, so the middle of the view is at 600, 300
    const middle = ref.current?.project({ lat: 59.33, lon: 18.07 });
    expect(middle?.x).toBeCloseTo(600, 0);
    expect(middle?.y).toBeCloseTo(300, 0);
    const position = ref.current?.unproject({ x: 100, y: 450 });
    const back = position ? ref.current?.project(position) : null;
    expect(back?.x).toBeCloseTo(100, 6);
    expect(back?.y).toBeCloseTo(450, 6);
  });
});
