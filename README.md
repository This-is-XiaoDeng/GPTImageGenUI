# GPT 绘图工作台（纯前端版）

一个**纯前端**的 GPT/NewAPI 绘图 WebUI：Vue 3 + Vite 构建，浏览器直连 OpenAI 兼容绘图接口，所有数据（后端配置、画廊、提示词）保存在浏览器本地，无需任何服务器。部署在 GitHub Pages 上即可使用。

> 由 [xxtg666/GPTImageGenUI](https://github.com/xxtg666/GPTImageGenUI)（Python 后端版）改写而来，保留原有功能与界面风格，去掉了 Python 后端、登录鉴权与服务端配置文件。

## 在线使用

仓库 Actions 部署完成后，在仓库 **Settings → Pages** 可看到访问地址：

```text
https://this-is-xiaodeng.github.io/GPTImageGenUI/
```

## 功能

- 文生图：浏览器直接调用 `POST {基地址}/images/generations`
- 图生图：浏览器直接调用 `POST {基地址}/images/edits`（multipart，支持多参考图）
- 网页涂抹蒙版：上传参考图后可直接涂抹，导出透明区域 PNG 蒙版随任务提交，优先于手动上传的 mask
- 分辨率：常用 OpenAI/NewAPI 尺寸、`auto` 和自定义宽高
- 高级参数：`quality`、`style`、`moderation`、`background`、`output_format`、`output_compression`
- 多后端：配置多个后端接口（别名 / URL / 模型名 / API Key），工作台右上角切换
- 任务列表：任务在浏览器中并行执行，支持失败自动重试、进度条、中断、查看原始报错
- 画廊：瀑布流布局，保存全部生成图片与元数据，支持搜索、标签筛选、归档、编辑标题标签、下载、大图预览、一键填充到工作台
- 提示词库：收藏提示词（可带参考图），一键复制或填充到工作台
- 外观：多种配色主题、自定义网页图标与背景图

## 数据存储（全部在浏览器本地）

| 数据 | 位置 | 说明 |
| --- | --- | --- |
| 后端配置 / 设置 | `localStorage`（key: `imagegen.config`） | API Key 只保存在本机浏览器 |
| 画廊 / 提示词元数据 | `localStorage`（key: `imagegen.db`） | 轻量元数据 |
| 图片本体（生成图 / 参考原图 / 提示词参考图） | IndexedDB（`imagegenui` 数据库） | 元数据通过 id 关联 |

- 数据跟随浏览器与站点：换浏览器 / 换设备 / 清除站点数据后不会恢复。
- 任务历史仅保存在内存中，刷新页面即清空（已生成的图片仍保留在画廊）。
- 请勿在公共电脑上保存 API Key。

## 本地开发

```powershell
npm install
npm run dev
```

默认地址 <http://localhost:5173>。

构建与预览：

```powershell
npm run build
npm run preview
```

## 部署（GitHub Pages）

仓库内置 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)：推送到 `main` 分支会自动构建并部署到 GitHub Pages。首次使用需在仓库 **Settings → Pages** 把 Source 设为 **GitHub Actions**。

## 与后端版的主要差异

- 无登录 / 密码功能（不再需要服务端会话）
- 上游请求由浏览器发起，**要求上游接口允许跨域（CORS）**；api.openai.com 支持浏览器直连，自建 NewAPI 需自行放开 CORS 或使用支持 CORS 的网关
- 原 Cherry Studio 风格的伪装请求头（User-Agent / Referer 等）属于浏览器禁止伪造的头，纯前端版不再携带；如上游有防盗链，请在其侧放行
- 设置中的「服务端口」不再需要；其余设置项与原版一致

## License

MIT（继承自原项目，见 [LICENSE](LICENSE)）
