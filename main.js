// Markdown Editor - 主要JavaScript文件

class MarkdownEditor {
    constructor() {
        this.editor = null;
        this.currentFile = null;
        this.autoSaveTimer = null;
        this.isDarkTheme = false;
        this.wordCount = 0;
        this.charCount = 0;
        
        this.init();
    }
    
    init() {
        this.initCodeMirror();
        this.initEventListeners();
        this.initMarked();
        this.loadFromStorage();
        this.updatePreview();
        this.updateStats();
        this.initTheme();
    }
    
    // 初始化CodeMirror编辑器
    initCodeMirror() {
        const textarea = document.getElementById('markdown-editor');
        this.editor = CodeMirror.fromTextArea(textarea, {
            mode: 'markdown',
            theme: 'default',
            lineNumbers: true,
            lineWrapping: true,
            autofocus: true,
            indentUnit: 4,
            tabSize: 4,
            extraKeys: {
                'Enter': 'newlineAndIndentContinueMarkdownList',
                'Ctrl-S': () => this.saveFile(),
                'Ctrl-O': () => this.openFile(),
                'Ctrl-N': () => this.newDocument(),
                'Ctrl-B': () => this.formatText('bold'),
                'Ctrl-I': () => this.formatText('italic'),
                'Ctrl-K': () => this.formatText('link')
            }
        });
        
        // 监听编辑器变化
        this.editor.on('change', () => {
            this.updatePreview();
            this.updateStats();
            this.scheduleAutoSave();
        });
        
        // 监听滚动同步
        this.editor.on('scroll', () => {
            this.syncScroll();
        });
    }
    
    // 初始化事件监听器
    initEventListeners() {
        // 文件操作
        document.getElementById('new-btn').addEventListener('click', () => this.newDocument());
        document.getElementById('open-btn').addEventListener('click', () => this.openFile());
        document.getElementById('save-btn').addEventListener('click', () => this.saveFile());
        document.getElementById('export-btn').addEventListener('click', () => this.exportH5());
        
        // 主题切换
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        
        // 全屏模式
        document.getElementById('fullscreen-btn').addEventListener('click', () => this.toggleFullscreen());
        
        // Markdown格式按钮
        document.getElementById('heading-btn').addEventListener('click', () => this.insertHeading());
        document.getElementById('bold-btn').addEventListener('click', () => this.formatText('bold'));
        document.getElementById('italic-btn').addEventListener('click', () => this.formatText('italic'));
        document.getElementById('link-btn').addEventListener('click', () => this.formatText('link'));
        document.getElementById('image-btn').addEventListener('click', () => this.formatText('image'));
        document.getElementById('list-ul-btn').addEventListener('click', () => this.insertList('ul'));
        document.getElementById('list-ol-btn').addEventListener('click', () => this.insertList('ol'));
        document.getElementById('code-btn').addEventListener('click', () => this.insertCodeBlock());
        document.getElementById('quote-btn').addEventListener('click', () => this.insertQuote());
        
        // 文件输入
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileSelect(e));
        
        // 拖拽支持
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => this.handleDrop(e));
        
        // 移动端标签切换
        document.querySelectorAll('.mobile-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchMobilePanel(e.target.dataset.panel));
        });
        
        // 键盘快捷键提示
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveFile();
                        break;
                    case 'o':
                        e.preventDefault();
                        this.openFile();
                        break;
                    case 'n':
                        e.preventDefault();
                        this.newDocument();
                        break;
                }
            }
        });
    }
    
    // 初始化Marked配置
    initMarked() {
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (err) {
                        console.error('Highlight error:', err);
                    }
                }
                return hljs.highlightAuto(code).value;
            },
            langPrefix: 'hljs language-',
            breaks: true,
            gfm: true
        });
        
        // 添加自定义渲染器
        const renderer = new marked.Renderer();
        
        // 自定义链接渲染
        renderer.link = function(href, title, text) {
            const isExternal = href.startsWith('http');
            const target = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
            return `<a href="${href}" ${target} ${title ? `title="${title}"` : ''}>${text}</a>`;
        };
        
        // 自定义图片渲染
        renderer.image = function(href, title, text) {
            return `<figure>
                <img src="${href}" alt="${text}" ${title ? `title="${title}"` : ''}>
                ${title ? `<figcaption>${title}</figcaption>` : ''}
            </figure>`;
        };
        
        marked.use({ renderer });
    }
    
    // 更新预览
    updatePreview() {
        const content = this.editor.getValue();
        const previewElement = document.getElementById('preview-content');
        
        if (content.trim() === '') {
            previewElement.innerHTML = `
                <div class="text-gray-500 dark:text-gray-400 text-center mt-8">
                    <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                    </svg>
                    <p>开始编写 Markdown 文档，预览将在这里实时显示</p>
                </div>
            `;
        } else {
            previewElement.innerHTML = marked.parse(content);
            // 为代码块添加复制功能
            this.addCopyButtons();
        }
    }
    
    // 为代码块添加复制按钮
    addCopyButtons() {
        const codeBlocks = document.querySelectorAll('.preview-content pre');
        codeBlocks.forEach(block => {
            if (!block.querySelector('.copy-btn')) {
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-btn absolute top-2 right-2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded opacity-0 hover:opacity-100 transition-opacity';
                copyBtn.textContent = '复制';
                copyBtn.addEventListener('click', () => {
                    const code = block.querySelector('code');
                    if (code) {
                        navigator.clipboard.writeText(code.textContent);
                        copyBtn.textContent = '已复制';
                        setTimeout(() => {
                            copyBtn.textContent = '复制';
                        }, 2000);
                    }
                });
                
                block.style.position = 'relative';
                block.appendChild(copyBtn);
                
                block.addEventListener('mouseenter', () => {
                    copyBtn.style.opacity = '1';
                });
                
                block.addEventListener('mouseleave', () => {
                    copyBtn.style.opacity = '0';
                });
            }
        });
    }
    
    // 更新统计信息
    updateStats() {
        const content = this.editor.getValue();
        const words = content.trim().split(/\s+/).filter(word => word.length > 0);
        const chars = content.length;
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        this.wordCount = words.length;
        this.charCount = chars;
        
        document.getElementById('word-count').textContent = `字数: ${this.wordCount}`;
        document.getElementById('char-count').textContent = `字符: ${this.charCount}`;
    }
    
    // 定时自动保存
    scheduleAutoSave() {
        clearTimeout(this.autoSaveTimer);
        document.getElementById('save-status').textContent = '未保存';
        document.getElementById('save-status').className = 'text-yellow-600';
        
        this.autoSaveTimer = setTimeout(() => {
            this.saveToStorage();
            document.getElementById('save-status').textContent = '已自动保存';
            document.getElementById('save-status').className = 'text-green-600';
        }, 2000);
    }
    
    // 保存到本地存储
    saveToStorage() {
        const content = this.editor.getValue();
        localStorage.setItem('markdown-content', content);
        localStorage.setItem('markdown-filename', this.currentFile || 'untitled.md');
    }
    
    // 从本地存储加载
    loadFromStorage() {
        const content = localStorage.getItem('markdown-content');
        const filename = localStorage.getItem('markdown-filename');
        
        if (content) {
            this.editor.setValue(content);
            this.currentFile = filename || 'untitled.md';
            this.updateDocumentTitle();
        }
    }
    
    // 新建文档
    newDocument() {
        if (this.editor.getValue().trim() !== '' && !confirm('当前文档未保存，确定要新建文档吗？')) {
            return;
        }
        
        this.editor.setValue('');
        this.currentFile = null;
        this.updateDocumentTitle();
        this.showNotification('已创建新文档', 'success');
    }
    
    // 打开文件
    openFile() {
        document.getElementById('file-input').click();
    }
    
    // 处理文件选择
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.editor.setValue(e.target.result);
            this.currentFile = file.name;
            this.updateDocumentTitle();
            this.showNotification(`已打开: ${file.name}`, 'success');
        };
        reader.readAsText(file);
    }
    
    // 处理文件拖拽
    handleDrop(event) {
        event.preventDefault();
        const files = event.dataTransfer.files;
        
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.editor.setValue(e.target.result);
                    this.currentFile = file.name;
                    this.updateDocumentTitle();
                    this.showNotification(`已打开: ${file.name}`, 'success');
                };
                reader.readAsText(file);
            } else {
                this.showNotification('请拖拽 Markdown 文件', 'error');
            }
        }
    }
    
    // 保存文件
    saveFile() {
        const content = this.editor.getValue();
        const filename = this.currentFile || 'untitled.md';
        
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.saveToStorage();
        document.getElementById('save-status').textContent = '已保存';
        document.getElementById('save-status').className = 'text-green-600';
        
        this.showNotification('文件已保存', 'success');
    }
    
    // H5导出功能
    exportH5() {
        const content = this.editor.getValue();
        const htmlContent = this.generateH5Content(content);
        const filename = (this.currentFile || 'document').replace(/\.md$/, '') + '.html';
        
        const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('H5文件已导出', 'success');
    }
    
    // 生成H5内容
    generateH5Content(markdownContent) {
        const htmlBody = marked.parse(markdownContent);
        const title = this.currentFile ? this.currentFile.replace(/\.md$/, '') : 'Markdown Document';
        
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
    <style>
        :root {
            --primary-color: #1e293b;
            --secondary-color: #3b82f6;
            --bg-color: #fefefe;
            --surface-color: #f8fafc;
            --text-color: #1e293b;
            --text-muted: #64748b;
            --border-color: #e2e8f0;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            line-height: 1.7;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        h1, h2, h3, h4, h5, h6 {
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            font-weight: 600;
            line-height: 1.3;
        }
        
        h1 { font-size: 2rem; }
        h2 { font-size: 1.5rem; }
        h3 { font-size: 1.25rem; }
        h4 { font-size: 1.125rem; }
        h5 { font-size: 1rem; }
        h6 { font-size: 0.875rem; }
        
        p {
            margin-bottom: 1rem;
        }
        
        ul, ol {
            margin-bottom: 1rem;
            padding-left: 2rem;
        }
        
        li {
            margin-bottom: 0.25rem;
        }
        
        blockquote {
            border-left: 4px solid var(--secondary-color);
            padding-left: 1rem;
            margin: 1rem 0;
            color: var(--text-muted);
            font-style: italic;
        }
        
        code {
            background-color: var(--surface-color);
            padding: 0.125rem 0.375rem;
            border-radius: 0.25rem;
            font-family: 'Fira Code', 'Consolas', monospace;
            font-size: 0.875em;
        }
        
        pre {
            background-color: var(--surface-color);
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
            margin: 1rem 0;
        }
        
        pre code {
            background: none;
            padding: 0;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
        }
        
        th, td {
            border: 1px solid var(--border-color);
            padding: 0.5rem;
            text-align: left;
        }
        
        th {
            background-color: var(--surface-color);
            font-weight: 600;
        }
        
        a {
            color: var(--secondary-color);
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        img {
            max-width: 100%;
            height: auto;
            border-radius: 0.5rem;
            margin: 1rem 0;
        }
        
        figure {
            margin: 1rem 0;
        }
        
        figcaption {
            text-align: center;
            color: var(--text-muted);
            font-size: 0.875rem;
            margin-top: 0.5rem;
        }
        
        hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 2rem 0;
        }
    </style>
</head>
<body>
    ${htmlBody}
</body>
</html>`;
    }
    
    // 插入标题
    insertHeading() {
        const cursor = this.editor.getCursor();
        const line = this.editor.getLine(cursor.line);
        
        if (line.startsWith('#')) {
            // 已经有标题，升级标题级别
            const match = line.match(/^(#+)\s*/);
            if (match && match[1].length < 6) {
                const newLine = '#'.repeat(match[1].length + 1) + ' ' + line.substring(match[0].length);
                this.editor.replaceRange(newLine, {line: cursor.line, ch: 0}, {line: cursor.line, ch: line.length});
            }
        } else {
            // 没有标题，添加一级标题
            this.editor.replaceRange('# ' + line, {line: cursor.line, ch: 0}, {line: cursor.line, ch: line.length});
        }
    }
    
    // 格式化文本
    formatText(type) {
        const selection = this.editor.getSelection();
        const cursor = this.editor.getCursor();
        
        if (!selection) {
            this.showNotification('请先选择文本', 'warning');
            return;
        }
        
        let formattedText = '';
        switch(type) {
            case 'bold':
                formattedText = `**${selection}**`;
                break;
            case 'italic':
                formattedText = `*${selection}*`;
                break;
            case 'link':
                const url = prompt('请输入链接URL:', 'https://');
                if (url) {
                    formattedText = `[${selection}](${url})`;
                }
                break;
            case 'image':
                const imageUrl = prompt('请输入图片URL:');
                if (imageUrl) {
                    const alt = prompt('请输入图片描述:', selection);
                    formattedText = `![${alt}](${imageUrl})`;
                }
                break;
        }
        
        if (formattedText) {
            this.editor.replaceSelection(formattedText);
        }
    }
    
    // 插入列表
    insertList(type) {
        const cursor = this.editor.getCursor();
        const line = this.editor.getLine(cursor.line);
        
        if (type === 'ul') {
            this.editor.replaceRange('- ' + line, {line: cursor.line, ch: 0}, {line: cursor.line, ch: line.length});
        } else {
            this.editor.replaceRange('1. ' + line, {line: cursor.line, ch: 0}, {line: cursor.line, ch: line.length});
        }
    }
    
    // 插入代码块
    insertCodeBlock() {
        const cursor = this.editor.getCursor();
        const language = prompt('请输入编程语言 (例如: javascript, python, html):', 'javascript');
        const codeBlock = language ? `\`\`\`${language}\n\n\`\`\`` : '\`\`\`\n\n\`\`\`';
        
        this.editor.replaceRange(codeBlock, cursor);
        
        // 将光标移动到代码块内部
        const newCursor = {line: cursor.line + 1, ch: 0};
        this.editor.setCursor(newCursor);
    }
    
    // 插入引用
    insertQuote() {
        const cursor = this.editor.getCursor();
        const line = this.editor.getLine(cursor.line);
        
        this.editor.replaceRange('> ' + line, {line: cursor.line, ch: 0}, {line: cursor.line, ch: line.length});
    }
    
    // 同步滚动
    syncScroll() {
        // 这里可以实现编辑器和预览区的同步滚动
        // 由于复杂性，暂时简化处理
    }
    
    // 切换主题
    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        
        if (this.isDarkTheme) {
            document.documentElement.setAttribute('data-theme', 'dark');
            this.editor.setOption('theme', 'material-darker');
        } else {
            document.documentElement.removeAttribute('data-theme');
            this.editor.setOption('theme', 'default');
        }
        
        localStorage.setItem('markdown-theme', this.isDarkTheme ? 'dark' : 'light');
    }
    
    // 初始化主题
    initTheme() {
        const savedTheme = localStorage.getItem('markdown-theme');
        if (savedTheme === 'dark') {
            this.isDarkTheme = true;
            document.documentElement.setAttribute('data-theme', 'dark');
            this.editor.setOption('theme', 'material-darker');
        }
    }
    
    // 切换全屏
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
    
    // 切换移动端面板
    switchMobilePanel(panel) {
        document.querySelectorAll('.mobile-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-panel="${panel}"]`).classList.add('active');
        
        document.querySelectorAll('.editor-panel, .preview-panel').forEach(p => {
            p.classList.remove('active');
        });
        
        if (panel === 'editor') {
            document.getElementById('editor-panel').classList.add('active');
        } else {
            document.getElementById('preview-panel').classList.add('active');
        }
    }
    
    // 更新文档标题
    updateDocumentTitle() {
        document.getElementById('document-title').textContent = this.currentFile || 'untitled.md';
    }
    
    // 显示通知
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg text-white z-50 fade-in ${
            type === 'success' ? 'bg-green-500' :
            type === 'error' ? 'bg-red-500' :
            type === 'warning' ? 'bg-yellow-500' :
            'bg-blue-500'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // 添加动画
        anime({
            targets: notification,
            translateX: [300, 0],
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutQuart'
        });
        
        // 3秒后自动移除
        setTimeout(() => {
            anime({
                targets: notification,
                translateX: [0, 300],
                opacity: [1, 0],
                duration: 300,
                easing: 'easeInQuart',
                complete: () => {
                    document.body.removeChild(notification);
                }
            });
        }, 3000);
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new MarkdownEditor();
});
