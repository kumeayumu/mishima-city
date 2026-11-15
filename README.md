# みらい議会・三島市版

三島市議会の議案・議決結果・会議録を、公式資料への出典付きで確認する非公式サイトです。
チームみらいの「みらい議会」をもとに、福岡市版からForkして開発しています。

## 現在の開発状態

- 作業フォルダー：F:\mishimacity\mirai-gikai-mishima-migration
- 作業ブランチ：mishima-migration。PR #1はmain向けで、未マージです。
- 元のF:\mishimacity\mishima-city（fukuoka-city/develop）は変更せず保持します。
- 2026年度（2026年4月1日〜2027年3月31日）の公式議案62件・会議録7日分を同梱しています。
- 公開トップと会議録は同梱JSONを使用し、ローカルDBなしで開発表示できます。
- 管理画面・DB取り込み・AI解説・本番公開の整備は未完了です。
- 本番ビルドには、停止対象の委員会ページでDB取得が実行される未解決の課題があります。

## Windowsでの起動

既存のNode.js 26や他のプロジェクトを変えず、このフォルダー内だけでNode.js 24.22.3・pnpm 10.34.9を使います。
初回の準備はインターネット接続と既存のNode.jsが必要です。このPCではNode.js 26を準備処理に使用できます。

PowerShellで次の順に実行してください。

~~~powershell
Set-Location F:\mishimacity\mirai-gikai-mishima-migration
.\mishima.cmd setup
.\mishima.cmd info
.\mishima.cmd dev
~~~

「Ready」が表示されたら **http://localhost:3002/** をブラウザで開きます。
終了はターミナルでCtrl+Cです。2回目以降はこのフォルダーで次の1行だけです。

~~~powershell
.\mishima.cmd dev
~~~

setupは公式Node.jsアーカイブのSHA-256を検証し、Node.jsとpnpmをGit管理外の.toolsに配置します。
一時的なnpmキャッシュには依存しません。WindowsのPATH・レジストリ・PowerShell実行ポリシー・グローバルnpm設定は変更しません。
.envが存在しない場合だけ.env.exampleから作成し、既存の.envは上書きしません。DB初期化やseed投入は行いません。

通常のnodeコマンドが26系のままでも正常です。プロジェクト用のバージョンは次で確認します。

~~~powershell
.\mishima.cmd node --version
.\mishima.cmd pnpm --version
~~~

詳しくは[Windowsローカル開発手順](docs/20261115_0015_Windowsローカル開発手順.md)を参照してください。

## コマンド

| Windowsでのコマンド | 内容 |
|---|---|
| .\mishima.cmd setup | 専用ツール・依存関係・未作成時の.envを準備 |
| .\mishima.cmd info | プロジェクト専用のNode.js・pnpmを確認 |
| .\mishima.cmd dev | 公開サイトのみ起動（3002番、DBなしで表示可能） |
| .\mishima.cmd dev:all | 既存の全開発サーバーを起動。管理画面はDB設定が必要 |
| .\mishima.cmd lint | Biomeの書式・lint確認 |
| .\mishima.cmd typecheck | 全ワークスペースの型チェック |
| .\mishima.cmd test | ツールの単体テストと全ワークスペースのテスト |
| .\mishima.cmd test:coverage | ツールの単体テストと公開アプリのカバレッジ付きテスト |
| .\mishima.cmd build | 公開サイトの本番ビルド（現時点ではDB依存の課題あり） |

Linux/macOS・CIではNode.js 24系とpackage.jsonに指定したpnpmを使い、通常のpnpmコマンドを実行してください。
Windows用コマンドはあくまでこのリポジトリ専用です。

## データとDBの扱い

原文アーカイブはweb/src/features/official-records/server/data/2026にあります。
[取得・更新の記録](docs/20261114_2035_三島市版2026年度移行.md)を参照してください。

管理画面・DB機能を検証する段階でDocker DesktopとSupabase CLIを別途準備します。
現在のseedには福岡市向けデータが残っています。DBの初期化・リセット・seedは、内容と対象を確認して明示的に許可された場合だけ実行します。
AI生成の要約等をDBに登録する前には、生成内容を提示してユーザー確認を得ます。

## 開発・PR

- メインの作業ディレクトリを直接変更せず、git worktreeで作業します。
- PR #1の追加作業は既存のmishima-migration worktreeで続けます。
- PR先はmainです。旧福岡市版・川崎市版のブランチへ誤って送らないでください。
- PR #1は未マージです。mainを基点に別の作業を始める場合、三島市版の変更がまだ含まれない点に注意してください。
- コミット前にlint・型チェック・テスト・Codexレビューを実行します。
- ユーザーの指示なしにPRをマージしません。

コードの構成・詳細な作業規則は[AGENTS.md](AGENTS.md)を参照してください。
GitHub： https://github.com/kumeayumu/mishima-city

## Fork手順・上流への帰属

地方版の作成は、READMEから参照している[別地域向けFork手順書](docs/kawasaki/20260304_1000_別地域向けfork手順.md)を基準にします。
同資料と[旧ローカル環境起動手順](docs/kawasaki/20260219_1000_ローカル環境起動手順.md)には、Mac向けコマンド・3000番ポート・Node.js 20以上等の古い記述があります。
この作業フォルダーのWindows起動には本READMEとWindows手順書を優先してください。

上流： https://github.com/team-mirai-volunteer/mirai-gikai
福岡市版： https://github.com/bakumon1107/mirai-gikai-fukuoka-city
本サイトはチームみらいの公式サービスではありません。
GNU AGPL v3の[LICENSE](LICENSE)を保持しています。公開時には利用者が対応するソースコードを取得できる案内を維持します。

[更新前のREADME](docs/20261115_0010_README更新前の記録.md)は履歴資料として保存しています。
