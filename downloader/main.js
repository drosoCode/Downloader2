const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const myjd = require('jdownloader-api');
const exec = require('child_process').exec;
const cron = require('node-cron');

const configFile = 'config/animes.json';
const supportedExts = ['mkv', 'mp4', 'avi'];

var config = JSON.parse(fs.readFileSync(configFile));
var foundFinishedDl = false;
var downloading = 0;


// download part
async function getLinks(browser, url, epNum, hosters)
{
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
        
    while (await page.evaluate(() => document.body.innerText.includes('DDoS protection by Cloudflare')))
        await page.waitForNavigation({timeout: 0});

    while (await page.evaluate(() => document.body.innerText.includes('One more step')))
    {
        let msgText = "Cloudflare a un nouveau captcha de merde: http://10.10.2.1:8070/vnc.html";
        axios.post(config["settings"]["discordWebHookUrl"], {content: msgText})
        await page.waitForNavigation({timeout: 0});
    }

    await page.waitForSelector('.downloadsortsonlink').catch(() => {return {}});   

    let retData = await page.evaluate((hosters, epNum) => {
        const tables = document.querySelectorAll('.downloadsortsonlink');
        let ret = new Object();
        
        tables.forEach(el => {
            if(hosters.includes(el.rows[0].childNodes[2].textContent))
            {
                for(let i=1; i<el.rows.length-1; i++)
                {
                    let num = el.rows[i].childNodes[2].childNodes[0].textContent;
                    console.log(num);
                    num = parseInt(num.substring(8), 10);
                    if(num > epNum && !(num in ret))
                    {
                        let link = el.rows[i].childNodes[2].childNodes[0].href;
                        console.log("Found new item for num "+num+": "+link);
                        ret[num] = link;
                    }
                }
            }
        });
        return ret;
    }, hosters, epNum);
    await page.close();
    return retData;
}

async function resolveDLProtect(browser, url) {
    console.log(url);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    while (await page.evaluate(() => document.body.innerText.includes('DDoS protection by Cloudflare')))
        await page.waitForNavigation().catch();
        
    while (await page.evaluate(() => document.body.innerText.includes('One more step')))
    {
        let msgText = "New Cloudflare captcha: "+config['settings']['noVNCAddr'];
        axios.post(config["settings"]["discordWebHookUrl"], {content: msgText})
        await page.waitForNavigation({timeout: 0});
    }
    
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
    await page.close();
    console.log(link)
    return link; 
}

async function addLinks(browser, id)
{
    console.log("Testing "+config["items"][id]["names"][0]);
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
                downloading++;
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

            downloading--;
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

function checkFiles()
{
    console.log("Running file scan");
    if(config["settings"]["commonDlDir"] != undefined && config["settings"]["commonDlDir"] != false && config["settings"]["commonDlDir"] != "")
        checkFinishedDownloads(config["settings"]["commonDlDir"]);

    if(config["settings"]["finishDlScript"] != undefined && config["settings"]["finishDlScript"] != "" && foundFinishedDl)
        exec(config["settings"]["finishDlScript"]);
}

// main part
async function checkDownloads()
{
    console.log("Running download scan");
    //const browser = await puppeteer.launch({executablePath: 'chromium', args: ['--no-sandbox'], headless: false});
    const browser = await puppeteer.connect({browserURL: "http://127.0.0.1:9222", defaultViewport: null});
    myjd.connect(config["settings"]["jdUser"], config["settings"]["jdPassword"]);

    for(let i=0; i<config["items"].length; i++)
        await addLinks(browser, i);

    fs.writeFileSync(configFile, JSON.stringify(config));

    checkFiles();
    if(downloading > 0 && config['settings']['downloadingDelay'] != undefined)
    {
        setTimeout(function () {
            checkFiles();
        }, config['settings']['downloadingDelay']*1000);
    }
}

checkDownloads();
console.log('Setting up CRON: ');
config['settings']['cron'].forEach(el => {
    console.log(el)
    cron.schedule(el, async () => {checkDownloads()});
});
