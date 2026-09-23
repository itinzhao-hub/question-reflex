STEP 3 — Google Cloud TTS 多音源固定音频

本阶段完成
==========
1. Google Cloud Text-to-Speech REST 批量生成 MP3。
2. API Key 不写入项目文件。
3. 每条刺激可生成多个固定变体。
4. 同一刺激可拥有不同：
   - gender
   - voice
   - speakingRate
   - pitch
5. 网页训练时可切换：
   - 混合随机
   - 只女声
   - 只男声
   - 只正常语速
   - 只偏快
   - 只偏慢
6. fingerprint 缓存：文本和音源参数都没变化时，不重复调用 API。
7. 文本或 TTS 参数改变后，仅对应音频自动失效并重生成。

安全
====
不要把 API Key 写进：
- stimuli.csv
- tts_config.json
- JavaScript
- HTML

generate_audio.py 会：
A. 优先读取环境变量 GOOGLE_CLOUD_TTS_API_KEY
B. 没有时，在命令行中临时询问 Key
C. 不把 Key 保存到项目中

第一次建议这样测试
================
1. 双击 generate_audio_test.bat
2. 输入 Google Cloud TTS API Key
3. 它只处理前 4 条 active 刺激
4. 默认 6 profiles，所以最多生成 24 个 MP3
5. 完成后自动运行 build.py
6. 打开 index.html
7. 关闭“缺少 MP3 时用浏览器 TTS”也应能正常训练前 4 条；
   其他尚未生成的题会因为没有 MP3 而无法播放，所以测试时可保持 fallback 开启。

确认声音无误后
==============
双击：
generate_audio_all.bat

默认将给全部 active 刺激生成 6 个 profile。

TTS 配置
========
编辑：
config/tts_config.json

当前默认：
female_slow   fr-FR-Neural2-F  rate 0.92
female_normal fr-FR-Wavenet-F  rate 1.00
female_fast   fr-FR-Neural2-F  rate 1.10

male_slow     fr-FR-Wavenet-G  rate 0.92
male_normal   fr-FR-Neural2-G  rate 1.00
male_fast     fr-FR-Wavenet-G  rate 1.10

每个 profile 还有轻微 pitch 差异。

如果某一类不需要：
把 profile 的 enabled 改成 false。

例如：
"enabled": false

查询你当前 Google Cloud 可用的 fr-FR voices
=========================================
双击：
list_google_voices.bat

结果会：
1. 在命令行列出 voice 名称 / gender
2. 保存到 data/google_fr_voices.json

只生成某些 profile
==================
命令行示例：

py tools\generate_audio.py --profiles female_normal,male_normal

只生成前 10 条：
py tools\generate_audio.py --limit 10

强制重生成：
py tools\generate_audio.py --force

断点续做
========
每生成一个 MP3，audio_manifest.json 都会马上更新。

所以即使：
- 网络断开
- API 临时报错
- 窗口被关闭

重新运行时已经生成且 fingerprint 一致的文件会自动 SKIP。

音频目录示例
============
audio/
  q0001__female_slow.mp3
  q0001__female_normal.mp3
  q0001__female_fast.mp3
  q0001__male_slow.mp3
  q0001__male_normal.mp3
  q0001__male_fast.mp3

网页每次遇到 Q0001 时，会根据当前“音源”设置随机抽一个匹配变体。

关于 API Key
============
如果希望以后不再手动输入，可在 Windows 环境变量中设置：

GOOGLE_CLOUD_TTS_API_KEY

设置以后重新打开命令行/重新双击 bat 即可读取。

下一阶段
========
Step 4：
- IndexedDB 本地训练数据库
- session 统计
- family / voice / speed 维度分析
- CSV 导出
- 之后再做 PWA 手机离线安装
