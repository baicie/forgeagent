# Workflow YAML

ForgeAgent Workflow 是轻状态机，不是复杂流程图。

它定义：

- step 顺序
- step 允许工具
- step memory 写入策略
- 审批点
- Console 展示状态

## 路径

```txt
.agents/workflows/*.yaml
```

## 示例

```yaml
id: bugfix
name: Bugfix Workflow
steps:
  - id: context
    type: context_pack
    output: context_pack.md
  - id: edit
    type: agent_loop
    tools:
      - read_file
      - search_text
      - apply_patch
      - get_diff
  - id: validate
    type: validation
    approval: required
  - id: review
    type: readonly_review
  - id: final_approval
    type: approval
    actions:
      - apply
      - commit
      - discard
```

## Step 类型

- `context_pack`：构建上下文包
- `llm`：LLM 规划
- `agent_loop`：主 Agent 循环
- `tool`：单一工具调用
- `validation`：验证反馈
- `readonly_review`：只读审查
- `approval`：最终审批

## 内置 Workflow

默认内置 `bugfix` workflow，无需额外配置即可使用。

## 非目标

Workflow 不替模型思考，不支持复杂流程图，不绕过审批。
