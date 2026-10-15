import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import type { FileUploadProvider } from "@agent-native/core/file-upload";
import type { PrivateBlobProvider, PrivateBlobMetadata } from "@agent-native/core/private-blob";

export const CUBE_FILES_PREFIX = "/api/cube-files/";
const ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export function cubeDataDirectory(): string {
  const root = process.env.CUBE_APP_DATA_DIR;
  if (!root || !isAbsolute(root))
    throw new Error("CUBE_APP_DATA_DIR must be an absolute persistent directory");
  return root;
}

export function getCubeStorage() {
  return createCubeStorage(cubeDataDirectory());
}

/** URLs deliberately omit the port: Cube can assign a new port at every launch. */
export function createCubeStorage(root: string) {
  if (!isAbsolute(root)) throw new Error("Cube storage requires an absolute directory");
  function checkedId(id: string) {
    if (!ID_PATTERN.test(id)) throw new Error("Invalid Cube file id");
    return id;
  }
  function idFromUrl(url: string) {
    if (!url.startsWith(CUBE_FILES_PREFIX)) throw new Error("Not a Cube file URL");
    return checkedId(url.slice(CUBE_FILES_PREFIX.length));
  }
  async function put(
    kind: "public" | "private",
    data: Uint8Array,
    mimeType?: string,
    metadata?: PrivateBlobMetadata,
  ) {
    const directory = join(root, "blobs", kind);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const id = randomUUID();
    await writeFile(join(directory, id), data, { flag: "wx", mode: 0o600 });
    await writeFile(
      join(directory, `${id}.json`),
      JSON.stringify({ mimeType: mimeType || "application/octet-stream", metadata }),
      { flag: "wx", mode: 0o600 },
    );
    return id;
  }
  async function read(kind: "public" | "private", id: string) {
    const filename = join(root, "blobs", kind, checkedId(id));
    const [data, raw] = await Promise.all([
      readFile(filename),
      readFile(`${filename}.json`, "utf8"),
    ]);
    const metadata = JSON.parse(raw) as { mimeType: string; metadata?: PrivateBlobMetadata };
    return { data, ...metadata };
  }
  async function remove(kind: "public" | "private", id: string) {
    const filename = join(root, "blobs", kind, checkedId(id));
    for (const target of [filename, `${filename}.json`]) {
      await unlink(target).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  const publicProvider: FileUploadProvider = {
    id: "cube-local",
    name: "Cube storage",
    isConfigured: () => true,
    isOwnedUrl: (url) => {
      try {
        idFromUrl(url);
        return true;
      } catch {
        return false;
      }
    },
    async upload(input) {
      const id = await put("public", input.data, input.mimeType);
      return { id, url: `${CUBE_FILES_PREFIX}${id}`, provider: "cube-local" };
    },
    async delete(input) {
      await remove("public", idFromUrl(input.url));
      return true;
    },
  };
  const privateProvider: PrivateBlobProvider = {
    id: "cube-local-private",
    name: "Cube private storage",
    isConfigured: () => true,
    async put(input) {
      const id = await put("private", input.data, input.mimeType, input.metadata);
      return {
        id,
        provider: "cube-local-private",
        opaque: true,
        encrypted: false,
        mimeType: input.mimeType,
        size: input.data.byteLength,
        createdAt: new Date().toISOString(),
        metadata: input.metadata,
      };
    },
    async read(handle) {
      if (handle.provider !== "cube-local-private") throw new Error("Wrong private blob provider");
      return { ...(await read("private", handle.id)), handle };
    },
    async delete(handle) {
      if (handle.provider !== "cube-local-private") throw new Error("Wrong private blob provider");
      await remove("private", handle.id);
      return { deleted: true, provider: "cube-local-private" };
    },
  };
  return { publicProvider, privateProvider, readPublic: (id: string) => read("public", id) };
}
