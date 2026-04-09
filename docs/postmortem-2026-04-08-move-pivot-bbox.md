# Postmortem: Transform `Pivot -> Bbox` Hotkey

## 结论

这次不是“能不能绑快捷键”的问题。  
真实难点在于：`Move / Scale / Rotate` 这类 transform 面板里的 `Pivot` 按钮没有把可读语义直接挂在按钮本身上。

最终可行方案是：

1. 用当前可见的 transform dialog 作为上下文根节点
2. 在面板里按分组标题找到 `Pivot`
3. 逐个 hover 这组按钮
4. 用 hover 后出现的 tooltip 文本 `Bbox` 反向识别目标按钮
5. 如果 tooltip 识别失败，再回退到当前已验证过的 `value="0"` 按钮
6. 点击后主动清理这次 synthetic hover 留下的 tooltip 副作用
7. 最后校验激活态是否真的变成 `value="0"`

## 现象

用户目标很明确：

- 在启用 `Move / Scale / Rotate` 工具时
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

- 通过 inspector 直接调用 `setTransformPivotBbox()` 能成功
- 但通过自动化注入的 synthetic key event，未能稳定触发 document `keydown`

这说明：

- “命令实现正确”
- 不等于
- “所有自动化发键方式都能代表真实物理按键”

所以验证时必须拆成两层：

1. 命令是否真的能改状态
2. 用户真实按键是否能命中这个命令

### 根因 4：synthetic hover 会留下 tooltip 残留副作用

这次问题后半段真正踩坑的地方，不是“找不到 Bbox”，而是“找到了以后，tooltip 会一直留在屏幕上”。

原因是：

1. 为了识别 `Bbox`，实现里会对 `Pivot` 按钮逐个派发 synthetic hover
2. Plasticity 的 tooltip 生命周期不完全等同于浏览器默认 hover 行为
3. 即使后续已经 click 到正确按钮，之前 synthetic hover 拉起的 tooltip 仍可能保持可见

也就是说，这类基于 hover tooltip 做语义识别的实现，天然会带来一个副作用：

- 识别逻辑本身会污染界面状态

如果不把这一步副作用显式回收，功能虽然“切到了 Bbox”，但用户会看到一个悬浮 tooltip 卡在屏幕上。

## 修复

### 修复 1：新增 `custom:transform:set-pivot-bbox`

在 `renderer-hotkeys.js` 里新增命令分支：

```js
case "custom:transform:set-pivot-bbox":
  return setTransformPivotBbox();
```

### 修复 2：按结构定位 `Pivot` 分组

不是从按钮 icon 开始，而是：

1. 找当前可见的 transform dialog，例如：
   - `move-10-dialog`
   - `scale-16-dialog`
   - `rotate-13-dialog`
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

### 修复 6：点击后主动收起本次命令制造出来的 tooltip

最开始直觉上容易认为：

- 既然是 synthetic hover 拉起的 tooltip
- 那么补一组 synthetic `leave/out` 应该就够了

但真实验证说明这还不够。
仅靠 synthetic `leave/out`，`Bbox` tooltip 仍可能残留。

最终稳定方案是两段式处理：

1. 对目标按钮补发 synthetic unhover
2. 短暂等待 UI 时序推进
3. 定向移除当前仍然可见、且文本为 `Bbox` 的 tooltip

也就是说，修复不是“只模拟鼠标离开”，而是：

- `unhover`
- 加一点时序缓冲
- 再显式清掉这次命令自己制造出来的同名 tooltip

这样做的好处是：

- 只处理当前命令明确制造出来的 tooltip
- 不需要改动别的面板行为
- 对 `Move / Scale / Rotate` 共用实现同样成立

## 验证

本次验证分成三层：

1. 静态校验
   - `node --check hotkeys\\renderer-hotkeys.js`
   - `custom-shortcuts.json` JSON 解析通过
2. 注入状态校验
   - 确认 renderer 版本已提升到包含 transform 通用命令与 tooltip 清理修复的版本
   - 本次最终验证版本为 `0.4.9`
   - 确认配置里已有：
     - `move-10-dialog -> shift-b`
     - `scale-16-dialog -> shift-b`
     - `rotate-13-dialog -> shift-b`
3. 真实行为校验
   - 先把 `Pivot` 手动切到 `Median`
   - 再通过 inspector 直接调用 `setTransformPivotBbox()`
   - 最终确认 `activeValue` 从 `"1"` 变成 `"0"`
   - 同时确认屏幕上不再残留 `Bbox` tooltip

最终已经确认：

- 命令实现可用
- `Pivot` 确实会切到 `Bbox`
- tooltip 不会残留在屏幕上

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

### 用 tooltip 做识别时，必须同时设计退出路径

如果命令要靠 synthetic hover 触发 tooltip，再用 tooltip 反查目标按钮，那么“如何收场”必须和“如何识别”一起设计。

这次的经验是：

1. 不能默认认为 `hover -> leave` 就等于 tooltip 一定会消失
2. 运行时 UI 组件可能还有额外状态机或延迟
3. 必要时要定向清理本次命令自己制造出来的 tooltip 残留

否则就会出现“功能成功了，但 UI 被污染了”的假成功。

### 验证必须区分“命令”和“发键”

命令能跑通，说明 DOM 命中没问题。  
物理按键能触发，说明输入链路也没问题。  
这两层都要分别验证，不要混成一个结论。

## 相关文件

- `hotkeys\renderer-hotkeys.js`
- `hotkeys\custom-shortcuts.json`
- `README.md`
- `docs\how-to-add-hotkeys.md`
