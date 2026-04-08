# Plasticity 快捷键系统调研

## 目标

本文档用于沉淀对 Plasticity 快捷键系统的调研结论，重点回答以下问题：

1. Plasticity 现有快捷键系统是怎么组织和调用的。
2. 现有 `keymap.json` 能配置什么，不能配置什么。
3. 为什么“选中文件夹后按 Enter 设为 Active Folder”不能直接靠官方配置完成。
4. 如果要做非官方扩展，最合理的注入层在哪里。

当前结论基于只读调研，不包含任何程序修改。

## 研究范围

- 应用安装目录：`C:\Users\LiuYang\AppData\Local\plasticity-beta`
- 当前安装版本：`app-26.1.0-beta34`
- 关键渲染字节码：`C:\Users\LiuYang\AppData\Local\plasticity-beta\app-26.1.0-beta34\resources\app\.webpack\renderer\app_window.compiled\index.jsc`
- 用户配置软链：`C:\Users\LiuYang\.plasticity`
- 用户真实配置目录：`D:\ArtPresets\Plasticity\Profile\config\v2\`

## 结论摘要

- Plasticity 不是“没有快捷键系统”，而是有一套比较完整的 `selector + key chord + command id` 体系。
- 用户层 `keymap.json` 确实在生效，而且支持按局部 UI 作用域绑定命令。
- 安装包主逻辑和渲染逻辑已经被 bytenode 编译成 `.jsc`，所以直接改安装包不是首选路径。
- 在左侧面板相关逻辑中，确实存在“激活条目”的内部处理函数。
- 但目前没有找到任何公开命令 ID 可以明确对应“Set Active Folder”。
- 因此，“Enter -> Active Folder”大概率不能通过官方 `keymap.json` 直接配置，只能靠非官方注入去复用现有交互。

## 1. 安装包结构与可修改性

Plasticity 当前不是源码态应用，而是 Electron 打包产物。

关键文件：

- `C:\Users\LiuYang\AppData\Local\plasticity-beta\app-26.1.0-beta34\resources\app\package.json`
- `C:\Users\LiuYang\AppData\Local\plasticity-beta\app-26.1.0-beta34\resources\app\.webpack\main\index.js`
- `C:\Users\LiuYang\AppData\Local\plasticity-beta\app-26.1.0-beta34\resources\app\.webpack\main\index.compiled.jsc`
- `C:\Users\LiuYang\AppData\Local\plasticity-beta\app-26.1.0-beta34\resources\app\.webpack\renderer\app_window.compiled\index.jsc`

其中主进程入口声明为：

```json
{
  "main": ".webpack/main"
}
```

而 `.webpack/main/index.js` 只是加载编译后的 `index.compiled.jsc`。这说明两件事：

- 真正业务逻辑不再是可直接阅读的普通 JS。
- 想通过“改几行源码”来加功能，成本会非常高。

这也是为什么本文不把“直接 patch 安装目录字节码”作为优先方案。

## 2. 官方快捷键系统的真实入口

用户层配置真实存在，而且确实在生效。

当前用户 keymap 文件在：

- `D:\ArtPresets\Plasticity\Profile\config\v2\keymap.json`

其中已经存在局部作用域绑定，例如：

```json
"body:not([gizmo]) plasticity-outliner": {
  "alt-1": "outliner:focus",
  "alt-2": "outliner:isolate"
}
```

以及全局作用域绑定，例如：

```json
"body:not([gizmo])": {
  "f3": "view:modal:command-palette",
  "ctrl-space": "view:radial:DrawShape",
  "ctrl-i": "command:create-instance"
}
```

这说明官方快捷键体系至少包含三层：

1. **作用域选择器**
   - 形式很像 CSS selector。
   - 例如 `body:not([gizmo]) plasticity-outliner`。
   - 含义是“只有当当前焦点或事件上下文位于这个 UI 区域时，这组快捷键才参与匹配”。

2. **按键组合**
   - 例如 `alt-1`、`ctrl-space`、`shift-space`。
   - 说明系统会把浏览器/渲染层原始键盘事件归一化成内部 chord 表达式。

3. **命令 ID**
   - 例如 `outliner:focus`、`view:modal:command-palette`、`command:create-instance`。
   - 说明最终不是直接把按键绑定到 DOM 事件，而是绑定到 command registry 中的命令。

## 3. 官方快捷键调用链推断

结合用户 `keymap.json`、字节码中提取出的 selector 文本、命令字符串和组件字符串，可以把官方调用链大致还原为：

```text
keydown
  -> chord normalization
  -> selector/context matching
  -> command id lookup
  -> command dispatcher
  -> registered handler
  -> component/state update
```

更具体一点：

```text
用户按键
  -> 渲染层收到 keydown
  -> 系统根据当前 UI 作用域匹配 selector
  -> 找到对应 chord 的 command id
  -> 调度到内部命令处理器
  -> 执行业务逻辑
```

这套系统的核心价值是：**只要动作已经注册成公开命令，就可以靠配置覆盖；如果动作只是组件内部 handler，就没法直接在 `keymap.json` 里引用。**

## 4. 已确认的局部作用域

在渲染层字节码中，可以提取到这些关键 selector 文本：

```text
body:not([gizmo]) .plasticity-assets
body:not([gizmo]) .plasticity-outliner
```

说明以下事实已经基本成立：

- `assets` 面板和 `outliner` 面板都被纳入快捷键系统的作用域模型。
- 这两个区域理论上都支持独立按键绑定。
- 关键限制不在于“区域不能绑键”，而在于“有没有对应命令可绑”。

## 5. 已确认的公开命令

### 5.1 Assets 相关公开命令

从渲染字节码中提取到的 `assets:` 命令只有这几条：

```text
assets:material:select-all
assets:navigate:up
assets:navigate:down
assets:rename
```

这组命令说明：

- 资产面板支持键盘导航。
- 资产面板支持重命名。
- 资产面板存在针对材质的局部动作。
- 但没有看到任何“激活文件夹”类命令。

### 5.2 Outliner 相关公开命令

提取到的 `outliner:` 命令包括：

```text
outliner:delete-empty-groups
outliner:focus
outliner:isolate
outliner:rename
outliner:search
outliner:navigate:up
outliner:navigate:down
outliner:navigate:expand
outliner:navigate:collapse
outliner:navigate:up:add
outliner:navigate:down:add
outliner:root:expand:recursive
outliner:root:collapse:recursive
outliner:group:delete
outliner:group:dissolve
outliner:group:new-subgroup
outliner:group:expand:recursive
outliner:group:collapse:recursive
outliner:group:select:children:recursive
outliner:item:new-group:here
outliner:item:new-group:root
outliner:item:move:root
outliner:item:set-material
outliner:item:fork-material
outliner:item:remove-material
outliner:item:set-active-construction-plane
outliner:item:set-active-construction-plane-and-orient-camera
```

这里可以看到一个很重要的对比：

- 如果某个动作被官方公开，命令名通常会非常明确。
- 例如 `outliner:item:set-active-construction-plane` 这种命名就很直白。
- 但没有任何同风格的 `set-active-folder` 命令。

这构成了“当前动作未公开”的核心证据。

## 6. 已确认的内部组件动作

在同一份渲染字节码里，还能提取到以下字符串：

```text
handleActivate
onActivate
handleSelectReal
handleSelectVirtual
```

以及 Outliner 组件相关标识：

```text
Outliner
OutlinerItem
OutlinerItemActions
OutlinerToolbar
OutlinerSearch
AssetItem
```

这说明：

- “激活条目”这件事本身是存在的。
- 这个动作至少在组件层有处理函数。
- 它很可能就是双击行为背后的内部实现之一。

但是这里的 `handleActivate` 和 `onActivate` 更像组件私有回调，而不是公开命令注册项。

## 7. 对 “Select folder” 字符串的修正判断

调研过程中曾经提取到字符串：

```text
Select folder
```

后来对其附近上下文继续展开后，确认它来自设置面板里的备份目录选择功能，附近文本是：

```text
Backup path
You can leave the "Backup path" blank, Plasticity will keep backups in a folder next to your save file...
```

所以这里的 `Select folder` 与左侧面板里的文件夹激活无关，不能当作 “Active Folder 命令存在” 的证据。

## 8. 为什么 `Enter -> Active Folder` 不能直接写进官方 keymap

根因不是 `Enter` 不能绑定，而是 **没有找到可绑定的公开 command id**。

问题可以拆成两层：

### 8.1 `Enter` 本身是否可识别

可识别。

渲染层字节码里能看到：

```text
enter
Enter
Return
NumpadEnter
keydown
makeCustomKeyboardEvent
```

这说明基础键盘事件体系没有问题。

### 8.2 “Set Active Folder” 是否是公开命令

目前证据指向：**不是公开命令，至少还没发现公开命令字符串。**

因此下面这种配置很可能写不了：

```json
"body:not([gizmo]) .plasticity-assets": {
  "enter": "assets:set-active-folder"
}
```

原因不是 selector 不支持，也不是 `Enter` 不支持，而是这个命令 ID 很可能根本不存在。

## 9. 默认 keymap 与用户 keymap 的关系

安装包里存在一个默认 keymap 文件：

- `C:\Users\LiuYang\AppData\Local\plasticity-beta\app-26.1.0-beta34\resources\app\.webpack\main\dot-plasticity\keymap.json`

当前文件内容是：

```json
{}
```

这反而说明：

- 安装包里的“默认快捷键全集”并不依赖这份 JSON 明文保存。
- 默认键位大概率直接编译进了内部命令系统或初始化代码。
- 用户层 `keymap.json` 更像覆盖层，而不是完整定义。

## 10. 非官方扩展的注入层比较

如果要给“官方没有暴露到配置文件”的动作增加快捷键，理论上有四类做法。

### 10.1 OS 层自动化

例子：

- AutoHotkey
- UIAutomation
- Win32 输入模拟

优点：

- 不碰安装目录。
- 上手最快。
- 容易做成开机或启动后自动生效。

缺点：

- 只能根据窗口、焦点、鼠标位置或无障碍树做判断。
- 对复杂语义动作不稳。
- 容易因为 UI 改版而失效。

适用场景：

- 做临时 workaround。
- 快速验证某个快捷键 workflow 是否值得长期实现。

### 10.2 渲染层运行时注入

核心思想：

- 不直接改应用字节码。
- 在 Plasticity 渲染进程启动后，把一段自定义 JS 注入到页面上下文。
- 这段 JS 负责监听特定按键，并复用现有内部交互。

优点：

- 能直接感知 DOM、焦点、选中项和已有前端行为。
- 可以尽量复用现有双击逻辑。
- 侵入性比 patch `.jsc` 低很多。

缺点：

- 需要先解决“如何把 JS 注进去”。
- 注入方式是否稳定，要看 Electron 版本和运行参数。

适用场景：

- 做真正可维护的非官方快捷键扩展。
- 给“未公开命令”补桥接层。

### 10.3 启动器 + 运行时注入

核心思想：

- 不直接改 Plasticity 本体。
- 由自定义启动器启动 Plasticity。
- 启动后自动连接到渲染层并注入扩展脚本。
- 自己维护一份 `custom-shortcuts.json`，独立于官方 `keymap.json`。

优点：

- 持久化能力比一次性 DevTools 注入强。
- 升级后只要 DOM/交互没大改，就能延续。
- 比直接 patch 安装目录更可控。

缺点：

- 实现复杂度高于单次注入。
- 仍然要维护兼容性。

适用场景：

- 想长期给 Plasticity 补非官方快捷键，而不改官方安装包。

### 10.4 直接 patch 安装包

核心思想：

- 修改 `.jsc` 或围绕其加载器做 monkey patch。

优点：

- 理论上控制力最强。

缺点：

- 成本最高。
- 升级必然覆盖。
- 逆向、测试、回滚都麻烦。
- 风险远高于前几种路线。

适用场景：

- 只有当前三种路线都不通，且必须长期本地定制时再考虑。

## 11. 推荐路线

当前最推荐的路线是：

**启动器或附加进程 + 渲染层运行时注入 + 自定义 overlay 配置文件**

原因：

- 现有官方系统已经能解决“公开命令”的快捷键。
- 我们真正缺的是“未公开命令”的桥接层。
- 这个桥接层最自然的位置就在渲染层，因为双击激活本来就是渲染层交互。
- 相比直接 patch `.jsc`，运行时注入更容易回退、调试和升级适配。

## 12. 推荐的非官方调用链

建议把非官方扩展设计成两层：

### 12.1 官方层

继续保留官方 `keymap.json` 处理已经公开的命令。

```text
keydown
  -> official selector match
  -> official command id
  -> official dispatcher
  -> official handler
```

### 12.2 自定义层

对官方没有暴露的动作，增加我们自己的 overlay。

```text
keydown
  -> custom selector/context match
  -> custom command id
  -> custom adapter
  -> call existing UI behavior
```

比如可以定义：

```json
{
  "body:not([gizmo]) .plasticity-assets": {
    "enter": "custom:assets:set-active-folder"
  }
}
```

其中 `custom:assets:set-active-folder` 不是 Plasticity 官方命令，而是我们自己的桥接动作。

## 13. “Set Active Folder” 的推荐桥接方式

对于这个具体需求，建议优先按以下顺序实现：

### 第一优先级：复用当前选中项的双击行为

思路：

- 找到当前选中 folder 对应的 DOM 节点。
- 在 `Enter` 时给它派发与双击等价的事件序列。

优点：

- 最贴近现有行为。
- 不需要先逆向内部 store。

风险：

- 如果双击逻辑不是由 DOM `dblclick` 驱动，而是 React 内部手动判定，则这条路可能不够。

### 第二优先级：直接调用组件激活回调链

思路：

- 继续逆向 `handleActivate / onActivate` 附近调用链。
- 找到选中条目数据结构和激活函数入口。
- 在 `Enter` 时直接调用该逻辑。

优点：

- 比模拟 UI 事件更稳。

风险：

- 逆向成本更高。
- 需要更深入理解前端内部状态。

### 第三优先级：把该动作补注册成新的内部命令

思路：

- 深入 patch 渲染逻辑。
- 新增一个可被 `keymap.json` 调用的命令，例如 `custom:set-active-folder`。

优点：

- 最终形式最漂亮。

风险：

- 已经接近真正改应用内部逻辑。
- 维护成本与升级成本都显著上升。

## 14. 官方文档侧的佐证

官方资源页：

- `https://www.plasticity.xyz/resources`

官方手册首页：

- `https://doc.plasticity.xyz/`

已确认的官方文案：

```text
The official manual for Plasticity 3D. All keyboard shortcuts. Updated daily!
Command List & Shortcut Keys
Shortcut Key List (PDF)
```

这进一步证明：

- Plasticity 本身确实重视快捷键体系。
- 只是并非所有 UI 动作都被公开成用户可配置命令。

## 15. 最终判断

对于“选中文件夹后按 Enter，把它设为 Active Folder”这个具体需求，当前判断是：

- **能做。**
- **但大概率不能纯靠官方 `keymap.json` 做。**
- **最佳路线是非官方渲染层桥接，而不是 Electron 主进程 `globalShortcut`。**

如果后续进入实现阶段，应该优先验证的是：

1. 能否稳定识别当前选中的 folder 节点。
2. 对该节点派发 `dblclick` 是否能复用现有激活行为。
3. 如果不行，再继续逆向 `handleActivate / onActivate` 的调用链。

## 参考路径

- 安装目录：`C:\Users\LiuYang\AppData\Local\plasticity-beta`
- 应用入口：`C:\Users\LiuYang\AppData\Local\plasticity-beta\app-26.1.0-beta34\resources\app\package.json`
- 主进程 loader：`C:\Users\LiuYang\AppData\Local\plasticity-beta\app-26.1.0-beta34\resources\app\.webpack\main\index.js`
- 主进程字节码：`C:\Users\LiuYang\AppData\Local\plasticity-beta\app-26.1.0-beta34\resources\app\.webpack\main\index.compiled.jsc`
- 渲染字节码：`C:\Users\LiuYang\AppData\Local\plasticity-beta\app-26.1.0-beta34\resources\app\.webpack\renderer\app_window.compiled\index.jsc`
- 用户配置软链：`C:\Users\LiuYang\.plasticity`
- 用户 keymap：`D:\ArtPresets\Plasticity\Profile\config\v2\keymap.json`
- 用户 settings：`D:\ArtPresets\Plasticity\Profile\config\v2\settings.json`
