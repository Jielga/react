import { Button, ColorInput, Group, Stack, TextInput } from "@mantine/core";
import { IconFocus2, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { SWATCHES } from "./areaColors.ts";
import type { EditorArea } from "./editorModel.ts";

/** A text field that changes the area when it loses focus or on Enter, so typing a word is one undo step */
function CommitInput({
  label,
  value,
  validate,
  onCommit,
  description,
}: {
  label: string;
  value: string;
  validate?: (draft: string) => string | null;
  onCommit: (value: string) => void;
  description?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  // The area changed from outside, for example by undo
  if (shown !== value) {
    setShown(value);
    setDraft(value);
  }
  const error = validate?.(draft) ?? null;
  const commit = () => {
    if (error === null && draft !== value) {
      onCommit(draft);
    }
  };
  return (
    <TextInput
      label={label}
      description={description}
      value={draft}
      error={error}
      onChange={(event) => {
        setDraft(event.currentTarget.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit();
        } else if (event.key === "Escape") {
          setDraft(value);
        }
      }}
    />
  );
}

export function AreaDetails({
  area,
  takenIds,
  onChange,
  onZoomTo,
  onDelete,
}: {
  area: EditorArea;
  takenIds: string[];
  onChange: (area: EditorArea) => void;
  onZoomTo: () => void;
  onDelete: () => void;
}) {
  return (
    <Stack gap="xs">
      <CommitInput
        label="Label"
        description="The tooltip on hover"
        value={area.label}
        onCommit={(label) => {
          onChange({ ...area, label });
        }}
      />
      <CommitInput
        label="Id"
        value={area.id}
        validate={(draft) => {
          if (draft.trim() === "") {
            return "An area needs an id";
          }
          return draft !== area.id && takenIds.includes(draft) ? "Another area has this id" : null;
        }}
        onCommit={(id) => {
          onChange({ ...area, id });
        }}
      />
      <ColorInput
        label="Fill"
        format="rgba"
        swatches={SWATCHES}
        value={area.fill}
        onChangeEnd={(fill) => {
          onChange({ ...area, fill });
        }}
      />
      <ColorInput
        label="Outline"
        format="rgba"
        placeholder="The map's area outline"
        value={area.stroke ?? ""}
        onChangeEnd={(stroke) => {
          const { stroke: _stroke, ...rest } = area;
          onChange(stroke === "" ? rest : { ...area, stroke });
        }}
      />
      <Group gap="xs" mt={4}>
        <Button size="xs" variant="default" leftSection={<IconFocus2 size={14} />} onClick={onZoomTo} disabled={area.parts.length === 0}>
          Zoom to area
        </Button>
        <Button size="xs" variant="light" color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
          Delete area
        </Button>
      </Group>
    </Stack>
  );
}
