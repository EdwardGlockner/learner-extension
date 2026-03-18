import browser from "webextension-polyfill";

export const browserApi = browser;

export function isFirefoxLike(): boolean {
  return navigator.userAgent.toLowerCase().includes("firefox");
}

export async function openExtensionPage(path: string): Promise<void> {
  await browserApi.tabs.create({ url: browserApi.runtime.getURL(path) });
}

export async function openExternalUrl(url: string): Promise<void> {
  await browserApi.tabs.create({ url });
}

export async function openExtensionPopupWindow(
  path: string,
  width = 560,
  height = 760
): Promise<void> {
  await browserApi.windows.create({
    url: browserApi.runtime.getURL(path),
    type: "popup",
    width,
    height
  });
}
