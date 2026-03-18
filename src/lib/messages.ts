import { browserApi } from "./browserApi";
import type { BackgroundMessage, MessagePayloads } from "../shared/messages";

type MessageByType<TType extends BackgroundMessage["type"]> = Extract<BackgroundMessage, { type: TType }>;

export async function sendBackgroundMessage<TType extends BackgroundMessage["type"]>(
  message: MessageByType<TType>
): Promise<MessagePayloads[TType]> {
  return browserApi.runtime.sendMessage(message) as Promise<MessagePayloads[TType]>;
}
