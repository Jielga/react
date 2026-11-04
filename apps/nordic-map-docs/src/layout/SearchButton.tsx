import { ActionIcon, Button, Kbd } from "@mantine/core";
import { spotlight } from "@mantine/spotlight";
import { IconSearch } from "@tabler/icons-react";

export function SearchButton() {
  return (
    <>
      <Button
        variant="default"
        visibleFrom="sm"
        onClick={spotlight.open}
        leftSection={<IconSearch size={16} stroke={1.5} />}
        rightSection={<Kbd size="xs">Ctrl + K</Kbd>}
        fw={400}
        c="dimmed"
      >
        Search the docs
      </Button>
      <ActionIcon variant="default" size="lg" hiddenFrom="sm" onClick={spotlight.open} aria-label="Search the docs">
        <IconSearch size={18} stroke={1.5} />
      </ActionIcon>
    </>
  );
}
