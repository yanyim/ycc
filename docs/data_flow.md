## 一步：理解数据流动 (The Data Flow)
在接下来的重构中，数据的流动是单向且严格分层的，就像一条不断有新包裹掉上来的传送带：

事件源头 (Source)：你刚刚在 orchestrator.ts 中写的 executeTask 是一个异步生成器（AsyncGenerator）。随着大模型在后台工作，它会源源不断地向外 yield 各种事件包（比如 tool_start, tool_end, message_chunk）。

状态收集器 (State Manager - 位于 App.tsx)：我们在主程序中会有两个核心 React State：

logs (静态日志数组)：专门用来存放已经发生且不可变的事情（比如大老板发话了、工具调用成功了）。这个数组只增不减。

currentAction (动态状态字符串)：专门用来存放正在发生、稍纵即逝的事情（比如正在读取文件...）。这个字符串会被高频覆盖。

渲染引擎 (Renderer - 位于 ChatBoard.tsx)：

引擎把 logs 数组喂给 Ink 的 <Static> 组件。Ink 会把它们像打印机一样印在终端上，印完就忘，绝对不重绘，彻底解决闪烁。

引擎把 currentAction 放在组件最底部普通渲染，每次它改变，只有终端最底部这一行会刷新（Loading 效果）。



## 第二步：输出基础类型与常量 (src/ui/constants.ts)
为了让 App.tsx 和 ChatBoard.tsx 之间有统一的数据协议，我们需要先定义日志的数据结构和角色的视觉规范。

请在你的项目中新建（或覆盖）文件 src/ui/constants.ts，以下是完整代码：