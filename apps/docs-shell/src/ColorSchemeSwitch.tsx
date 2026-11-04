import {
  SegmentedControl,
  useMantineColorScheme,
  VisuallyHidden,
} from "@mantine/core";
import {
  IconDeviceDesktop,
  IconMoon,
  IconSun,
  type Icon,
} from "@tabler/icons-react";

/** An icon on screen, and a name for a screen reader. */
function SchemeLabel({ icon: SchemeIcon, name }: { icon: Icon; name: string }) {
  return (
    <>
      <SchemeIcon size={15} stroke={1.6} aria-hidden />
      <VisuallyHidden>{name}</VisuallyHidden>
    </>
  );
}

/** Light / dark / system toggle, at the right end of the site header. */
export function ColorSchemeSwitch() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <SegmentedControl
      fullWidth
      size="xs"
      value={colorScheme}
      onChange={(value) => setColorScheme(value as "light" | "dark" | "auto")}
      data={[
        { value: "light", label: <SchemeLabel icon={IconSun} name="Light" /> },
        { value: "dark", label: <SchemeLabel icon={IconMoon} name="Dark" /> },
        { value: "auto", label: <SchemeLabel icon={IconDeviceDesktop} name="System" /> },
      ]}
    />
  );
}
