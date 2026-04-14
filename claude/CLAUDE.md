# 專案核心知識庫

CLAUDE.md 是 `.claude/` 資料夾中最重要的檔案，每次對話開始時會優先載入。
用來建立專案背景、常用指令、開發慣例等核心資訊。

## 專案說明

> 在這裡描述你的專案是什麼、解決什麼問題。

## 常用指令

```bash
# 範例：啟動開發伺服器
npm run dev

# 範例：執行測試
npm test
```

## 開發慣例

- 程式碼風格：...
- 命名規則：...
- Git commit 格式：feat / fix / refactor / docs / test / chore

## 重要注意事項

- 不要直接 push 到 main branch
- PR 需要至少一人審查

## 外部參考

使用 @語法 引入其他檔案，保持本檔案簡潔：

```
@docs/architecture.md
@.claude/rules/api-standards.md
```

---

> 與 rules/ 的區別：CLAUDE.md 放「全專案通用的基礎知識」，rules/ 放「特定領域的詳細規範」。
