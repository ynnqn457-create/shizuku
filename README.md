# しずく (shizuku)

個人用の統合メモアプリ。Vite + React 製。

## Vercelへのデプロイ手順

1. GitHub にこのフォルダをアップロード(新規リポジトリ → ファイルをドラッグ&ドロップでOK。node_modules は含めない)
2. vercel.com → Add New → Project → そのリポジトリを Import
3. Framework は自動で「Vite」と認識される → そのまま Deploy
4. 発行されたURLをスマホで開き、「ホーム画面に追加」

## AI機能について

ホーム右上の ⚙️ から Anthropic APIキーを登録すると、
🌱仕分け・🍱献立生成・🌙夜のメモ が使えます。
キーは端末の localStorage にのみ保存されます。
