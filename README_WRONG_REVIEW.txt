Wrong-answer review upgrade

功能变化
========
正确回答：
- 保持原策略
- 记录 trial
- 约 420 ms 后自动播放下一题

错误回答：
- trial 仍然立即按原数据库结构写入
- 不自动进入下一题
- 保留错误选项红框与正确选项绿框
- 显示：
  1. 法语原文
  2. 正确中文答案
- 等待手动继续

手动继续方式：
- 点击“下一题”
- Enter
- Space
- N

错误复盘期间：
- “重播”可以重听当前固定 MP3
- 重播不会重新计时
- 不会重新作答
- 不会写第二条 trial

数据库
======
没有 schema 修改。
没有 IndexedDB migration。
没有统计字段修改。
已有历史记录无需处理。

安装方式
========
把升级包文件覆盖到现有 GitHub Question Reflex 项目根目录：

- app.js
- index.html
- styles.css
- service-worker.js

然后：
1. start_local.bat 本地测试
2. publish_github.bat 发布

service-worker.js 的 shell cache 已从 v1 提升到 v2，
便于已安装 PWA 获取新版程序壳。

手机 PWA 更新后若仍显示旧界面：
- 保持联网
- 完全关闭 PWA 后重新打开
- 必要时浏览器刷新一次页面

无需清除 IndexedDB，也无需清除训练记录。
