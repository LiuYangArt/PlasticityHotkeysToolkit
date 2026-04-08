# Postmortem: Move `Pivot -> Bbox` Hotkey

## 结论

这次不是“能不能绑快捷键”的问题。  
真实难点在于：`Move` 面板里的 `Pivot` 按钮没有把可读语义直接挂在按钮本身上。

最终可行方案是：

1. 用 `move-10-dialog` 作为上下文根节点
2. 在面板里按分组标题找到 `Pivot`
3. 逐个 hover 这组按钮
4. 用 hover 后出现的 tooltip 文本 `Bbox` 反向识别目标按钮
5. 如果 tooltip 识别失败，再回退到当前已验证过的 `value="0"` 按钮
6. 点击后校验激活态是否真的变成 `value="0"`

## 现象

用户目标很明确：

- 在启用 `Move` 工具时
- 给 `Pivot` 里的 `Bbox` 增加快捷键

从截图上能看到：

- 面板标题是 `MOVE`
- 参数分组里有 `Pivot`
- hover 某个按钮时 tooltip 会显示 `Bbox`

但截图本身不能证明：

- `Bbox` 是否存在于按钮 DOM 文本
- 按钮有没有 `title`
- 按钮有没有 `aria-label`
- 哪个节点才是真正接收点击事件的目标

所以如果直接按截图猜实现，风险很高。

## 根因

### 根因 1：按钮本体没有直接暴露语义文本

真实 DOM 抓下来后，`Pivot` 这组三个按钮的共同特点是：

```html
<button ... value="0"></button>
<button ... value="1"></button>
<button ... value="2"></button>
```

也就是说：

- `button.textContent` 基本为空
- `title` 为空
- `aria-label` 为空

所以不能像菜单项那样直接按按钮文字命中。

### 根因 2：真正的语义出现在 hover tooltip

继续抓运行时 DOM 后，hover `Pivot` 三个按钮时会出现：

- `Bbox`
- `Median`
- `Active`

这说明 Plasticity 把按钮语义放进了 tooltip，而不是按钮本体。

所以这类控件的稳定识别顺序应该反过来：

1. 先找到候选按钮组
2. 再逐个 hover
3. 用 tooltip 文本判断目标按钮是谁

### 根因 3：快捷键验证和命令验证不能混成一层

这次还有一个容易误判的点：

- 通过 inspector 直接调用 `setMovePivotBbox()` 能成功
- 但通过自动化注入的 synthetic key event，未能稳定触发 document `keydown`

这说明：

- “命令实现正确”
- 不等于
- “所有自动化发键方式都能代表真实物理按键”

所以验证时必须拆成两层：

1. 命令是否真的能改状态
2. 用户真实按键是否能命中这个命令

## 修复

### 修复 1：新增 `custom:move:set-pivot-bbox`

在 `renderer-hotkeys.js` 里新增命令分支：

```js
case "custom:move:set-pivot-bbox":
  return setMovePivotBbox();
```

### 修复 2：按结构定位 `Pivot` 分组

不是从按钮 icon 开始，而是：

1. 找 `move-10-dialog`
2. 找分组标题为 `Pivot` 的 `flex-col flex-1`
3. 拿到该分组下的可见按钮

### 修复 3：优先按 tooltip `Bbox` 命中

新增的按钮识别逻辑是：

1. 对 `Pivot` 组里的按钮逐个派发 hover
2. 读取可见 tooltip
3. 如果 tooltip 文本等于 `Bbox`，就认定这是目标按钮

### 修复 4：增加 `value="0"` fallback

因为这次真实 DOM 已经验证过：

- `value="0"` = `Bbox`
- `value="1"` = `Median`
- `value="2"` = `Active`

所以当 tooltip 因 UI 时序或样式变化没有命中时，还能回退到 `value="0"`。

### 修复 5：点击后校验激活态

命令不是“发了 click 就算成功”。  
真正的成功条件是：

```js
activeValue === "0"
```

只有激活态真的切到 `value="0"`，才返回成功。

## 验证

本次验证分成三层：

1. 静态校验
   - `node --check hotkeys\\renderer-hotkeys.js`
   - `custom-shortcuts.json` JSON 解析通过
2. 注入状态校验
   - 确认 renderer 版本已提升到 `0.4.3`
   - 确认配置里已有 `move-10-dialog -> shift-b`
3. 真实行为校验
   - 先把 `Pivot` 手动切到 `Median`
   - 再通过 inspector 直接调用 `setMovePivotBbox()`
   - 最终确认 `activeValue` 从 `"1"` 变成 `"0"`

最终已经确认：

- 命令实现可用
- `Pivot` 确实会切到 `Bbox`

## 经验

### 工具面板按钮不要默认按 icon 猜

对这类 UI，优先级应当是：

1. 面板根节点
2. 分组标题
3. tooltip 文本
4. 组件值属性
5. 最后才是图标和位置

### tooltip 不是装饰信息

在这次场景里，tooltip 不是辅助文案，而是按钮的主语义来源。  
如果忽略这一点，就会把问题误判成“缺少 selector”或“按钮不可点击”。

### 验证必须区分“命令”和“发键”

命令能跑通，说明 DOM 命中没问题。  
物理按键能触发，说明输入链路也没问题。  
这两层都要分别验证，不要混成一个结论。

## 相关文件

- `hotkeys\renderer-hotkeys.js`
- `hotkeys\custom-shortcuts.json`
- `README.md`
- `docs\how-to-add-hotkeys.md`
