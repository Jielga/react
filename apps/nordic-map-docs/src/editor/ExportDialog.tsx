import { Alert, Button, CopyButton, Group, Loader, Modal, SegmentedControl, Stack, Switch, Text, Textarea } from "@mantine/core";
import { IconCheck, IconCopy, IconDownload } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { loadSwedenCounties } from "@jielga/nordic-map";
import { EXPORT_DECIMALS, exportAreas, FILE_NAMES } from "./areaFiles.ts";
import type { ExportFormat } from "./areaFiles.ts";
import { partsFromGeometry } from "./editorModel.ts";
import type { EditorArea, Part } from "./editorModel.ts";
import { clipParts } from "./shapeOps.ts";

type Clipped = { source: EditorArea[]; areas: EditorArea[]; atSea: string[] } | { source: EditorArea[]; error: string };

function download({ text, fileName }: { text: string; fileName: string }) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function clipToLand({ areas, land }: { areas: EditorArea[]; land: Part[][] }): Clipped {
  try {
    const atSea: string[] = [];
    const clipped = areas.flatMap((area) => {
      if (area.parts.length === 0) {
        return [];
      }
      const parts = clipParts({ parts: area.parts, land });
      if (parts.length === 0) {
        atSea.push(area.label || area.id);
        return [];
      }
      return [{ ...area, parts }];
    });
    return { source: areas, areas: clipped, atSea };
  } catch (error) {
    return { source: areas, error: `Could not clip the areas: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** The areas as a TypeScript module, MapArea JSON or GeoJSON, to copy or download */
export function ExportDialog({ opened, onClose, areas }: { opened: boolean; onClose: () => void; areas: EditorArea[] }) {
  const [format, setFormat] = useState<ExportFormat>("typescript");
  const [clip, setClip] = useState(false);
  const [clipped, setClipped] = useState<Clipped | null>(null);

  useEffect(() => {
    if (!opened || !clip) {
      return;
    }
    let cancelled = false;
    void loadSwedenCounties().then(
      (counties) => {
        if (cancelled) {
          return;
        }
        const land = counties.map((county) => {
          return partsFromGeometry(county.geometry);
        });
        setClipped(clipToLand({ areas, land }));
      },
      (reason: unknown) => {
        if (!cancelled) {
          setClipped({ source: areas, error: `Could not load the land: ${reason instanceof Error ? reason.message : String(reason)}` });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [opened, clip, areas]);

  const current = clip && clipped?.source === areas ? clipped : null;
  const exported = clip ? (current && "areas" in current ? current.areas : null) : areas;
  const text = exported ? exportAreas({ areas: exported, format }) : "";
  const empty = areas.filter((area) => {
    return area.parts.length === 0;
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Export areas" size="xl">
      <Stack gap="sm">
        <SegmentedControl
          value={format}
          onChange={(value) => {
            setFormat(value as ExportFormat);
          }}
          data={[
            { value: "typescript", label: "TypeScript" },
            { value: "json", label: "MapArea JSON" },
            { value: "geojson", label: "GeoJSON" },
          ]}
        />
        <Text size="sm" c="dimmed">
          {format === "geojson"
            ? "A FeatureCollection with id, label, fill and stroke in each feature's properties, for GIS tools. The area editor can import it again."
            : "A MapArea[] list to pass to the areas prop of NordicMap."}{" "}
          Positions are rounded to {EXPORT_DECIMALS} decimals, about 1 m.
        </Text>
        <Switch
          label="Clip to Sweden's land"
          description="Cuts away the parts of each area that lie in the sea or outside Sweden."
          checked={clip}
          onChange={(event) => {
            setClip(event.currentTarget.checked);
          }}
        />
        {empty.length > 0 && (
          <Alert color="gray">Left out, because they have no shape: {empty.map((area) => area.label || area.id).join(", ")}</Alert>
        )}
        {current && "atSea" in current && current.atSea.length > 0 && (
          <Alert color="yellow">Left out, because they lie entirely outside the land: {current.atSea.join(", ")}</Alert>
        )}
        {current && "error" in current && <Alert color="red">{current.error}</Alert>}
        {clip && !current ? (
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm">Clipping to the land…</Text>
          </Group>
        ) : (
          <Textarea
            aria-label="Exported areas"
            value={text}
            readOnly
            rows={16}
            styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12, whiteSpace: "pre", overflowWrap: "normal" } }}
          />
        )}
        <Group justify="flex-end">
          <CopyButton value={text}>
            {({ copied, copy }) => {
              return (
                <Button variant="default" leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy} disabled={text === ""}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              );
            }}
          </CopyButton>
          <Button
            leftSection={<IconDownload size={16} />}
            disabled={text === ""}
            onClick={() => {
              download({ text, fileName: FILE_NAMES[format] });
            }}
          >
            Download {FILE_NAMES[format]}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
