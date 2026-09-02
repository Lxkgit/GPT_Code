# Data Desk · Excel 文件夹解析 Demo

一个纯前端的 Excel 文件夹解析演示页。选择本地文件夹后，页面会读取其中的 `.xlsx`、`.xls` 和 `.csv` 文件，汇总文件数、工作表数、行数和单元格数，并展示所选工作表的完整预览数据。

## 使用

```bash
npm run dev
```

然后打开 `http://localhost:4173`，点击“选择文件夹”，或直接将 Excel 文件拖入页面。解析工作在浏览器本地进行，原始文件不会上传。

> 此 Demo 通过 SheetJS 浏览器脚本解析传统 Excel 文件；首次使用需要能访问 jsDelivr CDN。
