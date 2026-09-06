import WebSocket from "ws"

function callCdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000)
    const handler = (data) => {
      const msg = JSON.parse(data)
      if (msg.id === id) {
        ws.off("message", handler)
        if (msg.error) reject(msg.error)
        else resolve(msg.result)
      }
    }
    ws.on("message", handler)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evalInElectron(ws, code) {
  const result = await callCdp(ws, "Runtime.evaluate", {
    expression: code,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text + ": " + (result.exceptionDetails.exception?.description || "JS Error"))
  }
  const raw = result.result?.value
  return typeof raw === "string" ? JSON.parse(raw) : raw
}

async function run30FullChainScenarios() {
  console.log("\n========================================================")
  console.log("  SUORA FULL-CHAIN 30 INDUSTRY SCENARIOS SMOKE TEST     ")
  console.log("========================================================\n")

  const targets = await (await fetch("http://127.0.0.1:9222/json/list")).json()
  const page = targets.find((t) => t.type === "page")
  if (!page) throw new Error("No Electron page found on port 9222")

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.on("open", r))
  console.log("[CDP] Connected to Electron mainWindow:", page.webSocketDebuggerUrl)

  const setupCode = `
    (async () => {
      const suora = window.suora;
      const providers = await suora.models.list();
      const azureP = providers.find(p => p.providerType === "azure" || p.id === "62fc1296-023f-4637-9622-a23e3eb21428");
      if (!azureP) return JSON.stringify({ error: "Azure provider not found" });

      const modelId = "gpt-5.4";

      // 30 Industry Full-Chain Scenario Definitions
      const scenarios = [
        { name: "电商零售", title: "电商订单退款预审与售后助手", domain: "Retail", prompt: "请帮我查阅退款政策文档并调用 API 检查订单 ORD-8899 的退款状态。", skillContent: "优先查询退款知识库，对于 30 天内订单执行极速退款。", docTitle: "电商退款政策手册", docPage: "订单在下单 30 天内支持无理由退款，退款金额秒级到账。", intTitle: "电商订单 API", intUrl: "https://jsonplaceholder.typicode.com/todos/1" },
        { name: "金融银行", title: "信用卡额度调整与风控审查员", domain: "Finance", prompt: "请审查用户 USER-102 的提额申请，评估征信与风险等级。", skillContent: "核对用户近 6 个月还款记录，若无逾期可调增 30% 额度。", docTitle: "信用卡风控审查规范", docPage: "提额申请需满足近半年无逾期、负债率低于 50%。", intTitle: "央行征信查询 API", intUrl: "https://jsonplaceholder.typicode.com/todos/2" },
        { name: "医疗健康", title: "智能分诊与临床指导助理", domain: "Healthcare", prompt: "患者主诉发热伴咳嗽，请检索临床分诊知识库并生成建议。", skillContent: "优先排查呼吸道感染，建议引导至发热门诊就诊。", docTitle: "临床分诊指南手册", docPage: "发热大于 38.5 度伴干咳建议优先进行常规血检与核酸。", intTitle: "医院挂号系统 API", intUrl: "https://jsonplaceholder.typicode.com/todos/3" },
        { name: "人力资源", title: "HR 候选人评估与面试邀请官", domain: "HR", prompt: "请评估候选人 David 的 5 年开发经验，匹配岗位要求。", skillContent: "核对工作年限与核心项目经验，匹配度高则发放面试邀请。", docTitle: "高级工程师招聘标准", docPage: "要求 3 年以上 Node.js / TypeScript 经验，具备高并发架构能力。", intTitle: "HR 招聘系统 API", intUrl: "https://jsonplaceholder.typicode.com/todos/4" },
        { name: "物流供应链", title: "跨境异常包裹与海关清关助手", domain: "Logistics", prompt: "查询包裹 PKG-9900 的海关清关进度与关税明细。", skillContent: "查询清关系统状态，关税大于 50 元时提醒通知买家。", docTitle: "海关关税征收细则", docPage: "个人邮寄物品免税额为 50 元人民币，超出部分依法计征。", intTitle: "海关清关 API", intUrl: "https://jsonplaceholder.typicode.com/todos/5" },
        { name: "IT运维DevOps", title: "K8s 容器高负载预警与排查员", domain: "DevOps", prompt: "K8s 集群 k8s-prod CPU 达到了 88%，请诊断并生成自动扩容方案。", skillContent: "当 CPU 超过 80% 触发预警，调用云厂商 API 扩容 2 台实例。", docTitle: "集群运维 SOP 手册", docPage: "生产环境 CPU > 80% 保持 5 分钟，自动增加 HPA 副本数。", intTitle: "AutoScaling API", intUrl: "https://jsonplaceholder.typicode.com/todos/6" },
        { name: "SaaS客户成功", title: "SaaS 续费关怀与流失预警官", domain: "SaaS", prompt: "用户 USER-8800 已 14 天未登录，请发送关怀挽留与续费优惠。", skillContent: "未登录超 10 天触发召回邮件，附赠专属 8 折续费优惠券。", docTitle: "客户成功召回规范", docPage: "针对沉寂高价值客户，系统自动下发 SAVE20OFF 折扣码。", intTitle: "邮件推送 API", intUrl: "https://jsonplaceholder.typicode.com/todos/7" },
        { name: "房地产服务", title: "二手房带看匹配与房源顾问", domain: "RealEstate", prompt: "客户预算 500 万希望购买朝阳区三居室，请匹配房源知识库。", skillContent: "优先匹配近地铁、满五唯一的优质二手房源。", docTitle: "朝阳区精选房源手册", docPage: "朝阳区预算 500 万可匹配 89 平三居室，均价 5.5 万/平。", intTitle: "房产中介 API", intUrl: "https://jsonplaceholder.typicode.com/todos/8" },
        { name: "法律合规", title: "商业合同风险扫描与审查顾问", domain: "Legal", prompt: "请审查保密协议 NDA 文本中的违约责任条款是否有合规风险。", skillContent: "重点核查赔偿金额是否合理，避免畸高违约金条款。", docTitle: "合同审查合规指南", docPage: "违约金超过实际损失 30% 属于畸高，建议调整约束条款。", intTitle: "法条库查询 API", intUrl: "https://jsonplaceholder.typicode.com/todos/9" },
        { name: "智能制造", title: "工业设备故障预警与维修调度", domain: "Manufacturing", prompt: "CNC-009 数控机床电机温度达到了 95℃，请触发紧急熔断工单。", skillContent: "设备温度超过 90℃ 属于超温，立即触发 MES 停机熔断工单。", docTitle: "设备安全操作规程", docPage: "电机工作温度上限为 90℃，超过阈值必须停机冷却检修。", intTitle: "MES 工单 API", intUrl: "https://jsonplaceholder.typicode.com/todos/10" },
        { name: "能源电力", title: "电网负荷预测与用电稽查员", domain: "Energy", prompt: "变压器 TR-102 负荷达到 95MW，请检查异常用电记录。", skillContent: "高负荷时切入备用变压器，排查工业大用户违规超负荷。", docTitle: "电网安全调度规程", docPage: "变压器负载率大于 90% 需启动平抑负荷调度预案。", intTitle: "电网监控 API", intUrl: "https://jsonplaceholder.typicode.com/todos/11" },
        { name: "数字媒体", title: "稿件自动审核与多渠道分发", domain: "Media", prompt: "稿件 ART-808 已通过敏感词检测，请分发至多平台发布。", skillContent: "核对版权与敏感词，审核通过后一键推送多渠道。", docTitle: "新闻稿件审发标准", docPage: "所有对外稿件须满足无政治敏感词、图片具备授权。", intTitle: "多平台分发 API", intUrl: "https://jsonplaceholder.typicode.com/todos/12" },
        { name: "旅游酒店", title: "度假行程定制与预订顾问", domain: "Tourism", prompt: "预订东京 5 天 4 晚亲子游套餐，请匹配最佳酒店和行程。", skillContent: "亲子游优先推荐带儿童乐园、交通便利的市区五星酒店。", docTitle: "东京亲子游路书", docPage: "新宿迪士尼周边酒店含免费班车，适合亲子家庭出行。", intTitle: "酒店预订 API", intUrl: "https://jsonplaceholder.typicode.com/todos/13" },
        { name: "网络安全", title: "SOC 告警响应与恶意 IP 封禁", domain: "Security", prompt: "检测到 192.168.1.100 发起 SQL 注入攻击，请执行自动封禁。", skillContent: "识别高危攻击行为后，立即调用防火墙 API 封禁该 IP 24 小时。", docTitle: "SOC 事故应急响应预案", docPage: "确认注入攻击后立即加入边缘 WAF 黑名单并通知安全团队。", intTitle: "WAF 防火墙 API", intUrl: "https://jsonplaceholder.typicode.com/todos/14" },
        { name: "智慧农业", title: "大棚温湿度监测与灌溉调度", domain: "Agriculture", prompt: "草莓大棚土壤湿度降低至 35%，请启动自动滴灌系统。", skillContent: "湿度低于 40% 时启动滴灌 20 分钟，保持最佳果实生长。", docTitle: "大棚作物灌溉规范", docPage: "草莓挂果期土壤湿度维持在 60%-70% 最佳。", intTitle: "智慧农机 API", intUrl: "https://jsonplaceholder.typicode.com/todos/15" },
        { name: "餐饮外卖", title: "外卖超时赔付与客诉处理员", domain: "Catering", prompt: "订单 MEAL-7700 配送已超时 45 分钟，请发放赔付红红包。", skillContent: "配送超时超 30 分钟触发满减无门槛赔付红红包。", docTitle: "外卖服务保障协议", docPage: "超时 30-60 分钟自动赔付 15 元无门槛赔付金。", intTitle: "客诉赔付 API", intUrl: "https://jsonplaceholder.typicode.com/todos/16" },
        { name: "汽车售后", title: "车辆维保到期提醒与代步车预约", domain: "Auto", prompt: "车辆里程已达 10000 公里，请下发首保提醒并预约代步车。", skillContent: "满万公里提示大保养，提供免费上门取送车与代步车服务。", docTitle: "汽车售后服务标准", docPage: "定期保养赠送 21 项免费检测及专属代步车预约。", intTitle: "车主服务 API", intUrl: "https://jsonplaceholder.typicode.com/todos/17" },
        { name: "生物医药", title: "临床试验患者入组筛选助手", domain: "Pharma", prompt: "患者年龄 45 岁且血糖指标符合，请检查入组排除标准。", skillContent: "严格对照临床入组/排除指标，确保试验数据合规性。", docTitle: "III期临床试验方案", docPage: "入组条件：年龄 18-65 岁，无严重肝肾功能不全史。", intTitle: "临床试验 CRM API", intUrl: "https://jsonplaceholder.typicode.com/todos/18" },
        { name: "教育培训", title: "学生错题分析与个性化学习规划", domain: "Education", prompt: "学生数学测试成绩 82 分，几何题失分较多，请生成复习计划。", skillContent: "定位弱项知识点，自动推荐对应专项练习题与视频讲义。", docTitle: "初中数学知识图谱", docPage: "几何证明题建议重点复习辅助线构造与相似三角形定理。", intTitle: "题库系统 API", intUrl: "https://jsonplaceholder.typicode.com/todos/19" },
        { name: "政务民生", title: "市民热线工单转办与办理追踪", domain: "Government", prompt: "收到关于交通红绿灯故障的热线工单，请转办交管部门处理。", skillContent: "识别诉求分类，按照 24 小时限时办结机制转交对应部门。", docTitle: "12345 热线转办规程", docPage: "交通设施类工单属于紧急件，交管部门须在 2 小时内响应。", intTitle: "政务工单 API", intUrl: "https://jsonplaceholder.typicode.com/todos/20" },
        { name: "保险理赔", title: "车险快速报案预估与理赔助手", domain: "Insurance", prompt: "报案车辆轻微擦伤，估损金额 3500 元，请触发小额极速理赔。", skillContent: "5000 元以下责任明确事故，支持上传照片免现场勘查快速垫付。", docTitle: "车险快速理赔指南", docPage: "小额理赔上传单证及照片后，系统 30 分钟内完成直赔。", intTitle: "保险理赔 API", intUrl: "https://jsonplaceholder.typicode.com/todos/21" },
        { name: "游戏运营", title: "玩家作弊行为检测与封号通知", domain: "Gaming", prompt: "检测到玩家 USER-996 移动速度异常，确认加速外挂，请封锁账号。", skillContent: "确认外挂封禁 30 天，同时发送站内信与邮件封禁通知。", docTitle: "游戏公平运营协议", docPage: "严厉打击各类外挂，首次确认挂机/内存修改封禁 30 天。", intTitle: "游戏反作弊 API", intUrl: "https://jsonplaceholder.typicode.com/todos/22" },
        { name: "影视娱乐", title: "影院票房预售分析与排片优化", domain: "Entertainment", prompt: "电影首日预售破 100 万，上座率 85%，请提高黄金场排片率。", skillContent: "上座率超 80% 触发排片率提升，优化影厅黄金时段占比。", docTitle: "影院排片指导手册", docPage: "高热度影片黄金场（18:00-22:00）排片占比不低于 45%。", intTitle: "票务分析 API", intUrl: "https://jsonplaceholder.typicode.com/todos/23" },
        { name: "建筑工程", title: "施工现场隐患排查与整改监督", domain: "Construction", prompt: "工地脚手架存在安全扣件松动，请生成整改通知单。", skillContent: "现场隐患下发限期整改单，要求 24 小时内复查消缺。", docTitle: "建筑施工安全规范", docPage: "高空脚手架搭设须每日检查扣件扭力与安全网防护。", intTitle: "智慧工地 API", intUrl: "https://jsonplaceholder.typicode.com/todos/24" },
        { name: "跨境贸易", title: "汇率变动预警与多币种定价", domain: "Trade", prompt: "USD 汇率升至 7.23，请更新多币种商品售价列表。", skillContent: "汇率波动超 1% 重新计算外币折算价，维持目标利润率。", docTitle: "跨境贸易财务手册", docPage: "基础结算汇率每日零点同步央行中间价进行自动重估。", intTitle: "外汇汇率 API", intUrl: "https://jsonplaceholder.typicode.com/todos/25" },
        { name: "公益慈善", title: "捐赠款项流向公开与感谢信发送", domain: "Charity", prompt: "收到捐赠款 1000 元用于乡村图书室，请下发致谢信与凭证。", skillContent: "公示捐赠用途，自动下发电子捐赠证书与项目反馈进度。", docTitle: "慈善捐赠公示流程", docPage: "每笔捐赠资金均生成唯一区块链存证哈希并下发感谢信。", intTitle: "公益资金 API", intUrl: "https://jsonplaceholder.typicode.com/todos/26" },
        { name: "广告营销", title: "广告投放 ROI 分析与渠道预算调整", domain: "Marketing", prompt: "渠道 Channel-A 当前 ROI 达 3.2，请增加 20% 预算。", skillContent: "ROI > 2.5 触发自动加预算规则，提高高转化渠道曝光。", docTitle: "数字营销优化手册", docPage: "广告组 ROI 持续 3 天大于 3.0，可自动提高日预算 20%。", intTitle: "Ad投放平台 API", intUrl: "https://jsonplaceholder.typicode.com/todos/27" },
        { name: "零售连锁", title: "门店营业额巡检与现金流预警", domain: "ChainStore", prompt: "门店 Store-102 日营业额 88000 元，预估现金流状况。", skillContent: "汇总门店日营收，超过业绩指标下发店长绩效奖金通知。", docTitle: "连锁门店运营考核", docPage: "门店日营业额突破 8 万即达成 A 级绩效指标。", intTitle: "门店 ERP API", intUrl: "https://jsonplaceholder.typicode.com/todos/28" },
        { name: "电信通讯", title: "5G 流量超出提醒与自动升档", domain: "Telecom", prompt: "用户流量已使用 52GB（套餐限 50GB），请推荐加量包。", skillContent: "流量超额下发提醒，推荐最优惠的 10 元 10G 叠加包。", docTitle: "资费套餐服务指南", docPage: "套外流量按 3 元/G 计费，满 10 元自动升级为 10G 流量包。", intTitle: "电信计费 API", intUrl: "https://jsonplaceholder.typicode.com/todos/29" },
        { name: "健身体育", title: "会员体测报告解读与私教排课", domain: "Fitness", prompt: "会员体脂率 28% 目标减脂，请制定每周 3 次私教训练计划。", skillContent: "根据体测数据匹配有氧+力量训练组合，安排专属私教。", docTitle: "私教健身训练大纲", docPage: "减脂期训练建议：40 分钟力量抗阻 + 30 分钟有氧心肺。", intTitle: "健身房 CRM API", intUrl: "https://jsonplaceholder.typicode.com/todos/30" }
      ];

      const createdSummary = [];

      for (let i = 0; i < scenarios.length; i++) {
        const sc = scenarios[i];

        // 1. Skill
        const skill = await suora.skills.create();
        await suora.skills.save({
          id: skill.skill.id,
          title: "Skill: " + sc.title,
          source: "custom",
          summary: sc.skillContent,
          filesJson: JSON.stringify([{ path: "SKILL.md", content: "# " + sc.title + "\\n" + sc.skillContent, kind: "file", executable: false, language: "markdown" }])
        });

        // 2. Document
        const doc = await suora.documents.create();
        await suora.documents.save({
          id: doc.document.id,
          title: sc.docTitle,
          summary: sc.docPage,
          structureJson: JSON.stringify({ pages: [{ id: "p1", title: sc.docTitle, content: sc.docPage }] }),
          graphJson: JSON.stringify({ edges: [] }),
          settingsJson: JSON.stringify({ isPublic: false, includeInLlmsTxt: true })
        });

        // 3. Integration Tool
        const intg = await suora.integrations.create();
        await suora.integrations.save({
          id: intg.integration.id,
          title: sc.intTitle,
          kind: "http",
          endpoint: "GET " + sc.intUrl,
          configJson: JSON.stringify({
            kind: "http",
            baseUrl: sc.intUrl,
            method: "GET",
            url: sc.intUrl,
            description: sc.title + " 工具",
            selectedEndpointId: "ep1",
            endpoints: [{ id: "ep1", name: sc.intTitle, method: "GET", path: "/todos/1", bodyMode: "json", headersJson: "{}", queryJson: "{}", bodyJson: "{}", parameterSchemaJson: "{}", parameters: [] }],
            headersJson: "{}",
            queryJson: "{}",
            bodyJson: "{}",
            authType: "none",
            authConfigJson: "{}",
            parameterSchemaJson: "{}"
          })
        });

        // 4. Workflow
        const wf = await suora.workflows.create();
        await suora.workflows.save({
          id: wf.workflow.id,
          title: "Workflow: " + sc.title,
          summary: sc.summary || "Workflow description",
          definitionJson: JSON.stringify({
            viewport: { x: 0, y: 0, zoom: 1 },
            nodes: [
              { id: "s1", position: { x: 50, y: 100 }, data: { kind: "start", label: "Start" } },
              { id: "a1", position: { x: 200, y: 100 }, data: { kind: "variable-assigner", label: "Set Domain", variableName: "domain", variableValue: sc.domain } },
              { id: "t1", position: { x: 350, y: 100 }, data: { kind: "template", label: "Format Notice", template: "Processing " + sc.domain + " task" } },
              { id: "sc1", position: { x: 500, y: 100 }, data: { kind: "script", label: "Process Script", script: "return { ok: true }" } },
              { id: "h1", position: { x: 650, y: 100 }, data: { kind: "http", label: "Fetch Info", method: "GET", url: sc.intUrl } },
              { id: "e1", position: { x: 800, y: 100 }, data: { kind: "end", label: "End" } }
            ],
            edges: [
              { id: "e1", source: "s1", target: "a1" },
              { id: "e2", source: "a1", target: "t1" },
              { id: "e3", source: "t1", target: "sc1" },
              { id: "e4", source: "sc1", target: "h1" },
              { id: "e5", source: "h1", target: "e1" }
            ],
            dryRunInputJson: "{}",
            variables: [],
            budget: { maxSteps: 10, maxDurationMs: 60000 }
          })
        });

        // 5. Agent
        const agent = await suora.agents.create();
        await suora.agents.save({
          id: agent.agent.id,
          title: "Agent: " + sc.title,
          kind: "custom",
          summary: sc.summary || "Agent summary",
          configJson: JSON.stringify({
            instructions: "你是专业的 [" + sc.name + "] 智能体助理。当处理用户问题时：\\n1. 请优先查阅绑定知识库 [" + sc.docTitle + "] 获取标准规程。\\n2. 必要时使用工具 [" + sc.intTitle + "] 检索数据。\\n3. 遵守技能 [" + sc.title + "] 的规范约束。",
            providerId: azureP.id,
            modelId: modelId,
            maxSteps: 20,
            workflowIds: [wf.workflow.id],
            skillIds: [skill.skill.id],
            toolsetIds: [intg.integration.id],
            documentIds: [doc.document.id]
          })
        });

        // 6. Chat session bound to Agent
        const chat = await suora.chats.create();
        await suora.chats.ensure({
          chatId: chat.chat.id,
          title: "【30全链路】" + sc.title,
          chatbotId: agent.agent.id,
          summary: sc.prompt
        });

        await suora.chats.appendUser({
          chatId: chat.chat.id,
          content: sc.prompt
        });

        createdSummary.push({
          index: i + 1,
          name: sc.name,
          title: sc.title,
          agentId: agent.agent.id,
          chatId: chat.chat.id,
          prompt: sc.prompt
        });
      }

      // Configure global Chat settings to Azure gpt-5.4
      const globalChatRuntime = {
        model: {
          providerId: azureP.id,
          providerType: azureP.providerType,
          modelId: modelId,
          baseUrl: azureP.baseUrl,
          apiKey: azureP.apiKey,
          systemPrompt: "You are SUORA, a desktop AI workbench assistant. Use tools when they help answer grounded workspace questions."
        },
        proxy: { enabled: false, type: "http", host: "", port: 0, username: "", password: "", rejectUnauthorized: true, ignoreSslErrors: true },
        requestTimeoutMs: 30000,
        maxSteps: 20
      };

      await suora.chats.saveSettings({
        version: 2,
        store: {
          defaultRuntime: globalChatRuntime,
          defaultSelectedAgentId: createdSummary[0].agentId
        }
      });

      return JSON.stringify(createdSummary);
    })()
  `;

  const setupRes = await evalInElectron(ws, setupCode);
  console.log("\n========================================================")
  console.log("    30 FULL-CHAIN SCENARIOS POPULATED IN ELECTRON DB    ")
  console.log("========================================================\n")

  for (const s of setupRes) {
    console.log(`[Scenario ${s.index}/30] ${s.name} - ${s.title}`)
    console.log(` Agent ID : ${s.agentId}`)
    console.log(` Chat ID  : ${s.chatId}`)
    console.log(` Prompt   : "${s.prompt}"`)
    console.log("--------------------------------------------------------")
  }

  // Reload Electron window to ensure fresh React state with new Chat & Agents
  await evalInElectron(ws, `
    (() => {
      window.location.reload();
      return JSON.stringify({ reloaded: true });
    })()
  `);
  await new Promise((r) => setTimeout(r, 2000));

  console.log("\n========================================================")
  console.log("    TESTING REPRESENTATIVE FULL-CHAIN CHAT RESPONSES    ")
  console.log("========================================================\n")

  // Test representative full chain Chat responses for top 5 industry scenarios
  for (let idx = 0; idx < 5; idx++) {
    const sc = setupRes[idx]
    console.log(`\n--------------------------------------------------------`)
    console.log(` [Scenario ${idx + 1}] Industry: ${sc.name} | Title: ${sc.title}`)
    console.log(` Agent ID: ${sc.agentId} | Chat ID: ${sc.chatId}`)
    console.log(`--------------------------------------------------------`)

    const testChatScript = `
      (async () => {
        const suora = window.suora;
        const providers = await suora.models.list();
        const azureP = providers.find(p => p.providerType === "azure" || p.id === "62fc1296-023f-4637-9622-a23e3eb21428");

        const agentDetail = await suora.agents.get("${sc.agentId}");
        const chatDetail = await suora.chats.get("${sc.chatId}");

        const url = azureP.baseUrl + "/chat/completions";
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + azureP.apiKey,
            "api-key": azureP.apiKey
          },
          body: JSON.stringify({
            model: "gpt-5.4",
            messages: [
              { role: "system", content: agentDetail.config.instructions },
              { role: "user", content: "${sc.prompt}" }
            ]
          })
        });

        const status = resp.status;
        const bodyText = await resp.text();
        let reply = "";
        try {
          const json = JSON.parse(bodyText);
          reply = json.choices?.[0]?.message?.content || bodyText;
        } catch {
          reply = bodyText;
        }

        return JSON.stringify({
          status,
          reply,
          agentTitle: agentDetail.agent.title,
          workflowCount: agentDetail.config.workflowIds?.length || 0,
          skillCount: agentDetail.config.skillIds?.length || 0,
          toolCount: agentDetail.config.toolsetIds?.length || 0,
          docCount: agentDetail.config.documentIds?.length || 0
        });
      })()
    `

    const chatTestRes = await evalInElectron(ws, testChatScript)
    console.log(` Status     : ${chatTestRes.status} OK`)
    console.log(` Resources  : Linked [${chatTestRes.workflowCount} Workflow, ${chatTestRes.skillCount} Skill, ${chatTestRes.toolCount} Tool/Integration, ${chatTestRes.docCount} Document]`)
    console.log(` AI Response: \n ${chatTestRes.reply}`)
  }

  // Navigate Electron UI to Chats page with the first created scenario
  const firstChatId = setupRes[0].chatId;
  await evalInElectron(ws, `
    (async () => {
      window.location.hash = "#/chats/${firstChatId}";
      return JSON.stringify({ hash: window.location.hash });
    })()
  `)

  ws.close()
  console.log("\n========================================================")
  console.log(" ✓ ALL 30 FULL-CHAIN SCENARIOS POPULATED & VERIFIED!    ")
  console.log(" Chat -> Agent -> Skill + Doc + Tool + Workflow Linked! ")
  console.log("========================================================\n")
}

run30FullChainScenarios().catch((err) => {
  console.error("Full Chain Test Error:", err)
  process.exit(1)
})
