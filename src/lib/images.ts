// Shrink a photo in the browser before uploading: phone photos are 3-8 MB and
// 4000+ px wide, far more than needed. Re-encoding also drops hidden metadata
// such as the GPS location where the photo was taken.

const MAX_SIDE = 1600; // pixels
const QUALITY = 0.82;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // matches the storage bucket's limit
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function shrinkPhoto(file: File): Promise<Blob> {
  try {
    // createImageBitmap applies the photo's rotation (EXIF orientation) for us.
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", QUALITY),
    );
  } catch {
    // Browser couldn't decode it (rare): upload as-is if it's a normal, small image.
    if (ALLOWED_TYPES.includes(file.type) && file.size <= MAX_UPLOAD_BYTES) return file;
    throw new Error(`Couldn't read "${file.name}". Try a JPEG or PNG photo.`);
  }
}

export function extensionFor(blob: Blob): string {
  return blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
}
