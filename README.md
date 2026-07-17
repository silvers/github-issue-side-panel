# GitHub Issue Side Panel

GitHub の Issues 一覧（`github.com/<owner>/<repo>/issues` と `github.com/issues`）で
Issue リンクをクリックしたとき、GitHub Projects のようなスライドインのサイドパネルで
Issue をプレビューする Chrome 拡張。

Issue ページの HTML に埋め込まれている React 用 JSON ペイロードを同一オリジンの
fetch（自分のセッション Cookie 付き）で取得し、タイトル・本文・ラベル・アサイン・
コメントをパネル内に描画する。プライベートリポジトリでも自分に権限があれば動く。

## インストール

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」でこのフォルダを選択

## 使い方

- Issues 一覧で Issue をクリック → サイドパネルでプレビュー
- 閉じる: `Esc` / 背景クリック / 右上の ✕
- パネル左端をドラッグで幅を変更（保存される）
- コメント投稿など操作したいときは「Open full page ↗」で通常ページへ

## サイドパネルを使わない方法（3通り）

| 方法 | 挙動 |
|---|---|
| ツールバーの拡張アイコンをクリック | 全体を ON/OFF 切り替え（OFF バッジ表示、設定は保存・同期される） |
| Cmd/Ctrl/Shift/Alt を押しながらクリック | その 1 回だけ通常挙動（新しいタブなど） |
| 中クリック | 通常どおり新しいタブで開く |

## 制限・注意点

- パネルは読み取り専用のプレビュー。コメント投稿・ラベル編集は「Open full page」から
- 長い Issue はタイムラインの先頭・末尾のみ表示（GitHub がプリロードする範囲）。
  その場合はパネル末尾に全文へのリンクが出る
- GitHub の内部ペイロード構造（`react-app.embeddedData`）に依存しているため、
  GitHub 側の変更で壊れる可能性がある。壊れた場合は通常の画面遷移にフォールバックする

## GitHub Enterprise で使う場合

`manifest.json` の `content_scripts.matches` の `github.com` を
自社の GHE ドメインに置き換える（または追記する）。
