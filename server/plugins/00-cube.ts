import { configureAgentNativeEmbeddedEnvironment } from "@agent-native/core/server";
import { registerFileUploadProvider } from "@agent-native/core/file-upload";
import { registerPrivateBlobProvider } from "@agent-native/core/private-blob";
import { closeDbExec } from "@agent-native/core/db";
import { createCubeStorage, cubeDataDirectory } from "../lib/cube-storage";

// Claim the documented desktop-host exemption before Nitro runs DB plugins.
// NODE_ENV does not disable the production bundle's PGlite refusal.
const root = cubeDataDirectory();
configureAgentNativeEmbeddedEnvironment({ databaseUrl: `pglite:${root}/pglite` });
const storage = createCubeStorage(root);
registerFileUploadProvider(storage.publicProvider);
registerPrivateBlobProvider(storage.privateProvider);

export default (nitroApp: {
  hooks: {
    hook(name: string, callback: () => Promise<void>): void;
    callHook(name: string): Promise<void>;
  };
}) => {
  // Nitro stops accepting HTTP before closing; release the embedded database
  // worker and process lock so Cube can restart this app immediately.
  nitroApp.hooks.hook("close", closeDbExec);
  // Nitro 3's node-server registers signal handlers before wrapping close(),
  // so SIGTERM can leave background workers alive after HTTP closes. Respect
  // srvx's drain timeout, finish all close hooks and flush PGlite before exit.
  const drainSeconds = Number.parseInt(process.env.SERVER_SHUTDOWN_TIMEOUT ?? "", 10) || 5;
  let closing = false;
  const closeAfterDrain = () => {
    if (closing) return;
    closing = true;
    setTimeout(async () => {
      try {
        await nitroApp.hooks.callHook("close");
        await closeDbExec();
        process.exit(0);
      } catch (error) {
        console.error("[cube] Database shutdown failed", error);
        process.exit(1);
      }
    }, Math.max(0, drainSeconds) * 1000 + 500);
  };
  process.once("SIGTERM", closeAfterDrain);
  process.once("SIGINT", closeAfterDrain);
};
