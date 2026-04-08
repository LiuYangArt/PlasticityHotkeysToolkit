# 如何新增 Hotkey

## 适用范围

这份说明用于以后继续给 Plasticity 增加新的自定义快捷键。

## 配置文件

现在只保留一个配置文件：

- `hotkeys\custom-shortcuts.json`

日常模式和调试模式都读取这同一个 JSON。  
调试模式只是额外打开调试面板和 toast，不再维护第二份配置。

## 新增一个已有命令的快捷键

直接编辑配置文件，在对应区域加一条绑定即可。

示例：

```json
{
  "body:not([gizmo]) plasticity-outliner": {
    "enter": "custom:outliner:activate-selected",
    "shift-enter": "custom:outliner:activate-selected",
    "ctrl-alt-shift-x": "custom:outliner:delete-empty-groups"
  }
}
```

如果你只是想给已经存在的自定义命令换一个按键，一般只需要改这里。

## 新增一个全新的自定义命令

如果配置文件里还没有这个命令，需要同时改两处：

1. `hotkeys\custom-shortcuts.json`
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
    case "custom:outliner:delete-empty-groups":
      return deleteEmptyGroupsFromOutlinerMenu();
    case "custom:example:new-action":
      return runExampleAction();
    default:
      return { ok: false, reason: "unknown-command", commandId };
  }
}
```

## 顶部三点菜单类动作怎么加

如果某个动作不是行级按钮，也不是右键菜单，而是在 Outliner 顶部三点按钮里：

1. 先在 `custom-shortcuts.json` 里绑定一个命令名
2. 在 `renderer-hotkeys.js` 里实现这个命令
3. 实现时一般按这个顺序：
   - 找到当前选中的 Outliner 项
   - 找到顶部三点按钮
   - 打开菜单
   - 按菜单文字找到目标项
   - 再触发点击

现在 `Delete empty groups` 就是这类实现，可直接作为参考。

## 如何测试

1. 先运行对应版本的调试入口
2. 在 Plasticity 里触发新快捷键
3. 观察调试面板或 toast
4. 必要时运行：
   - `tools\debug-hotkeys-status-beta.cmd`
   - `tools\debug-hotkeys-status-stable.cmd`

如果调试模式确认无误，日常模式会直接使用同一份配置，不需要再做同步。

## 如果改完后要重新安装到固定目录

运行：

```text
tools\install-hotkeys-toolkit.cmd
```

这样会把当前工具包重新同步到 `%LOCALAPPDATA%\PlasticityHotkeysToolkit`。
