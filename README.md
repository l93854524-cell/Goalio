# Goalio

Goalio 是一个手机优先的生活与攒钱目标规划网页。它会优先为未来的基础生活和固定支出留出空间，再计算当前可以安心留给目标的金额，并评估一笔额外消费对目标日期的影响。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。默认体验数据与最终设计参考一致，可以直接走完首次设置。

## 验证

```bash
npm test
npm run lint
npm run build
```

## Demo 日期控制

需要验证跨日进度时，以以下方式启动：

```bash
NEXT_PUBLIC_GOALIO_DEMO_DATE=true npm run dev
```

日期控制仅在显式启用后显示。生产构建未设置该变量时无法修改业务日期。

## 数据与邀请码

余额、收入、支出、目标和历史记录保存在当前浏览器的本地存储中。清理浏览器数据会清除这些内容。

当前邀请码页面使用本地演示适配。向外部用户发布前，需要将邀请码验证接入服务端数据库与设备绑定接口。财务字段无需发送给服务端。

## 资料

- `GOALIO_DIRECTION.md`：产品与计算原则
- `GOALIO_COPY_GUIDE.md`：文案规则
- `final-design-reference/`：12 个页面的最终视觉参考
- `docs/superpowers/specs/2026-09-06-goalio-mvp-design.md`：设计说明
- `docs/superpowers/plans/2026-09-06-goalio-mvp.md`：实施计划
