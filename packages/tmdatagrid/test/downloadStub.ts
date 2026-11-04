import { onTestFinished, vi } from "vitest";

/** One file the code under test tried to download. */
export type CapturedDownload = {
  fileName: string;
  blob: Blob;
  /** The file as text, BOM included. */
  text: () => Promise<string>;
};

/**
 * Catches what `downloadFile` would hand the browser.
 *
 * jsdom has no `URL.createObjectURL` and an anchor click goes nowhere, so the
 * download path is stubbed end to end: object URLs become keys into a map of
 * blobs, and a click on an anchor records the blob its `href` points at along
 * with its `download` name. Installed for the calling test only; the stubs
 * are removed when it finishes.
 */
export function captureDownloads(): Array<CapturedDownload> {
  const downloads: Array<CapturedDownload> = [];
  const blobs = new Map<string, Blob>();

  const createObjectURL = vi.fn((blob: Blob) => {
    const url = `blob:test/${blobs.size}`;
    blobs.set(url, blob);
    return url;
  });
  const revokeObjectURL = vi.fn();
  const hadCreate = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  const hadRevoke = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURL,
    configurable: true,
    writable: true,
  });

  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      const blob = blobs.get(this.href);
      if (!blob) return;
      downloads.push({
        fileName: this.download,
        blob,
        text: () => readBlobText(blob),
      });
    });

  onTestFinished(() => {
    click.mockRestore();
    restore(URL, "createObjectURL", hadCreate);
    restore(URL, "revokeObjectURL", hadRevoke);
  });

  return downloads;
}

function restore(
  target: object,
  key: string,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else delete (target as Record<string, unknown>)[key];
}

/**
 * `Blob.text()` is not on every jsdom Blob; `FileReader` is. Decoded with the
 * BOM kept, since whether a file starts with one is part of what the export
 * tests check - `readAsText` would strip it.
 */
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      resolve(new TextDecoder("utf-8", { ignoreBOM: true }).decode(buffer));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}
