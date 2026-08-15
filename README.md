# WORLD TABLE（世界のスポーツ順位表）

スマートフォンから、世界の主要サッカーリーグとMLBの順位を確認できる静的Webサイトです。J1、プレミアリーグ、ラ・リーガ、セリエA、ブンデスリーガ、リーグ・アン、MLS、MLBに対応しています。

## このサイトの仕組み

毎朝6時（日本時間）にGitHub Actionsが順位APIを1回だけ呼び、`data`フォルダのJSONを更新します。閲覧者のブラウザは保存済みJSONだけを読むため、ページを開くたびにAPIを呼びません。API取得に失敗した場合は前回のJSONを残し、古いデータである旨を表示します。

## APIとは

APIは、別のサービスが持つデータをプログラムから受け取るための窓口です。サッカーは [API-FOOTBALL](https://www.api-football.com/) を想定し、MLBは無料のMLB Stats APIを使用します。NPBは、無料かつ規約上安全な公式相当APIを確認できていないため追加していません。

## APIキーの取得と設定

1. API-FOOTBALLでアカウントを作り、無料プランのAPIキーを取得します。
2. キーをソースコードへ書かないでください。
3. ローカルでは `.env.example` を参考に `.env` を作り、`API_FOOTBALL_KEY=取得したキー` と書きます（`.env` はGitの対象外です）。現在の更新スクリプトをローカルで実行するときは、ターミナルの環境変数として設定してから `node scripts/update-data.mjs` を実行します。

## GitHub Secretsの設定

リポジトリの `Settings` → `Secrets and variables` → `Actions` → `New repository secret` を開き、名前を `API_FOOTBALL_KEY`、値を取得したキーにして保存します。Secretの値は公開コードやログには表示されません。

## ローカルで起動する

Windowsでは `ゲームを起動.cmd` をダブルクリックしてください。ブラウザの制限でJSONが読み込めない場合は、このフォルダで `python -m http.server 8000` を実行し、`http://localhost:8000` を開きます。

## GitHub Pagesで公開する

このリポジトリの `Settings` → `Pages` → `Build and deployment` のSourceを `GitHub Actions` にします。`main`へpushすると「GitHub Pagesへ公開」ワークフローが公開します。

## 自動更新を確認する

GitHubの `Actions` タブで「毎日の順位データ更新」を開きます。毎日6時台の実行が緑色なら成功です。初回は `Run workflow` で手動実行できます。サイトの「最終更新」も確認してください。

## 無料枠の注意

無料枠の上限はAPI事業者側で変更されることがあります。現在は各サッカーリーグにつき1リクエスト、1日合計7リクエストです。更新間隔をむやみに短くしないでください。ブラウザからAPIを直接呼ぶ実装へ変更すると、キー漏えいと上限超過の原因になります。

## リーグを追加する

1. `game.js` の `leagues` にリーグ情報を追加します。
2. `scripts/update-data.mjs` の `config` にAPI-FOOTBALLのリーグIDを追加します。
3. 同じIDの `data/○○.json` を用意します。
4. APIの利用規約、無料枠、対象シーズンを確認してからActionsを手動実行します。

## 順位変動・お気に入り

更新前の順位と新順位を比較して、上昇・下降をJSONに保存します。お気に入りと前回閲覧したリーグはブラウザの `localStorage` にだけ保存され、ログインや外部送信はありません。
