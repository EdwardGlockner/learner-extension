import browser from "webextension-polyfill";

export const browserApi = browser;

export function isFirefoxLike(): boolean {
  return navigator.userAgent.toLowerCase().includes("firefox");
}

export async function openExtensionPage(path: string): Promise<void> {
  await browserApi.tabs.create({ url: browserApi.runtime.getURL(path) });
}

export function navigateCurrentExtensionPage(path: string): void {
  window.location.assign(browserApi.runtime.getURL(path));
}

export async function openExternalUrl(url: string): Promise<void> {
  try {
    await browserApi.tabs.create({ url });
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export async function openExtensionPopupWindow(
  path: string,
  width = 560,
  height = 760
): Promise<void> {
  const url = browserApi.runtime.getURL(path);

  try {
    await browserApi.windows.create({
      url,
      type: "popup",
      width,
      height
    });
  } catch {
    await browserApi.tabs.create({ url });
  }
}
