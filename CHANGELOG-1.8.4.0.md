# Smart Caption 1.8.4.0

2026年10月9日。以1.8.3.3完整包为基线，面向IINA 1.5.0进行适配与稳定性更新。

## 兼容性与修复

使用IINA实际提供的`mpv.getFlag`读取Film截图前的暂停状态；成功、失败和取消后恢复原播放位置与暂停状态。截图期间切换媒体会停止当前任务，避免跳转新视频；最后一张截图期间取消也不会发布Film文件。

合并后自动播放的监听器按IINA接口要求使用`event.off(eventName, listenerID)`解除，防止完成后反复触发。

本地媒体路径优先使用mpv实际路径，IINA已经解码的`core.status.url`不再重复解码，保留文件名中的字面`%20`和`%25`等字符。

监听主字幕、副字幕和轨道列表的变化，合并短时间内的重复刷新，清除旧字幕缓存并自动更新Caption、Chat字幕状态和Film字幕状态。异步重试携带刷新代次，旧轨道的延迟回调不会继续推送内容。按开始时间稳定排序字幕，避免ASS等文件事件顺序与时间轴顺序不一致时高亮跳错。

增加IINA 1.5.0支持的简体中文插件描述。插件标识、权限清单、偏好默认值和原有功能保留。

## 性能

启动时一次读取配置文件，替代原来的30次逐字段外部进程调用；读取过程中用户修改的配置不会被迟到的恢复结果覆盖。不记录或向页面发送密钥。

Caption双语匹配从逐行扫描全副字幕改为预先建立索引后查询，保留重叠时间轴、等距与空隙的原有匹配规则。高亮只更新原位置与新位置周围的行；播放仍处于同一句时跳过重复样式写入和居中操作。手动回中和自动恢复跟随会主动居中。离开Caption或页面隐藏时停止时间轮询。

## 本次验证

所有JavaScript文件和HTML内联脚本语法、macOS JavaScriptCore初始化、字幕变化/缓存/重试、配置恢复竞态、本地路径、Film播放状态与取消、合并事件解除的自动化检查通过。副字幕匹配与旧算法进行25400组对照，包含重叠、等距和空隙。

Chrome浏览器模拟IINA消息桥：5000行双语字幕、390/560/900像素宽度、深浅色、四种工作模式、图片选中状态、普通保存、另存为与取消通过。对照测试中5000行双语字幕首次渲染约186.8毫秒降至84.3毫秒；同一句内连续100次时间更新从100万次class操作降至0次。这是本机同条件模拟结果，不能换算为IINA整体性能提升比例。

尚未在升级后的真实IINA窗口完成端到端验收；当前播放和插件编辑会话未强制重载。Intel实机、真实模型/付费ASR以及完整长视频Film/Merge本次未测试。

## 来源

- [IINA 1.5.0官方发布说明](https://github.com/iina/iina/releases/tag/v1.5.0)
- [1.5.0 mpv接口实现](https://github.com/iina/iina/blob/v1.5.0/iina/JavascriptAPIMpv.swift)
- [1.5.0事件接口实现](https://github.com/iina/iina/blob/v1.5.0/iina/JavascriptAPIEvent.swift)
- [1.5.0媒体状态接口实现](https://github.com/iina/iina/blob/v1.5.0/iina/JavascriptAPICore.swift)
- [1.5.0窗口接口实现](https://github.com/iina/iina/blob/v1.5.0/iina/JavascriptAPIStandaloneWindow.swift)
- [插件本地化文档](https://docs.iina.io/pages/dev-guide.html)
