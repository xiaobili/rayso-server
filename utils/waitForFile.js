import { watch } from "fs";

async function waitForFile(path, page) {
  console.log("开始监听", path);

  try {
    return await new Promise((resolve, reject) => {
      console.log("进入 promise", path);
      const watcher = watch(path, async (event, filename_1) => {
        console.log(event, filename_1);
        if (event === "rename") {
          // 如果文件名以.png结尾
          if (filename_1.endsWith(".png")) {
            resolve(filename_1);
            // 关闭监听
            watcher.close();
            await page.on("close", () => {
              console.log("关闭页面");
            });
            await page.close();
          }
        }
      });
    });
  } catch (error) {
    console.log(error);
  }
}

export default waitForFile;
