import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = {
    port: null,
    root: process.cwd(),
    configPath: null,
    installRoot: null,
    launchStrategy: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--port") {
      args.port = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--root") {
      args.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--config-path") {
      args.configPath = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--install-root") {
      args.installRoot = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--launch-strategy") {
      args.launchStrategy = argv[i + 1];
      i += 1;
    }
  }

  if (!args.port) {
    throw new Error("Missing required --port argument.");
  }

  return args;
}

async function connectToInspector(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await response.json();
  const target = targets.find((item) => item.type === "node");
  if (!target?.webSocketDebuggerUrl) {
    throw new Error(`No node inspector target found on port ${port}.`);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let messageId = 0;
  const pending = new Map();

  ws.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data.toString());
    if (payload.id && pending.has(payload.id)) {
      pending.get(payload.id)(payload);
      pending.delete(payload.id);
    }
  });

  async function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = ++messageId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  return { ws, send };
}

function unwrapEvaluationResult(response) {
  const result = response?.result?.result;
  const exception = response?.result?.exceptionDetails;
  if (exception) {
    const description =
      response?.result?.result?.description ||
      exception?.text ||
      "Unknown inspector evaluation failure.";
    throw new Error(description);
  }
  return result?.value;
}

async function evaluate(send, expression) {
  const response = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return unwrapEvaluationResult(response);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRendererStatus(send, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const statusesRaw = await evaluate(
      send,
      `
        Promise.all(
          process.mainModule.require('electron').BrowserWindow.getAllWindows().map(async (win, index) => {
            try {
              const raw = await win.webContents.executeJavaScript(
                "JSON.stringify(window.__plasticityHotkeys?.status?.() || null)"
              );
              return { index, status: raw ? JSON.parse(raw) : null, title: win.getTitle() };
            } catch (error) {
              return { index, status: null, error: String(error), title: win.getTitle() };
            }
          })
        ).then((items) => JSON.stringify(items))
      `,
    );

    const statuses = statusesRaw ? JSON.parse(statusesRaw) : [];
    const ready = statuses.find((item) => item.status);
    if (ready) {
      return {
        ready,
        windows: statuses,
      };
    }

    await sleep(500);
  }

  return {
    ready: null,
    windows: [],
  };
}

async function main() {
  const { port, root, configPath, installRoot, launchStrategy } = parseArgs(process.argv.slice(2));
  const resolvedConfigPath = configPath || path.join(root, "hotkeys", "custom-shortcuts.json");
  const rendererPath = path.join(root, "hotkeys", "renderer-hotkeys.js");

  const [configText, rendererText] = await Promise.all([
    fs.readFile(resolvedConfigPath, "utf8"),
    fs.readFile(rendererPath, "utf8"),
  ]);

  const config = JSON.parse(configText);
  const rendererPayload = `window.__PLASTICITY_HOTKEYS_CONFIG = ${JSON.stringify(config)};\n${rendererText}`;
  const payloadBase64 = Buffer.from(rendererPayload, "utf8").toString("base64");

  const { ws, send } = await connectToInspector(port);

  const installExpression = `
    (() => {
      const electron = process.mainModule.require('electron');
      const { app, BrowserWindow } = electron;
      const payload = Buffer.from(${JSON.stringify(payloadBase64)}, 'base64').toString('utf8');

      function injectIntoWindow(win) {
        if (!win || win.isDestroyed()) {
          return;
        }
        const run = () => {
          if (win.isDestroyed()) {
            return;
          }
          win.webContents.executeJavaScript(payload).catch((error) => {
            console.error('[plasticity-hotkeys] renderer injection failed:', error);
          });
        };

        if (win.webContents.isLoadingMainFrame()) {
          win.webContents.once('did-finish-load', run);
        } else {
          run();
        }

        if (!win.__plasticityHotkeysDidFinishLoadHook) {
          win.__plasticityHotkeysDidFinishLoadHook = true;
          win.webContents.on('did-finish-load', run);
        }
      }

      if (!global.__plasticityHotkeysMain) {
        global.__plasticityHotkeysMain = {
          version: '0.3.1',
          installedAt: new Date().toISOString(),
        };
        BrowserWindow.getAllWindows().forEach(injectIntoWindow);
        app.on('browser-window-created', (_event, win) => injectIntoWindow(win));
      } else {
        BrowserWindow.getAllWindows().forEach(injectIntoWindow);
      }

      return JSON.stringify({
        ok: true,
        version: global.__plasticityHotkeysMain.version,
        windows: BrowserWindow.getAllWindows().length,
        installedAt: global.__plasticityHotkeysMain.installedAt,
      });
    })()
  `;

  const installValue = await evaluate(send, installExpression);
  const rendererStatus = await waitForRendererStatus(send);

  ws.close();

  const installJson = installValue ? JSON.parse(installValue) : null;

  console.log(
    JSON.stringify(
      {
        install: installJson,
        renderer: rendererStatus.ready?.status ?? null,
        rendererWindow: rendererStatus.ready
          ? {
              index: rendererStatus.ready.index,
              title: rendererStatus.ready.title,
            }
          : null,
        meta: {
          installRoot,
          launchStrategy,
          toolkitRoot: root,
          configPath: resolvedConfigPath,
          inspectorPort: port,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
