# Smart Caption for IINA 1.7.7.0

本版基于1.7.6.5增量更新，保留原有Chat、Caption、Note、Gallery、Film、翻译、字幕优化和主题设置。安装包使用相同插件标识，安装时替换旧版本即可保留IINA中的现有偏好。

## ASR设置

插件设置新增独立ASR模块。VideoCaptioner支持配置命令行程序或带虚拟环境的项目目录，并自动查找常见安装位置。可启用剪映、必剪、Faster Whisper、Whisper.cpp、Whisper API，默认仅启用剪映和必剪。其他引擎沿用VideoCaptioner自己的模型与依赖配置；实际支持情况取决于本地版本。自动检测依赖已打开视频的插件实例，请保持至少一个IINA视频窗口打开。[VideoCaptioner官方项目](https://github.com/WEIFENG2333/VideoCaptioner)

Apple使用插件内置SpeechAnalyzer工具，不需要API Key。需要支持SpeechAnalyzer的macOS与SDK；提供自定义工具路径、FFmpeg路径和默认语言配置。自定义工具遵循三个位置参数：音频路径、输出SRT路径、BCP-47语言。Caption选择“自动”时使用设置中的Apple默认语言，初次识别会按需安装语言资源。[Apple SpeechAnalyzer](https://developer.apple.com/documentation/speech/speechanalyzer)

ASR Model提供OpenRouter、SiliconFlow、OpenAI和自定义四种服务商，API Key、URL、模型列表与Chat完全分开。只有已填写模型及必要连接配置的服务商会出现在Caption二级菜单中。OpenRouter默认使用支持input_audio的音频对话接口；其他服务商默认使用音频转录接口，也可手动更改接口格式。请填写真实支持所选协议的模型ID。[OpenRouter音频输入](https://openrouter.ai/docs/guides/overview/multimodal/audio)、[SiliconFlow语音转录](https://docs.siliconflow.cn/docs/api/audio-transcriptions-post)、[OpenAI语音转录](https://developers.openai.com/api/docs/guides/speech-to-text)

云端识别逐段提取音频并请求所选服务。若接口返回有效的分段时间戳，使用接口时间戳；仅返回文本时使用每段最长8秒的音频边界定位，不能等同于词级对齐。长句可能跨越分段边界。任何一段失败时均不保存残缺字幕。临时音频、请求和返回文件在任务结束或取消后清理；请求取消后，正在执行的单次进程结束时进行清理，网络请求最长等待120秒。

## 字幕阅读与导航

Caption、Chat总结、Gallery Film与弹出菜单采用统一的紧凑玻璃面板、分组选项、选中态和间距。字幕文字移除旧的模糊、缩放及渐变遮罩组合，使用清晰文字的颜色层次突出当前行，降低WebKit图层合成造成彩色边缘伪影的风险。工具栏保留玻璃效果。

Caption底部新增返回、定位、前进三枚圆形按钮。字幕、Markdown时间戳和Gallery图片时间跳转均记录历史，最多保留五步返回与五步前进，新跳转清空前进分支，更换视频重置。中间按钮立即定位当前字幕；播放时停止浏览字幕1.5秒后恢复跟随，暂停时保留阅读位置。

## 图片保存与删除

Chat当前画面截图读取到内存后立即删除临时文件，保存回答时才持久化图片。重复保存、编辑重发和复用Gallery图片会按内容校验并尽可能使用已有文件；源图片被用户删除或移动时继续保留原有明确报错。Note尚未保存的Capture截图同样暂存在内存，保存笔记时才写入图片目录。内存中的对话和笔记草稿可继续保留供重新打开窗口使用，但不会因此积累未保存的磁盘图片。

Gallery的删除与清除未引用图片，会先将本次图片移入当前图片目录下的“视频文件名-删除”文件夹，再整夹移入废纸篓。同名暂存文件夹存在时添加数字后缀。移动失败会尝试还原原位置。Film筛除的重复帧与失败任务自己的临时帧直接清理，不再散落到废纸篓。不会自动追溯删除旧版本已产生的图片。
