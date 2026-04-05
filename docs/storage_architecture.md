# 📚 Code CLI 数据持久化架构与设计规范

## 一、 核心设计哲学 (First Principles)

本 CLI 工具的状态管理与本地数据持久化，严格遵循以下三大核心原则：

1. **唯一事实来源 (Single Source of Truth)**
    * **禁止双写**：业务逻辑层（如 `/init`、`/models` 命令）**绝对禁止**直接调用任何文件系统 API（`fs.writeFile` / `Bun.write`）去修改配置文件。
    * **单向数据流**：所有配置的变更必须且只能通过修改 Zustand 的内存 State 完成。硬盘数据的落盘由 Zustand `persist` 中间件统一接管和触发。
2. **并发防御与原子化落盘 (Concurrency Defense & Atomic Write)**
    * 本地高频 I/O 极易产生竞态条件（Race Condition）。所有的状态序列化写盘操作，必须通过**全局写锁队列（Write Lock Queue）**和**原子化重命名（Atomic Rename）**双重保险来保障，坚决杜绝文件损坏（如 `<NUL>` 零字节乱码）。
3. **拥抱 Bun 原生性能 (Bun Native I/O)**
    * 文件内容的读取和写入，优先使用底层由 Zig 优化的 `Bun.file().text()` 和 `Bun.write()`。
    * 文件系统元数据操作（如目录创建 `mkdir`、文件重命名 `rename`、删除 `unlink`），使用 Node.js 兼容的 `fs/promises` 保障系统级操作的安全性。

---

## 二、 历史踩坑与反模式教训 (Anti-Patterns to Avoid)

在早期的架构中，我们遇到过严重的 `.ycc/config.json` 文件损坏（文件末尾出现大量 `<NUL>` 乱码）问题。未来的开发和维护中必须警惕以下反模式：

### ❌ 反模式 1：分裂脑 (Split Brain / Double I/O)
* **错误做法**：在初始化逻辑中，先用 `fs.writeFile` 写入一份默认配置到硬盘，紧接着调用 `setModels(...)` 修改 Zustand 状态。
* **灾难后果**：Zustand 监听到状态改变会立刻触发 `persist` 再次写盘。导致同一个文件在同一毫秒内被多个异步流同时打开并交叉写入，产生指针错乱和文件损坏。
* **正确做法**：初始化逻辑只负责生成默认对象并赋值给 Zustand State，由 Zustand 引擎单线静默落盘。

### ❌ 反模式 2：裸写硬盘 (Naked Disk Write)
* **错误做法**：直接 `await fs.writeFile('config.json', data)`。
* **灾难后果**：如果写入进行到一半时进程被强杀（如用户按 `Ctrl+C`）或断电，文件会变成残缺的半行 JSON，导致下次启动时 `JSON.parse` 崩溃，工具彻底瘫痪。
* **正确做法**：必须使用 `.tmp` 临时文件 + `fs.rename` 替换机制。

---

## 三、 标准落盘工作流 (The Golden Workflow)

在 `src/storage/storage.ts` 和 `src/storage/sessionStore.ts` 中，所有的数据写盘必须严格套用以下模板机制：

```typescript
// 1. 全局单例写锁队列，将并发写强制转换为串行写
let writeLock: Promise<void> = Promise.resolve();

const safeWrite = async (filePath: string, data: string) => {
    const writeTask = async () => {
        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            
            // 2. 先将完整数据写入带时间戳的隐蔽临时文件
            const tempFilePath = `${filePath}.tmp.${Date.now()}`;
            await Bun.write(tempFilePath, data); 
            
            // 3. 利用 OS 系统调用级的原子操作，瞬间覆盖原文件，绝不产生中间态
            await fs.rename(tempFilePath, filePath);
        } catch (error) {
            console.error(`[Storage Error] 保存失败: ${error}`);
        }
    };

    // 4. 追加到队列尾部排队执行
    writeLock = writeLock.then(writeTask).catch(writeTask);
    await writeLock;
};
```

---

## 四、 存储模块指引 (Storage Modules Guide)

本系统的状态被严格划分为三个 Store，分工如下：

1. **`configStore.ts` (全局配置)**
    * **职责**：保存跨会话的系统级配置（如 API Key、可选模型列表、当前激活的模型）。
    * **持久化**：受 Zustand `persist` 中间件控制，底层使用 `storage.ts` 的原子化防并发引擎，落盘至 `.ycc/config.json`。
    * **初始化补丁 (Hydration Patch)**：在 `onRehydrateStorage` 钩子中，如果发现文件配置为空，会调用 `coreInitLogic` 获取默认值并静默回写，保证系统永远处于可用状态。

2. **`sessionStore.ts` (会话与记忆)**
    * **职责**：保存当前聊天的 Message 历史记录，负责向本地读写会话日志。
    * **持久化**：由于聊天高频且不可预测，该 Store 放弃全局 `persist`，采用**手动受控落盘**。在 `addMessage` 中独立实现了 `Bun.write` -> `fs.rename` 的防腐化原子写盘逻辑，文件按 `[Title]_[Timestamp].json` 的格式分散保存在 `.ycc/sessions/` 目录下。

3. **`runtimeStore.ts` (运行时与 UI)**
    * **职责**：仅保存瞬时状态（如流式输出的 `currentStream`、大模型思考状态 `agentStatus`、当前 UI `mode` 等）。
    * **持久化**：**纯内存管理，绝对不进行硬盘读写**。随着 CLI 进程关闭而立刻销毁。

---

## 五、 给 AI 模型的开发约束 (Directives for Future Models)

当你（大语言模型）在后续会话中被要求修改状态逻辑或新增命令时，请遵守：
1. **禁止直接操作 JSON 文件**：任何涉及到修改 `config.json` 的需求，请通过在 `CommandContext` 中扩充对应的方法（如 `setModels`），去修改 `useConfigStore`。
2. **警惕大体积文件**：使用 `Bun.file()` 时注意大文件的内存占用，优先考虑流式处理或只读文件片段。
3. **维护状态栏一致性**：更新 `runtimeStore` 中的 UI 状态（尤其是 `isGenerating` 和 `agentStatus`）时，务必在 `try...finally` 块中确保最终能被正确复位。