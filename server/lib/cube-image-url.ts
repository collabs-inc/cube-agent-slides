import { CUBE_FILES_PREFIX } from "./cube-storage.js";

/** Only opaque relative Cube file URLs may bypass external URL handling. */
export function cubeImageFileId(url: string): string | null {
  if (!url.startsWith(CUBE_FILES_PREFIX)) return null;
  const id = url.slice(CUBE_FILES_PREFIX.length);
  return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)
    ? id
    : null;
}
