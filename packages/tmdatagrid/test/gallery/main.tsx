import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { StrictMode, type ComponentType } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

/**
 * The page Playwright's `mount` fixture drives: it navigates here, calls
 * `window.mount({ story, props })`, and queries the grid inside `#root`.
 */
type StoryProps = Record<string, unknown>;

type MountParams = {
  story: string;
  props?: StoryProps;
};

declare global {
  interface Window {
    mount: (params: MountParams) => Promise<void>;
    unmount: () => Promise<void>;
  }
}

const STORIES_PREFIX = "../stories/";
const STORY_SUFFIX = ".story.tsx";

const stories = import.meta.glob<Record<string, ComponentType<StoryProps>>>(
  "../stories/**/*.story.tsx",
);

/** `Grid/Default` is the `Default` export of `../stories/Grid.story.tsx`. */
async function resolveStory(id: string): Promise<ComponentType<StoryProps>> {
  const separator = id.lastIndexOf("/");
  const file = `${STORIES_PREFIX}${id.slice(0, separator)}${STORY_SUFFIX}`;
  const exportName = id.slice(separator + 1);
  const load = separator > 0 ? stories[file] : undefined;
  const module = load ? await load() : undefined;
  const story = module?.[exportName];
  if (story === undefined) {
    throw new Error(`Unknown story: ${id}`);
  }
  return story;
}

const container = document.getElementById("root");
if (container === null) {
  throw new Error("The gallery page has no #root element.");
}

// One root for the page's lifetime, so a second `mount` of the same story -
// Playwright's `component.update(props)` - reconciles instead of remounting.
const root = createRoot(container);

async function mount({ story, props = {} }: MountParams): Promise<void> {
  const Story = await resolveStory(story);
  // `env="test"` turns Mantine's transitions off, so a popover is fully open
  // the moment it mounts and no test waits on an animation.
  flushSync(() => {
    root.render(
      <StrictMode>
        <MantineProvider env="test">
          <Story {...props} />
        </MantineProvider>
      </StrictMode>,
    );
  });
  return;
}

async function unmount(): Promise<void> {
  flushSync(() => {
    root.render(null);
  });
  return;
}

window.mount = mount;
window.unmount = unmount;

// `?story=Grid/Pinned` mounts a story on load, so the gallery doubles as a
// manual repro page.
const initialStory = new URLSearchParams(window.location.search).get("story");
if (initialStory !== null) {
  void mount({ story: initialStory });
}
