import { SiteHeader } from "docs-shell/SiteHeader.tsx";
import { SearchButton } from "./SearchButton.tsx";

/** The shared site header, with the docs search */
export function AppHeader() {
  return (
    <SiteHeader site="nordic-map">
      <SearchButton />
    </SiteHeader>
  );
}
