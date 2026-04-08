# AGENTS.md

## 项目定位

这是一个给 Plasticity Stable / Beta 注入自定义快捷键的工具包，不是 Plasticity 本体源码。

核心链路：

1. PowerShell 启动脚本定位 Plasticity 安装目录并用 `--inspect` 启动
2. `hotkeys/inject-main.mjs` 通过 Electron inspector 把 renderer 脚本注入到窗口
3. `hotkeys/renderer-hotkeys.js` 在页面里监听键盘事件、识别 DOM 上下文并执行自定义命令
4. `hotkeys/custom-shortcuts.json` 是唯一快捷键配置源

## 工作原则

- 所有讨论、说明、文档内容使用中文。
- 代码、脚本、代码注释、命令 id 使用英文。
- 先看 `.codebase_index.md`，再按需读文件，不要先通读整个仓库。
- 这是注入型项目，很多问题不是“配置错了”，而是“运行时旧代码没被替换”或“DOM 定位假设失效”。
- 改 `hotkeys/renderer-hotkeys.js` 的运行时代码时，必须同步提升其中的 `VERSION`，否则重新注入时可能只会 `reloadConfig()`，不会替换旧逻辑。
- 新增快捷键时，优先复用已有 helper，不要重复造一套命中逻辑。
- 对 Plasticity UI 的操作，优先依赖稳定结构关系：
  - section
  - toolbar row
  - button group
  - menu item text
- 不要优先依赖视觉细节：
  - 某个图标长什么样
  - 某个 class 恰好带某个片段
  - 某个按钮恰好处于固定坐标

## 修改边界

- 常改目录：
  - `hotkeys/`
  - `tools/`
  - `docs/`
- 一般不要改：
  - `.git*`
  - 顶层 `.cmd` 入口的命名和位置，除非用户明确要求调整入口结构
- 不要把 Plasticity 安装目录内容提交进这个仓库。

## 常见任务怎么做

### 新增一个已有命令的快捷键

只改：

- `hotkeys/custom-shortcuts.json`

### 新增一个全新的自定义命令

通常要改：

- `hotkeys/custom-shortcuts.json`
- `hotkeys/renderer-hotkeys.js`

如果涉及启动或调试行为，再看是否要改：

- `hotkeys/inject-main.mjs`
- `tools/launch-plasticity-hotkeys.ps1`

### 排查“快捷键没生效”

按这个顺序查：

1. 先确认当前是通过本工具包入口启动的
2. 用 debug 入口启动，观察 toast / overlay
3. 判断问题落在哪一层：
   - 没有 `keydown`：输入链路没进来
   - 有 `keydown` 但没有 `command`：绑定或 selector 没命中
   - 有 `command` 但失败：命令实现或 DOM 定位有问题
4. 如果改过 `renderer-hotkeys.js`，确认 `VERSION` 已提升
5. 必要时用 inspector 抓真实 DOM，不要猜

## 验证要求

完成改动后至少做这些检查：

1. `node --check hotkeys\\renderer-hotkeys.js`
2. `Get-Content hotkeys\\custom-shortcuts.json | node -e "const fs=require('fs'); JSON.parse(fs.readFileSync(0,'utf8')); console.log('json-ok')"`

如果改动涉及真实行为，还应尽量做一项运行验证：

- 调试启动 Beta：
  - `tools\\start-plasticity-beta-debug.cmd`
- 调试启动 Stable：
  - `tools\\start-plasticity-stable-debug.cmd`
- 读取当前注入状态：
  - `tools\\debug-hotkeys-status-beta.cmd`
  - `tools\\debug-hotkeys-status-stable.cmd`

## 文档约定

- 新增使用说明：优先写到 `README.md` 或 `docs/how-to-add-hotkeys.md`
- 有排障价值的问题：补一份 `docs/postmortem-YYYY-MM-DD-*.md`
- 研究性内容和长期方案文档继续放在 `docs/`

## Git 约定

- 提交信息遵循 conventional commit，使用中文 subject。
- 不要改历史，不要 `push --force`。
- 推送失败如果提示远端领先，先 `fetch`，再走普通 merge，除非用户明确要求别的策略。
