# Postmortem: Viewport Object -> Parent Group `Create Instance`

## 结论

这次需求不是“给 `Create Instance` 换一个快捷键”这么简单。  
真实难点有两个：

1. 一开始把 `Create Instance` 的入口判断错了，误以为它在 outliner 行级菜单里。
2. 后来改成“先切 parent，再发官方 `Ctrl+I`”后，又把“UI 看起来像切到 parent 了”误判成“Plasticity 的命令上下文真的切到 parent 了”。

最终稳定做法是：

1. 先从当前选中 object 的 outliner 行，向上解析最近的父 `Folder / Group`
2. 点击真正接收选中事件的 row clickable 节点，而不是只点 label 文本节点
3. 不再用“最后一次 pointer 命中了 parent 行”当成功
4. 必须等待 outliner 选中状态真正提交完成后，再触发官方 `Ctrl+I`

## 现象

用户要的是：

- 在 3D viewport 里选中一个 object
- 按 `Ctrl+Alt+I`
- 不创建这个 object 的 instance
- 而是创建它所属 parent group / folder 的 instance

第一次实现后，用户立刻指出一个前提错误：

- `Create Instance` 不在 outliner 右键菜单里
- 它的真实入口是：
  - `F3 -> 搜索 Create Instance`
  - 或者直接 `Ctrl+I`

第二次实现改成“先切 parent，再发 `Ctrl+I`”之后，日志表面看起来像是成功了：

- `rowText: "Group 3"`
- `focusConfirmed: true`
- `shortcut: "ctrl-i"`
- `handled: true`

但真实行为仍然是：

- 只创建了当前 object 的 instance
- 没有创建整个 group 的 instance

这说明：

- `Ctrl+I` 确实发出去了
- 但 Plasticity 最终吃到的命令上下文仍然是 object，而不是 parent group

## 根因

### 根因 1：一开始把命令入口前提判断错了

第一版实现把 `Create Instance` 当成了“打开某个菜单，再按文本点菜单项”的动作。  
这个前提直接被用户的实际使用路径否定了。

这类问题的经验是：

- 看到一个动作在 UI 里“像菜单命令”
- 不代表它的真实命令入口就在该菜单

如果真实入口其实是：

- command palette
- 全局命令注册表
- 官方快捷键

那继续围绕“菜单文本命中”去实现，方向从一开始就偏了。

### 根因 2：把 `last-pointer-row` 当成了“选中已切换”的证据

第二版实现里，`findSelectedOutlinerRow()` 的打分规则包含：

```js
if (window.__plasticityHotkeysLastOutlinerRow === row) {
  score += 100;
  reasons.push("last-pointer-row");
}
```

而 `Ctrl+Alt+I` 的执行流程里，又会先 synthetic click parent row。

结果就是：

1. parent row 刚被点过
2. `last-pointer-row` 分数立刻加上去
3. 选中识别器会过早把 parent 当成“当前选中项”

但这只是“鼠标刚点到这里了”，不是 “Plasticity 内部的对象选择上下文已经切换完成了”。

日志里最典型的一次就是：

- `Group 3` 的分数高于 `Extruded.002`
- 但 `Extruded.002` 仍然保留更强的真实选中语义
- 最终 `Ctrl+I` 仍按 object 在执行

### 根因 3：UI 高亮变化和命令上下文变化不是同一时刻

这次最关键的经验不是 DOM selector，而是时序。

对 Plasticity 这类 Electron + 应用状态机界面来说：

1. synthetic click 先打到某个 row 节点
2. outliner 视觉高亮可能先变化
3. 真正的内部 selection / command context 可能稍后才提交

如果在第 2 步和第 3 步之间立刻发 `Ctrl+I`，就会出现：

- UI 看起来像已经切到 group
- 但命令仍然按旧 object 执行

所以问题本质不是“有没有点中 parent”，而是“有没有等到 parent 真的成为当前命令上下文”。

### 根因 4：点 label `span` 不一定等于点中真正接收选择的节点

最初为了切 parent，优先命中的目标是：

- `span.font-medium.truncate`

但运行时探针显示，真正更稳定的点击目标通常是外层 clickable wrapper，例如：

```text
div.inline-flex.cursor-pointer.items-center...
```

只点 label 文本节点时：

- 事件虽然能冒泡
- 但不一定总能稳定命中 Plasticity 用来切换选择的那一层组件

所以后续实现改成：

- 优先找 label 的 clickable ancestor
- 找不到再退回 label 或 row

## 修复

### 修复 1：命令链路改成“切 parent 后触发官方 `Ctrl+I`”

不再走错误的菜单命中链路。  
最终命令入口固定为：

1. 找当前 object 对应的 outliner 行
2. 找最近的父 container 行
3. 确认 parent 真正成为当前选中上下文
4. 再触发官方 `Ctrl+I`

### 修复 2：点击目标从 label 改成 clickable ancestor 优先

新增的行点击目标选择规则是：

1. 先找 label
2. 再找 label 最近的 clickable ancestor
3. 优先命中带 `cursor-pointer / items-center` 的外层节点
4. 只有在这条链路不存在时才回退

这比直接点 `span` 更贴近真实交互层。

### 修复 3：新增 `waitForCommittedOutlinerSelection()`

这次真正解决问题的核心不是“多等一会儿”，而是“等对信号”。

最终确认 parent 选中已提交的判据是三条同时成立：

```js
const committed = targetAlpha >= 0.1 &&
  (previousAlpha <= 0.02) &&
  chosenRowText === targetRowText;
```

也就是：

1. parent row 的背景透明度进入真实选中强度
2. 原先 object row 的选中背景已经退掉
3. 当前最高置信的选中项文本也已经变成 parent

只有这三条同时满足，才继续发 `Ctrl+I`。

### 修复 4：把失败证据写进结果对象

为了以后不再盲猜，这次在失败结果里保留了：

- `focusCommitReason`
- `focusTargetAlpha`
- `focusPreviousAlpha`
- `focusChosenRow`
- `focusSelectionSnapshot`

这样当用户再次反馈“看起来像没切对”时，可以直接判断：

- 是 parent 没点中
- 还是点中了但旧 object 还没退选
- 还是选中视觉已变但 chosen row 仍然不对

## 验证

本次验证分成三层：

1. 静态验证
   - `node --check hotkeys\renderer-hotkeys.js`
   - `custom-shortcuts.json` JSON 解析通过
2. 注入验证
   - 确认 renderer 版本提升到 `0.4.16`
   - 确认运行中的 Plasticity 窗口已经加载这版逻辑
3. 真实行为验证
   - 用户实际测试 `Ctrl+Alt+I`
   - 最终确认它不再等价于普通 `Ctrl+I`
   - 而是会对 parent group 创建 instance

最终用户已确认：

- `Ctrl+Alt+I`
- 现在已经按 parent group 生效

## 经验

### 不要把“动作在 UI 里出现在哪”直接当成“命令入口在哪”

如果用户明确说：

- 真正入口是 command palette
- 或真正入口是官方快捷键

那就不要继续围绕某个菜单去猜实现。

### `last-pointer-row` 只能当弱信号，不能当上下文切换完成的证据

它最多说明：

- 鼠标刚碰过这一行

不能说明：

- 应用内部 selection 已提交
- 后续命令一定会按这行执行

### 视觉高亮和命令上下文要分开验证

这次最重要的排障顺序应该记住：

1. 先看点击有没有发出去
2. 再看高亮有没有变
3. 再看旧选中有没有退掉
4. 最后才看命令是不是按新上下文执行

不要看到高亮变了就默认命令上下文也变了。

### 这类“先切上下文，再触发官方命令”的热键必须显式等待提交完成

以后凡是类似下面这种模式：

- 切 active folder
- 切当前 group
- 切当前 tool / panel context
- 然后立刻发官方命令

都不要只靠一个 synthetic click 然后马上继续。  
必须设计“上下文已提交”的稳定判据。

## 相关文件

- `hotkeys\renderer-hotkeys.js`
- `hotkeys\custom-shortcuts.json`
- `README.md`
- `docs\postmortem-2026-04-09-create-instance-from-parent.md`
