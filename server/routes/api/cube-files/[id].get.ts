import { defineEventHandler, createError } from "h3";
import { getSession } from "@agent-native/core/server";
import { createCubeStorage, cubeDataDirectory } from "../../../lib/cube-storage";

export default defineEventHandler(async (event) => {
  if (!(await getSession(event))) throw createError({ statusCode: 401 });
  const id = event.context.params?.id ?? "";
  let stored;
  try {
    stored = await createCubeStorage(cubeDataDirectory()).readPublic(id);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EACCES") throw error;
    throw createError({ statusCode: 404, statusMessage: "File not found" });
  }
  // Uploaded HTML/SVG must not execute with the app's origin privileges.
  const headers: Record<string, string> = {
    "Content-Type": stored.mimeType,
    "Content-Security-Policy": "sandbox; default-src 'none'",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
  };
  const range = event.req.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const size = stored.data.length;
    const start = match?.[1] ? Number(match[1]) : Math.max(0, size - Number(match?.[2] || 0));
    const end = match?.[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (!match || (!match[1] && !match[2]) || start > end || start >= size) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${size}` },
      });
    }
    const bytes = stored.data.subarray(start, end + 1);
    return new Response(bytes, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(bytes.length),
      },
    });
  }
  return new Response(stored.data, {
    headers: { ...headers, "Content-Length": String(stored.data.length) },
  });
});
