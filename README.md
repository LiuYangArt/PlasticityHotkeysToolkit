# Plasticity Hotkeys Toolkit

## 用途

这套工具用于给 Plasticity 的 Stable / Beta 版本注入自定义快捷键。

快捷键配置现在只维护一份：

- `hotkeys\custom-shortcuts.json`

调试模式不会再单独维护第二份 JSON，只是临时打开调试面板。

当前已经包含的自定义快捷键：

- `Enter`：把当前选中的 Outliner folder 设为 Active Folder
- `Ctrl+Alt+Shift+X`：执行 `Delete empty groups`

## 日常启动

- Beta：`start-plasticity-beta.cmd`
- Stable：`start-plasticity-stable.cmd`

这两个入口是平时直接使用的，不显示调试面板。

## 调试与安装

调试和安装脚本都在 `tools` 文件夹里：

- Beta 调试启动：`tools\start-plasticity-beta-debug.cmd`
- Stable 调试启动：`tools\start-plasticity-stable-debug.cmd`
- 安装到固定目录：`tools\install-hotkeys-toolkit.cmd`
- 查看当前状态：
  - `tools\debug-hotkeys-status-beta.cmd`
  - `tools\debug-hotkeys-status-stable.cmd`

## 以后如何新增快捷键

新增 hotkey 的操作说明在这里：

- `docs\how-to-add-hotkeys.md`

## GitHub

如果要上传 GitHub，就把这个文件夹本身作为仓库根目录。

不要上传 Plasticity 程序安装目录里的这些内容：

- `app-*`
- `packages`
- `Plasticity.exe`
- `plasticity-beta.exe`
- `Update.exe`
