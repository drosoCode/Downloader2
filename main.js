const puppeteer = require('puppeteer');
const fs = require('fs');
const axios = require('axios');
const myjd = require('jdownloader-api');

const configFile = 'config/animes.json';

var config = JSON.parse(fs.readFileSync(configFile));


async function getLinks(browser, url, epNum, hosters)
{
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
        
    if (await page.evaluate(() => document.body.innerText.includes('DDoS protection by Cloudflare')))
        await page.waitForNavigation({timeout: 60000});

    await page.waitForSelector('.downloadsortsonlink').catch(() => {return {}});   

    return await page.evaluate((hosters, epNum) => {
        const tables = document.querySelectorAll('.downloadsortsonlink');
        let ret = new Object();
        
        tables.forEach(el => {
            if(hosters.includes(el.rows[0].childNodes[2].textContent))
            {
                for(let i=1; i<el.rows.length-1; i++)
                {
                    let num = el.rows[i].childNodes[2].childNodes[0].textContent;
                    num = parseInt(num.substring(8), 10);
                    if(num > epNum && !(num in ret))
                        ret[num] = el.rows[i].childNodes[2].childNodes[0].href;
                }
            }
        });
        return ret;
    }, hosters, epNum);
}

async function resolveDLProtect(browser, url) {
    console.log(url);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    if (await page.evaluate(() => document.body.innerText.includes('DDoS protection by Cloudflare')))
        await page.waitForNavigation().catch();
    
    let link = null;
    for(let i=0; i<3; i++)
    {
        try {
            await page.waitForSelector('.lienet', { timeout: 300 });
            link = await page.evaluate(() => {return document.querySelector('.lienet').childNodes[0].href;});
        }
        catch (err) {
            try{
                await page.waitForSelector('.continuer', { timeout: 300 });
                await page.click('.continuer');
            }
            catch (err){}
        }
    }
    return link;    
}

async function addLinks(browser, id)
{
    if(config["items"][id]["enabled"])
    {
        const links = await getLinks(browser, config["settings"]["baseURL"]+config["items"][id]["link"], config["items"][id]["maxEp"], config["settings"]["allowedHosters"]);
        for (let [key, value] of Object.entries(links)) 
        {
            let link = await resolveDLProtect(browser, value);
            if(link != null)
            {
                console.log("New link for "+config["items"][id]["name"]+" EP"+key+": "+link);

                await myjd.addLinks(link, config["settings"]["jdID"], true);

                let msgText = "Adding episode "+key+" for "+config["items"][id]["name"];
                await axios.post(config["settings"]["discordWebHookUrl"], {content: msgText})
            }
        }

        let max = Object.keys(links)[Object.keys(links).length-1]
        if(max > config["items"][id]["maxEp"])
            config["items"][id]["link"] = max;
    }
}


(async () => {
    const browser = await puppeteer.launch({executablePath: 'chromium', args: ['--no-sandbox'], headless: false});
    myjd.connect(config["settings"]["jdUser"], config["settings"]["jdPassword"]);

    for(let i=0; i<config["items"].length; i++)
        await addLinks(browser, i);

    fs.writeFileSync(configFile, JSON.stringify(config));
    await browser.close();
})();
