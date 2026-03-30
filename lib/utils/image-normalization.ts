import * as ImageManipulator from 'expo-image-manipulator'

type NormalizeImageOptions = {
  compress?: number
}

const DEFAULT_COMPRESS = 0.9

/**
 * Re-encodes an image into a fresh JPEG so the pixel data already matches the
 * intended orientation instead of relying on EXIF metadata at render time.
 */
export async function normalizeImageUri(
  uri: string,
  options: NormalizeImageOptions = {},
): Promise<string> {
  const normalized = await ImageManipulator.manipulateAsync(uri, [], {
    compress: options.compress ?? DEFAULT_COMPRESS,
    format: ImageManipulator.SaveFormat.JPEG,
  })

  return normalized.uri
}

export async function normalizeImageUris(
  uris: string[],
  options?: NormalizeImageOptions,
): Promise<string[]> {
  return Promise.all(uris.map((uri) => normalizeImageUri(uri, options)))
}
