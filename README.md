# Plasticity Hotkeys

## 上传到 GitHub

如果你要建 GitHub 仓库，只需要把这个文件夹本身作为仓库根目录即可：

- `hotkeys-toolkit`
- 或者 `%LOCALAPPDATA%\PlasticityHotkeysToolkit`

两者内容是同一套工具。不要上传整个 Plasticity 安装目录，也不要上传这些内容：

- `app-*`
- `packages`
- `plasticity-beta.exe`
- `Update.exe`
- 其他 Plasticity 自带二进制和版本目录

## 日常使用

如果你只想正常使用快捷键：

1. 在 Plasticity 安装根目录运行 `start-plasticity-hotkeys.cmd`
2. 它会用默认配置启动，不显示调试面板

## 调试模式

如果以后要排查快捷键问题：

1. 打开这个文件夹
2. 运行 `start-plasticity-hotkeys-debug.cmd`
3. 它会显示调试面板和提示信息

## 查看当前状态

如果需要读取当前热键状态：

1. 保持 Plasticity 正在运行
2. 运行 `debug-hotkeys-status.cmd`

## 安装到稳定目录

如果你希望重装或升级 Plasticity 后继续快速使用：

1. 在这个文件夹运行 `install-hotkeys-toolkit.cmd`
2. 它会复制到 `%LOCALAPPDATA%\PlasticityHotkeysToolkit`
3. 以后可以直接运行 `%LOCALAPPDATA%\PlasticityHotkeysToolkit\start-plasticity-hotkeys.cmd`

## 你现在最需要记住的入口

- 日常启动：安装根目录下的 `start-plasticity-hotkeys.cmd`
- 调试启动：这个文件夹里的 `start-plasticity-hotkeys-debug.cmd`
