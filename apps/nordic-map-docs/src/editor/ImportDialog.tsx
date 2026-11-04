import { Alert, Button, FileButton, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { IconUpload } from "@tabler/icons-react";
import { useState } from "react";
import { parseAreas } from "./areaFiles.ts";
import type { EditorArea } from "./editorModel.ts";

/** Reads areas from pasted text or a file, and adds them */
export function ImportDialog({
  opened,
  onClose,
  takenIds,
  onImport,
}: {
  opened: boolean;
  onClose: () => void;
  takenIds: string[];
  onImport: (areas: EditorArea[], skipped: number) => void;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function close() {
    setInput("");
    setError(null);
    onClose();
  }

  return (
    <Modal opened={opened} onClose={close} title="Import areas" size="xl">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Paste a MapArea list, a TypeScript file exported from the area editor, or GeoJSON: a FeatureCollection, a Feature, or a Polygon or MultiPolygon. The areas are added to the ones you have; an id that is already taken gets a number.
        </Text>
        <Textarea
          aria-label="Areas to import"
          value={input}
          onChange={(event) => {
            setInput(event.currentTarget.value);
            setError(null);
          }}
          rows={14}
          placeholder='[{ "id": "north", "label": "North", "geometry": { "type": "Polygon", "coordinates": [...] } }]'
          styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)", fontSize: 12, whiteSpace: "pre", overflowWrap: "normal" } }}
        />
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="space-between">
          <FileButton
            accept=".json,.geojson,.ts,application/json,application/geo+json"
            onChange={(file) => {
              if (file) {
                void file.text().then((content) => {
                  setInput(content);
                  setError(null);
                });
              }
            }}
          >
            {(props) => {
              return (
                <Button variant="default" leftSection={<IconUpload size={16} />} {...props}>
                  Open a file
                </Button>
              );
            }}
          </FileButton>
          <Button
            disabled={input.trim() === ""}
            onClick={() => {
              const result = parseAreas({ input, takenIds });
              if ("error" in result) {
                setError(result.error);
                return;
              }
              if (result.areas.length === 0) {
                setError("Found no Polygon or MultiPolygon to import.");
                return;
              }
              onImport(result.areas, result.skipped);
              close();
            }}
          >
            Add areas
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
