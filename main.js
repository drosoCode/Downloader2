const puppeteer = require('puppeteer');
const fs = require('fs');

const configFile = 'animes.json';

//console.log(JSON.parse(fs.readFileSync(configFile)));
//fs.writeFileSync(configFile, JSON.stringify(data));

(async () => {
    //const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: false});
    const browser = await puppeteer.launch({executablePath: 'chromium', args: ['--no-sandbox'], headless: false});
    const page = await browser.newPage();
    await page.goto('https://www2.tirexo.com/animes/534411-kami-no-tou-tower-of-god-WEB-DL%201080p-VOSTFR.html', { waitUntil: 'domcontentloaded' });
        
    if (await page.evaluate(() => document.body.innerText.includes('DDoS protection by Cloudflare')))
        await page.waitForNavigation();

    await page.screenshot({path: 'example.png'});
    /*
    const data = await page.evaluate((hosters) => {        
        let hoster = document.querySelectorAll('.downloadsortsonlink')[0].rows[0].childNodes[2].textContent
        let link = document.querySelectorAll('.downloadsortsonlink')[0].rows[2].childNodes[2].childNodes[0].href;
        let epName = document.querySelectorAll('.downloadsortsonlink')[0].rows[2].childNodes[2].childNodes[0].textContent;
        console.log(hoster);
    }, '');
    await console.log(data);*/
    await page.waitForSelector('.downloadsortsonlink');   
    const stories = await page.evaluate(() => {
        return document.querySelectorAll('.downloadsortsonlink')[0].rows[0].childNodes[2].textContent;
        const links = Array.from(document.querySelectorAll('.downloadsortsonlink'))
        return links.map(link => link.rows[0].childNodes[2].textContent)  
    })  
    console.log(stories);  

    await browser.close();
})();
