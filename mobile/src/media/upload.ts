// Picking, shrinking and uploading images: presign on the API, PUT straight to S3,
// then confirm so the API can scan it. Images are re-encoded as JPEG at most 2048px
// on the long edge, which also strips EXIF (including location) before upload.
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { apiFetch } from "../api/client";

export type LocalImage = { uri: string; width: number; height: number };
export type UploadedImage = { id: string; url: string; width: number | null; height: number | null };

const MAX_EDGE = 2048;

export async function pickImages(max: number): Promise<LocalImage[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Allow photo access in Settings to add pictures.");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: max > 1,
    selectionLimit: max,
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, max).map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

async function prepare(img: LocalImage) {
  const long = Math.max(img.width, img.height) || MAX_EDGE;
  const scale = long > MAX_EDGE ? MAX_EDGE / long : 1;
  const actions: ImageManipulator.Action[] =
    scale < 1 ? [{ resize: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) } }] : [];
  const out = await ImageManipulator.manipulateAsync(img.uri, actions, {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const blob = await (await fetch(out.uri)).blob();
  return { width: out.width, height: out.height, blob };
}

export async function uploadImage(img: LocalImage, purpose: "post" | "avatar"): Promise<UploadedImage> {
  const prepared = await prepare(img);
  const presign = await apiFetch("/media/presign", {
    method: "POST",
    body: JSON.stringify({
      contentType: "image/jpeg",
      sizeBytes: prepared.blob.size,
      purpose,
      width: prepared.width,
      height: prepared.height,
    }),
  });

  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: prepared.blob,
  });
  if (!put.ok) throw new Error("Upload failed. Check your connection and try again.");

  const done = await apiFetch(`/media/${presign.mediaId}/complete`, { method: "POST" });
  if (done?.status !== "READY" || !done.media) throw new Error("That image isn’t allowed on Fwitter.");
  return done.media as UploadedImage;
}

export function friendlyUploadError(e: any) {
  switch (e?.message) {
    case "media_disabled":
      return "Image uploads aren’t switched on yet.";
    case "file_too_large":
      return "That image is too big (10 MB max).";
    case "scan_failed":
      return "We couldn’t check that image. Try again in a moment.";
    default:
      return e?.message ?? "Upload failed.";
  }
}
