import { normalizedItemToSignal, type NormalizedSignalItem } from "./normalize-to-signal";
import { persistSignal, type SignalPersistenceClient } from "./persist-signal";

export function buildSignalFromNormalizedItem(item: NormalizedSignalItem) {
  return normalizedItemToSignal(item);
}

export async function ingestNormalizedItemAsSignal(
  item: NormalizedSignalItem,
  client?: SignalPersistenceClient
) {
  const signal = buildSignalFromNormalizedItem(item);
  return persistSignal(signal, client);
}
