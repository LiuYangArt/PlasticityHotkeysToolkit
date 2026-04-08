# Plasticity Hotkeys Toolkit

## 用途

这套工具用于给windows平台下的 Plasticity 注入官方没有暴露的自定义快捷键。

当前已经包含的自定义快捷键：

- `Enter`：把当前选中的 Outliner folder 设为 Active Folder
- `Ctrl+Alt+Shift+X`：执行 `Delete empty groups`


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

## 以后如何新增快捷键

新增 hotkey 的操作说明在这里：

- `docs\how-to-add-hotkeys.md`
