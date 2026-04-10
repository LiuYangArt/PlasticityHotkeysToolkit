# Plasticity Hotkeys Toolkit

## Overview

This toolkit injects custom hotkeys into Plasticity on Windows for actions that are not exposed by the official shortcut system.

Currently supported custom shortcut features:

- `Ctrl+Alt+I`: run `Create Instance` on the parent group/folder of the currently selected object in the 3D viewport
- `Enter`: set the currently selected Outliner folder as the Active Folder
- `Alt+Shift+4`: set the parent group/folder of the currently selected object as the Active Folder
- `Ctrl+Alt+Shift+X`: run `Delete empty groups`
- `Shift+B`: switch `Pivot` to `Bbox` when the `Move / Scale / Rotate` tool panel is open

Edit `hotkeys\custom-shortcuts.json` to customize these shortcut bindings.

## Installation
<img width="744" height="630" alt="image" src="https://github.com/user-attachments/assets/9b1aec38-12cc-447e-8ee7-fa7023a8b377" />
<br>

Download the ZIP package and extract it to any location.

### Launch

- Beta: `start-plasticity-beta.cmd`
- Stable: `start-plasticity-stable.cmd`

## Debug

Debug and installation scripts are under the `tools` folder:

- Beta debug launch: `tools\start-plasticity-beta-debug.cmd`
- Stable debug launch: `tools\start-plasticity-stable-debug.cmd`

- Check current status:
  - `tools\debug-hotkeys-status-beta.cmd`
  - `tools\debug-hotkeys-status-stable.cmd`

## Notes

This project was built in a fast, vibe-coding style, and I did not manually review every AI-generated implementation detail. If you decide to use it, evaluate the risks yourself.

---

## 用途

这套工具用于给windows平台下的 Plasticity 注入官方没有暴露的自定义快捷键。

当前添加的可自定义快捷键功能：

- `Ctrl+Alt+I`：对 3D viewport 当前选中 object 的上级 group/folder 执行 `Create Instance`
- `Enter`：把当前选中的 Outliner folder 设为 Active Folder
- `Alt+Shift+4`：把当前选中 object 所在的上级 group/folder 设为 Active Folder
- `Ctrl+Alt+Shift+X`：执行 `Delete empty groups`
- `Shift+B`：在 `Move / Scale / Rotate` 工具面板打开时，把 `Pivot` 切到 `Bbox`

修改 hotkeys\custom-shortcuts.json 自定义这些功能的快捷键

## 安装
<img width="744" height="630" alt="image" src="https://github.com/user-attachments/assets/9b1aec38-12cc-447e-8ee7-fa7023a8b377" />
<br>

下载zip包并解压到任意位置

### 启动

- Beta：`start-plasticity-beta.cmd`
- Stable：`start-plasticity-stable.cmd`

## 调试

调试和安装脚本都在 `tools` 文件夹里：

- Beta 调试启动：`tools\start-plasticity-beta-debug.cmd`
- Stable 调试启动：`tools\start-plasticity-stable-debug.cmd`

- 查看当前状态：
  - `tools\debug-hotkeys-status-beta.cmd`
  - `tools\debug-hotkeys-status-stable.cmd`

# 注意
这个项目是纯 viibe coding 的项目，我没有看 AI 写的具体代码实现。就如果你要用的话，请自己注意风险。
