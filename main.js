const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const myjd = require('jdownloader-api');
const exec = require('child_process').exec;
const CronJob = require('cron').CronJob;

const configFile = 'config/animes.json';
const supportedExts = ['mkv', 'mp4', 'avi'];

var config = JSON.parse(fs.readFileSync(configFile));
var foundFinishedDl = false;


// download part
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
    
    while (await page.evaluate(() => document.body.innerText.includes('DDoS protection by Cloudflare')))
        await page.waitForNavigation().catch();
    
    let link = null;
    for(let i=0; i<4; i++)
    {
        try {
            await page.waitForSelector('.lienet', { timeout: 500 });
            link = await page.evaluate(() => {return document.querySelector('.lienet').childNodes[0].href;});
            break;
        }
        catch (err) {
            try{
                await page.waitForSelector('.continuer', { timeout: 500 });
                await page.click('.continuer');
            }
            catch (err){}
        }
    }
    console.log(link)
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
                console.log("New link for "+config["items"][id]["names"][0]+" EP"+key+": "+link);

                await myjd.addLinks(link, config["settings"]["jdID"], true);

                let msgText = "Adding episode "+key+" for "+config["items"][id]["names"][0];
                await axios.post(config["settings"]["discordWebHookUrl"], {content: msgText})
            }
        }

        let max = parseInt(Object.keys(links)[Object.keys(links).length-1])
        if(max > config["items"][id]["maxEp"])
            config["items"][id]["maxEp"] = max;
    }
}


// move downloaded files part

function checkName(names, data) {
    let ret = false;
    names.forEach(n => {
        let w = n.split(' ');
        let l = "";
        w.forEach(el => { l += el.charAt(0) });
        let reg = '('+w.join('.*')+')|('+l+')';
        if(new RegExp(reg, 'i').exec(data) != null)
            ret = true;
    });
    return ret;
}

function identifyFile(name) {
    for(let i=0; i<config["items"].length; i++)
        if(checkName(config['items'][i]['names'], name))
            return i;
    return -1;
}

function processFile(filePath, fileName) {
    let ext = fileName.substring(fileName.lastIndexOf('.')+1);
    if(supportedExts.includes(ext))
    {
        let i = identifyFile(fileName);
        if(i != -1)
        {
            let num = fileName.match('(?<=[ +_\\.\\-Ee])\\d{1,3}(?=[ +_\\.\\-])')[0];
            let name = config['items'][i]['prefix']+num+'.'+ext;

            //send notif
            let msgText = "Finished Download for "+config["items"][i]["names"][0]+" E"+num;
            axios.post(config["settings"]["discordWebHookUrl"], {content: msgText})

            //move file to dest
            let dest = path.join(config['settings']['commonMoveDestDir'], config['items'][i]['moveDir'], name);
            console.log("Moving file "+filePath+" to "+dest);
            exec('mv "'+filePath+'" "'+dest+'"');

            foundFinishedDl = true;
        }
    }
}

function checkFinishedDownloads(dir)
{
    files = fs.readdirSync(dir);

    //rm empty dir
    if(files.length == 0 && dir != config["settings"]["commonDlDir"])
        fs.rmdirSync(dir);
    //list files
    files.forEach(file => {
        let filePath = path.join(dir, file)
        if (fs.statSync(filePath).isDirectory()) {
            checkFinishedDownloads(filePath, file);
        }
        else {
            processFile(filePath, file);
        }
    });
}

// main part
async function checkDownloads()
{
    const browser = await puppeteer.launch({executablePath: 'chromium', args: ['--no-sandbox'], headless: false});
    myjd.connect(config["settings"]["jdUser"], config["settings"]["jdPassword"]);

    for(let i=0; i<config["items"].length; i++)
        await addLinks(browser, i);

    fs.writeFileSync(configFile, JSON.stringify(config));
    await browser.close();

    if(config["settings"]["commonDlDir"] != undefined && config["settings"]["commonDlDir"] != false && config["settings"]["commonDlDir"] != "")
        checkFinishedDownloads(config["settings"]["commonDlDir"]);

    if(config["settings"]["finishDlScript"] != undefined && config["settings"]["finishDlScript"] != "" && foundFinishedDl)
        exec(config["settings"]["finishDlScript"]);
}

config['settings']['cron'].forEach(el => {
    new CronJob('* * * * * *', checkDownloads(), null, true, config['settings']['timezone']);
});