import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/**
 * `env="test"` disables Mantine's transitions. Without it a Popover's dropdown
 * never finishes mounting under jsdom, so panels opened in a test stay empty.
 */
export function MantineWrapper({ children }: { children: ReactNode }) {
  return <MantineProvider env="test">{children}</MantineProvider>;
}

export function renderWithMantine(ui: ReactElement) {
  return render(ui, { wrapper: MantineWrapper });
}
