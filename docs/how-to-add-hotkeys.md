# 如何新增 Hotkey

## 适用范围

这份说明用于以后继续给 Plasticity 增加新的自定义快捷键。

## 日常模式和调试模式的区别

- 日常模式配置文件：`hotkeys\custom-shortcuts.json`
- 调试模式配置文件：`hotkeys\custom-shortcuts.debug.json`

通常先在调试模式里改和测试，确认没问题后，再同步到日常模式配置。

## 新增一个已有命令的快捷键

直接编辑配置文件，在对应区域加一条绑定即可。

示例：

```json
{
  "body:not([gizmo]) plasticity-outliner": {
    "enter": "custom:outliner:activate-selected",
    "shift-enter": "custom:outliner:activate-selected"
  }
}
```

如果你只是想给已经存在的自定义命令换一个按键，一般只需要改这里。

## 新增一个全新的自定义命令

如果配置文件里还没有这个命令，需要同时改两处：

1. `hotkeys\custom-shortcuts.json` 或 `hotkeys\custom-shortcuts.debug.json`
2. `hotkeys\renderer-hotkeys.js`

具体做法：

1. 先在配置文件里添加按键和命令名映射
2. 再到 `renderer-hotkeys.js` 的 `runCustomCommand()` 里增加对应分支
3. 如果这个命令需要新的 DOM 识别或事件派发逻辑，再补对应函数

示例结构：

```js
function runCustomCommand(commandId) {
  switch (commandId) {
    case "custom:outliner:activate-selected":
      return activateSelectedOutlinerItem();
    case "custom:example:new-action":
      return runExampleAction();
    default:
      return { ok: false, reason: "unknown-command", commandId };
  }
}
```

## 如何测试

1. 先运行对应版本的调试入口
2. 在 Plasticity 里触发新快捷键
3. 观察调试面板或 toast
4. 必要时运行：
   - `tools\debug-hotkeys-status-beta.cmd`
   - `tools\debug-hotkeys-status-stable.cmd`

如果调试模式确认无误，再把变更同步到日常配置文件。

## 如果改完后要重新安装到固定目录

运行：

```text
tools\install-hotkeys-toolkit.cmd
```

这样会把当前工具包重新同步到 `%LOCALAPPDATA%\PlasticityHotkeysToolkit`。
