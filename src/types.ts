export interface Message {
    id: string; // 🌟 必须：供 Static 组件作为唯一 key 使用
    role: 'ai' | 'user' | 'system';
    content: string;
}