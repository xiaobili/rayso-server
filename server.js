import { createServer } from "http";
import { launch } from "puppeteer";
import { watch, createReadStream, rename } from "fs";
import { randomUUID } from "crypto";
import { parse } from "url";

let browser = null;

// 创建服务
const server = createServer((request, response) => {
  console.log("请求开始", request.url);

  const path = parse(request.url, true).query;
  (async () => {
    if (!browser) {
      browser = await launch({
        args: ["--disable-setuid-sandbox", "--no-sandbox"],
      });
    }

    const page = await browser.newPage();

    page
      .target()
      .createCDPSession()
      .then((session) => {
        session.send("Page.setDownloadBehavior", {
          behavior: "allow",
          downloadPath: "./cache",
        });
      });

    await page.goto(
      `http://localhost/#theme=${path.theme}&background=true&darkMode=true&padding=64&code=${path.code}`
    );

    const linkHandlers = await page.$x(
      "/html/body/div/div/div[3]/div[6]/button[1]"
    );

    if (linkHandlers.length > 0) {
      await linkHandlers[0].click();
    }
    async function waitForFile(path) {
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
          // // 如果60秒后还没有下载成功,则停止监听
          // setTimeout(async () => {
          // 	reject("下载失败");
          // 	await browser.close();
          // 	watcher.close();
          // }, 60000);
        });
      } catch (error) {
        console.log(error);
      }
    }
    const filename = await waitForFile("./cache");
    if (filename) {
      console.log("下载成功");
      response.writeHead(200, {
        "Content-Type": "octet-stream",
        "Content-Disposition": "attachment; filename=" + encodeURI(filename),
      });
      const stream = createReadStream("./cache/" + filename);
      stream.pipe(response);
      stream.on("end", () => {
        rename(
          "./cache/" + filename,
          "./cache/" + randomUUID() + ".png",
          (err) => {
            if (err) {
              console.log(err);
            }
          }
        );
      });
    }
  })();
  console.log("请求结束", request.url);
});

// 启动服务
server.listen(5252, () => {
  console.log("服务器启动成功,请在5252端口访问");
});
