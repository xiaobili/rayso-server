import { createServer } from "http";
import { launch } from "puppeteer";
import { createReadStream, rename } from "fs";
import { randomUUID } from "crypto";
import waitForFile from "./utils/waitForFile.js";

let browser = null;
// 创建服务
const server = createServer((request, response) => {
  console.log("请求开始", request.url);
  let data = null;
  let i = 0;
  request.on("data", (postData) => {
    // 拼接传来的 buffer 数据
    data = data ? Buffer.concat([data, postData]) : postData;
    console.log(`第${++i}次接收数据`);
  });

  request.on("end", async () => {
    if (data.toString().startsWith("{") && data.toString().endsWith("}")) {
      data = JSON.parse(data);
      (async () => {
        if (!browser) {
          browser = await launch({
            args: ["--disable-setuid-sandbox", "--no-sandbox"],
          });
          browser
            .target()
            .createCDPSession()
            .then((session) => {
              session.send("Browser.setDownloadBehavior", {
                behavior: "allow",
                downloadPath: "./cache",
              });
            });
        }

        const page = await browser.newPage();

        await page.goto(
          `http://localhost/#theme=${data.theme}&background=${data.background}&darkMode=${data.darkMode}&padding=${data.padding}&code=${data.code}`
        );

        const linkHandlers = await page.$x(
          "/html/body/div/div/div[3]/div[6]/button[1]"
        );

        if (linkHandlers.length > 0) {
          await linkHandlers[0].click();
        }

        const filename = await waitForFile("./cache", page);
        if (filename) {
          console.log("下载成功");
          response.writeHead(200, {
            "Content-Type": "octet-stream",
            "Content-Disposition":
              "attachment; filename=" + encodeURI(filename),
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
    } else {
      response.writeHead(500, {
        "Content-Type": "text/plain",
      });
      response.end("数据错误");
    }
  });
});

// 启动服务
server.listen(5252, () => {
  console.log("服务器启动成功,请在5252端口访问");
});
