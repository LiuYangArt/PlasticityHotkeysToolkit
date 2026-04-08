# Postmortem: Outliner `Delete empty groups` Hotkey

## 结论

这次问题不是快捷键没有进入 Plasticity。  
真实根因有两个：

1. renderer 注入脚本有版本守卫，代码更新后如果版本号不变，只会 `reloadConfig()`，不会替换已安装的运行时代码。
2. `Delete empty groups` 的入口定位逻辑过于脆弱，错误地依赖了按钮 icon 细节和一组几何假设。

最终修复方式是：

- 每次修改 renderer 运行时代码时同步提升 `VERSION`
- 把三点按钮定位从“猜图标/猜坐标”改成“按 Outliner 真实结构定位工具条和右侧按钮组”

## 现象

调试面板里能看到：

- `keydown {"chord":"ctrl-alt-shift-x", ...}`
- `command {"commandId":"custom:outliner:delete-empty-groups", ...}`

但 toast 同时报过两类错误：

- `unknown-command`
- `overflow-button-not-found`

这说明问题不在键盘输入链路，而在 renderer 命令实现和 DOM 定位实现。

## 根因

### 根因 1：旧 renderer 代码仍然留在页面里

`renderer-hotkeys.js` 里有这段守卫：

```js
if (existing && existing.version === VERSION && typeof existing.reloadConfig === "function") {
  existing.reloadConfig(runtimeConfig);
  return;
}
```

这意味着：

- 如果只是改了命令实现，但没有改 `VERSION`
- 再次注入时不会重装整段脚本
- 页面里仍然跑的是旧版 `runCustomCommand()`

所以会出现：

- 配置里已经有 `custom:outliner:delete-empty-groups`
- 但旧代码里还没有这个分支
- 最终报 `unknown-command`

### 根因 2：三点按钮识别规则太脆

早期实现主要依赖：

- `svg circle` 数量
- 按钮与 `.plasticity-outliner` 的相对几何位置

这个假设在当前 UI 下不稳，因为：

- 三点按钮不在 `.plasticity-outliner` 容器内部
- 它在 `.plasticity-outliner` 上方那一行工具条里
- 更准确的结构是：
  - section root
  - tab row（Outliner / Assets）
  - tool row（3 个按钮）
  - divider
  - `.plasticity-outliner`

所以单纯从 `.plasticity-outliner` 里搜按钮，或者只靠按钮图标形状判断，都会有失效风险。

## 修复

### 修复 1：提升 renderer 版本

每次改运行时代码时同步提升：

```js
const VERSION = "0.4.2";
```

这样重新注入时会真正替换掉旧实现，而不是只刷新 JSON 配置。

### 修复 2：按结构定位三点按钮

最终逻辑改成：

1. 找 `.plasticity-outliner`
2. 回到它的 section root
3. 找到它上方那一行 tool row
4. 在 tool row 的最右侧按钮组里找目标按钮
5. 优先取该组中的三点按钮，失败时再走更弱的 fallback

这比“认三个圆点图标”更接近真实布局，也更能抗 UI 小改动。

## 为什么最初判断会偏

一开始 inspector 抓到的按钮确实是三点按钮，而且 `svg circle` 数量也对。  
但那只是“当前一版 UI 的表象”，不是稳定结构。

后续用户截图里的 `overflow-button-not-found` 实际已经说明：

- 命令执行到了
- 但按钮搜索条件没命中

这时继续围绕快捷键链路排查只会浪费时间，必须回到 DOM 结构本身。

## 验证

本次验证分成两层：

1. 调试面板验证
   - 确认 `keydown`
   - 确认 `commandId`
   - 确认失败原因是否变化
2. 真实结构验证
   - 抓取 Outliner section / tool row / trailing button group 的 DOM 关系
   - 确认右侧按钮组中确实存在目标按钮

最终用户已确认：

- `Ctrl+Alt+Shift+X`
- `Delete empty groups`

在真实使用场景中已经生效。

## 经验

### 以后改 renderer 注入代码

- 只要改了运行时代码，不是只改配置，就必须提升 `VERSION`
- 否则热注入时看到的往往是“新配置 + 旧逻辑”的混合状态

### 以后做 Electron DOM 注入

- 优先绑定稳定结构，不要优先绑定视觉细节
- 图标形状、按钮顺序、类名细节都容易变
- section / toolbar / button-group 这类层级关系通常更稳定

### 以后看调试面板

- `keydown` 有了，不代表命令正确
- `command` 有了，不代表 DOM 命中正确
- 要把输入链路、命令分发、DOM 命中拆开看

## 后续约束

以后新增类似的顶部菜单快捷键时，默认按下面顺序实现：

1. 找当前上下文容器
2. 找容器所在 section
3. 找工具条
4. 找按钮组
5. 打开菜单
6. 按文本命中菜单项

不要再从“猜某个 icon 长什么样”开始。
