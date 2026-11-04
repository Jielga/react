import { Anchor, Button, Group, Stack, Switch, Text } from "@mantine/core";
import { IconUpload } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { EditorArea } from "../../editor/editorModel.ts";
import { ImportDialog } from "../../editor/ImportDialog.tsx";

/** The areas saved in the area editor behind a switch, and areas imported from a file */
export function CustomAreasControl({
  stored,
  showStored,
  onShowStoredChange,
  imported,
  onImport,
  onClearImported,
}: {
  stored: EditorArea[];
  showStored: boolean;
  onShowStoredChange: (show: boolean) => void;
  imported: EditorArea[];
  onImport: (areas: EditorArea[]) => void;
  onClearImported: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const editorLink = (
    <Anchor component={Link} to="/editor" size="xs">
      area editor
    </Anchor>
  );

  return (
    <Stack gap="xs" pt="sm">
      <Switch
        size="sm"
        label="My areas"
        description={
          stored.length === 0 ? (
            <>None saved yet. Draw some in the {editorLink}.</>
          ) : (
            <>
              {stored.length} {stored.length === 1 ? "area" : "areas"} from the {editorLink}
            </>
          )
        }
        disabled={stored.length === 0}
        checked={showStored && stored.length > 0}
        onChange={(event) => {
          onShowStoredChange(event.currentTarget.checked);
        }}
      />
      <Group gap="xs">
        <Button
          size="xs"
          variant="default"
          leftSection={<IconUpload size={14} />}
          onClick={() => {
            setImporting(true);
          }}
        >
          Import areas
        </Button>
        {imported.length > 0 && (
          <>
            <Text size="xs" c="dimmed">
              {imported.length} imported
            </Text>
            <Button size="compact-xs" variant="subtle" onClick={onClearImported}>
              Clear
            </Button>
          </>
        )}
      </Group>
      <ImportDialog
        opened={importing}
        onClose={() => {
          setImporting(false);
        }}
        takenIds={imported.map((area) => {
          return area.id;
        })}
        onImport={(areas) => {
          onImport(areas);
        }}
      />
    </Stack>
  );
}
