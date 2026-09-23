STEP 5 — PWA 手机化（保留电脑端；数据库不跨设备同步）

本阶段原则
==========
- 不改题库模型
- 不做通用化
- 不做云数据库
- 不做跨设备同步
- 保留 Step 4 全部训练与统计功能
- 电脑和手机各自拥有独立 IndexedDB

新增
====
1. manifest.webmanifest
2. Service Worker
3. PWA 安装入口
4. 手机/电脑离线程序壳
5. MP3 自动按需缓存
6. “缓存全部音频”按钮
7. “清除音频缓存”按钮
8. make_deploy.bat：生成干净 dist/ 部署目录
9. PWA icons

电脑端
======
继续双击：
start_local.bat

打开：
http://localhost:8765/

localhost 可以注册 Service Worker，电脑端功能与 Step 4 一致。
电脑的训练历史保存在电脑浏览器 IndexedDB。

手机端为什么不能直接使用电脑 localhost
=====================================
手机上的 localhost 指手机自己，不是电脑。

即使手机通过局域网访问：
http://192.168.x.x:8765/

普通 HTTP 的局域网地址通常不属于 PWA 所需的安全上下文，
因此正式安装/Service Worker 应使用 HTTPS 部署地址。

部署前
======
双击：
make_deploy.bat

得到：
dist/

dist/ 只包含：
- index.html
- CSS/JS
- stimuli.js
- PWA manifest / service worker
- icons
- audio/

不会包含：
- data/stimuli.csv
- data/audio_manifest.json
- config/tts_config.json
- tools/generate_audio.py
- 其他构建工具
- Google Cloud API Key

因此只部署 dist/。

离线策略
========
程序壳：
首次打开 PWA 时 Service Worker 自动缓存。

MP3：
A. 听过的 MP3 会自动缓存。
B. 点“缓存全部音频”可以主动把 stimuli.js 中全部固定 MP3 缓存到当前设备。

推荐：
安装完成且联网时，点一次“缓存全部音频”。

缓存完成后可开启飞行模式测试。

注意：
“清除音频缓存”只清 MP3 Cache Storage。
不会清 IndexedDB 的训练记录。

手机训练记录
============
手机安装后的训练历史只在手机自己的 IndexedDB。

电脑历史：
电脑独立。

手机历史：
手机独立。

当前版本不自动同步，这是刻意设计。

发布到 HTTPS
============
最省事的方法之一是 Cloudflare Pages Direct Upload：

1. 先运行 make_deploy.bat
2. 登录 Cloudflare Dashboard
3. Workers & Pages
4. Create application / Pages
5. Direct Upload / Drag and drop
6. 上传 dist 文件夹或其 ZIP
7. 获得 https://<project>.pages.dev 地址
8. 手机访问该 HTTPS 地址
9. 安装到主屏幕
10. 点击“缓存全部音频”

也可以使用 GitHub Pages、Firebase Hosting、Netlify 等任意静态 HTTPS 主机。

注意：普通静态 Pages URL 通常是互联网可访问的。
dist 中不含 API Key 或个人训练记录，但包含题库文本和 MP3。

iPhone / iPad
=============
访问 HTTPS 地址后：
Safari（或支持的浏览器） -> 分享菜单 -> 添加到主屏幕
可选择作为 Web App 打开。

Android
=======
Chrome / Samsung Internet：
浏览器菜单 -> Install app / 添加到主屏幕。

更新内容
========
以后本地修改 CSV / 重新生成 MP3 后：

1. build.bat
2. 如有需要 generate_audio...
3. make_deploy.bat
4. 重新部署新的 dist/

Service Worker 对程序文件采用 network-first：
联网打开后会取得并缓存最新版；
离线时回退到缓存版本。

MP3 采用 cache-first：
已经缓存的 MP3 优先本地播放。

如果你大量修改了 MP3 而文件名保持不变：
手机可能继续使用旧 MP3 Cache。
此时在应用内：
“清除音频缓存” -> “缓存全部音频”
即可刷新。

如果以后频繁迭代音频，我们再增加自动 cache version/hash 机制。
