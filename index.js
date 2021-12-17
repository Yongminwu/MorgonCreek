const puppeteer = require("puppeteer");
const nodemailer = require("nodemailer");
const fs = require("fs");

//const host = "https://secure.west.prophetservices.com"
const path = "/Home/nIndex";
var smtphost = "smtp.qq.com";
var mailbox = "896243113@qq.com";
var auth = "POP3/IMAP/SMTP服务的授权密码";
var startTime = "08:00";
var endTime = "12:00";
var interval = 10;

(async () => {
  await readParam();

  //let testAccount = await nodemailer.createTestAccount();
  let transporter = nodemailer.createTransport({
    host: smtphost,   // 第三方邮箱的主机地址
    port: 465,
    secure: true,     // true for 465, false for other ports
    auth: {
      user: mailbox,  // 发送方邮箱的账号
      pass: auth,     // 邮箱授权密码
    },
  });
  let infoMail = {// 定义transport对象
    from: mailbox,    // 发送方邮箱的账号
    to: mailbox,      // 邮箱接受者的账号
    subject: "Avalible Teetime", 
    text: "Sorry, there isn't any teetime that meets your condition of setting",
    //html: "欢迎注册h5.dooring.cn, 您的邮箱验证码是:<b>${emailCode}</b>", // html 内容, 如果设置了html内容, 将忽略text内容
  };

  //const browser = await puppeteer.launch({ headless:false, defaultViewport:{width:1280, height:930}, executablePath:"C:\Program Files (x86)\Google\Chrome\Application\chrome" });
  const browser = await puppeteer.launch({ headless:false, defaultViewport:{width:1280, height:930} });
  let pages = await browser.pages();
  let page = pages[0];
  if (page.url() !== "about:blank") {
    page = await browser.newPage();
  }

  await page.goto("https://www.morgancreekgolf.com");
  await page.waitForTimeout(3000);
  await page.click("#tm-header>div.tm-toolbar>div>div>div:nth-child(2)>div>a");
  await page.waitForTimeout(8000);

  pages = await browser.pages();
  page = pages[1];
  while (true) {
    let teeWeek = {
      nowDate: today(),
      teeTime: []
    };
    for (let i=1; i<=8; i++) {
      console.log("teetime 1=", i);
      try {
        if (i == 1) {
          teeWeek.teeTime.push([]);
          continue;
        } else if (i == 8) {
          await page.click("#bodyContent>div:nth-child(1)>table>tbody>tr>td:nth-child(5)");
        } else {
          await page.click("#btnCalendar");
          await page.click("#btnCalendar > div > div.datepicker-days > table > tfoot > tr:nth-child(1) > th");
          await page.waitForTimeout(3000);
          await page.click("#bodyContent>div:nth-child(1)>table>tbody>tr>td:nth-child(" + i + ")");
        }
        
        // 分析文本，提取时间
        const finalRes = await page.waitForResponse( res => res.url().indexOf(path)>0 && res.status() === 200 ); //第一天数据出不来
        let resStr = await finalRes.text();
        let start = resStr.indexOf('<div class="container-fluid teeSheet">');
        let end = resStr.indexOf('<div class="hidden noTeetimeText" style="color: Black; padding-left: 50px; padding-top:50px;">');
        let timeStr = resStr.slice(start, end);
        let teeTime = timeStr.match(/teetime='[0-9]?[0-9]:[0-9][0-9] [AP]M'/g);
        teeWeek.teeTime.push(teeTime);
        
        for (let i in teeTime) {
          if (teeTime[i].match(/teetime='[0-9]:/g) != null)
          teeTime[i] = teeTime[i].replace("teetime='", "teetime='0");
        }
      } catch(e) {
        console.log(e);
      }
      await page.waitForTimeout(1000);
    }
    console.log(teeWeek);

    // 分析符合条件的数据
    let teeweekOfQualify = {
      dates: [],
      teeTime: [[], [], [], [], [], [], [], []],
      total:0
    }
    let todayDate = new Date();
    for (let i = 0; i < 8; i++) {
      todayDate.setDate(todayDate.getDate() + 1)
      teeweekOfQualify.dates.push(dateToStr(todayDate));
    }
    for (let i in teeWeek.teeTime) {
      let tw = teeWeek.teeTime[i];
      if (tw === []) continue;
      for (let tt of tw) {
        if (tt.indexOf("AM") > 0) {
          tt = tt.replace("teetime='", "").replace(" AM'", "");
        } else if (tt.indexOf("PM") > 0) {
          tt = tt.replace("teetime='", "").replace(" PM'", "");
          tt = (Number(tt.split(":")[0])<12 ? Number(tt.split(":")[0])+12 : Number(tt.split(":")[0])) + ":" + tt.split(":")[1]
        }

        if ((tt>startTime) && (tt<endTime)) {
          teeweekOfQualify.teeTime[i].push(tt);
          teeweekOfQualify.total++;
        }
      }
    }
    console.log(teeweekOfQualify);
    
    //发送邮件
    if (teeweekOfQualify.total > 0) {
      infoMail.text = "There are " + teeweekOfQualify.total + " teetimes.\n";
      for (let i = 0; i < 8; i++) {
        if (teeweekOfQualify.teeTime[i].length > 0) {
          infoMail.text += teeweekOfQualify.dates[i] + ": " + teeweekOfQualify.teeTime[i].toString() + "\n";
        }
      }
      console.log(infoMail.text);
      await transporter.sendMail(infoMail);
      // Wait 1 day
      await page.waitForTimeout(1000*60*60*24);
    } else {
      // Wait 10 minute
      await page.waitForTimeout(1000*60*interval);
    }
  }

  //await browser.close();
})();

function readParam() {
  return new Promise(function (resolve, reject) {
    fs.readFile("./conf.json", function(err, data) {
      if (err) {
        console.log("Read file conf.json failed!");
        reject();
        //throw err;
      }
      
      let obj = JSON.parse(data);
      smtphost = obj.smtphost;
      mailbox = obj.mailbox;
      auth = obj.auth;
      startTime = obj.startTime;
      endTime = obj.endTime;
      interval = obj.interval;
      console.log(obj);
      resolve();
    });
  })
}

function dateToStr(day) {
  var nowMonth = day.getMonth() + 1;
  var nowDay = day.getDate();
  var seperator = "/";
  if (nowMonth >= 1 && nowMonth <= 9) {
     nowMonth = "0" + nowMonth;
  }
  if (nowDay >= 0 && nowDay <= 9) {
     nowDay = "0" + nowDay;
  }

  var nowDate = nowMonth + seperator + nowDay + seperator + day.getFullYear();
  //console.log(nowDate);
  return nowDate;
}

/*
page.on("response", async (res) => {
  if (res.url().indexOf(path)>0 && res.status()===200) {
    console.log(res);
  }
})

await page.click("#SignInNavbarLargeSearch>a");
//await page.type("#txtFromDateLarge", "12/07/2021");
await page.$eval("#txtFromDateLarge", el=>el.setAttribute("value", nowDate));
await page.select("#StartTimeDropDownLarge", "AnyTime");
await page.click("#playerNumberGroup>button:nth-child(4)");
await page.click("#btnSubmit");
*/
