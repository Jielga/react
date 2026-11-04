import { Button, Group, Modal, Text } from "@mantine/core";
import { CodeBlock } from "docs-shell/docs/CodeBlock.tsx";
import {
  buildStarterSnippet,
  type StarterSnippetConfig,
} from "./starterSnippet";

/**
 * "Give me this table as code" - renders the current switch positions as the
 * smallest file that reproduces them, ready to paste. The copy button is the
 * one every code block on the site has.
 */
export function StarterSnippetModal({
  config,
  opened,
  onClose,
}: {
  config: StarterSnippetConfig;
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Starter code for this configuration"
      size="lg"
    >
      <Text size="sm" c="dimmed" mb="xs">
        Only what differs from a default is included, so leaving every switch
        alone gives you the shortest version.
      </Text>

      {/* Rendered only while open: the snippet changes with every switch, and
          re-highlighting one nobody is looking at is work for nothing. */}
      {opened && <CodeBlock code={buildStarterSnippet(config)} />}

      <Group justify="flex-end" mt="md">
        <Button size="xs" variant="default" onClick={onClose}>
          Close
        </Button>
      </Group>
    </Modal>
  );
}
