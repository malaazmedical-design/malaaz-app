import { requireOptionalNativeModule } from "expo-modules-core";

// Shrinks a picked photo before upload (max side 800px, JPEG ~0.7): a phone photo of 1-2 MB becomes ~60-100 KB.
// expo-image-manipulator is a native module: builds made before it was added do not contain it, so there we
// keep the original file (never throw, never block the upload).
export async function compressForUpload(
  uri: string,
  width?: number,
  height?: number,
  maxSide = 800,
  quality = 0.7
): Promise<{ uri: string; mimeType: string } | null> {
  try {
    if (!requireOptionalNativeModule("ExpoImageManipulator")) return null;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IM = require("expo-image-manipulator");
    const longest = Math.max(width ?? 0, height ?? 0);
    const actions = longest > maxSide ? [{ resize: width && height && width < height ? { height: maxSide } : { width: maxSide } }] : [];
    const out = await IM.manipulateAsync(uri, actions, { compress: quality, format: IM.SaveFormat.JPEG });
    return { uri: out.uri, mimeType: "image/jpeg" };
  } catch {
    return null;
  }
}
