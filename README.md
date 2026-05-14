This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 中文项目文档

当前项目是一个本地数据闭环的首页 MVP，数据通过 `localStorage` 持久化，暂未接入登录、数据库、后端 API 或云同步。

- [重构后的首页架构说明](docs/architecture-after-refactor.md)
- [重构后的数据管理说明](docs/data-management-after-refactor.md)
- [重构后的模块地图](docs/module-map-after-refactor.md)
- [重构后的开发指南](docs/development-guide-after-refactor.md)
- [规则与 UI 对应关系](docs/rules-confirmation.md)
- [热力图日期逻辑说明](docs/heatmap-date-logic.md)
- [UI 功能盘点](docs/ui-inventory.md)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
