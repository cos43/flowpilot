// 完整的翻译配置文件

export const zhTranslations = {
  // 通用
  common: {
    title: "FlowPilot 智能流程图",
    description: "将 draw.io 与对话式 AI 助手结合的智能制图工作台。",
    loading: "加载中...",
    error: "错误",
    cancel: "取消",
    confirm: "确认",
    close: "关闭",
    save: "保存",
    delete: "删除",
    edit: "编辑",
    create: "创建",
    experimental: "实验功能",
    submit: "提交",
    reset: "重置",
    clear: "清空",
    export: "导出",
    import: "导入",
    copy: "复制",
    paste: "粘贴",
    undo: "撤销",
    redo: "重做",
    search: "搜索",
    filter: "筛选",
    sort: "排序",
    settings: "设置",
    help: "帮助",
    back: "返回",
    next: "下一步",
    previous: "上一步",
    finish: "完成",
    success: "成功",
    warning: "警告",
    info: "信息",
  },

  // 导航
  nav: {
    workspace: "画图工作室",
    pptStudio: "PPT 工作室",
    multimodalLab: "FlowPilot 多模态实验室",
  },

  // 工作区
  workspace: {
    focusCanvas: "专注画布",
    showChat: "显示聊天",
    mobileWarning: "FlowPilot Studio 在桌面端体验更佳",
    mobileHint: "请使用更大尺寸的屏幕，以便同时查看 draw.io 编辑器与智能助手。",
  },

  // DrawIO 编辑器
  drawio: {
    loadingEditor: "正在加载 DrawIO 编辑器...",
    loadFailed: "加载 DrawIO 失败",
    loadTimeout: "DrawIO 加载超时。如果 embed.diagrams.net 无法访问，请配置 NEXT_PUBLIC_DRAWIO_BASE_URL 环境变量。",
    solutions: "解决方案：",
    solution1: "检查网络连接是否正常",
    solution2: "如果 embed.diagrams.net 无法访问，创建 .env.local 文件并添加：",
    solution3: "然后重启开发服务器",
  },

  // 语言切换
  locale: {
    zh: "中文",
    en: "English",
    switchTo: "切换语言",
  },

  // 聊天面板
  chat: {
    title: "智能助手",
    placeholder: "输入消息或拖拽图片...",
    send: "发送",
    stop: "停止",
    regenerate: "重新生成",
    newChat: "新建对话",
    clearHistory: "清空历史",
    copyMessage: "复制消息",
    deleteMessage: "删除消息",
    attachFile: "附加文件",
    uploadImage: "上传图片",
    dragDropImage: "拖拽图片到此处",
    noMessages: "暂无消息",
    startConversation: "开始对话",
    thinking: "思考中...",
    generating: "生成中...",
    errorOccurred: "发生错误",
    retryRequest: "重试请求",
    messageCount: "消息数",
    compactMode: "紧凑模式",
    expandMode: "展开模式",
  },

  // 模型配置
  model: {
    title: "模型配置",
    selectModel: "选择模型",
    currentModel: "当前模型",
    provider: "供应商",
    modelName: "模型名称",
    temperature: "温度",
    maxTokens: "最大令牌数",
    topP: "Top P",
    frequencyPenalty: "频率惩罚",
    presencePenalty: "存在惩罚",
    apiKey: "API 密钥",
    apiEndpoint: "API 端点",
    customModel: "自定义模型",
    saveConfig: "保存配置",
    resetConfig: "重置配置",
    testConnection: "测试连接",
 connectionSuccess: "连接成功",
    connectionFailed: "连接失败",
    invalidApiKey: "无效的 API 密钥",
    modelNotAvailable: "模型不可用",
  },

  // 历史记录
  history: {
    title: "历史记录",
    noHistory: "暂无历史记录",
    clearHistory: "清空历史",
    confirmClear: "确认清空所有历史记录？",
    version: "版本",
    timestamp: "时间戳",
    restore: "恢复",
    delete: "删除",
    export: "导出",
    import: "导入",
    currentVersion: "当前版本",
    previousVersion: "上一个版本",
    nextVersion: "下一个版本",
    totalVersions: "共 {count} 个版本",
  },

  // 快捷操作
  quickAction: {
    title: "快捷操作",
    createFlowchart: "创建流程图",
    createMindmap: "创建思维导图",
    createERDiagram: "创建 ER 图",
    createUMLDiagram: "创建 UML 图",
    createOrgChart: "创建组织架构图",
    createNetworkDiagram: "创建网络拓扑图",
    optimizeDiagram: "优化图表",
    exportAsPNG: "导出为 PNG",
    exportAsSVG: "导出为 SVG",
    exportAsPDF: "导出为 PDF",
    exportAsXML: "导出为 XML",
    shareLink: "分享链接",
    embedCode: "嵌入代码",
  },

  // FlowPilot Brief
  brief: {
    title: "FlowPilot Brief",
    subtitle: "智能图表配置",
    description: "通过简单配置，让 AI 更好地理解你的需求",
    intent: "意图",
    intentPlaceholder: "选择你的意图",
    tone: "语气",
    tonePlaceholder: "选择语气风格",
    focus: "重点",
    focusPlaceholder: "选择关注重点",
    guardrail: "约束",
    guardrailPlaceholder: "选择约束条件",
    diagramType: "图表类型",
    diagramTypePlaceholder: "选择图表类型",
    customInstructions: "自定义指令",
    customInstructionsPlaceholder: "输入额外的自定义指令...",
    applyConfig: "应用配置",
    resetConfig: "重置配置",
    savePreset: "保存预设",
    loadPreset: "加载预设",
  },

  // Intent 选项
  intent: {
    create: "创建",
    createDesc: "生成新图表",
    modify: "修改",
    modifyDesc: "调整现有图表",
    analyze: "分析",
    analyzeDesc: "理解和解释图表",
    optimize: "优化",
    optimizeDesc: "改进图表结构和美观度",
    export: "导出",
    exportDesc: "转换为不同格式",
  },

  // Tone 选项
  tone: {
    professional: "专业",
    professionalDesc: "正式、规范的表达",
    casual: "随意",
    casualDesc: "轻松、非正式的表达",
    technical: "技术",
    technicalDesc: "详细、专业的技术表达",
    simple: "简洁",
    simpleDesc: "简明扼要的表达",
  },

  // Focus 选项
  focus: {
    structure: "结构",
    structureDesc: "关注组织和层次",
    details: "细节",
    detailsDesc: "关注完整性和准确性",
    aesthetics: "美观",
    aestheticsDesc: "关注视觉效果",
    efficiency: "效率",
    efficiencyDesc: "关注简洁和速度",
  },

  // Guardrail 选项
  guardrail: {
    strict: "严格",
    strictDesc: "遵守所有规则",
    balanced: "平衡",
    balancedDesc: "平衡灵活性和规则",
    flexible: "灵活",
    flexibleDesc: "允许创造性解释",
  },

  // Diagram Type 选项
  diagramType: {
    flowchart: "流程图",
    flowchartDesc: "展示流程和决策",
    mindmap: "思维导图",
    mindmapDesc: "组织想法和概念",
    erDiagram: "ER 图",
    erDiagramDesc: "数据库实体关系",
    umlDiagram: "UML 图",
    umlDiagramDesc: "软件设计图表",
    orgChart: "组织架构图",
    orgChartDesc: "组织结构和层次",
    networkDiagram: "网络拓扑图",
    networkDiagramDesc: "网络连接和架构",
    swimlane: "泳道图",
    swimlaneDesc: "跨职能流程",
    timeline: "时间线",
    timelineDesc: "事件和里程碑",
  },

  // 比对功能
  comparison: {
    title: "模型比对",
    enableComparison: "启用比对模式",
    disableComparison: "禁用比对模式",
    selectModels: "选择模型进行比对",
    model1: "模型 1",
    model2: "模型 2",
    compareResults: "比对结果",
    sideBySide: "并排对比",
    switch: "切换",
    adopt: "采用此版本",
    reject: "拒绝此版本",
    noResults: "暂无比对结果",
    comparing: "比对中...",
    comparisonComplete: "比对完成",
  },

  // 自动修复
  autoRepair: {
    title: "自动修复",
    enable: "启用自动修复",
    disable: "禁用自动修复",
    repairing: "修复中...",
    repaired: "修复完成",
    repairFailed: "修复失败",
    noIssuesFound: "未发现问题",
    issuesFound: "发现 {count} 个问题",
    viewDetails: "查看详情",
    applyFix: "应用修复",
    ignoreFix: "忽略修复",
  },

  // 智能工具栏
  toolbar: {
    title: "智能工具",
    showcase: "示例",
    blueprint: "蓝图",
    comparison: "比对",
    history: "历史",
    settings: "设置",
    help: "帮助",
  },

  // PPT Studio
  ppt: {
    title: "PPT 工作室",
    createPresentation: "创建演示文稿",
    editPresentation: "编辑演示文稿",
    previewPresentation: "预览演示文稿",
    exportPresentation: "导出演示文稿",
    slideCount: "幻灯片数",
    currentSlide: "当前幻灯片",
    addSlide: "添加幻灯片",
    deleteSlide: "删除幻灯片",
    duplicateSlide: "复制幻灯片",
    moveSlideUp: "上移幻灯片",
    moveSlideDown: "下移幻灯片",
    slideTitle: "幻灯片标题",
    slideContent: "幻灯片内容",
    slideLayout: "幻灯片布局",
    slideTheme: "幻灯片主题",
    slideTransition: "幻灯片过渡",
    slideAnimation: "幻灯片动画",
    speakerNotes: "演讲备注",
    generatingSlide: "生成幻灯片中...",
    slideGenerated: "幻灯片生成完成",
    slideFailed: "幻灯片生成失败",
  },

  // Brief Form (PPT)
  briefForm: {
    title: "演示简报配置",
    topic: "主题",
    topicPlaceholder: "输入演示主题...",
    audience: "目标受众",
    audiencePlaceholder: "输入目标受众...",
    duration: "时长",
    durationPlaceholder: "选择演示时长",
    style: "风格",
    stylePlaceholder: "选择演示风格",
    outline: "大纲",
    outlinePlaceholder: "输入演示大纲...",
    generateOutline: "生成大纲",
    reviewOutline: "审阅大纲",
    approveOutline: "批准大纲",
    editOutline: "编辑大纲",
  },

  // Stepper (PPT)
  stepper: {
    step1: "配置简报",
    step2: "生成大纲",
    step3: "生成幻灯片",
    step4: "预览和导出",
    currentStep: "当前步骤",
    goToStep: "前往步骤",
    nextStep: "下一步",
    previousStep: "上一步",
  },

  // 文件操作
  file: {
    upload: "上传文件",
    download: "下载文件",
    delete: "删除文件",
    rename: "重命名文件",
    move: "移动文件",
    copy: "复制文件",
    selectFile: "选择文件",
    dragDropFile: "拖拽文件到此处",
    fileSize: "文件大小",
    fileType: "文件类型",
    fileName: "文件名称",
    uploadSuccess: "上传成功",
    uploadFailed: "上传失败",
    deleteSuccess: "删除成功",
    deleteFailed: "删除失败",
    fileTooLarge: "文件过大",
    invalidFileType: "不支持的文件类型",
    maxFileSize: "最大文件大小",
    supportedFormats: "支持的格式",
  },

  // 错误信息
  errors: {
    networkError: "网络错误",
    serverError: "服务器错误",
    timeout: "请求超时",
    unauthorized: "未授权",
    forbidden: "禁止访问",
    notFound: "未找到",
    badRequest: "错误的请求",
    internalError: "内部错误",
    unknownError: "未知错误",
    tryAgain: "请重试",
    contactSupport: "联系支持",
  },

  // 成功信息
  success: {
    saved: "保存成功",
    deleted: "删除成功",
    updated: "更新成功",
    created: "创建成功",
    copied: "复制成功",
    exported: "导出成功",
    imported: "导入成功",
    sent: "发送成功",
  },

  // 确认对话框
  confirm: {
    deleteTitle: "确认删除",
    deleteMessage: "确定要删除吗？此操作不可撤销。",
    clearTitle: "确认清空",
    clearMessage: "确定要清空吗？此操作不可撤销。",
    resetTitle: "确认重置",
    resetMessage: "确定要重置吗？所有更改将丢失。",
    discardTitle: "确认丢弃",
    discardMessage: "确定要丢弃更改吗？",
    exitTitle: "确认退出",
    exitMessage: "有未保存的更改，确定要退出吗？",
  },

  // 展示画廊
  showcase: {
    title: "流程图示例",
    viewExample: "查看示例",
    useTemplate: "使用模板",
    noExamples: "暂无示例",
    categories: "分类",
    allCategories: "所有分类",
    recent: "最近",
    popular: "热门",
    featured: "精选",
  },

  // 会话状态
  session: {
    active: "活动",
    inactive: "未活动",
    connecting: "连接中...",
    connected: "已连接",
    disconnected: "已断开",
    reconnecting: "重新连接中...",
    timeout: "超时",
    error: "错误",
  },

  // 工具面板
  toolPanel: {
    title: "工具面板",
    close: "关闭",
    expand: "展开",
    collapse: "收起",
    pin: "固定",
    unpin: "取消固定",
  },

  // 关于页面
  about: {
    subtitle: "AI 驱动的智能流程图创作工具",
    features: {
      title: "核心功能",
      aiPowered: {
        title: "AI 智能生成",
        description: "通过自然语言对话，快速生成专业流程图、架构图等多种图表类型",
      },
      templates: {
        title: "丰富模板库",
        description: "内置多种业务场景模板，快速开始图表创作",
      },
      converter: {
        title: "SVG 转绘",
        description: "将现有 SVG 图表智能转换为可编辑的 Draw.io 格式",
      },
      multiMode: {
        title: "双模式编辑",
        description: "支持 Draw.io 和原生 SVG 两种编辑模式，灵活切换",
      },
    },
    quickStart: {
      title: "快速开始",
      step1: {
        title: "配置 AI 模型",
        description: '点击右上角"更多"菜单中的"配置"，添加你的 AI 模型 API 密钥',
      },
      step2: {
        title: "选择模板或自由创作",
        description: "从模板库选择预设模板，或直接描述你想要的图表内容",
      },
      step3: {
        title: "AI 生成与编辑",
        description: "AI 会根据你的需求生成图表，你可以继续对话进行修改和优化",
      },
    },
    community: {
      title: "交流与反馈",
      description: "欢迎加入 FlowPilot 用户社区，分享使用经验、提出建议或获取帮助。",
      wechat: {
        title: "微信交流群",
        description: "添加作者微信，备注「FlowPilot」即可加入用户交流群",
        contactLabel: "微信号",
        qrPlaceholder: "二维码",
        scanToAdd: "扫码添加微信",
      },
      github: {
        title: "GitHub 开源",
        description: "查看源码、提交 Issue 或参与贡献",
        button: "访问 GitHub",
      },
    },
    footer: {
      rights: "保留所有权利",
    },
  },
};

export const enTranslations = {
  // Common
  common: {
    title: "FlowPilot Smart Flowchart",
    description: "Intelligent diagramming workbench combining draw.io with conversational AI assistant.",
    loading: "Loading...",
    error: "Error",
    cancel: "Cancel",
    confirm: "Confirm",
    close: "Close",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    experimental: "Experimental",
    submit: "Submit",
    reset: "Reset",
    clear: "Clear",
    export: "Export",
    import: "Import",
    copy: "Copy",
    paste: "Paste",
    undo: "Undo",
    redo: "Redo",
    search: "Search",
    filter: "Filter",
    sort: "Sort",
    settings: "Settings",
    help: "Help",
    back: "Back",
    next: "Next",
    previous: "Previous",
    finish: "Finish",
    success: "Success",
    warning: "Warning",
    info: "Information",
  },

  // Navigation
  nav: {
    workspace: "Workspace",
    pptStudio: "PPT Studio",
    multimodalLab: "FlowPilot Multimodal Lab",
  },

  // Workspace
  workspace: {
    focusCanvas: "Focus Canvas",
    showChat: "Show Chat",
    mobileWarning: "FlowPilot Studio works best on desktop",
    mobileHint: "Please use a larger screen to view the draw.io editor and AI assistant simultaneously.",
  },

  // DrawIO Editor
  drawio: {
    loadingEditor: "Loading DrawIO Editor...",
    loadFailed: "Failed to Load DrawIO",
    loadTimeout: "DrawIO loading timeout. If embed.diagrams.net is not accessible, please configure NEXT_PUBLIC_DRAWIO_BASE_URL environment variable.",
    solutions: "Solutions:",
    solution1: "Check if network connection is normal",
    solution2: "If embed.diagrams.net is not accessible, create .env.local file and add:",
    solution3: "Then restart the development server",
  },

  // Locale
  locale: {
    zh: "中文",
    en: "English",
    switchTo: "Switch Language",
  },

  // Chat Panel
  chat: {
    title: "AI Assistant",
    placeholder: "Type a message or drag an image...",
    send: "Send",
    stop: "Stop",
    regenerate: "Regenerate",
    newChat: "New Chat",
    clearHistory: "Clear History",
    copyMessage: "Copy Message",
    deleteMessage: "Delete Message",
    attachFile: "Attach File",
    uploadImage: "Upload Image",
    dragDropImage: "Drag and drop image here",
    noMessages: "No messages yet",
    startConversation: "Start conversation",
    thinking: "Thinking...",
    generating: "Generating...",
    errorOccurred: "An error occurred",
    retryRequest: "Retry request",
    messageCount: "Message count",
    compactMode: "Compact mode",
    expandMode: "Expand mode",
  },

  // Model Configuration
  model: {
    title: "Model Configuration",
    selectModel: "Select Model",
    currentModel: "Current Model",
    provider: "Provider",
    modelName: "Model Name",
    temperature: "Temperature",
    maxTokens: "Max Tokens",
    topP: "Top P",
    frequencyPenalty: "Frequency Penalty",
    presencePenalty: "Presence Penalty",
    apiKey: "API Key",
    apiEndpoint: "API Endpoint",
    customModel: "Custom Model",
    saveConfig: "Save Configuration",
    resetConfig: "Reset Configuration",
    testConnection: "Test Connection",
    connectionSuccess: "Connection Successful",
    connectionFailed: "Connection Failed",
    invalidApiKey: "Invalid API Key",
    modelNotAvailable: "Model Not Available",
  },

  // History
  history: {
    title: "History",
    noHistory: "No history yet",
    clearHistory: "Clear History",
    confirmClear: "Confirm clearing all history?",
    version: "Version",
    timestamp: "Timestamp",
    restore: "Restore",
    delete: "Delete",
    export: "Export",
    import: "Import",
    currentVersion: "Current Version",
    previousVersion: "Previous Version",
    nextVersion: "Next Version",
    totalVersions: "{count} versions total",
  },

  // Quick Actions
  quickAction: {
    title: "Quick Actions",
    createFlowchart: "Create Flowchart",
    createMindmap: "Create Mindmap",
    createERDiagram: "Create ER Diagram",
    createUMLDiagram: "Create UML Diagram",
    createOrgChart: "Create Org Chart",
    createNetworkDiagram: "Create Network Diagram",
    optimizeDiagram: "Optimize Diagram",
    exportAsPNG: "Export as PNG",
    exportAsSVG: "Export as SVG",
    exportAsPDF: "Export as PDF",
    exportAsXML: "Export as XML",
    shareLink: "Share Link",
    embedCode: "Embed Code",
  },

  // FlowPilot Brief
  brief: {
    title: "FlowPilot Brief",
    subtitle: "Intelligent Diagram Configuration",
    description: "Help AI better understand your needs through simple configuration",
    intent: "Intent",
    intentPlaceholder: "Select your intent",
    tone: "Tone",
    tonePlaceholder: "Select tone style",
    focus: "Focus",
    focusPlaceholder: "Select focus area",
    guardrail: "Guardrail",
    guardrailPlaceholder: "Select constraints",
    diagramType: "Diagram Type",
    diagramTypePlaceholder: "Select diagram type",
    customInstructions: "Custom Instructions",
    customInstructionsPlaceholder: "Enter additional custom instructions...",
    applyConfig: "Apply Configuration",
    resetConfig: "Reset Configuration",
    savePreset: "Save Preset",
    loadPreset: "Load Preset",
  },

  // Intent Options
  intent: {
    create: "Create",
    createDesc: "Generate new diagram",
    modify: "Modify",
    modifyDesc: "Adjust existing diagram",
    analyze: "Analyze",
    analyzeDesc: "Understand and explain diagram",
    optimize: "Optimize",
    optimizeDesc: "Improve diagram structure and aesthetics",
    export: "Export",
    exportDesc: "Convert to different formats",
  },

  // Tone Options
  tone: {
    professional: "Professional",
    professionalDesc: "Formal and standardized expression",
    casual: "Casual",
    casualDesc: "Relaxed and informal expression",
    technical: "Technical",
    technicalDesc: "Detailed and professional technical expression",
    simple: "Simple",
    simpleDesc: "Concise and clear expression",
  },

  // Focus Options
  focus: {
    structure: "Structure",
    structureDesc: "Focus on organization and hierarchy",
    details: "Details",
    detailsDesc: "Focus on completeness and accuracy",
    aesthetics: "Aesthetics",
    aestheticsDesc: "Focus on visual effects",
    efficiency: "Efficiency",
    efficiencyDesc: "Focus on simplicity and speed",
  },

  // Guardrail Options
  guardrail: {
    strict: "Strict",
    strictDesc: "Follow all rules",
    balanced: "Balanced",
    balancedDesc: "Balance flexibility and rules",
    flexible: "Flexible",
    flexibleDesc: "Allow creative interpretation",
  },

  // Diagram Type Options
  diagramType: {
    flowchart: "Flowchart",
    flowchartDesc: "Show processes and decisions",
    mindmap: "Mindmap",
    mindmapDesc: "Organize ideas and concepts",
    erDiagram: "ER Diagram",
    erDiagramDesc: "Database entity relationships",
    umlDiagram: "UML Diagram",
    umlDiagramDesc: "Software design diagrams",
    orgChart: "Org Chart",
    orgChartDesc: "Organization structure and hierarchy",
    networkDiagram: "Network Diagram",
    networkDiagramDesc: "Network connections and architecture",
    swimlane: "Swimlane Diagram",
    swimlaneDesc: "Cross-functional processes",
    timeline: "Timeline",
    timelineDesc: "Events and milestones",
  },

  // Comparison
  comparison: {
    title: "Model Comparison",
    enableComparison: "Enable Comparison Mode",
    disableComparison: "Disable Comparison Mode",
    selectModels: "Select models to compare",
    model1: "Model 1",
    model2: "Model 2",
    compareResults: "Comparison Results",
    sideBySide: "Side by Side",
    switch: "Switch",
    adopt: "Adopt This Version",
    reject: "Reject This Version",
    noResults: "No comparison results yet",
    comparing: "Comparing...",
    comparisonComplete: "Comparison Complete",
  },

  // Auto Repair
  autoRepair: {
    title: "Auto Repair",
    enable: "Enable Auto Repair",
    disable: "Disable Auto Repair",
    repairing: "Repairing...",
    repaired: "Repair Complete",
    repairFailed: "Repair Failed",
    noIssuesFound: "No Issues Found",
    issuesFound: "{count} issues found",
    viewDetails: "View Details",
    applyFix: "Apply Fix",
    ignoreFix: "Ignore Fix",
  },

  // Intelligent Toolbar
  toolbar: {
    title: "Intelligence Tools",
    showcase: "Examples",
    blueprint: "Blueprint",
    comparison: "Comparison",
    history: "History",
    settings: "Settings",
    help: "Help",
  },

  // PPT Studio
  ppt: {
    title: "PPT Studio",
    createPresentation: "Create Presentation",
    editPresentation: "Edit Presentation",
    previewPresentation: "Preview Presentation",
    exportPresentation: "Export Presentation",
    slideCount: "Slide Count",
    currentSlide: "Current Slide",
    addSlide: "Add Slide",
    deleteSlide: "Delete Slide",
    duplicateSlide: "Duplicate Slide",
    moveSlideUp: "Move Slide Up",
    moveSlideDown: "Move Slide Down",
    slideTitle: "Slide Title",
    slideContent: "Slide Content",
    slideLayout: "Slide Layout",
    slideTheme: "Slide Theme",
    slideTransition: "Slide Transition",
    slideAnimation: "Slide Animation",
    speakerNotes: "Speaker Notes",
    generatingSlide: "Generating slide...",
    slideGenerated: "Slide generated successfully",
    slideFailed: "Slide generation failed",
  },

  // Brief Form (PPT)
  briefForm: {
    title: "Presentation Brief Configuration",
    topic: "Topic",
    topicPlaceholder: "Enter presentation topic...",
    audience: "Target Audience",
    audiencePlaceholder: "Enter target audience...",
    duration: "Duration",
    durationPlaceholder: "Select presentation duration",
    style: "Style",
    stylePlaceholder: "Select presentation style",
    outline: "Outline",
    outlinePlaceholder: "Enter presentation outline...",
    generateOutline: "Generate Outline",
    reviewOutline: "Review Outline",
    approveOutline: "Approve Outline",
    editOutline: "Edit Outline",
  },

  // Stepper (PPT)
  stepper: {
    step1: "Configure Brief",
    step2: "Generate Outline",
    step3: "Generate Slides",
    step4: "Preview and Export",
    currentStep: "Current Step",
    goToStep: "Go to Step",
    nextStep: "Next Step",
    previousStep: "Previous Step",
  },

  // File Operations
  file: {
    upload: "Upload File",
    download: "Download File",
    delete: "Delete File",
    rename: "Rename File",
    move: "Move File",
    copy: "Copy File",
    selectFile: "Select File",
    dragDropFile: "Drag and drop file here",
    fileSize: "File Size",
    fileType: "File Type",
    fileName: "File Name",
    uploadSuccess: "Upload Successful",
    uploadFailed: "Upload Failed",
    deleteSuccess: "Delete Successful",
    deleteFailed: "Delete Failed",
    fileTooLarge: "File Too Large",
    invalidFileType: "Unsupported File Type",
    maxFileSize: "Maximum File Size",
    supportedFormats: "Supported Formats",
  },

  // Error Messages
  errors: {
    networkError: "Network Error",
    serverError: "Server Error",
    timeout: "Request Timeout",
    unauthorized: "Unauthorized",
    forbidden: "Forbidden",
    notFound: "Not Found",
    badRequest: "Bad Request",
    internalError: "Internal Error",
    unknownError: "Unknown Error",
    tryAgain: "Please Try Again",
    contactSupport: "Contact Support",
  },

  // Success Messages
  success: {
    saved: "Saved Successfully",
    deleted: "Deleted Successfully",
    updated: "Updated Successfully",
    created: "Created Successfully",
    copied: "Copied Successfully",
    exported: "Exported Successfully",
    imported: "Imported Successfully",
    sent: "Sent Successfully",
  },

  // Confirmation Dialogs
  confirm: {
    deleteTitle: "Confirm Delete",
    deleteMessage: "Are you sure you want to delete? This action cannot be undone.",
    clearTitle: "Confirm Clear",
    clearMessage: "Are you sure you want to clear? This action cannot be undone.",
    resetTitle: "Confirm Reset",
    resetMessage: "Are you sure you want to reset? All changes will be lost.",
    discardTitle: "Confirm Discard",
    discardMessage: "Are you sure you want to discard changes?",
    exitTitle: "Confirm Exit",
    exitMessage: "You have unsaved changes. Are you sure you want to exit?",
  },

  // Showcase Gallery
  showcase: {
    title: "Flowchart Examples",
    viewExample: "View Example",
    useTemplate: "Use Template",
    noExamples: "No examples yet",
    categories: "Categories",
    allCategories: "All Categories",
    recent: "Recent",
    popular: "Popular",
    featured: "Featured",
  },

  // Session Status
  session: {
    active: "Active",
    inactive: "Inactive",
    connecting: "Connecting...",
    connected: "Connected",
    disconnected: "Disconnected",
    reconnecting: "Reconnecting...",
    timeout: "Timeout",
    error: "Error",
  },

  // Tool Panel
  toolPanel: {
    title: "Tool Panel",
    close: "Close",
    expand: "Expand",
    collapse: "Collapse",
    pin: "Pin",
    unpin: "Unpin",
  },

  // About Page
  about: {
    subtitle: "AI-Powered Intelligent Diagram Creation Tool",
    features: {
      title: "Core Features",
      aiPowered: {
        title: "AI Smart Generation",
        description: "Generate professional flowcharts, architecture diagrams, and more through natural language conversation",
      },
      templates: {
        title: "Rich Template Library",
        description: "Built-in templates for various business scenarios to quickly start diagram creation",
      },
      converter: {
        title: "SVG Conversion",
        description: "Intelligently convert existing SVG diagrams to editable Draw.io format",
      },
      multiMode: {
        title: "Dual-Mode Editing",
        description: "Support both Draw.io and native SVG editing modes with flexible switching",
      },
    },
    quickStart: {
      title: "Quick Start",
      step1: {
        title: "Configure AI Model",
        description: "Click 'Settings' in the 'More' menu at the top right to add your AI model API key",
      },
      step2: {
        title: "Choose Template or Create Freely",
        description: "Select a preset template from the library or directly describe the diagram you want",
      },
      step3: {
        title: "AI Generation & Editing",
        description: "AI will generate the diagram based on your requirements, and you can continue the conversation to modify and optimize",
      },
    },
    community: {
      title: "Community & Feedback",
      description: "Welcome to join the FlowPilot user community to share experiences, suggestions, or get help.",
      wechat: {
        title: "WeChat Community",
        description: "Add author's WeChat with note 'FlowPilot' to join the user community",
        contactLabel: "WeChat ID",
        qrPlaceholder: "QR Code",
        scanToAdd: "Scan to Add",
      },
      github: {
        title: "GitHub Open Source",
        description: "View source code, submit issues, or contribute",
        button: "Visit GitHub",
      },
    },
    footer: {
      rights: "All rights reserved",
    },
  },
};

export type TranslationKey = keyof typeof zhTranslations;
export type Locale = "zh" | "en";
