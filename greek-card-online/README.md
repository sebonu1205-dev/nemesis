# ネメシス(NEMESIS)ルーム戦サーバー

Node.js(18以上)だけで動く、1つのサーバーです。画面(public/index.html)の配信と、WebSocketでのルーム戦をまとめて受け持ちます。

## 手元で動かす
```
npm install
npm start          # http://localhost:8080
```
ブラウザを2つ(または2台)開き、片方で「ルーム戦 → 部屋を作る」、もう片方でそのコードを入れて「入る」。
同じLANのスマホで試すときは、PCのIPアドレスで `http://192.168.x.x:8080` を開きます。

## インターネットに公開する(例: Render)
1. このフォルダをGitHubにアップロードする
2. Renderで「New → Web Service」を選び、そのリポジトリを指定
3. Build Command: `npm install` / Start Command: `npm start`
4. 発行されたURL(https://〜)を友達に送るだけ。ホストがWebSocketの通信も同じURLで受けます
(Fly.io、Railway、自前のVPSでも同じ。`PORT`環境変数を読みます。httpsの場合、画面は自動で wss:// を使います)

無料枠のサービスは、しばらく使わないと眠ります。最初の接続に十数秒かかることがあります。

## 設計メモ
- 勝敗の計算・デッキと入れ替えの検証は、すべてサーバーが行います(engine.js は画面側と同じ処理)。
- 相手の入れ替えは、最初のカードが出るまで相手に送られません。
- 切断しても90秒は部屋が残ります(環境変数 GRACE_MS で変更)。戻ると、その場面から再開します。
- 30分操作がない部屋は閉じます。部屋の情報はメモリ上だけで、サーバーを再起動すると消えます。
- 画面(public/index.html)は、試作版のHTMLにルーム戦の画面を足したものです。

## Firebase(Google Cloud)で公開する場合
Firebase Hosting は静的ファイル用で、WebSocket を中継できません。そのため、サーバーは Firebase と同じ Google のプロジェクト上の **Cloud Run** に置きます。
1. Firebase コンソールでプロジェクトを作り、課金プラン(Blaze)にする(予算アラートも設定する)
2. Google Cloud Shell(ブラウザ上のターミナル)を開き、この zip をアップロードして展開する
3. `gcloud config set project プロジェクトID`
4. `gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com`
5. 展開したフォルダで次を実行:
```
gcloud run deploy greek-card --source . --region asia-northeast1 \
  --allow-unauthenticated --max-instances 1 --min-instances 1 \
  --timeout 3600 --session-affinity
```
6. 表示された `https://greek-card-〇〇.run.app` を、スマホで開く(更新したいときは、同じコマンドをもう一度)

- `--max-instances 1`: 部屋の情報がメモリ上にあるため、サーバーは1台に固定します。
- `--min-instances 1`: 眠らせない設定です。常時起動の分が課金されます。0にすると安くなりますが、待機後の最初の接続が遅くなり、部屋は消えます。
- `--timeout 3600`: 1接続の最長が60分です。切れても、画面が自動で再接続して続きから再開します。
