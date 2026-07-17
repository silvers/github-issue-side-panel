# GitHub Issue Side Panel

GitHub で Issue リンクをクリックしたとき、ページ遷移せずに GitHub Projects 風の
スライドインパネルで Issue をプレビューする Chrome 拡張。

- Issues 一覧（`/issues`）・Issue / PR ページ内の Issue リンクが対象
- 本物の Issue ページに近い表示：本文・コメントのボックス＋右サイドバー
  （Assignees / Labels / Type / Projects(Status付き) / Milestone）
- パネル内で Issue リンクを辿れる（← ボタンで戻る）
- プライベートリポジトリ対応（自分のログインセッションでアクセスするため、
  自分に見える Issue はすべて見える。トークン設定などは不要）

## インストール

Chrome ウェブストアには公開していないので、フォルダを読み込む方式でインストールする。

1. このリポジトリをダウンロードする
   - 緑の **Code** ボタン → **Download ZIP** → 解凍（git が使えるなら `git clone` でも可）
   - 解凍したフォルダは削除せずに残しておく（削除すると拡張が動かなくなる）
2. Chrome で `chrome://extensions` を開く
3. 右上の **デベロッパーモード** を ON にする
4. **パッケージ化されていない拡張機能を読み込む** をクリックし、解凍したフォルダを選択

更新するときは、新しい ZIP で フォルダを置き換えて `chrome://extensions` の 🔄（再読み込み）を押す。

## 使い方

| 操作 | 方法 |
|---|---|
| パネルで開く | Issues 一覧や Issue / PR ページ内の Issue リンクをクリック |
| 閉じる | `Esc` / 背景クリック / 右上の ✕ |
| 全画面で開く | パネル左上の「Open full page ↗」 |
| パネル内で戻る | パネル左上の ← |
| 幅を変える | パネル左端をドラッグ（保存される） |
| 拡張を OFF | ツールバーの拡張アイコンをクリック（OFF バッジ表示。もう一度押すと ON） |
| 1回だけ通常挙動 | Cmd/Ctrl/Shift/Alt を押しながらクリック、または中クリック |

## 仕組み

Issue ページの HTML には、GitHub の React アプリ用に Issue データ（本文 HTML・コメント・
ラベルなど）が JSON で埋め込まれている。この拡張はリンククリック時に Issue ページを
同一オリジンの fetch（自分のセッション Cookie 付き）で取得し、その JSON を取り出して
パネルに描画する。

- 権限は `storage`（ON/OFF とパネル幅の保存）のみ。外部サーバーへの送信は一切ない
- データ取得に失敗した場合は通常のページ遷移にフォールバックする

## 制限

- パネルは読み取り専用のプレビュー。コメント投稿・ラベル編集は「Open full page」から
- PR はパネル対象外（通常どおり遷移する）。GitHub が PR ページに会話データを
  埋め込んでいないため
- 長い Issue はタイムラインの先頭・末尾のみ表示（GitHub が埋め込む範囲）。
  その場合はパネル末尾に全文へのリンクが出る
- プロジェクトのフィールドは Status のみ表示（GitHub が埋め込むのは Status だけ）
- GitHub の内部ペイロード構造に依存しているため、GitHub 側の変更で壊れる可能性がある
  （壊れても通常遷移になるだけで実害はない）

## GitHub Enterprise で使う場合

`manifest.json` の `content_scripts.matches` の `github.com` を自社の GHE ドメインに
置き換える（または追記する）。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `manifest.json` | 拡張の定義（Manifest V3） |
| `content.js` | リンクの横取り・Issue データ抽出・パネル描画 |
| `content.css` | パネルのスタイル（GitHub の CSS 変数を使いダークモード対応） |
| `background.js` | ツールバーアイコンでの ON/OFF 切り替え |
