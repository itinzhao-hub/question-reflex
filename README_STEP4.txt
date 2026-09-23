STEP 4 — 永久训练记录 + 统计 + 严格固定音频模式

本次新增
========
1. IndexedDB 永久记录每一次作答。
2. Session 记录。
3. 当前 Session 指标：
   - 题数
   - 正确率
   - 中位 RT
   - ≤1 秒正确率
   - 提前作答率
4. 长期分析：
   - family
   - speedClass
   - audioProfile
   - 最近 Session
5. CSV 导出。
6. 默认关闭浏览器 TTS fallback。
7. 正式训练只抽取“当前音源模式下已有固定 MP3”的刺激。
8. 改用 localhost 启动，避免 file:// 下 IndexedDB / 后续 PWA 的兼容性问题。

强烈推荐的升级方式
==================
如果你已经在 Step 3 本地生成了 192 个 MP3：

不要重新建项目、不要重新生成音频。

把 question-reflex-step4-upgrade.zip 解压，
将其中文件直接覆盖到你现有的 question-reflex-step3 文件夹。

这个升级包不会包含或覆盖：
- audio/
- data/audio_manifest.json
- data/stimuli.csv
- stimuli.js
- config/tts_config.json

所以已经生成的 MP3 和音频索引都会保留。

升级后如何运行
==============
从 Step 4 开始，不再建议双击 index.html。

双击：
start_local.bat

它会：
1. 启动 Python 本地静态服务器
2. 打开 http://localhost:8765/
3. IndexedDB 会稳定绑定到这个 localhost origin

训练结束后：
关闭 “Question Reflex Server” 命令行窗口即可。

固定 MP3 严格模式
================
“缺失时允许浏览器 TTS（调试）”默认关闭。

例如选择：
只男声

程序会先检查每一条刺激是否拥有 MALE 固定 MP3，
只从有匹配音频的刺激中抽题。

因此不会再出现：
抽到无 MP3 题 -> 偷偷播放浏览器 TTS

调试时才建议手动勾选 fallback。

训练记录
========
每题会保存：
- sessionId
- 时间
- stimulusId
- 法语文本
- family
- person
- function
- aux_or_verb
- 你的选择
- 正确答案
- 是否正确
- RT
- 是否提前作答
- 是否在 1 秒内正确
- 当前 audio mode
- profile
- voice
- gender
- speedClass
- speakingRate
- pitch

这些记录保存在浏览器 IndexedDB：
questionReflexDB

不会上传到服务器或 Google。

CSV 导出
========
点击：
导出 CSV

会下载全部 trial 记录，带 UTF-8 BOM，
因此直接用 Excel 打开中文通常不会乱码。

≤1s 正确率
==========
这个指标比普通 accuracy 更符合当前任务：

within1s = 答案正确 AND RT <= 1000 ms

注意：
负 RT（提前作答）也自然计入 ≤1s。

RT 统计
=======
中位 RT / P90 RT 只计算正确答案。

原因：
错误答案的反应时间通常不代表“正确语义映射速度”。

后续建议
========
Step 5：
- PWA
- 手机主屏幕安装
- Service Worker 离线缓存 HTML/JS/CSV-generated data/全部 MP3
- 移动端触控布局
- 数据备份/恢复

之后再做：
Step 6
- 基于 family 历史表现的自适应抽样权重
- confusion matrix
- 分阶段难度/干扰项增强
