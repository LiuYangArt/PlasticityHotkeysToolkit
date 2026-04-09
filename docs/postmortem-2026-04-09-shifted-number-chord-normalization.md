# Postmortem: `Alt+Shift+4` Hotkey Did Not Match JSON Binding

## 结论

这次问题不是 JSON 没生效，也不是命令实现坏了。  
真实根因是：快捷键归一化逻辑错误地优先使用了 `event.key`，而不是在数字键场景优先使用物理键位 `event.code`。

在浏览器事件里：

- `Alt+4` 通常给出 `event.key === "4"`
- `Alt+Shift+4` 往往给出 `event.key === "$"`

所以即使 JSON 里写的是：

```json
"alt-shift-4": "custom:outliner:activate-parent-folder"
```

旧逻辑实际归一化出来的 chord 却是：

```text
alt-shift-$
```

最终当然匹配不到配置。

最终修复方式是：

- 数字键优先按 `event.code` 归一化
- `Digit4` 和 `Numpad4` 都稳定归一化成 `4`
- 其余按键继续走原来的 `event.key` 分支

## 现象

用户把快捷键从：

```json
"alt-4": "custom:outliner:activate-parent-folder"
```

改成：

```json
"alt-shift-4": "custom:outliner:activate-parent-folder"
```

之后，这个功能不再生效。

当时需要先排除三类常见误判：

1. JSON 改动没有被当前注入实例加载
2. 命令 `custom:outliner:activate-parent-folder` 自身回归
3. `keydown` 进来了，但 chord 文本和 JSON key 不一致

最终第三类才是真问题。

## 根因

### 根因 1：旧的 chord 归一化过度相信 `event.key`

旧代码核心是：

```js
const rawKey = event.key || "";
let key = rawKey;
```

后续默认分支也还是围绕 `rawKey` 处理：

```js
key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey.toLowerCase();
```

这对普通字母键问题不大，但对 `Shift+数字` 不成立。  
因为 `Shift` 会把顶排数字键转换成符号字符：

- `Shift+1` -> `!`
- `Shift+2` -> `@`
- `Shift+3` -> `#`
- `Shift+4` -> `$`

所以代码以为用户按的是“符号键”，而不是“数字 4 键位”。

### 根因 2：配置写的是逻辑上的数字，运行时得到的是符号

用户写：

```json
"alt-shift-4"
```

这表示的是“Alt + Shift + 顶排 4 键”。

但旧运行时代码产出的却是：

```text
alt-shift-$
```

配置和运行时两个世界说的不是同一个东西：

- 配置按键位思考
- 运行时代码按字符结果思考

于是命中失败。

## 修复

### 修复 1：数字键优先按 `event.code` 归一化

新增一个小 helper：

```js
function normalizeCodeKey(code) {
  const digitMatch = code.match(/^Digit([0-9])$/);
  if (digitMatch) {
    return digitMatch[1];
  }

  const numpadMatch = code.match(/^Numpad([0-9])$/);
  if (numpadMatch) {
    return numpadMatch[1];
  }

  return null;
}
```

然后在 `normalizeChord()` 里先取：

```js
let key = normalizeCodeKey(event.code);
```

如果拿不到，再退回原来的 `event.key` 逻辑。

这样做之后：

- `Alt+4` -> `alt-4`
- `Alt+Shift+4` -> `alt-shift-4`

都稳定，不再被 `$` 影响。

### 修复 2：提升 renderer 版本

这次仍然改了 `renderer-hotkeys.js`，所以同步提升：

```js
const VERSION = "0.4.12";
```

否则当前页面只会 `reloadConfig()`，不会替换成新归一化逻辑。

## 为什么一开始看起来像是“配置问题”

表面上看，现象是：

- `alt-4` 能用
- `alt-shift-4` 不能用

很容易误以为：

- JSON key 写法不对
- 需要写成 `alt-shift-$`
- Plasticity 不支持这个组合键

但这些都不是根因。

真实区别只在于：

- 不带 `Shift` 时，`event.key` 恰好和物理键位一致
- 带 `Shift` 时，`event.key` 变成了字符结果

这说明问题发生在“输入归一化层”，不是配置层，也不是命令层。

## 验证

本次验证分三层：

1. 配置层
   - 确认 `custom-shortcuts.json` 里已经是 `alt-shift-4`
2. 运行时代码层
   - `node --check hotkeys\\renderer-hotkeys.js`
   - JSON 校验通过
3. 真实运行层
   - 用隔离 Beta 实例注入新脚本
   - 手动派发这类事件：

```js
new KeyboardEvent("keydown", {
  key: "$",
  code: "Digit4",
  altKey: true,
  shiftKey: true,
})
```

最终 renderer 日志里看到的是：

```json
{
  "chord": "alt-shift-4"
}
```

这说明根因已经被修掉。

当时隔离窗口没有选中的 outliner 行，所以后续结果是：

```text
outliner-no-selected-row
```

这是正常现象，说明 chord 已经命中，只是上下文不满足，不再是按键归一化问题。

## 经验

### 以后做快捷键归一化

- 字母键多数情况下可以用 `event.key`
- 顶排数字键在带 `Shift` 时，不能只信 `event.key`
- 涉及数字键位时，优先看 `event.code`

### 以后改 JSON 绑定不生效时

先区分三层：

1. 配置有没有加载进 renderer
2. 归一化后的 chord 是什么
3. 命令和上下文有没有命中

不要一上来就猜“JSON 写法不支持”。

### 以后看调试信息

- `keydown` 有了，不代表 chord 对了
- chord 对了，不代表 selector 命中了
- selector 命中了，不代表命令实现成功

要继续把输入链路、归一化、selector 命中、命令执行分开看。

## 后续约束

以后如果用户配置：

- `shift-1`
- `alt-shift-2`
- `ctrl-shift-3`
- `alt-shift-4`

这类带 `Shift` 的数字键组合时，默认按“物理数字键位”理解，不按最终字符理解。

不要把这类组合要求用户改写成：

- `shift-!`
- `alt-shift-@`
- `ctrl-shift-#`
- `alt-shift-$`

这会把配置系统变成键盘布局和字符输出的谜题，不可维护。
