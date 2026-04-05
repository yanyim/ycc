import {createListFilesTool} from './createListFiles'
import {createReadFileTool} from './createReadFile'
import {createGrepSearchTool} from './createGrepSearch'
import {createAnalyzeFileTool} from './createAnalyzeFile'

const PROJECT_ROOT = process.cwd();

// 1. 给 Researcher 组装一个 "只读套餐"
const readOnlyTools = [
    createListFilesTool(PROJECT_ROOT),
    createReadFileTool(PROJECT_ROOT),
    createGrepSearchTool(PROJECT_ROOT),
    createAnalyzeFileTool(PROJECT_ROOT)
];
// const researcherAgent = llm.bindTools(readOnlyTools);

// 2. 如果未来有了写文件的功能，给 Editor 组装一个 "特权套餐"
const editorTools = [
    ...readOnlyTools,
    // createWriteFileTool(PROJECT_ROOT),
    // createEditFileTool(PROJECT_ROOT)
];
// const editorAgent = llm.bindTools(editorTools);