STEP 5 — GitHub Pages PWA（单仓库 / 根目录直接发布）

为什么改成这个结构
==================
Cloudflare Pages Direct Upload 的文件数量约束不适合未来长期扩展大量 MP3。
本版本改为 GitHub Pages，并直接把仓库根目录作为发布源。

重要：
不再创建 dist/ 或 docs/。
因此 audio/ 不会复制第二份。

仓库结构本身就是运行网站：
question-reflex/
  index.html
  app.js
  db.js
  pwa.js
  stimuli.js
  service-worker.js
  manifest.webmanifest
  audio/
  icons/
  data/
  config/
  tools/
  ...

GitHub Pages 只需要：
main branch + /(root)

所有网页资源路径均使用相对路径，因此 Project Pages URL：
https://USERNAME.github.io/REPOSITORY/
可以正常运行。

第一次发布
==========
A. GitHub 网站：
1. 创建一个新的 PUBLIC repository
2. 建议仓库名：question-reflex
3. 第一次最好创建 EMPTY repository：
   - 不勾 README
   - 不添加 .gitignore
   - 不添加 License

B. Windows 本地：
1. 把本升级包覆盖到你目前已有的 Question Reflex 文件夹
2. 双击：
   github_first_setup.bat
3. 粘贴 GitHub 新仓库的 HTTPS URL
4. 脚本执行：
   git init
   git branch -M main
   git add -A
   git commit
   git remote add origin
   git push -u origin main

如果 Git 要求登录，按 Git/GitHub 的浏览器认证流程完成即可。

第一次 Push 后开启 Pages
========================
GitHub 仓库：
Settings
  -> Pages
  -> Build and deployment
  -> Source: Deploy from a branch
  -> Branch: main
  -> Folder: /(root)
  -> Save

随后 GitHub 会生成：
https://USERNAME.github.io/REPOSITORY/

以后不要换仓库名或 Pages URL，
因为手机 PWA 的 IndexedDB / Cache Storage 都和 origin/path 有关。

.nojekyll
=========
仓库根目录新增空文件：
.nojekyll

作用：
告诉 GitHub Pages 不要用 Jekyll 处理这个纯静态项目，
而是直接发布 HTML / JS / MP3 等文件。

电脑端
======
继续使用：
start_local.bat

也就是：
http://localhost:8765/

电脑训练数据库仍然只在电脑。

手机端
======
访问：
https://USERNAME.github.io/REPOSITORY/

安装 PWA。
第一次联网时点击：
缓存全部音频

然后可以飞行模式测试。

手机 IndexedDB 与电脑 IndexedDB 相互独立。
当前不做同步。

以后日常更新
============
典型流程：

1. 编辑 data/stimuli.csv
2. build.bat
3. 如有新增/修改音频：
   generate_audio_all.bat
4. 本地用 start_local.bat 测试
5. 双击：
   publish_github.bat
6. 输入 commit message，例如：
   Add verb listening drills
7. Git push 完成
8. GitHub Pages 自动发布

不再需要：
make_deploy.bat
dist/
docs/

publish_github.bat 会：
git add -A
git commit
git push

如果没有文件变化，它不会制造空 commit。

关于公开性
==========
这个方案会公开整个 repository，包括：
- stimuli.csv
- Python 构建脚本
- TTS 配置
- MP3
- 网页源代码

不会公开：
- Google Cloud API Key（当前程序从环境变量/临时输入读取）
- 电脑 IndexedDB
- 手机 IndexedDB
- 本地训练历史

不要把 API Key 手工写进任何 tracked 文件。

.gitignore
==========
已默认忽略：
.env
.env.*
*.log
__pycache__/
.vscode/
.idea/
dist/
docs/

GitHub Pages 更新缓存
====================
HTML / JS 使用 network-first：
联网启动时优先获得新版。

MP3 使用 cache-first：
已缓存的同名 MP3 会继续使用本地缓存。

如果“修改了现有 MP3，但文件名没变”：
手机 PWA 中：
清除音频缓存
-> 缓存全部音频

如果只是新增 Qxxxx 的全新 MP3：
重新发布后再点一次“缓存全部音频”即可补齐。

长期规模
========
GitHub Pages 更值得关注的是仓库/发布站点总体积，而不是 Cloudflare Direct Upload 的 1000 文件限制。

如果未来音频规模逼近 GitHub Pages 的站点体积限制，再考虑：
- 降低 MP3 bitrate
- 按模块拆站
- 把音频移动到对象存储/CDN

目前没有必要提前复杂化。
