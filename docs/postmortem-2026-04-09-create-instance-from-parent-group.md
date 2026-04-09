# Postmortem: Viewport Object -> Parent Group `Create Instance`

## 结论

这次难点不是“能不能把 `Ctrl+I` 发出去”。  
真实根因是：**Outliner 某一行看起来被点到了，不等于 Plasticity 内部的命令上下文已经从 object 切换到 parent group。**

最开始的错误实现有两个前提都不成立：

1. 误以为 `Create Instance` 在 Outliner 右键菜单里
2. 误以为只要把 parent 行点亮，再发 `Ctrl+I`，Plasticity 就会按 parent group 执行命令

最终可行方案是：

1. 先用 Outliner 结构关系反查选中 object 的 parent group/folder
2. 点击真正接收选择切换的 row clickable wrapper，而不是只点文字 label
3. 显式等待 Outliner 选中状态真正提交完成
4. 只有确认 parent group 已变成当前选中项后，才继续触发 Plasticity 自己的 `Ctrl+I / Create Instance`

## 现象

用户要的行为很具体：

- 在 3D viewport 里选中一个 object
- 按 `Ctrl+Alt+I`
- 不要创建这个 object 自己的 instance
- 而是创建它所在 parent group 的 instance

最初版本上线后，用户反馈：

- `Ctrl+Alt+I` 的效果和直接按 `Ctrl+I` 一样
- 仍然只创建当前 object 的 instance

这说明：

- 自定义快捷键链路已经进入了 renderer 命令
- 但命令上下文没有真正切到 parent group

## 根因

### 根因 1：`Create Instance` 入口判断错了

一开始把它实现成：

1. 找 parent row
2. 打开 row 右键菜单
3. 按文本点 `Create Instance`

但用户后续确认：

- `Create Instance` 不在右键菜单里
- 正确入口是：
  - `F3` 命令搜索 `Create Instance`
  - 或直接 `Ctrl+I`

这意味着第一版实现的动作入口从一开始就错了，不能继续沿这条路修补。

### 根因 2：UI 高亮被误判成“选中已切换”

后面把方案改成：

1. 点击 parent row
2. 立刻发 `Ctrl+I`

但调试状态显示，问题依旧。

关键证据是：

```js
if (window.__plasticityHotkeysLastOutlinerRow === row) {
  score += 100;
  reasons.push("last-pointer-row");
}
```

这条启发式本来只是用来帮助猜测当前 Outliner 选中项。  
但在这次场景里，它会制造假阳性：

- 鼠标刚点过 parent row
- `findSelectedOutlinerRow()` 就会把 parent row 的分数抬高
- 看起来像是“parent 已经成为当前选中项”
- 实际 Plasticity 内部仍然把 object 当作当前命令上下文

结果就是：

- 调试日志里看起来像是已经切到 `Group 3`
- 但 `Ctrl+I` 真正吃到的仍然是 `Extruded.002`

### 根因 3：点错了接收选择切换的节点

最初点击的是行里的 label `span`。  
真实 DOM 抓下来后发现，更稳定的目标其实是 label 外层那个 clickable wrapper：

- 它带 `cursor-pointer`
- 它带 `items-center`
- 它比内层纯文字节点更接近真正接收选择切换的交互层

如果只点 label，本次命令可能看起来“有点击”，但不一定足以让 Plasticity 完成真正的组选中切换。

## 修复

### 修复 1：把命令入口改回官方 `Ctrl+I`

这次不再走不存在的右键菜单。  
最终命令实现改成：

1. 解析 parent row
2. 切换 Outliner 选中
3. 触发 Plasticity 官方 `Ctrl+I`

这样 `Create Instance` 本体仍由 Plasticity 自己执行，我们只负责把上下文切对。

### 修复 2：优先点击 row clickable wrapper

`findOutlinerRowActionTarget()` 新增了更严格的目标选择顺序：

1. 先找 label
2. 再从 label 往上找 clickable ancestor
3. 只有 ancestor 不成立时，才退回 label 或 row 本体

也就是说，不再默认点最内层文字节点，而是优先点更像真实交互入口的包装节点。

### 修复 3：新增“选中状态已提交”确认

这次真正的修复核心是新增：

```js
async function waitForCommittedOutlinerSelection(targetRow, previousRow = null, timeoutMs = 900)
```

它不再问“鼠标刚才点过谁”，而是问三件更接近真实状态的问题：

1. target row 的背景高亮是否真的达到已选中强度
2. previous row 的高亮是否真的退掉
3. 当前最高置信选中项的文本是否真的变成 target row

只有这三项都成立，才认为：

- Outliner 选中已真正提交到 parent group

### 修复 4：在真正触发 `Ctrl+I` 前再留一个短缓冲

即使选中状态已经确认切换，这类桌面 UI 仍可能有内部状态传播时序。  
所以最终在确认成功后，又加了一次短等待：

```js
await waitMs(80);
```

这不是用来“碰运气”，而是给命令上下文状态机一个最小传播窗口，避免刚切换完 UI 立刻执行命令时仍吃到旧上下文。

## 验证

本次验证分成三层：

1. 静态校验
   - `node --check hotkeys\\renderer-hotkeys.js`
   - `hotkeys\\custom-shortcuts.json` JSON 解析通过
2. 注入校验
   - 确认 renderer 版本已提升到 `0.4.16`
   - 确认当前配置里已有：
     - `body:not([gizmo]) -> ctrl-alt-i -> custom:outliner:create-instance-from-parent`
3. 真实行为校验
   - 用户在 Plasticity 中实际测试
   - 最终已确认：
     - `Ctrl+Alt+I` 能创建 parent group 的 instance
     - 不再退化成当前 object 自己的 instance

## 经验

### 经验 1：Outliner 高亮不等于命令上下文已切换

对这种注入型 Electron 项目，不能只看：

- 某一行是不是被点亮了
- 某一行是不是最近一次 pointerdown 命中的目标

真正重要的是：

- Plasticity 内部是不是已经把当前命令选择提交成了新的对象

如果只看 UI 表象，很容易做出“看起来对，实际命令还是吃旧上下文”的假成功。

### 经验 2：启发式分数只能辅助观察，不能充当提交条件

`last-pointer-row` 这类信号适合做 debug 诊断，帮助猜测“现在可能是谁被选中了”。  
但它不能直接作为“可以继续触发 destructive command”的 gate。

凡是后续会触发真实建模命令的场景，都应该用更硬的提交条件。

### 经验 3：点哪个 DOM 节点，语义可能完全不同

同一行 Outliner 里：

- 点文字
- 点 wrapper
- 点 leading icon
- 双击 folder icon

它们在 Plasticity 里的语义并不一定一样。

以后做这类功能时，不要只问“点到了没有”，而要问：

- **点的这个节点，究竟会不会触发真正的选择切换？**

### 经验 4：命令入口要先核实，不要把 UI 假设写进实现

这次最开始最大的偏差，不是代码细节，而是把 `Create Instance` 的入口位置想错了。  
以后遇到同类命令，先确认它到底来自：

1. 行级按钮
2. 顶部菜单
3. 右键菜单
4. 命令搜索
5. 官方快捷键

入口判断一旦错了，后面所有 DOM 工作都会跑偏。

## 相关文件

- `hotkeys\\renderer-hotkeys.js`
- `hotkeys\\custom-shortcuts.json`
- `README.md`
