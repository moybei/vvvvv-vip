import sharp from "sharp";

// Long side cap for the stored image: comfortably enough resolution to read
// a plate in a normal parking-lot photo without keeping 20-50MP originals.
const MAX_DIMENSION = 2500;
const THUMB_DIMENSION = 480;
const JPEG_QUALITY = 85;

export type ProcessedImage = {
  buffer: Buffer;
  width: number;
  height: number;
};

async function resizeTo(
  input: Buffer,
  maxDimension: number,
): Promise<ProcessedImage> {
  const pipeline = sharp(input, { failOn: "none" }).rotate(); // auto-orient from EXIF
  const resized = pipeline.resize({
    width: maxDimension,
    height: maxDimension,
    fit: "inside",
    withoutEnlargement: true,
  });
  const buffer = await resized.jpeg({ quality: JPEG_QUALITY }).toBuffer();
  const metadata = await sharp(buffer).metadata();
  return {
    buffer,
    width: metadata.width ?? maxDimension,
    height: metadata.height ?? maxDimension,
  };
}

export async function processUploadedImage(input: Buffer) {
  const [full, thumb] = await Promise.all([
    resizeTo(input, MAX_DIMENSION),
    resizeTo(input, THUMB_DIMENSION),
  ]);
  return { full, thumb };
}
