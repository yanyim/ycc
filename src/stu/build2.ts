import { feature } from 'bun:bundle'; // 这里的 feature 是编译期宏

declare const IS_ADVANCED_MODE: boolean;

// 模拟项目的条件加载逻辑
// 注意：必须使用 require 配合 IS_ADVANCED_MODE 这种布尔常量，Bun 的 DCE 才会生效
const AdvancedTool = feature('IS_ADVANCED_MODE')
    ? require('./secret-tool.ts').secretAction
    : null;

console.log("程序已启动...");

if (AdvancedTool) {
    AdvancedTool();
} else {
    console.log("当前是基础版，高级功能代码已从包中彻底剔除。");
}