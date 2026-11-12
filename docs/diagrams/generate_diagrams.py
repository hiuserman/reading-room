"""Generate Japanese diagrams from the 2026-11-05 architecture.md snapshot.

Usage: python generate_diagrams.py SKILL_DIRECTORY ICON_DIRECTORY
Icons are fetched separately with stack-diagram's fetch_icons.py.
"""
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

skill, icons = map(Path, sys.argv[1:3])
out = Path(__file__).parent
template = (skill / 'assets/template.html').read_text(encoding='utf-8')
css = re.search(r'<style>(.*?)</style>', template, re.S).group(1)
defs = re.search(r'<defs>(.*?)</defs>', template, re.S).group(1)
for name in ['browser', 'user']:
    shutil.copyfile(skill / f'assets/generic/{name}.svg', icons / f'{name}.svg')

def node(x, y, icon, name, role, bare=False):
    return f'<div class="node" style="left:{x-95}px;top:{y}px;width:190px"><div class="tile {"bare" if bare else ""}"><img src="%%ICON_{icon}%%" alt=""></div><div class="name"><span>{name}</span></div><div class="role"><span>{role}</span></div></div>'

def group(x, y, w, h, title, icon='docker', kind='gb'):
    img = f'<img class="plate" src="%%ICON_{icon}%%" alt="">'
    if icon == 'aws':
        img = '<img class="lt" src="%%ICON_aws%%" alt=""><img class="dk" src="%%ICON_aws_dark%%" alt="">'
    return f'<div class="group {kind}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px"><div class="g-label">{img}{title}</div></div>'

def edge(d, label='', x=0, y=0, kind='e', arrow=True):
    marker = 'open' if 'aws' in kind else 'ar'
    return f'<path class="{kind}" d="{d}" '+(f'marker-end="url(#{marker})"' if arrow else '')+f'/><text class="el" x="{x}" y="{y}" text-anchor="middle">{label}</text>'

def note(x,y,text):
    return f'<div class="annotation" style="left:{x}px;top:{y}px">{text}</div>'

def save(stem, number, title, subtitle, height, groups, nodes, edges, notes, legend):
    extra = '''@media(max-width:1490px){.canvas{zoom:.8}.scroller{width:1152px}}.scroller{width:1440px;max-width:none}.canvas,svg.edges{width:1440px}.node .role{font-family:var(--font-body);font-size:12px;line-height:1.5}.node .name{font-size:14px}.el{font-family:var(--font-body);font-size:12px}.g-label{font-size:14px}.annotation{position:absolute;font-size:13px;line-height:1.8;color:var(--color-neutral);background:var(--color-paper);padding:8px 12px;border-left:3px solid var(--color-rule-2)}.diagram-title{position:absolute;left:32px;top:24px;font-size:23px;font-weight:700}.diagram-sub{position:absolute;left:32px;top:62px;font-size:13px;color:var(--color-muted)}.legend-in{position:absolute;left:32px;bottom:20px;font-size:12px;color:var(--color-neutral)}.lede{max-width:480px}.controls{margin:12px 0;font-size:13px}button{font:inherit;padding:6px 12px;cursor:pointer}'''
    html = f'''<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} | 2D仮想本棚</title><style>{css}{extra}.canvas,svg.edges{{height:{height}px}}</style></head><body><main class="page"><header class="head"><div><div class="kicker">2D仮想本棚 / 構成図 {number} / 2026-11-05</div><h1>{title}</h1></div><p class="lede">出典：docs/architecture.md（版 0.2）<br>設計書に記載された構成・計画を図示。</p></header><div class="controls"><button onclick="document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark'">ライト／ダーク切替</button></div><div class="scroller"><div class="canvas"><div class="diagram-title">{number}　{title}</div><div class="diagram-sub">{subtitle}</div>{''.join(groups)}<svg class="edges" viewBox="0 0 1440 {height}" aria-hidden="true"><defs>{defs}</defs>{''.join(edges)}</svg>{''.join(nodes)}{''.join(notes)}<div class="legend-in">{legend}</div></div></div><footer class="foot"><span>2D仮想本棚 · 技術名は正式表記、説明は日本語</span><span>icons: svgl / gilbarbara/logos / Lucide / AWS Architecture Icons · made with <a href="https://github.com/caru-ini/stack-diagram">stack-diagram</a></span></footer></main></body></html>'''
    with tempfile.TemporaryDirectory() as tmp:
        draft = Path(tmp) / 'draft.html'
        draft.write_text(html, encoding='utf-8')
        subprocess.run([sys.executable,str(skill/'scripts/build.py'),str(draft),str(icons),str(out/f'{stem}.html'),'--fonts',str(skill/'assets/fonts')],check=True)

save('01-initial-local','01','バックエンド開発開始時のローカル構成','フロントエンド追加前 · Docker Compose の3サービス',820,
 [group(380,140,940,430,'Docker Compose ネットワーク')],
 [node(150,240,'browser','Windowsのブラウザー','API・管理画面へ接続'),node(580,240,'go','backend / test-backend','Go HTTP API :8080'),node(1150,240,'admin','dynamodb-admin','管理画面 :8001'),node(860,410,'db','DynamoDB Local','dynamodb-local :8000'),node(580,640,'folder','Windows Appフォルダー','ソースコード'),node(1150,640,'folder','Windows docker/dynamodb','データ保存フォルダー')],
 [edge('M184 270 H546','localhost:8080/api/health',355,256),edge('M150 234 V190 H1150 V234','localhost:8001',820,182),edge('M614 270 H760 V440 H826','サービス名でDBへ接続',760,398),edge('M1116 270 H980 V440 H894','サービス名でDBへ接続',1090,398),edge('M580 634 V350','bind mount /app',655,550,'n',False),edge('M1150 634 V550 H860 V520','bind mount /home/dynamodblocal/data',1090,600,'n',False)],
 [note(40,430,'DB接続先：<br>http://dynamodb-local:8000<br><br>コンテナ内の localhost は<br>そのコンテナ自身を指す。'),note(40,650,'起動：go run main.go<br>コード編集後は backend を再起動。')],
 '矢印：通信　／　矢印のない線：Windowsとコンテナのフォルダー共有')

save('02-current-local','02','現在のローカル開発構成','frontend追加済み · 接続確認・共同本棚モック実装 · 書誌API連携は今後の予定',860,
 [group(350,170,840,370,'Docker Compose：4サービス')],
 [node(140,320,'browser','ブラウザー','React UIを実行'),node(490,240,'nextjs','frontend / Next.js','開発サーバー :3000'),node(760,390,'go','backend / Go API',':8080 · CORSを許可'),node(1050,390,'db','DynamoDB Local','dynamodb-local :8000'),node(1050,240,'admin','dynamodb-admin','管理画面 :8001'),node(760,660,'book','Google Books API','ISBN検索 · 実装予定'),node(1050,660,'book','openBD API','書誌情報の補完候補')],
 [edge('M174 350 H290 V270 H456','画面取得 localhost:3000',325,260),edge('M174 350 H250 V420 H726','fetch localhost:8080/api/...',480,408),edge('M140 314 V130 H1050 V234','管理画面 localhost:8001',620,121),edge('M794 420 H1016','DB操作',906,408),edge('M1050 350 V384','DB操作',1105,370,'n'),edge('M760 500 V654','ISBN検索 / HTTPS',840,600,'n dash'),edge('M794 440 H905 V620 H1050 V654','補完候補',1015,610,'n dash')],
 [note(40,550,'接続確認画面はGo APIを呼び出す。<br>共同本棚モックはブラウザー内の<br>サンプルデータで動作。<br>業務API・認証・書誌APIは未接続。'),note(40,680,'実機スマートフォン：API接続先をPCの<br>到達可能なアドレスへ変更。<br>カメラ検証用のHTTPSは別途準備。'),note(380,560,'DB接続はComposeのサービス名：<br>http://dynamodb-local:8000')],
 '実線：現在の通信　／　破線：実装予定・補完候補（未接続）')

save('03-aws-target','03','AWS公開時の目標構成','配備前の設計案 · ブラウザーから画面配信とREST APIをそれぞれ利用',1160,
 [group(340,150,840,640,'AWS：配備前の設計案','aws','aws'),group(40,850,1140,210,'開発・CI/CD（目標構成）','github','gb')],
 [node(140,260,'browser','PC・スマートフォン','ブラウザー'),node(140,650,'user','認証サービス','ログイン / 製品未選定'),node(460,230,'cf','Amazon CloudFront','HTTPSで画面配信',True),node(760,230,'s3','Amazon S3','Next.js 静的出力',True),node(460,470,'apigw','Amazon API Gateway','REST API',True),node(760,470,'lambda','AWS Lambda','Go API / 本人・参加権限検証',True),node(1060,470,'db','Amazon DynamoDB','メンバー・全冊・読了記録',True),node(1060,660,'logs','Amazon CloudWatch','CloudWatch Logs / APIログ',True),node(1310,470,'book','Google Books API','ISBN検索 / HTTPS'),node(1310,660,'book','openBD API','書誌情報の補完候補'),node(140,920,'user','開発者','変更をpush'),node(460,920,'github','GitHub リポジトリ','ソースコード'),node(760,920,'actions','GitHub Actions','テスト・ビルド・デプロイ'),node(1060,920,'terraform','Terraform','AWSリソースを定義')],
 [edge('M106 290 H30 V680 H106','ログイン・トークン取得',110,620,'n'),edge('M174 290 H290 V260 H426','画面取得 / HTTPS',302,248),edge('M140 370 V500 H426','トークン付きAPI / HTTPS',275,488),edge('M494 260 H726','静的ファイル取得',610,248,'aws'),edge('M494 500 H726','イベント呼び出し',612,488,'aws'),edge('M794 500 H1026','読み書き',960,488,'aws'),edge('M794 520 H960 V690 H1026','ログ出力',960,641,'aws'),edge('M760 464 V410 H1310 V464','ISBN検索 / HTTPS',1190,398),edge('M794 530 H910 V815 H1230 V690 H1276','補完候補',1240,805,'n dash'),edge('M174 950 H426','push',300,938,'n dash'),edge('M494 950 H726','CI起動',610,938,'n dash'),edge('M760 914 V580','Go成果物を配置',820,850,'n dash'),edge('M794 930 H870 V260 H794','静的成果物を配置',870,360,'n dash'),edge('M794 950 H1026','構築・変更',930,978,'n dash'),edge('M1060 914 V845 H1150 V440 H1060 V464','AWS全体を構築',1090,835,'n dash')],
 [note(40,770,'認証サービスは製品未選定。<br>Goがトークンと参加権限を毎回検証。'),note(380,345,'ShelfMembersで参加権限を確認<br>ShelfBooks・ReadingRecordsから取得<br>メンバー別の直近6冊と全冊を表示。<br>アーカイブ棚は閲覧専用の案。'),note(380,650,'Next.js：output: \'export\'<br>S3の配布元アクセスはCloudFrontに限定する案。<br>GoはAPI Gateway用の入口を追加し、業務処理を共有。'),note(40,1080,'未決定：Terraformの状態保存先 / GitHub ActionsのAWS認証・デプロイ承認。任意の本棚IDはクエリパラメーターで扱う案。')],
 '全体が目標構成。外側の破線：CI/CD・IaC または書誌情報の補完候補（ラベルで区別）。')
