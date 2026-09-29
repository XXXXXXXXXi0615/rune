# Rune

![Rune legacy lunar mark](public/branding/lunartide-logo-primary.png)

> Rune 把記憶、閱讀、生活管理與 AI 對話收進同一個本機空間；它也很擅長在你只想改一張卡片時，提醒你底下還壓著三套舊狀態。至少我們現在把邊界寫清楚了。

Rune 是一個 local-first 的個人生活與 AI companion 應用。它以 React、TypeScript、Vite、Zustand 與 Capacitor 建構，主要資料保留在使用者瀏覽器或裝置上。

## Screenshots

公開用截圖尚未選定。為避免把真實日記、健康、聊天或帳務資料混進 repository，本階段不收錄既有私人截圖；加入前應使用全新 demo profile 並通過隱私檢查。

## What is Rune

Rune 把原本分散的生活資料與互動入口放在一個應用 Shell 中：首頁摘要、Chat、Journal、MoonRead、Music、Calendar、Focus、Health、Diet、Ledger、Settings 與本機 companion systems。它不是託管式帳號服務，也不附帶遠端資料庫。

## Core Systems

- Home Dashboard 與 widgets
- Chat、群組互動、語音與 AI provider runtime
- Journal / Memory / Life Graph
- MoonRead 書架、閱讀器與 Reading Memories
- Calendar、Quest、Countdown、Focus / TIDEBOUND
- Music 與本機播放狀態
- Health、Period、Diet、Ledger
- Theme、Wallpaper、Typography 與本機設定
- Capacitor mobile shell

完整盤點見 [Features](docs/features.md)。

## Current Status

目前為 alpha。核心畫面與多個 domain 已可運作，仍有 bundle、CSS minify workaround、真實 provider／裝置驗收及公開資產授權等工作。不要把 roadmap 當 release notes；那是月潮過去最容易犯的漂亮錯誤。

## Tech Stack

- React 19 + React Router 7
- TypeScript 6
- Vite 8
- Zustand 5
- Vitest + Playwright
- Capacitor 8 (Android / iOS shell)

## Getting Started

需求：Node.js 22.23.2 與 npm（以 `.node-version` 為準）。

```bash
npm ci
npm run dev
```

開啟 `http://localhost:5173/`。本機開發不使用 `/lunartide/` prefix。完整說明見 [Getting Started](docs/getting-started.md)。

`npm run dev` 會固定綁定 `127.0.0.1:5173` 並啟用 strict port。不要同時啟動第二個佔用 5173 的 Vite 實例；IPv4／IPv6 各自監聽同一連接埠的平行 dev server 不受支援，會造成 HMR module graph 不一致。

## Project Structure

```text
src/
  ai/          AI provider 與 request runtime
  components/  共用與 domain UI
  features/    可獨立演進的功能模組
  pages/       Route-level pages
  services/    外部與瀏覽器服務整合
  storage/     IndexedDB adapters
  store/       Zustand stores 與 persistence
public/        靜態 product assets、manifest、service worker
e2e/           Playwright acceptance tests
docs/          架構、功能、設計、報告與開發紀錄
```

## Development

```bash
npm run typecheck
npm test
npm run build
npm run build:pages
```

`npm run build` 保持 `/` base；只有 `npm run build:pages` 使用 `/lunartide/`。CI 與 Pages 流程位於 `.github/workflows/`。

## Privacy / Local-first

日記、聊天、健康、帳務、匯入書籍、圖片與 provider credentials 都可能包含敏感資料。不要提交瀏覽器 profile、IndexedDB dump、localStorage export、真實 `.env`、測試錄影或帶真實資料的截圖。Provider 金鑰由應用內本機 credential storage 管理；GitHub Pages 是公開靜態前端，不能替前端秘密保密。

詳見 [Architecture](docs/architecture.md) 與 [Publication Readiness](PUBLICATION_READINESS.md)。

## Roadmap

已完成、進行中、計畫與概念層級分列於 [ROADMAP.md](ROADMAP.md)。

## Documentation

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Features](docs/features.md)
- [Design Language](docs/design-language.md)
- [Known Issues](docs/known-issues.md)
- [Development Log](docs/devlog/README.md)
- [LUNARIS Journal](docs/lunaris-journal/README.md)
- [Changelog](CHANGELOG.md)
- [Third-party Notices](THIRD_PARTY_NOTICES.md)

## License

尚未選定專案授權。除第三方元件各自聲明的授權外，目前不授予複製、修改或散布 Lunartide 原始碼與原創資產的權利。公開 repository 前必須完成授權與第三方資產審核。
